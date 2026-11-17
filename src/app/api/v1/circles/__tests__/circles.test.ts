import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET, POST, PUT, PATCH } from '../route';
import * as Members from '../members/route';
import * as Messages from '../messages/route';
import { POST as REPORT } from '../../moderation/reports/route';
import { leaveAllCircles } from '@/lib/services/circles';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOC = 'soc-ggh-001';
const ADMIN = 'usr-admin-001'; // society admin (male)
const OWNER = 'usr-offerer-001'; // resident (male)
const PRIYA = 'usr-seeker-001'; // resident (female)
const ROHAN = 'usr-offerer-002'; // resident (male)
const ANANYA = 'usr-offerer-003'; // resident (female)

const h = (userId: string, society = SOC) => ({ 'x-dev-user-id': userId, 'x-society-id': society });
const json = async (res: Response) => ({ status: res.status, body: await res.json() });

const base = {
  name: 'Sunday Cricket',
  type: 'Sports',
  subType: 'Cricket',
  description: 'Tennis ball cricket every Sunday morning on the society ground.',
  whatsappLink: 'https://chat.whatsapp.com/AbCdEfGhIj1234',
  place: 'Society ground',
  schedule: 'Sundays 7 am',
};

const create = (userId: string, body: object = base) => POST(makeRequest('/api/v1/circles', { method: 'POST', body, headers: h(userId) }));
const get = (userId: string, query = '') => GET(makeRequest(`/api/v1/circles${query}`, { headers: h(userId) }));
const act = (userId: string, circleId: string, action: string, reason?: string) =>
  PATCH(makeRequest('/api/v1/circles', { method: 'PATCH', body: { circleId, action, reason }, headers: h(userId) }));
const edit = (userId: string, circleId: string, changes: object) =>
  PUT(makeRequest('/api/v1/circles', { method: 'PUT', body: { ...base, ...changes, circleId }, headers: h(userId) }));
const join = (userId: string, circleId: string) =>
  Members.POST(makeRequest('/api/v1/circles/members', { method: 'POST', body: { circleId }, headers: h(userId) }));
const leave = (userId: string, circleId: string) =>
  Members.DELETE(makeRequest(`/api/v1/circles/members?circleId=${circleId}`, { method: 'DELETE', headers: h(userId) }));
const member = (actor: string, circleId: string, userId: string, action: string, note?: string) =>
  Members.PATCH(makeRequest('/api/v1/circles/members', { method: 'PATCH', body: { circleId, userId, action, note }, headers: h(actor) }));
const detail = async (userId: string, id: string) => json(await get(userId, `?id=${id}`));

/** A live circle owned by OWNER */
async function liveCircle(body: object = base): Promise<string> {
  const { body: created } = await json(await create(OWNER, body));
  expect((await act(ADMIN, created.circle.id, 'APPROVE')).status).toBe(200);
  return created.circle.id;
}

