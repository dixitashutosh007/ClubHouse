import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ADMIN_ROLES, requireAuth } from '@/lib/api-auth';
import { parseQuery } from '@/lib/validation/parse';
import { AdminListingsQuerySchema } from '@/lib/validation/schemas';
import { addDays, istDateString } from '@/lib/utils/time';

const UPCOMING = ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'];

/**
 * What's on offer in the society, for admins to keep an eye on: rides in the
 * coming week, or live classes. Only names and routes; no contact details.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ADMIN_ROLES });
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, AdminListingsQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  const members = await repo.listSocietyMembers(auth.societyId);
  const nameOf = new Map(members.map((m) => [m.userId, m.user.fullName]));

  if (query.kind === 'classes') {
    const classes = await repo.listActiveClasses(auth.societyId);
    return NextResponse.json({
      classes: classes.map((c) => ({
        id: c.id,
        subject: c.subject,
        classType: c.classType,
        teacher: nameOf.get(c.createdByUserId) ?? c.creatorName ?? 'Resident',
        feeType: c.feeType,
        feeAmount: c.feeAmount,
        scheduleDays: c.scheduleDays,
        classDate: c.classDate,
        startTime: c.startTime,
        durationMinutes: c.durationMinutes,
        location: c.locationDetail,
        locationType: c.locationType,
      })),
    });
  }

  const today = istDateString();
  const weekAhead = addDays(today, 7);
  const rides = (await repo.listSocietyRidesSince(auth.societyId, today))
    .filter((r) => r.journeyDate <= weekAhead && UPCOMING.includes(r.status))
    .sort((a, b) => a.departureWindowStart.localeCompare(b.departureWindowStart));
  return NextResponse.json({
    rides: rides.map((r) => ({
      id: r.id,
      departure: r.departureWindowStart,
      from: r.originName,
      to: r.destinationName,
      offerer: nameOf.get(r.offererUserId) ?? 'Resident',
      seatsTaken: r.totalSeats - r.availableSeats,
      totalSeats: r.totalSeats,
      status: r.status,
    })),
  });
}
