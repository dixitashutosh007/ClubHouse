'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Car,
  CheckCircle2,
  Circle,
  Clock,
  Database,
  EyeOff,
  LogOut,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { PageContainer } from '@/components/ui/Layout';
import { Loading } from '@/components/ui/LoadState';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { profileChecklist } from '@/lib/profile-checklist';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { PlacesAutocompleteInput } from '@/components/PlacesAutocompleteInput';
import { Society, SocietyMembership, User, Vehicle } from '@/types';
import { EmailChangeDialog } from './_components/EmailChangeDialog';
import { PhoneChangeDialog } from './_components/PhoneChangeDialog';
import { VehiclesSection } from './_components/VehiclesSection';
import { FlatNumberInput } from '@/components/FlatNumberInput';
import { YourDataSection } from './_components/YourDataSection';
import { HiddenResidentsSection } from './_components/HiddenResidentsSection';
import { ProfilePhoto } from './_components/ProfilePhoto';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

export default function ProfilePage() {
  const { user, membership, society, refreshAuth, logout } = useAuth();

  if (!user) {
    return <Loading label="Loading your profile…" />;
  }

  // The form starts from the loaded profile; remount only for a different user
  return (
    <ProfileForm
      key={user.id}
      user={user}
      membership={membership}
      society={society}
      refreshAuth={refreshAuth}
      logout={logout}
    />
  );
}

