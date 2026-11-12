'use client';

import { apiFetch } from '@/lib/api-client';
import { Loading, LoadError } from '@/components/ui/LoadState';
import { formatIstTime, istDateString, relativeDayLabel } from '@/lib/utils/time';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Car,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  Sparkles,
  MessageSquare,
  ShieldAlert,
  Check,
  XCircle,
  Phone,
  Repeat,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommuteMatch, PublicJourneyView, RideOccurrence } from '@/types';
import { NotificationBell } from '@/components/NotificationBell';
import { RideRequestAction } from '@/components/RideRequestAction';
import { TripSafetyActions } from '@/components/TripSafetyActions';
import { ClubHouseLoading } from '@/components/ClubHouseLoading';
import { APP_NAME, RIDESHARE_NAME } from '@/lib/brand';
import { PhoneOtpModal } from '@/components/PhoneOtpModal';
import { SplashScreen } from '@/components/SplashScreen';
import { ResidentOnboardingModal } from '@/components/ResidentOnboardingModal';
import { AppHubScreen } from '@/components/AppHubScreen';

export default function HomePage() {
  const router = useRouter();
  const { user, society, membership, activePersona, updateCommuteIntent, isAuthenticated, isLoading } = useAuth();
  const [rides, setRides] = useState<PublicJourneyView[]>([]);
  const [matches, setMatches] = useState<
    { match: CommuteMatch; journey: RideOccurrence; offererName: string; vehicleModel: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const isApproved = membership?.status === 'ACTIVE';

  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadError('');
        // Load available rides
        const res = await apiFetch('/api/v1/rides');
        if (res.ok) {
          const data = await res.json();
          setRides(data.rides || []);
        } else if (res.status !== 401 && res.status !== 403) {
          setLoadError('Could not load society rides.');
        }

        // Matches need the resident's saved work location
        if (user?.workLatitude !== undefined && user?.workLongitude !== undefined) {
          const matchRes = await apiFetch('/api/v1/rides/matches', {
            json: {
              dropoffName: user.workLocationName,
              dropoffLat: user.workLatitude,
              dropoffLng: user.workLongitude,
            },
          });
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            setMatches(matchData.matches || []);
          }
        } else {
          setMatches([]);
        }
      } catch {
        setLoadError('Connection problem. Check your internet and try again.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activePersona, user?.workLatitude, user?.workLongitude, user?.workLocationName, reloadKey]);


  const firstName = user?.fullName.split(' ')[0] || 'Resident';

  // Until the session check finishes, show neither the dashboard nor the sign-in screen
  if (isLoading) {
    return <ClubHouseLoading />;
  }

  // Step 1: First Screen is Splash Screen flashing product and below that Login or Sign Up
  if (!isAuthenticated) {
    return <SplashScreen />;
  }

  // Check onboarding necessity: only when user has not completed onboarding and is not already submitted for approval
  const needsOnboarding = user && user.profileCompleted === false && user.fullName === 'Resident Member' && membership?.status !== 'PENDING_APPROVAL';
  const isPendingApproval = membership?.status === 'PENDING_APPROVAL' || membership?.status === 'REGISTERED';
  const isRejected = membership?.status === 'REJECTED' || membership?.status === 'SUSPENDED';

  // State A: Profile not completed yet -> Force Onboarding Modal
  if (!isLoading && isAuthenticated && needsOnboarding) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[90vh] p-6 bg-slate-900 text-white text-center">
        <ResidentOnboardingModal
          isOpen={true}
          onCompleted={() => {
            setShowOnboarding(false);
          }}
        />
        <div className="max-w-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold">Complete Resident Verification</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Please complete your mandatory profile details (flat number, name, email & commute role) to submit your membership for validation.
          </p>
        </div>
      </div>
    );
  }

  // State B: Profile completed, but account pending verification by Society Admin
  if (!isLoading && isAuthenticated && isPendingApproval) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[85vh] p-6 text-center bg-slate-50">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-white border border-amber-200/80 shadow-lg flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center shadow-inner">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Under Verification
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-2">
              Your Account is Not Yet Validated
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Your resident application for <span className="font-bold text-slate-800">{society?.name ?? 'your society'}</span> (Flat <span className="font-bold text-slate-800">{membership?.flatNumber || 'Submitted'}</span>) is pending review by the Society Management Committee.
            </p>
          </div>

          <div className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">Registered Member:</span>
              <span className="font-bold text-slate-800">{user?.fullName}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">Verified Phone:</span>
              <span className="font-mono font-bold text-slate-800">{user?.mobile}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">Status:</span>
              <span className="font-bold text-amber-700">Pending Admin Approval</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            For security, community apps (RideShare, Directory) unlock automatically once approved by your society admin.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
          >
            Check Status Again
          </button>
        </div>
      </div>
    );
  }

  // State C: Rejected / Suspended account
  if (!isLoading && isAuthenticated && isRejected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[85vh] p-6 text-center bg-slate-50">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-white border border-rose-200 shadow-lg flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Your society membership could not be verified by the admin. Please contact your society office for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State D: Validated Active resident -> Select from Apps Suite
  if (!isLoading && isAuthenticated && selectedApp !== 'rideshare') {
    return (
      <AppHubScreen
        onSelectApp={(appId) => {
          if (appId === 'lessons') {
            router.push('/lessons');
            return;
          }
          setSelectedApp(appId);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-8">
      {/* Resident Profile Fill-in Modal */}
      <ResidentOnboardingModal
        isOpen={showOnboarding}
        onCompleted={() => {
          setShowOnboarding(false);
        }}
      />
      {/* Header */}
      <header className="p-5 bg-gradient-to-b from-white via-white to-slate-50/80 border-b border-slate-200/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
                {RIDESHARE_NAME} · {APP_NAME}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Good morning, {firstName}
                </h1>
                {/* Simplified Checkmark: Green Check if Approved, Red Warning if Pending */}
                {isApproved ? (
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-xs"
                    title="Verified & Approved Resident"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white shadow-xs"
                    title="Pending Admin Review"
                  >
                    <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {membership?.flatNumber ? `Flat ${membership.flatNumber} · ` : ''}
                {membership?.role === 'SUPER_ADMIN'
                  ? 'App Admin'
                  : membership?.role === 'SOCIETY_ADMIN'
                    ? 'Society Admin'
                    : 'Resident'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOtpModal(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all border border-slate-200/70 shadow-2xs active:scale-95 cursor-pointer"
              title="Firebase Mobile Login"
            >
              <Phone className="w-4 h-4 text-emerald-700" />
            </button>
            <NotificationBell />
          </div>
        </div>

        {/* Profile Question: Are you an Offerer, Seeker, or Both? (Requirement 6) */}
        <div className="mt-4 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Commute Preference
            </span>
            <span className="text-[10px] font-medium text-slate-500">Sets your default view</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button
              onClick={() => updateCommuteIntent('OFFERER')}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                user?.commuteIntent === 'OFFERER'
                  ? 'bg-emerald-700 text-white shadow-sm font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Offer Rides</span>
            </button>
            <button
              onClick={() => updateCommuteIntent('SEEKER')}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                user?.commuteIntent === 'SEEKER' || !user?.commuteIntent
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Find Rides</span>
            </button>
            <button
              onClick={() => updateCommuteIntent('BOTH')}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                user?.commuteIntent === 'BOTH'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span>Both</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Core CTAs: Find a Ride & Offer a Ride */}
      <div className="p-5 pb-3 grid grid-cols-2 gap-3.5">
        <Link
          href="/rides/find"
          className="flex flex-col items-start p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer group"
        >
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
            <Search className="w-5 h-5" />
          </div>
          <span className="font-bold text-base leading-tight">Find a Ride</span>
          <span className="text-slate-500 text-xs mt-1">Join a co-resident commute</span>
        </Link>

        <Link
          href="/rides/offer"
          className="flex flex-col items-start p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-700/80 border border-emerald-500/60 text-emerald-100 mb-3 group-hover:scale-105 transition-transform">
            <Car className="w-5 h-5" />
          </div>
          <span className="font-bold text-base leading-tight">Offer a Ride</span>
          <span className="text-emerald-100 text-xs mt-1">Share seats along your way</span>
        </Link>
      </div>

      {/* Quick Navigation for Offerer & Seeker Activities */}
      <div className="px-5 mb-4 grid grid-cols-2 gap-2 text-xs">
        <Link
          href="/rides/my-rides"
          className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 font-semibold flex items-center justify-between hover:bg-zinc-100 transition-colors"
        >
          <span>My Offered Rides</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        </Link>
        <Link
          href="/rides/my-requests"
          className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 font-semibold flex items-center justify-between hover:bg-zinc-100 transition-colors"
        >
          <span>My Ride Requests</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        </Link>
      </div>

      {/* Admin Quick Link if admin */}
      {(membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN') && (
        <div className="px-5 mb-4">
          <Link
            href="/admin"
            className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-950 text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Admin Portal (Approvals & Moderation)</span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </Link>
        </div>
      )}

      {/* Matches For You */}
      {user && (user.workLatitude === undefined || user.workLongitude === undefined) && (
        <div className="mx-5 mb-4 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
          Pick your work location in{' '}
          <Link href="/profile" className="font-semibold underline">
            your profile
          </Link>{' '}
          to see rides that match your commute.
        </div>
      )}

      {matches.length > 0 && (
        <section className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                Matches for Your Commute
              </h2>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {matches.length} active
            </span>
          </div>

          <div className="space-y-2.5">
            {matches.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                    {formatIstTime(item.journey.departureWindowStart)} – {formatIstTime(item.journey.departureWindowEnd)}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-700 text-white">
                    {item.match.qualityLabel} Match
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-medium text-zinc-800">{item.journey.destinationName}</span>
                  </div>
                  <span className="text-zinc-500">Detour: ~{item.match.detourMinutes} min</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-xs">
                  <span className="text-zinc-600 font-medium">Offered by {item.offererName}</span>
                  <span className="text-emerald-700 font-semibold">{item.journey.availableSeats} seats left</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Rides Feed */}
      <section className="px-5 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Available Society Rides
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">Today & Upcoming</span>
        </div>

        {loading ? (
          <Loading label="Loading society rides…" />
        ) : loadError ? (
          <LoadError message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : rides.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-300 bg-white/70 shadow-2xs">
            <Car className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-700">No rides scheduled for this window</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Be the first to offer a seat!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rides.map((ride) => {
              const isAccepted = ride.userRequestStatus === 'ACCEPTED';

              return (
                <div
                  key={ride.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col gap-3"
                >
                  {/* Card Header: Driver & Badge (Requirement 2 & 3: Clean, No Car Details, Simple Green Check) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {ride.offerer.displayName}
                      </span>
                      {/* Simple Green Check */}
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-2xs"
                        title="Verified Resident"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    </div>
                    <div>
                      <span className="inline-block text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                        {ride.availableSeats} of {ride.totalSeats} seats left
                      </span>
                    </div>
                  </div>

                  {/* Route & Timing */}
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-bold text-slate-900">
                          {formatIstTime(ride.departureWindowStart)}
                          {' – '}
                          {formatIstTime(ride.departureWindowEnd)}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {ride.journeyDate === istDateString()
                          ? 'Today'
                          : ride.journeyDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{ride.destinationName}</span>
                    </div>

                    {/* Requirement 2: Advisory Fuel Share Points (Zero app payments, in-person settlement) */}
                    {ride.fuelSharePointsEstimate && (
                      <div className="pt-1.5 mt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-slate-700">
                          <span className="font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                            ⛽ ~{ride.fuelSharePointsEstimate.perPassengerPoints} Fuel Points
                          </span>
                          <span className="text-slate-500">({ride.vehicle?.model || 'Car'} · {ride.fuelSharePointsEstimate.vehicleMileageKmPerLitre} km/L)</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium" title="Settle directly with driver in person. No app payments.">
                          In-person settlement
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact Revealed when accepted */}
                  {isAccepted && ride.offerer.mobile && (
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex flex-col gap-1.5">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Commute Confirmed! Driver details unlocked:
                      </span>
                      <div className="flex items-center justify-between pt-1">
                        <span>Flat <span className="font-bold">{ride.offerer.flatNumber}</span></span>
                        <a
                          href={`tel:${ride.offerer.mobile}`}
                          className="font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 shadow-2xs"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call Driver</span>
                        </a>
                      </div>
                      <TripSafetyActions
                        trip={{
                          driverName: ride.offerer.displayName,
                          vehicle: [ride.vehicle.color, ride.vehicle.make, ride.vehicle.model].filter(Boolean).join(' '),
                          plate: ride.vehicle.registrationNumber,
                          from: ride.originName,
                          to: ride.destinationName,
                          when: `${relativeDayLabel(ride.journeyDate)}, ${formatIstTime(ride.departureWindowStart)}`,
                        }}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-medium truncate mr-2">
                      From {ride.meetingPoint ? `${ride.meetingPoint}, ` : ''}
                      {ride.originName}
                    </span>
                    <RideRequestAction ride={ride} currentUserId={user?.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Safety & Feedback Quick Links */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2 text-xs">
        <Link
          href="/feedback"
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-[11px]">Leave Feedback</span>
        </Link>
        <Link
          href="/report"
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100/70 transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span className="font-semibold text-[11px]">Report an Issue</span>
        </Link>
      </div>

      {/* Community Disclaimer Footer */}
      <footer className="mt-6 px-5 pt-4 border-t border-zinc-100 text-center">
        <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-semibold">Community Facilitation Service</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
          RideShare connects verified co-residents travelling in compatible directions. We do not provide transportation or guarantee safety and punctuality. Residents independently verify vehicle and arrangements.
        </p>
      </footer>

      {/* Firebase Phone Auth OTP Modal */}
      <PhoneOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        defaultMobile={user?.mobile}
        onSuccess={() => {
          setShowOtpModal(false);
        }}
      />
    </div>
  );
}
