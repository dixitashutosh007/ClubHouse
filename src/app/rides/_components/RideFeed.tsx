'use client';

import { useState } from 'react';
import { Car, Search } from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { PublicJourneyView } from '@/types';
import { addDays, formatIstTime, istDateString, relativeDayLabel } from '@/lib/utils/time';
import { RideRequestAction } from '@/components/RideRequestAction';
import { HideResidentButton } from '@/components/HideResidentButton';
import { ConfirmedRidePanel } from '@/components/ConfirmedRidePanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { SectionHeading } from '@/components/ui/Layout';
import { cn } from '@/components/ui/cn';
import { RideSummary } from './RideSummary';

type DayFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'LATER';
type SortBy = 'SOONEST' | 'NEWEST';

const DAY_FILTERS: { id: DayFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'LATER', label: 'Later' },
];

interface RideFeedProps {
  /** Rides that have not left yet */
  rides: PublicJourneyView[];
  /** Rides that fit the resident's commute (from their work location) */
  matchIds: Set<string>;
  currentUserId?: string;
  onChanged: () => void;
}

/**
 * Every ride residents can join, with a destination search, Today /
 * Tomorrow / Later and a sort. Rides that fit the resident's commute are marked.
 */
export function RideFeed({ rides, matchIds, currentUserId, onChanged }: RideFeedProps) {
  const isClient = useIsClient();
  const [day, setDay] = useState<DayFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('SOONEST');
  const [query, setQuery] = useState('');

  const today = isClient ? istDateString() : '';
  const tomorrow = today ? addDays(today, 1) : '';
  const q = query.trim().toLowerCase();

  const shown = rides
    .filter((r) => {
      if (day === 'TODAY') return r.journeyDate === today;
      if (day === 'TOMORROW') return r.journeyDate === tomorrow;
      if (day === 'LATER') return r.journeyDate > tomorrow;
      return true;
    })
    .filter(
      (r) =>
        !q ||
        r.destinationName.toLowerCase().includes(q) ||
        r.originName.toLowerCase().includes(q) ||
        (r.meetingPoint ?? '').toLowerCase().includes(q)
    )
    .sort((a, b) =>
      sortBy === 'NEWEST'
        ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        : a.departureWindowStart.localeCompare(b.departureWindowStart)
    );

  return (
    <section aria-labelledby="ride-feed" className="grid gap-4 min-w-0">
      <SectionHeading id="ride-feed" title="Find a ride" />

      <div className="grid gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search by place"
              placeholder="Where to? e.g. Manyata"
              className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-ride/30 focus:border-ride-deep"
            />
          </div>
          <label htmlFor="ride-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="ride-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-11 px-3 rounded-control border border-line-strong bg-surface text-support font-semibold text-ink"
          >
            <option value="SOONEST">Soonest</option>
            <option value="NEWEST">Newest</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="When">
          {DAY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={day === f.id}
              onClick={() => setDay(f.id)}
              className={cn(
                'h-10 px-4 rounded-full text-support font-semibold border whitespace-nowrap transition-colors',
                day === f.id ? 'bg-ride-deep border-ride-deep text-ink-inverse' : 'bg-surface border-line text-ink hover:border-line-strong'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Car}
          tone="ride"
          title={rides.length === 0 ? 'No rides yet' : 'No rides match'}
          description={rides.length === 0 ? 'When neighbours offer rides, they appear here.' : 'Try another day or place.'}
          action={
            rides.length === 0 ? (
              <Button tone="ride" href="/rides/offer">
                Offer a ride
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 min-[1400px]:grid-cols-2">
          {shown.map((ride) => (
            <li key={ride.id} className="min-w-0">
              <RideCard ride={ride} fitsCommute={matchIds.has(ride.id)} currentUserId={currentUserId} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RideCard({
  ride,
  fitsCommute,
  currentUserId,
  onChanged,
}: {
  ride: PublicJourneyView;
  fitsCommute: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const isAccepted = ride.userRequestStatus === 'ACCEPTED';
  const isMine = ride.offerer.id === currentUserId;
  const vehicle = [ride.vehicle.color, ride.vehicle.make, ride.vehicle.model].filter(Boolean).join(' ');

  return (
    <Card as="article" className="h-full grid gap-3 content-between">
      <RideSummary
        when={`${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`}
        destination={ride.destinationName}
        from={ride.meetingPoint || ride.originName}
        seatsLeft={ride.availableSeats}
        offererName={ride.offerer.displayName}
        reputation={ride.offererReputation}
        vehicle={vehicle || undefined}
        fuelShare={ride.fuelSharePointsEstimate?.perPassengerPoints}
        fitsCommute={fitsCommute}
      />

      {isAccepted && (
        <ConfirmedRidePanel
          journeyId={ride.id}
          offererPhoto={ride.offerer.photoUrl}
          offererName={ride.offerer.displayName}
          offererFlat={ride.offerer.flatNumber}
          offererMobile={ride.offerer.mobile}
          vehicleName={vehicle}
          plate={ride.vehicle.registrationNumber}
          meetingPoint={ride.meetingPoint ? `${ride.meetingPoint}, ${ride.originName}` : ride.originName}
          destination={ride.destinationName}
          when={`${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`}
        />
      )}

      <div className="flex items-center justify-end gap-1 pt-1 border-t border-line">
        {!isMine && !isAccepted && (
          <HideResidentButton userId={ride.offerer.id} name={ride.offerer.displayName} onHidden={onChanged} />
        )}
        <RideRequestAction key={ride.userRequestStatus ?? 'none'} ride={ride} currentUserId={currentUserId} />
      </div>
    </Card>
  );
}
