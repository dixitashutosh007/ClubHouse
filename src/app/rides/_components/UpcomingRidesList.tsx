'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { useMyUpcomingRides } from '@/hooks/useMyUpcomingRides';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';

const TONE: Record<string, string> = {
  Offering: 'bg-emerald-100 text-emerald-900',
  Joining: 'bg-sky-100 text-sky-900',
  Requested: 'bg-amber-100 text-amber-900',
  'On the way': 'bg-violet-100 text-violet-900',
};

/** Your coming rides in one list: the ones you offer and the ones you join */
export function UpcomingRidesList() {
  const isClient = useIsClient();
  const { items, loading } = useMyUpcomingRides();

  return (
    <section aria-labelledby="my-upcoming" className="px-5 mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 id="my-upcoming" className="text-sm font-extrabold text-slate-900">
          Your upcoming rides
        </h2>
        <span className="flex gap-3 text-[11px] font-semibold">
          <Link href="/rides/my-rides" className="text-emerald-800 underline">
            Offered
          </Link>
          <Link href="/rides/my-requests" className="text-emerald-800 underline">
            Joined
          </Link>
        </span>
      </div>

      {!isClient || loading ? (
        <div className="h-16 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden="true" />
      ) : items.length === 0 ? (
        <p className="p-3.5 rounded-2xl bg-white border border-dashed border-slate-300 text-xs text-slate-700">
          No upcoming rides. Find one to join, or offer the seats in your car.
        </p>
      ) : (
        <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {items.slice(0, 5).map((ride) => (
            <li key={ride.key}>
              <Link href={ride.href} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                <span className="w-14 shrink-0 text-center">
                  <span className="block text-[10px] font-bold uppercase text-slate-600">
                    {relativeDayLabel(istDateOf(ride.when)).split(',')[0]}
                  </span>
                  <span className="block text-sm font-extrabold text-slate-900">
                    {formatIstTime(ride.when).replace(/\s?(am|pm)$/i, '')}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{ride.title}</span>
                  <span className="block truncate text-xs text-slate-700">{ride.detail}</span>
                </span>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${TONE[ride.statusLabel] ?? 'bg-slate-100 text-slate-800'}`}>
                  {ride.statusLabel}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
