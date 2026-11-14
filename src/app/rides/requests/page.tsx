'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Car, Check, Clock, Flag, MapPin, Star, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { LoadError } from '@/components/ui/LoadState';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstTime, relativeDayLabel } from '@/lib/utils/time';
import { Reputation, RideOccurrence, RideRequest } from '@/types';
import { ReputationBadge } from '@/components/ReputationBadge';
import { HideResidentButton } from '@/components/HideResidentButton';
import { useAuth } from '@/context/AuthContext';
import { RideContactActions } from '@/components/RideContactActions';
import { Avatar } from '@/components/ui/Avatar';
import { TripSafetyActions } from '@/components/TripSafetyActions';
import { offererGreeting } from '@/lib/utils/contact';
import { useRideActivity } from '@/lib/ride-activity';

interface JourneyRequest extends RideRequest {
  seekerName: string;
  seekerMobile?: string;
  seekerFlat?: string;
  seekerPhoto?: string;
  seekerReputation?: Reputation;
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
    <PageContainer width="default" className="grid gap-4">
      <SkeletonCard label="Loading seat requests" />
      <SkeletonCard label="Loading seat requests" />
    </PageContainer>
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
    <PageContainer width="default" className="grid gap-5">
      <ModuleHeader
        module="ride"
        title="Seat requests"
        description={totalPending ? `${totalPending} waiting for your answer` : 'Requests for your upcoming rides'}
        backHref="/rides/my-rides"
        backLabel="Back to My rides"
      />

      {message && (
        <div
          role="status"
          className={`p-3 rounded-control text-support font-medium ${message.type === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}
        >
          {message.text}
        </div>
      )}

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void loadRequests()} />
      ) : rides === null ? (
        <SkeletonCard label="Loading seat requests" />
      ) : rides.length === 0 ? (
        <EmptyState
          icon={Car}
          tone="ride"
          title="You have no upcoming rides"
          description="Requests from neighbours appear here once you offer a ride."
          action={
            <Button tone="ride" href="/rides/offer">
              Offer a ride
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {rides.map(({ ride, requests }) => (
            <section key={ride.id} aria-labelledby={`ride-${ride.id}`} className="grid gap-3">
              {/* The ride these requests are for */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 rounded-card bg-ride-tint">
                <h2 id={`ride-${ride.id}`} className="flex items-start gap-2 min-w-0 flex-1 font-display text-card font-bold text-ink">
                  <MapPin className="w-4 h-4 mt-1 text-ride-deep shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{ride.destinationName}</span>
                </h2>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-support text-ink">
                  <span className="font-semibold text-ride-deep">
                    {relativeDayLabel(ride.journeyDate)}, {formatIstTime(ride.departureWindowStart)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    {ride.availableSeats} of {ride.totalSeats} seats free
                  </span>
                </p>
              </div>

              {requests.length === 0 ? (
                <p className="p-4 rounded-card border border-dashed border-line-strong text-support text-ink-muted">No requests yet.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {requests.map((req) => {
                    const isAccepted = req.status === 'ACCEPTED';
                    const isBusy = busyRequestId === req.id;
                    const noRoom = ride.availableSeats < req.requestedSeats;
                    return (
                      <li key={req.id} className="min-w-0">
                        <Card as="article" className="grid gap-3 h-full content-between">
                          <div className="grid gap-3">
                            <div className="flex items-start gap-3">
                              <Avatar name={req.seekerName} photoUrl={isAccepted ? req.seekerPhoto : undefined} size={40} />
                              <div className="flex-1 min-w-0">
                                <h3 className="text-body font-bold text-ink">
                                  {req.seekerName}
                                  <span className="ml-2 text-meta font-medium text-ink-muted">
                                    {req.requestedSeats} seat{req.requestedSeats > 1 ? 's' : ''}
                                  </span>
                                </h3>
                                <ReputationBadge reputation={req.seekerReputation} />
                              </div>
                              {isAccepted ? <Badge status="success">Accepted</Badge> : <Badge status="warning">Waiting for you</Badge>}
                            </div>

                            <ul className="grid gap-1.5 text-support text-ink">
                              <li className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 text-ride-deep shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">Pick-up: {req.pickupName}</span>
                              </li>
                              <li className="flex items-center gap-2 text-ink-muted">
                                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                                Extra driving: about {req.calculatedDetourMinutes} min
                              </li>
                            </ul>

                            {isAccepted && (
                              /* Contact details only after you accept */
                              <div className="grid gap-3 p-3 rounded-control bg-success-bg">
                                <p className="text-support font-semibold text-ink">
                                  {req.seekerName} is riding with you
                                  {req.seekerFlat ? <span className="font-normal"> · Flat {req.seekerFlat}</span> : null}
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
                                    journeyId: ride.id,
                                    role: 'OFFERER',
                                    companionName: req.seekerName,
                                    from: req.pickupName,
                                    to: ride.destinationName,
                                    when: `${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`,
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {isAccepted ? (
                            <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-line">
                              <Link
                                href={`/feedback?journeyId=${ride.id}&toUserId=${req.seekerUserId}&name=${encodeURIComponent(req.seekerName)}`}
                                className="inline-flex items-center gap-1.5 min-h-11 px-2 rounded-control text-support font-semibold text-ride-deep hover:bg-sunken"
                              >
                                <Star className="w-4 h-4" aria-hidden="true" /> Rate
                              </Link>
                              <Link
                                href={`/report?userId=${req.seekerUserId}&journeyId=${ride.id}&name=${encodeURIComponent(req.seekerName)}`}
                                className="inline-flex items-center gap-1.5 min-h-11 px-2 rounded-control text-support font-semibold text-ink-muted hover:bg-sunken"
                              >
                                <Flag className="w-4 h-4" aria-hidden="true" /> Report
                              </Link>
                              <span className="flex-1" />
                              {confirmRemoveId === req.id ? (
                                <Button variant="danger" loading={isBusy} onClick={() => handleAction(req.id, 'REJECT')}>
                                  Confirm remove
                                </Button>
                              ) : (
                                <Button variant="secondary" onClick={() => setConfirmRemoveId(req.id)}>
                                  Remove co-rider
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="grid gap-2 pt-3 border-t border-line">
                              <div className="flex items-center gap-2">
                                <HideResidentButton userId={req.seekerUserId} name={req.seekerName} onHidden={() => void loadRequests()} />
                                <span className="flex-1" />
                                <Button variant="secondary" icon={X} disabled={isBusy} onClick={() => handleAction(req.id, 'REJECT')}>
                                  Decline
                                </Button>
                                <Button tone="ride" icon={Check} loading={isBusy} disabled={noRoom} onClick={() => handleAction(req.id, 'ACCEPT')}>
                                  Accept
                                </Button>
                              </div>
                              {noRoom && <p className="text-meta text-ink-muted text-right">Not enough seats left to accept.</p>}
                            </div>
                          )}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
