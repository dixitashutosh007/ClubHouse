import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import * as rides from '../rides/route';
import * as requests from '../rides/requests/route';
import * as feedback from '../rides/feedback/route';
import * as matches from '../rides/matches/route';
import * as societies from '../societies/route';
import * as places from '../places/autocomplete/route';
import * as routesMatrix from '../routes/matrix/route';
import * as residents from '../admin/residents/route';
import * as rbac from '../admin/rbac/route';
import * as settings from '../admin/settings/route';
import * as auditLogs from '../admin/audit-logs/route';
import * as notifications from '../notifications/route';
import * as reports from '../moderation/reports/route';
import * as vehicles from '../user/vehicles/route';
import { getRepository } from '@/lib/db';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOCIETY = 'soc-ggh-001';
const OFFERER = 'usr-offerer-001'; // offers jrn-001
const SEEKER = 'usr-seeker-001';
const OTHER_RESIDENT = 'usr-offerer-002';
const SOCIETY_ADMIN = 'usr-admin-001';
const PLATFORM_ADMIN = 'usr-app-admin-001';

type Handler = (req: NextRequest) => Promise<Response>;

/** Calls a handler as a seeded development user */
function as(
  userId: string,
  handler: Handler,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  return handler(
    makeRequest(path, {
      ...options,
      headers: { 'x-dev-user-id': userId, 'x-society-id': SOCIETY },
    })
  );
}

let repo: MockDynamoRepository;

beforeEach(() => {
  repo = resetRepository();
  resetFirebaseMock();
  resetRateLimits();
});

/** Seeker requests a seat on jrn-001 and the offerer accepts it */
async function acceptedRequestOnJrn001(requestedSeats = 1) {
  const created = await as(SEEKER, requests.POST, '/api/v1/rides/requests', {
    method: 'POST',
    body: { journeyId: 'jrn-001', requestedSeats },
  });
  const { request } = await created.json();
  await as(OFFERER, requests.PUT, '/api/v1/rides/requests', {
    method: 'PUT',
    body: { requestId: request.id, action: 'ACCEPT' },
  });
  return request.id as string;
}

describe('2.1 input validation', () => {
  it.each([
    ['rides PUT without journeyId', rides.PUT, '/api/v1/rides', 'PUT', { totalSeats: 3 }],
    ['rides PUT with 50 seats', rides.PUT, '/api/v1/rides', 'PUT', { journeyId: 'jrn-001', totalSeats: 50 }],
    ['request PUT with unknown action', requests.PUT, '/api/v1/rides/requests', 'PUT', { requestId: 'x', action: 'DELETE' }],
    ['matches with out-of-range latitude', matches.POST, '/api/v1/rides/matches', 'POST', { dropoffLat: 500 }],
    ['vehicle with unknown type', vehicles.POST, '/api/v1/user/vehicles', 'POST', { type: 'TANK', make: 'A', model: 'B', registrationNumber: 'KA01AB1234' }],
    ['notifications with empty body', notifications.PATCH, '/api/v1/notifications', 'PATCH', {}],
  ])('rejects %s with 400', async (_name, handler, path, method, body) => {
    const res = await as(OFFERER, handler as Handler, path, { method, body });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed JSON body with 400 instead of crashing', async () => {
    const req = new NextRequest('http://localhost/api/v1/rides', {
      method: 'PUT',
      headers: { 'x-dev-user-id': OFFERER, 'content-type': 'application/json' },
      body: '{not json',
    });
    expect((await rides.PUT(req)).status).toBe(400);
  });

  it('refuses to cut total seats below seats already booked', async () => {
    await acceptedRequestOnJrn001(2);

    const tooFew = await as(OFFERER, rides.PUT, '/api/v1/rides', {
      method: 'PUT',
      body: { journeyId: 'jrn-001', totalSeats: 1 },
    });
    expect(tooFew.status).toBe(400);

    const enough = await as(OFFERER, rides.PUT, '/api/v1/rides', {
      method: 'PUT',
      body: { journeyId: 'jrn-001', totalSeats: 2 },
    });
    expect(enough.status).toBe(200);
    expect((await enough.json()).ride.availableSeats).toBe(0);
  });

  it('only lets the offerer edit a ride', async () => {
    const res = await as(SEEKER, rides.PUT, '/api/v1/rides', {
      method: 'PUT',
      body: { journeyId: 'jrn-001', totalSeats: 3 },
    });
    expect(res.status).toBe(403);
  });
});

