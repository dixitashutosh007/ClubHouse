import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth, serverError } from '@/lib/api-auth';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { CircleIdSchema, CircleMemberActionSchema } from '@/lib/validation/schemas';
import { CIRCLE_REQUEST_COOLDOWN_DAYS } from '@/lib/circle-types';
import { circleAccess, circleAdminIds, notifyCircle, peopleFor, recountMembers } from '@/lib/services/circles';
import type { CircleMember } from '@/types';

const audit = (societyId: string, actorUserId: string, action: string, circleId: string, metadata: Record<string, unknown>) =>
  getRepository().recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId,
    actorUserId,
    action,
    entityType: 'CIRCLE',
    entityId: circleId,
    metadata,
    createdAt: new Date().toISOString(),
  });

// Join requests and members of a circle, by name (circle admins and society admins)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, CircleIdSchema);
  if (query instanceof NextResponse) return query;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, query.circleId);
    if (!circle) return errorResponse('Circle not found', 404);
    const access = circleAccess(await repo.getCircleMember(auth.societyId, circle.id, auth.userId), auth.role);
    if (!access.canManage) return errorResponse('Only the circle admins can see join requests', 403);
    const members = await repo.listCircleMembers(auth.societyId, circle.id);
    const people = await peopleFor(
      repo,
      members.map((m) => m.userId)
    );
    const row = (m: CircleMember) => ({
      userId: m.userId,
      name: people.get(m.userId)?.fullName ?? 'Resident',
      role: m.role,
      status: m.status,
      requestedAt: m.requestedAt,
      approvedAt: m.approvedAt,
    });
    return NextResponse.json({
      requests: members
        .filter((m) => m.status === 'REQUESTED')
        .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
        .map(row),
      members: members
        .filter((m) => m.status === 'APPROVED')
        .map(row)
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    return serverError('circle members GET', err);
  }
}

// "Interested": ask to join (or join an open circle straight away)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, CircleIdSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, body.circleId);
    if (!circle || circle.status !== 'ACTIVE') return errorResponse('Circle not found', 404);
    const existing = await repo.getCircleMember(auth.societyId, circle.id, auth.userId);
    if (existing?.status === 'APPROVED') return errorResponse('You are already a member', 409);
    if (existing?.status === 'REQUESTED') return errorResponse('Your request is already waiting', 409);
    if (existing?.status === 'REJECTED' && existing.rejectedAt) {
      const until = Date.parse(existing.rejectedAt) + CIRCLE_REQUEST_COOLDOWN_DAYS * 86_400_000;
      if (Date.now() < until) return errorResponse(`You can ask again after ${CIRCLE_REQUEST_COOLDOWN_DAYS} days`, 429);
    }
    if (circle.audience === 'WOMEN' || circle.audience === 'MEN') {
      const user = await repo.getUserById(auth.userId);
      const blocked = (circle.audience === 'WOMEN' && user?.gender === 'MALE') || (circle.audience === 'MEN' && user?.gender === 'FEMALE');
      if (blocked) return errorResponse(circle.audience === 'WOMEN' ? 'This circle is for women' : 'This circle is for men', 403);
    }
    const now = new Date().toISOString();
    const open = circle.joinMode === 'OPEN';
    await repo.saveCircleMember({
      societyId: auth.societyId,
      circleId: circle.id,
      userId: auth.userId,
      role: 'MEMBER',
      status: open ? 'APPROVED' : 'REQUESTED',
      requestedAt: now,
      ...(open ? { approvedAt: now } : {}),
    });
    if (open) await recountMembers(repo, circle);
    else {
      const user = await repo.getUserById(auth.userId);
      await notifyCircle(
        repo,
        auth.societyId,
        await circleAdminIds(repo, circle),
        `New request to join ${circle.name}`,
        `${user?.fullName ?? 'A resident'} would like to join.`,
        `/circles/${circle.id}`
      );
    }
    return NextResponse.json({ success: true, status: open ? 'APPROVED' : 'REQUESTED' });
  } catch (err) {
    return serverError('circle members POST', err);
  }
}

// Leave a circle, or withdraw a request
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, CircleIdSchema);
  if (query instanceof NextResponse) return query;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, query.circleId);
    const me = circle ? await repo.getCircleMember(auth.societyId, circle.id, auth.userId) : null;
    if (!circle || !me) return errorResponse('You are not in this circle', 404);
    if (me.role === 'OWNER' && me.status === 'APPROVED' && circle.status !== 'CLOSED') {
      return errorResponse('Hand the circle to another member, or close it, before you leave', 409);
    }
    await repo.deleteCircleMember(auth.societyId, circle.id, auth.userId);
    await recountMembers(repo, circle);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('circle members DELETE', err);
  }
}

