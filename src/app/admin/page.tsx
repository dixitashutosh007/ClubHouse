'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  GraduationCap,
  History,
  KeyRound,
  Megaphone,
  ShieldAlert,
  Inbox,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { AdminPermissions } from '@/types';
import { ActivityLogTab } from './_components/ActivityLogTab';
import { InviteCard } from './_components/InviteCard';
import { LessonsTab } from './_components/LessonsTab';
import { MembersTab } from './_components/MembersTab';
import { ModerationTab } from './_components/ModerationTab';
import { RbacTab } from './_components/RbacTab';
import { SocietySettingsForm } from './_components/SocietySettingsForm';
import { SuggestionsTab } from './_components/SuggestionsTab';
import { GlanceListTab } from './_components/GlanceListTab';
import { SocietiesTab } from './_components/SocietiesTab';
import { AnnouncementsTab } from './_components/AnnouncementsTab';
import { AdminOverview } from './_components/AdminOverview';
import { AdminMember, ModerationReport, Notify } from './_components/types';

type Tab =
  | 'MEMBERS'
  | 'MODERATION'
  | 'LESSONS'
  | 'ACTIVITY_LOGS'
  | 'RBAC'
  | 'SETTINGS'
  | 'SUGGESTIONS'
  | 'ANNOUNCEMENTS'
  | 'SOCIETIES'
  | 'RIDES'
  | 'CLASSES';
const TABS: Tab[] = [
  'MEMBERS',
  'MODERATION',
  'LESSONS',
  'ACTIVITY_LOGS',
  'RBAC',
  'SETTINGS',
  'SUGGESTIONS',
  'ANNOUNCEMENTS',
  'SOCIETIES',
  'RIDES',
  'CLASSES',
];
/** Old links to the separate settings pages open the combined settings */
const LEGACY_TABS: Record<string, Tab> = {
  SOCIETY_DETAILS: 'SETTINGS',
  COMMUTE_SETTINGS: 'SETTINGS',
  CONFIGURATION: 'SETTINGS',
};

interface Section {
  id: Tab;
  title: string;
  description: string;
  icon: LucideIcon;
  group: 'People' | 'Society' | 'Platform';
  badge?: number;
  /** Opened from the "At a glance" tiles, not listed in the menu */
  hidden?: boolean;
}

const ACTION_DONE = {
  APPROVE: 'Resident approved.',
  REJECT: 'Registration rejected.',
  SUSPEND: 'Resident suspended.',
  BLOCK: 'Resident blocked.',
  REACTIVATE: 'Resident reactivated.',
} as const;

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPortal />
    </Suspense>
  );
}

