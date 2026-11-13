import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { GET as exportData } from '../export/route';
import { POST as leave } from '../leave/route';
import { DELETE as deleteAccount } from '../route';
import { POST as removeResidents } from '../../admin/residents/remove/route';
import { GET as me } from '../../auth/me/route';

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });
const OFFERER = 'usr-offerer-001';
const SEEKER = 'usr-seeker-001';

async function seekerAcceptedOnJrn001(repo: MockDynamoRepository) {
  const now = new Date().toISOString();
  await repo.createRideRequest({
    id: 'req-acc', societyId: SOCIETY, journeyId: 'jrn-001', seekerUserId: SEEKER, requestedSeats: 1,
    pickupName: 'Gate', pickupLat: 0, pickupLng: 0, dropoffName: 'Park', dropoffLat: 0, dropoffLng: 0,
    calculatedDetourMinutes: 0, status: 'REQUESTED', createdAt: now, updatedAt: now,
  });
  await repo.acceptRideRequest(SOCIETY, 'req-acc', OFFERER);
}

describe('your data', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('downloads everything about the signed-in resident only', async () => {
    const res = await exportData(makeRequest('/api/v1/account/export', { headers: as(OFFERER) }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const data = JSON.parse(await res.text());
    expect(data.profile.id).toBe(OFFERER);
    expect(data.societies[0].society.name).toBe('Mahaveer Ranches');
    expect(data.societies[0].ridesOffered.every((r: { offererUserId: string }) => r.offererUserId === OFFERER)).toBe(true);
    expect(JSON.stringify(data.societies[0].ratingsReceived)).not.toContain('privateNote');
  });

  it('leaving cancels upcoming rides and tells the riders', async () => {
    await seekerAcceptedOnJrn001(repo);
    const res = await leave(makeRequest('/api/v1/account/leave', { method: 'POST', headers: as(OFFERER) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ridesCancelled).toBeGreaterThan(0);
    expect((await repo.getRideOccurrence(SOCIETY, 'jrn-001'))!.status).toBe('CANCELLED');
    expect((await repo.getMembership(SOCIETY, OFFERER))!.status).toBe('DEACTIVATED');
    const notes = await repo.listUserNotifications(SOCIETY, SEEKER);
    expect(notes.some((n) => n.type === 'RIDE_CANCELLED')).toBe(true);
  });

  it('the only society admin cannot leave or delete', async () => {
    expect((await leave(makeRequest('/api/v1/account/leave', { method: 'POST', headers: as('usr-admin-001') }))).status).toBe(409);
  });

  it('deleting erases personal details and the account can no longer be used', async () => {
    const del = (body: unknown) =>
      deleteAccount(makeRequest('/api/v1/account', { method: 'DELETE', body, headers: as(SEEKER) }));
    expect((await del({ confirm: 'yes' })).status).toBe(400);
    await seekerAcceptedOnJrn001(repo);

    expect((await del({ confirm: 'DELETE' })).status).toBe(200);
    const user = (await repo.getUserById(SEEKER))!;
    expect(user).toMatchObject({ fullName: 'Former resident', mobile: '', email: '' });
    expect(user.deletedAt).toBeTruthy();
    expect((await repo.getMembership(SOCIETY, SEEKER))!.flatNumber).toBe('Removed');
    // Their seat was released
    expect((await repo.getRideRequest(SOCIETY, 'req-acc'))!.status).not.toBe('ACCEPTED');
    // Signed-in calls no longer work
    expect((await me(makeRequest('/api/v1/auth/me', { headers: as(SEEKER) }))).status).toBe(401);
  });
});

describe('admins removing residents who moved out', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });
  const remove = (userId: string, targetUserIds: string[]) =>
    removeResidents(makeRequest('/api/v1/admin/residents/remove', { method: 'POST', body: { targetUserIds }, headers: as(userId) }));

  it('needs the approve-residents permission', async () => {
    expect((await remove(SEEKER, [OFFERER])).status).toBe(403);
  });

  it('removes residents, skips admins and self', async () => {
    expect((await remove('usr-admin-001', ['usr-admin-001'])).status).toBe(400);
    const res = await (await remove('usr-admin-001', [OFFERER, 'usr-app-admin-001', 'usr-nobody'])).json();
    expect(res.removed).toEqual([OFFERER]);
    expect(res.skipped.sort()).toEqual(['usr-app-admin-001', 'usr-nobody']);
    expect((await repo.getMembership(SOCIETY, OFFERER))!.status).toBe('DEACTIVATED');
  });
});

describe('what /auth/me reveals about the society', () => {
  beforeEach(() => {
    resetRepository();
  });
  const society = async (userId: string) =>
    (await (await me(makeRequest('/api/v1/auth/me', { headers: as(userId) }))).json()).society;

  it('shows the invite code only to admins and limits pending members to onboarding settings', async () => {
    expect((await society('usr-admin-001')).code).toBe('MR2024');
    const resident = await society(SEEKER);
    expect(resident.code).toBeUndefined();
    expect(resident.settings.pickupPoints).toBeDefined();
    const pending = await society('usr-pending-001');
    expect(pending.code).toBeUndefined();
    expect(pending.settings.pickupPoints).toBeUndefined();
    expect(pending.settings.emergencyNumber).toBeUndefined();
  });
});

describe('profile photos', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('saves a small photo, rejects other files, and hides it from the public ride list', async () => {
    const { PUT: updateMe } = await import('../../auth/me/route');
    const { GET: listRides } = await import('../../rides/route');
    const put = (profilePhotoUrl: string) =>
      updateMe(makeRequest('/api/v1/auth/me', { method: 'PUT', body: { profilePhotoUrl }, headers: as(OFFERER) }));

    expect((await put('data:text/html;base64,PHNjcmlwdD4=')).status).toBe(400);
    expect((await put(`data:image/jpeg;base64,${'A'.repeat(200_000)}`)).status).toBe(400);
    expect((await put('data:image/jpeg;base64,QUJD')).status).toBe(200);
    expect((await repo.getUserById(OFFERER))!.profilePhotoUrl).toBe('data:image/jpeg;base64,QUJD');

    const rides = (await (await listRides(makeRequest('/api/v1/rides?date=ALL', { headers: as(SEEKER) }))).json()).rides;
    const offerers = rides.filter((r: { offerer: { id: string } }) => r.offerer.id === OFFERER);
    expect(offerers.length).toBeGreaterThan(0);
    expect(offerers.every((r: { offerer: { photoUrl?: string } }) => !r.offerer.photoUrl)).toBe(true);

    expect((await put('')).status).toBe(200);
    expect((await repo.getUserById(OFFERER))!.profilePhotoUrl).toBeUndefined();
  });
});