// Circle admins (and society admins): approve, reject or remove people, manage co-admins, hand over ownership
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, CircleMemberActionSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, body.circleId);
    if (!circle || circle.status === 'CLOSED' || circle.status === 'REJECTED') return errorResponse('Circle not found', 404);
    const access = circleAccess(await repo.getCircleMember(auth.societyId, circle.id, auth.userId), auth.role);
    if (!access.canManage) return errorResponse('Only the circle admins can do this', 403);
    const target = await repo.getCircleMember(auth.societyId, circle.id, body.userId);
    if (!target) return errorResponse('This resident is not in the circle', 404);
    const now = new Date().toISOString();
    const link = `/circles/${circle.id}`;
    const ownerOnly = body.action === 'MAKE_CO_ADMIN' || body.action === 'REMOVE_CO_ADMIN' || body.action === 'TRANSFER_OWNERSHIP';
    if (ownerOnly && !access.isOwner && !access.isSocietyAdmin)
      return errorResponse('Only the owner can manage co-admins and ownership', 403);

    switch (body.action) {
      case 'APPROVE':
      case 'REJECT': {
        if (target.status !== 'REQUESTED') return errorResponse('This request has already been answered', 409);
        const approve = body.action === 'APPROVE';
        await repo.saveCircleMember({
          ...target,
          status: approve ? 'APPROVED' : 'REJECTED',
          ...(approve
            ? { approvedAt: now, rejectedAt: undefined, rejectionNote: undefined }
            : { rejectedAt: now, rejectionNote: body.note || undefined }),
          decidedBy: auth.userId,
        });
        if (approve) await recountMembers(repo, circle);
        await notifyCircle(
          repo,
          auth.societyId,
          [target.userId],
          approve ? `You're in ${circle.name}` : `Your request to join ${circle.name} was declined`,
          approve
            ? 'You can now see the group link, its admins and members.'
            : body.note || `You can ask again after ${CIRCLE_REQUEST_COOLDOWN_DAYS} days.`,
          link
        );
        break;
      }
      case 'REMOVE': {
        if (target.status !== 'APPROVED') return errorResponse('Only members can be removed', 409);
        if (target.role === 'OWNER') return errorResponse('The owner cannot be removed. Transfer ownership first.', 409);
        if (target.role === 'CO_ADMIN' && !access.isOwner && !access.isSocietyAdmin)
          return errorResponse('Only the owner can remove a co-admin', 403);
        await repo.deleteCircleMember(auth.societyId, circle.id, target.userId);
        await recountMembers(repo, circle);
        await notifyCircle(
          repo,
          auth.societyId,
          [target.userId],
          `You were removed from ${circle.name}`,
          'You can ask to join again later.',
          '/circles'
        );
        break;
      }
      case 'MAKE_CO_ADMIN':
      case 'REMOVE_CO_ADMIN': {
        if (target.status !== 'APPROVED' || target.role === 'OWNER') return errorResponse('Choose a member of the circle', 409);
        const make = body.action === 'MAKE_CO_ADMIN';
        await repo.saveCircleMember({ ...target, role: make ? 'CO_ADMIN' : 'MEMBER' });
        if (make)
          await notifyCircle(
            repo,
            auth.societyId,
            [target.userId],
            `You're now a co-admin of ${circle.name}`,
            'You can approve requests, remove members and edit the circle.',
            link
          );
        break;
      }
      case 'TRANSFER_OWNERSHIP': {
        if (target.status !== 'APPROVED' || target.role === 'OWNER') return errorResponse('Choose a member of the circle', 409);
        if (circle.ownerUserId) {
          const current = await repo.getCircleMember(auth.societyId, circle.id, circle.ownerUserId);
          if (current) await repo.saveCircleMember({ ...current, role: 'CO_ADMIN' });
        }
        await repo.saveCircleMember({ ...target, role: 'OWNER' });
        await repo.saveCircle({ ...circle, ownerUserId: target.userId, updatedAt: now });
        await notifyCircle(
          repo,
          auth.societyId,
          [target.userId],
          `You now own ${circle.name}`,
          'You can manage co-admins, hand over or close the circle.',
          link
        );
        break;
      }
    }
    await audit(auth.societyId, auth.userId, `CIRCLE_MEMBER_${body.action}`, circle.id, { name: circle.name, targetUserId: target.userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('circle members PATCH', err);
  }
}
