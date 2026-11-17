import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET, DELETE } from '../banners/route';
import { POST as requestSeat } from '../../rides/requests/route';
import { POST as createCircle, PATCH as circleAction } from '../../circles/route';
import * as Members from '../../circles/members/route';
import type { HomeBanner } from '@/lib/services/home-banners';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOC = 'soc-ggh-001';
const ADMIN = 'usr-admin-001';
const ASHUTOSH = 'usr-offerer-001'; // offers jrn-001
const PRIYA = 'usr-seeker-001';
const ROHAN = 'usr-offerer-002';
const h = (userId: string, society = SOC) => ({ 'x-dev-user-id': userId, 'x-society-id': society });

const banners = async (userId: string): Promise<HomeBanner[]> =>
  (await (await GET(makeRequest('/api/v1/home/banners', { headers: h(userId) }))).json()).banners;
const dismiss = (userId: string, id: string) =>
  DELETE(makeRequest(`/api/v1/home/banners?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: h(userId) }));
const kinds = (list: HomeBanner[]) => list.map((b) => b.kind);

describe('Home banners', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('requires sign-in in production', async () => {
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect((await GET(makeRequest('/api/v1/home/banners'))).status).toBe(401);
      expect((await dismiss(PRIYA, 'notice:x')).status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('shows seat requests to the offerer and the accepted seat to the rider', async () => {
    const res = await requestSeat(
      makeRequest('/api/v1/rides/requests', { method: 'POST', body: { journeyId: 'jrn-001', allowClash: true }, headers: h(PRIYA) })
    );
    expect(res.status).toBe(200);
    const requestId = (await res.json()).request.id;
    const forOfferer = (await banners(ASHUTOSH)).find((b) => b.kind === 'RIDE_REQUESTS');
    expect(forOfferer).toMatchObject({ title: '1 seat request to answer', href: '/rides/requests' });
    expect((await banners(PRIYA)).find((b) => b.kind === 'RIDE_REQUESTS')).toMatchObject({ title: '1 ride request awaiting a reply', href: '/rides/my-requests' });

    await repo.acceptRideRequest(SOC, requestId, ASHUTOSH);
    expect((await banners(ASHUTOSH)).some((b) => b.kind === 'RIDE_REQUESTS')).toBe(false);
    expect((await banners(PRIYA)).some((b) => b.kind === 'RIDE_REQUESTS')).toBe(false);
    const seat = (await banners(PRIYA)).find((b) => b.kind === 'SEAT_ACCEPTED');
    expect(seat?.title).toBe('Your seat is confirmed');
    expect(seat?.body).toContain('Ashutosh Dixit');
    expect(seat?.body).toContain('Manyata Tech Park');
    // Accepted seats show first
    expect(kinds(await banners(PRIYA))[0]).toBe('SEAT_ACCEPTED');
  });

  it('shows approvals only to admins with the permission', async () => {
    const adminKinds = (await banners(ADMIN)).filter((b) => b.kind === 'ADMIN_APPROVALS').map((b) => b.title);
    expect(adminKinds).toContain('2 residents waiting for approval');
    expect(adminKinds).toContain('1 class waiting for approval');
    expect((await banners(PRIYA)).some((b) => b.kind === 'ADMIN_APPROVALS')).toBe(false);

    const vikram = (await repo.getMembership(SOC, ADMIN))!;
    await repo.updateMembership(SOC, ADMIN, { permissions: { ...vikram.permissions!, canApproveResidents: false } });
    const after = (await banners(ADMIN)).map((b) => b.title);
    expect(after).not.toContain('2 residents waiting for approval');
    expect(after).toContain('1 class waiting for approval');
  });

  it('announces new circles, circle approvals and new classes for 3 days', async () => {
    const created = await createCircle(
      makeRequest('/api/v1/circles', {
        method: 'POST',
        headers: h(ASHUTOSH),
        body: { name: 'Morning Walkers', type: 'Community', description: 'Walk around the society at 6 am.', joinMode: 'APPROVAL' },
      })
    );
    const id = (await created.json()).circle.id;
    // Pending: only admins hear about it
    expect((await banners(ADMIN)).some((b) => b.title === '1 circle waiting for approval')).toBe(true);
    expect((await banners(PRIYA)).some((b) => b.kind === 'NEW_CIRCLE')).toBe(false);
    await circleAction(makeRequest('/api/v1/circles', { method: 'PATCH', body: { circleId: id, action: 'APPROVE' }, headers: h(ADMIN) }));
    expect((await banners(PRIYA)).find((b) => b.kind === 'NEW_CIRCLE')).toMatchObject({
      title: 'New circle: Morning Walkers',
      href: `/circles/${id}`,
    });
    expect((await banners(ASHUTOSH)).some((b) => b.kind === 'NEW_CIRCLE')).toBe(false); // their own

    await Members.POST(makeRequest('/api/v1/circles/members', { method: 'POST', body: { circleId: id }, headers: h(PRIYA) }));
    await Members.PATCH(
      makeRequest('/api/v1/circles/members', {
        method: 'PATCH',
        body: { circleId: id, userId: PRIYA, action: 'APPROVE' },
        headers: h(ASHUTOSH),
      })
    );
    const priya = await banners(PRIYA);
    expect(priya.find((b) => b.kind === 'CIRCLE_JOINED')?.title).toBe("You're in Morning Walkers");
    expect(priya.some((b) => b.kind === 'NEW_CIRCLE' && b.href === `/circles/${id}`)).toBe(false); // already in it

    // Seeded classes went live just now; Priya's own class is left out
    const classes = priya.filter((b) => b.kind === 'NEW_CLASS');
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every((b) => b.title.startsWith('New class: '))).toBe(true);
    const own = (await repo.listUserClasses(SOC, PRIYA)).map((c) => `new-class:${c.id}`);
    expect(classes.some((b) => own.includes(b.id))).toBe(false);

    // After 3 days they drop off
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString();
    const circle = (await repo.getCircle(SOC, id))!;
    await repo.saveCircle({ ...circle, approvedAt: old, createdAt: old });
    const m = (await repo.getCircleMember(SOC, id, PRIYA))!;
    await repo.saveCircleMember({ ...m, approvedAt: old });
    expect((await banners(ROHAN)).some((b) => b.kind === 'NEW_CIRCLE')).toBe(false);
    expect((await banners(PRIYA)).some((b) => b.kind === 'CIRCLE_JOINED')).toBe(false);
  });

  it('shows running notices and hides dismissed banners on every device', async () => {
    await repo.createAnnouncement({
      id: 'ann-water',
      societyId: SOC,
      title: 'Water off on Sunday',
      body: 'Tank cleaning 10 am to 2 pm.',
      createdBy: ADMIN,
      createdAt: new Date().toISOString(),
    });
    await repo.createAnnouncement({
      id: 'ann-old',
      societyId: SOC,
      title: 'Old notice',
      body: 'Expired.',
      createdBy: ADMIN,
      createdAt: new Date().toISOString(),
      expiresOn: '2020-01-01',
    });
    const before = await banners(PRIYA);
    expect(before.find((b) => b.id === 'notice:ann-water')).toMatchObject({ kind: 'NOTICE', noticeId: 'ann-water' });
    expect(before.some((b) => b.id === 'notice:ann-old')).toBe(false);

    expect((await dismiss(PRIYA, 'notice:ann-water')).status).toBe(200);
    // Stored on the server: any later request (any device) leaves it out
    expect((await banners(PRIYA)).some((b) => b.id === 'notice:ann-water')).toBe(false);
    const body = await (await GET(makeRequest('/api/v1/home/banners', { headers: h(PRIYA) }))).json();
    expect(body.dismissedNoticeIds).toEqual(['ann-water']);
    // Only Priya's Home changes
    expect((await banners(ROHAN)).some((b) => b.id === 'notice:ann-water')).toBe(true);
    expect((await dismiss(PRIYA, '<script>')).status).toBe(400);
  });

  it('brings a dismissed count banner back when something new arrives', async () => {
    const first = (await banners(ADMIN)).find((b) => b.title.includes('residents waiting'))!;
    await dismiss(ADMIN, first.id);
    expect((await banners(ADMIN)).some((b) => b.title.includes('residents waiting'))).toBe(false);
    // A new resident signs up
    const rahul = (await repo.getMembership(SOC, 'usr-pending-001'))!;
    await repo.createUser({
      ...(await repo.getUserById('usr-pending-001'))!,
      id: 'usr-new-9',
      mobile: '+919999999999',
      firebaseUid: undefined,
    });
    await repo.createMembership({ ...rahul, userId: 'usr-new-9', createdAt: new Date(Date.now() + 1000).toISOString() });
    expect((await banners(ADMIN)).find((b) => b.title.includes('residents waiting'))?.title).toBe('3 residents waiting for approval');
  });

  it("never mixes in another society's items", async () => {
    await repo.createAnnouncement({
      id: 'ann-pfr',
      societyId: 'soc-pfr-002',
      title: 'PFR only',
      body: 'x',
      createdBy: 'x',
      createdAt: new Date().toISOString(),
    });
    expect((await banners(PRIYA)).some((b) => b.id === 'notice:ann-pfr')).toBe(false);
    await dismiss(PRIYA, 'notice:ann-x');
    expect(await repo.getBannerDismissals('soc-pfr-002', PRIYA)).toEqual([]);
  });
});
