import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, serverError } from '@/lib/api-auth';
import { MESSAGE_HISTORY_DAYS } from '@/lib/validation/circle-message';

/** Counts stop here and show as "99+" */
const CAP = 99;

// Unread message counts for each live circle the resident belongs to
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const repo = getRepository();
    const start = new Date(Date.now() - MESSAGE_HISTORY_DAYS * 86_400_000).toISOString();
    const memberships = (await repo.listUserCircleMemberships(auth.societyId, auth.userId)).filter((m) => m.status === 'APPROVED');
    const unread: Record<string, number> = {};
    await Promise.all(
      memberships.map(async (m) => {
        const circle = await repo.getCircle(auth.societyId, m.circleId);
        if (circle?.status !== 'ACTIVE') return;
        // Before they first open the messages, count from when they joined
        const seen = m.lastReadAt ?? m.approvedAt ?? m.requestedAt;
        const n = await repo.countCircleMessagesAfter(auth.societyId, m.circleId, seen > start ? seen : start, CAP);
        if (n > 0) unread[m.circleId] = n;
      })
    );
    return NextResponse.json({ unread, total: Object.values(unread).reduce((a, b) => a + b, 0) });
  } catch (err) {
    return serverError('circle unread GET', err);
  }
}
