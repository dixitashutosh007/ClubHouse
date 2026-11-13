'use client';

import { apiFetch } from '@/lib/api-client';
import { useIsClient } from '@/hooks/useIsClient';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
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
import { SuggestChangeButton } from '@/components/SuggestChangeButton';
import { addMinutesHHMM, istDateTime, upcomingIstDays } from '@/lib/utils/time';

export default function OfferRidePage() {
  const { activePersona, society } = useAuth();
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
  const pickupPoints = society?.settings?.pickupPoints ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          totalSeats: seats,
          genderPreference: genderPref,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Could not offer this ride. Please try again.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/rides');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/rides"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Offer a Ride</h1>
          <p className="text-xs text-zinc-500">Share your commute with co-residents</p>
        </div>
      </div>

      {success ? (
        <div className="my-auto text-center py-12 px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Ride Offered!</h2>
          <p className="text-xs text-zinc-500 mb-6">
            Fellow residents with compatible commutes will be able to discover and request your available seats.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
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
            <div className="space-y-1.5">
              <OptionPicker
                label="Pick-up point"
                options={pickupPoints}
                value={meetingPoint}
                onChange={setMeetingPoint}
                otherPlaceholder={pickupPoints.length ? 'Or type another spot, e.g. Tower C lobby' : 'e.g. Main Gate or Tower B3 lobby'}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                <span>Where fellow residents should meet you.</span>
                <SuggestChangeButton module="RIDESHARE" topic="RideShare pick-up points" />
              </div>
            </div>
          )}

          {/* Date Selection (Next 7 Days) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700">Select Date (Next 7 Days)</label>
              <span className="text-[10px] text-zinc-500">Up to 7 days ahead</span>
            </div>

            {/* Quick 7-Day Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {next7Days.map((d) => {
                const isSelected = journeyDate === d.dateStr;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setJourneyDate(d.dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[70px] px-2.5 py-2 rounded-xl border text-center transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/30'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase">{d.weekday}</span>
                    <span className="text-xs font-bold mt-0.5">{d.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1">
              <input
                aria-label="Journey date"
                type="date"
                required
                value={journeyDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Departure Time Window */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-700">Departure Window</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="time-earliest" className="text-[10px] text-zinc-500 block mb-0.5">Earliest</label>
                <TimeSelect
                  id="time-earliest"
                  value={timeWindowStart}
                  until="23:50"
                  onChange={(t) => {
                    setTimeWindowStart(t);
                    // The latest time must stay after the earliest
                    if (timeWindowEnd <= t) setTimeWindowEnd(addMinutesHHMM(t, 15));
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="time-latest" className="text-[10px] text-zinc-500 block mb-0.5">Latest</label>
                <TimeSelect
                  id="time-latest"
                  value={timeWindowEnd}
                  after={timeWindowStart}
                  onChange={setTimeWindowEnd}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Seats & Vehicle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="available-seats" className="text-xs font-semibold text-zinc-700 block mb-1">Available Seats</label>
              <select
                id="available-seats"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 seat</option>
                <option value={2}>2 seats (Recommended)</option>
                <option value={3}>3 seats</option>
                <option value={4}>4 seats</option>
              </select>
            </div>
            <div>
              <label htmlFor="gender-preference" className="text-xs font-semibold text-zinc-700 block mb-1">Gender Preference</label>
              <select
                id="gender-preference"
                value={genderPref}
                onChange={(e) => setGenderPref(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ANY">Any</option>
                <option value="FEMALE_ONLY">Female Only</option>
                <option value="MALE_ONLY">Male Only</option>
              </select>
            </div>
          </div>

          {/* Vehicle Selector */}
          <div className="space-y-1">
            <label htmlFor="vehicle" className="text-xs font-semibold text-zinc-700">Vehicle</label>
            {vehicles.length > 0 ? (
              <select
                id="vehicle"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.color} {v.make} {v.model} ({v.registrationNumber}) {v.mileageKmPerLitre ? `· ${v.mileageKmPerLitre} km/L` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
                No vehicles registered. Register your car first.
              </div>
            )}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-900">
                <span>⛽ Fuel Sharing Advisory</span>
              </div>
              <p className="text-[10px] text-emerald-800 leading-relaxed">
                RideShare estimates fair fuel points based on your vehicle&apos;s fuel mileage (~₹103/L). Passengers settle directly with you in person (cash/UPI). The platform processes zero payments.
              </p>
            </div>
            <p className="text-[10px] text-zinc-500">
              Registration number is masked until you accept a ride request.
            </p>
          </div>

          {formError && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !selectedVehicleId}
              className="w-full py-3.5 rounded-2xl bg-emerald-700 text-white font-semibold text-xs active:scale-98 transition-all hover:bg-emerald-800 disabled:opacity-50 shadow-md shadow-emerald-600/20"
            >
              {isSubmitting ? 'Publishing Ride...' : 'Publish Ride Offer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
