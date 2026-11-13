'use client';

import { useState } from 'react';
import { ArrowRight, Car, Clock, Search, Sparkles } from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { PublicJourneyView } from '@/types';
import { addDays, formatIstTime, istDateString, relativeDayLabel } from '@/lib/utils/time';
import { RideRequestAction } from '@/components/RideRequestAction';
import { ReputationBadge } from '@/components/ReputationBadge';
import { HideResidentButton } from '@/components/HideResidentButton';
import { ConfirmedRidePanel } from '@/components/ConfirmedRidePanel';

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
    <section aria-labelledby="ride-feed" className="px-5 flex-1 space-y-3">
      <h2 id="ride-feed" className="text-sm font-extrabold text-slate-900">
        Rides
      </h2>

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search by place"
            placeholder="Where to? e.g. Manyata"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-500"
          />
        </div>
        <label htmlFor="ride-sort" className="sr-only">
          Sort by
        </label>
        <select
          id="ride-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="h-10 px-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
        >
          <option value="SOONEST">Soonest</option>
          <option value="NEWEST">Newest</option>
        </select>
      </div>

      <div className="flex gap-1.5" role="group" aria-label="When">
        {DAY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={day === f.id}
            onClick={() => setDay(f.id)}
            className={`h-8 px-3.5 rounded-full text-xs font-bold border ${
              day === f.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
          <Car className="w-7 h-7 mx-auto text-slate-400 mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            {rides.length === 0 ? 'No rides yet' : 'No rides match'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((ride) => (
            <li key={ride.id}>
              <RideCard
                ride={ride}
                fitsCommute={matchIds.has(ride.id)}
                currentUserId={currentUserId}
                onChanged={onChanged}
              />
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
  const seats = ride.availableSeats;

  return (
    <article className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {relativeDayLabel(ride.journeyDate)}, {formatIstTime(ride.departureWindowStart)}
          </p>
          <p className="mt-0.5 text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
            <ArrowRight className="inline w-4 h-4 mr-1 -mt-0.5 text-emerald-700" aria-label="To" />
            {ride.destinationName}
          </p>
          <p className="text-[11px] text-slate-700 truncate">From {ride.meetingPoint || ride.originName}</p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
          {seats} seat{seats === 1 ? '' : 's'} left
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-700">
          <span className="font-semibold text-slate-900 truncate">{ride.offerer.displayName}</span>
          <ReputationBadge reputation={ride.offererReputation} />
          {ride.fuelSharePointsEstimate && <span>⛽ ~₹{ride.fuelSharePointsEstimate.perPassengerPoints}</span>}
          {fitsCommute && (
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-800">
              <Sparkles className="w-3 h-3" aria-hidden="true" /> Your route
            </span>
          )}
        </div>
        {!isMine && !isAccepted && (
          <HideResidentButton userId={ride.offerer.id} name={ride.offerer.displayName} onHidden={onChanged} />
        )}
        <RideRequestAction key={ride.userRequestStatus ?? 'none'} ride={ride} currentUserId={currentUserId} />
      </div>

      {isAccepted && (
        <ConfirmedRidePanel
          journeyId={ride.id}
          offererPhoto={ride.offerer.photoUrl}
          offererName={ride.offerer.displayName}
          offererFlat={ride.offerer.flatNumber}
          offererMobile={ride.offerer.mobile}
          vehicleName={[ride.vehicle.color, ride.vehicle.make, ride.vehicle.model].filter(Boolean).join(' ')}
          plate={ride.vehicle.registrationNumber}
          meetingPoint={ride.meetingPoint ? `${ride.meetingPoint}, ${ride.originName}` : ride.originName}
          destination={ride.destinationName}
          when={`${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`}
        />
      )}

    </article>
  );
}
