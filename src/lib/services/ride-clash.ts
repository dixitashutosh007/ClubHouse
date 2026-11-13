import { NextResponse } from 'next/server';
import { ISocietyRepository } from '@/lib/db/repository.interface';
import { RideOccurrence } from '@/types';
import { UNFINISHED_STATUSES } from '@/lib/services/ride-lifecycle';
import { formatIstTime } from '@/lib/utils/time';

/** When a ride's duration is unknown, assume the trip takes this long */
const DEFAULT_TRIP_MINUTES = 45;

/** From the start of the departure window until the car is expected to arrive */
function busyUntil(ride: Pick<RideOccurrence, 'departureWindowEnd' | 'baselineDurationMinutes'>): number {
  return Date.parse(ride.departureWindowEnd) + (ride.baselineDurationMinutes || DEFAULT_TRIP_MINUTES) * 60_000;
}

/**
 * Another ride the resident is already on (offering, joined or asked to
 * join) that overlaps this one, described for a warning, or null.
 */
export async function findRideClash(
  repo: ISocietyRepository,
  societyId: string,
  userId: string,
  ride: Pick<RideOccurrence, 'departureWindowStart' | 'departureWindowEnd' | 'baselineDurationMinutes'> & { id?: string }
): Promise<string | null> {
  const start = Date.parse(ride.departureWindowStart);
  const end = busyUntil(ride);
  const overlaps = (other: RideOccurrence) =>
    other.id !== ride.id &&
    UNFINISHED_STATUSES.includes(other.status) &&
    Date.parse(other.departureWindowStart) < end &&
    start < busyUntil(other);

  const offered = (await repo.listUserRides(societyId, userId)).find(overlaps);
  if (offered) {
    return `You are already offering a ride at ${formatIstTime(offered.departureWindowStart)} to ${offered.destinationName}.`;
  }
  for (const request of await repo.listUserRequests(societyId, userId)) {
    if ((request.status !== 'ACCEPTED' && request.status !== 'REQUESTED') || request.riderEndedAt) continue;
    const joined = await repo.getRideOccurrence(societyId, request.journeyId);
    if (joined && overlaps(joined)) {
      const verb = request.status === 'ACCEPTED' ? 'are riding' : 'have asked to ride';
      return `You ${verb} at ${formatIstTime(joined.departureWindowStart)} to ${joined.destinationName}.`;
    }
  }
  return null;
}

/** 409 the app answers with "Continue anyway?"; resending with allowClash goes ahead */
export function clashResponse(message: string) {
  return NextResponse.json({ error: `${message} Continue anyway?`, code: 'TIME_CLASH' }, { status: 409 });
}
