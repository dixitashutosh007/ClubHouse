import { describe, it, expect, beforeEach } from 'vitest';
import { completeBlocker, resetRideSettlement, settleStaleRides, settledStatus, startBlocker } from '../ride-lifecycle';
import { istWeekday, scheduleDates, fillSchedule, resetScheduleFill } from '../ride-schedules';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { RideOccurrence, RideSchedule } from '@/types';

const HOUR = 60 * 60 * 1000;
const ride = (over: Partial<RideOccurrence> = {}): RideOccurrence =>
  ({
    id: 'jrn-x',
    societyId: 'soc-ggh-001',
    offererUserId: 'usr-offerer-001',
    status: 'OPEN',
    totalSeats: 2,
    availableSeats: 2,
    departureWindowStart: '2026-11-20T08:00:00+05:30',
    departureWindowEnd: '2026-11-20T08:20:00+05:30',
    ...over,
  }) as RideOccurrence;
const at = (iso: string) => Date.parse(iso);

describe('ride lifecycle rules', () => {
  it('starts from 30 minutes before departure', () => {
    expect(startBlocker(ride(), at('2026-11-20T07:00:00+05:30'))).toMatch(/30 minutes/);
    expect(startBlocker(ride(), at('2026-11-20T07:35:00+05:30'))).toBeNull();
    expect(startBlocker(ride({ status: 'CANCELLED' }), at('2026-11-20T07:35:00+05:30'))).not.toBeNull();
  });

  it('completes a started ride, or a booked one after departure', () => {
    expect(completeBlocker(ride({ status: 'IN_PROGRESS' }), at('2026-11-20T07:50:00+05:30'))).toBeNull();
    expect(completeBlocker(ride(), at('2026-11-20T07:50:00+05:30'))).toMatch(/not left/);
    expect(completeBlocker(ride(), at('2026-11-20T08:05:00+05:30'))).toBeNull();
    expect(completeBlocker(ride({ status: 'EXPIRED' }), at('2026-11-20T09:00:00+05:30'))).not.toBeNull();
  });

  it('settles rides three hours after the departure window', () => {
    const end = at('2026-11-20T08:20:00+05:30');
    expect(settledStatus(ride(), false, end + 2 * HOUR)).toBeNull();
    expect(settledStatus(ride(), false, end + 4 * HOUR)).toBe('EXPIRED');
    expect(settledStatus(ride({ availableSeats: 1 }), true, end + 4 * HOUR)).toBe('COMPLETED');
    expect(settledStatus(ride({ status: 'IN_PROGRESS' }), false, end + 4 * HOUR)).toBe('COMPLETED');
    expect(settledStatus(ride({ status: 'CANCELLED' }), false, end + 4 * HOUR)).toBeNull();
  });
});

describe('settling and repeating in the repository', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = new MockDynamoRepository();
    resetRideSettlement();
    resetScheduleFill();
  });

  it('expires empty old rides and completes booked ones, once per interval', async () => {
    await repo.createRideOccurrence(ride({ id: 'jrn-empty', journeyDate: '2026-11-20' }));
    await repo.createRideOccurrence(ride({ id: 'jrn-booked', journeyDate: '2026-11-20', availableSeats: 1, status: 'PARTIALLY_BOOKED' }));
    const later = at('2026-11-20T12:00:00+05:30');

    expect(await settleStaleRides(repo, 'soc-ggh-001', later)).toBeGreaterThanOrEqual(2);
    expect((await repo.getRideOccurrence('soc-ggh-001', 'jrn-empty'))!.status).toBe('EXPIRED');
    expect((await repo.getRideOccurrence('soc-ggh-001', 'jrn-booked'))!.status).toBe('COMPLETED');
    expect(await settleStaleRides(repo, 'soc-ggh-001', later + 60_000)).toBe(0); // throttled
  });

  it('knows the weekday of an IST date', () => {
    expect(istWeekday('2026-11-16')).toBe(1); // Monday
    expect(istWeekday('2026-11-22')).toBe(7); // Sunday
  });

  const schedule: RideSchedule = {
    id: 'sch-1',
    societyId: 'soc-ggh-001',
    userId: 'usr-offerer-001',
    vehicleId: 'veh-001',
    direction: 'OUTBOUND_SOCIETY',
    originName: 'Mahaveer Ranches',
    originLat: 12.9,
    originLng: 77.6,
    destinationName: 'Manyata Tech Park',
    destinationLat: 13.04,
    destinationLng: 77.62,
    departureWindowStart: '08:30',
    departureWindowEnd: '08:45',
    recurrenceDays: [1, 3, 5],
    totalSeats: 2,
    genderPreference: 'ANY',
    visibility: 'SOCIETY_WIDE',
    isActive: true,
    createdAt: '2026-11-15T00:00:00Z',
  };

  it('lists the coming week of matching days, skipping a departure already passed', () => {
    // Monday 16 Nov, 9:00 IST: today's 8:30 has gone
    expect(scheduleDates(schedule, at('2026-11-16T09:00:00+05:30'))).toEqual(['2026-11-18', '2026-11-20']);
    expect(scheduleDates(schedule, at('2026-11-16T07:00:00+05:30'))).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
  });

  it('creates the week once and does not bring back a skipped day', async () => {
    await repo.createRideSchedule(schedule);
    const now = at('2026-11-16T07:00:00+05:30');
    const first = await fillSchedule(repo, schedule, now);
    expect(first.map((r) => r.journeyDate)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
    expect(first[0]).toMatchObject({ scheduleId: 'sch-1', departureWindowStart: '2026-11-16T08:30:00+05:30', status: 'OPEN' });

    // Skip Wednesday by cancelling it; filling again adds nothing
    await repo.cancelRideWithRequests('soc-ggh-001', first[1].id, 'usr-offerer-001', 'Working from home');
    expect(await fillSchedule(repo, schedule, now)).toEqual([]);

    // A stopped schedule creates nothing
    expect(await fillSchedule(repo, { ...schedule, isActive: false }, now)).toEqual([]);
  });
});