describe('circles', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('requires sign-in in production, ignoring the dev user header', async () => {
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect((await GET(makeRequest('/api/v1/circles'))).status).toBe(401);
      expect((await get(PRIYA)).status).toBe(401);
      expect((await create(PRIYA)).status).toBe(401);
      expect((await join(PRIYA, 'x')).status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('checks input', async () => {
    expect((await create(OWNER, { ...base, type: 'Knitting' })).status).toBe(400);
    expect((await create(OWNER, { ...base, subType: 'Curling' })).status).toBe(400);
    expect((await create(OWNER, { ...base, subType: 'Curling', isCustomSubType: true })).status).toBe(200);
    expect((await create(OWNER, { ...base, whatsappLink: 'https://evil.example/join' })).status).toBe(400);
    expect((await create(OWNER, { ...base, description: 'word '.repeat(51) })).status).toBe(400);
  });

  it("waits for a society admin when a resident starts it; an admin's is live at once", async () => {
    const { body } = await json(await create(OWNER));
    expect(body.circle.status).toBe('PENDING_APPROVAL');
    const id = body.circle.id;
    // Not listed and not visible to others yet; the creator and admins can see it
    expect((await json(await get(PRIYA))).body.circles).toHaveLength(0);
    expect((await get(PRIYA, `?id=${id}`)).status).toBe(404);
    expect((await get(OWNER, `?id=${id}`)).status).toBe(200);
    expect((await json(await get(ADMIN, '?view=pending'))).body.circles.map((c: { id: string }) => c.id)).toContain(id);
    expect((await get(PRIYA, '?view=pending')).status).toBe(403);
    // Only society admins approve
    expect((await act(OWNER, id, 'APPROVE')).status).toBe(403);
    expect((await act(ADMIN, id, 'APPROVE')).status).toBe(200);
    expect((await json(await get(PRIYA))).body.circles.map((c: { id: string }) => c.id)).toEqual([id]);
    expect((await repo.listUserNotifications(SOC, OWNER)).some((n) => n.title.includes('is live'))).toBe(true);

    const admins = await json(await create(ADMIN, { ...base, name: 'Admin Yoga', type: 'Yoga', subType: undefined }));
    expect(admins.body.circle.status).toBe('ACTIVE');
  });

  it('keeps residents to the society limit (editable in settings)', async () => {
    await repo.updateSocietySettings(SOC, { maxCirclesPerResident: 2 });
    expect((await create(OWNER, { ...base, name: 'One' })).status).toBe(200);
    expect((await create(OWNER, { ...base, name: 'Two' })).status).toBe(200);
    const third = await json(await create(OWNER, { ...base, name: 'Three' }));
    expect(third.status).toBe(409);
    expect(third.body.error).toContain('up to 2');
  });

  it('shows the link, admins (with numbers) and member names only to approved members', async () => {
    const id = await liveCircle();
    const outsider = (await detail(PRIYA, id)).body.circle;
    expect(outsider.whatsappLink).toBeUndefined();
    expect(outsider.members).toBeUndefined();
    expect(outsider.admins).toBeUndefined();
    expect(outsider.memberCount).toBe(1);

    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    const inside = (await detail(PRIYA, id)).body.circle;
    expect(inside.whatsappLink).toBe(base.whatsappLink);
    expect(inside.members.map((m: { name: string }) => m.name).sort()).toEqual(['Ashutosh Dixit', 'Priya Sharma']);
    expect(inside.members[0]).not.toHaveProperty('phone');
    expect(inside.admins[0]).toMatchObject({ role: 'OWNER', name: 'Ashutosh Dixit' });
    expect(inside.admins[0].phone).toBeTruthy();
    expect(inside.memberCount).toBe(2);
  });

  it('handles requests: approve, reject with a 3-day wait, and open circles', async () => {
    const id = await liveCircle();
    expect((await json(await join(PRIYA, id))).body.status).toBe('REQUESTED');
    expect((await join(PRIYA, id)).status).toBe(409);
    expect((await repo.listUserNotifications(SOC, OWNER)).some((n) => n.title.includes('New request'))).toBe(true);
    // Only circle admins see and answer requests
    expect((await Members.GET(makeRequest(`/api/v1/circles/members?circleId=${id}`, { headers: h(ROHAN) }))).status).toBe(403);
    expect((await member(ROHAN, id, PRIYA, 'APPROVE')).status).toBe(403);
    expect((await member(OWNER, id, PRIYA, 'REJECT', 'Members only from Tower B')).status).toBe(200);
    expect((await detail(PRIYA, id)).body.circle.viewer).toMatchObject({ status: 'REJECTED', rejectionNote: 'Members only from Tower B' });
    expect((await join(PRIYA, id)).status).toBe(429);
    // After 3 days she can ask again
    const m = (await repo.getCircleMember(SOC, id, PRIYA))!;
    await repo.saveCircleMember({ ...m, rejectedAt: new Date(Date.now() - 4 * 86_400_000).toISOString() });
    expect((await join(PRIYA, id)).status).toBe(200);

    const open = await liveCircle({ ...base, name: 'Open Chess', subType: 'Chess', joinMode: 'OPEN' });
    expect((await json(await join(ROHAN, open))).body.status).toBe('APPROVED');
    expect((await detail(ROHAN, open)).body.circle.whatsappLink).toBe(base.whatsappLink);
  });

  it('honours women-only and men-only circles', async () => {
    const id = await liveCircle({ ...base, name: 'Women Yoga', type: 'Yoga', subType: undefined, audience: 'WOMEN' });
    expect((await join(ROHAN, id)).status).toBe(403);
    expect((await join(ANANYA, id)).status).toBe(200);
  });

  it('lets members leave; the owner must hand over first; admins remove people', async () => {
    const id = await liveCircle();
    for (const u of [PRIYA, ROHAN]) {
      await join(u, id);
      await member(OWNER, id, u, 'APPROVE');
    }
    expect((await leave(OWNER, id)).status).toBe(409);
    expect((await leave(PRIYA, id)).status).toBe(200);
    expect((await detail(OWNER, id)).body.circle.memberCount).toBe(2);
    // Co-admins can remove members but not other co-admins
    await join(ANANYA, id);
    await member(OWNER, id, ANANYA, 'APPROVE');
    expect((await member(ROHAN, id, ANANYA, 'MAKE_CO_ADMIN')).status).toBe(403);
    expect((await member(OWNER, id, ROHAN, 'MAKE_CO_ADMIN')).status).toBe(200);
    expect((await member(ROHAN, id, ANANYA, 'REMOVE')).status).toBe(200);
    expect((await repo.listUserNotifications(SOC, ANANYA)).some((n) => n.title.includes('removed'))).toBe(true);
    // Removed people can ask again (no blocking)
    expect((await join(ANANYA, id)).status).toBe(200);
    expect((await member(ROHAN, id, OWNER, 'REMOVE')).status).toBe(409);
  });

  it('transfers ownership and lets the old owner leave', async () => {
    const id = await liveCircle();
    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    expect((await member(PRIYA, id, PRIYA, 'TRANSFER_OWNERSHIP')).status).toBe(403);
    expect((await member(OWNER, id, PRIYA, 'TRANSFER_OWNERSHIP')).status).toBe(200);
    const admins = (await detail(PRIYA, id)).body.circle.admins;
    expect(admins.map((a: { name: string; role: string }) => `${a.role}:${a.name}`)).toEqual([
      'OWNER:Priya Sharma',
      'CO_ADMIN:Ashutosh Dixit',
    ]);
    expect((await leave(OWNER, id)).status).toBe(200);
  });

  it('keeps the approved name and links live until a change is approved, and tells the editor', async () => {
    const id = await liveCircle();
    expect((await edit(PRIYA, id, { name: 'Hijacked' })).status).toBe(403);
    const res = await json(await edit(OWNER, id, { name: 'Sunday Cricket Club', place: 'Box cricket arena' }));
    expect(res.body.pendingReview).toBe(true);
    const live = (await detail(PRIYA, id)).body.circle;
    expect(live.name).toBe('Sunday Cricket'); // old name stays
    expect(live.place).toBe('Box cricket arena'); // place changes at once
    expect(live.pendingChange).toBeUndefined(); // only managers see the pending change
    expect((await detail(OWNER, id)).body.circle.pendingChange.name).toBe('Sunday Cricket Club');
    expect((await act(ADMIN, id, 'APPROVE_CHANGE')).status).toBe(200);
    expect((await detail(PRIYA, id)).body.circle.name).toBe('Sunday Cricket Club');
    expect((await repo.listUserNotifications(SOC, OWNER)).some((n) => n.title.includes('change to Sunday Cricket Club is live'))).toBe(
      true
    );
    // A rejected change leaves the circle as it was
    await edit(OWNER, id, { name: 'Bad Name' });
    await act(ADMIN, id, 'REJECT_CHANGE', 'Please keep the old name');
    expect((await detail(PRIYA, id)).body.circle.name).toBe('Sunday Cricket Club');
    // Society admins edit directly
    expect((await json(await edit(ADMIN, id, { name: 'Cricket' }))).body.pendingReview).toBe(false);
  });

  it('closes a circle (owner or society admin) and tells members', async () => {
    const id = await liveCircle();
    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    await member(OWNER, id, PRIYA, 'MAKE_CO_ADMIN');
    expect((await act(PRIYA, id, 'CLOSE')).status).toBe(403);
    expect((await act(OWNER, id, 'CLOSE')).status).toBe(200);
    expect((await json(await get(ROHAN))).body.circles).toHaveLength(0);
    expect((await repo.listUserNotifications(SOC, PRIYA)).some((n) => n.title.includes('was closed'))).toBe(true);
  });

  it("never shows or changes another society's circle", async () => {
    await repo.createCircle({
      id: 'cir-other',
      societyId: 'soc-pfr-002',
      createdByUserId: 'someone',
      ownerUserId: 'someone',
      name: 'Other society circle',
      type: 'Sports',
      description: 'Not yours to see at all.',
      audience: 'ALL',
      joinMode: 'OPEN',
      status: 'ACTIVE',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect((await get(PRIYA, '?id=cir-other')).status).toBe(404);
    expect((await json(await get(ADMIN, '?view=all'))).body.circles.some((c: { id: string }) => c.id === 'cir-other')).toBe(false);
    expect((await join(PRIYA, 'cir-other')).status).toBe(404);
    expect((await act(ADMIN, 'cir-other', 'CLOSE')).status).toBe(404);
    // Naming the other society does not help: Priya is not a member there
    expect((await GET(makeRequest('/api/v1/circles?id=cir-other', { headers: h(PRIYA, 'soc-pfr-002') }))).status).toBe(404);
  });

  it('hands a circle over when its owner leaves the society', async () => {
    const id = await liveCircle();
    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    await member(OWNER, id, PRIYA, 'MAKE_CO_ADMIN');
    await leaveAllCircles(repo, SOC, OWNER);
    expect((await repo.getCircle(SOC, id))?.ownerUserId).toBe(PRIYA);
    expect(await repo.getCircleMember(SOC, id, OWNER)).toBeNull();

    // No co-admin: the society admins are asked to choose an owner
    const lone = await liveCircle({ ...base, name: 'Lonely' });
    await leaveAllCircles(repo, SOC, OWNER);
    expect((await repo.getCircle(SOC, lone))?.ownerUserId).toBeUndefined();
    expect((await repo.listUserNotifications(SOC, ADMIN)).some((n) => n.title.includes('needs a new owner'))).toBe(true);
    expect((await detail(ADMIN, lone)).body.circle.hasNoOwner).toBe(true);
  });

  it('lets residents report a circle (about its owner)', async () => {
    const id = await liveCircle();
    const report = (body: object) => REPORT(makeRequest('/api/v1/moderation/reports', { method: 'POST', body, headers: h(PRIYA) }));
    const ok = { reportedUserId: OWNER, circleId: id, category: 'OTHER', description: 'Misleading circle details' };
    expect((await report({ ...ok, reportedUserId: ROHAN })).status).toBe(404);
    expect((await report(ok)).status).toBe(200);
  });
});

describe('circles when a resident leaves the society', () => {
  it('removes them from circles and hands theirs over', async () => {
    const repo = resetRepository();
    const { leaveSociety } = await import('@/lib/services/account');
    const { body } = await json(await create(OWNER));
    const id = body.circle.id;
    await act(ADMIN, id, 'APPROVE');
    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    await member(OWNER, id, PRIYA, 'MAKE_CO_ADMIN');
    await leaveSociety(repo, SOC, OWNER, { actorUserId: OWNER, reason: 'MOVED_OUT' });
    const circle = await repo.getCircle(SOC, id);
    expect(circle?.ownerUserId).toBe(PRIYA);
    expect(circle?.memberCount).toBe(1);
  });
});

describe('circle settings', () => {
  it('lets settings admins edit circle types and the limit; residents cannot', async () => {
    const repo = resetRepository();
    const { PUT: saveSettings } = await import('../../admin/settings/route');
    const put = (userId: string, body: object) =>
      saveSettings(makeRequest('/api/v1/admin/settings', { method: 'PUT', body, headers: h(userId) }));
    const body = {
      circleTypes: [
        { name: 'Sports', subTypes: ['Squash', 'squash', 'Padel'] },
        { name: 'sports', subTypes: [] },
        { name: 'Book club', subTypes: [] },
      ],
      maxCirclesPerResident: 3,
    };
    expect((await put(PRIYA, body)).status).toBe(403);
    expect((await put(ADMIN, { ...body, maxCirclesPerResident: 0 })).status).toBe(400);
    expect((await put(ADMIN, body)).status).toBe(200);
    const settings = (await repo.getSocietyById(SOC))!.settings;
    expect(settings.circleTypes).toEqual([
      { name: 'Sports', subTypes: ['Squash', 'Padel'] },
      { name: 'Book club', subTypes: [] },
    ]);
    expect(settings.maxCirclesPerResident).toBe(3);
    // A removed type can no longer be chosen, but circles already using it keep it
    expect((await create(OWNER, { ...base, type: 'Yoga', subType: undefined })).status).toBe(400);
    expect((await create(OWNER, { ...base, type: 'Book club', subType: undefined })).status).toBe(200);
  });
});

describe('circle decisions (owner feedback)', () => {
  it('files a circle report against the circle and its owner without the screen naming the owner', async () => {
    const repo = resetRepository();
    const { body } = await json(await create(OWNER));
    await act(ADMIN, body.circle.id, 'APPROVE');
    expect((await detail(PRIYA, body.circle.id)).body.circle).not.toHaveProperty('ownerUserId');
    const res = await REPORT(
      makeRequest('/api/v1/moderation/reports', { method: 'POST', body: { circleId: body.circle.id, category: 'OTHER', description: 'Misleading details' }, headers: h(PRIYA) })
    );
    expect(res.status).toBe(200);
    const [report] = await repo.listModerationReports(SOC);
    expect(report).toMatchObject({ circleId: body.circle.id, reportedUserId: OWNER });
    // The owner cannot report their own circle
    expect(
      (await REPORT(makeRequest('/api/v1/moderation/reports', { method: 'POST', body: { circleId: body.circle.id, category: 'OTHER', description: 'x x x x x' }, headers: h(OWNER) }))).status
    ).toBe(400);
  });

  it('keeps society admins who have not joined out of what happens inside', async () => {
    resetRepository();
    const { body } = await json(await create(OWNER));
    const id = body.circle.id;
    // While approving a new circle they can check its link
    expect((await detail(ADMIN, id)).body.circle.whatsappLink).toBe(base.whatsappLink);
    await act(ADMIN, id, 'APPROVE');
    const live = (await detail(ADMIN, id)).body.circle;
    expect(live.whatsappLink).toBeUndefined();
    expect(live.admins).toBeUndefined();
    expect(live.members).toBeUndefined();
    expect(live.viewer.canManage).toBe(true); // full control stays
  });

  it('archives a closed circle 60 days after closing', async () => {
    const repo = resetRepository();
    const id = await liveCircle();
    await join(PRIYA, id);
    await member(OWNER, id, PRIYA, 'APPROVE');
    await act(OWNER, id, 'CLOSE');
    // Closed but not yet archived: members still open it and read messages
    expect((await get(PRIYA, `?id=${id}`)).status).toBe(200);
    const read = () => Messages.GET(makeRequest(`/api/v1/circles/messages?circleId=${id}`, { headers: h(PRIYA) }));
    expect((await read()).status).toBe(200);

    const c = (await repo.getCircle(SOC, id))!;
    await repo.saveCircle({ ...c, closedAt: new Date(Date.now() - 61 * 86_400_000).toISOString() });
    expect((await get(PRIYA, `?id=${id}`)).status).toBe(404);
    expect((await read()).status).toBe(404);
    expect((await json(await get(PRIYA, '?view=mine'))).body.circles.some((x: { id: string }) => x.id === id)).toBe(false);
    const forAdmin = (await detail(ADMIN, id)).body.circle;
    expect(forAdmin.archived).toBe(true);
  });

  it('has no cap on how many circles a resident asks to join', async () => {
    resetRepository();
    for (let i = 0; i < 22; i++) {
      // Society admins' circles are live at once and have no limit
      const id = (await json(await create(ADMIN, { ...base, name: `Circle number ${i}` }))).body.circle.id;
      expect((await join(PRIYA, id)).status).toBe(200);
    }
  });
});

describe('society admins as residents', () => {
  it('can join a circle like anyone else, and then see inside it', async () => {
    resetRepository();
    const id = await liveCircle();
    expect((await detail(ADMIN, id)).body.circle.viewer).toMatchObject({ status: 'NONE', canManage: true });
    expect((await json(await join(ADMIN, id))).body.status).toBe('REQUESTED');
    await member(OWNER, id, ADMIN, 'APPROVE');
    const inside = (await detail(ADMIN, id)).body.circle;
    expect(inside.whatsappLink).toBe(base.whatsappLink);
    expect(inside.members.map((m: { name: string }) => m.name)).toContain('Vikram Mehta');
  });
});
