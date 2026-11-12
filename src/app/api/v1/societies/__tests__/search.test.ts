import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { registerIdToken, resetFirebaseMock } from '@/test/firebase-admin-mock';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { POST as search } from '../search/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const find = (body: Record<string, unknown>) =>
  search(makeRequest('/api/v1/societies/search', { method: 'POST', body, headers: { 'x-forwarded-for': '10.0.0.9' } }));

describe('POST /api/v1/societies/search (production)', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetFirebaseMock();
    resetRateLimits();
    vi.stubEnv('NODE_ENV', 'production');
    registerIdToken('fresh', { uid: 'firebase-new', phone_number: '+919700000001' });
  });

  it('requires a freshly verified phone number', async () => {
    expect((await find({ idToken: 'not-a-token', query: 'mahaveer' })).status).toBe(401);
    expect((await find({ idToken: 'dev-token-usr-admin-001', query: 'mahaveer' })).status).toBe(401);
    registerIdToken('stale', { uid: 'firebase-new', phone_number: '+919700000001', authAgeSeconds: 600 });
    expect((await find({ idToken: 'stale', query: 'mahaveer' })).status).toBe(401);
  });

  it('finds active societies by name or area, without revealing invite codes', async () => {
    const byName = await (await find({ idToken: 'fresh', query: 'mahaveer' })).json();
    expect(byName.societies).toEqual([{ id: 'soc-ggh-001', name: 'Mahaveer Ranches', address: expect.any(String) }]);
    expect(JSON.stringify(byName)).not.toContain('MR2024');

    const byArea = await (await find({ idToken: 'fresh', query: 'bellandur' })).json();
    expect(byArea.societies.map((s: { name: string }) => s.name)).toContain('Prestige Ferns Residency');
  });

  it('never returns settings or inactive societies', async () => {
    const society = (await repo.getSocietyByCode('MR2024'))!;
    await repo.updateSociety(society.id, { status: 'INACTIVE' });
    const data = await (await find({ idToken: 'fresh', query: 'mahaveer' })).json();
    expect(data.societies).toEqual([]);

    const other = await (await find({ idToken: 'fresh', query: 'prestige' })).json();
    expect(Object.keys(other.societies[0]).sort()).toEqual(['address', 'id', 'name']);
  });

  it('rejects a query that is too short', async () => {
    expect((await find({ idToken: 'fresh', query: 'm' })).status).toBe(400);
  });
});