function AdminPortal() {
  const { society, refreshAuth, membership } = useAuth();
  const router = useRouter();
  const rawTab = useSearchParams().get('tab');
  // The URL picks the section (so the phone's back button returns to the menu)
  const requestedTab = rawTab ? (LEGACY_TABS[rawTab] ?? (TABS.includes(rawTab as Tab) ? (rawTab as Tab) : null)) : null;

  const isSuperAdmin = membership?.role === 'SUPER_ADMIN';
  const can = (permission: keyof AdminPermissions) =>
    isSuperAdmin || (membership?.role === 'SOCIETY_ADMIN' && membership.permissions?.[permission] !== false);

  const [pendingMembers, setPendingMembers] = useState<AdminMember[]>([]);
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((text, kind = 'success') => {
    setMessage({ text, kind });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      // Every member of the society; those waiting for approval are a subset
      const res = await apiFetch('/api/v1/admin/residents?all=true');
      if (res.ok) {
        const members = ((await res.json()) as { members?: AdminMember[] }).members ?? [];
        members.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));
        setAllMembers(members);
        setPendingMembers(members.filter((m) => m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED'));
      } else {
        notify('Could not load residents', 'error');
      }
    } catch {
      notify('Failed to load residents', 'error');
    } finally {
      setLoadingMembers(false);
    }
  }, [notify]);

  const loadReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const res = await apiFetch('/api/v1/moderation/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      notify('Failed to load safety reports', 'error');
    } finally {
      setLoadingReports(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadMembers();
      void loadReports();
    });
    return () => {
      cancelled = true;
    };
  }, [loadMembers, loadReports, society?.id]);

  const handleMemberAction = async (
    targetUserId: string,
    action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE'
  ) => {
    const res = await apiFetch('/api/v1/admin/residents', { json: { targetUserId, action } });
    if (res.ok) {
      notify(ACTION_DONE[action]);
      await loadMembers();
    } else {
      const data = await res.json().catch(() => null);
      notify(data?.error ?? 'Could not update the member', 'error');
    }
  };

  const openReports = reports.filter((r) => r.status === 'OPEN').length;
  const sections: Section[] = [
    ...(can('canApproveResidents')
      ? [{
          id: 'MEMBERS' as const,
          title: 'Residents',
          description: 'Approve new residents, invite people, manage members',
          icon: Users,
          group: 'People' as const,
          badge: pendingMembers.length,
        }]
      : []),
    ...(can('canModerateReports')
      ? [{
          id: 'MODERATION' as const,
          title: 'Safety reports',
          description: 'Complaints residents have raised',
          icon: ShieldAlert,
          group: 'People' as const,
          badge: openReports,
        }]
      : []),
    ...(can('canApproveClasses')
      ? [{
          id: 'LESSONS' as const,
          title: 'Class approvals',
          description: 'Classes waiting to go live',
          icon: GraduationCap,
          group: 'People' as const,
        }]
      : []),
    ...(isSuperAdmin
      ? [{
          id: 'RBAC' as const,
          title: 'Admins and permissions',
          description: 'Who can approve, moderate and change settings',
          icon: KeyRound,
          group: 'People' as const,
        }]
      : []),
    ...(can('canManageSettings')
      ? [
          {
            id: 'ANNOUNCEMENTS' as const,
            title: 'Notices',
            description: 'Post a notice to every resident',
            icon: Megaphone,
            group: 'Society' as const,
          },
          {
            id: 'SETTINGS' as const,
            title: 'Settings',
            description: 'Society, flats, RideShare, Classes and rules',
            icon: SlidersHorizontal,
            group: 'Society' as const,
          },
          {
            id: 'SUGGESTIONS' as const,
            title: 'Suggestions',
            description: 'Ideas and problems residents have sent',
            icon: Inbox,
            group: 'Society' as const,
          },
        ]
      : []),
    ...(can('canViewAuditLogs')
      ? [{
          id: 'ACTIVITY_LOGS' as const,
          title: 'Activity',
          description: 'What has happened in the society recently',
          icon: History,
          group: 'Society' as const,
        }]
      : []),
    { id: 'RIDES', title: 'Rides this week', description: '', icon: Users, group: 'Society', hidden: true },
    { id: 'CLASSES', title: 'Live classes', description: '', icon: GraduationCap, group: 'Society', hidden: true },
    ...(isSuperAdmin
      ? [{
          id: 'SOCIETIES' as const,
          title: 'Societies',
          description: 'Add a society and see every society on Club House',
          icon: Building2,
          group: 'Platform' as const,
        }]
      : []),
  ];
  const current = sections.find((x) => x.id === requestedTab) ?? null;
  const open = (tab: Tab | null) => router.push(tab ? `/admin?tab=${tab}` : '/admin');

  return (
    <div className="w-full min-w-0 max-w-md mx-auto flex-1 bg-slate-50 text-slate-900 pb-6 p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        {current ? (
          <button
            type="button"
            onClick={() => open(null)}
            aria-label="Back to admin menu"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <Link
            href="/"
            aria-label="Back to home"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight">{current ? current.title : 'Admin'}</h1>
          {!current && <p className="text-xs text-slate-600 truncate">Manage {society?.name ?? 'your society'}</p>}
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 p-3 border text-xs rounded-xl font-medium ${
            message.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {sections.every((x) => x.hidden) ? (
        <p className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700">
          You don&apos;t have admin access in this society.
        </p>
      ) : !current ? (
        <div className="space-y-5">
          <AdminOverview onOpen={(tab) => open(tab)} />
          {(['People', 'Society', 'Platform'] as const).map((group) => {
            const items = sections.filter((x) => x.group === group && !x.hidden);
            if (items.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`admin-${group}`}>
                <h2 id={`admin-${group}`} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {group}
                </h2>
                <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => open(item.id)}
                          className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50"
                        >
                          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-slate-900">{item.title}</span>
                            <span className="block text-xs text-slate-600 truncate">{item.description}</span>
                          </span>
                          {item.badge ? (
                            <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                              {item.badge}
                            </span>
                          ) : null}
                          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {current.id === 'MEMBERS' && society && <InviteCard society={society} notify={notify} />}
          {current.id === 'MEMBERS' && (
            <MembersTab
              pendingMembers={pendingMembers}
              allMembers={allMembers}
              loading={loadingMembers}
              flatConfig={society?.settings?.flatConfig}
              notify={notify}
              onChanged={loadMembers}
              onAction={handleMemberAction}
              onRemove={async (targetUserIds) => {
                const res = await apiFetch('/api/v1/admin/residents/remove', { json: { targetUserIds } });
                if (res.ok) {
                  const data = (await res.json()) as { removed: string[]; skipped: string[] };
                  notify(
                    `Removed ${data.removed.length} resident${data.removed.length === 1 ? '' : 's'}.` +
                      (data.skipped.length ? ` ${data.skipped.length} could not be removed (admins or already left).` : '')
                  );
                  await loadMembers();
                } else notify('Could not remove the residents', 'error');
              }}
            />
          )}
          {current.id === 'MODERATION' && (
            <ModerationTab reports={reports} loading={loadingReports} notify={notify} onChanged={loadReports} />
          )}
          {current.id === 'LESSONS' && <LessonsTab notify={notify} />}
          {current.id === 'ACTIVITY_LOGS' && <ActivityLogTab />}
          {current.id === 'RBAC' && <RbacTab members={allMembers} notify={notify} onSaved={loadMembers} />}
          {current.id === 'SOCIETIES' && <SocietiesTab notify={notify} />}
          {current.id === 'ANNOUNCEMENTS' && <AnnouncementsTab notify={notify} />}
          {current.id === 'SUGGESTIONS' && <SuggestionsTab notify={notify} />}
          {current.id === 'RIDES' && <GlanceListTab kind="rides" />}
          {current.id === 'CLASSES' && (
            <GlanceListTab kind="classes" onApprovals={can('canApproveClasses') ? () => open('LESSONS') : undefined} />
          )}
          {current.id === 'SETTINGS' && society && (
            <SocietySettingsForm key={society.id} society={society} notify={notify} onSaved={refreshAuth} />
          )}
        </div>
      )}
    </div>
  );
}
