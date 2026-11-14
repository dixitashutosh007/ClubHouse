import {
  Building2,
  Car,
  GraduationCap,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  PlusCircle,
  ShieldAlert,
  SlidersHorizontal,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminPermissions, SocietyMembership } from '@/types';
import { hasPermission } from './navigation';

/** Admin sections; the id is the ?tab= value (kept from the earlier admin page) */
export type AdminTab =
  | 'MEMBERS'
  | 'INVITE'
  | 'RBAC'
  | 'MODERATION'
  | 'RIDES'
  | 'CLASSES'
  | 'LESSONS'
  | 'ANNOUNCEMENTS'
  | 'SETTINGS'
  | 'SUGGESTIONS'
  | 'ACTIVITY_LOGS'
  | 'SOCIETIES';

export type AdminGroup = 'People' | 'Governance' | 'Society' | 'Platform';

export interface AdminSection {
  id: AdminTab;
  title: string;
  description: string;
  icon: LucideIcon;
  group: AdminGroup;
  /** A page outside /admin (opens instead of a tab) */
  href?: string;
  /** Reached from another section, not listed in the menu */
  hidden?: boolean;
}

export const ADMIN_GROUPS: AdminGroup[] = ['People', 'Governance', 'Society', 'Platform'];
export const DASHBOARD = { title: 'Overview', icon: LayoutDashboard };

type Member = Pick<SocietyMembership, 'role' | 'permissions'> | null | undefined;

/**
 * The admin menu for a member. It mirrors the server checks: every section
 * is shown only with the permission its API requires (super admins have
 * all of them), so a hidden section is also a refused one.
 */
export function adminSections(membership: Member): AdminSection[] {
  const can = (p: keyof AdminPermissions) => hasPermission(membership, p);
  const isAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
  const isSuper = membership?.role === 'SUPER_ADMIN';
  if (!isAdmin) return [];

  const all: (AdminSection | false)[] = [
    can('canApproveResidents') && { id: 'MEMBERS', title: 'Residents', description: 'Approve, find and manage residents', icon: Users, group: 'People' },
    can('canApproveResidents') && { id: 'INVITE', title: 'Invitations', description: 'Invite code and link for new residents', icon: UserPlus, group: 'People' },
    isSuper && { id: 'RBAC', title: 'Admins and permissions', description: 'Who can approve, moderate and change settings', icon: KeyRound, group: 'People' },
    can('canModerateReports') && { id: 'MODERATION', title: 'Safety reports', description: 'Complaints residents have raised', icon: ShieldAlert, group: 'Governance' },
    { id: 'RIDES', title: 'Rides', description: 'Rides coming up this week', icon: Car, group: 'Governance' },
    { id: 'CLASSES', title: 'Classes', description: 'Live classes and approvals', icon: GraduationCap, group: 'Governance' },
    can('canApproveClasses') && { id: 'LESSONS', title: 'Class approvals', description: 'Classes waiting to go live', icon: GraduationCap, group: 'Governance', hidden: true },
    can('canManageSettings') && { id: 'ANNOUNCEMENTS', title: 'Notices', description: 'Post a notice to every resident', icon: Megaphone, group: 'Governance' },
    can('canManageSettings') && { id: 'SETTINGS', title: 'Settings', description: 'Society, flats, RideShare, Classes and rules', icon: SlidersHorizontal, group: 'Society' },
    can('canManageSettings') && { id: 'SUGGESTIONS', title: 'Suggestions', description: 'Ideas and problems residents have sent', icon: Inbox, group: 'Society' },
    can('canViewAuditLogs') && { id: 'ACTIVITY_LOGS', title: 'Activity', description: 'What has happened in the society recently', icon: History, group: 'Society' },
    isSuper && { id: 'SOCIETIES', title: 'Societies', description: 'Every society on Club House', icon: Building2, group: 'Platform' },
  ];
  const sections = all.filter((s): s is AdminSection => Boolean(s));
  if (isSuper) {
    sections.push({
      id: 'SOCIETIES',
      title: 'Add a society',
      description: 'Set up a new society',
      icon: PlusCircle,
      group: 'Platform',
      href: '/admin/societies/new',
    });
  }
  return sections;
}

/** Old links to the separate settings pages open the combined settings */
export const LEGACY_TABS: Record<string, AdminTab> = {
  SOCIETY_DETAILS: 'SETTINGS',
  COMMUTE_SETTINGS: 'SETTINGS',
  CONFIGURATION: 'SETTINGS',
};

/** The section a ?tab= value opens, if this member may see it */
export function sectionForTab(sections: AdminSection[], raw: string | null): AdminSection | null {
  if (!raw) return null;
  const id = LEGACY_TABS[raw] ?? raw;
  return sections.find((s) => s.id === id && !s.href) ?? null;
}
