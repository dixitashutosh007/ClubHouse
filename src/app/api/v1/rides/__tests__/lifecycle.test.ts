import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { resetRideSettlement } from '@/lib/services/ride-lifecycle';
import { resetScheduleFill } from '@/lib/services/ride-schedules';
import { POST, PATCH } from '../route';
import { GET as listSchedules, DELETE as stopSchedule } from '../schedules/route';

const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': 'soc-ggh-001' });
const OFFERER = 'usr-offerer-001';

describe('ride start / complete and repeating rides', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetRideSettlement();
    resetScheduleFill();
  });
  afterEach(() => vi.useRealTimers());

  const act = (userId: string, journeyId: string, action: 'START' | 'COMPLETE') =>
    PATCH(makeRequest('/api/v1/rides', { method: 'PATCH', body: { journeyId, action }, headers: as(userId) }));

  it('lets only the offerer start and complete, at the right time, and tells riders', async () => {
    const ride = (await repo.getRideOccurrence('soc-ggh-001', 'jrn-001'))!;
    // Someone has joined
    const now = new Date().toISOString();
    await repo.createRideRequest({
      id: 'req-t', societyId: 'soc-ggh-001', journeyId: ride.id, seekerUserId: 'usr-seeker-001', requestedSeats: 1,
      pickupName: 'Gate', pickupLat: 0, pickupLng: 0, dropoffName: 'Park', dropoffLat: 0, dropoffLng: 0,
      calculatedDetourMinutes: 0, status: 'REQUESTED', createdAt: now, updatedAt: now,
    });
    await repo.acceptRideRequest('soc-ggh-001', 'req-t', OFFERER);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse(ride.departureWindowStart) - 2 * 60 * 60 * 1000);
    expect((await act(OFFERER, ride.id, 'START')).status).toBe(409); // too early

    vi.setSystemTime(Date.parse(ride.departureWindowStart) - 10 * 60 * 1000);
    expect((await act('usr-seeker-001', ride.id, 'START')).status).toBe(403);
    const started = await act(OFFERER, ride.id, 'START');
    expect((await started.json()).ride.status).toBe('IN_PROGRESS');

    const done = await act(OFFERER, ride.id, 'COMPLETE');
    expect((await done.json()).ride.status).toBe('COMPLETED');
    expect((await act(OFFERER, ride.id, 'COMPLETE')).status).toBe(409);

    const notes = await repo.listUserNotifications('soc-ggh-001', 'usr-seeker-001');
    expect(notes.map((n) => n.type)).toEqual(expect.arrayContaining(['RIDE_STARTED', 'RIDE_COMPLETED']));
  });

  it('offers a ride on repeat and stops repeating it', async () => {
    const vehicle = (await repo.listUserVehicles('soc-ggh-001', OFFERER))[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const res = await POST(
      makeRequest('/api/v1/rides', {
        method: 'POST',
        headers: as(OFFERER),
        body: {
          vehicleId: vehicle.id,
          journeyDate: tomorrow,
          departureWindowStart: `${tomorrow}T08:30:00+05:30`,
          departureWindowEnd: `${tomorrow}T08:45:00+05:30`,
          destinationName: 'Manyata Tech Park',
          destinationLat: 13.04,
          destinationLng: 77.62,
          totalSeats: 2,
          repeatDays: [1, 2, 3, 4, 5, 6, 7],
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schedule).toMatchObject({ departureWindowStart: '08:30', recurrenceDays: [1, 2, 3, 4, 5, 6, 7] });
    expect(data.ridesCreated).toBeGreaterThanOrEqual(6);

    const mine = await (await listSchedules(makeRequest('/api/v1/rides/schedules', { headers: as(OFFERER) }))).json();
    expect(mine.schedules.map((s: { id: string }) => s.id)).toContain(data.schedule.id);

    const stop = (userId: string) =>
      stopSchedule(makeRequest(`/api/v1/rides/schedules?id=${data.schedule.id}`, { method: 'DELETE', headers: as(userId) }));
    expect((await stop('usr-seeker-001')).status).toBe(403);
    expect((await stop(OFFERER)).status).toBe(200);
    expect((await repo.getRideSchedule('soc-ggh-001', data.schedule.id))!.isActive).toBe(false);
  });
});

describe('ride matches for a work location saved by name only', () => {
  beforeEach(() => {
    resetRepository();
  });

  it('looks up a known place by name, and says when it cannot', async () => {
    const { POST: matches } = await import('../matches/route');
    const { BANGALORE_HUBS } = await import('@/lib/services/places-data');
    const ask = (dropoffName: string) =>
      matches(makeRequest('/api/v1/rides/matches', { method: 'POST', body: { dropoffName }, headers: as('usr-seeker-001') }));

    const known = await (await ask(BANGALORE_HUBS[0].primaryText)).json();
    expect(known.needsLocation).toBeUndefined();
    expect(Array.isArray(known.matches)).toBe(true);

    expect((await (await ask('My cousin’s house')).json()).needsLocation).toBe(true);
  });
});
