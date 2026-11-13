import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { addDays, formatIstTime, istDateString, istDateTime } from '@/lib/utils/time';
import * as rides from '../rides/route';
import * as requests from '../rides/requests/route';
import * as matches from '../rides/matches/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOCIETY = 'soc-ggh-001';
const OFFERER = 'usr-offerer-001'; // male, owns veh-001, offers jrn-001 (tomorrow, 2 seats)
const SEEKER = 'usr-seeker-001'; // female
const SEEKER_2 = 'usr-offerer-002'; // male resident
const SEEKER_3 = 'usr-offerer-003'; // female resident

type Handler = (req: NextRequest) => Promise<Response>;

function as(userId: string, handler: Handler, path: string, options: { method?: string; body?: unknown } = {}) {
  return handler(
    makeRequest(path, { ...options, headers: { 'x-dev-user-id': userId, 'x-society-id': SOCIETY } })
  );
}

let repo: MockDynamoRepository;

beforeEach(() => {
  repo = resetRepository();
  resetRateLimits();
});

async function requestSeat(userId: string, journeyId = 'jrn-001', requestedSeats = 1) {
  const res = await as(userId, requests.POST, '/api/v1/rides/requests', {
    method: 'POST',
    // These tests are about booking, not overlapping rides (see the clash tests)
    body: { journeyId, requestedSeats, allowClash: true },
  });
  return { res, request: res.ok ? (await res.json()).request : null };
}

function respond(requestId: string, action: 'ACCEPT' | 'REJECT', userId = OFFERER) {
  return as(userId, requests.PUT, '/api/v1/rides/requests', {
    method: 'PUT',
    body: { requestId, action },
  });
}

const tomorrow = () => addDays(istDateString(), 1);

function offerRide(overrides: Record<string, unknown> = {}, userId = OFFERER) {
  const date = tomorrow();
  return as(userId, rides.POST, '/api/v1/rides', {
    method: 'POST',
    body: {
      vehicleId: 'veh-001',
      journeyDate: date,
      departureWindowStart: istDateTime(date, '08:30'),
      departureWindowEnd: istDateTime(date, '08:45'),
      destinationName: 'Manyata Tech Park',
      destinationLat: 13.0453,
      destinationLng: 77.6206,
      totalSeats: 2,
      allowClash: true,
      ...overrides,
    },
  });
}

describe('3.1 times are India time', () => {
  it('shows a ride entered for 08:30 at 08:30', async () => {
    const res = await offerRide();
    expect(res.status).toBe(200);
    const { ride } = await res.json();
    expect(ride.departureWindowStart).toBe(`${tomorrow()}T08:30:00+05:30`);
    expect(formatIstTime(ride.departureWindowStart).toLowerCase()).toBe('08:30 am');
  });

  it.each([
    ['a departure time in the past', { journeyDate: istDateString(), departureWindowStart: '2020-01-01T08:00:00+05:30', departureWindowEnd: undefined }],
    ['times on a different date', { departureWindowStart: istDateTime(addDays(tomorrow(), 1), '08:30'), departureWindowEnd: undefined }],
    ['an end before the start', { departureWindowEnd: istDateTime(tomorrow(), '08:00') }],
    ['an end equal to the start', { departureWindowEnd: istDateTime(tomorrow(), '08:30') }],
    ['a date too far ahead', { journeyDate: addDays(istDateString(), 30), departureWindowStart: istDateTime(addDays(istDateString(), 30), '08:30'), departureWindowEnd: undefined }],
    ['more seats than the vehicle has', { totalSeats: 6 }],
  ])('rejects %s', async (_name, overrides) => {
    expect((await offerRide(overrides)).status).toBe(400);
  });
});