describe('2.2 feedback privacy', () => {
  beforeEach(async () => {
    await repo.createFeedback({
      id: 'fb-test',
      societyId: SOCIETY,
      journeyId: 'jrn-001',
      fromUserId: SEEKER,
      toUserId: OFFERER,
      role: 'SEEKER',
      outcome: 'COMPLETED',
      qualitativeTags: ['Punctual'],
      privateNote: 'Drove too fast on the flyover',
      createdAt: new Date().toISOString(),
    });
  });

  it("does not let a resident read another resident's feedback", async () => {
    const res = await as(SEEKER, feedback.GET, `/api/v1/rides/feedback?userId=${OFFERER}`);
    expect(res.status).toBe(403);
  });

  it('hides private notes and authors from the recipient', async () => {
    const res = await as(OFFERER, feedback.GET, '/api/v1/rides/feedback');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tagBadges).toEqual([{ tag: 'Punctual', count: 1 }]);
    expect(data.feedback[0].privateNote).toBeUndefined();
    expect(data.feedback[0].fromUserId).toBeUndefined();
  });

  it('shows private notes to moderators', async () => {
    const res = await as(SOCIETY_ADMIN, feedback.GET, `/api/v1/rides/feedback?userId=${OFFERER}`);
    expect(res.status).toBe(200);
    expect((await res.json()).feedback[0].privateNote).toBe('Drove too fast on the flyover');
  });
});

describe('2.3 ride participants only', () => {
  it("hides a journey's requests from everyone but its offerer", async () => {
    const asSeeker = await as(SEEKER, requests.GET, '/api/v1/rides/requests?journeyId=jrn-001');
    expect(asSeeker.status).toBe(403);

    const asOfferer = await as(OFFERER, requests.GET, '/api/v1/rides/requests?journeyId=jrn-001');
    expect(asOfferer.status).toBe(200);
  });

  it('rejects feedback from someone who was not on the ride', async () => {
    const res = await as(OTHER_RESIDENT, feedback.POST, '/api/v1/rides/feedback', {
      method: 'POST',
      body: { journeyId: 'jrn-001', toUserId: OFFERER, outcome: 'COMPLETED' },
    });
    expect(res.status).toBe(403);
  });

  it('accepts feedback between accepted participants once, after the ride', async () => {
    await acceptedRequestOnJrn001();
    const body = { journeyId: 'jrn-001', toUserId: OFFERER, outcome: 'COMPLETED' };

    // Not before the ride has left
    const early = await as(SEEKER, feedback.POST, '/api/v1/rides/feedback', { method: 'POST', body });
    expect(early.status).toBe(409);
    await getRepository().updateRideOccurrence('soc-ggh-001', 'jrn-001', OFFERER, { status: 'COMPLETED' });

    const first = await as(SEEKER, feedback.POST, '/api/v1/rides/feedback', { method: 'POST', body });
    expect(first.status).toBe(200);
    expect((await first.json()).feedback.role).toBe('SEEKER');

    const second = await as(SEEKER, feedback.POST, '/api/v1/rides/feedback', { method: 'POST', body });
    expect(second.status).toBe(409);
  });

  it('rejects reports against yourself or unknown residents', async () => {
    const self = await as(SEEKER, reports.POST, '/api/v1/moderation/reports', {
      method: 'POST',
      body: { reportedUserId: SEEKER, category: 'OTHER', description: 'Testing self report' },
    });
    expect(self.status).toBe(400);

    const unknown = await as(SEEKER, reports.POST, '/api/v1/moderation/reports', {
      method: 'POST',
      body: { reportedUserId: 'usr-nobody', category: 'OTHER', description: 'Unknown resident' },
    });
    expect(unknown.status).toBe(404);
  });
});

describe('2.4 societies list', () => {
  it('returns only the member societies, without invite codes or settings', async () => {
    const res = await as(SEEKER, societies.GET as Handler, '/api/v1/societies');
    expect(res.status).toBe(200);
    const { societies: list } = await res.json();
    expect(list.map((s: { id: string }) => s.id)).toEqual([SOCIETY]);
    expect(list[0].code).toBeUndefined();
    expect(list[0].settings).toBeUndefined();
  });

  it('requires sign-in in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await (societies.GET as Handler)(makeRequest('/api/v1/societies'));
    expect(res.status).toBe(401);
  });
});

describe('2.5 maps endpoints', () => {
  it('require sign-in in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await places.GET(makeRequest('/api/v1/places/autocomplete?q=a'))).status).toBe(401);
    expect(
      (
        await routesMatrix.POST(
          makeRequest('/api/v1/routes/matrix', {
            method: 'POST',
            body: { origin: { lat: 12.9, lng: 77.6 }, destination: { lat: 13, lng: 77.6 } },
          })
        )
      ).status
    ).toBe(401);
  });

  it('rate-limits place searches per user', async () => {
    for (let i = 0; i < 60; i++) {
      expect((await as(SEEKER, places.GET, '/api/v1/places/autocomplete?q=a')).status).toBe(200);
    }
    expect((await as(SEEKER, places.GET, '/api/v1/places/autocomplete?q=a')).status).toBe(429);
    // Other users are unaffected
    expect((await as(OFFERER, places.GET, '/api/v1/places/autocomplete?q=a')).status).toBe(200);
  });

  it('validates route coordinates', async () => {
    const res = await as(SEEKER, routesMatrix.POST, '/api/v1/routes/matrix', {
      method: 'POST',
      body: { origin: { lat: 'x', lng: 77.6 }, destination: { lat: 13, lng: 77.6 } },
    });
    expect(res.status).toBe(400);
  });
});

