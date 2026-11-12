'use client';

import { apiFetch } from '@/lib/api-client';
import { Loading, LoadError } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { RideOccurrence, RideRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import {
  Search,
  Clock,
  MapPin,
  ArrowLeft,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { ConfirmedRidePanel } from '@/components/ConfirmedRidePanel';
import { useRideActivity } from '@/lib/ride-activity';
import { formatIstTime, relativeDayLabel } from '@/lib/utils/time';

type MyRequest = RideRequest & {
  journey: RideOccurrence | null;
  offererName: string;
  offererMobile?: string;
  offererFlat?: string;
  vehicleName: string;
  vehiclePlate?: string;
};

export default function MyRequestsPage() {
  const { activePersona } = useAuth();
  const [message, setMessage] = useState('');
  const {
    data,
    loading,
    error: loadError,
    reload: loadRequests,
  } = useApiData(
    '/api/v1/rides/requests',
    (json) => (json as { requests: MyRequest[] }).requests ?? [],
    'Could not load your requests.',
    activePersona
  );
  const requests = data ?? [];
  useRideActivity(loadRequests);

  const [confirmCancelRequestId, setConfirmCancelRequestId] = useState<string | null>(null);

  const handleCancelRequest = async (requestId: string) => {
    try {
      const res = await apiFetch(`/api/v1/rides/requests?requestId=${requestId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage('Seat request cancelled successfully.');
        loadRequests();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">My Ride Requests</h1>
          <p className="text-xs text-zinc-500">Track and manage your requested commutes</p>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
          {message}
        </div>
      )}

      {loading ? (
        <Loading label="Loading your requests…" />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={loadRequests} />
      ) : requests.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50">
          <Search className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
          <p className="text-xs font-semibold text-zinc-700">No active ride requests</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-4">
            Search for available co-resident rides and request a seat!
          </p>
          <Link
            href="/rides/find"
            className="inline-block px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold"
          >
            Find a Ride
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {requests.map((req) => {
            const isAccepted = req.status === 'ACCEPTED';
            const isCancelled = req.status === 'CANCELLED';

            return (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-xs text-zinc-900">
                      Offered by {req.offererName}
                    </h3>
                    <p className="text-[11px] text-zinc-500">{req.vehicleName}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAccepted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCancelled
                        ? 'bg-zinc-100 text-zinc-500'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isAccepted ? 'Accepted' : isCancelled ? 'Cancelled' : 'Pending Review'}
                  </span>
                </div>

                <div className="p-2.5 bg-zinc-50 rounded-xl text-xs text-zinc-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dropoff: {req.dropoffName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Pickup: {req.pickupName}</span>
                  </div>
                </div>

                {/* Shown once the fellow resident accepts */}
                {isAccepted && req.journey && (
                  <ConfirmedRidePanel
                    offererName={req.offererName}
                    offererFlat={req.offererFlat}
                    offererMobile={req.offererMobile}
                    vehicleName={req.vehicleName}
                    plate={req.vehiclePlate}
                    meetingPoint={req.pickupName}
                    destination={req.dropoffName}
                    when={`${relativeDayLabel(req.journey.journeyDate)}, ${formatIstTime(req.journey.departureWindowStart)}`}
                  />
                )}

                {/* Actions */}
                {!isCancelled && (
                  <div className="pt-1 flex items-center justify-between">
                    {isAccepted && req.journey ? (
                      <div className="flex gap-3 text-xs">
                        <Link
                          href={`/feedback?journeyId=${req.journeyId}&toUserId=${req.journey.offererUserId}&name=${encodeURIComponent(req.offererName)}`}
                          className="font-semibold text-emerald-700 underline"
                        >
                          Rate your ride
                        </Link>
                        <Link
                          href={`/report?userId=${req.journey.offererUserId}&journeyId=${req.journeyId}&name=${encodeURIComponent(req.offererName)}`}
                          className="font-semibold text-zinc-500 underline"
                        >
                          Report
                        </Link>
                      </div>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => setConfirmCancelRequestId(req.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Request</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={confirmCancelRequestId !== null}
        title="Cancel this request?"
        description="If your fellow resident already accepted, your seat is released and they are told."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        onCancel={() => setConfirmCancelRequestId(null)}
        onConfirm={() => {
          const id = confirmCancelRequestId;
          setConfirmCancelRequestId(null);
          if (id) void handleCancelRequest(id);
        }}
      />
    </div>
  );
}
