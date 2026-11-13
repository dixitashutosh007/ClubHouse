'use client';

import Link from 'next/link';
import { ArrowLeft, Car, Flag, Star, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ReputationBadge } from '@/components/ReputationBadge';
import { formatIstDateTime } from '@/lib/utils/time';
import type { Reputation } from '@/types';
import { RideOccurrence, RideRequest } from '@/types';

type TakenRide = RideRequest & { journey: RideOccurrence | null; offererName: string };

const FINISHED = ['COMPLETED', 'EXPIRED', 'CANCELLED'];
const OFFERED_LABEL: Record<string, string> = { COMPLETED: 'Done', EXPIRED: 'Nobody joined', CANCELLED: 'Cancelled' };

/** Past rides: the ones you offered and the ones you took */
export default function RideHistoryPage() {
  const { activePersona } = useAuth();
  const isClient = useIsClient();
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

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 max-w-md mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link href="/rides" aria-label="Back" className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-zinc-900">Ride history</h1>
        {mine.data && <ReputationBadge reputation={mine.data} />}
      </div>

      {offered.loading || taken.loading ? (
        <Loading label="Loading your rides…" />
      ) : offered.error || taken.error ? (
        <LoadError
          message={offered.error || taken.error}
          onRetry={() => {
            offered.reload();
            taken.reload();
          }}
        />
      ) : (
        <>
          <section aria-labelledby="taken" className="space-y-2">
            <h2 id="taken" className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" aria-hidden="true" /> Rides you took
            </h2>
            {taken.data?.length ? (
              <ul className="rounded-2xl bg-white border border-zinc-200 divide-y divide-zinc-100">
                {taken.data.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">To {r.dropoffName}</p>
                      <p className="text-[11px] text-zinc-600">
                        With {r.offererName}
                        {isClient ? ` · ${when(r.journey!.departureWindowStart)}` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/feedback?journeyId=${r.journeyId}&toUserId=${r.journey!.offererUserId}&name=${encodeURIComponent(r.offererName)}`}
                      aria-label={`Rate your ride with ${r.offererName}`}
                      className="p-2 rounded-lg text-amber-700 hover:bg-amber-50"
                    >
                      <Star className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/report?userId=${r.journey!.offererUserId}&journeyId=${r.journeyId}&name=${encodeURIComponent(r.offererName)}`}
                      aria-label={`Report ${r.offererName}`}
                      className="p-2 rounded-lg text-zinc-700 hover:bg-zinc-100"
                    >
                      <Flag className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 px-1">No rides yet.</p>
            )}
          </section>

          <section aria-labelledby="offered" className="space-y-2">
            <h2 id="offered" className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" aria-hidden="true" /> Rides you offered
            </h2>
            {offered.data?.length ? (
              <ul className="rounded-2xl bg-white border border-zinc-200 divide-y divide-zinc-100">
                {offered.data.map((r) => {
                  const riders = r.totalSeats - r.availableSeats;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/rides/requests?journeyId=${encodeURIComponent(r.id)}`}
                        className="flex items-center gap-3 p-3 hover:bg-zinc-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 truncate">To {r.destinationName}</p>
                          <p className="text-[11px] text-zinc-600">
                            {when(r.departureWindowStart)}
                            {r.status === 'COMPLETED' && riders > 0 ? ` · ${riders} rider${riders > 1 ? 's' : ''}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-zinc-700 shrink-0">{OFFERED_LABEL[r.status]}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 px-1">No rides yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
