'use client';

import { apiFetch } from '@/lib/api-client';
import { LoadError } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { RideOccurrence, RideRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Clock, Flag, History, MapPin, Search, XCircle } from 'lucide-react';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '@/lib/api-client';
import { ConfirmedRidePanel } from '@/components/ConfirmedRidePanel';
import { useRideActivity } from '@/lib/ride-activity';
import { formatIstTime, relativeDayLabel } from '@/lib/utils/time';

const FINISHED = ['COMPLETED', 'EXPIRED', 'CANCELLED'];

type MyRequest = RideRequest & {
  /** Set when the data arrives: the ride's departure time has passed */
  departed?: boolean;
  journey: RideOccurrence | null;
  offererName: string;
  offererMobile?: string;
  offererFlat?: string;
  vehicleName: string;
  vehiclePlate?: string;
  offererPhoto?: string;
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
    // Current requests only; ended, cancelled and finished ones are in Ride history
    (json) =>
      ((json as { requests: MyRequest[] }).requests ?? [])
        .filter(
          (r) =>
            (r.status === 'REQUESTED' || r.status === 'ACCEPTED') &&
            r.journey &&
            !FINISHED.includes(r.journey.status) &&
            !r.riderEndedAt
        )
        .map((r) => ({ ...r, departed: Date.parse(r.journey!.departureWindowStart) <= Date.now() })),
    'Could not load your requests.',
    activePersona
  );
  const requests = data ?? [];
  useRideActivity(loadRequests);

  const [confirmCancelRequestId, setConfirmCancelRequestId] = useState<string | null>(null);
  const router = useRouter();

  // The rider has arrived: the ride stops showing, and they are asked how it went
  const endTrip = async (req: MyRequest) => {
    const res = await apiFetch('/api/v1/rides/requests', { method: 'PATCH', json: { requestId: req.id, action: 'END_TRIP' } });
    if (!res.ok) {
      setMessage(await apiErrorMessage(res, 'Could not end the trip.'));
      return;
    }
    router.push(
      `/feedback?journeyId=${req.journeyId}&toUserId=${req.journey!.offererUserId}&name=${encodeURIComponent(req.offererName)}`
    );
  };

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
    <PageContainer width="default" className="grid gap-5">
      <ModuleHeader
        module="ride"
        title="My requests"
        description="Seats you asked for"
        backHref="/rides"
        backLabel="Back to RideShare"
        action={
          <Button variant="secondary" icon={History} href="/rides/history">
            History
          </Button>
        }
      />

      {message && (
        <div role="status" className="p-3 rounded-control bg-success-bg text-support font-medium text-success">
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard label="Loading your requests" />
          <SkeletonCard label="Loading your requests" />
        </div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={loadRequests} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Search}
          tone="ride"
          title="No current requests"
          description="Ask for a seat on a neighbour's ride and it shows here."
          action={
            <Button tone="ride" href="/rides">
              Find a ride
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {requests.map((req) => {
            const isAccepted = req.status === 'ACCEPTED';
            const rideStatus = req.journey?.status;
            const onTheWay = rideStatus === 'IN_PROGRESS' || req.departed;
            const badge = isAccepted ? (onTheWay ? 'On the way' : 'Accepted') : req.departed ? 'Ride has left' : 'Waiting';
            const badgeStatus: BadgeStatus = isAccepted ? (onTheWay ? 'info' : 'success') : req.departed ? 'neutral' : 'warning';

            return (
              <li key={req.id} className="min-w-0">
                <Card as="article" className="grid gap-3 h-full content-between">
                  <div className="grid gap-3">
                    <div className="flex items-start justify-between gap-3">
                      {req.journey ? (
                        <p className="flex items-center gap-1.5 text-support font-semibold text-ride-deep">
                          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          {relativeDayLabel(req.journey.journeyDate)}, {formatIstTime(req.journey.departureWindowStart)} –{' '}
                          {formatIstTime(req.journey.departureWindowEnd)}
                        </p>
                      ) : (
                        <span />
                      )}
                      <Badge status={badgeStatus}>{badge}</Badge>
                    </div>
                    <p className="flex items-start gap-2 font-display text-card font-bold text-ink">
                      <MapPin className="w-4 h-4 mt-1 text-ride-deep shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">To {req.dropoffName}</span>
                    </p>
                    <p className="text-support text-ink">
                      <span className="text-ink-muted">Pick-up:</span> {req.pickupName}
                    </p>
                    <p className="text-support text-ink-muted">
                      Offered by <span className="font-semibold text-ink">{req.offererName}</span>
                      {req.vehicleName ? ` · ${req.vehicleName}` : ''}
                    </p>

                    {/* Shown once the fellow resident accepts */}
                    {isAccepted && req.journey && (
                      <ConfirmedRidePanel
                        journeyId={req.journeyId}
                        offererPhoto={req.offererPhoto}
                        offererName={req.offererName}
                        offererFlat={req.offererFlat}
                        offererMobile={req.offererMobile}
                        vehicleName={req.vehicleName}
                        plate={req.vehiclePlate}
                        meetingPoint={req.pickupName}
                        destination={req.dropoffName}
                        when={`${relativeDayLabel(req.journey.journeyDate)}, ${formatIstTime(req.journey.departureWindowStart)}`}
                        showTime
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-line">
                    {isAccepted && req.journey && (
                      <Link
                        href={`/report?userId=${req.journey.offererUserId}&journeyId=${req.journeyId}&name=${encodeURIComponent(req.offererName)}`}
                        className="inline-flex items-center gap-1.5 min-h-11 px-2 rounded-control text-support font-semibold text-ink-muted hover:bg-sunken"
                      >
                        <Flag className="w-4 h-4" aria-hidden="true" /> Report
                      </Link>
                    )}
                    <span className="flex-1" />
                    {isAccepted && onTheWay ? (
                      <Button tone="ride" onClick={() => void endTrip(req)}>
                        End trip
                      </Button>
                    ) : (
                      !req.departed && (
                        <Button variant="ghost" icon={XCircle} className="text-danger" onClick={() => setConfirmCancelRequestId(req.id)}>
                          Cancel request
                        </Button>
                      )
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
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
    </PageContainer>
  );
}
