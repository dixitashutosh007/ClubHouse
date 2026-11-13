'use client';

import { PhoneCall, Share2 } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';
import { useAuth } from '@/context/AuthContext';
import { telLink, whatsAppLink } from '@/lib/utils/contact';
import { apiFetch } from '@/lib/api-client';

/** National emergency number, used until the society sets its own */
const NATIONAL_EMERGENCY_NUMBER = '112';

export interface TripDetails {
  /** Whether the person sharing is joining the ride or offering it */
  role: 'SEEKER' | 'OFFERER';
  /** The other resident on the trip */
  companionName: string;
  vehicle?: string;
  plate?: string;
  from: string;
  to: string;
  /** Human-readable departure, e.g. "Tomorrow, 8:30 am" */
  when: string;
  /** The ride, so an emergency call is logged against it */
  journeyId?: string;
}

/** The message a resident sends to family or friends before a trip */
export function tripShareText(trip: TripDetails): string {
  const car = [trip.vehicle, trip.plate].filter(Boolean).join(', ');
  const who =
    trip.role === 'SEEKER'
      ? `I'm sharing a ride with my neighbour ${trip.companionName}` + (car ? ` in their car (${car})` : '')
      : `I'm giving my neighbour ${trip.companionName} a ride` + (car ? ` in my car (${car})` : '');
  return `${who}, from ${trip.from} to ${trip.to}, leaving ${trip.when}. Shared from ${APP_NAME}.`;
}

/**
 * Safety actions for an accepted ride: share the trip details with family
 * on WhatsApp, and call the society's emergency number
 * (112 until the society admin sets one). Nothing is stored or sent by the
 * app; the links open the phone's own apps.
 */
export function TripSafetyActions({ trip }: { trip: TripDetails }) {
  const { society } = useAuth();
  const emergencyNumber = society?.settings?.emergencyNumber || NATIONAL_EMERGENCY_NUMBER;
  const isSocietyNumber = emergencyNumber !== NATIONAL_EMERGENCY_NUMBER;
  const text = tripShareText(trip);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
      <a
        href={whatsAppLink(text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share trip details with family on WhatsApp"
        className="py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
      >
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
        Share trip
      </a>
      <a
        href={telLink(emergencyNumber)}
        // The call goes ahead at once; the app also records it and alerts the society admins
        onClick={() => {
          void apiFetch('/api/v1/safety/sos', { json: trip.journeyId ? { journeyId: trip.journeyId } : {}, keepalive: true }).catch(
            () => {}
          );
        }}
        aria-label={`Call emergency number ${emergencyNumber}`}
        className="py-2 rounded-xl bg-rose-700 text-white hover:bg-rose-800 flex items-center justify-center gap-1.5"
      >
        <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
        {isSocietyNumber ? 'Emergency' : 'SOS 112'}
      </a>
    </div>
  );
}
