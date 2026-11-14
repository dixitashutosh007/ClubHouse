import React from 'react';
import { ArrowRight, Car, Clock, Fuel, Sparkles } from 'lucide-react';
import { ReputationBadge } from '@/components/ReputationBadge';
import type { Reputation } from '@/types';

export interface RideSummaryProps {
  /** e.g. "Tomorrow, 08:00 am" */
  when: string;
  destination: string;
  /** Pick-up point, or where the ride starts */
  from: string;
  seatsLeft: number;
  /** As the API returns it (short name until a request is accepted) */
  offererName?: string;
  reputation?: Reputation;
  /** e.g. "White Maruti Swift" (never the number plate here) */
  vehicle?: string;
  /** Estimated fuel share per person, in rupees */
  fuelShare?: number;
  fitsCommute?: boolean;
}

/**
 * The information part of a ride card, in the order riders decide by:
 * when, where to, from where, seats; then who, which car and fuel share.
 * Shared by the ride feed and the live preview on Offer a ride.
 */
export function RideSummary({ when, destination, from, seatsLeft, offererName, reputation, vehicle, fuelShare, fitsCommute }: RideSummaryProps) {
  return (
    <div className="grid gap-2.5 min-w-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 grid gap-0.5">
          <p className="flex items-center gap-1.5 text-support font-semibold text-ride-deep">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
            {when}
          </p>
          <p className="font-display text-card font-bold text-ink leading-snug">
            <ArrowRight className="inline w-4 h-4 mr-1 -mt-0.5 text-ride-deep" aria-label="To" />
            {destination}
          </p>
          <p className="text-meta text-ink-muted truncate">From {from}</p>
        </div>
        <span className="shrink-0 text-meta font-semibold text-ride-deep bg-ride-tint px-2.5 py-1 rounded-full">
          {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
        {offererName && <span className="font-semibold text-ink">{offererName}</span>}
        {offererName && <ReputationBadge reputation={reputation} />}
        {vehicle && (
          <span className="inline-flex items-center gap-1">
            <Car className="w-3.5 h-3.5" aria-hidden="true" />
            {vehicle}
          </span>
        )}
        {fuelShare !== undefined && (
          <span className="inline-flex items-center gap-1" title="Estimated fuel share per person, settled in person">
            <Fuel className="w-3.5 h-3.5" aria-hidden="true" />~₹{fuelShare}
          </span>
        )}
        {fitsCommute && (
          <span className="inline-flex items-center gap-1 font-semibold text-ride-deep">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Your route
          </span>
        )}
      </div>
    </div>
  );
}
