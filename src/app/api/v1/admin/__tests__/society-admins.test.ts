import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { registerIdToken, resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET as details } from '../societies/details/route';
import { POST as addAdmin, DELETE as revokeAdmin } from '../societies/admins/route';
import { POST as createSession } from '../../auth/session/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });
const APP_ADMIN = 'usr-app-admin-001';

const getDetails = (userId: string, id = SOCIETY) =>
  details(makeRequest(`/api/v1/admin/societies/details?id=${id}`, { headers: as(userId) }));
const add = (userId: string, mobile: string) =>
  addAdmin(makeRequest('/api/v1/admin/societies/admins', { method: 'POST', body: { societyId: SOCIETY, mobile }, headers: as(userId) }));
const revoke = (userId: string, body: Record<string, string>) =>
  revokeAdmin(
    makeRequest('/api/v1/admin/societies/admins', { method: 'DELETE', body: { societyId: SOCIETY, ...body }, headers: as(userId) })
  );

describe('society details and admins', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
  });

  it('only app admins see details or change admins', async () => {
    expect((await getDetails('usr-admin-001')).status).toBe(403);
    expect((await getDetails('usr-seeker-001')).status).toBe(403);
    expect((await add('usr-admin-001', '9822233344')).status).toBe(403);
    expect((await revoke('usr-admin-001', { userId: 'usr-admin-001' })).status).toBe(403);
    expect((await getDetails(APP_ADMIN, 'soc-missing')).status).toBe(404);
  });

  it('lists the society admins', async () => {
    const data = await (await getDetails(APP_ADMIN)).json();
    expect(data.society.id).toBe(SOCIETY);
    expect(data.admins.map((a: { userId: string }) => a.userId)).toContain('usr-admin-001');
    expect(data.counts.residents).toBeGreaterThan(0);
  });

  it('promotes a member straight away, and revokes them back to resident', async () => {
    const res = await add(APP_ADMIN, '98222 33344'); // usr-seeker-001
    expect(res.status).toBe(200);
    expect((await repo.getMembership(SOCIETY, 'usr-seeker-001'))!.role).toBe('SOCIETY_ADMIN');

    expect((await revoke(APP_ADMIN, { userId: 'usr-seeker-001' })).status).toBe(200);
    expect((await repo.getMembership(SOCIETY, 'usr-seeker-001'))!.role).toBe('RESIDENT');
    expect((await revoke(APP_ADMIN, { userId: 'usr-seeker-001' })).status).toBe(404);
  });

  it('never leaves a society without an admin', async () => {
    const admins = (await (await getDetails(APP_ADMIN)).json()).admins.filter(
      (a: { role: string }) => a.role === 'SOCIETY_ADMIN'
    );
    for (const a of admins.slice(1)) await revoke(APP_ADMIN, { userId: a.userId });
    expect((await revoke(APP_ADMIN, { userId: admins[0].userId })).status).toBe(409);
  });

  it('invites a newcomer, who becomes admin when they sign in', async () => {
    const res = await add(APP_ADMIN, '9700000042');
    expect((await res.json()).invited).toBe('+919700000042');
    expect((await (await getDetails(APP_ADMIN)).json()).invitedAdmins).toEqual(['+919700000042']);

    vi.stubEnv('NODE_ENV', 'production');
    registerIdToken('newadmin', { uid: 'fb-new-admin', phone_number: '+919700000042' });
    const session = await createSession(makeRequest('/api/v1/auth/session', { method: 'POST', body: { idToken: 'newadmin' } }));
    expect(session.status).toBe(200);
    expect((await session.json()).membership).toMatchObject({ role: 'SOCIETY_ADMIN', status: 'ACTIVE' });
    expect((await repo.getSocietyById(SOCIETY))!.adminInvites).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('withdraws an invitation', async () => {
    await add(APP_ADMIN, '9700000043');
    expect((await revoke(APP_ADMIN, { mobile: '9700000043' })).status).toBe(200);
    expect((await repo.getSocietyById(SOCIETY))!.adminInvites).toEqual([]);
  });
});
