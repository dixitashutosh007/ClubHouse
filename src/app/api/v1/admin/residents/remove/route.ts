import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { RemoveResidentsSchema } from '@/lib/validation/schemas';
import { leaveSociety } from '@/lib/services/account';

// Remove residents who have left the society (moved out). Their open rides,
// requests and classes are stopped; they can rejoin later with a new request.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canApproveResidents' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, RemoveResidentsSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const ids = [...new Set(body.targetUserIds)];
  if (ids.includes(auth.userId)) return errorResponse('To leave yourself, use Profile → Your data → Leave this society');

  const removed: string[] = [];
  const skipped: string[] = [];
  for (const userId of ids) {
    const membership = await repo.getMembership(auth.societyId, userId);
    // Admins are removed only by an app admin (demote them first otherwise)
    const protectedAdmin = membership?.role !== 'RESIDENT' && auth.role !== 'SUPER_ADMIN';
    if (!membership || membership.status === 'DEACTIVATED' || protectedAdmin) {
      skipped.push(userId);
      continue;
    }
    await leaveSociety(repo, auth.societyId, userId, { actorUserId: auth.userId, reason: 'REMOVED_BY_ADMIN' });
    removed.push(userId);
  }

  return NextResponse.json({ success: true, removed, skipped });
}
