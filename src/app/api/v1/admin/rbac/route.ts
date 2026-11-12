import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { UpdateRbacSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';
import { SocietyMembership } from '@/types';

// App Admin endpoint to view and update RBAC roles and granular permissions
export async function PUT(req: NextRequest) {
  // App Admin (SUPER_ADMIN) is required to manage RBAC
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateRbacSchema);
  if (body instanceof NextResponse) return body;
  const { targetUserId, targetSocietyId, role, permissions } = body;

  if (targetUserId === auth.userId) {
    return errorResponse('You cannot change your own role', 403);
  }

  const societyId = targetSocietyId || auth.societyId;
  const repo = getRepository();

  if (!(await repo.getSocietyById(societyId))) return errorResponse('Society not found', 404);

  const target = await repo.getMembership(societyId, targetUserId);
  if (!target) return errorResponse('Member not found in this society', 404);
  if (target.role === 'SUPER_ADMIN') {
    return errorResponse('Platform admins cannot be changed here', 403);
  }

  const updates: Partial<SocietyMembership> = { role };
  if (role === 'SOCIETY_ADMIN' && permissions) {
    updates.permissions = {
      canApproveResidents: Boolean(permissions.canApproveResidents),
      canManageSettings: Boolean(permissions.canManageSettings),
      canModerateReports: Boolean(permissions.canModerateReports),
      canViewAuditLogs: Boolean(permissions.canViewAuditLogs),
      canApproveClasses: Boolean(permissions.canApproveClasses),
    };
  }

  const updated = await repo.updateMembership(societyId, targetUserId, updates);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId,
    actorUserId: auth.userId,
    action: 'RBAC_ROLE_PERMISSIONS_UPDATED',
    entityType: 'MEMBERSHIP',
    entityId: updated.id,
    metadata: { targetUserId, role, permissions: updates.permissions },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, membership: updated });
}
