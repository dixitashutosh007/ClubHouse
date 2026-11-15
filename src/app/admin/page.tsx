'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { hasPermission } from '@/lib/design/navigation';
import { ADMIN_GROUPS, DASHBOARD, adminSections, sectionForTab, type AdminSection, type AdminTab } from '@/lib/design/admin-navigation';
import { PageContainer } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
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
import { CirclesTab } from './_components/CirclesTab';
import { AdminOverview } from './_components/AdminOverview';
import { AdminMember, ModerationReport, Notify } from './_components/types';

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
  const sections = adminSections(membership);
  const current = sectionForTab(sections, rawTab);
  const toast = useToast();

  // Residents waiting for approval (the menu badge), and the full member list,
  // which only the screens that need everyone load (permissions, report names)
  const [pendingCount, setPendingCount] = useState(0);
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  // Results of admin actions are toasts (errors stay until dismissed)
  const notify: Notify = useCallback((text, kind = 'success') => toast.show(text, kind), [toast]);
  // Load only what this admin may see (the API would refuse the rest)
  const mayApprove = hasPermission(membership, 'canApproveResidents');
  const mayModerate = hasPermission(membership, 'canModerateReports');

  const loadPendingCount = useCallback(async () => {
    const res = await apiFetch('/api/v1/admin/residents?all=true&page=1&pageSize=1&filter=WAITING').catch(() => null);
    if (res?.ok) setPendingCount(((await res.json()) as { counts?: { WAITING?: number } }).counts?.WAITING ?? 0);
  }, []);

  const needsAllMembers = current?.id === 'RBAC' || current?.id === 'MODERATION';
  const loadMembers = useCallback(async () => {
    const res = await apiFetch('/api/v1/admin/residents?all=true').catch(() => null);
    if (res?.ok) {
      const members = ((await res.json()) as { members?: AdminMember[] }).members ?? [];
      members.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));
      setAllMembers(members);
    } else notify('Could not load residents', 'error');
  }, [notify]);

  // Every change to residents refreshes the badge, and the full list if it is showing
  const membersChanged = useCallback(async () => {
    await loadPendingCount();
    if (needsAllMembers) await loadMembers();
  }, [loadPendingCount, loadMembers, needsAllMembers]);

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
      if (mayApprove) void loadPendingCount();
      if (mayModerate) void loadReports();
      else setLoadingReports(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPendingCount, loadReports, society?.id, mayApprove, mayModerate]);

  // Only the permissions and safety report screens need every member
  useEffect(() => {
    if (!mayApprove || !needsAllMembers) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadMembers();
    });
    return () => {
      cancelled = true;
    };
  }, [mayApprove, needsAllMembers, loadMembers, society?.id]);

  const handleMemberAction = async (
    targetUserId: string,
    action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE'
  ) => {
    const res = await apiFetch('/api/v1/admin/residents', { json: { targetUserId, action } });
    if (res.ok) {
      notify(ACTION_DONE[action]);
      await membersChanged();
    } else {
      const data = await res.json().catch(() => null);
      notify(data?.error ?? 'Could not update the member', 'error');
    }
  };

  // New circles and changes waiting (any society admin approves them)
  const circlesWaiting = useApiData(
    sections.some((s) => s.id === 'CIRCLES') ? '/api/v1/circles?view=pending' : null,
    (json) => ((json as { circles?: unknown[] }).circles ?? []).length,
    'Could not load circles.',
    society?.id ?? ''
  );

  const openReports = reports.filter((r) => r.status === 'OPEN').length;
  const badges: Partial<Record<AdminTab, number>> = { MEMBERS: pendingCount, MODERATION: openReports, CIRCLES: circlesWaiting.data ?? 0 };
  const open = (tab: AdminTab | null) => router.push(tab ? `/admin?tab=${tab}` : '/admin');
  const canApproveClasses = hasPermission(membership, 'canApproveClasses');

  if (sections.length === 0) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={ShieldCheck} title="No admin access" description="You don't have admin access in this society." />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide" className="grid gap-5">
      <div className="flex items-center gap-3">
        {current ? (
          <button
            type="button"
            onClick={() => open(null)}
            aria-label="Back to admin overview"
            className="xl:hidden w-11 h-11 shrink-0 rounded-full border border-line bg-surface flex items-center justify-center text-ink hover:bg-sunken"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="text-tag font-semibold uppercase tracking-wider text-terracotta-deep">Admin · {society?.name ?? 'Your society'}</p>
          <h1 className="font-display text-section md:text-page font-bold text-ink">{current ? current.title : 'Overview'}</h1>
          {current && <p className="text-support text-ink-muted">{current.description}</p>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)] items-start">
        <nav aria-label="Admin sections" className="hidden xl:block sticky top-24">
          <AdminMenu sections={sections} current={current} badges={badges} onOpen={open} withOverview />
        </nav>

        <div className="min-w-0 grid gap-5 [&>*]:min-w-0">
          {!current ? (
            <>
              <AdminOverview sections={sections} onOpen={open} />
              <nav aria-label="Admin sections" className="xl:hidden">
                <AdminMenu sections={sections} current={null} badges={badges} onOpen={open} />
              </nav>
            </>
          ) : (
            <>
              {current.id === 'INVITE' && society && <InviteCard society={society} notify={notify} />}
              {current.id === 'MEMBERS' && (
                <MembersTab
                  pendingCount={pendingCount}
                  flatConfig={society?.settings?.flatConfig}
                  notify={notify}
                  onChanged={membersChanged}
                  onAction={handleMemberAction}
                  onRemove={async (targetUserIds) => {
                    const res = await apiFetch('/api/v1/admin/residents/remove', { json: { targetUserIds } });
                    if (res.ok) {
                      const data = (await res.json()) as { removed: string[]; skipped: string[] };
                      notify(
                        `Removed ${data.removed.length} resident${data.removed.length === 1 ? '' : 's'}.` +
                          (data.skipped.length ? ` ${data.skipped.length} could not be removed (admins or already left).` : '')
                      );
                      await membersChanged();
                    } else notify('Could not remove the residents', 'error');
                  }}
                />
              )}
              {current.id === 'MODERATION' && (
                <ModerationTab reports={reports} members={allMembers} loading={loadingReports} notify={notify} onChanged={loadReports} />
              )}
              {current.id === 'LESSONS' && <LessonsTab notify={notify} />}
              {current.id === 'CLASSES' && (
                <>
                  {canApproveClasses && <LessonsTab notify={notify} />}
                  <GlanceListTab kind="classes" />
                </>
              )}
              {current.id === 'RIDES' && <GlanceListTab kind="rides" />}
              {current.id === 'CIRCLES' && <CirclesTab notify={notify} onChanged={circlesWaiting.reload} />}
              {current.id === 'ACTIVITY_LOGS' && <ActivityLogTab />}
              {current.id === 'RBAC' && <RbacTab members={allMembers} notify={notify} onSaved={membersChanged} />}
              {current.id === 'SOCIETIES' && <SocietiesTab notify={notify} />}
              {current.id === 'ANNOUNCEMENTS' && <AnnouncementsTab notify={notify} />}
              {current.id === 'SUGGESTIONS' && <SuggestionsTab notify={notify} />}
              {current.id === 'SETTINGS' && society && (
                <SocietySettingsForm key={society.id} society={society} notify={notify} onSaved={refreshAuth} />
              )}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/** The grouped admin menu: a side menu on desktop, a list under the overview on phones */
function AdminMenu({
  sections,
  current,
  badges,
  onOpen,
  withOverview = false,
}: {
  sections: AdminSection[];
  current: AdminSection | null;
  badges: Partial<Record<AdminTab, number>>;
  onOpen: (tab: AdminTab | null) => void;
  withOverview?: boolean;
}) {
  const item = (active: boolean) =>
    cn(
      'w-full flex items-center gap-3 min-h-11 px-3 rounded-control text-left transition-colors',
      active ? 'bg-terracotta-tint text-terracotta-deep font-semibold' : 'text-ink hover:bg-sunken'
    );
  return (
    <div className="grid gap-4">
      {withOverview && (
        <button type="button" onClick={() => onOpen(null)} aria-current={!current ? 'page' : undefined} className={item(!current)}>
          <DASHBOARD.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="text-support">{DASHBOARD.title}</span>
        </button>
      )}
      {ADMIN_GROUPS.map((group) => {
        const items = sections.filter((x) => x.group === group && !x.hidden);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`admin-group-${group}${withOverview ? '-side' : ''}`} className="grid gap-1">
            <h2
              id={`admin-group-${group}${withOverview ? '-side' : ''}`}
              className="px-3 text-tag font-semibold uppercase tracking-wider text-ink-muted"
            >
              {group}
            </h2>
            <ul className={cn('grid', !withOverview && 'rounded-card bg-surface border border-line divide-y divide-line overflow-hidden')}>
              {items.map((s) => {
                const Icon = s.icon;
                const active = current?.id === s.id;
                const badge = badges[s.id];
                const inner = (
                  <>
                    <Icon className={cn('w-5 h-5 shrink-0', !active && 'text-ink-muted')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-support">{s.title}</span>
                      {!withOverview && <span className="block text-meta text-ink-muted truncate">{s.description}</span>}
                    </span>
                    {badge ? (
                      <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-warning-bg text-warning text-tag font-bold flex items-center justify-center">
                        {badge}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                    {!withOverview && <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={s.href ?? s.id}>
                    {s.href ? (
                      <Link href={s.href} className={cn(item(false), !withOverview && 'rounded-none py-3')}>
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpen(s.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(item(active), !withOverview && 'rounded-none py-3')}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
