import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { adminAuth, registerIdToken, registerSessionCookie, resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { POST as createSession, DELETE as deleteSession } from '../session/route';
import { POST as register } from '../register/route';
import { POST as changePhone } from '../phone/route';
import { PUT as updateMe } from '../me/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const login = (idToken: string, extra: Record<string, unknown> = {}, ip = '10.0.0.1') =>
  createSession(
    makeRequest('/api/v1/auth/session', {
      method: 'POST',
      body: { idToken, ...extra },
      headers: { 'x-forwarded-for': ip },
    })
  );

describe('POST /api/v1/auth/session (production)', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('rejects an invalid ID token', async () => {
    const res = await login('not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects development tokens', async () => {
    const res = await login('dev-token-usr-admin-001');
    expect(res.status).toBe(401);
  });

  it('rejects a token from an old sign-in', async () => {
    registerIdToken('stale', { uid: 'fb-1', phone_number: '+919811122233', authAgeSeconds: 600 });
    const res = await login('stale');
    expect(res.status).toBe(401);
  });

  it('rejects a token without a verified phone number', async () => {
    registerIdToken('no-phone', { uid: 'fb-1' });
    const res = await login('no-phone');
    expect(res.status).toBe(401);
  });

  it('links an existing resident by verified phone and issues a signed session cookie', async () => {
    registerIdToken('good', { uid: 'firebase-uid-offerer', phone_number: '+919811122233' });

    const res = await login('good');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.id).toBe('usr-offerer-001');
    expect((await repo.getUserById('usr-offerer-001'))?.firebaseUid).toBe('firebase-uid-offerer');

    expect(adminAuth.createSessionCookie).toHaveBeenCalledWith('good', expect.anything());
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('junto_session=session-for-firebase-uid-offerer');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
  });

  it('asks a new phone number without an invite code to find its society', async () => {
    registerIdToken('new', { uid: 'firebase-new', phone_number: '+919700000001' });

    const res = await login('new');
    expect(res.status).toBe(404);
    expect((await res.json()).needsSociety).toBe(true);
    expect(await repo.getUserById('firebase-new')).toBeNull();
  });

  it("signs an existing resident into their own society when no code is given", async () => {
    await repo.createSociety({
      id: 'soc-other-002',
      slug: 'palm-meadows',
      name: 'Palm Meadows',
      code: 'PALM2024',
      address: 'Whitefield',
      latitude: 12.9698,
      longitude: 77.7499,
      settings: { max_detour_minutes: 10, require_admin_approval: true, allow_gender_preferences: true },
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    // A resident who only belongs to the second society
    await repo.createUser({
      id: 'usr-palm',
      cognitoSub: 'x',
      email: 'palm@example.com',
      mobile: '+919700000009',
      fullName: 'Palm Resident',
      gender: 'FEMALE',
      createdAt: new Date().toISOString(),
    });
    await repo.createMembership({
      id: 'mem-palm',
      societyId: 'soc-other-002',
      userId: 'usr-palm',
      flatNumber: 'P-1',
      role: 'RESIDENT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    registerIdToken('palm', { uid: 'firebase-palm', phone_number: '+919700000009' });

    const res = await login('palm');
    expect(res.status).toBe(200);
    expect((await res.json()).societyId).toBe('soc-other-002');
    expect(res.headers.get('set-cookie')).toContain('junto_society_id=soc-other-002');
    expect(await repo.getMembership('soc-ggh-001', 'usr-palm')).toBeNull();
  });

  it('creates a pending user for a new phone number joining by invite code', async () => {
    registerIdToken('new', { uid: 'firebase-new', phone_number: '+919700000001' });

    const res = await login('new', { societyCode: 'MR2024' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe('firebase-new');
    expect(data.user.mobile).toBe('+919700000001');
    expect(data.membership.status).toBe('PENDING_APPROVAL');
  });

  it('refuses to link a phone number already linked to a different sign-in account', async () => {
    await repo.updateUser('usr-offerer-001', { firebaseUid: 'someone-else' });
    registerIdToken('good', { uid: 'firebase-uid-offerer', phone_number: '+919811122233' });

    const res = await login('good');
    expect(res.status).toBe(409);
  });

  it('lets a new number ask to join a society picked in the search, by ID', async () => {
    registerIdToken('new', { uid: 'firebase-new', phone_number: '+919700000001' });

    const res = await login('new', { societyId: 'soc-ggh-001' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.membership.status).toBe('PENDING_APPROVAL');
    expect(data.societyId).toBe('soc-ggh-001');

    registerIdToken('again', { uid: 'firebase-new-2', phone_number: '+919700000002' });
    expect((await login('again', { societyId: 'soc-missing' })).status).toBe(404);
  });

  it('rejects an unknown society invite code', async () => {
    registerIdToken('good', { uid: 'firebase-new', phone_number: '+919700000001' });
    const res = await login('good', { societyCode: 'NOPE99' });
    expect(res.status).toBe(404);
  });

  it('rate-limits repeated sign-in attempts from one address', async () => {
    for (let i = 0; i < 10; i++) await login('bad');
    const res = await login('bad');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('revokes the Firebase session on logout', async () => {
    const cookie = registerSessionCookie('firebase-uid-offerer');
    const res = await deleteSession(
      makeRequest('/api/v1/auth/session', { method: 'DELETE', cookies: { junto_session: cookie } })
    );

    expect(res.status).toBe(200);
    expect(adminAuth.revokeRefreshTokens).toHaveBeenCalledWith('firebase-uid-offerer');
    expect(res.headers.get('set-cookie')).toContain('junto_session=;');
  });
});

describe('POST /api/v1/auth/register', () => {
  const form = {
    societyCode: 'MR2024',
    fullName: 'Meera Rao',
    email: 'meera@example.com',
    flatNumber: 'D-1101',
    gender: 'FEMALE',
    mobile: '+919999999999',
  };

  beforeEach(() => {
    resetRepository();
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('requires a verified sign-in', async () => {
    const res = await register(makeRequest('/api/v1/auth/register', { method: 'POST', body: form }));
    expect(res.status).toBe(401);
  });

  it('registers into a society picked by ID', async () => {
    const cookie = registerSessionCookie('usr-pending-001');
    const { societyCode: _code, ...rest } = form;
    void _code;
    const res = await register(
      makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: { ...rest, societyId: 'soc-ggh-001' },
        cookies: { junto_session: cookie },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).membership.flatNumber).toBe('D-1101');
  });

  it('requires an invite code or a society ID to register', async () => {
    const cookie = registerSessionCookie('usr-pending-001');
    const { societyCode: _code, ...rest } = form;
    void _code;
    const res = await register(
      makeRequest('/api/v1/auth/register', { method: 'POST', body: rest, cookies: { junto_session: cookie } })
    );
    expect(res.status).toBe(400);
  });

  it('completes the pending membership and ignores a submitted mobile number', async () => {
    const cookie = registerSessionCookie('usr-pending-001');
    const res = await register(
      makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: form,
        cookies: { junto_session: cookie },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.fullName).toBe('Meera Rao');
    expect(data.user.mobile).toBe('+919833344455');
    expect(data.user.emailVerified).toBe(false);
    expect(data.membership.flatNumber).toBe('D-1101');
  });
});

describe('profile and phone changes', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
    vi.stubEnv('NODE_ENV', 'production');
  });

  const seekerCookie = () => registerSessionCookie('usr-seeker-001');

  it('ignores mobile numbers sent to PUT /auth/me', async () => {
    const res = await updateMe(
      makeRequest('/api/v1/auth/me', {
        method: 'PUT',
        body: { mobile: '+919000000000', fullName: 'Priya Sharma' },
        cookies: { junto_session: seekerCookie() },
      })
    );

    expect(res.status).toBe(200);
    expect((await repo.getUserById('usr-seeker-001'))?.mobile).toBe('+919822233344');
  });

  const phoneChange = (idToken: string) =>
    changePhone(
      makeRequest('/api/v1/auth/phone', {
        method: 'POST',
        body: { idToken, devPhoneNumber: '+919111111111' },
        cookies: { junto_session: seekerCookie() },
      })
    );

  it('updates the mobile number from a fresh verified token', async () => {
    registerIdToken('after-update', { uid: 'usr-seeker-001', phone_number: '+919700000002', authAgeSeconds: 3600 });

    const res = await phoneChange('after-update');
    expect(res.status).toBe(200);
    expect((await repo.getUserById('usr-seeker-001'))?.mobile).toBe('+919700000002');
  });

  it('rejects a token belonging to a different account', async () => {
    registerIdToken('other', { uid: 'usr-admin-001', phone_number: '+919700000002' });
    const res = await phoneChange('other');
    expect(res.status).toBe(401);
  });

  it('rejects a token that was not freshly issued', async () => {
    registerIdToken('old', { uid: 'usr-seeker-001', phone_number: '+919700000002', issuedAgeSeconds: 600 });
    const res = await phoneChange('old');
    expect(res.status).toBe(401);
  });

  it('ignores the dev phone number field in production', async () => {
    registerIdToken('no-phone', { uid: 'usr-seeker-001' });
    const res = await phoneChange('no-phone');
    expect(res.status).toBe(401);
  });

  it('rejects a number already registered to another resident', async () => {
    registerIdToken('taken', { uid: 'usr-seeker-001', phone_number: '+919811122233' });
    const res = await phoneChange('taken');
    expect(res.status).toBe(409);
  });
});
