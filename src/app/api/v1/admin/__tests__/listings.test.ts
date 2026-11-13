import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { GET } from '../listings/route';

const as = (userId: string, society = 'soc-ggh-001') => ({ 'x-dev-user-id': userId, 'x-society-id': society });
const get = (userId: string, kind: string) => GET(makeRequest(`/api/v1/admin/listings?kind=${kind}`, { headers: as(userId) }));

describe('/api/v1/admin/listings', () => {
  beforeEach(() => {
    resetRepository();
  });

  it('is for admins only', async () => {
    expect((await get('usr-seeker-001', 'rides')).status).toBe(403);
    expect((await get('usr-admin-001', 'boats')).status).toBe(400);
  });

  it('lists rides and classes without contact details', async () => {
    const rides = await (await get('usr-admin-001', 'rides')).json();
    expect(Array.isArray(rides.rides)).toBe(true);
    for (const r of rides.rides) expect(Object.keys(r)).not.toContain('mobile');

    const classes = await (await get('usr-admin-001', 'classes')).json();
    expect(Array.isArray(classes.classes)).toBe(true);
    for (const c of classes.classes) expect(Object.keys(c)).not.toContain('contactPhone');
  });
});
