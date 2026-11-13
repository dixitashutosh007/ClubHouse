import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse, hasAdminPermission } from '@/lib/api-auth';
import { Feedback } from '@/types';
import { FeedbackQuerySchema, FeedbackSchema } from '@/lib/validation/schemas';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { BOOKABLE_STATUSES } from '@/lib/services/ride-lifecycle';

// Leave feedback for the other participant of a shared ride
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, FeedbackSchema);
  if (body instanceof NextResponse) return body;
  const { journeyId, toUserId, outcome, qualitativeTags, privateNote } = body;

  if (toUserId === auth.userId) return errorResponse('You cannot leave feedback for yourself');

  const repo = getRepository();
  const journey = await repo.getRideOccurrence(auth.societyId, journeyId);
  if (!journey) return errorResponse('Journey not found', 404);

  // Only the offerer and accepted seekers took part, and they can only rate each other
  const acceptedSeekers = (await repo.listJourneyRequests(auth.societyId, journeyId))
    .filter((r) => r.status === 'ACCEPTED')
    .map((r) => r.seekerUserId);

  const isOfferer = journey.offererUserId === auth.userId;
  const isParticipantPair = isOfferer
    ? acceptedSeekers.includes(toUserId)
    : acceptedSeekers.includes(auth.userId) && toUserId === journey.offererUserId;
  if (!isParticipantPair) {
    return errorResponse('Feedback is only possible between participants of this ride', 403);
  }
  // Rate a ride once it has happened (or was meant to), not before
  if (BOOKABLE_STATUSES.includes(journey.status) && Date.parse(journey.departureWindowStart) > Date.now()) {
    return errorResponse('You can rate this ride once it has left', 409);
  }

  const alreadyGiven = (await repo.listUserFeedbackReceived(auth.societyId, toUserId)).some(
    (f) => f.journeyId === journeyId && f.fromUserId === auth.userId
  );
  if (alreadyGiven) return errorResponse('Feedback already submitted for this ride', 409);

  const feedback: Feedback = {
    id: `fb-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    journeyId,
    fromUserId: auth.userId,
    toUserId,
    role: isOfferer ? 'OFFERER' : 'SEEKER',
    outcome,
    qualitativeTags,
    privateNote,
    createdAt: new Date().toISOString(),
  };

  const saved = await repo.createFeedback(feedback);

  return NextResponse.json({ success: true, feedback: saved });
}

// GET qualitative feedback badges received by a user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, FeedbackQuerySchema);
  if (query instanceof NextResponse) return query;

  // Residents see only their own feedback; moderators may look up any member
  const isModerator = hasAdminPermission(auth, 'canModerateReports');
  const targetUserId = query.userId ?? auth.userId;
  if (targetUserId !== auth.userId && !isModerator) {
    return errorResponse('Forbidden', 403);
  }

  const repo = getRepository();
  const feedbackList = await repo.listUserFeedbackReceived(auth.societyId, targetUserId);

  // Aggregate qualitative tags
  const tagCounts: Record<string, number> = {};
  for (const fb of feedbackList) {
    for (const tag of fb.qualitativeTags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Private notes and who left each rating are for moderators only
  const visibleFeedback = isModerator
    ? feedbackList
    : feedbackList.map((f) => ({
        id: f.id,
        journeyId: f.journeyId,
        role: f.role,
        outcome: f.outcome,
        qualitativeTags: f.qualitativeTags,
        createdAt: f.createdAt,
      }));

  return NextResponse.json({
    feedback: visibleFeedback,
    totalCommutesCompleted: feedbackList.filter((f) => f.outcome === 'COMPLETED').length,
    tagBadges: Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
  });
}
