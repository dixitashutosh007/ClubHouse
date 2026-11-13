import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET, POST, DELETE } from '../interest/route';
import { GET as listClasses } from '../route';

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });
// lsn-001: ACTIVE, taught by usr-seeker-001. lsn-003: pending approval.
const TEACHER = 'usr-seeker-001';

describe("classes: I'm interested", () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  const mark = (userId: string, listingId: string, method: 'POST' | 'DELETE' = 'POST') =>
    (method === 'POST' ? POST : DELETE)(
      makeRequest('/api/v1/lessons/interest', { method, body: { listingId }, headers: as(userId) })
    );
  const who = (userId: string, listingId: string) =>
    GET(makeRequest(`/api/v1/lessons/interest?listingId=${listingId}`, { headers: as(userId) }));

  it("shares the resident's contact with the teacher only, and tells the teacher", async () => {
    expect((await mark('usr-offerer-001', 'lsn-001')).status).toBe(200);
    await mark('usr-offerer-001', 'lsn-001'); // twice is fine

    const list = await (await who(TEACHER, 'lsn-001')).json();
    expect(list.interested).toHaveLength(1);
    expect(list.interested[0]).toMatchObject({ userId: 'usr-offerer-001', mobile: '+919811122233' });

    expect((await who('usr-offerer-003', 'lsn-001')).status).toBe(403);
    const notes = await repo.listUserNotifications(SOCIETY, TEACHER);
    expect(notes.filter((n) => n.title.includes('interested'))).toHaveLength(1);

    const mine = await (await listClasses(makeRequest('/api/v1/lessons?mine=true', { headers: as(TEACHER) }))).json();
    expect(mine.classes.find((c: { id: string }) => c.id === 'lsn-001').interestedCount).toBe(1);
  });

  it('lets the resident change their mind', async () => {
    await mark('usr-offerer-001', 'lsn-001');
    await mark('usr-offerer-001', 'lsn-001', 'DELETE');
    expect((await (await who(TEACHER, 'lsn-001')).json()).interested).toHaveLength(0);
    const own = await (await GET(makeRequest('/api/v1/lessons/interest', { headers: as('usr-offerer-001') }))).json();
    expect(own.listingIds).toEqual([]);
  });

  it('refuses your own class and classes not yet live', async () => {
    expect((await mark(TEACHER, 'lsn-001')).status).toBe(400);
    expect((await mark('usr-offerer-001', 'lsn-003')).status).toBe(404);
  });
});
