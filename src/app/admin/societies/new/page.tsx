'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Check, MessageCircle, Settings2, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useIsClient } from '@/hooks/useIsClient';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { APP_NAME } from '@/lib/brand';
import { whatsAppLink } from '@/lib/utils/contact';
import { PlacesAutocompleteInput } from '@/components/PlacesAutocompleteInput';
import { OptionListEditor } from '@/components/ui/OptionListEditor';
import { FlatConfigEditor, FlatConfigDraft, configFromDraft, draftFromConfig } from '@/components/FlatConfigEditor';

const STEPS = [
  { title: 'Society', icon: Building2 },
  { title: 'Admin', icon: UserCog },
  { title: 'Setup', icon: Settings2 },
  { title: 'Review', icon: Check },
] as const;

const inputClass =
  'w-full text-support p-3 rounded-control border border-line-strong bg-surface text-ink focus:outline-none focus:ring-3 focus:ring-terracotta/30';
const labelClass = 'text-meta font-bold text-ink block mb-1';

interface CreatedSociety {
  id: string;
  name: string;
  pendingAdminName: string;
  pendingAdminMobile: string;
}

/**
 * Society onboarding wizard (app admins): the society, its admin, its
 * starting configuration, then a review. The society opens, and its invite
 * link appears, once the admin signs in with the mobile number given here.
 */