describe('2.6 admin guards', () => {
  const residentAction = (actor: string, targetUserId: string, action: string) =>
    as(actor, residents.POST, '/api/v1/admin/residents', {
      method: 'POST',
      body: { targetUserId, action },
    });

  it('blocks residents from admin routes', async () => {
    expect((await as(SEEKER, residents.GET, '/api/v1/admin/residents')).status).toBe(403);
    expect((await residentAction(SEEKER, OTHER_RESIDENT, 'SUSPEND')).status).toBe(403);
    expect((await as(SEEKER, auditLogs.GET, '/api/v1/admin/audit-logs')).status).toBe(403);
  });

  it('approves pending residents and rejects invalid transitions', async () => {
    expect((await residentAction(SOCIETY_ADMIN, 'usr-pending-001', 'APPROVE')).status).toBe(200);
    expect((await residentAction(SOCIETY_ADMIN, 'usr-pending-001', 'APPROVE')).status).toBe(409);
  });

  it('stops admins acting on themselves, other admins or unknown members', async () => {
    expect((await residentAction(SOCIETY_ADMIN, SOCIETY_ADMIN, 'SUSPEND')).status).toBe(403);
    expect((await residentAction(SOCIETY_ADMIN, PLATFORM_ADMIN, 'BLOCK')).status).toBe(403);
    expect((await residentAction(SOCIETY_ADMIN, 'usr-nobody', 'SUSPEND')).status).toBe(404);
  });

  it('honours a revoked admin permission', async () => {
    await repo.updateMembership(SOCIETY, SOCIETY_ADMIN, {
      permissions: { canApproveResidents: false, canManageSettings: true },
    });
    expect((await residentAction(SOCIETY_ADMIN, 'usr-pending-001', 'APPROVE')).status).toBe(403);
    expect(
      (
        await as(SOCIETY_ADMIN, settings.PUT, '/api/v1/admin/settings', {
          method: 'PUT',
          body: { max_detour_minutes: 12 },
        })
      ).status
    ).toBe(200);
  });

  it('restricts RBAC changes to platform admins and safe roles', async () => {
    const rbacPut = (actor: string, body: unknown) =>
      as(actor, rbac.PUT, '/api/v1/admin/rbac', { method: 'PUT', body });

    expect((await rbacPut(SOCIETY_ADMIN, { targetUserId: SEEKER, role: 'SOCIETY_ADMIN' })).status).toBe(403);
    expect((await rbacPut(PLATFORM_ADMIN, { targetUserId: SEEKER, role: 'SUPER_ADMIN' })).status).toBe(400);
    expect((await rbacPut(PLATFORM_ADMIN, { targetUserId: PLATFORM_ADMIN, role: 'RESIDENT' })).status).toBe(403);
    expect((await rbacPut(PLATFORM_ADMIN, { targetUserId: 'usr-nobody', role: 'RESIDENT' })).status).toBe(404);
    expect((await rbacPut(PLATFORM_ADMIN, { targetUserId: SEEKER, role: 'SOCIETY_ADMIN' })).status).toBe(200);
  });

  it.each([
    ['nested repetition', '(a+)+$'],
    ['an invalid regex', '([A-Z'],
    ['a very long pattern', 'A'.repeat(101)],
  ])('rejects a flat format pattern with %s', async (_name, pattern) => {
    const res = await as(SOCIETY_ADMIN, settings.PUT, '/api/v1/admin/settings', {
      method: 'PUT',
      body: { flat_format_pattern: pattern },
    });
    expect(res.status).toBe(400);
  });

  it('accepts a normal flat format pattern', async () => {
    const res = await as(SOCIETY_ADMIN, settings.PUT, '/api/v1/admin/settings', {
      method: 'PUT',
      body: { flat_format_pattern: '^(Tower [A-Z]|#)[0-9A-Za-z -]+$' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown moderation report', async () => {
    const res = await as(SOCIETY_ADMIN, reports.PATCH, '/api/v1/moderation/reports', {
      method: 'PATCH',
      body: { reportId: 'rep-missing', status: 'RESOLVED' },
    });
    expect(res.status).toBe(404);
  });
});

describe('2.7 notifications', () => {
  it("cannot mark another user's notification as read", async () => {
    await repo.createNotification({
      id: 'notif-offerer',
      societyId: SOCIETY,
      userId: OFFERER,
      title: 'New Ride Request!',
      body: 'Someone requested a seat',
      type: 'RIDE_REQUESTED',
      read: false,
      createdAt: new Date().toISOString(),
    });

    const res = await as(SEEKER, notifications.PATCH, '/api/v1/notifications', {
      method: 'PATCH',
      body: { notificationId: 'notif-offerer' },
    });
    expect(res.status).toBe(404);

    const own = await as(OFFERER, notifications.PATCH, '/api/v1/notifications', {
      method: 'PATCH',
      body: { notificationId: 'notif-offerer' },
    });
    expect(own.status).toBe(200);
  });
});
