import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { POST as createCircle, PATCH as circleAction } from '../route';
import * as Members from '../members/route';
import * as Messages from '../messages/route';
import { GET as unreadGet } from '../messages/unread/route';
import { hasEmoji, linkParts, messageProblem } from '@/lib/validation/circle-message';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOC = 'soc-ggh-001';
const ADMIN = 'usr-admin-001';
const OWNER = 'usr-offerer-001';
const PRIYA = 'usr-seeker-001';
const ROHAN = 'usr-offerer-002';
const ANANYA = 'usr-offerer-003';
const h = (userId: string, society = SOC) => ({ 'x-dev-user-id': userId, 'x-society-id': society });

const read = (userId: string, circleId: string, after?: string) =>
  Messages.GET(
    makeRequest(`/api/v1/circles/messages?circleId=${circleId}${after ? `&after=${encodeURIComponent(after)}` : ''}`, {
      headers: h(userId),
    })
  );
const post = (userId: string, circleId: string, text: string) =>
  Messages.POST(makeRequest('/api/v1/circles/messages', { method: 'POST', body: { circleId, text }, headers: h(userId) }));
const del = (userId: string, circleId: string, messageId: string) =>
  Messages.DELETE(
    makeRequest(`/api/v1/circles/messages?circleId=${circleId}&messageId=${messageId}`, { method: 'DELETE', headers: h(userId) })
  );
const unread = async (userId: string) => (await unreadGet(makeRequest('/api/v1/circles/messages/unread', { headers: h(userId) }))).json();
const member = (actor: string, circleId: string, userId: string, action: string) =>
  Members.PATCH(makeRequest('/api/v1/circles/members', { method: 'PATCH', body: { circleId, userId, action }, headers: h(actor) }));

/** Moves the rate-limit clock past the 10-second gap */
const later = () => vi.advanceTimersByTime(11_000);

async function liveCircleWith(...members: string[]): Promise<string> {
  const res = await createCircle(
    makeRequest('/api/v1/circles', {
      method: 'POST',
      headers: h(OWNER),
      body: { name: 'Chess Club', type: 'Sports', subType: 'Chess', description: 'Chess on Saturday evenings in the clubhouse.' },
    })
  );
  const id = (await res.json()).circle.id;
  await circleAction(makeRequest('/api/v1/circles', { method: 'PATCH', body: { circleId: id, action: 'APPROVE' }, headers: h(ADMIN) }));
  for (const u of members) {
    await Members.POST(makeRequest('/api/v1/circles/members', { method: 'POST', body: { circleId: id }, headers: h(u) }));
    await member(OWNER, id, u, 'APPROVE');
  }
  return id;
}

describe('circle message rules', () => {
  it('rejects emoji, keeps to 150 words and finds links', () => {
    expect(hasEmoji('Game at 7 👍')).toBe(true);
    expect(hasEmoji('I ❤️ chess')).toBe(true);
    expect(hasEmoji('Flags 🇮🇳')).toBe(true);
    expect(hasEmoji('Plain text, numbers 1-2-3 and हिंदी')).toBe(false);
    expect(messageProblem('   ')).toBe('Type a message.');
    expect(messageProblem('word '.repeat(150))).toBeNull();
    expect(messageProblem('word '.repeat(151))).toContain('150 words');
    expect(linkParts('Board: https://lichess.org/abc. See you')).toEqual([
      { text: 'Board: ' },
      { text: 'https://lichess.org/abc', href: 'https://lichess.org/abc' },
      { text: '. See you' },
    ]);
    expect(linkParts('no links')).toEqual([{ text: 'no links' }]);
  });
});

