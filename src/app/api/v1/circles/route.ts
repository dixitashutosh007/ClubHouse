import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth, serverError } from '@/lib/api-auth';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { CircleActionSchema, CreateCircleSchema, ListCirclesQuerySchema, UpdateCircleSchema } from '@/lib/validation/schemas';
import { isCircleArchived, CIRCLE_REQUEST_COOLDOWN_DAYS, circleTypesFor, maxCirclesFor } from '@/lib/circle-types';
import { circleAccess, circleView, isSocietyAdminRole, notifyCircle, peopleFor, societyAdminIds } from '@/lib/services/circles';
import type { Circle, CircleMember, CircleReviewedFields } from '@/types';

const REVIEWED: (keyof CircleReviewedFields)[] = ['name', 'description', 'whatsappLink', 'otherLink'];

const audit = (societyId: string, actorUserId: string, action: string, circle: Circle, metadata: Record<string, unknown> = {}) =>
  getRepository().recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId,
    actorUserId,
    action,
    entityType: 'CIRCLE',
    entityId: circle.id,
    metadata: { name: circle.name, ...metadata },
    createdAt: new Date().toISOString(),
  });

/** The chosen type must be one of the society's; a sub-type must be listed unless typed in ("Other") */
async function typeError(societyId: string, type: string, subType: string | undefined, custom: boolean | undefined) {
  const society = await getRepository().getSocietyById(societyId);
  const types = circleTypesFor(society?.settings);
  const match = types.find((t) => t.name.toLowerCase() === type.toLowerCase());
  if (!match) return 'Choose a circle type from the list';
  if (subType && !custom && !match.subTypes.some((s) => s.toLowerCase() === subType.toLowerCase()))
    return 'Choose a sub-type from the list';
  return null;
}

// Circles: browse live ones, one circle in detail, your own, or (society admins) pending and all
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, ListCirclesQuerySchema);
  if (query instanceof NextResponse) return query;

  try {
    const repo = getRepository();
    const isSocietyAdmin = isSocietyAdminRole(auth.role);
    const mine = await repo.listUserCircleMemberships(auth.societyId, auth.userId);
    const myMember = (circleId: string) => mine.find((m) => m.circleId === circleId) ?? null;

    if (query.id) {
      const circle = await repo.getCircle(auth.societyId, query.id);
      const access = circle ? circleAccess(myMember(circle.id), auth.role) : null;
      // Pending, rejected and closed circles are seen only by their own people and society admins
      const visible =
        circle &&
        access &&
        (circle.status === 'ACTIVE' || access.isSocietyAdmin || circle.createdByUserId === auth.userId || access.isMember);
      if (!circle || !access || !visible) return errorResponse('Circle not found', 404);
      // Archived (closed over 60 days): only society admins can still open it
      if (isCircleArchived(circle) && !access.isSocietyAdmin) return errorResponse('Circle not found', 404);
      const members = access.isMember ? await repo.listCircleMembers(auth.societyId, circle.id) : [];
      const people = await peopleFor(
        repo,
        members.filter((m) => m.status === 'APPROVED').map((m) => m.userId)
      );
      return NextResponse.json({ circle: circleView(circle, access, { members, people, cooldownDays: CIRCLE_REQUEST_COOLDOWN_DAYS }) });
    }

    const all = await repo.listCircles(auth.societyId);
    const toView = (c: Circle) => circleView(c, circleAccess(myMember(c.id), auth.role), { cooldownDays: CIRCLE_REQUEST_COOLDOWN_DAYS });

    if (query.view === 'pending' || query.view === 'all') {
      if (!isSocietyAdmin) return errorResponse('Forbidden', 403);
      const list =
        query.view === 'pending' ? all.filter((c) => c.status === 'PENDING_APPROVAL' || (c.status === 'ACTIVE' && c.pendingChange)) : all;
      return NextResponse.json({ circles: list.map(toView) });
    }

    if (query.view === 'mine') {
      const ids = new Set([...mine.map((m) => m.circleId), ...all.filter((c) => c.createdByUserId === auth.userId).map((c) => c.id)]);
      return NextResponse.json({
        circles: all
          .filter((c) => ids.has(c.id) && (c.status !== 'REJECTED' || c.createdByUserId === auth.userId) && !isCircleArchived(c))
          .map(toView),
      });
    }

    return NextResponse.json({ circles: all.filter((c) => c.status === 'ACTIVE').map(toView) });
  } catch (err) {
    return serverError('circles GET', err);
  }
}

