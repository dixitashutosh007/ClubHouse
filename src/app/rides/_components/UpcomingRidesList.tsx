'use client';

import Link from 'next/link';
import { ChevronRight, History } from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { useMyUpcomingRides } from '@/hooks/useMyUpcomingRides';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/States';
import { SectionHeading } from '@/components/ui/Layout';

const STATUS: Record<string, { status?: BadgeStatus; ride?: boolean }> = {
  Offering: { ride: true },
  Joining: { status: 'success' },
  Requested: { status: 'warning' },
  'On the way': { status: 'info' },
};

/** Your coming rides in one list: the ones you offer and the ones you join */
export function UpcomingRidesList() {
  const isClient = useIsClient();
  const { items, loading } = useMyUpcomingRides();
  const ready = isClient && !loading;
  // Nothing coming up: no section at all; past rides are in Ride history
  if (ready && items.length === 0) return null;

  return (
    <section aria-labelledby="my-upcoming" className="grid gap-3 min-w-0">
      <SectionHeading
        id="my-upcoming"
        title="Coming up"
        action={
          <Link
            href="/rides/history"
            className="inline-flex items-center gap-1.5 min-h-11 px-2 -mr-2 rounded-control text-support font-semibold text-ride-deep hover:underline"
          >
            <History className="w-4 h-4" aria-hidden="true" /> History
          </Link>
        }
      />

      {!ready ? (
        <Skeleton className="h-16 rounded-card" />
      ) : (
        <ul className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
          {items.slice(0, 3).map((ride) => {
            const look = STATUS[ride.statusLabel] ?? {};
            return (
              <li key={ride.key}>
                <Link href={ride.href} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                    <span className="block text-meta font-semibold text-ride-deep">
                      {relativeDayLabel(istDateOf(ride.when))}, {formatIstTime(ride.when)}
                    </span>
                    <span className="block truncate text-support font-bold text-ink">{ride.title}</span>
                  </span>
                  {look.ride ? <Badge tone="ride">{ride.statusLabel}</Badge> : <Badge status={look.status}>{ride.statusLabel}</Badge>}
                  <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
