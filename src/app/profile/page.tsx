'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Clock, Loader2, LogOut, Save } from 'lucide-react';
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
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-xs text-slate-500 gap-2" role="status">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your profile…
      </div>
    );
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

  const notify = useCallback((type: 'success' | 'error', text: string) => setStatusMessage({ type, text }), []);

  // Messages show at the top of a long form: bring them into view
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (statusMessage) statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [statusMessage]);

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
        notify('success', 'Profile updated successfully!');
        await refreshAuth();
      } else {
        notify('error', await apiErrorMessage(res, 'Failed to update profile'));
      }
    } finally {
      setSaving(false);
    }
  };

  const isApproved = membership?.status === 'ACTIVE';

  return (
    <div className="flex-1 flex flex-col p-5 pb-12">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/"
          aria-label="Back to home"
          className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Resident Profile</h1>
          <p className="text-xs text-slate-500 font-medium">{society?.name}</p>
        </div>
      </div>

      {statusMessage && (
        <div
          ref={statusRef}
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`mb-4 p-3 rounded-2xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
          )}
          <span className="font-semibold">{statusMessage.text}</span>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs mb-5 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
          aria-hidden="true"
        >
          {isApproved ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Clock className="w-5 h-5" />}
        </div>
        <div>
          <span className="text-sm font-extrabold text-slate-900">
            {isApproved ? 'Approved Resident' : 'Pending Admin Verification'}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isApproved
              ? 'Your flat and mobile number are active on this society roster.'
              : 'A society admin will review and approve your application.'}
          </p>
        </div>
      </div>

      <ProfilePhoto name={user.fullName} photoUrl={user.profilePhotoUrl} onSaved={refreshAuth} />

      <form onSubmit={handleSaveProfile} className="space-y-4">
        <section
          aria-labelledby="identity-heading"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3.5"
        >
          <h2 id="identity-heading" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Identity & Contact
          </h2>

          <div>
            <label htmlFor="full-name" className="text-xs font-bold text-slate-800 block mb-1">
              Full Name
            </label>
            <input
              id="full-name"
              type="text"
              required
              autoComplete="name"
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>

          <div>
            <span id="mobile-label" className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
              <span>Mobile Number</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Verified by SMS
              </span>
            </span>
            <div className="flex gap-2">
              <output
                aria-labelledby="mobile-label"
                className="flex-1 text-xs font-bold p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
              >
                {user.mobile || 'Not set'}
              </output>
              <button
                type="button"
                onClick={() => setDialog('PHONE')}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          <div>
            <span id="email-label" className="text-xs font-bold text-slate-800 block mb-1">
              Email Address
            </span>
            <div className="flex gap-2">
              <output
                aria-labelledby="email-label"
                className="flex-1 text-xs font-semibold p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 truncate"
              >
                {user.email || 'Not set'}
              </output>
              <button
                type="button"
                onClick={() => setDialog('EMAIL')}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          <FlatNumberInput
            label="Flat number"
            config={society?.settings?.flatConfig}
            placeholder={society?.settings?.flat_format_example ? `Format: ${society.settings.flat_format_example}` : 'e.g. Tower B - 804'}
            value={flatNumber}
            onChange={setFlatNumber}
          />
        </section>

        <section
          aria-labelledby="commute-heading"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3"
        >
          <h2 id="commute-heading" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Commute
          </h2>

          <PlacesAutocompleteInput
            value={workLocation}
            onChange={(loc, place) => {
              setWorkLocation(loc);
              setWorkCoords(place ? { lat: place.lat, lng: place.lng } : null);
            }}
            placeholder="Search tech park, office campus, or metro..."
            label="Work location (used to find matching rides)"
          />
        </section>

        <VehiclesSection vehicles={vehicles} onAdded={loadVehicles} notify={notify} />

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/20 flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" />
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
          {dirty && !saving && (
            <p className="mt-2 text-center text-[11px] font-semibold text-amber-800">You have unsaved changes</p>
          )}
        </div>
      </form>

      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await logout();
          router.replace('/');
        }}
        className="mt-6 w-full py-3 rounded-2xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
      >
        {signingOut ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <LogOut className="w-4 h-4" aria-hidden="true" />}
        <span>Sign out</span>
      </button>

      <HiddenResidentsSection />
      <YourDataSection
        societyName={society?.name}
        onGone={async () => {
          // Signed out on the server (deleted) or no longer a member (left); start from the beginning
          await logout();
          router.replace('/');
        }}
      />

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
    </div>
  );
}
