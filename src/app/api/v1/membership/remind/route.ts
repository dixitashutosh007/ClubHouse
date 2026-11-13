import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { notify } from '@/lib/services/push';

// A resident waiting for approval nudges the admins who approve residents (once every 12 hours)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ['PENDING_APPROVAL', 'REGISTERED'] });
  if (auth instanceof NextResponse) return auth;

  const limit = await rateLimit(`approval-reminder:${auth.societyId}:${auth.userId}`, 1, 12 * 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ success: true, alreadyReminded: true });

  const repo = getRepository();
  const [user, membership, members] = await Promise.all([
    repo.getUserById(auth.userId),
    repo.getMembership(auth.societyId, auth.userId),
    repo.listSocietyMembers(auth.societyId),
  ]);
  const approvers = members.filter(
    (m) =>
      m.status === 'ACTIVE' &&
      (m.role === 'SUPER_ADMIN' || (m.role === 'SOCIETY_ADMIN' && m.permissions?.canApproveResidents !== false))
  );
  const now = new Date().toISOString();
  for (const admin of approvers) {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: admin.userId,
      title: 'A resident is waiting for approval',
      body: `${user?.fullName ?? 'A resident'}${membership?.flatNumber ? ` (flat ${membership.flatNumber})` : ''} asked you to review their registration.`,
      type: 'GENERAL',
      link: '/admin?tab=MEMBERS',
      read: false,
      createdAt: now,
    });
  }
  return NextResponse.json({ success: true, adminsReminded: approvers.length });
}
