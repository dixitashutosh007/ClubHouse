import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { GET } from '../residents/route';

const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': 'soc-ggh-001' });
const get = (userId: string, query: string) => GET(makeRequest(`/api/v1/admin/residents?${query}`, { headers: as(userId) }));

describe('residents list paging', () => {
  beforeEach(() => {
    resetRepository();
  });

  it('keeps the full list when no page is asked for', async () => {
    const body = await (await get('usr-admin-001', 'all=true')).json();
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.total).toBeUndefined();
  });

  it('returns one page with totals and filter counts', async () => {
    const all = (await (await get('usr-admin-001', 'all=true')).json()).members.length;
    const res = await get('usr-admin-001', 'all=true&page=1&pageSize=2&sort=name&dir=asc');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.total).toBe(all);
    expect(body.counts.ALL).toBe(all);
    expect(body.counts.WAITING).toBeGreaterThan(0);
    const names = body.members.map((m: { user: { fullName: string } }) => m.user.fullName);
    expect([...names].sort((a: string, b: string) => a.localeCompare(b))).toEqual(names);
  });

  it('filters and searches on the server', async () => {
    const waiting = await (await get('usr-admin-001', 'all=true&page=1&filter=WAITING')).json();
    expect(waiting.members.every((m: { status: string }) => ['PENDING_APPROVAL', 'REGISTERED'].includes(m.status))).toBe(true);
    const found = await (await get('usr-admin-001', 'all=true&page=1&q=priya')).json();
    expect(found.total).toBe(1);
    expect(found.members[0].user.fullName).toMatch(/Priya/);
  });

  it('rejects bad paging input and still requires the resident permission', async () => {
    expect((await get('usr-admin-001', 'all=true&page=1&pageSize=500')).status).toBe(400);
    expect((await get('usr-admin-001', 'all=true&page=1&sort=password')).status).toBe(400);
    expect((await get('usr-seeker-001', 'all=true&page=1')).status).toBe(403);
  });
});
