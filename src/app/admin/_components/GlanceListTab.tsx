'use client';

import { BookOpen, Car, ChevronRight } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { formatIstDateTime } from '@/lib/utils/time';
import { ClassListing } from '@/types';
import { classDaysLabel, classFeeLabel, classTimeLabel } from '@/lib/class-format';

interface RideRow {
  id: string;
  departure: string;
  from: string;
  to: string;
  offerer: string;
  seatsTaken: number;
  totalSeats: number;
}
type ClassRow = Pick<
  ClassListing,
  'id' | 'subject' | 'classType' | 'classDate' | 'feeType' | 'feeAmount' | 'scheduleDays' | 'startTime' | 'durationMinutes' | 'locationType'
> & { teacher: string; location?: string };

/** The simple lists behind the "At a glance" tiles: rides this week, live classes */
export function GlanceListTab({ kind, onApprovals }: { kind: 'rides' | 'classes'; onApprovals?: () => void }) {
  const isClient = useIsClient();
  const { data, error, loading, reload } = useApiData(
    `/api/v1/admin/listings?kind=${kind}`,
    (json) => json as { rides?: RideRow[]; classes?: ClassRow[] },
    kind === 'rides' ? 'Could not load rides.' : 'Could not load classes.'
  );

  if (loading) return <Loading label="Loading…" />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const rows = kind === 'rides' ? (data?.rides ?? []) : (data?.classes ?? []);
  return (
    <div className="space-y-3">
      {kind === 'classes' && onApprovals && (
        <button
          type="button"
          onClick={onApprovals}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900"
        >
          Class approvals <ChevronRight className="w-4 h-4 text-slate-500" aria-hidden="true" />
        </button>
      )}
      {rows.length === 0 ? (
        <p className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700 text-center">
          {kind === 'rides' ? 'No rides in the coming week.' : 'No live classes.'}
        </p>
      ) : (
        <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
          {kind === 'rides'
            ? (rows as RideRow[]).map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-3">
                  <Car className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {r.from} → {r.to}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {r.offerer}
                      {isClient ? ` · ${formatIstDateTime(r.departure)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-800 shrink-0" aria-label={`${r.seatsTaken} of ${r.totalSeats} seats taken`}>
                    {r.seatsTaken}/{r.totalSeats}
                  </span>
                </li>
              ))
            : (rows as ClassRow[]).map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.subject}</p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {c.teacher} · {classDaysLabel(c)}{c.startTime ? ` · ${classTimeLabel(c)}` : ''}
                      {c.location ? ` · ${c.location}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-800 shrink-0">{classFeeLabel(c)}</span>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
