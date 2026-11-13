import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ADMIN_ROLES, requireAuth } from '@/lib/api-auth';
import { addDays, istDateString } from '@/lib/utils/time';

/** Key numbers for the admin menu: residents, rides, classes and what needs attention */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ADMIN_ROLES });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const today = istDateString();
  const [members, rides, reports, suggestions, pendingClasses, liveClasses] = await Promise.all([
    repo.listSocietyMembers(auth.societyId),
    repo.listSocietyRidesSince(auth.societyId, addDays(today, -30)),
    repo.listModerationReports(auth.societyId),
    repo.listSuggestions(auth.societyId),
    repo.listPendingClasses(auth.societyId),
    repo.listActiveClasses(auth.societyId),
  ]);

  const weekAhead = addDays(today, 7);
  const upcoming = rides.filter(
    (r) => r.journeyDate >= today && r.journeyDate <= weekAhead && ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'].includes(r.status)
  );
  const completed30 = rides.filter((r) => r.status === 'COMPLETED' && r.journeyDate < today);
  const seatsShared30 = completed30.reduce((sum, r) => sum + (r.totalSeats - r.availableSeats), 0);

  return NextResponse.json({
    residents: {
      active: members.filter((m) => m.status === 'ACTIVE').length,
      waiting: members.filter((m) => m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED').length,
    },
    rides: {
      upcomingWeek: upcoming.length,
      completedLast30Days: completed30.length,
      seatsSharedLast30Days: seatsShared30,
    },
    classes: { live: liveClasses.length, waiting: pendingClasses.length },
    attention: {
      openReports: reports.filter((r) => r.status === 'OPEN' || r.status === 'INVESTIGATING').length,
      openSuggestions: suggestions.filter((s) => s.status === 'OPEN').length,
    },
  });
}
