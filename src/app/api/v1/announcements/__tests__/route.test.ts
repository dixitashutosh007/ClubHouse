import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET, POST, DELETE } from '../route';

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });

describe('society notices', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  const post = (userId: string, body: unknown) =>
    POST(makeRequest('/api/v1/announcements', { method: 'POST', body, headers: as(userId) }));
  const list = async (userId: string) =>
    (await (await GET(makeRequest('/api/v1/announcements', { headers: as(userId) }))).json()).announcements;
  const remove = (userId: string, id: string) =>
    DELETE(makeRequest(`/api/v1/announcements?id=${id}`, { method: 'DELETE', headers: as(userId) }));

  it('only settings admins post; residents see it and get a notification', async () => {
    const notice = { title: 'Water off on Sunday', body: 'Tank cleaning from 10 am to 2 pm.' };
    expect((await post('usr-seeker-001', notice)).status).toBe(403);
    const res = await post('usr-admin-001', notice);
    expect(res.status).toBe(200);
    expect((await res.json()).notified).toBeGreaterThan(0);

    expect((await list('usr-seeker-001'))[0].title).toBe('Water off on Sunday');
    const notes = await repo.listUserNotifications(SOCIETY, 'usr-seeker-001');
    expect(notes.some((n) => n.title === 'Water off on Sunday')).toBe(true);
    const adminNotes = await repo.listUserNotifications(SOCIETY, 'usr-admin-001');
    expect(adminNotes.some((n) => n.title === 'Water off on Sunday')).toBe(false);
  });

  it('hides expired notices, and admins can take them down', async () => {
    await repo.createAnnouncement({
      id: 'ann-old',
      societyId: SOCIETY,
      title: 'Old',
      body: 'Old news here',
      createdBy: 'usr-admin-001',
      createdAt: '2026-01-01T00:00:00Z',
      expiresOn: '2026-01-02',
    });
    const created = await (await post('usr-admin-001', { title: 'Diwali party', body: 'Clubhouse, 7 pm', notify: false })).json();
    expect((await list('usr-seeker-001')).map((a: { title: string }) => a.title)).toEqual(['Diwali party']);

    expect((await remove('usr-seeker-001', created.announcement.id)).status).toBe(403);
    await remove('usr-admin-001', created.announcement.id);
    expect(await list('usr-seeker-001')).toEqual([]);
  });

  it('rejects an end date in the past', async () => {
    expect((await post('usr-admin-001', { title: 'Late', body: 'Too late now', expiresOn: '2020-01-01' })).status).toBe(400);
  });
});
