'use client';

import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/context/AuthContext';

interface Overview {
  residents: { active: number; waiting: number };
  rides: { upcomingWeek: number; completedLast30Days: number; seatsSharedLast30Days: number };
  classes: { live: number; waiting: number };
  attention: { openReports: number; openSuggestions: number };
}

/** The society at a glance, at the top of the admin menu */
export function AdminOverview({ onOpen }: { onOpen: (tab: 'MEMBERS' | 'MODERATION' | 'LESSONS' | 'CONFIGURATION') => void }) {
  const { society } = useAuth();
  const { data } = useApiData('/api/v1/admin/overview', (json) => json as Overview, 'Could not load the overview.', society?.id ?? '');

  if (!data) {
    return <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden="true" />;
  }

  const tiles: { label: string; value: number; hint: string; tab?: 'MEMBERS' | 'MODERATION' | 'LESSONS' | 'CONFIGURATION'; alert?: boolean }[] = [
    { label: 'Residents', value: data.residents.active, hint: `${data.residents.waiting} waiting`, tab: 'MEMBERS', alert: data.residents.waiting > 0 },
    { label: 'Rides this week', value: data.rides.upcomingWeek, hint: `${data.rides.completedLast30Days} done in 30 days` },
    { label: 'Seats shared', value: data.rides.seatsSharedLast30Days, hint: 'last 30 days' },
    { label: 'Classes live', value: data.classes.live, hint: `${data.classes.waiting} to approve`, tab: 'LESSONS', alert: data.classes.waiting > 0 },
    { label: 'Open reports', value: data.attention.openReports, hint: 'safety', tab: 'MODERATION', alert: data.attention.openReports > 0 },
    { label: 'Suggestions', value: data.attention.openSuggestions, hint: 'from residents', tab: 'CONFIGURATION', alert: data.attention.openSuggestions > 0 },
  ];

  return (
    <section aria-labelledby="overview" className="space-y-2">
      <h2 id="overview" className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
        At a glance
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {tiles.map((t) => {
          const body = (
            <>
              <span className={`block text-xl font-extrabold ${t.alert ? 'text-amber-700' : 'text-slate-900'}`}>{t.value}</span>
              <span className="block text-[11px] font-semibold text-slate-800 leading-tight">{t.label}</span>
              <span className="block text-[10px] text-slate-600 leading-tight mt-0.5">{t.hint}</span>
            </>
          );
          return (
            <li key={t.label}>
              {t.tab ? (
                <button
                  type="button"
                  onClick={() => onOpen(t.tab!)}
                  className="w-full h-full text-left p-3 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400"
                >
                  {body}
                </button>
              ) : (
                <div className="h-full p-3 rounded-2xl bg-white border border-slate-200">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
