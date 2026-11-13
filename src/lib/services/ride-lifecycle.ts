import { ISocietyRepository } from '@/lib/db/repository.interface';
import { JourneyStatus, RideOccurrence } from '@/types';

/**
 * How a ride moves from offered to finished:
 *
 *   OPEN / PARTIALLY_BOOKED / FULL --start--> IN_PROGRESS --complete--> COMPLETED
 *
 * The offerer starts and completes rides. Rides nobody finishes are settled
 * automatically a few hours after the departure window: COMPLETED if someone
 * had joined, EXPIRED otherwise. Ratings are given on completed rides.
 */

export const BOOKABLE_STATUSES: JourneyStatus[] = ['OPEN', 'PARTIALLY_BOOKED', 'FULL'];
export const UNFINISHED_STATUSES: JourneyStatus[] = [...BOOKABLE_STATUSES, 'IN_PROGRESS'];

/** A ride can be started this long before its departure window opens */
export const START_EARLY_MS = 30 * 60 * 1000;
/** Rides still unfinished this long after the departure window are settled automatically */
export const SETTLE_AFTER_MS = 3 * 60 * 60 * 1000;

/** Why the offerer cannot start the ride now, or null if they can */
export function startBlocker(ride: RideOccurrence, now: number): string | null {
  if (!BOOKABLE_STATUSES.includes(ride.status)) return 'This ride cannot be started';
  if (now < Date.parse(ride.departureWindowStart) - START_EARLY_MS) {
    return 'You can start the ride from 30 minutes before it leaves';
  }
  return null;
}

/** Why the offerer cannot mark the ride complete now, or null if they can */
export function completeBlocker(ride: RideOccurrence, now: number): string | null {
  if (ride.status === 'IN_PROGRESS') return null;
  if (!BOOKABLE_STATUSES.includes(ride.status)) return 'This ride cannot be completed';
  if (now < Date.parse(ride.departureWindowStart)) return 'The ride has not left yet';
  return null;
}

/** What an unfinished ride becomes once it is well past its departure window, or null */
export function settledStatus(ride: RideOccurrence, hasRiders: boolean, now: number): JourneyStatus | null {
  if (!UNFINISHED_STATUSES.includes(ride.status)) return null;
  if (now < Date.parse(ride.departureWindowEnd) + SETTLE_AFTER_MS) return null;
  return hasRiders || ride.status === 'IN_PROGRESS' ? 'COMPLETED' : 'EXPIRED';
}

/** Settling runs at most this often per society on each server instance */
const SETTLE_INTERVAL_MS = 10 * 60 * 1000;
const lastSettled = new Map<string, number>();

/** Test hook */
export function resetRideSettlement(): void {
  lastSettled.clear();
}

/**
 * Finishes rides whose time has long passed, so old rides stop showing as
 * open. Cheap to call on every ride listing: it runs at most every 10
 * minutes per society and only writes rides that change.
 */
export async function settleStaleRides(
  repo: ISocietyRepository,
  societyId: string,
  now: number = Date.now()
): Promise<number> {
  const last = lastSettled.get(societyId);
  if (last !== undefined && now - last < SETTLE_INTERVAL_MS) return 0;
  lastSettled.set(societyId, now);

  let settled = 0;
  for (const ride of await repo.listActiveRides(societyId)) {
    if (now < Date.parse(ride.departureWindowEnd) + SETTLE_AFTER_MS) continue;
    const hasRiders = ride.availableSeats < ride.totalSeats;
    const status = settledStatus(ride, hasRiders, now);
    if (!status) continue;
    await repo.updateRideOccurrence(societyId, ride.id, ride.offererUserId, { status });
    settled++;
  }
  return settled;
}
