import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { registerIdToken, resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET, PATCH, POST } from '../societies/route';
import { POST as createSession } from '../../auth/session/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': 'soc-ggh-001' });

const newSociety = {
  name: 'Green Meadows',
  address: 'Whitefield, Bengaluru',
  latitude: 12.97,
  longitude: 77.75,
  adminName: 'Meera Rao',
  adminMobile: '98450 12345',
  settings: { pickupPoints: ['Main Gate'], emergencyNumber: '+91 80 1111 2222' },
};

const add = (userId: string, body: unknown = newSociety) =>
  POST(makeRequest('/api/v1/admin/societies', { method: 'POST', body, headers: as(userId) }));

describe('/api/v1/admin/societies', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
  });

  it('lets only app admins add or list societies', async () => {
    expect((await add('usr-seeker-001')).status).toBe(403);
    expect((await add('usr-admin-001')).status).toBe(403);
    expect((await GET(makeRequest('/api/v1/admin/societies', { headers: as('usr-admin-001') }))).status).toBe(403);
  });

  it('creates the society closed, with no invite link until its admin signs in', async () => {
    const res = await add('usr-app-admin-001');
    expect(res.status).toBe(200);
    const { society } = await res.json();
    expect(society).toMatchObject({ status: 'PENDING_SETUP', pendingAdminMobile: '+919845012345' });
    expect(society.inviteCode).toBeUndefined();

    const stored = (await repo.getSocietyById(society.id))!;
    expect(stored.settings).toMatchObject({ pickupPoints: ['Main Gate'], emergencyNumber: '+91 80 1111 2222' });
    expect(stored.code).toMatch(/^GM\d{4}$/);
  });

  it('validates the wizard', async () => {
    expect((await add('usr-app-admin-001', { ...newSociety, adminMobile: '12345' })).status).toBe(400);
    expect((await add('usr-app-admin-001', { ...newSociety, latitude: undefined })).status).toBe(400);
    await add('usr-app-admin-001');
    expect((await add('usr-app-admin-001')).status).toBe(409); // same name
  });

  it('opens the society when the named admin signs in with that mobile', async () => {
    const { society } = await (await add('usr-app-admin-001')).json();

    vi.stubEnv('NODE_ENV', 'production');
    // Nobody can join while it is being set up
    registerIdToken('resident', { uid: 'fb-resident', phone_number: '+919700000009' });
    const stored = (await repo.getSocietyById(society.id))!;
    const join = await createSession(
      makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'resident', societyCode: stored.code } })
    );
    expect(join.status).toBe(404);

    registerIdToken('admin', { uid: 'fb-meera', phone_number: '+919845012345' });
    const res = await createSession(makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'admin' } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activatedSociety).toEqual({ id: society.id, name: 'Green Meadows' });
    expect(data.membership).toMatchObject({ role: 'SOCIETY_ADMIN', status: 'ACTIVE' });

    const live = (await repo.getSocietyById(society.id))!;
    expect(live.status).toBe('ACTIVE');
    expect(live.pendingAdminMobile).toBeUndefined();
  });

  it('can change the pending admin or cancel the setup', async () => {
    const { society } = await (await add('usr-app-admin-001')).json();
    const patch = (body: unknown) =>
      PATCH(makeRequest('/api/v1/admin/societies', { method: 'PATCH', body, headers: as('usr-app-admin-001') }));

    const changed = await (
      await patch({ societyId: society.id, action: 'CHANGE_ADMIN', adminName: 'Arjun', adminMobile: '9845099999' })
    ).json();
    expect(changed.society.pendingAdminMobile).toBe('+919845099999');

    expect((await patch({ societyId: society.id, action: 'CANCEL' })).status).toBe(200);
    expect((await repo.getSocietyById(society.id))!.status).toBe('INACTIVE');
    expect((await patch({ societyId: society.id, action: 'CANCEL' })).status).toBe(409);
  });
});

describe('sign-in for residents of several societies', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
    vi.stubEnv('NODE_ENV', 'production');
  });

  const signIn = () => {
    registerIdToken('offerer', { uid: 'fb-offerer', phone_number: '+919811122233' });
    return createSession(makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'offerer' } }));
  };

  it('goes straight in with one society', async () => {
    const data = await (await signIn()).json();
    expect(data.chooseSociety).toBeUndefined();
  });

  it('asks which society to use when there are several', async () => {
    const now = new Date().toISOString();
    await repo.createMembership({
      id: 'mem-x',
      societyId: 'soc-pfr-002',
      userId: 'usr-offerer-001',
      flatNumber: 'B-101',
      role: 'RESIDENT',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    const data = await (await signIn()).json();
    expect(data.chooseSociety).toBe(true);
    expect(data.societies.map((s: { id: string }) => s.id).sort()).toEqual(['soc-ggh-001', 'soc-pfr-002']);
    expect(Object.keys(data.societies[0]).sort()).toEqual(['address', 'id', 'name', 'slug']);
  });
});
