import { describe, it, expect } from 'vitest';
import { bottomNavItems, hasPermission, isActive, isAdminMember, sectionFor, sidebarModel } from '../navigation';
import type { SocietyMembership } from '@/types';

const member = (role: SocietyMembership['role'], permissions?: SocietyMembership['permissions']) =>
  ({ role, permissions }) as Pick<SocietyMembership, 'role' | 'permissions'>;

describe('navigation', () => {
  it('knows which app a page belongs to', () => {
    expect(sectionFor('/')).toBe('home');
    expect(sectionFor('/profile')).toBe('home');
    expect(sectionFor('/rides/offer')).toBe('ride');
    expect(sectionFor('/feedback')).toBe('ride');
    expect(sectionFor('/lessons/edit/abc')).toBe('classes');
    expect(sectionFor('/ridesharing')).toBe('home');
  });

  it('shows Admin only to society and app admins', () => {
    expect(isAdminMember(member('RESIDENT'))).toBe(false);
    expect(isAdminMember(null)).toBe(false);
    expect(isAdminMember(member('SOCIETY_ADMIN'))).toBe(true);
    expect(bottomNavItems('home', false).map((i) => i.label)).toEqual(['Home', 'Profile']);
    expect(bottomNavItems('home', true).map((i) => i.label)).toEqual(['Home', 'Admin', 'Profile']);
    expect(sidebarModel(false).admin).toEqual([]);
    expect(sidebarModel(true).admin.map((i) => i.href)).toEqual(['/admin']);
  });

  it('gives each live app its pages, and Coming soon apps none', () => {
    expect(bottomNavItems('ride', true).map((i) => i.label)).toEqual(['Home', 'Rides', 'Offer', 'My rides']);
    expect(bottomNavItems('classes', false).map((i) => i.label)).toEqual(['Home', 'Classes', 'Teach', 'My classes']);
    const apps = sidebarModel(false).apps;
    expect(apps.map((a) => a.module.name)).toEqual(['RideShare', 'Classes', 'Home Chef', 'Marketplace', 'Recommendations', 'Community']);
    for (const app of apps.filter((a) => a.module.status !== 'live')) {
      expect(app.pages).toEqual([]);
      expect(app.module.href).toBeUndefined();
    }
  });

  it('marks the current page', () => {
    const [, rides, offer] = bottomNavItems('ride', false);
    expect(isActive(rides, '/rides')).toBe(true);
    expect(isActive(rides, '/rides/offer')).toBe(false); // exact
    expect(isActive(offer, '/rides/offer')).toBe(true);
  });

  it('follows the admin portal permission rule', () => {
    expect(hasPermission(member('SUPER_ADMIN'), 'canApproveResidents')).toBe(true);
    expect(hasPermission(member('SOCIETY_ADMIN'), 'canApproveResidents')).toBe(true);
    expect(hasPermission(member('SOCIETY_ADMIN', { canApproveResidents: false } as SocietyMembership['permissions']), 'canApproveResidents')).toBe(false);
    expect(hasPermission(member('RESIDENT'), 'canApproveResidents')).toBe(false);
  });
});
