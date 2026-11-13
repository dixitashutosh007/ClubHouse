import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { adminAuth, registerIdToken, registerSessionCookie, resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { POST as createSession, DELETE as deleteSession } from '../session/route';
import { GET as me } from '../me/route';
import { proxy } from '@/proxy';
import { GET as appleLinks } from '@/app/.well-known/apple-app-site-association/route';
import { GET as androidLinks } from '@/app/.well-known/assetlinks.json/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

describe('phone app sign-in with a Bearer token (production)', () => {
  beforeEach(() => {
    resetRepository();
    resetFirebaseMock();
    resetRateLimits();
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns the session only when asked, and accepts it as a Bearer token', async () => {
    registerIdToken('good', { uid: 'firebase-uid-offerer', phone_number: '+919811122233' });
    const web = await (await createSession(makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'good' } }))).json();
    expect(web.sessionToken).toBeUndefined();

    registerIdToken('app', { uid: 'firebase-uid-offerer', phone_number: '+919811122233' });
    const app = await (
      await createSession(makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'app', returnToken: true } }))
    ).json();
    expect(app.sessionToken).toBeTruthy();

    const res = await me(makeRequest('/api/v1/auth/me', { headers: { authorization: `Bearer ${app.sessionToken}` } }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.id).toBe('usr-offerer-001');
  });

  it('rejects a forged token and revokes a real one on sign-out', async () => {
    expect((await me(makeRequest('/api/v1/auth/me', { headers: { authorization: 'Bearer forged-value' } }))).status).toBe(401);

    const token = registerSessionCookie('firebase-uid-offerer');
    await deleteSession(makeRequest('/api/v1/auth/session', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
    expect(adminAuth.revokeRefreshTokens).toHaveBeenCalledWith('firebase-uid-offerer');
  });
});

describe('CORS for the phone apps', () => {
  const preflight = (origin: string) =>
    proxy(new NextRequest('http://localhost/api/v1/auth/me', { method: 'OPTIONS', headers: { origin } }));

  it('allows only the app origins, never with cookies', () => {
    const ok = preflight('capacitor://localhost');
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    expect(ok.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(ok.headers.get('access-control-allow-credentials')).toBeNull();

    const bad = preflight('https://evil.example');
    expect(bad.status).toBe(403);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('invite-link files for the phone apps', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('are served only once the apps are configured', async () => {
    vi.stubEnv('APPLE_APP_ID', '');
    vi.stubEnv('ANDROID_PACKAGE', '');
    expect(appleLinks().status).toBe(404);
    expect(androidLinks().status).toBe(404);

    vi.stubEnv('APPLE_APP_ID', 'ABCDE12345.in.clubhouse.app');
    vi.stubEnv('ANDROID_PACKAGE', 'in.clubhouse.app');
    vi.stubEnv('ANDROID_SHA256_FINGERPRINTS', 'AA:BB, CC:DD');
    expect((await appleLinks().json()).applinks.details[0]).toEqual({
      appIDs: ['ABCDE12345.in.clubhouse.app'],
      components: [{ '/': '/join/*' }],
    });
    expect((await androidLinks().json())[0].target.sha256_cert_fingerprints).toEqual(['AA:BB', 'CC:DD']);
  });
});
