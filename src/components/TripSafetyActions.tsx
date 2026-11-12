'use client';

import { PhoneCall, Share2 } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';
import { useAuth } from '@/context/AuthContext';

/** National emergency number, used until the society sets its own */
const NATIONAL_EMERGENCY_NUMBER = '112';

export interface TripDetails {
  driverName: string;
  vehicle?: string;
  plate?: string;
  from: string;
  to: string;
  /** Human-readable departure, e.g. "Tomorrow, 8:30 am" */
  when: string;
}

/** The message a rider sends to family or friends before a trip */
export function tripShareText(trip: TripDetails): string {
  const car = [trip.vehicle, trip.plate].filter(Boolean).join(', ');
  return (
    `I'm sharing a ride with my neighbour ${trip.driverName}` +
    (car ? ` (${car})` : '') +
    ` from ${trip.from} to ${trip.to}, leaving ${trip.when}. Shared from ${APP_NAME}.`
  );
}

/**
 * Safety actions for an accepted ride: share the trip details with someone
 * you trust, and call the national emergency number. Nothing is stored or
 * sent by the app; sharing uses the phone's own share sheet.
 */
export function TripSafetyActions({ trip }: { trip: TripDetails }) {
  const { society } = useAuth();
  const emergencyNumber = society?.settings?.emergencyNumber || NATIONAL_EMERGENCY_NUMBER;
  const isSocietyNumber = emergencyNumber !== NATIONAL_EMERGENCY_NUMBER;

  const share = async () => {
    const text = tripShareText(trip);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My ride', text });
      } catch {
        // dismissed
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
      <button
        type="button"
        onClick={share}
        className="py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
        Share trip
      </button>
      <a
        href={`tel:${emergencyNumber.replace(/[\s-]/g, '')}`}
        aria-label={`Call emergency number ${emergencyNumber}`}
        className="py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center gap-1.5"
      >
        <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
        {isSocietyNumber ? 'Emergency' : 'Emergency 112'}
      </a>
    </div>
  );
}
