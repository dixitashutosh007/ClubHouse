import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { GET } from '../overview/route';

const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': 'soc-ggh-001' });

describe('admin overview', () => {
  beforeEach(() => {
    resetRepository();
  });

  it('is for admins only and counts residents, rides and classes', async () => {
    expect((await GET(makeRequest('/api/v1/admin/overview', { headers: as('usr-seeker-001') }))).status).toBe(403);
    const data = await (await GET(makeRequest('/api/v1/admin/overview', { headers: as('usr-admin-001') }))).json();
    expect(data.residents.active).toBeGreaterThan(0);
    expect(data.residents.waiting).toBeGreaterThanOrEqual(1); // usr-pending-001
    expect(data.rides.upcomingWeek).toBeGreaterThan(0);
    expect(data.classes).toMatchObject({ live: 2, waiting: 1 });
  });
});
