'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { apiErrorMessage, apiFetch, clashWarning } from '@/lib/api-client';
import { ConfirmDialog } from '@/components/ui/Dialog';
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
  const [clash, setClash] = useState('');

  if (currentUserId && ride.offerer.id === currentUserId) {
    return (
      <Link
        href="/rides/my-rides"
        className="shrink-0 whitespace-nowrap inline-flex items-center h-11 px-3 rounded-control text-support font-semibold text-ink bg-sunken hover:bg-line"
      >
        Your ride · Manage
      </Link>
    );
  }

  if (status === 'ACCEPTED') {
    return (
      <span className="shrink-0 whitespace-nowrap text-meta font-semibold text-success bg-success-bg px-3 py-1.5 rounded-full flex items-center gap-1">
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Accepted
      </span>
    );
  }

  if (status === 'REQUESTED') {
    return (
      <span className="shrink-0 whitespace-nowrap text-meta font-semibold text-warning bg-warning-bg px-3 py-1.5 rounded-full">
        Request pending
      </span>
    );
  }

  const request = async (allowClash = false) => {
    setError('');
    setSending(true);
    try {
      const res = await apiFetch('/api/v1/rides/requests', {
        method: 'POST',
        json: { journeyId: ride.id, requestedSeats: 1, ...(allowClash ? { allowClash: true } : {}) },
      });
      const warning = await clashWarning(res);
      if (res.ok) setStatus('REQUESTED');
      else if (warning) setClash(warning);
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
        onClick={() => void request()}
        disabled={sending || ride.availableSeats <= 0}
        className="shrink-0 whitespace-nowrap h-11 px-4 rounded-control bg-ride-deep hover:bg-ride-deep/90 text-ink-inverse text-support font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        {ride.availableSeats <= 0 ? 'Full' : 'Request seat'}
      </button>
      {error && (
        <p role="alert" className="text-meta text-danger font-medium text-right max-w-[220px]">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={clash !== ''}
        title="You already have a ride then"
        description={clash}
        confirmLabel="Request anyway"
        cancelLabel="Don't request"
        onCancel={() => setClash('')}
        onConfirm={() => {
          setClash('');
          void request(true);
        }}
      />
    </div>
  );
}
