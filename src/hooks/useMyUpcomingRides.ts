'use client';

import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useRideActivity } from '@/lib/ride-activity';
import { RideOccurrence, RideRequest } from '@/types';

type MyRequest = RideRequest & { journey: RideOccurrence | null; offererName: string };

export interface UpcomingRide {
  key: string;
  /** ISO departure */
  when: string;
  title: string;
  detail: string;
  href: string;
  role: 'OFFERING' | 'JOINING';
  /** Offered rides, and rides the resident was accepted on */
  confirmed: boolean;
  statusLabel: string;
}

const UNFINISHED = ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'];

/** Checked when the data arrives (not while rendering) */
const isUpcoming = (iso: string) => Date.parse(iso) > Date.now() - 3 * 60 * 60 * 1000;

/**
 * The resident's coming rides, offered and joined, soonest first; refreshed
 * when ride activity happens.
 */
export function useMyUpcomingRides() {
  const { activePersona, society } = useAuth();
  const key = `${activePersona}:${society?.id ?? ''}`;
  const requests = useApiData(
    '/api/v1/rides/requests',
    (json) =>
      ((json as { requests?: MyRequest[] }).requests ?? []).filter(
        (r) =>
          (r.status === 'ACCEPTED' || r.status === 'REQUESTED') &&
          !r.riderEndedAt &&
          r.journey &&
          UNFINISHED.includes(r.journey.status) &&
          isUpcoming(r.journey.departureWindowStart)
      ),
    'Could not load your rides',
    key
  );
  const offered = useApiData(
    '/api/v1/rides?mine=true',
    (json) =>
      ((json as { rides?: RideOccurrence[] }).rides ?? []).filter(
        (r) => UNFINISHED.includes(r.status) && isUpcoming(r.departureWindowStart)
      ),
    'Could not load your rides',
    key
  );
  useRideActivity(() => {
    requests.reload();
    offered.reload();
  });

  const items: UpcomingRide[] = [
    ...(requests.data ?? []).map((r) => ({
      key: r.id,
      when: r.journey!.departureWindowStart,
      title: `To ${r.dropoffName}`,
      detail:
        r.status === 'ACCEPTED'
          ? `Riding with ${r.offererName} · meet at ${r.pickupName}`
          : `Waiting for ${r.offererName} to reply`,
      href: '/rides/my-requests',
      role: 'JOINING' as const,
      confirmed: r.status === 'ACCEPTED',
      statusLabel: r.journey!.status === 'IN_PROGRESS' ? 'On the way' : r.status === 'ACCEPTED' ? 'Joining' : 'Requested',
    })),
    ...(offered.data ?? []).map((r) => {
      const joined = r.totalSeats - r.availableSeats;
      return {
        key: r.id,
        when: r.departureWindowStart,
        title: `To ${r.destinationName}`,
        detail:
          joined > 0
            ? `You're offering · ${joined} neighbour${joined > 1 ? 's' : ''} joining`
            : `You're offering · ${r.availableSeats} seat${r.availableSeats > 1 ? 's' : ''} open`,
        href: `/rides/requests?journeyId=${encodeURIComponent(r.id)}`,
        role: 'OFFERING' as const,
        confirmed: true,
        statusLabel: r.status === 'IN_PROGRESS' ? 'On the way' : 'Offering',
      };
    }),
  ].sort((a, b) => a.when.localeCompare(b.when));

  return {
    items,
    waiting: items.filter((i) => i.role === 'JOINING' && !i.confirmed).length,
    loading: requests.loading && offered.loading,
  };
}