// Start a circle: a resident's waits for society admin approval; a society admin's is live at once
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, CreateCircleSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const isSocietyAdmin = isSocietyAdminRole(auth.role);
    const invalid = await typeError(auth.societyId, body.type, body.subType, body.isCustomSubType);
    if (invalid) return errorResponse(invalid);

    if (!isSocietyAdmin) {
      const society = await repo.getSocietyById(auth.societyId);
      const limit = maxCirclesFor(society?.settings);
      const running = (await repo.listCircles(auth.societyId)).filter(
        (c) => c.ownerUserId === auth.userId && (c.status === 'ACTIVE' || c.status === 'PENDING_APPROVAL')
      ).length;
      if (running >= limit) return errorResponse(`You can run up to ${limit} circles. Close one to start another.`, 409);
    }

    const now = new Date().toISOString();
    const circle: Circle = {
      id: `cir-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      createdByUserId: auth.userId,
      ownerUserId: auth.userId,
      name: body.name,
      type: body.type,
      subType: body.subType,
      isCustomSubType: body.subType ? Boolean(body.isCustomSubType) : undefined,
      description: body.description,
      photoUrl: body.photoUrl || undefined,
      place: body.place || undefined,
      schedule: body.schedule || undefined,
      audience: body.audience,
      ageMin: body.audience === 'AGE_RANGE' ? body.ageMin : undefined,
      ageMax: body.audience === 'AGE_RANGE' ? body.ageMax : undefined,
      joinMode: body.joinMode,
      whatsappLink: body.whatsappLink || undefined,
      otherLink: body.otherLink || undefined,
      status: isSocietyAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
      ...(isSocietyAdmin ? { approvedAt: now } : {}),
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createCircle(circle);
    const owner: CircleMember = {
      societyId: auth.societyId,
      circleId: circle.id,
      userId: auth.userId,
      role: 'OWNER',
      status: 'APPROVED',
      requestedAt: now,
      approvedAt: now,
    };
    await repo.saveCircleMember(owner);
    await audit(auth.societyId, auth.userId, 'CIRCLE_CREATED', circle, { status: circle.status });
    if (!isSocietyAdmin) {
      await notifyCircle(
        repo,
        auth.societyId,
        await societyAdminIds(repo, auth.societyId),
        'A circle is waiting for approval',
        `${circle.name} (${circle.type}) was started by a resident.`,
        '/admin?tab=CIRCLES'
      );
    }
    return NextResponse.json({ success: true, circle: circleView(circle, circleAccess(owner, auth.role)) });
  } catch (err) {
    return serverError('circles POST', err);
  }
}

// Edit a circle (its owner, co-admins or a society admin). On a live circle a
// resident's change to the name, description or links waits for approval;
// the approved version stays visible until then.
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, UpdateCircleSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, body.circleId);
    if (!circle || circle.status === 'CLOSED' || circle.status === 'REJECTED') return errorResponse('Circle not found', 404);
    const access = circleAccess(await repo.getCircleMember(auth.societyId, circle.id, auth.userId), auth.role);
    if (!access.canManage) return errorResponse('Only the circle admins can edit it', 403);
    const invalid = await typeError(auth.societyId, body.type, body.subType, body.isCustomSubType);
    if (invalid) return errorResponse(invalid);

    const now = new Date().toISOString();
    const reviewed: CircleReviewedFields = {
      name: body.name,
      description: body.description,
      whatsappLink: body.whatsappLink || undefined,
      otherLink: body.otherLink || undefined,
    };
    const changedReviewed = REVIEWED.some((k) => (reviewed[k] ?? '') !== (circle[k] ?? ''));
    const needsReview = changedReviewed && circle.status === 'ACTIVE' && !access.isSocietyAdmin;

    const updated: Circle = {
      ...circle,
      ...(needsReview ? {} : reviewed),
      type: body.type,
      subType: body.subType,
      isCustomSubType: body.subType ? Boolean(body.isCustomSubType) : undefined,
      photoUrl: body.photoUrl === '' ? undefined : (body.photoUrl ?? circle.photoUrl),
      place: body.place || undefined,
      schedule: body.schedule || undefined,
      audience: body.audience,
      ageMin: body.audience === 'AGE_RANGE' ? body.ageMin : undefined,
      ageMax: body.audience === 'AGE_RANGE' ? body.ageMax : undefined,
      joinMode: body.joinMode,
      pendingChange: needsReview
        ? { ...reviewed, requestedBy: auth.userId, requestedAt: now }
        : changedReviewed
          ? undefined
          : circle.pendingChange,
      updatedAt: now,
    };
    const saved = await repo.saveCircle(updated);
    await audit(auth.societyId, auth.userId, needsReview ? 'CIRCLE_CHANGE_REQUESTED' : 'CIRCLE_EDITED', saved);
    if (needsReview) {
      await notifyCircle(
        repo,
        auth.societyId,
        await societyAdminIds(repo, auth.societyId),
        'A circle change is waiting for approval',
        `${circle.name}: new name, description or links to review.`,
        '/admin?tab=CIRCLES'
      );
    }
    return NextResponse.json({ success: true, pendingReview: needsReview, circle: circleView(saved, access) });
  } catch (err) {
    return serverError('circles PUT', err);
  }
}

// Approve or reject a circle or a change to it (society admins), or close it (owner or society admin)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, CircleActionSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const circle = await repo.getCircle(auth.societyId, body.circleId);
    if (!circle) return errorResponse('Circle not found', 404);
    const access = circleAccess(await repo.getCircleMember(auth.societyId, circle.id, auth.userId), auth.role);
    const now = new Date().toISOString();
    const link = `/circles/${circle.id}`;

    if (body.action === 'CLOSE') {
      if (!access.isOwner && !access.isSocietyAdmin) return errorResponse('Only the owner or a society admin can close a circle', 403);
      if (circle.status === 'CLOSED') return errorResponse('This circle is already closed', 409);
      const saved = await repo.saveCircle({ ...circle, status: 'CLOSED', closedAt: now, pendingChange: undefined, updatedAt: now });
      const members = (await repo.listCircleMembers(auth.societyId, circle.id)).filter((m) => m.status === 'APPROVED').map((m) => m.userId);
      await notifyCircle(
        repo,
        auth.societyId,
        members,
        `${circle.name} was closed`,
        'The circle is no longer listed in Club House.',
        '/circles/mine',
        auth.userId
      );
      await audit(auth.societyId, auth.userId, 'CIRCLE_CLOSED', saved);
      return NextResponse.json({ success: true });
    }

    if (!access.isSocietyAdmin) return errorResponse('Only society admins approve circles', 403);

    if (body.action === 'APPROVE' || body.action === 'REJECT') {
      if (circle.status !== 'PENDING_APPROVAL') return errorResponse('This circle is not waiting for approval', 409);
      const approve = body.action === 'APPROVE';
      const saved = await repo.saveCircle({
        ...circle,
        status: approve ? 'ACTIVE' : 'REJECTED',
        approvedAt: approve ? now : undefined,
        rejectionReason: approve ? undefined : body.reason || undefined,
        updatedAt: now,
      });
      await notifyCircle(
        repo,
        auth.societyId,
        [circle.createdByUserId],
        approve ? `${circle.name} is live` : `${circle.name} was not approved`,
        approve ? 'Residents can now find your circle and ask to join.' : body.reason || 'Your society admins did not approve this circle.',
        approve ? link : '/circles/mine'
      );
      await audit(
        auth.societyId,
        auth.userId,
        approve ? 'CIRCLE_APPROVED' : 'CIRCLE_REJECTED',
        saved,
        body.reason ? { reason: body.reason } : {}
      );
      return NextResponse.json({ success: true });
    }

    // APPROVE_CHANGE / REJECT_CHANGE
    const change = circle.pendingChange;
    if (!change) return errorResponse('There is no change waiting for this circle', 409);
    const approve = body.action === 'APPROVE_CHANGE';
    const saved = await repo.saveCircle({
      ...circle,
      ...(approve
        ? { name: change.name, description: change.description, whatsappLink: change.whatsappLink, otherLink: change.otherLink }
        : {}),
      pendingChange: undefined,
      updatedAt: now,
    });
    await notifyCircle(
      repo,
      auth.societyId,
      [change.requestedBy],
      approve ? `Your change to ${saved.name} is live` : `Your change to ${circle.name} was not approved`,
      approve ? 'Members now see the new details.' : body.reason || 'The circle keeps its earlier details.',
      link
    );
    await audit(
      auth.societyId,
      auth.userId,
      approve ? 'CIRCLE_CHANGE_APPROVED' : 'CIRCLE_CHANGE_REJECTED',
      saved,
      body.reason ? { reason: body.reason } : {}
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('circles PATCH', err);
  }
}
