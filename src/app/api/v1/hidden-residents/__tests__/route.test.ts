import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { resetRideSettlement } from '@/lib/services/ride-lifecycle';
import { resetScheduleFill } from '@/lib/services/ride-schedules';
import { GET, POST, DELETE } from '../route';
import { GET as listRides } from '../../rides/route';
import { POST as requestSeat, PATCH as endTrip } from '../../rides/requests/route';
import { POST as findMatches } from '../../rides/matches/route';

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });
const OFFERER = 'usr-offerer-001';
const SEEKER = 'usr-seeker-001';

const hide = (userId: string, target: string) =>
  POST(makeRequest('/api/v1/hidden-residents', { method: 'POST', body: { userId: target }, headers: as(userId) }));
const unhide = (userId: string, target: string) =>
  DELETE(makeRequest('/api/v1/hidden-residents', { method: 'DELETE', body: { userId: target }, headers: as(userId) }));
const rideIds = async (userId: string) =>
  ((await (await listRides(makeRequest('/api/v1/rides', { headers: as(userId) }))).json()).rides as { id: string }[]).map(
    (r) => r.id
  );

describe('hiding a resident', () => {
  beforeEach(() => {
    resetRepository();
    resetRideSettlement();
    resetScheduleFill();
  });

  it('hides rides both ways, blocks requests, and can be undone', async () => {
    expect(await rideIds(SEEKER)).toContain('jrn-001');
    expect((await hide(SEEKER, SEEKER)).status).toBe(400);
    expect((await hide(SEEKER, 'usr-nobody')).status).toBe(404);

    // The offerer hides the seeker: the seeker no longer sees their rides
    expect((await hide(OFFERER, SEEKER)).status).toBe(200);
    expect(await rideIds(SEEKER)).not.toContain('jrn-001');
    const seat = await requestSeat(
      makeRequest('/api/v1/rides/requests', { method: 'POST', body: { journeyId: 'jrn-001' }, headers: as(SEEKER) })
    );
    expect(seat.status).toBe(404);
    const matches = await (
      await findMatches(
        makeRequest('/api/v1/rides/matches', {
          method: 'POST',
          body: { dropoffName: 'Manyata', dropoffLat: 13.04, dropoffLng: 77.62 },
          headers: as(SEEKER),
        })
      )
    ).json();
    for (const m of matches.matches ?? []) expect(m.journey.offererUserId).not.toBe(OFFERER);

    const list = await (await GET(makeRequest('/api/v1/hidden-residents', { headers: as(OFFERER) }))).json();
    expect(list.hidden.map((h: { userId: string }) => h.userId)).toEqual([SEEKER]);
    // The seeker's own list is empty: nobody is told they were hidden
    expect((await (await GET(makeRequest('/api/v1/hidden-residents', { headers: as(SEEKER) }))).json()).hidden).toEqual([]);

    await unhide(OFFERER, SEEKER);
    expect(await rideIds(SEEKER)).toContain('jrn-001');
  });
});

describe('riders ending their trip', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
    resetRideSettlement();
    resetScheduleFill();
  });
  afterEach(() => vi.useRealTimers());

  const end = (userId: string, requestId: string) =>
    endTrip(makeRequest('/api/v1/rides/requests', { method: 'PATCH', body: { requestId, action: 'END_TRIP' }, headers: as(userId) }));

  it('only the rider, only once the ride has left', async () => {
    const ride = (await repo.getRideOccurrence(SOCIETY, 'jrn-001'))!;
    const now = new Date().toISOString();
    await repo.createRideRequest({
      id: 'req-e', societyId: SOCIETY, journeyId: ride.id, seekerUserId: SEEKER, requestedSeats: 1,
      pickupName: 'Gate', pickupLat: 0, pickupLng: 0, dropoffName: 'Park', dropoffLat: 0, dropoffLng: 0,
      calculatedDetourMinutes: 0, status: 'REQUESTED', createdAt: now, updatedAt: now,
    });
    expect((await end(SEEKER, 'req-e')).status).toBe(409); // not accepted yet
    await repo.acceptRideRequest(SOCIETY, 'req-e', OFFERER);
    expect((await end(SEEKER, 'req-e')).status).toBe(409); // not left yet

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse(ride.departureWindowStart) + 20 * 60 * 1000);
    expect((await end(OFFERER, 'req-e')).status).toBe(403);
    const res = await end(SEEKER, 'req-e');
    expect(res.status).toBe(200);
    expect((await res.json()).request.riderEndedAt).toBeTruthy();
    expect((await repo.getRideRequest(SOCIETY, 'req-e'))!.status).toBe('ACCEPTED');
  });
});
