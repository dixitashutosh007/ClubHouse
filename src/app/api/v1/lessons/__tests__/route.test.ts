import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, PUT, PATCH, DELETE } from '../route';
import { GET as getCategories, PUT as putCategories } from '../categories/route';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });

// lsn-001: ACTIVE, owned by usr-seeker-001. lsn-003: PENDING_APPROVAL, owned by usr-offerer-003.
const call = (
  handler: typeof GET,
  method: string,
  userId: string,
  body?: unknown,
  path = '/api/v1/lessons'
) => handler(makeRequest(path, { method, body, headers: as(userId) }));

const validClass = {
  classType: 'REGULAR',
  subject: 'Yoga',
  description: 'Morning hatha yoga in the clubhouse for all levels.',
  feeType: 'PER_MONTH',
  feeAmount: 1500,
  contactName: 'Priya',
  contactPhone: '+91 98765 43210',
  locationType: 'CLUBHOUSE',
  noAgeLimit: true,
};

describe('/api/v1/lessons', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
  });

  it('requires an active resident', async () => {
    expect((await call(GET, 'GET', 'usr-pending-001')).status).toBe(403);
    expect((await call(POST, 'POST', 'usr-pending-001', validClass)).status).toBe(403);
  });

  it('shows residents only active classes, and pending ones only to class approvers', async () => {
    const list = await (await call(GET, 'GET', 'usr-offerer-001')).json();
    expect(list.classes.every((c: { status: string }) => c.status === 'ACTIVE')).toBe(true);

    expect((await call(GET, 'GET', 'usr-offerer-001', undefined, '/api/v1/lessons?pending=true')).status).toBe(403);
    const pending = await (await call(GET, 'GET', 'usr-admin-001', undefined, '/api/v1/lessons?pending=true')).json();
    expect(pending.classes.map((c: { id: string }) => c.id)).toContain('lsn-003');
  });

  it('creates new classes as pending review, with a server-generated ID', async () => {
    const res = await call(POST, 'POST', 'usr-offerer-001', { ...validClass, id: 'lsn-chosen', status: 'ACTIVE' });
    expect(res.status).toBe(200);
    const { listing } = await res.json();
    expect(listing.status).toBe('PENDING_APPROVAL');
    expect(listing.id).not.toBe('lsn-chosen');
    expect(listing.createdByUserId).toBe('usr-offerer-001');
    expect(listing.societyId).toBe(SOCIETY);
  });

  it('needs a date for one-time and festive classes, which then expire after it', async () => {
    const oneOff = { ...validClass, classType: 'ONE_TIME', feeType: 'PER_SESSION', feeAmount: 600 };
    expect((await call(POST, 'POST', 'usr-offerer-001', oneOff)).status).toBe(400);
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...oneOff, classDate: '2020-01-01' })).status).toBe(400);

    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const { listing } = await (await call(POST, 'POST', 'usr-offerer-001', { ...oneOff, classDate: day })).json();
    expect(listing).toMatchObject({ classDate: day, expiresOn: day });

    // A regular class keeps no date
    const regular = await (await call(POST, 'POST', 'usr-offerer-001', { ...validClass, classDate: day })).json();
    expect(regular.listing.classDate).toBeUndefined();
  });

  it('validates the class body and photo', async () => {
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...validClass, contactPhone: '12345' })).status).toBe(400);
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...validClass, feeType: 'BITCOIN' })).status).toBe(400);
    const notAnImage = 'data:text/html;base64,PHNjcmlwdD4=';
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...validClass, photoUrl: notAnImage })).status).toBe(400);
    const longDescription = Array.from({ length: 51 }, () => 'word').join(' ');
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...validClass, description: longDescription })).status).toBe(400);
    const tooBig = `data:image/jpeg;base64,${'A'.repeat(700_000)}`;
    expect((await call(POST, 'POST', 'usr-offerer-001', { ...validClass, photoUrl: tooBig })).status).toBe(400);
  });

  it('lets only the owner or a class approver edit or delete a class', async () => {
    expect((await call(PUT, 'PUT', 'usr-offerer-001', { listingId: 'lsn-001', subject: 'Hacked' })).status).toBe(403);
    expect((await call(DELETE, 'DELETE', 'usr-offerer-001', undefined, '/api/v1/lessons?id=lsn-001')).status).toBe(403);
    expect((await call(DELETE, 'DELETE', 'usr-seeker-001', undefined, '/api/v1/lessons?id=lsn-001')).status).toBe(200);
    expect(await repo.getClassListing(SOCIETY, 'lsn-001')).toBeNull();
  });

  it('sends a live class back for review when its owner changes what it says', async () => {
    const res = await call(PUT, 'PUT', 'usr-seeker-001', { listingId: 'lsn-001', description: 'Now with a brand new syllabus!' });
    expect(res.status).toBe(200);
    expect((await res.json()).listing.status).toBe('PENDING_APPROVAL');
  });

  it('keeps approval actions for class approvers', async () => {
    // The owner cannot approve their own class
    expect((await call(PATCH, 'PATCH', 'usr-offerer-003', { listingId: 'lsn-003', action: 'APPROVE' })).status).toBe(403);

    // A society admin whose class-approval permission is switched off cannot either
    await repo.updateMembership(SOCIETY, 'usr-admin-001', { permissions: { canApproveClasses: false } });
    expect((await call(PATCH, 'PATCH', 'usr-admin-001', { listingId: 'lsn-003', action: 'APPROVE' })).status).toBe(403);

    const ok = await call(PATCH, 'PATCH', 'usr-app-admin-001', { listingId: 'lsn-003', action: 'APPROVE' });
    expect(ok.status).toBe(200);
    expect((await ok.json()).listing.status).toBe('ACTIVE');
  });

  it('rejects status changes that do not apply to the current status', async () => {
    // lsn-003 is pending, so it cannot be marked full
    expect((await call(PATCH, 'PATCH', 'usr-offerer-003', { listingId: 'lsn-003', action: 'MARK_FULL' })).status).toBe(409);
  });

  it('sends a class its owner reactivates back for review', async () => {
    expect((await call(PATCH, 'PATCH', 'usr-seeker-001', { listingId: 'lsn-001', action: 'DEACTIVATE' })).status).toBe(200);
    const res = await call(PATCH, 'PATCH', 'usr-seeker-001', { listingId: 'lsn-001', action: 'REACTIVATE' });
    expect((await res.json()).listing.status).toBe('PENDING_APPROVAL');
  });

  it('lets only settings admins change class subjects', async () => {
    const path = '/api/v1/lessons/categories';
    expect((await call(getCategories, 'GET', 'usr-offerer-001', undefined, path)).status).toBe(200);
    expect((await call(putCategories, 'PUT', 'usr-offerer-001', { categories: ['Chess'] }, path)).status).toBe(403);
    const res = await call(putCategories, 'PUT', 'usr-admin-001', { categories: ['Chess', 'Chess', 'Tabla'] }, path);
    expect((await res.json()).categories).toEqual(['Chess', 'Tabla']);
  });
});

describe('/api/v1/lessons (production)', () => {
  beforeEach(() => {
    resetRepository();
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('rejects signed-out requests, ignoring the dev user header', async () => {
    expect((await GET(makeRequest('/api/v1/lessons'))).status).toBe(401);
    expect((await GET(makeRequest('/api/v1/lessons', { headers: as('usr-admin-001') }))).status).toBe(401);
    expect((await POST(makeRequest('/api/v1/lessons', { method: 'POST', body: validClass }))).status).toBe(401);
  });
});
