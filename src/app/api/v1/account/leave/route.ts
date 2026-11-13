import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ONBOARDING_STATUSES, errorResponse, requireAuth } from '@/lib/api-auth';
import { leaveSociety } from '@/lib/services/account';

// Leave the current society (e.g. moving out). Open rides, requests and classes are stopped.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: [...ONBOARDING_STATUSES, 'SUSPENDED'] });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  // The last admin can't leave without someone to approve residents
  if (auth.role === 'SOCIETY_ADMIN') {
    const admins = (await repo.listSocietyMembers(auth.societyId)).filter(
      (m) => m.role === 'SOCIETY_ADMIN' && m.status === 'ACTIVE' && m.userId !== auth.userId
    );
    if (admins.length === 0) {
      return errorResponse('You are the only society admin. Make another resident an admin before you leave.', 409);
    }
  }

  const result = await leaveSociety(repo, auth.societyId, auth.userId, { actorUserId: auth.userId, reason: 'MOVED_OUT' });
  return NextResponse.json({ success: true, ...result });
}
