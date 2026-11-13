import { ISocietyRepository } from '@/lib/db/repository.interface';
import { estimateRoute } from '@/lib/services/matching';
import { addDays, istDateString, istDateTime } from '@/lib/utils/time';
import { RideOccurrence, RideSchedule } from '@/types';

/** Repeating rides are created this many days ahead */
export const SCHEDULE_DAYS_AHEAD = 7;

/** Day of the week of an IST date: 1 = Monday … 7 = Sunday */
export function istWeekday(dateStr: string): number {
  const day = new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** What a ride is made from: a one-off offer or a repeating schedule */
export type RidePlan = Pick<
  RideOccurrence,
  | 'societyId'
  | 'offererUserId'
  | 'vehicleId'
  | 'direction'
  | 'originName'
  | 'originLat'
  | 'originLng'
  | 'meetingPoint'
  | 'destinationName'
  | 'destinationPlaceId'
  | 'destinationLat'
  | 'destinationLng'
  | 'totalSeats'
  | 'genderPreference'
  | 'visibility'
  | 'scheduleId'
>;

export function buildOccurrence(
  plan: RidePlan,
  journeyDate: string,
  departureWindowStart: string,
  departureWindowEnd: string,
  now: string = new Date().toISOString()
): RideOccurrence {
  const route = estimateRoute(
    { lat: plan.originLat, lng: plan.originLng },
    { lat: plan.destinationLat, lng: plan.destinationLng }
  );
  // Leave out optional fields that are not set (Firestore stores no undefined values)
  const optional = Object.fromEntries(
    (['meetingPoint', 'destinationPlaceId', 'scheduleId'] as const)
      .filter((key) => plan[key])
      .map((key) => [key, plan[key]])
  );
  return {
    id: `jrn-${crypto.randomUUID()}`,
    societyId: plan.societyId,
    offererUserId: plan.offererUserId,
    vehicleId: plan.vehicleId,
    journeyDate,
    direction: plan.direction,
    departureWindowStart,
    departureWindowEnd,
    originName: plan.originName,
    originLat: plan.originLat,
    originLng: plan.originLng,
    destinationName: plan.destinationName,
    destinationLat: plan.destinationLat,
    destinationLng: plan.destinationLng,
    ...optional,
    baselineDurationMinutes: route.durationMinutes,
    baselineDistanceKm: route.distanceKm,
    totalSeats: plan.totalSeats,
    availableSeats: plan.totalSeats,
    genderPreference: plan.genderPreference,
    visibility: plan.visibility,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
  };
}

/** The dates in the coming week on which this schedule should have a ride */
export function scheduleDates(schedule: RideSchedule, now: number): string[] {
  const today = istDateString(new Date(now));
  const dates: string[] = [];
  for (let i = 0; i < SCHEDULE_DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    if (!schedule.recurrenceDays.includes(istWeekday(date))) continue;
    if (Date.parse(istDateTime(date, schedule.departureWindowStart)) <= now) continue;
    dates.push(date);
  }
  return dates;
}

/**
 * Creates any missing rides for a schedule in the coming week. A date that
 * already has a ride from this schedule is left alone, including one the
 * offerer cancelled to skip that day.
 */
export async function fillSchedule(
  repo: ISocietyRepository,
  schedule: RideSchedule,
  now: number = Date.now()
): Promise<RideOccurrence[]> {
  if (!schedule.isActive) return [];
  const vehicle = await repo.getVehicleById(schedule.societyId, schedule.vehicleId);
  if (!vehicle) return [];

  const existingDates = new Set(
    (await repo.listUserRides(schedule.societyId, schedule.userId))
      .filter((r) => r.scheduleId === schedule.id)
      .map((r) => r.journeyDate)
  );
  const created: RideOccurrence[] = [];
  for (const date of scheduleDates(schedule, now)) {
    if (existingDates.has(date)) continue;
    const ride = buildOccurrence(
      {
        societyId: schedule.societyId,
        offererUserId: schedule.userId,
        vehicleId: schedule.vehicleId,
        direction: schedule.direction,
        originName: schedule.originName,
        originLat: schedule.originLat,
        originLng: schedule.originLng,
        meetingPoint: schedule.meetingPoint,
        destinationName: schedule.destinationName,
        destinationPlaceId: schedule.destinationPlaceId,
        destinationLat: schedule.destinationLat,
        destinationLng: schedule.destinationLng,
        totalSeats: Math.min(schedule.totalSeats, vehicle.capacity),
        genderPreference: schedule.genderPreference,
        visibility: schedule.visibility,
        scheduleId: schedule.id,
      },
      date,
      istDateTime(date, schedule.departureWindowStart),
      istDateTime(date, schedule.departureWindowEnd),
      new Date(now).toISOString()
    );
    created.push(await repo.createRideOccurrence(ride));
  }
  return created;
}

/** Topping up runs at most this often per society on each server instance */
const FILL_INTERVAL_MS = 10 * 60 * 1000;
const lastFilled = new Map<string, number>();

export function resetScheduleFill(): void {
  lastFilled.clear();
}

/** Keeps every repeating ride in the society filled a week ahead */
export async function fillSocietySchedules(
  repo: ISocietyRepository,
  societyId: string,
  now: number = Date.now()
): Promise<number> {
  const last = lastFilled.get(societyId);
  if (last !== undefined && now - last < FILL_INTERVAL_MS) return 0;
  lastFilled.set(societyId, now);

  let created = 0;
  for (const schedule of await repo.listActiveSchedules(societyId)) {
    created += (await fillSchedule(repo, schedule, now)).length;
  }
  return created;
}
