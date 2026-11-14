'use client';

import { ChevronRight, Megaphone } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/States';
import { cn } from '@/components/ui/cn';
import type { AdminSection, AdminTab } from '@/lib/design/admin-navigation';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import type { Announcement } from '@/types';
import { ActivityList } from './ActivityLogTab';
import type { AuditLogEntry } from './types';

interface Overview {
  residents: { active: number; waiting: number };
  rides: { upcomingWeek: number; completedLast30Days: number; seatsSharedLast30Days: number };
  classes: { live: number; waiting: number };
  attention: { openReports: number; openSuggestions: number };
}

/**
 * The admin dashboard: what needs action, how the society is using the apps,
 * the latest notices and recent activity. Every number comes from the
 * overview API; a tile links only to a section this admin may open.
 */
export function AdminOverview({ sections, onOpen }: { sections: AdminSection[]; onOpen: (tab: AdminTab) => void }) {
  const { society } = useAuth();
  const has = (id: AdminTab) => sections.some((s) => s.id === id && !s.href);
  const key = society?.id ?? '';
  const { data } = useApiData('/api/v1/admin/overview', (json) => json as Overview, 'Could not load the overview.', key);
  const notices = useApiData('/api/v1/announcements', (json) => (json as { announcements?: Announcement[] }).announcements ?? [], 'Could not load notices.', key);
  const canSeeActivity = has('ACTIVITY_LOGS');

  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading overview" role="status">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
    );
  }

  const attention = ([
    { label: 'Residents waiting', value: data.residents.waiting, tab: 'MEMBERS', hint: 'to approve' },
    { label: 'Classes waiting', value: data.classes.waiting, tab: 'CLASSES', hint: 'to approve' },
    { label: 'Open safety reports', value: data.attention.openReports, tab: 'MODERATION', hint: 'to review' },
    { label: 'Open suggestions', value: data.attention.openSuggestions, tab: 'SUGGESTIONS', hint: 'from residents' },
  ] as { label: string; value: number; tab: AdminTab; hint: string }[]).filter((t) => has(t.tab));

  const activityStats: { label: string; value: number; tab?: AdminTab; hint: string }[] = [
    { label: 'Active residents', value: data.residents.active, tab: 'MEMBERS', hint: 'approved members' },
    { label: 'Rides this week', value: data.rides.upcomingWeek, tab: 'RIDES', hint: 'coming up' },
    { label: 'Rides completed', value: data.rides.completedLast30Days, hint: 'last 30 days' },
    { label: 'Seats shared', value: data.rides.seatsSharedLast30Days, hint: 'last 30 days' },
    { label: 'Live classes', value: data.classes.live, tab: 'CLASSES', hint: 'open to residents' },
  ];

  const tile = (t: { label: string; value: number; tab?: AdminTab; hint: string }, alert: boolean) => {
    const body = (
      <>
        <span className={cn('block font-display text-page font-bold leading-none', alert ? 'text-warning' : 'text-ink')}>{t.value}</span>
        <span className="block mt-2 text-support font-semibold text-ink">{t.label}</span>
        <span className="block text-meta text-ink-muted">{t.hint}</span>
      </>
    );
    const cls = cn('h-full w-full text-left p-4 rounded-card border bg-surface', alert ? 'border-warning/40 bg-warning-bg/40' : 'border-line');
    return t.tab && has(t.tab) ? (
      <button type="button" onClick={() => onOpen(t.tab!)} className={cn(cls, 'hover:border-line-strong hover:shadow-raised transition-shadow')}>
        {body}
      </button>
    ) : (
      <div className={cls}>{body}</div>
    );
  };

  return (
    <div className="grid gap-6">
      {attention.length > 0 && (
        <section aria-labelledby="needs-attention" className="grid gap-3">
          <SectionHeading id="needs-attention" title="Needs your attention" />
          <ul className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            {attention.map((t) => (
              <li key={t.label}>{tile(t, t.value > 0)}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="society-activity" className="grid gap-3">
        <SectionHeading id="society-activity" title="How the society is using Club House" />
        <ul className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {activityStats.map((t) => (
            <li key={t.label}>{tile(t, false)}</li>
          ))}
        </ul>
      </section>

      <div className={cn('grid gap-6', canSeeActivity && 'xl:grid-cols-2')}>
        <section aria-labelledby="latest-notices" className="grid gap-3 content-start">
          <SectionHeading
            id="latest-notices"
            title="Latest notices"
            action={
              has('ANNOUNCEMENTS') ? (
                <button type="button" onClick={() => onOpen('ANNOUNCEMENTS')} className="inline-flex items-center gap-1 min-h-11 text-support font-semibold text-terracotta-deep hover:underline">
                  Manage <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : undefined
            }
          />
          {notices.data && notices.data.length > 0 ? (
            <ul className="rounded-card border border-line bg-surface divide-y divide-line">
              {notices.data.slice(0, 3).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <Megaphone className="w-4 h-4 mt-1 text-terracotta-deep shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-support font-semibold text-ink truncate">{n.title}</span>
                    <span className="block text-meta text-ink-muted">
                      {formatIstDay(istDateOf(n.createdAt))}
                      {n.expiresOn ? ` · until ${formatIstDay(n.expiresOn)}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="text-support text-ink-muted">No notices are live right now.</Card>
          )}
        </section>

        {canSeeActivity && <RecentActivity cacheKey={key} onOpen={() => onOpen('ACTIVITY_LOGS')} />}
      </div>
    </div>
  );
}

/** The last few audit entries; only rendered for admins who may view activity */
function RecentActivity({ cacheKey, onOpen }: { cacheKey: string; onOpen: () => void }) {
  const { data } = useApiData(
    '/api/v1/admin/audit-logs',
    (json) => ((json as { events?: AuditLogEntry[] }).events ?? []).slice(0, 5),
    'Could not load activity.',
    cacheKey
  );
  return (
    <section aria-labelledby="recent-activity" className="grid gap-3 content-start">
      <SectionHeading
        id="recent-activity"
        title="Recent activity"
        action={
          <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 min-h-11 text-support font-semibold text-terracotta-deep hover:underline">
            All activity <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        }
      />
      {data && data.length > 0 ? (
        <ActivityList logs={data} />
      ) : (
        <Card className="text-support text-ink-muted">{data ? 'Nothing has happened yet.' : 'Loading…'}</Card>
      )}
    </section>
  );
}
