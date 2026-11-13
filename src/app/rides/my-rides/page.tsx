'use client';

import { apiFetch } from '@/lib/api-client';
import { Loading, LoadError } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { addMinutesHHMM, formatIstTime, istDateString, istDateTime, istTimeHHMM, relativeDayLabel } from '@/lib/utils/time';
import { TimeSelect } from '@/components/ui/TimeSelect';
import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useRideActivity } from '@/lib/ride-activity';
import { JourneyStatus, RideOccurrence, RideSchedule } from '@/types';
import { apiErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import {
  Car,
  Clock,
  MapPin,
  ArrowLeft,
  Trash2,
  Edit2,
  Users,
  PlusCircle,
  Save,
  X,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_LABEL: Record<JourneyStatus, { text: string; tone: string }> = {
  OPEN: { text: 'Open', tone: 'bg-emerald-50 text-emerald-800' },
  PARTIALLY_BOOKED: { text: 'Seats booked', tone: 'bg-emerald-100 text-emerald-900' },
  FULL: { text: 'Full', tone: 'bg-slate-100 text-slate-800' },
  IN_PROGRESS: { text: 'On the way', tone: 'bg-sky-100 text-sky-900' },
  COMPLETED: { text: 'Completed', tone: 'bg-slate-100 text-slate-700' },
  CANCELLED: { text: 'Cancelled', tone: 'bg-rose-50 text-rose-800' },
  EXPIRED: { text: 'Expired', tone: 'bg-slate-100 text-slate-700' },
};
const UNFINISHED: JourneyStatus[] = ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'];
const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MyRidesPage() {
  const { activePersona } = useAuth();
  const [editingRideId, setEditingRideId] = useState<string | null>(null);

  // Edit fields
  const [editDest, setEditDest] = useState('');
  const [editSeats, setEditSeats] = useState(2);
  const [editStart, setEditStart] = useState('08:00');
  const [editEnd, setEditEnd] = useState('08:20');

  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const {
    data,
    loading,
    error: loadError,
    reload: loadMyRides,
  } = useApiData(
    '/api/v1/rides?mine=true',
    (json) =>
      ((json as { rides: RideOccurrence[] }).rides ?? []).sort((x, y) =>
        y.departureWindowStart.localeCompare(x.departureWindowStart)
      ),
    'Could not load your rides.',
    activePersona
  );
  const rides = data ?? [];
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
        flash(action === 'START' ? 'Ride started. Your co-riders have been told.' : 'Ride completed. Thank you for sharing!');
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
    setEditSeats(ride.totalSeats);
    setEditStart(istTimeHHMM(ride.departureWindowStart));
    setEditEnd(istTimeHHMM(ride.departureWindowEnd));
  };

  const handleSaveEdit = async (rideId: string, journeyDate: string) => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/v1/rides', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId: rideId,
          destinationName: editDest,
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
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Could not update this ride.');
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

  return (
    <div className="flex-1 flex flex-col p-5">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/rides"
            aria-label="Back"
            className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">My offered rides</h1>
            <p className="text-xs text-zinc-600">Start, complete, edit or cancel your rides</p>
          </div>
        </div>

        <Link
          href="/rides/offer"
          className="p-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 flex items-center gap-1 text-xs font-semibold shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Offer New</span>
        </Link>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
          {message}
        </div>
      )}

      {schedules.data && schedules.data.length > 0 && (
        <section aria-labelledby="repeating" className="mb-4 space-y-2">
          <h2 id="repeating" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Repeating every week
          </h2>
          {schedules.data.map((sch) => (
            <div key={sch.id} className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-zinc-900 truncate">To {sch.destinationName}</p>
                <p className="text-zinc-700">
                  {sch.recurrenceDays.map((d) => WEEKDAY[d]).join(', ')} · {sch.departureWindowStart}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmStopId(sch.id)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white font-semibold text-zinc-800"
              >
                Stop repeating
              </button>
            </div>
          ))}
        </section>
      )}

      {loading ? (
        <Loading label="Loading your rides…" />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={loadMyRides} />
      ) : rides.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50">
          <Car className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
          <p className="text-xs font-semibold text-zinc-700">You haven&apos;t offered any rides yet</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-4">
            Share available seats in your car with co-residents!
          </p>
          <Link
            href="/rides/offer"
            className="inline-block px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
          >
            Offer a Ride Now
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {rides.map((ride) => {
            const isEditing = editingRideId === ride.id;
            const isToday = ride.journeyDate === istDateString();

            return (
              <div
                key={ride.id}
                className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {formatIstTime(ride.departureWindowStart)}
                      {' – '}
                      {formatIstTime(ride.departureWindowEnd)}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {relativeDayLabel(ride.journeyDate)}
                    </span>
                  </div>

                  <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[ride.status].tone}`}>
                    {STATUS_LABEL[ride.status].text}
                  </span>
                </div>

                {isEditing ? (
                  /* INLINE EDIT FORM */
                  <div className="space-y-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                    <div>
                      <label htmlFor="destination" className="font-semibold text-zinc-700 block mb-1">Destination</label>
                      <input
                        id="destination"
                        type="text"
                        value={editDest}
                        onChange={(e) => setEditDest(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-zinc-200 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="seats" className="font-semibold text-zinc-700 block mb-1">Seats</label>
                        <select
                          id="seats"
                          value={editSeats}
                          onChange={(e) => setEditSeats(Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200 bg-white"
                        >
                          <option value={1}>1 seat</option>
                          <option value={2}>2 seats</option>
                          <option value={3}>3 seats</option>
                          <option value={4}>4 seats</option>
                        </select>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-700 block mb-1">Time Window</span>
                        <div className="flex gap-1 items-center">
                          <label htmlFor="edit-earliest" className="sr-only">Earliest departure</label>
                          <TimeSelect
                            id="edit-earliest"
                            value={editStart}
                            until="23:50"
                            onChange={(t) => {
                              setEditStart(t);
                              // The latest time must stay after the earliest
                              if (editEnd <= t) setEditEnd(addMinutesHHMM(t, 15));
                            }}
                            className="w-full text-[11px] p-1.5 rounded-lg border border-zinc-200 bg-white"
                          />
                          <span className="text-zinc-500" aria-hidden="true">-</span>
                          <label htmlFor="edit-latest" className="sr-only">Latest departure</label>
                          <TimeSelect
                            id="edit-latest"
                            value={editEnd}
                            after={editStart}
                            onChange={setEditEnd}
                            className="w-full text-[11px] p-1.5 rounded-lg border border-zinc-200 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingRideId(null)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 font-semibold text-xs flex items-center gap-1 hover:bg-zinc-100"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(ride.id, ride.journeyDate)}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 hover:bg-emerald-800 shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-zinc-700">
                      <div className="flex items-center gap-1.5 font-medium text-zinc-900 truncate">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{ride.destinationName}</span>
                      </div>
                      <span className="text-zinc-500 font-medium shrink-0 ml-2">
                        {ride.availableSeats} of {ride.totalSeats} seats free
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
                      <Link
                        href={`/rides/requests?journeyId=${ride.id}`}
                        className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Requests</span>
                      </Link>

                      {ride.status === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() => lifecycle(ride.id, 'COMPLETE')}
                          disabled={busyRideId === ride.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-60"
                        >
                          Complete ride
                        </button>
                      )}
                      {isToday && UNFINISHED.includes(ride.status) && ride.status !== 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() => lifecycle(ride.id, 'START')}
                          disabled={busyRideId === ride.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold disabled:opacity-60"
                        >
                          Start ride
                        </button>
                      )}

                      {UNFINISHED.includes(ride.status) && ride.status !== 'IN_PROGRESS' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(ride)}
                            aria-label="Edit ride"
                            className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelRideId(ride.id)}
                            aria-label="Cancel ride"
                            className="p-1.5 rounded-lg text-rose-700 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
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
    </div>
  );
}
