'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { PublicJourneyView } from '@/types';

interface RideRequestActionProps {
  ride: PublicJourneyView;
  /** The signed-in user, to recognise their own rides */
  currentUserId?: string;
}

/**
 * The action area of a ride card: a Request button, the state of the
 * resident's request, or "Your ride" for rides they offered. Request
 * failures are shown instead of being dropped silently.
 */
export function RideRequestAction({ ride, currentUserId }: RideRequestActionProps) {
  const [status, setStatus] = useState(ride.userRequestStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (currentUserId && ride.offerer.id === currentUserId) {
    return (
      <Link
        href="/rides/my-rides"
        className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl hover:bg-slate-200"
      >
        Your ride · Manage
      </Link>
    );
  }

  if (status === 'ACCEPTED') {
    return (
      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Accepted
      </span>
    );
  }

  if (status === 'REQUESTED') {
    return (
      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
        Request Pending
      </span>
    );
  }

  const request = async () => {
    setError('');
    setSending(true);
    try {
      const res = await apiFetch('/api/v1/rides/requests', {
        method: 'POST',
        json: { journeyId: ride.id, requestedSeats: 1 },
      });
      if (res.ok) setStatus('REQUESTED');
      else setError(await apiErrorMessage(res, 'Could not send your request. Please try again.'));
    } catch {
      setError('Connection problem. Check your internet and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={request}
        disabled={sending || ride.availableSeats <= 0}
        className="shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        {ride.availableSeats <= 0 ? 'Full' : 'Request Ride'}
      </button>
      {error && (
        <p role="alert" className="text-[11px] text-rose-700 font-medium text-right max-w-[220px]">
          {error}
        </p>
      )}
    </div>
  );
}
