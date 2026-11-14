'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Car, Flag, History, Star } from 'lucide-react';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { SegmentedTabs, TabPanel } from '@/components/ui/Tabs';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { LoadError } from '@/components/ui/LoadState';
import { ReputationBadge } from '@/components/ReputationBadge';
import { formatIstDateTime } from '@/lib/utils/time';
import type { Reputation } from '@/types';
import { RideOccurrence, RideRequest } from '@/types';

type TakenRide = RideRequest & { journey: RideOccurrence | null; offererName: string };

const FINISHED = ['COMPLETED', 'EXPIRED', 'CANCELLED'];
const OFFERED_LABEL: Record<string, { text: string; status: BadgeStatus }> = {
  COMPLETED: { text: 'Done', status: 'success' },
  EXPIRED: { text: 'Nobody joined', status: 'neutral' },
  CANCELLED: { text: 'Cancelled', status: 'danger' },
};
const iconLink = 'inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-sunken';

/** Past rides: the ones you offered and the ones you took */
export default function RideHistoryPage() {
  const { activePersona } = useAuth();
  const isClient = useIsClient();
  const [tab, setTab] = useState<'TAKEN' | 'OFFERED'>('TAKEN');
  const offered = useApiData(
    '/api/v1/rides?mine=true',
    (json) =>
      ((json as { rides?: RideOccurrence[] }).rides ?? [])
        .filter((r) => FINISHED.includes(r.status))
        .sort((a, b) => b.departureWindowStart.localeCompare(a.departureWindowStart)),
    'Could not load your rides.',
    activePersona
  );
  const taken = useApiData(
    '/api/v1/rides/requests',
    (json) =>
      ((json as { requests?: TakenRide[] }).requests ?? [])
        .filter(
          (r) =>
            r.status === 'ACCEPTED' &&
            r.journey &&
            (Boolean(r.riderEndedAt) || r.journey.status === 'COMPLETED' || r.journey.status === 'EXPIRED')
        )
        .sort((a, b) => b.journey!.departureWindowStart.localeCompare(a.journey!.departureWindowStart)),
    'Could not load your rides.',
    activePersona
  );
  const mine = useApiData(
    '/api/v1/rides/feedback',
    (json) => (json as { reputation: Reputation }).reputation,
    'Could not load your rating.',
    activePersona
  );

  const when = (iso: string) => (isClient ? formatIstDateTime(iso) : '');

  const loading = offered.loading || taken.loading;

  return (
    <PageContainer width="narrow" className="grid gap-5">
      <ModuleHeader
        module="ride"
        title="Ride history"
        description="Rides you took and offered"
        backHref="/rides"
        backLabel="Back to RideShare"
        action={mine.data ? <ReputationBadge reputation={mine.data} /> : undefined}
      />

      <SegmentedTabs
        label="Ride history"
        idBase="history"
        tone="ride"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'TAKEN', label: 'Taken', count: loading ? undefined : (taken.data?.length ?? 0) },
          { value: 'OFFERED', label: 'Offered', count: loading ? undefined : (offered.data?.length ?? 0) },
        ]}
      />

      <TabPanel idBase="history" value={tab}>
        {loading ? (
          <SkeletonCard label="Loading your rides" />
        ) : offered.error || taken.error ? (
          <LoadError
            message={offered.error || taken.error}
            onRetry={() => {
              offered.reload();
              taken.reload();
            }}
          />
        ) : tab === 'TAKEN' ? (
          taken.data?.length ? (
            <ul className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
              {taken.data.map((r) => (
                <li key={r.id} className="flex items-center gap-2 pl-4 pr-2 py-2">
                  <div className="min-w-0 flex-1 py-1">
                    <p className="text-support font-semibold text-ink truncate">To {r.dropoffName}</p>
                    <p className="text-meta text-ink-muted">
                      With {r.offererName}
                      {isClient ? ` · ${when(r.journey!.departureWindowStart)}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/feedback?journeyId=${r.journeyId}&toUserId=${r.journey!.offererUserId}&name=${encodeURIComponent(r.offererName)}`}
                    aria-label={`Rate your ride with ${r.offererName}`}
                    className={`${iconLink} text-warning`}
                  >
                    <Star className="w-5 h-5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/report?userId=${r.journey!.offererUserId}&journeyId=${r.journeyId}&name=${encodeURIComponent(r.offererName)}`}
                    aria-label={`Report ${r.offererName}`}
                    className={`${iconLink} text-ink-muted`}
                  >
                    <Flag className="w-5 h-5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={History} tone="ride" title="No rides taken yet" description="Rides you join show here once they finish." />
          )
        ) : offered.data?.length ? (
          <ul className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
            {offered.data.map((r) => {
              const riders = r.totalSeats - r.availableSeats;
              const label = OFFERED_LABEL[r.status];
              return (
                <li key={r.id}>
                  <Link href={`/rides/requests?journeyId=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3 min-h-11 hover:bg-sunken">
                    <div className="min-w-0 flex-1">
                      <p className="text-support font-semibold text-ink truncate">To {r.destinationName}</p>
                      <p className="text-meta text-ink-muted">
                        {when(r.departureWindowStart)}
                        {r.status === 'COMPLETED' && riders > 0 ? ` · ${riders} rider${riders > 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                    {label && <Badge status={label.status}>{label.text}</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Car} tone="ride" title="No rides offered yet" description="Rides you offer show here once they finish." />
        )}
      </TabPanel>
    </PageContainer>
  );
}