describe('circle messages', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    return () => vi.useRealTimers();
  });

  it('requires sign-in in production', async () => {
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect((await read(PRIYA, 'x')).status).toBe(401);
      expect((await post(PRIYA, 'x', 'hello')).status).toBe(401);
      expect((await del(PRIYA, 'x', 'y')).status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('lets only approved members read and post; society admins who are not members cannot', async () => {
    const id = await liveCircleWith(PRIYA);
    expect((await post(OWNER, id, 'Board set up at 6 pm')).status).toBe(200);
    later();
    const res = await read(PRIYA, id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((m: { name: string; text: string }) => `${m.name}: ${m.text}`)).toEqual([
      'Ashutosh Dixit: Board set up at 6 pm',
    ]);
    expect(body.messages[0]).not.toHaveProperty('phone');

    expect((await read(ROHAN, id)).status).toBe(403); // not a member
    expect((await post(ROHAN, id, 'hi')).status).toBe(403);
    expect((await read(ADMIN, id)).status).toBe(403); // society admin, not a member
    // A pending request gives no access either
    await Members.POST(makeRequest('/api/v1/circles/members', { method: 'POST', body: { circleId: id }, headers: h(ANANYA) }));
    expect((await read(ANANYA, id)).status).toBe(403);
    // The circle exists only in its own society
    expect(await repo.getCircle('soc-pfr-002', id)).toBeNull();
    expect(await repo.listCircleMessages('soc-pfr-002', id, '', 10)).toEqual([]);
  });

  it('cuts off removed and declined people at once', async () => {
    const id = await liveCircleWith(PRIYA);
    expect((await read(PRIYA, id)).status).toBe(200);
    await member(OWNER, id, PRIYA, 'REMOVE');
    expect((await read(PRIYA, id)).status).toBe(403);
    expect((await post(PRIYA, id, 'still here?')).status).toBe(403);
  });

  it('refuses emoji and messages over 150 words', async () => {
    const id = await liveCircleWith(PRIYA);
    expect((await post(PRIYA, id, 'See you there 😀')).status).toBe(400);
    expect((await post(PRIYA, id, 'word '.repeat(151))).status).toBe(400);
    expect((await post(PRIYA, id, '')).status).toBe(400);
    expect((await post(PRIYA, id, 'word '.repeat(150))).status).toBe(200);
  });

  it('allows one message every 10 seconds', async () => {
    const id = await liveCircleWith(PRIYA);
    expect((await post(PRIYA, id, 'first')).status).toBe(200);
    const second = await post(PRIYA, id, 'second');
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    // Someone else is not held up
    expect((await post(OWNER, id, 'reply')).status).toBe(200);
    later();
    expect((await post(PRIYA, id, 'second')).status).toBe(200);
  });

  it('returns only newer messages for the refresh, and keeps 30 days', async () => {
    const id = await liveCircleWith(PRIYA);
    await repo.createCircleMessage({
      id: 'old',
      societyId: SOC,
      circleId: id,
      userId: OWNER,
      text: 'from last month',
      createdAt: '2026-10-10T10:00:00.000Z',
    });
    await post(OWNER, id, 'one');
    const first = (await (await read(PRIYA, id)).json()).messages;
    expect(first.map((m: { text: string }) => m.text)).toEqual(['one']);
    later();
    await post(OWNER, id, 'two');
    const fresh = (await (await read(PRIYA, id, first[0].createdAt)).json()).messages;
    expect(fresh.map((m: { text: string }) => m.text)).toEqual(['two']);
    // Posting tidies messages older than 30 days
    expect(await repo.getCircleMessage(SOC, id, 'old')).toBeNull();
  });

  it('lets authors delete their own messages and circle admins delete any; no one else', async () => {
    const id = await liveCircleWith(PRIYA, ROHAN);
    const mine = (await (await post(PRIYA, id, 'mine')).json()).message.id;
    later();
    const rohans = (await (await post(ROHAN, id, 'rohan here')).json()).message.id;
    expect((await del(PRIYA, id, rohans)).status).toBe(403);
    expect((await del(PRIYA, id, mine)).status).toBe(200);
    expect((await del(OWNER, id, rohans)).status).toBe(200);
    expect((await repo.listAuditEvents(SOC)).some((e) => e.action === 'CIRCLE_MESSAGE_DELETED')).toBe(true);
    expect((await del(OWNER, id, 'missing')).status).toBe(404);
    // canDelete flags match
    later();
    await post(ROHAN, id, 'again');
    const asPriya = (await (await read(PRIYA, id)).json()).messages;
    expect(asPriya[0]).toMatchObject({ mine: false, canDelete: false });
    const asOwner = (await (await read(OWNER, id)).json()).messages;
    expect(asOwner[0]).toMatchObject({ canDelete: true });
  });

  it('counts unread messages until the member opens them', async () => {
    const id = await liveCircleWith(PRIYA);
    later();
    await post(OWNER, id, 'one');
    later();
    await post(OWNER, id, 'two');
    expect(await unread(PRIYA)).toEqual({ unread: { [id]: 2 }, total: 2 });
    expect((await unread(OWNER)).total).toBe(0); // your own messages are read
    await read(PRIYA, id);
    expect((await unread(PRIYA)).total).toBe(0);
  });

  it('stops posting in a closed circle', async () => {
    const id = await liveCircleWith(PRIYA);
    await circleAction(makeRequest('/api/v1/circles', { method: 'PATCH', body: { circleId: id, action: 'CLOSE' }, headers: h(OWNER) }));
    expect((await post(PRIYA, id, 'hello?')).status).toBe(409);
  });

  it('deletes a resident’s messages when they delete their account', async () => {
    const id = await liveCircleWith(PRIYA);
    await post(PRIYA, id, 'bye');
    const { deleteAccount } = await import('@/lib/services/account');
    await deleteAccount(repo, PRIYA);
    expect(await repo.listUserCircleMessages(SOC, id, PRIYA)).toEqual([]);
  });
});
