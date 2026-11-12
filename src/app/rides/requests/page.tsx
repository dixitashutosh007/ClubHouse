'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Clock, Loader2, MapPin, X } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstTime, relativeDayLabel } from '@/lib/utils/time';
import { RideOccurrence, RideRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { RideContactActions } from '@/components/RideContactActions';
import { TripSafetyActions } from '@/components/TripSafetyActions';
import { offererGreeting } from '@/lib/utils/contact';
import { useRideActivity } from '@/lib/ride-activity';

interface JourneyRequest extends RideRequest {
  seekerName: string;
  seekerMobile?: string;
  seekerFlat?: string;
}

interface RideWithRequests {
  ride: RideOccurrence;
  requests: JourneyRequest[];
}

const ACTIVE_RIDE_STATUSES = ['OPEN', 'PARTIALLY_BOOKED', 'FULL'];
const VISIBLE_REQUEST_STATUSES = ['REQUESTED', 'ACCEPTED'];

export default function RideRequestsManagePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RideRequestsManager />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center p-10 text-xs text-zinc-500 gap-2" role="status">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading seat requests…
    </div>
  );
}

function RideRequestsManager() {
  const { user, society } = useAuth();
  const focusJourneyId = useSearchParams().get('journeyId');
  const [rides, setRides] = useState<RideWithRequests[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const ridesRes = await apiFetch('/api/v1/rides?mine=true');
      if (!ridesRes.ok) throw new Error(await apiErrorMessage(ridesRes, 'Could not load your rides'));
      const { rides: myRides } = (await ridesRes.json()) as { rides: RideOccurrence[] };

      const upcoming = myRides
        .filter((r) => ACTIVE_RIDE_STATUSES.includes(r.status))
        .filter((r) => !focusJourneyId || r.id === focusJourneyId)
        .sort((a, b) => a.departureWindowStart.localeCompare(b.departureWindowStart));

      const withRequests = await Promise.all(
        upcoming.map(async (ride) => {
          const res = await apiFetch(`/api/v1/rides/requests?journeyId=${encodeURIComponent(ride.id)}`);
          const data = res.ok ? await res.json() : { requests: [] };
          return {
            ride,
            requests: (data.requests as JourneyRequest[]).filter((r) =>
              VISIBLE_REQUEST_STATUSES.includes(r.status)
            ),
          };
        })
      );
      setRides(withRequests);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your rides');
    }
  }, [focusJourneyId]);

  // New requests appear without reloading the page
  useRideActivity(() => void loadRequests());

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadRequests();
    });
    return () => {
      cancelled = true;
    };
  }, [loadRequests]);

  const handleAction = async (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    setBusyRequestId(requestId);
    setConfirmRemoveId(null);
    try {
      const res = await apiFetch('/api/v1/rides/requests', { method: 'PUT', json: { requestId, action } });
      if (res.ok) {
        setMessage({
          type: 'success',
          text:
            action === 'ACCEPT'
              ? 'Request accepted. You and the passenger can now see each other’s contact details.'
              : 'Request declined. The passenger has been notified.',
        });
      } else {
        setMessage({ type: 'error', text: await apiErrorMessage(res, 'Could not update this request.') });
      }
      await loadRequests();
    } finally {
      setBusyRequestId(null);
    }
  };

  const totalPending = rides?.reduce(
    (n, r) => n + r.requests.filter((q) => q.status === 'REQUESTED').length,
    0
  );

  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/rides/my-rides"
          aria-label="Back to my rides"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Seat Requests</h1>
          <p className="text-xs text-zinc-500">
            {totalPending ? `${totalPending} waiting for your answer` : 'Requests for your upcoming rides'}
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 p-3 rounded-xl border text-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {loadError ? (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-2" role="alert">
          <p>{loadError}</p>
          <button onClick={() => void loadRequests()} className="font-semibold underline">
            Try again
          </button>
        </div>
      ) : rides === null ? (
        <LoadingState />
      ) : rides.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-zinc-300 text-center text-xs text-zinc-500 space-y-3">
          <p>You have no upcoming rides.</p>
          <Link href="/rides/offer" className="inline-block px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold">
            Offer a ride
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-5">
          {rides.map(({ ride, requests }) => (
            <section key={ride.id} aria-labelledby={`ride-${ride.id}`} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 id={`ride-${ride.id}`} className="text-sm font-bold text-zinc-900">
                  {ride.destinationName}
                </h2>
                <span className="text-[11px] text-zinc-500">
                  {relativeDayLabel(ride.journeyDate)} · {formatIstTime(ride.departureWindowStart)} ·{' '}
                  {ride.availableSeats}/{ride.totalSeats} seats free
                </span>
              </div>

              {requests.length === 0 ? (
                <p className="p-3 rounded-xl bg-zinc-50 text-xs text-zinc-500">No requests yet.</p>
              ) : (
                requests.map((req) => {
                  const isAccepted = req.status === 'ACCEPTED';
                  const isBusy = busyRequestId === req.id;
                  return (
                    <div key={req.id} className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm text-zinc-900">{req.seekerName}</h3>
                          <span className="text-[11px] text-zinc-500">
                            {req.requestedSeats} seat{req.requestedSeats > 1 ? 's' : ''}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {isAccepted ? 'Accepted' : 'Waiting for you'}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-xl text-xs space-y-1.5 text-zinc-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span>Pickup: {req.pickupName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                          <span>Extra driving: about {req.calculatedDetourMinutes} min</span>
                        </div>
                      </div>

                      {isAccepted ? (
                        <>
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-2.5">
                            <p className="font-semibold text-emerald-900">
                              {req.seekerName} is riding along with you
                              {req.seekerFlat ? (
                                <span className="font-normal">
                                  {' '}
                                  · Flat <span className="font-semibold">{req.seekerFlat}</span>
                                </span>
                              ) : null}
                            </p>
                            {req.seekerMobile && (
                              <RideContactActions
                                name={req.seekerName}
                                mobile={req.seekerMobile}
                                message={offererGreeting({
                                  toName: req.seekerName,
                                  fromName: user?.fullName ?? '',
                                  societyName: society?.name,
                                  destination: ride.destinationName,
                                  when: `${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`,
                                  meetingPoint: req.pickupName,
                                })}
                              />
                            )}
                            <TripSafetyActions
                              trip={{
                                role: 'OFFERER',
                                companionName: req.seekerName,
                                from: req.pickupName,
                                to: ride.destinationName,
                                when: `${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-xs">
                            <div className="flex gap-3">
                              <Link
                                href={`/feedback?journeyId=${ride.id}&toUserId=${req.seekerUserId}&name=${encodeURIComponent(req.seekerName)}`}
                                className="font-semibold text-emerald-700 underline"
                              >
                                Rate your co-rider
                              </Link>
                              <Link
                                href={`/report?userId=${req.seekerUserId}&journeyId=${ride.id}&name=${encodeURIComponent(req.seekerName)}`}
                                className="font-semibold text-zinc-500 underline"
                              >
                                Report
                              </Link>
                            </div>
                            {confirmRemoveId === req.id ? (
                              <button
                                onClick={() => handleAction(req.id, 'REJECT')}
                                disabled={isBusy}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold"
                              >
                                Confirm remove
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmRemoveId(req.id)}
                                className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 font-semibold"
                              >
                                Remove co-rider
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                          <button
                            onClick={() => handleAction(req.id, 'REJECT')}
                            disabled={isBusy}
                            className="px-3.5 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" /> Decline
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'ACCEPT')}
                            disabled={isBusy || ride.availableSeats < req.requestedSeats}
                            className="px-4 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 flex items-center gap-1 shadow-xs disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            Accept
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
