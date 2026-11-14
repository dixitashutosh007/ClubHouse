'use client';

import { apiFetch, clashWarning } from '@/lib/api-client';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useIsClient } from '@/hooks/useIsClient';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CalendarDays, Car, CheckCircle2, Clock, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Vehicle } from '@/types';
import {
  EMPTY_PLACE,
  RouteEndpoint,
  RouteEndpoints,
  SOCIETY_ENDPOINT,
  routeDirection,
} from '@/components/RouteEndpoints';
import { TimeSelect } from '@/components/ui/TimeSelect';
import { OptionPicker } from '@/components/ui/OptionPicker';
import { addMinutesHHMM, formatHHMM12, istDateTime, istTimeHHMM, relativeDayLabel, upcomingIstDays } from '@/lib/utils/time';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Select } from '@/components/ui/Field';
import { FormSection, PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { MODULE_THEMES } from '@/lib/design/modules';
import { cn } from '@/components/ui/cn';
import { RideSummary } from '../_components/RideSummary';

const RIDE_ICON = cn(MODULE_THEMES.ride.tint, MODULE_THEMES.ride.text);
const timeSelectClass =
  'w-full h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink focus:outline-none focus:ring-3 focus:ring-ride/30 focus:border-ride-deep';

export default function OfferRidePage() {
  const { activePersona, society, user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  // Day chips depend on today's date in India, so they're built in the browser
  const isClient = useIsClient();
  const next7Days = isClient ? upcomingIstDays(7) : [];
  const minDate = next7Days[0]?.dateStr ?? '';
  const maxDate = next7Days[next7Days.length - 1]?.dateStr ?? '';
  const [pickedDate, setJourneyDate] = useState('');
  // Defaults to tomorrow until the offerer picks a day
  const journeyDate = pickedDate || next7Days[1]?.dateStr || '';
  // Starts at the society by default; either end can change, and swapping makes a return trip
  const [from, setFrom] = useState<RouteEndpoint>(SOCIETY_ENDPOINT);
  const [to, setTo] = useState<RouteEndpoint>(EMPTY_PLACE);
  const [formError, setFormError] = useState('');
  const [timeWindowStart, setTimeWindowStart] = useState('08:00');
  const [timeWindowEnd, setTimeWindowEnd] = useState('08:20');
  const [seats, setSeats] = useState(2);
  const [genderPref, setGenderPref] = useState('ANY');
  const [meetingPoint, setMeetingPoint] = useState('');
  // Repeat every week on these days (1 = Monday … 7 = Sunday)
  const [repeat, setRepeat] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [resultText, setResultText] = useState('');
  const pickupPoints = society?.settings?.pickupPoints ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clash, setClash] = useState('');
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const maxSeats = Math.max(1, Math.min(4, selectedVehicle?.capacity ?? 4));
  const seatCount = Math.min(seats, maxSeats);
  // Today: only times still ahead (read in the browser, where the clock is)
  const isToday = isClient && journeyDate === next7Days[0]?.dateStr;
  const earliestAfter = isToday ? istTimeHHMM(new Date().toISOString()) : undefined;

  /**
   * This page keeps its state when the resident navigates away and back, so
   * a finished offer is cleared before leaving: the next visit starts fresh.
   */
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef = useRef<() => void>(() => {});
  // Leaving before the redirect (the page is hidden, not destroyed): clear it all the same
  useEffect(
    () => () => {
      if (leaveTimer.current) resetRef.current();
    },
    []
  );
  const resetForm = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    setSuccess(false);
    setResultText('');
    setFormError('');
    setJourneyDate('');
    setFrom(SOCIETY_ENDPOINT);
    setTo(EMPTY_PLACE);
    setTimeWindowStart('08:00');
    setTimeWindowEnd('08:20');
    setSeats(2);
    setGenderPref('ANY');
    setMeetingPoint('');
    setRepeat(false);
    setRepeatDays([1, 2, 3, 4, 5]);
  };
  useEffect(() => {
    resetRef.current = resetForm;
  });

  useEffect(() => {
    async function loadVehicles() {
      const res = await apiFetch('/api/v1/user/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
        if (data.vehicles?.length > 0) {
          setSelectedVehicleId(data.vehicles[0].id);
        }
      }
    }
    loadVehicles();
  }, [activePersona]);

  const handleSubmit = async (e?: React.FormEvent, allowClash = false) => {
    e?.preventDefault();
    if (!selectedVehicleId) return;
    setFormError('');

    if (!society) return;
    if (from.kind === 'PLACE' && !from.place) {
      setFormError('Please choose your starting point from the suggestions list.');
      return;
    }
    if (to.kind === 'PLACE' && !to.place) {
      setFormError('Please choose your destination from the suggestions list.');
      return;
    }
    if (repeat && repeatDays.length === 0) {
      setFormError('Pick at least one day to repeat on.');
      return;
    }
    if (earliestAfter && timeWindowStart <= earliestAfter) {
      setFormError('That time has already passed today. Pick a later time or another day.');
      return;
    }
    if (timeWindowEnd <= timeWindowStart) {
      setFormError('The latest departure time must be after the earliest.');
      return;
    }

    const origin =
      from.kind === 'PLACE' && from.place
        ? { originName: from.name, originLat: from.place.lat, originLng: from.place.lng }
        : {}; // the server starts rides at the society
    const destination =
      to.kind === 'PLACE' && to.place
        ? {
            destinationName: to.name,
            destinationPlaceId: to.place.placeId,
            destinationLat: to.place.lat,
            destinationLng: to.place.lng,
          }
        : { destinationName: society.name, destinationLat: society.latitude, destinationLng: society.longitude };

    setIsSubmitting(true);
    const dateStr = journeyDate || next7Days[0]?.dateStr;

    try {
      const res = await apiFetch('/api/v1/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          journeyDate: dateStr,
          direction: routeDirection(to),
          ...origin,
          // Meeting points are places inside the society, so only for rides that start there
          ...(from.kind !== 'PLACE' && meetingPoint.trim() ? { meetingPoint: meetingPoint.trim() } : {}),
          ...destination,
          departureWindowStart: istDateTime(dateStr, timeWindowStart),
          departureWindowEnd: istDateTime(dateStr, timeWindowEnd),
          totalSeats: seatCount,
          genderPreference: genderPref,
          ...(repeat && repeatDays.length ? { repeatDays } : {}),
          ...(allowClash ? { allowClash: true } : {}),
        }),
      });

      const warning = await clashWarning(res);
      if (warning) {
        setClash(warning);
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Could not offer this ride. Please try again.');
      } else {
        const data = await res.json().catch(() => ({}));
        setResultText(
          repeat
            ? `Repeating ride saved. ${data.ridesCreated ?? 0} ride${data.ridesCreated === 1 ? '' : 's'} planned for the coming week; new ones are added automatically.`
            : 'Fellow residents with compatible commutes can now find and request your seats.'
        );
        setSuccess(true);
        leaveTimer.current = setTimeout(() => {
          resetForm();
          router.push('/rides');
        }, 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live preview (desktop): built only from what has been typed, nothing invented
  const previewDestination = to.kind === 'PLACE' ? to.name || 'Choose a destination' : society?.name ?? 'Your society';
  const previewFrom = from.kind === 'PLACE' ? from.name || 'Choose a starting point' : meetingPoint || society?.name || 'Your society';
  const previewWhen = journeyDate ? `${relativeDayLabel(journeyDate)}, ${formatHHMM12(timeWindowStart)}` : formatHHMM12(timeWindowStart);
  // Same masking the API applies before a request is accepted ("Ashutosh D.")
  const nameParts = (user?.fullName ?? '').trim().split(' ').filter(Boolean);
  const previewName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.` : nameParts[0];
  const previewVehicle = selectedVehicle ? [selectedVehicle.color, selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ') : undefined;

  return (
    <PageContainer width="default" className="grid gap-6">
      <ModuleHeader module="ride" title="Offer a ride" backHref="/rides" backLabel="Back to RideShare" />

      {success ? (
        <Card padding="lg" className="grid justify-items-center text-center gap-3 py-12">
          <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </span>
          <h2 className="font-display text-section font-bold text-ink">{repeat ? 'Repeating ride saved' : 'Ride offered!'}</h2>
          <p role="status" className="text-support text-ink-muted max-w-md">
            {resultText}
          </p>
          <Button variant="tonal" tone="ride" onClick={resetForm}>
            Offer another ride
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="grid gap-4 min-w-0">
            <FormSection title="Route" description="Where you start and where you are going" icon={MapPin} iconClassName={RIDE_ICON}>
              {/* From / To, with a swap for the trip back to the society */}
              <RouteEndpoints
                societyName={society?.name ?? 'Your society'}
                from={from}
                to={to}
                required
                onChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
              />
              {from.kind !== 'PLACE' && (
                <div className="grid gap-1.5">
                  <OptionPicker
                    label="Pick-up point"
                    options={pickupPoints}
                    value={meetingPoint}
                    onChange={setMeetingPoint}
                    otherPlaceholder={pickupPoints.length ? 'Or type another spot, e.g. Tower C lobby' : 'e.g. Main Gate or Tower B3 lobby'}
                  />
                  <p className="text-meta text-ink-muted">Where fellow residents should meet you.</p>
                </div>
              )}
            </FormSection>

            <FormSection title="When" description="Up to 7 days ahead" icon={CalendarDays} iconClassName={RIDE_ICON}>
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Date">
                {next7Days.map((d) => {
                  const isSelected = journeyDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${d.weekday} ${d.label}`}
                      onClick={() => setJourneyDate(d.dateStr)}
                      className={cn(
                        'flex flex-col items-center justify-center min-w-[72px] h-16 px-2 rounded-control border text-center transition-colors shrink-0',
                        isSelected ? 'bg-ride-deep text-ink-inverse border-ride-deep' : 'bg-surface text-ink border-line hover:border-line-strong'
                      )}
                    >
                      <span className="text-tag font-semibold uppercase">{d.weekday}</span>
                      <span className="text-support font-bold">{d.label}</span>
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="Journey date"
                type="date"
                required
                value={journeyDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                className={timeSelectClass}
              />
              <div className="grid gap-2 pt-1 border-t border-line">
                <Checkbox
                  id="repeat-weekly"
                  label="Repeat every week"
                  description="For your regular commute; rides are added a week ahead"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                {repeat && (
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label="Days to repeat">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                      const value = i + 1;
                      const on = repeatDays.includes(value);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setRepeatDays(on ? repeatDays.filter((d) => d !== value) : [...repeatDays, value].sort())}
                          className={cn(
                            'h-11 rounded-control text-meta font-semibold border transition-colors',
                            on ? 'bg-ride-deep border-ride-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink'
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection title="Departure window" description="The earliest and latest you will leave" icon={Clock} iconClassName={RIDE_ICON}>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label htmlFor="time-earliest" className="text-support font-semibold text-ink">
                    Earliest
                  </label>
                  <TimeSelect
                    id="time-earliest"
                    value={timeWindowStart}
                    after={earliestAfter}
                    until="23:50"
                    onChange={(t) => {
                      setTimeWindowStart(t);
                      // The latest time must stay after the earliest
                      if (timeWindowEnd <= t) setTimeWindowEnd(addMinutesHHMM(t, 15));
                    }}
                    className={timeSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="time-latest" className="text-support font-semibold text-ink">
                    Latest
                  </label>
                  <TimeSelect id="time-latest" value={timeWindowEnd} after={timeWindowStart} onChange={setTimeWindowEnd} className={timeSelectClass} />
                </div>
              </div>
            </FormSection>

            <FormSection title="Seats and who can join" icon={Users} iconClassName={RIDE_ICON}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Select id="available-seats" label="Available seats" value={seatCount} onChange={(e) => setSeats(Number(e.target.value))}>
                  {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} seat{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </Select>
                <Select id="gender-preference" label="Who can join" value={genderPref} onChange={(e) => setGenderPref(e.target.value)}>
                  <option value="ANY">Anyone</option>
                  <option value="FEMALE_ONLY">Women only</option>
                  <option value="MALE_ONLY">Men only</option>
                </Select>
              </div>
            </FormSection>

            <FormSection title="Vehicle" icon={Car} iconClassName={RIDE_ICON}>
              {vehicles.length > 0 ? (
                <Select id="vehicle" label="Car" value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.color} {v.make} {v.model} ({v.registrationNumber}) {v.mileageKmPerLitre ? `· ${v.mileageKmPerLitre} km/L` : ''}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="p-3 rounded-control bg-warning-bg text-support text-ink">
                  No vehicles registered.{' '}
                  <Link href="/profile" className="font-semibold text-ride-deep underline">
                    Add your car in your profile
                  </Link>{' '}
                  to offer rides.
                </p>
              )}
              <ul className="grid gap-1 text-meta text-ink-muted list-disc pl-4">
                <li>Fuel share is an estimate from your car&apos;s mileage (about ₹103 a litre). Riders settle with you in person; the app takes no payments.</li>
                <li>Your number plate stays hidden until you accept a request.</li>
              </ul>
            </FormSection>

            {/* Publish: kept in reach above the tab bar on phones */}
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:static z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 lg:py-0 bg-ivory/95 backdrop-blur-sm lg:bg-transparent grid gap-2">
              {formError && (
                <div role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
                  {formError}
                </div>
              )}
              <Button type="submit" tone="ride" size="lg" fullWidth loading={isSubmitting} disabled={!selectedVehicleId}>
                {isSubmitting ? 'Publishing…' : repeat ? 'Save repeating ride' : 'Publish ride'}
              </Button>
            </div>
          </div>

          {/* Live preview of how neighbours will see the ride (desktop) */}
          <aside aria-label="Preview" className="hidden lg:grid gap-2 sticky top-24">
            <p className="text-tag font-semibold uppercase tracking-wider text-ink-muted">How neighbours will see it</p>
            <Card raised>
              <RideSummary
                when={previewWhen}
                destination={previewDestination}
                from={previewFrom}
                seatsLeft={seatCount}
                offererName={previewName}
                vehicle={previewVehicle}
              />
            </Card>
            <p className="text-meta text-ink-muted">Neighbours see your first name and initial until you accept their request.</p>
          </aside>
        </form>
      )}
      <ConfirmDialog
        open={clash !== ''}
        title="You already have a ride then"
        description={clash}
        confirmLabel="Offer anyway"
        cancelLabel="Change time"
        onCancel={() => setClash('')}
        onConfirm={() => {
          setClash('');
          void handleSubmit(undefined, true);
        }}
      />
    </PageContainer>
  );
}
