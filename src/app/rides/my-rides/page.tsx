'use client';

import { apiFetch } from '@/lib/api-client';
import { LoadError } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { addMinutesHHMM, formatIstTime, istDateString, istDateTime, istTimeHHMM, relativeDayLabel } from '@/lib/utils/time';
import { TimeSelect } from '@/components/ui/TimeSelect';
import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useRideActivity } from '@/lib/ride-activity';
import { JourneyStatus, RideOccurrence, RideSchedule } from '@/types';
import { apiErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { CalendarClock, Car, Clock, Edit2, History, MapPin, Repeat, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BottomSheet } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Field';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { SegmentedTabs, TabPanel } from '@/components/ui/Tabs';
import { PlacesAutocompleteInput } from '@/components/PlacesAutocompleteInput';

const STATUS_LABEL: Record<JourneyStatus, { text: string; status?: BadgeStatus; ride?: boolean }> = {
  OPEN: { text: 'Open', ride: true },
  PARTIALLY_BOOKED: { text: 'Seats booked', status: 'success' },
  FULL: { text: 'Full', status: 'neutral' },
  IN_PROGRESS: { text: 'On the way', status: 'info' },
  COMPLETED: { text: 'Completed', status: 'neutral' },
  CANCELLED: { text: 'Cancelled', status: 'danger' },
  EXPIRED: { text: 'Expired', status: 'neutral' },
};
type Tab = 'UPCOMING' | 'ON_THE_WAY' | 'PAST';
const timeClass =
  'w-full h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink focus:outline-none focus:ring-3 focus:ring-ride/30 focus:border-ride-deep';

function StatusBadge({ status }: { status: JourneyStatus }) {
  const look = STATUS_LABEL[status];
  return look.ride ? <Badge tone="ride">{look.text}</Badge> : <Badge status={look.status}>{look.text}</Badge>;
}
const UNFINISHED: JourneyStatus[] = ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'];
const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MyRidesPage() {
  const { activePersona } = useAuth();
  const [editingRideId, setEditingRideId] = useState<string | null>(null);

  // Edit fields
  const [editDest, setEditDest] = useState('');
  // Set when a new destination is picked from the suggestions
  const [editPlace, setEditPlace] = useState<{ placeId: string; lat: number; lng: number } | null>(null);
  const [originalDest, setOriginalDest] = useState('');
  const [editSeats, setEditSeats] = useState(2);
  const [editStart, setEditStart] = useState('08:00');
  const [editEnd, setEditEnd] = useState('08:20');

  const [message, setMessageState] = useState<{ text: string; error: boolean } | null>(null);
  const setMessage = (text: string, error = false) => setMessageState(text ? { text, error } : null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data,
    loading,
    error: loadError,
    reload: loadMyRides,
  } = useApiData(
    '/api/v1/rides?mine=true',
    // "departed" is checked when the data arrives
    (json) =>
      ((json as { rides: RideOccurrence[] }).rides ?? [])
        .map((r) => ({ ...r, departed: Date.parse(r.departureWindowStart) <= Date.now() }))
        .sort((x, y) => x.departureWindowStart.localeCompare(y.departureWindowStart)),
    'Could not load your rides.',
    activePersona
  );
  // Current rides on top; finished, cancelled and expired ones fold away below
  const rides = (data ?? []).filter((r) => UNFINISHED.includes(r.status));
  const pastRides = (data ?? []).filter((r) => !UNFINISHED.includes(r.status)).reverse();
  const onTheWay = rides.filter((r) => r.status === 'IN_PROGRESS' || r.departed);
  const upcoming = rides.filter((r) => r.status !== 'IN_PROGRESS' && !r.departed);
  // Until the resident picks a tab, open on a ride that is under way
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const tab: Tab = chosenTab ?? (onTheWay.length > 0 ? 'ON_THE_WAY' : 'UPCOMING');
  const schedules = useApiData(
    '/api/v1/rides/schedules',
    (json) => (json as { schedules: RideSchedule[] }).schedules ?? [],
    'Could not load your repeating rides.',
    activePersona
  );
  useRideActivity(() => {
    loadMyRides();
    schedules.reload();
  });
  const [busyRideId, setBusyRideId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  };

  // Start (set off) or complete a ride; riders are told
  const lifecycle = async (journeyId: string, action: 'START' | 'COMPLETE') => {
    setBusyRideId(journeyId);
    try {
      const res = await apiFetch('/api/v1/rides', { method: 'PATCH', json: { journeyId, action } });
      if (res.ok) {
        flash(action === 'START' ? 'Ride started. Your co-riders have been told.' : 'Trip ended. Thank you for sharing!');
        loadMyRides();
      } else {
        flash(await apiErrorMessage(res, 'Could not update the ride.'));
      }
    } catch {
      flash('Connection problem. Check your internet and try again.');
    } finally {
      setBusyRideId(null);
    }
  };

  const stopRepeating = async (id: string) => {
    const res = await apiFetch(`/api/v1/rides/schedules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      flash('Stopped repeating. Rides already planned stay; cancel any you no longer need.');
      schedules.reload();
    } else flash(await apiErrorMessage(res, 'Could not stop the repeating ride.'));
  };

  const startEdit = (ride: RideOccurrence) => {
    setEditingRideId(ride.id);
    setEditDest(ride.destinationName);
    setOriginalDest(ride.destinationName);
    setEditPlace(null);
    setEditSeats(ride.totalSeats);
    setEditStart(istTimeHHMM(ride.departureWindowStart));
    setEditEnd(istTimeHHMM(ride.departureWindowEnd));
  };

  const handleSaveEdit = async (rideId: string, journeyDate: string) => {
    const destinationChanged = editDest.trim() !== originalDest;
    if (destinationChanged && !editPlace) {
      setMessage('Choose the new destination from the suggestions list.', true);
      return;
    }
    if (editEnd <= editStart) {
      setMessage('The latest departure time must be after the earliest.', true);
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/v1/rides', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId: rideId,
          ...(destinationChanged && editPlace
            ? {
                destinationName: editDest.trim(),
                destinationPlaceId: editPlace.placeId,
                destinationLat: editPlace.lat,
                destinationLng: editPlace.lng,
              }
            : {}),
          totalSeats: editSeats,
          departureWindowStart: istDateTime(journeyDate, editStart),
          departureWindowEnd: istDateTime(journeyDate, editEnd),
        }),
      });

      if (res.ok) {
        setMessage('Ride updated successfully!');
        setEditingRideId(null);
        loadMyRides();
      } else {
        setMessage(await apiErrorMessage(res, 'Could not update this ride.'), true);
      }
      setTimeout(() => setMessage(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const [confirmCancelRideId, setConfirmCancelRideId] = useState<string | null>(null);

  const handleDelete = async (journeyId: string) => {
    try {
      const res = await apiFetch(`/api/v1/rides?journeyId=${journeyId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage('Ride cancelled. Passengers have been notified.');
        loadMyRides();
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Could not cancel this ride.');
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const editingRide = editingRideId ? (data ?? []).find((r) => r.id === editingRideId) : undefined;
  const shownRides = tab === 'ON_THE_WAY' ? onTheWay : upcoming;

  const renderRide = (ride: (typeof rides)[number]) => {
    const isToday = ride.journeyDate === istDateString();
    const canChange = ride.status !== 'IN_PROGRESS' && !ride.departed;
    return (
      <Card as="article" className="grid gap-3 h-full content-between">
        <div className="grid gap-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-support font-semibold text-ride-deep">
              {relativeDayLabel(ride.journeyDate)}, {formatIstTime(ride.departureWindowStart)} – {formatIstTime(ride.departureWindowEnd)}
            </p>
            <StatusBadge status={ride.status} />
          </div>
          <p className="flex items-start gap-2 font-display text-card font-bold text-ink">
            <MapPin className="w-4 h-4 mt-1 text-ride-deep shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{ride.destinationName}</span>
          </p>
          <p className="flex items-center gap-2 text-support text-ink-muted">
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            {ride.availableSeats} of {ride.totalSeats} seats free
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
          <Button variant="tonal" tone="ride" size="md" icon={Users} href={`/rides/requests?journeyId=${ride.id}`}>
            Requests
          </Button>
          <span className="flex-1" />
          {canChange && (
            <>
              <IconButton icon={Edit2} label="Edit ride" onClick={() => startEdit(ride)} />
              <IconButton icon={Trash2} label="Cancel ride" className="text-danger" onClick={() => setConfirmCancelRideId(ride.id)} />
            </>
          )}
          {(ride.status === 'IN_PROGRESS' || ride.departed) && (
            <Button tone="ride" onClick={() => lifecycle(ride.id, 'COMPLETE')} loading={busyRideId === ride.id}>
              End trip
            </Button>
          )}
          {isToday && !ride.departed && ride.status !== 'IN_PROGRESS' && (
            <Button tone="ride" onClick={() => lifecycle(ride.id, 'START')} loading={busyRideId === ride.id}>
              Start ride
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <PageContainer width="default" className="grid gap-5">
      <ModuleHeader
        module="ride"
        title="My rides"
        description="Rides you are offering"
        backHref="/rides"
        backLabel="Back to RideShare"
        action={
          <Button variant="secondary" icon={History} href="/rides/history">
            History
          </Button>
        }
      />

      {message && (
        <div
          role={message.error ? 'alert' : 'status'}
          className={`p-3 rounded-control text-support font-medium ${message.error ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}
        >
          {message.text}
        </div>
      )}

      {schedules.data && schedules.data.length > 0 && (
        <section aria-labelledby="repeating" className="grid gap-2">
          <h2 id="repeating" className="flex items-center gap-2 text-tag font-semibold uppercase tracking-wider text-ink-muted">
            <Repeat className="w-4 h-4" aria-hidden="true" /> Repeats weekly
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {schedules.data.map((sch) => (
              <li key={sch.id} className="flex items-center gap-3 p-3 rounded-card bg-ride-tint">
                <div className="min-w-0 flex-1">
                  <p className="text-support font-bold text-ink truncate">To {sch.destinationName}</p>
                  <p className="text-meta text-ink-muted">
                    {sch.recurrenceDays.map((d) => WEEKDAY[d]).join(', ')} · {sch.departureWindowStart}
                  </p>
                </div>
                <Button variant="secondary" size="md" onClick={() => setConfirmStopId(sch.id)}>
                  Stop
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SegmentedTabs
        label="My rides"
        idBase="my-rides"
        tone="ride"
        value={tab}
        onChange={setChosenTab}
        options={[
          { value: 'UPCOMING', label: 'Upcoming', count: loading ? undefined : upcoming.length },
          { value: 'ON_THE_WAY', label: 'On the way', count: loading ? undefined : onTheWay.length },
          { value: 'PAST', label: 'Past', count: loading ? undefined : pastRides.length },
        ]}
      />

      <TabPanel idBase="my-rides" value={tab}>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SkeletonCard label="Loading your rides" />
            <SkeletonCard label="Loading your rides" />
          </div>
        ) : loadError ? (
          <LoadError message={loadError} onRetry={loadMyRides} />
        ) : tab === 'PAST' ? (
          pastRides.length === 0 ? (
            <EmptyState icon={History} tone="ride" title="No past rides" description="Finished, cancelled and expired rides show here." />
          ) : (
            <ul className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
              {pastRides.map((ride) => (
                <li key={ride.id}>
                  <Link href={`/rides/requests?journeyId=${encodeURIComponent(ride.id)}`} className="flex items-center gap-3 px-4 py-3 min-h-11 hover:bg-sunken">
                    <span className="min-w-0 flex-1">
                      <span className="block text-support font-semibold text-ink truncate">To {ride.destinationName}</span>
                      <span className="block text-meta text-ink-muted">
                        {relativeDayLabel(ride.journeyDate)}, {formatIstTime(ride.departureWindowStart)}
                      </span>
                    </span>
                    <StatusBadge status={ride.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : shownRides.length === 0 ? (
          tab === 'ON_THE_WAY' ? (
            <EmptyState icon={Clock} tone="ride" title="Nothing on the way" description="Rides you have started show here until you end the trip." />
          ) : (
            <EmptyState
              icon={Car}
              tone="ride"
              title="No upcoming rides offered"
              description="Offer a seat on your commute and neighbours can join you."
              action={
                <Button tone="ride" href="/rides/offer">
                  Offer a ride
                </Button>
              }
            />
          )
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shownRides.map((ride) => (
              <li key={ride.id} className="min-w-0">
                {renderRide(ride)}
              </li>
            ))}
          </ul>
        )}
      </TabPanel>

      <BottomSheet
        open={editingRide !== undefined}
        onClose={() => setEditingRideId(null)}
        initialFocus="title"
        title="Edit ride"
        description={editingRide ? `${relativeDayLabel(editingRide.journeyDate)}, ${formatIstTime(editingRide.departureWindowStart)}` : undefined}
      >
        {editingRide && (
          <div className="grid gap-4">
            <PlacesAutocompleteInput
              label="Destination"
              value={editDest}
              onChange={(value, suggestion) => {
                setEditDest(value);
                setEditPlace(suggestion ? { placeId: suggestion.placeId, lat: suggestion.lat, lng: suggestion.lng } : null);
              }}
            />
            <Select id="seats" label="Seats" value={editSeats} onChange={(e) => setEditSeats(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} seat{n > 1 ? 's' : ''}
                </option>
              ))}
            </Select>
            <fieldset className="grid gap-1.5">
              <legend className="flex items-center gap-1.5 text-support font-semibold text-ink mb-1.5">
                <CalendarClock className="w-4 h-4 text-ride-deep" aria-hidden="true" /> Departure window
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label htmlFor="edit-earliest" className="text-meta text-ink-muted">
                    Earliest
                  </label>
                  <TimeSelect
                    id="edit-earliest"
                    value={editStart}
                    until="23:50"
                    onChange={(t) => {
                      setEditStart(t);
                      // The latest time must stay after the earliest
                      if (editEnd <= t) setEditEnd(addMinutesHHMM(t, 15));
                    }}
                    className={timeClass}
                  />
                </div>
                <div className="grid gap-1">
                  <label htmlFor="edit-latest" className="text-meta text-ink-muted">
                    Latest
                  </label>
                  <TimeSelect id="edit-latest" value={editEnd} after={editStart} onChange={setEditEnd} className={timeClass} />
                </div>
              </div>
            </fieldset>
            {message?.error && (
              <p role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
                {message.text}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditingRideId(null)}>
                Cancel
              </Button>
              <Button tone="ride" loading={isSaving} onClick={() => handleSaveEdit(editingRide.id, editingRide.journeyDate)}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmStopId !== null}
        title="Stop repeating this ride?"
        description="No new rides will be created. Rides already planned for this week stay until you cancel them."
        confirmLabel="Stop repeating"
        cancelLabel="Keep repeating"
        destructive
        onCancel={() => setConfirmStopId(null)}
        onConfirm={() => {
          const id = confirmStopId;
          setConfirmStopId(null);
          if (id) void stopRepeating(id);
        }}
      />
      <ConfirmDialog
        open={confirmCancelRideId !== null}
        title="Cancel this ride?"
        description="Residents who requested or booked seats will be notified."
        confirmLabel="Cancel ride"
        cancelLabel="Keep ride"
        destructive
        onCancel={() => setConfirmCancelRideId(null)}
        onConfirm={() => {
          const id = confirmCancelRideId;
          setConfirmCancelRideId(null);
          if (id) void handleDelete(id);
        }}
      />
    </PageContainer>
  );
}
