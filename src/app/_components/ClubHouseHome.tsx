'use client';

import { apiFetch } from '@/lib/api-client';
import { LoadError } from '@/components/ui/LoadState';
import { SkeletonCard } from '@/components/ui/States';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, MapPin, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { PublicJourneyView } from '@/types';
import { useRideActivity } from '@/lib/ride-activity';
import { ClubHouseLoading } from '@/components/ClubHouseLoading';
import { UpcomingRidesList } from '@/app/rides/_components/UpcomingRidesList';
import { RideFeed } from '@/app/rides/_components/RideFeed';
import { SplashScreen } from '@/components/SplashScreen';
import { ResidentOnboardingModal } from '@/components/ResidentOnboardingModal';
import { AppHubScreen } from '@/components/AppHubScreen';
import { PendingApprovalScreen } from './PendingApprovalScreen';

/**
 * The signed-in home screens: the Club House hub (`/`) and the RideShare
 * dashboard (`/rides`). Both share the sign-in, onboarding and approval gates.
 */
export function ClubHouseHome({ view }: { view: 'hub' | 'rideshare' }) {
  const { user, membership, activePersona, isAuthenticated, isLoading, logout } = useAuth();
  const [rides, setRides] = useState<PublicJourneyView[]>([]);
  // Rides that fit the resident's commute, marked in the list
  const [matchIds, setMatchIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const isApproved = membership?.status === 'ACTIVE';

  const [loadError, setLoadError] = useState('');
  // Ask for a work location only when none is saved, or it can't be placed on the map
  const [workLocationUnknown, setWorkLocationUnknown] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Background refreshes (new requests, acceptances) update the list without a loading flash
  const silentReload = useRef(false);
  useRideActivity(() => {
    silentReload.current = true;
    setReloadKey((k) => k + 1);
  });

  useEffect(() => {
    // Home shows the app cards only; rides load on the RideShare page
    if (view !== 'rideshare' || !isAuthenticated) return;
    async function loadData() {
      try {
        if (!silentReload.current) setLoading(true);
        silentReload.current = false;
        setLoadError('');
        const hasCoords = user?.workLatitude != null && user?.workLongitude != null;
        // Rides and commute matches load together
        const [res, matchRes] = await Promise.all([
          apiFetch('/api/v1/rides'),
          user?.workLocationName
            ? apiFetch('/api/v1/rides/matches', {
                json: {
                  dropoffName: user.workLocationName,
                  ...(hasCoords ? { dropoffLat: user.workLatitude, dropoffLng: user.workLongitude } : {}),
                },
              })
            : Promise.resolve(null),
        ]);
        if (res.ok) {
          const data = (await res.json()) as { rides?: PublicJourneyView[] };
          // Only rides that have not left yet (checked when the data arrives)
          const now = Date.now();
          setRides((data.rides ?? []).filter((r) => Date.parse(r.departureWindowStart) > now));
        } else if (res.status !== 401 && res.status !== 403) {
          setLoadError('Could not load society rides.');
        }
        if (matchRes?.ok) {
          const matchData = (await matchRes.json()) as { matches?: { journey: { id: string } }[]; needsLocation?: boolean };
          setMatchIds(new Set((matchData.matches ?? []).map((m) => m.journey.id)));
          setWorkLocationUnknown(Boolean(matchData.needsLocation));
        } else if (!user?.workLocationName) {
          setMatchIds(new Set());
          setWorkLocationUnknown(true);
        }
      } catch {
        setLoadError('Connection problem. Check your internet and try again.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [view, isAuthenticated, activePersona, user?.workLatitude, user?.workLongitude, user?.workLocationName, reloadKey]);

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
      <div className="flex-1 min-h-[90vh] bg-ivory">
        <ResidentOnboardingModal
          isOpen={true}
          onCompleted={() => {
            setShowOnboarding(false);
          }}
        />
      </div>
    );
  }

  // State B: Profile completed, but account pending verification by Society Admin
  if (!isLoading && isAuthenticated && isPendingApproval) {
    return <PendingApprovalScreen />;
  }

  // State C: Rejected / Suspended account
  if (!isLoading && isAuthenticated && isRejected) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[85vh] px-4 py-8 bg-ivory">
        <div className="w-full max-w-md p-6 rounded-sheet bg-surface border border-line shadow-raised grid gap-4">
          <span className="w-14 h-14 rounded-card bg-danger-bg text-danger flex items-center justify-center">
            <XCircle className="w-7 h-7" aria-hidden="true" />
          </span>
          <div className="grid gap-1">
            <h1 className="font-display text-section font-bold text-ink">
              {membership?.status === 'SUSPENDED' ? 'Your access is paused' : 'Your membership was not approved'}
            </h1>
            <p className="text-support text-ink-muted">
              {membership?.status === 'SUSPENDED'
                ? 'Your society admins have paused your access to the apps.'
                : 'Your society admin could not verify your membership.'}{' '}
              Please contact your society office for help.
            </p>
          </div>
          {membership?.rejectionReason && (
            <p className="p-3 rounded-control bg-sunken text-support text-ink">
              <span className="font-semibold">Note from your admin:</span> {membership.rejectionReason}
            </p>
          )}
          <Button variant="secondary" icon={LogOut} onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  // State D: Validated Active resident -> Select from Apps Suite
  if (!isLoading && isAuthenticated && view === 'hub') {
    return (
      <AppHubScreen />
    );
  }

  return (
    <PageContainer width="wide">
      {/* Resident Profile Fill-in Modal */}
      <ResidentOnboardingModal
        isOpen={showOnboarding}
        onCompleted={() => {
          setShowOnboarding(false);
        }}
      />
      <div className="grid gap-6">
        <ModuleHeader module="ride" description={isApproved ? 'Share your commute with neighbours' : 'Awaiting approval'} />

        {workLocationUnknown && (
          <p className="flex items-start gap-2 p-3 rounded-card border border-turmeric bg-turmeric-tint text-support text-ink">
            <MapPin className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {user?.workLocationName ? 'Choose your work location from the suggestions in ' : 'Add your work location in '}
              <Link href="/profile" className="font-semibold text-ride-deep underline">
                your profile
              </Link>{' '}
              to see which rides fit your route.
            </span>
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          {/* "Coming up" first on phones; a right-hand column on desktop */}
          <aside className="grid gap-6 content-start min-w-0 lg:col-start-2 lg:row-start-1">
            <UpcomingRidesList />
            <p className="hidden lg:block text-meta text-ink-muted">
              Neighbours share rides at their own discretion. No fares; settle fuel in person.
            </p>
          </aside>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            {loading ? (
              <div className="grid gap-3">
                <SkeletonCard label="Loading rides" />
                <SkeletonCard label="Loading rides" />
              </div>
            ) : loadError ? (
              <LoadError message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : (
              <RideFeed rides={rides} matchIds={matchIds} currentUserId={user?.id} onChanged={() => setReloadKey((k) => k + 1)} />
            )}
          </div>
        </div>

        <p className="lg:hidden text-center text-meta text-ink-muted">
          Neighbours share rides at their own discretion. No fares; settle fuel in person.
        </p>
      </div>
    </PageContainer>
  );
}
