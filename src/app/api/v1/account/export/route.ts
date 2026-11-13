import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, getSessionUser } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

// Download everything Club House holds about the signed-in resident (DPDP Act right of access)
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse('Unauthorized', 401);

  const limit = await rateLimit(`export:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) return errorResponse('Too many downloads. Please try again later.', 429);

  const repo = getRepository();
  const userId = session.user.id;
  const memberships = await repo.listUserMemberships(userId);

  const societies = await Promise.all(
    memberships.map(async (m) => {
      const society = await repo.getSocietyById(m.societyId);
      const [vehicles, ridesOffered, rideRequests, repeatingRides, classes, notifications, ratingsReceived, reports, suggestions] =
        await Promise.all([
          repo.listUserVehicles(m.societyId, userId, true),
          repo.listUserRides(m.societyId, userId),
          repo.listUserRequests(m.societyId, userId),
          repo.listUserSchedules(m.societyId, userId),
          repo.listUserClasses(m.societyId, userId),
          repo.listUserNotifications(m.societyId, userId),
          repo.listUserFeedbackReceived(m.societyId, userId),
          repo.listModerationReports(m.societyId),
          repo.listSuggestions(m.societyId),
        ]);
      return {
        society: society ? { id: society.id, name: society.name, address: society.address } : { id: m.societyId },
        membership: m,
        vehicles,
        ridesOffered,
        rideRequests,
        repeatingRides,
        classes,
        notifications,
        // Ratings others gave you, without their private notes or who gave them
        ratingsReceived: ratingsReceived.map((f) => ({
          journeyId: f.journeyId,
          role: f.role,
          outcome: f.outcome,
          qualitativeTags: f.qualitativeTags,
          createdAt: f.createdAt,
        })),
        reportsYouMade: reports.filter((r) => r.reporterId === userId),
        suggestionsYouSent: suggestions.filter((s) => s.userId === userId),
      };
    })
  );

  const pushDevices = (await repo.listPushDevices(userId)).map(({ id, createdAt, lastSeenAt }) => ({ id, createdAt, lastSeenAt }));
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), profile: session.user, pushDevices, societies }, null, 2);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="club-house-my-data.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
