import { ClipboardList, Clock, GraduationCap, Home, LayoutGrid, PlusCircle, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import type { AdminPermissions, SocietyMembership } from '@/types';
import { MODULES, type ModuleId, type ModuleInfo } from './modules';

/**
 * One navigation model for the phone bottom bar and the desktop sidebar.
 * The bottom bar shows the tabs of the app you are in; the sidebar shows
 * every app, with the current app's pages underneath it.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Highlight only on this exact path (an app's main page) */
  exact?: boolean;
}

/** Which part of Club House a page belongs to; it decides tabs and colour */
export type NavSection = 'home' | 'ride' | 'classes';

export function sectionFor(pathname: string): NavSection {
  if (pathname === '/rides' || pathname.startsWith('/rides/') || pathname === '/feedback' || pathname === '/report') {
    return 'ride';
  }
  if (pathname === '/lessons' || pathname.startsWith('/lessons/')) return 'classes';
  return 'home';
}

/** Society and app admins see Admin; what they can do inside is checked by each admin page and API */
export function isAdminMember(membership: Pick<SocietyMembership, 'role'> | null | undefined): boolean {
  return membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
}

/** The same rule the admin portal uses for each permission */
export function hasPermission(
  membership: Pick<SocietyMembership, 'role' | 'permissions'> | null | undefined,
  permission: keyof AdminPermissions
): boolean {
  if (membership?.role === 'SUPER_ADMIN') return true;
  return membership?.role === 'SOCIETY_ADMIN' && membership.permissions?.[permission] !== false;
}

export const HOME_ITEM: NavItem = { label: 'Home', href: '/', icon: Home, exact: true };
export const PROFILE_ITEM: NavItem = { label: 'Profile', href: '/profile', icon: User };
export const ADMIN_ITEM: NavItem = { label: 'Admin', href: '/admin', icon: ShieldCheck };

/** Pages inside each live app */
export const APP_PAGES: Record<Exclude<NavSection, 'home'>, NavItem[]> = {
  ride: [
    { label: 'Rides', href: '/rides', icon: LayoutGrid, exact: true },
    { label: 'Offer', href: '/rides/offer', icon: PlusCircle },
    { label: 'My rides', href: '/rides/my-rides', icon: Clock },
  ],
  classes: [
    { label: 'Classes', href: '/lessons', icon: GraduationCap, exact: true },
    { label: 'Teach', href: '/lessons/create', icon: PlusCircle },
    { label: 'My classes', href: '/lessons/my-listings', icon: ClipboardList },
  ],
};

/** Phone bottom bar: Home plus the current app's pages (or Profile and Admin on Home) */
export function bottomNavItems(section: NavSection, isAdmin: boolean): NavItem[] {
  if (section === 'home') return [HOME_ITEM, ...(isAdmin ? [ADMIN_ITEM] : []), PROFILE_ITEM];
  return [HOME_ITEM, ...APP_PAGES[section]];
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export interface SidebarApp {
  module: ModuleInfo;
  /** The app's pages, shown while you are inside it */
  pages: NavItem[];
}

export interface SidebarModel {
  main: NavItem[];
  apps: SidebarApp[];
  personal: NavItem[];
  /** Empty unless the member is an admin */
  admin: NavItem[];
}

const SECTION_OF_MODULE: Partial<Record<ModuleId, Exclude<NavSection, 'home'>>> = { ride: 'ride', classes: 'classes' };

/** Desktop sidebar contents; Coming soon apps carry no pages and no link */
export function sidebarModel(isAdmin: boolean): SidebarModel {
  return {
    main: [HOME_ITEM],
    apps: MODULES.map((module) => {
      const section = SECTION_OF_MODULE[module.id];
      return { module, pages: module.status === 'live' && section ? APP_PAGES[section] : [] };
    }),
    personal: [PROFILE_ITEM],
    admin: isAdmin ? [ADMIN_ITEM] : [],
  };
}

/** The module colour for a section's active navigation state */
export function sectionModule(section: NavSection): ModuleId {
  return section;
}
