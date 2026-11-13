import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { pushDeviceId, sendPush } from '@/lib/services/push';
import { POST, DELETE } from '../devices/route';
import { InAppNotification } from '@/types';

const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': 'soc-ggh-001' });
const TOKEN_A = 'token-a'.padEnd(40, 'x');
const TOKEN_B = 'token-b'.padEnd(40, 'y');

const note: InAppNotification = {
  id: 'notif-1',
  societyId: 'soc-ggh-001',
  userId: 'usr-seeker-001',
  title: 'Your ride is confirmed',
  body: 'Ashutosh accepted your request',
  type: 'REQUEST_ACCEPTED',
  link: '/rides/my-requests',
  read: false,
  createdAt: new Date().toISOString(),
};

describe('push notification devices', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  const register = (userId: string, token: string) =>
    POST(makeRequest('/api/v1/notifications/devices', { method: 'POST', body: { token }, headers: as(userId) }));
  const unregister = (userId: string, token: string) =>
    DELETE(makeRequest('/api/v1/notifications/devices', { method: 'DELETE', body: { token }, headers: as(userId) }));

  it('registers a browser for the signed-in resident and moves it on a new sign-in', async () => {
    expect((await register('usr-seeker-001', 'short')).status).toBe(400);
    expect((await register('usr-seeker-001', TOKEN_A)).status).toBe(200);
    expect((await repo.listPushDevices('usr-seeker-001')).map((d) => d.token)).toEqual([TOKEN_A]);

    await register('usr-offerer-001', TOKEN_A);
    expect(await repo.listPushDevices('usr-seeker-001')).toEqual([]);
    expect((await repo.listPushDevices('usr-offerer-001'))[0].id).toBe(pushDeviceId(TOKEN_A));
  });

  it("only removes the caller's own browser", async () => {
    await register('usr-seeker-001', TOKEN_A);
    await unregister('usr-offerer-001', TOKEN_A);
    expect(await repo.listPushDevices('usr-seeker-001')).toHaveLength(1);
    await unregister('usr-seeker-001', TOKEN_A);
    expect(await repo.listPushDevices('usr-seeker-001')).toHaveLength(0);
  });

  it('sends to every device and drops tokens that no longer work', async () => {
    await register('usr-seeker-001', TOKEN_A);
    await register('usr-seeker-001', TOKEN_B);
    const sender = {
      sendEachForMulticast: vi.fn().mockResolvedValue({
        responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }],
      }),
    };

    expect(await sendPush(repo, note, sender)).toBe(1);
    const message = sender.sendEachForMulticast.mock.calls[0][0];
    expect(message.tokens).toEqual([TOKEN_A, TOKEN_B]);
    expect(message.data).toMatchObject({ title: note.title, url: '/rides/my-requests', tag: 'notif-1' });
    expect((await repo.listPushDevices('usr-seeker-001')).map((d) => d.token)).toEqual([TOKEN_A]);
  });

  it('never fails the request when sending does, and skips without a sender', async () => {
    await register('usr-seeker-001', TOKEN_A);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { sendEachForMulticast: vi.fn().mockRejectedValue(new Error('FCM down')) };
    expect(await sendPush(repo, note, broken)).toBe(0);
    expect(await sendPush(repo, note)).toBe(0); // development/tests: no FCM
  });
});
