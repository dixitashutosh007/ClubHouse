'use client';
import React from 'react';

import { BookOpen, Car } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SectionHeading } from '@/components/ui/Layout';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { LoadError } from '@/components/ui/LoadState';
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

/** Rides coming up this week, or live classes, as a table (cards on phones) */
export function GlanceListTab({ kind }: { kind: 'rides' | 'classes' }) {
  const isClient = useIsClient();
  const { data, error, loading, reload } = useApiData(
    `/api/v1/admin/listings?kind=${kind}`,
    (json) => json as { rides?: RideRow[]; classes?: ClassRow[] },
    kind === 'rides' ? 'Could not load rides.' : 'Could not load classes.'
  );
  const title = kind === 'rides' ? 'Rides in the coming week' : 'Live classes';

  let body: React.ReactNode;
  if (loading) body = <SkeletonCard label={`Loading ${kind}`} lines={3} />;
  else if (error) body = <LoadError message={error} onRetry={reload} />;
  else if (kind === 'rides') {
    const cols: Column<RideRow>[] = [
      { key: 'when', header: 'When', sortValue: (r) => r.departure, render: (r) => <span className="whitespace-nowrap">{isClient ? formatIstDateTime(r.departure) : ''}</span> },
      { key: 'from', header: 'From', sortValue: (r) => r.from, render: (r) => r.from },
      { key: 'to', header: 'To', sortValue: (r) => r.to, render: (r) => <span className="font-semibold">{r.to}</span> },
      { key: 'offerer', header: 'Offered by', sortValue: (r) => r.offerer, render: (r) => r.offerer },
      { key: 'seats', header: 'Seats taken', sortValue: (r) => r.seatsTaken, render: (r) => `${r.seatsTaken} of ${r.totalSeats}` },
    ];
    body = (
      <DataTable
        caption={title}
        columns={cols}
        rows={data?.rides ?? []}
        rowKey={(r) => r.id}
        pageSize={25}
        initialSort={{ key: 'when', dir: 'asc' }}
        empty={<EmptyState icon={Car} tone="ride" title="No rides in the coming week" />}
        renderCard={(r) => (
          <Card padding="sm" className="flex items-center gap-3">
            <Car className="w-5 h-5 text-ride-deep shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-support font-semibold text-ink truncate">
                {r.from} → {r.to}
              </span>
              <span className="block text-meta text-ink-muted">
                {r.offerer}
                {isClient ? ` · ${formatIstDateTime(r.departure)}` : ''}
              </span>
            </span>
            <span className="text-meta font-semibold text-ink shrink-0">
              {r.seatsTaken}/{r.totalSeats}
              <span className="sr-only"> seats taken</span>
            </span>
          </Card>
        )}
      />
    );
  } else {
    const cols: Column<ClassRow>[] = [
      { key: 'subject', header: 'Class', sortValue: (c) => c.subject, render: (c) => <span className="font-semibold">{c.subject}</span> },
      { key: 'teacher', header: 'Teacher', sortValue: (c) => c.teacher, render: (c) => c.teacher },
      { key: 'when', header: 'When', render: (c) => `${classDaysLabel(c)}${c.startTime ? ` · ${classTimeLabel(c)}` : ''}` },
      { key: 'where', header: 'Where', render: (c) => c.location ?? '—' },
      { key: 'fee', header: 'Fee', render: (c) => <span className="whitespace-nowrap">{classFeeLabel(c)}</span> },
    ];
    body = (
      <DataTable
        caption={title}
        columns={cols}
        rows={data?.classes ?? []}
        rowKey={(c) => c.id}
        pageSize={25}
        initialSort={{ key: 'subject', dir: 'asc' }}
        empty={<EmptyState icon={BookOpen} tone="classes" title="No live classes" />}
        renderCard={(c) => (
          <Card padding="sm" className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-classes-deep shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-support font-semibold text-ink truncate">{c.subject}</span>
              <span className="block text-meta text-ink-muted truncate">
                {c.teacher} · {classDaysLabel(c)}
                {c.startTime ? ` · ${classTimeLabel(c)}` : ''}
              </span>
            </span>
            <span className="text-meta font-semibold text-ink shrink-0">{classFeeLabel(c)}</span>
          </Card>
        )}
      />
    );
  }

  return (
    <section aria-labelledby={`glance-${kind}`} className="grid gap-3">
      <SectionHeading id={`glance-${kind}`} title={title} />
      {body}
    </section>
  );
}
