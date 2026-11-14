import { describe, expect, it } from 'vitest';
import { adminSections, sectionForTab } from '../admin-navigation';

const ids = (m: Parameters<typeof adminSections>[0]) => adminSections(m).filter((s) => !s.href).map((s) => s.id);
const ALL = { canApproveResidents: true, canManageSettings: true, canModerateReports: true, canViewAuditLogs: true, canApproveClasses: true };

describe('adminSections', () => {
  it('gives residents and non-members nothing', () => {
    expect(adminSections(null)).toEqual([]);
    expect(adminSections({ role: 'RESIDENT' })).toEqual([]);
  });

  it('gives a society admin every society section but no platform ones', () => {
    const got = ids({ role: 'SOCIETY_ADMIN', permissions: ALL });
    expect(got).toEqual(['MEMBERS', 'INVITE', 'MODERATION', 'RIDES', 'CLASSES', 'LESSONS', 'ANNOUNCEMENTS', 'SETTINGS', 'SUGGESTIONS', 'ACTIVITY_LOGS']);
    expect(got).not.toContain('RBAC');
    expect(got).not.toContain('SOCIETIES');
  });

  it('treats a missing permission flag as allowed, like the server', () => {
    expect(ids({ role: 'SOCIETY_ADMIN' })).toContain('MEMBERS');
  });

  it.each([
    ['canApproveResidents', ['MEMBERS', 'INVITE']],
    ['canModerateReports', ['MODERATION']],
    ['canApproveClasses', ['LESSONS']],
    ['canManageSettings', ['ANNOUNCEMENTS', 'SETTINGS', 'SUGGESTIONS']],
    ['canViewAuditLogs', ['ACTIVITY_LOGS']],
  ] as const)('hides the sections of %s when it is turned off', (permission, gone) => {
    const got = ids({ role: 'SOCIETY_ADMIN', permissions: { ...ALL, [permission]: false } });
    for (const id of gone) expect(got).not.toContain(id);
    expect(got).toContain('RIDES');
  });

  it('gives a super admin everything, with the platform group', () => {
    const got = adminSections({ role: 'SUPER_ADMIN', permissions: { canApproveResidents: false } });
    expect(got.map((s) => s.id)).toEqual(expect.arrayContaining(['MEMBERS', 'RBAC', 'SOCIETIES', 'ACTIVITY_LOGS']));
    expect(got.find((s) => s.href)?.href).toBe('/admin/societies/new');
  });
});

describe('sectionForTab', () => {
  const admin = adminSections({ role: 'SOCIETY_ADMIN', permissions: { ...ALL, canModerateReports: false } });
  it('opens permitted tabs and maps old links', () => {
    expect(sectionForTab(admin, 'MEMBERS')?.id).toBe('MEMBERS');
    expect(sectionForTab(admin, 'CONFIGURATION')?.id).toBe('SETTINGS');
  });
  it('refuses tabs the member may not see', () => {
    expect(sectionForTab(admin, 'MODERATION')).toBeNull();
    expect(sectionForTab(admin, 'RBAC')).toBeNull();
    expect(sectionForTab(admin, 'nonsense')).toBeNull();
  });
});
