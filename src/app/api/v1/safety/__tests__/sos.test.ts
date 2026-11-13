import { describe, it, expect, beforeEach } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { POST as sos } from '../sos/route';

const SOCIETY = 'soc-ggh-001';
const as = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOCIETY });
const press = (userId: string, body: unknown = {}) =>
  sos(makeRequest('/api/v1/safety/sos', { method: 'POST', body, headers: as(userId) }));

describe('emergency button log', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('records it, links the ride the resident is on, and alerts the admins', async () => {
    const res = await press('usr-offerer-001', { journeyId: 'jrn-001' });
    expect(res.status).toBe(200);
    expect((await res.json()).adminsAlerted).toBeGreaterThan(0);

    const event = (await repo.listAuditEvents(SOCIETY)).find((e) => e.action === 'SOS_TRIGGERED')!;
    expect(event.entityId).toBe('jrn-001');
    const adminNotes = await repo.listUserNotifications(SOCIETY, 'usr-admin-001');
    const alert = adminNotes.find((n) => n.type === 'SOS_ALERT')!;
    expect(alert.body).toContain('Ashutosh');
    expect(alert.body).toContain('+919811122233');
  });

  it("doesn't link a ride the resident isn't on", async () => {
    await press('usr-seeker-001', { journeyId: 'jrn-001' });
    const event = (await repo.listAuditEvents(SOCIETY)).find((e) => e.action === 'SOS_TRIGGERED')!;
    expect(event.entityType).toBe('MEMBERSHIP');
  });

  it('does not flood admins on repeated taps', async () => {
    for (let i = 0; i < 5; i++) await press('usr-seeker-001');
    const alerts = (await repo.listUserNotifications(SOCIETY, 'usr-admin-001')).filter((n) => n.type === 'SOS_ALERT');
    expect(alerts).toHaveLength(3);
  });
});