export default function NewSocietyWizard() {
  const { membership } = useAuth();
  const isClient = useIsClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedSociety | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminMobile, setAdminMobile] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [genderPrefs, setGenderPrefs] = useState(true);
  const [maxDetour, setMaxDetour] = useState('10');
  const [flats, setFlats] = useState<FlatConfigDraft>(draftFromConfig());
  const [emergencyNumber, setEmergencyNumber] = useState('');
  const [pickupPoints, setPickupPoints] = useState<string[]>(['Main Gate']);
  const [classLocations, setClassLocations] = useState<string[]>([]);
  const [rules, setRules] = useState('');

  if (membership && membership.role !== 'SUPER_ADMIN') {
    return <p className="p-6 text-support text-ink-muted">Only app admins can add societies.</p>;
  }

  const mobileDigits = adminMobile.replace(/\D/g, '').slice(-10);

  const validate = (s: number): string => {
    if (s === 0) {
      if (name.trim().length < 2) return 'Enter the society name.';
      if (!coords) return 'Choose the society location from the suggestions.';
    }
    if (s === 1) {
      if (adminName.trim().length < 2) return "Enter the society admin's name.";
      if (!/^[6-9]\d{9}$/.test(mobileDigits)) return 'Enter a valid 10-digit mobile number.';
    }
    if (s === 2) {
      const detour = Number(maxDetour);
      if (!Number.isInteger(detour) || detour < 1 || detour > 60) return 'Max detour must be between 1 and 60 minutes.';
      const flatConfig = configFromDraft(flats);
      if (typeof flatConfig === 'string') return flatConfig;
    }
    return '';
  };

  const next = () => {
    const problem = validate(step);
    setError(problem);
    if (!problem) setStep((s) => s + 1);
  };

  const create = async () => {
    for (const s of [0, 1, 2]) {
      const problem = validate(s);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    const flatSetup = configFromDraft(flats);
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/v1/admin/societies', {
        json: {
          name: name.trim(),
          address: address.trim(),
          latitude: coords!.lat,
          longitude: coords!.lng,
          adminName: adminName.trim(),
          adminMobile: mobileDigits,
          settings: {
            require_admin_approval: requireApproval,
            allow_gender_preferences: genderPrefs,
            max_detour_minutes: Number(maxDetour),
            ...(flatSetup && typeof flatSetup === 'object' ? { flatConfig: flatSetup } : {}),
            community_rules: rules.trim() || undefined,
            emergencyNumber: emergencyNumber.trim() || undefined,
            pickupPoints,
            classLocations,
          },
        },
      });
      if (!res.ok) {
        setError(await apiErrorMessage(res, 'Could not add the society.'));
        return;
      }
      setCreated(((await res.json()) as { society: CreatedSociety }).society);
    } catch {
      setError('Connection problem. Check your internet and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const appUrl = isClient ? window.location.origin : '';
    const message =
      `Hi ${created.pendingAdminName.split(' ')[0]}, ${created.name} has been set up on ${APP_NAME} with you as its society admin. ` +
      `Please sign in at ${appUrl} with your mobile number ${created.pendingAdminMobile} to verify it. ` +
      `The society opens for residents as soon as you do.`;
    return (
      <div className="flex-1 p-5 space-y-4">
        <div className="p-5 rounded-card bg-surface border border-success/40 text-center space-y-3">
          <span className="mx-auto w-12 h-12 rounded-card bg-success-bg text-success flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </span>
          <h1 className="text-card font-display font-bold text-ink">{created.name} added</h1>
          <p className="text-support text-ink-muted">
            Waiting for <strong>{created.pendingAdminName}</strong> to sign in with{' '}
            <strong className="whitespace-nowrap">{created.pendingAdminMobile}</strong>. Their OTP sign-in verifies
            the number; the society then opens and its invite link appears.
          </p>
          <a
            href={whatsAppLink(message, created.pendingAdminMobile)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-terracotta-deep text-ink-inverse text-support font-bold hover:bg-terracotta-deep"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" /> Tell them on WhatsApp
          </a>
        </div>
        <Link href="/admin?tab=SOCIETIES" className="block text-center text-support font-bold text-success underline">
          Back to societies
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin?tab=SOCIETIES"
          aria-label="Back to societies"
          className="w-9 h-9 rounded-control bg-sunken hover:bg-sunken text-ink-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-card font-display font-bold text-ink">Add a society</h1>
          <p className="text-meta text-ink-muted">
            Step {step + 1} of {STEPS.length}: {STEPS[step].title}
          </p>
        </div>
      </div>

      {/* Progress */}
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined} className="space-y-1">
            <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-terracotta-deep' : 'bg-sunken'}`} />
            <span className={`block text-tag font-semibold ${i === step ? 'text-ink' : 'text-ink-muted'}`}>
              {s.title}
            </span>
          </li>
        ))}
      </ol>

      <div className="p-4 rounded-card bg-surface border border-line space-y-4">
        {step === 0 && (
          <>
            <div>
              <label htmlFor="society-name" className={labelClass}>
                Society name
              </label>
              <input
                id="society-name"
                className={inputClass}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mahaveer Ranches"
              />
            </div>
            <div>
              <PlacesAutocompleteInput
                label="Location"
                value={address}
                onChange={(value, place) => {
                  setAddress(value);
                  setCoords(place ? { lat: place.lat, lng: place.lng } : null);
                }}
                placeholder="Search the society's area or address"
              />
              <p className="text-tag text-ink-muted mt-1">
                {coords ? 'Location set. Rides start and end here.' : 'Pick from the suggestions so rides know where the society is.'}
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-meta text-ink-muted">
              The society admin approves residents and manages settings. They verify this number by signing in to{' '}
              {APP_NAME} with it (SMS code); until then nobody can join.
            </p>
            <div>
              <label htmlFor="admin-name" className={labelClass}>
                Admin&apos;s name
              </label>
              <input
                id="admin-name"
                className={inputClass}
                value={adminName}
                maxLength={100}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Meera Rao"
              />
            </div>
            <div>
              <label htmlFor="admin-mobile" className={labelClass}>
                Admin&apos;s mobile number
              </label>
              <div className="flex">
                <span className="px-3 flex items-center rounded-l-xl border border-r-0 border-line-strong bg-sunken text-support text-ink-muted">
                  +91
                </span>
                <input
                  id="admin-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${inputClass} rounded-l-none`}
                  value={adminMobile}
                  maxLength={14}
                  onChange={(e) => setAdminMobile(e.target.value.replace(/[^\d\s]/g, ''))}
                  placeholder="98450 12345"
                />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Toggle
              id="require-approval"
              label="Admin approves new residents"
              hint="Recommended. Residents can use the apps only after approval."
              checked={requireApproval}
              onChange={setRequireApproval}
            />
            <Toggle
              id="gender-prefs"
              label="Allow women-only / men-only rides"
              checked={genderPrefs}
              onChange={setGenderPrefs}
            />
            <div>
              <label htmlFor="max-detour" className={labelClass}>
                Max ride detour (minutes)
              </label>
              <input
                id="max-detour"
                inputMode="numeric"
                className={inputClass}
                value={maxDetour}
                maxLength={2}
                onChange={(e) => setMaxDetour(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-meta font-bold text-ink mb-1">Flat numbers</legend>
              <FlatConfigEditor value={flats} onChange={setFlats} />
            </fieldset>
            <div>
              <label htmlFor="emergency" className={labelClass}>
                Emergency number (security desk)
              </label>
              <input
                id="emergency"
                type="tel"
                className={inputClass}
                value={emergencyNumber}
                maxLength={20}
                onChange={(e) => setEmergencyNumber(e.target.value)}
                placeholder="Leave empty to use 112"
              />
            </div>
            <OptionListEditor
              label="RideShare pick-up points"
              values={pickupPoints}
              onChange={setPickupPoints}
              placeholder="e.g. Tower B lobby"
            />
            <OptionListEditor
              label="Class locations"
              values={classLocations}
              onChange={setClassLocations}
              placeholder="e.g. Clubhouse hall"
            />
            <div>
              <label htmlFor="rules" className={labelClass}>
                Community rules (optional)
              </label>
              <textarea
                id="rules"
                rows={3}
                className={inputClass}
                value={rules}
                maxLength={5000}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Shown to residents. The society admin can edit these later."
              />
            </div>
          </>
        )}

        {step === 3 && (
          <dl className="text-support divide-y divide-line">
            <Row label="Society" value={name} />
            <Row label="Location" value={address} />
            <Row label="Admin" value={`${adminName} · +91 ${mobileDigits}`} />
            <Row label="New residents" value={requireApproval ? 'Approved by admin' : 'Join directly'} />
            <Row
              label="Flat numbers"
              value={(() => {
                const c = configFromDraft(flats);
                return c && typeof c === 'object'
                  ? `${c.towers.length ? `${c.towers.join(', ')} · ` : ''}${c.minNumber}–${c.maxNumber}`
                  : 'Typed freely';
              })()}
            />
            <Row label="Emergency number" value={emergencyNumber || '112 (national)'} />
            <Row label="Pick-up points" value={pickupPoints.join(', ') || 'None yet'} />
            <Row label="Class locations" value={classLocations.join(', ') || 'None yet'} />
          </dl>
        )}
      </div>

      {error && (
        <p role="alert" className="text-support text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setError('');
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0}
          className="h-12 rounded-control border border-line-strong text-support font-bold text-ink disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="h-12 rounded-control bg-ink text-ink-inverse text-support font-bold">
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={create}
            disabled={saving}
            className="h-12 rounded-control bg-terracotta-deep text-ink-inverse text-support font-bold disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add society'}
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-3 cursor-pointer">
      <span>
        <span className="block text-support font-semibold text-ink">{label}</span>
        {hint && <span className="block text-tag text-ink-muted">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 accent-terracotta-deep"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 flex justify-between gap-4">
      <dt className="text-ink-muted shrink-0">{label}</dt>
      <dd className="text-ink font-semibold text-right break-words min-w-0">{value}</dd>
    </div>
  );
}
