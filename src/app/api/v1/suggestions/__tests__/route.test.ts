import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, PATCH } from '../route';
import { PUT as putSettings } from '../../admin/settings/route';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetRateLimits } from '@/lib/rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';

const as = (userId: string, societyId = 'soc-ggh-001') => ({ 'x-dev-user-id': userId, 'x-society-id': societyId });
const send = (handler: typeof GET, method: string, userId: string, body?: unknown, societyId?: string) =>
  handler(makeRequest('/api/v1/suggestions', { method, body, headers: as(userId, societyId) }));

describe('/api/v1/suggestions', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = resetRepository();
    resetRateLimits();
  });

  it('lets active residents send a suggestion, but not members awaiting approval', async () => {
    const body = { module: 'RIDESHARE', kind: 'SUGGESTION', message: 'Please add Tower C lobby as a pick-up point' };
    expect((await send(POST, 'POST', 'usr-pending-001', body)).status).toBe(403);
    expect((await send(POST, 'POST', 'usr-seeker-001', body)).status).toBe(200);
    expect((await send(POST, 'POST', 'usr-seeker-001', { ...body, module: 'PARKING' })).status).toBe(400);
    expect((await send(POST, 'POST', 'usr-seeker-001', { ...body, message: 'hi' })).status).toBe(400);
  });

  it('shows suggestions only to settings admins of the same society', async () => {
    await send(POST, 'POST', 'usr-seeker-001', { module: 'CLASSES', kind: 'REPORT', message: 'Yoga deck lights are broken' });

    expect((await send(GET, 'GET', 'usr-seeker-001')).status).toBe(403);
    const list = await (await send(GET, 'GET', 'usr-admin-001')).json();
    expect(list.suggestions).toHaveLength(1);
    expect(list.suggestions[0]).toMatchObject({ module: 'CLASSES', kind: 'REPORT', status: 'OPEN' });

    // An admin with settings permission switched off cannot read them
    await repo.updateMembership('soc-ggh-001', 'usr-admin-001', { permissions: { canManageSettings: false } });
    expect((await send(GET, 'GET', 'usr-admin-001')).status).toBe(403);
  });

  it('lets a settings admin mark a suggestion done', async () => {
    await send(POST, 'POST', 'usr-seeker-001', { module: 'GENERAL', kind: 'SUGGESTION', message: 'Add a notice board app' });
    const [suggestion] = await repo.listSuggestions('soc-ggh-001');

    expect((await send(PATCH, 'PATCH', 'usr-seeker-001', { suggestionId: suggestion.id, status: 'DONE' })).status).toBe(403);
    const res = await send(PATCH, 'PATCH', 'usr-admin-001', { suggestionId: suggestion.id, status: 'DONE' });
    expect((await res.json()).suggestion).toMatchObject({ status: 'DONE', resolvedBy: 'usr-admin-001' });
    expect((await send(PATCH, 'PATCH', 'usr-admin-001', { suggestionId: 'sug-missing', status: 'DONE' })).status).toBe(404);
  });
});

describe('PUT /api/v1/admin/settings (module configuration)', () => {
  beforeEach(() => {
    resetRepository();
  });

  const put = (userId: string, body: unknown) =>
    putSettings(makeRequest('/api/v1/admin/settings', { method: 'PUT', body, headers: as(userId) }));

  it('saves RideShare and Classes options, without duplicates', async () => {
    const res = await put('usr-admin-001', {
      emergencyNumber: '+91 80 4000 9999',
      pickupPoints: ['Main Gate', 'main gate', 'Tower B3'],
      classLocations: ['Clubhouse Hall'],
    });
    expect(res.status).toBe(200);
    const { settings } = await res.json();
    expect(settings.emergencyNumber).toBe('+91 80 4000 9999');
    expect(settings.pickupPoints).toEqual(['Main Gate', 'Tower B3']);
    expect(settings.classLocations).toEqual(['Clubhouse Hall']);
  });

  it('rejects residents and invalid emergency numbers', async () => {
    expect((await put('usr-seeker-001', { emergencyNumber: '112' })).status).toBe(403);
    expect((await put('usr-admin-001', { emergencyNumber: 'call security' })).status).toBe(400);
  });

  it('clears the emergency number when it is emptied', async () => {
    const res = await put('usr-admin-001', { emergencyNumber: '' });
    expect((await res.json()).settings.emergencyNumber).toBeUndefined();
  });
});

describe('flat number setup', () => {
  beforeEach(() => {
    resetRepository();
  });

  it('saves towers and range, and residents must then fit them', async () => {
    const { PUT: updateMe } = await import('../../auth/me/route');
    const put = (body: unknown) =>
      putSettings(makeRequest('/api/v1/admin/settings', { method: 'PUT', body, headers: as('usr-admin-001') }));
    expect((await put({ flatConfig: { towers: ['A1'], minNumber: 500, maxNumber: 100 } })).status).toBe(400);
    const saved = await (await put({ flatConfig: { towers: ['a1', 'b'], minNumber: 101, maxNumber: 2404 } })).json();
    expect(saved.settings.flatConfig).toEqual({ towers: ['A1', 'B'], minNumber: 101, maxNumber: 2404 });

    const me = (flatNumber: string) =>
      updateMe(makeRequest('/api/v1/auth/me', { method: 'PUT', body: { flatNumber }, headers: as('usr-seeker-001') }));
    expect((await me('C-101')).status).toBe(400);
    expect((await me('B-5000')).status).toBe(400);
    const ok = await me('b 1203');
    expect(ok.status).toBe(200);
    expect((await ok.json()).membership.flatNumber).toBe('B-1203');
  });
});
