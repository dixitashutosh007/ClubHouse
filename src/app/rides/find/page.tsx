'use client';

import { apiFetch } from '@/lib/api-client';
import { useRideActivity } from '@/lib/ride-activity';
import { useIsClient } from '@/hooks/useIsClient';
import { Loading, LoadError } from '@/components/ui/LoadState';
import { formatIstTime, relativeDayLabel, upcomingIstDays } from '@/lib/utils/time';
import { TimeSelect } from '@/components/ui/TimeSelect';
import { RideRequestAction } from '@/components/RideRequestAction';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Search, MapPin, Clock, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { PublicJourneyView } from '@/types';
import {
  EMPTY_PLACE,
  RouteEndpoint,
  RouteEndpoints,
  SOCIETY_ENDPOINT,
  routeDirection,
} from '@/components/RouteEndpoints';

export default function FindRidePage() {
  const { society, user } = useAuth();
  // From the society by default; swap to find rides back to the society
  const [from, setFrom] = useState<RouteEndpoint>(SOCIETY_ENDPOINT);
  const [to, setTo] = useState<RouteEndpoint>(EMPTY_PLACE);
  const [time, setTime] = useState('08:15');
  const [rides, setRides] = useState<PublicJourneyView[]>([]);
  const direction = routeDirection(to);
  // Older rides have no direction stored; they all left from the society
  const visibleRides = rides.filter((r) => (r.direction ?? 'OUTBOUND_SOCIETY') === direction);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState('ALL');
  // Day chips depend on today's date in India, so they're built in the browser
  const isClient = useIsClient();
  const next7Days = isClient
    ? [{ dateStr: 'ALL', label: 'All', weekday: 'Any Day' }, ...upcomingIstDays(7)]
    : [];

  const [loadError, setLoadError] = useState('');

  const handleSearch = async (e?: React.FormEvent, filterDate?: string, silent = false) => {
    if (e) e.preventDefault();
    if (!silent) setLoading(true);
    setLoadError('');
    setSearched(true);
    const dateQuery = (filterDate !== undefined ? filterDate : selectedDate) === 'ALL' ? '' : `?date=${filterDate || selectedDate}`;
    try {
      const res = await apiFetch(`/api/v1/rides${dateQuery}`);
      if (res.ok) {
        const data = await res.json();
        setRides(data.rides || []);
      } else {
        setLoadError('Could not load rides.');
      }
    } catch {
      setLoadError('Connection problem. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };


  // Keep results current when a request is answered or a ride changes
  useRideActivity(() => {
    if (searched) void handleSearch(undefined, undefined, true);
  });

  return (
    <div className="flex-1 flex flex-col p-5">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Find a Ride</h1>
          <p className="text-xs text-zinc-500">Search for co-residents driving your route</p>
        </div>
      </div>

      {/* Search Filter Form */}
      <form onSubmit={handleSearch} className="space-y-3 mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
        <RouteEndpoints
          societyName={society?.name ?? 'Your society'}
          from={from}
          to={to}
          onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />

        {/* 7-Days Date Selection Pills */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold text-zinc-600">Select Date (Next 7 Days)</label>
            <span className="text-[10px] text-zinc-500">Filter by commute day</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {next7Days.map((d) => {
              const isSelected = selectedDate === d.dateStr;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d.dateStr);
                    handleSearch(undefined, d.dateStr);
                  }}
                  className={`flex flex-col items-center justify-center min-w-[65px] px-2 py-1.5 rounded-xl border text-center transition-all shrink-0 ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <span className="text-[9px] font-semibold uppercase">{d.weekday}</span>
                  <span className="text-[11px] font-bold mt-0.5">{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="time" className="text-[11px] font-semibold text-zinc-600 block mb-1">Time</label>
            <TimeSelect
              id="time"
              value={time}
              onChange={setTime}
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
            />
          </div>
          <div>
            <label htmlFor="seats-needed" className="text-[11px] font-semibold text-zinc-600 block mb-1">Seats Needed</label>
            <select
              id="seats-needed"
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white">
              <option value="1">1 passenger</option>
              <option value="2">2 passengers</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search Compatible Rides</span>
        </button>
      </form>

      {/* Results */}
      <div className="flex-1">
        <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2.5">
          Available Results {searched && `(${visibleRides.length})`}
        </h2>

        {loading ? (
          <Loading label="Searching society rides…" />
        ) : loadError ? (
          <LoadError message={loadError} onRetry={() => void handleSearch()} />
        ) : visibleRides.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-500">
            {searched ? 'No matching rides found for this route window.' : 'Enter your destination to find rides.'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRides.map((ride) => {
              return (
                <div
                  key={ride.id}
                  className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900">
                        {ride.offerer.displayName}
                      </span>
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-2xs"
                        title="Verified Resident"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {ride.availableSeats} seats left
                    </span>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-2.5 text-xs text-zinc-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          {formatIstTime(ride.departureWindowStart)}
                          {' – '}
                          {formatIstTime(ride.departureWindowEnd)}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        {relativeDayLabel(ride.journeyDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      <span>
                        {ride.originName} → {ride.destinationName}
                      </span>
                    </div>
                    {ride.meetingPoint && (
                      <p className="text-[11px] text-zinc-700">
                        Pick-up point: <span className="font-semibold">{ride.meetingPoint}</span>
                      </p>
                    )}
                    {ride.fuelSharePointsEstimate && (
                      <div className="pt-1.5 mt-1 border-t border-zinc-200/60 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                          ⛽ ~{ride.fuelSharePointsEstimate.perPassengerPoints} Fuel Points
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          In-person settlement only
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600">
                      {ride.availableSeats} of {ride.totalSeats} seats free
                    </span>
                    <RideRequestAction key={ride.userRequestStatus ?? 'none'} ride={ride} currentUserId={user?.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
