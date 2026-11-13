import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { SosSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/services/push';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Records that a resident pressed the emergency button (the phone call itself
 * goes straight from their phone) and alerts the society's admins with the
 * ride and how to reach them.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, SosSchema);
  if (body instanceof NextResponse) return body;

  // Repeated taps in a panic shouldn't flood admins
  const limit = await rateLimit(`sos:${auth.userId}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ success: true, alreadyAlerted: true });

  const repo = getRepository();
  const user = await repo.getUserById(auth.userId);
  const membership = await repo.getMembership(auth.societyId, auth.userId);

  // Only link a ride the resident is on (offering it, or accepted on it)
  let ride = body.journeyId ? await repo.getRideOccurrence(auth.societyId, body.journeyId) : null;
  if (ride && ride.offererUserId !== auth.userId) {
    const onRide = (await repo.listJourneyRequests(auth.societyId, ride.id)).some(
      (r) => r.seekerUserId === auth.userId && r.status === 'ACCEPTED'
    );
    if (!onRide) ride = null;
  }

  const now = new Date().toISOString();
  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'SOS_TRIGGERED',
    entityType: ride ? 'RIDE_OCCURRENCE' : 'MEMBERSHIP',
    entityId: ride?.id ?? auth.userId,
    metadata: ride ? { journeyId: ride.id, destinationName: ride.destinationName } : {},
    createdAt: now,
  });

  const admins = (await repo.listSocietyMembers(auth.societyId)).filter(
    (m) => (m.role === 'SOCIETY_ADMIN' || m.role === 'SUPER_ADMIN') && m.status === 'ACTIVE' && m.userId !== auth.userId
  );
  const who = `${user?.fullName ?? 'A resident'}${membership?.flatNumber ? ` (${membership.flatNumber})` : ''}`;
  for (const admin of admins) {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: admin.userId,
      title: 'Emergency alert',
      body:
        `${who} pressed the emergency button${ride ? ` on a ride to ${ride.destinationName}` : ''}.` +
        (user?.mobile ? ` Call them on ${user.mobile}.` : ''),
      type: 'SOS_ALERT',
      link: '/admin?tab=ACTIVITY_LOGS',
      read: false,
      createdAt: now,
    });
  }

  return NextResponse.json({ success: true, adminsAlerted: admins.length });
}