interface ProfileFormProps {
  user: User;
  membership: SocietyMembership | null;
  society: Society | null;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

function ProfileForm({ user, membership, society, refreshAuth, logout }: ProfileFormProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [flatNumber, setFlatNumber] = useState(membership?.flatNumber ?? '');
  const [workLocation, setWorkLocation] = useState(user.workLocationName ?? '');
  const [workCoords, setWorkCoords] = useState<{ lat: number; lng: number } | null>(
    user.workLatitude !== undefined && user.workLongitude !== undefined
      ? { lat: user.workLatitude, lng: user.workLongitude }
      : null
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [dialog, setDialog] = useState<'PHONE' | 'EMAIL' | null>(null);

  const toast = useToast();
  // Success is a toast; a problem saving the form shows next to its Save button
  const notify = useCallback(
    (type: 'success' | 'error', text: string) => (type === 'success' ? toast.show(text) : setStatusMessage({ type, text })),
    [toast]
  );

  const savedWork = user.workLocationName ?? '';
  const dirty =
    fullName !== user.fullName ||
    flatNumber !== (membership?.flatNumber ?? '') ||
    workLocation !== savedWork;

  /**
   * The page keeps its state while the resident is elsewhere in the app, so
   * anything not saved (or rejected) is put back to the saved values when
   * they leave: coming back always shows what is really stored.
   */
  const discardRef = useRef<() => void>(() => {});
  useEffect(() => {
    discardRef.current = () => {
      setFullName(user.fullName);
      setFlatNumber(membership?.flatNumber ?? '');
      setWorkLocation(user.workLocationName ?? '');
      setWorkCoords(
        user.workLatitude !== undefined && user.workLongitude !== undefined
          ? { lat: user.workLatitude, lng: user.workLongitude }
          : null
      );
      setStatusMessage(null);
    };
  });
  useEffect(() => () => discardRef.current(), []);

  const loadVehicles = useCallback(async () => {
    const res = await apiFetch('/api/v1/user/vehicles');
    if (res.ok) setVehicles((await res.json()).vehicles ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadVehicles();
    });
    return () => {
      cancelled = true;
    };
  }, [loadVehicles]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/auth/me', {
        method: 'PUT',
        json: {
          fullName,
          flatNumber,
          workLocationName: workLocation,
          workLatitude: workCoords?.lat,
          workLongitude: workCoords?.lng,
        },
      });
      if (res.ok) {
        notify('success', 'Profile saved.');
        await refreshAuth();
      } else {
        notify('error', await apiErrorMessage(res, 'Failed to update profile'));
      }
    } finally {
      setSaving(false);
    }
  };

  const isApproved = membership?.status === 'ACTIVE';
  const checklist = profileChecklist(user, vehicles.length);
  const todo = checklist.filter((i) => !i.done);

  const NAV = [
    ['personal', 'Personal details'],
    ['home', 'Society and flat'],
    ['commute', 'Commute'],
    ['vehicles', 'Vehicles'],
    ['privacy', 'Privacy and visibility'],
    ['account', 'Account'],
    ['data', 'Data and account'],
  ] as const;

  return (
    <PageContainer width="default" className="grid gap-6">
      <div>
        <h1 className="font-display text-section md:text-page font-bold text-ink">Profile</h1>
        <p className="text-support text-ink-muted">{society?.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] items-start">
        <nav aria-label="Profile sections" className="hidden lg:block sticky top-24">
          <ul className="grid gap-0.5">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="flex items-center min-h-11 px-3 rounded-control text-support font-medium text-ink-muted hover:bg-sunken hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-4 min-w-0">
          {/* Photo and status */}
          <Card id="profile-photo" className="scroll-mt-24 grid gap-4 sm:p-6 [&>*]:min-w-0">
            <ProfilePhoto name={user.fullName} photoUrl={user.profilePhotoUrl} onSaved={refreshAuth} />
            <div className="flex flex-wrap items-center gap-2">
              {isApproved ? (
                <Badge status="success" icon={ShieldCheck}>
                  Approved resident
                </Badge>
              ) : (
                <Badge status="warning" icon={Clock}>
                  Waiting for admin approval
                </Badge>
              )}
              {membership?.flatNumber && <Badge>Flat {membership.flatNumber}</Badge>}
            </div>
          </Card>

          {todo.length > 0 && (
            <Card as="section" aria-labelledby="checklist-title" className="grid gap-3 bg-terracotta-tint border-terracotta/30">
              <div className="flex items-center justify-between gap-3">
                <h2 id="checklist-title" className="font-display text-card font-bold text-ink">
                  Complete your profile
                </h2>
                <span className="text-meta font-semibold text-terracotta-deep">
                  {checklist.length - todo.length} of {checklist.length} done
                </span>
              </div>
              <ul className="grid gap-1">
                {checklist.map((item) => (
                  <li key={item.id}>
                    {item.done ? (
                      <span className="flex items-center gap-2 min-h-11 text-support text-ink-muted line-through">
                        <CheckCircle2 className="w-5 h-5 text-success" aria-hidden="true" />
                        {item.label}
                        <span className="sr-only">(done)</span>
                      </span>
                    ) : (
                      <a href={item.href} className="flex items-center gap-2 min-h-11 text-support font-semibold text-terracotta-deep hover:underline">
                        <Circle className="w-5 h-5" aria-hidden="true" />
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <form onSubmit={handleSaveProfile} className="grid gap-4">
            <ProfileSection id="personal" title="Personal details" icon={UserRound}>
              <Input
                id="full-name"
                label="Full name"
                required
                autoComplete="name"
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <ReadOnlyRow
                id="mobile"
                label="Mobile number"
                value={user.mobile || 'Not set'}
                badge={user.mobile ? 'Verified by SMS' : undefined}
                onChange={() => setDialog('PHONE')}
              />
              <ReadOnlyRow id="email" label="Email" value={user.email || 'Not set'} onChange={() => setDialog('EMAIL')} />
            </ProfileSection>

            <ProfileSection id="home" title="Society and flat" icon={Building2}>
              <div className="grid gap-1.5">
                <span className="text-support font-semibold text-ink">Society</span>
                <p className="flex items-center h-11 px-3 rounded-control bg-sunken border border-line text-body text-ink">{society?.name ?? 'Not set'}</p>
              </div>
              <FlatNumberInput
                label="Flat number"
                config={society?.settings?.flatConfig}
                placeholder={society?.settings?.flat_format_example ? `Format: ${society.settings.flat_format_example}` : 'e.g. Tower B - 804'}
                value={flatNumber}
                onChange={setFlatNumber}
              />
            </ProfileSection>

            <ProfileSection id="commute" title="Commute" description="Used to show which rides fit your route" icon={MapPin}>
              <PlacesAutocompleteInput
                value={workLocation}
                onChange={(loc, place) => {
                  setWorkLocation(loc);
                  setWorkCoords(place ? { lat: place.lat, lng: place.lng } : null);
                }}
                placeholder="Search office, tech park or metro"
                label="Work location"
              />
            </ProfileSection>

            {/* Save: stays in reach on phones while there are unsaved changes */}
            <div
              className={cn(
                'grid gap-2 lg:static',
                dirty && 'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 lg:py-0 bg-ivory/95 backdrop-blur-sm lg:bg-transparent'
              )}
            >
              {statusMessage?.type === 'error' && (
                <p role="alert" className="flex items-start gap-2 p-3 rounded-control bg-danger-bg text-support text-danger">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {statusMessage.text}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" icon={Save} loading={saving} disabled={!dirty && !saving} className="flex-1 sm:flex-none">
                  Save changes
                </Button>
                {dirty && !saving && <span className="text-meta font-semibold text-warning">You have unsaved changes</span>}
              </div>
            </div>
          </form>

          <ProfileSection id="vehicles" title="Vehicles" description="Needed to offer rides (cars and two-wheelers)" icon={Car}>
            <VehiclesSection vehicles={vehicles} onAdded={loadVehicles} notify={notify} />
          </ProfileSection>

          <ProfileSection id="privacy" title="Privacy and visibility" icon={EyeOff}>
            <ul className="grid gap-2 text-support text-ink">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-success shrink-0" aria-hidden="true" />
                Neighbours see your first name and initial on rides you offer.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-success shrink-0" aria-hidden="true" />
                Your mobile, flat, photo and number plate are shared only with a ride partner, after a request is accepted.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-success shrink-0" aria-hidden="true" />
                Your gender is never shown to other residents.
              </li>
            </ul>
            <div className="grid gap-2 pt-3 border-t border-line">
              <h3 className="text-support font-semibold text-ink">Hidden residents</h3>
              <HiddenResidentsSection />
            </div>
          </ProfileSection>

          <ProfileSection id="account" title="Account" icon={UserRound}>
            <Button
              variant="secondary"
              icon={LogOut}
              loading={signingOut}
              className="justify-self-start"
              onClick={async () => {
                setSigningOut(true);
                await logout();
                router.replace('/');
              }}
            >
              Sign out
            </Button>
          </ProfileSection>

          <ProfileSection id="data" title="Data and account" icon={Database}>
            <YourDataSection
              societyName={society?.name}
              onGone={async () => {
                // Signed out on the server (deleted) or no longer a member (left); start from the beginning
                await logout();
                router.replace('/');
              }}
            />
          </ProfileSection>
        </div>
      </div>

      <PhoneChangeDialog
        open={dialog === 'PHONE'}
        userId={user.id}
        onClose={() => setDialog(null)}
        onChanged={async () => {
          await refreshAuth();
          notify('success', 'Mobile number verified and updated.');
        }}
      />
      <EmailChangeDialog
        open={dialog === 'EMAIL'}
        onClose={() => setDialog(null)}
        onSaved={async () => {
          await refreshAuth();
          notify('success', 'Email address updated.');
        }}
      />
    </PageContainer>
  );
}

function ProfileSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" aria-labelledby={`${id}-heading`} id={id} className="scroll-mt-24 grid gap-4 sm:p-6 [&>*]:min-w-0">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-control bg-terracotta-tint text-terracotta-deep flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id={`${id}-heading`} className="font-display text-card font-bold text-ink">
            {title}
          </h2>
          {description && <p className="text-meta text-ink-muted">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

/** A value changed through its own verified flow (mobile, email) */
function ReadOnlyRow({ id, label, value, badge, onChange }: { id: string; label: string; value: string; badge?: string; onChange: () => void }) {
  return (
    <div className="grid gap-1.5 min-w-0">
      <span id={`${id}-label`} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-support font-semibold text-ink">
        {label}
        {badge && <span className="text-tag font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">{badge}</span>}
      </span>
      <div className="flex gap-2">
        <output aria-labelledby={`${id}-label`} className="flex-1 min-w-0 flex items-center h-11 px-3 rounded-control border border-line bg-sunken text-body text-ink truncate">
          {value}
        </output>
        <Button variant="secondary" onClick={onChange} aria-label={`Change ${label.toLowerCase()}`}>
          Change
        </Button>
      </div>
    </div>
  );
}
