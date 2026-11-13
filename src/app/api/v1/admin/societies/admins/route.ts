import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { AddSocietyAdminSchema, RevokeSocietyAdminSchema } from '@/lib/validation/schemas';
import { mobileKey } from '@/lib/services/society-onboarding';

/**
 * Make someone a society admin by mobile number. A member of the society
 * becomes admin now; anyone else becomes admin when they sign in with that
 * number (the SMS code verifies it).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, AddSocietyAdminSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const society = await repo.getSocietyById(body.societyId);
  if (!society || society.status !== 'ACTIVE') return errorResponse('Only a live society can get more admins', 409);

  const audit = (action: string, metadata: Record<string, unknown>) =>
    repo.recordAuditEvent({
      id: `audit-${crypto.randomUUID()}`,
      societyId: society.id,
      actorUserId: auth.userId,
      action,
      entityType: 'SOCIETY',
      entityId: society.id,
      metadata,
      createdAt: new Date().toISOString(),
    });

  const user = await repo.getUserByPhone(body.mobile);
  const membership = user ? await repo.getMembership(society.id, user.id) : null;
  if (user && membership && membership.status !== 'DEACTIVATED' && membership.status !== 'REJECTED') {
    await repo.updateMembership(society.id, user.id, {
      role: 'SOCIETY_ADMIN',
      status: 'ACTIVE',
      approvedAt: membership.approvedAt ?? new Date().toISOString(),
    });
    await audit('SOCIETY_ADMIN_ADDED', { targetUserId: user.id });
    return NextResponse.json({ success: true, added: { userId: user.id, name: user.fullName } });
  }

  const invites = society.adminInvites ?? [];
  if (!invites.some((m) => mobileKey(m) === mobileKey(body.mobile))) {
    await repo.updateSociety(society.id, { adminInvites: [...invites, body.mobile] });
  }
  await audit('SOCIETY_ADMIN_INVITED', { mobile: body.mobile });
  return NextResponse.json({ success: true, invited: body.mobile });
}

// Stop someone being a society admin (they stay a resident), or withdraw an invitation
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, RevokeSocietyAdminSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const society = await repo.getSocietyById(body.societyId);
  if (!society) return errorResponse('Society not found', 404);

  if (body.mobile) {
    await repo.updateSociety(society.id, {
      adminInvites: (society.adminInvites ?? []).filter((m) => mobileKey(m) !== mobileKey(body.mobile)),
    });
    return NextResponse.json({ success: true });
  }

  const membership = await repo.getMembership(society.id, body.userId!);
  if (!membership || membership.role !== 'SOCIETY_ADMIN') return errorResponse('Not a society admin', 404);
  const otherAdmins = (await repo.listSocietyMembers(society.id)).filter(
    (m) => m.role === 'SOCIETY_ADMIN' && m.status === 'ACTIVE' && m.userId !== body.userId
  );
  if (otherAdmins.length === 0) {
    return errorResponse('A society needs at least one admin. Add another admin first.', 409);
  }

  await repo.updateMembership(society.id, body.userId!, { role: 'RESIDENT', permissions: undefined });
  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: society.id,
    actorUserId: auth.userId,
    action: 'SOCIETY_ADMIN_REVOKED',
    entityType: 'SOCIETY',
    entityId: society.id,
    metadata: { targetUserId: body.userId },
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