describe('3.2 seat booking is atomic', () => {
  it('lets exactly one of two concurrent accepts take the last seat', async () => {
    // Shrink jrn-001 to a single seat, then two residents request it
    expect((await as(OFFERER, rides.PUT, '/api/v1/rides', { method: 'PUT', body: { journeyId: 'jrn-001', totalSeats: 1 } })).status).toBe(200);
    const a = await requestSeat(SEEKER);
    const b = await requestSeat(SEEKER_2);

    const results = await Promise.all([respond(a.request.id, 'ACCEPT'), respond(b.request.id, 'ACCEPT')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const journey = await repo.getRideOccurrence(SOCIETY, 'jrn-001');
    expect(journey?.availableSeats).toBe(0);
    expect(journey?.status).toBe('FULL');
    const accepted = (await repo.listJourneyRequests(SOCIETY, 'jrn-001')).filter((r) => r.status === 'ACCEPTED');
    expect(accepted).toHaveLength(1);
  });

  it('takes seats only once when the same request is accepted twice', async () => {
    const { request } = await requestSeat(SEEKER);
    const results = await Promise.all([respond(request.id, 'ACCEPT'), respond(request.id, 'ACCEPT')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await repo.getRideOccurrence(SOCIETY, 'jrn-001'))?.availableSeats).toBe(1);
  });

  it('cannot accept a request the seeker already cancelled', async () => {
    const { request } = await requestSeat(SEEKER);
    await as(SEEKER, requests.DELETE, `/api/v1/rides/requests?requestId=${request.id}`, { method: 'DELETE' });
    expect((await respond(request.id, 'ACCEPT')).status).toBe(409);
    expect((await repo.getRideOccurrence(SOCIETY, 'jrn-001'))?.availableSeats).toBe(2);
  });

  it('gives seats back when the offerer removes an accepted passenger', async () => {
    const { request } = await requestSeat(SEEKER, 'jrn-001', 2);
    await respond(request.id, 'ACCEPT');
    expect((await repo.getRideOccurrence(SOCIETY, 'jrn-001'))?.status).toBe('FULL');

    expect((await respond(request.id, 'REJECT')).status).toBe(200);
    const journey = await repo.getRideOccurrence(SOCIETY, 'jrn-001');
    expect(journey?.availableSeats).toBe(2);
    expect(journey?.status).toBe('OPEN');
  });

  it('gives seats back when a seeker cancels an accepted booking', async () => {
    const { request } = await requestSeat(SEEKER);
    await respond(request.id, 'ACCEPT');
    const res = await as(SEEKER, requests.DELETE, `/api/v1/rides/requests?requestId=${request.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await repo.getRideOccurrence(SOCIETY, 'jrn-001'))?.availableSeats).toBe(2);
  });

  it("does not let another resident cancel or answer someone's request", async () => {
    const { request } = await requestSeat(SEEKER);
    expect((await respond(request.id, 'ACCEPT', SEEKER_2)).status).toBe(403);
    const cancel = await as(SEEKER_2, requests.DELETE, `/api/v1/rides/requests?requestId=${request.id}`, { method: 'DELETE' });
    expect(cancel.status).toBe(403);
  });
});

describe('3.3 request rules', () => {
  it("rejects a request on the resident's own ride, with a message for the UI", async () => {
    const { res } = await requestSeat(OFFERER);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own/i);
  });

  it('rejects a second active request on the same ride', async () => {
    expect((await requestSeat(SEEKER)).res.status).toBe(200);
    expect((await requestSeat(SEEKER)).res.status).toBe(409);
  });

  it('allows a new request after the previous one was cancelled', async () => {
    const { request } = await requestSeat(SEEKER);
    await as(SEEKER, requests.DELETE, `/api/v1/rides/requests?requestId=${request.id}`, { method: 'DELETE' });
    expect((await requestSeat(SEEKER)).res.status).toBe(200);
  });

  it('rejects requests on a ride that has already departed', async () => {
    const ride = await repo.getRideOccurrence(SOCIETY, 'jrn-001');
    await repo.updateRideOccurrence(SOCIETY, 'jrn-001', OFFERER, {
      departureWindowStart: new Date(Date.now() - 60_000).toISOString(),
      journeyDate: ride!.journeyDate,
    });
    expect((await requestSeat(SEEKER)).res.status).toBe(409);
  });

  it('leaves departed rides out of the ride list, except for their offerer', async () => {
    const ride = await repo.getRideOccurrence(SOCIETY, 'jrn-001');
    await repo.updateRideOccurrence(SOCIETY, 'jrn-001', OFFERER, {
      departureWindowStart: new Date(Date.now() - 60_000).toISOString(),
      journeyDate: ride!.journeyDate,
    });
    const listedFor = async (userId: string) =>
      ((await (await as(userId, rides.GET, '/api/v1/rides')).json()).rides as { id: string }[]).map((r) => r.id);
    expect(await listedFor(SEEKER)).not.toContain('jrn-001');
    expect(await listedFor(OFFERER)).toContain('jrn-001');
  });

  it('enforces a women-only ride', async () => {
    const res = await offerRide({ genderPreference: 'FEMALE_ONLY' });
    const { ride } = await res.json();
    expect(ride.genderPreference).toBe('FEMALE_ONLY');

    expect((await requestSeat(SEEKER_2, ride.id)).res.status).toBe(403); // male
    expect((await requestSeat(SEEKER, ride.id)).res.status).toBe(200); // female
  });

  it('ignores gender preferences when the society does not allow them', async () => {
    await repo.updateSocietySettings(SOCIETY, { allow_gender_preferences: false });
    const { ride } = await (await offerRide({ genderPreference: 'FEMALE_ONLY' })).json();
    expect(ride.genderPreference).toBe('ANY');
  });
});

describe('3.4 cancelling a ride', () => {
  it('cancels pending and accepted requests and notifies those seekers', async () => {
    const accepted = await requestSeat(SEEKER);
    await respond(accepted.request.id, 'ACCEPT');
    const pending = await requestSeat(SEEKER_3);

    const res = await as(OFFERER, rides.DELETE, '/api/v1/rides?journeyId=jrn-001&reason=Car%20service', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json()).notifiedSeekers).toBe(2);

    const journey = await repo.getRideOccurrence(SOCIETY, 'jrn-001');
    expect(journey?.status).toBe('CANCELLED');
    expect(journey?.cancellationReason).toBe('Car service');

    for (const id of [accepted.request.id, pending.request.id]) {
      expect((await repo.getRideRequest(SOCIETY, id))?.status).toBe('CANCELLED');
    }
    for (const seeker of [SEEKER, SEEKER_3]) {
      const notes = await repo.listUserNotifications(SOCIETY, seeker);
      expect(notes.some((n) => n.title === 'Ride cancelled')).toBe(true);
    }

    // Gone from the open list, and can't be cancelled, edited or requested again
    expect((await repo.listOpenRides(SOCIETY, 'ALL')).some((r) => r.id === 'jrn-001')).toBe(false);
    expect((await as(OFFERER, rides.DELETE, '/api/v1/rides?journeyId=jrn-001', { method: 'DELETE' })).status).toBe(409);
    expect((await as(OFFERER, rides.PUT, '/api/v1/rides', { method: 'PUT', body: { journeyId: 'jrn-001', totalSeats: 3 } })).status).toBe(409);
    expect((await requestSeat(SEEKER_2)).res.status).toBe(409);
  });

  it('only lets the offerer cancel', async () => {
    expect((await as(SEEKER, rides.DELETE, '/api/v1/rides?journeyId=jrn-001', { method: 'DELETE' })).status).toBe(403);
  });
});

describe('3.5 no placeholder data', () => {
  it('computes trip distance from the real coordinates', async () => {
    const near = await (await offerRide({ destinationLat: 12.85, destinationLng: 77.66 })).json();
    const far = await (await offerRide({ destinationLat: 13.2, destinationLng: 77.7 })).json();
    expect(near.ride.baselineDistanceKm).toBeLessThan(far.ride.baselineDistanceKm);
    expect(far.ride.baselineDurationMinutes).toBeGreaterThan(near.ride.baselineDurationMinutes);
  });

  it('starts rides at the society location by default', async () => {
    const { ride } = await (await offerRide()).json();
    const society = await repo.getSocietyById(SOCIETY);
    expect([ride.originLat, ride.originLng]).toEqual([society!.latitude, society!.longitude]);
  });

  it('computes the detour from the pickup and drop-off points', async () => {
    const onRoute = await requestSeat(SEEKER);
    expect(onRoute.request.calculatedDetourMinutes).toBe(0);

    const offRoute = await as(SEEKER_3, requests.POST, '/api/v1/rides/requests', {
      method: 'POST',
      body: { journeyId: 'jrn-001', pickupLat: 12.97, pickupLng: 77.75, allowClash: true },
    });
    expect((await offRoute.json()).request.calculatedDetourMinutes).toBeGreaterThan(0);
  });

  it('requires a drop-off point to find matches', async () => {
    expect((await as(SEEKER, matches.POST, '/api/v1/rides/matches', { method: 'POST', body: {} })).status).toBe(400);
  });

  it("does not invent a flat number for the seeker's view of an accepted ride", async () => {
    const { request } = await requestSeat(SEEKER);
    await respond(request.id, 'ACCEPT');
    await repo.updateMembership(SOCIETY, OFFERER, { flatNumber: '' });

    const res = await as(SEEKER, requests.GET, '/api/v1/rides/requests');
    const mine = (await res.json()).requests.find((r: { id: string }) => r.id === request.id);
    expect(mine.offererMobile).toBe('+919811122233');
    expect(mine.offererFlat).toBeFalsy();
  });
});
