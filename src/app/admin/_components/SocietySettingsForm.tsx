'use client';

import { Button } from '@/components/ui/Button';
import React, { useState } from 'react';
import { BookOpen, Building2, Car, Save, ScrollText, Users } from 'lucide-react';
import { OptionListEditor } from '@/components/ui/OptionListEditor';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Society } from '@/types';
import { FlatConfigEditor, configFromDraft, draftFromConfig } from '@/components/FlatConfigEditor';
import { Notify } from './types';

/** Shown to admins until they set their own class subjects */
const DEFAULT_CLASS_TYPES = ['Yoga', 'Music', 'Art & Craft', 'Piano', 'Maths', 'Language', 'Fitness', 'Coding', 'Hobby'];

interface SocietySettingsFormProps {
  society: Society;
  notify: Notify;
  onSaved: () => Promise<void>;
}

const inputClass =
  'w-full min-h-11 px-3 py-2.5 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep';
const labelClass = 'text-support font-semibold text-ink block mb-1.5';
const sectionClass = 'scroll-mt-24 p-5 sm:p-6 rounded-card bg-surface border border-line grid gap-4 [&>*]:min-w-0';
const headingClass = 'font-display text-card font-bold text-ink flex items-center gap-2';

/** The settings sections, in order, for the index at the top */
const SETTINGS_INDEX = [
  ['set-profile', 'Society'],
  ['set-flats', 'Flats'],
  ['set-residents', 'Residents'],
  ['set-rideshare', 'RideShare'],
  ['set-classes', 'Classes'],
  ['set-rules', 'Rules'],
] as const;

/**
 * Every setting in one place: the society itself, then one section per app
 * (RideShare, Classes; later apps add theirs here), then the rules.
 * Keyed by society in the parent, so it starts from the saved values.
 */
export function SocietySettingsForm({ society, notify, onSaved }: SocietySettingsFormProps) {
  const s = society.settings;
  const [name, setName] = useState(society.name);
  const [address, setAddress] = useState(society.address);
  const [latitude, setLatitude] = useState(String(society.latitude));
  const [longitude, setLongitude] = useState(String(society.longitude));
  const [flats, setFlats] = useState(draftFromConfig(s.flatConfig));
  const [requireApproval, setRequireApproval] = useState(s.require_admin_approval);
  const [allowGenderPref, setAllowGenderPref] = useState(s.allow_gender_preferences);
  const [maxDetour, setMaxDetour] = useState(String(s.max_detour_minutes));
  const [communityRules, setCommunityRules] = useState(s.community_rules ?? '');
  const [emergencyNumber, setEmergencyNumber] = useState(s.emergencyNumber ?? '');
  const [pickupPoints, setPickupPoints] = useState(s.pickupPoints ?? []);
  const [fuelPrice, setFuelPrice] = useState(String(s.fuelPricePerLitre ?? ''));
  const [classTypes, setClassTypes] = useState(s.lessonCategories?.length ? s.lessonCategories : DEFAULT_CLASS_TYPES);
  const [classLocations, setClassLocations] = useState(s.classLocations ?? []);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const flatConfig = configFromDraft(flats);
    if (typeof flatConfig === 'string') {
      notify(flatConfig, 'error');
      return;
    }
    const detour = Number(maxDetour);
    if (!Number.isInteger(detour) || detour < 1 || detour > 60) {
      notify('Maximum detour must be between 1 and 60 minutes.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/settings', {
        method: 'PUT',
        json: {
          name: name.trim(),
          address: address.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          community_rules: communityRules,
          max_detour_minutes: detour,
          require_admin_approval: requireApproval,
          allow_gender_preferences: allowGenderPref,
          emergencyNumber: emergencyNumber.trim(),
          pickupPoints,
          lessonCategories: classTypes,
          classLocations,
          ...(fuelPrice.trim() ? { fuelPricePerLitre: Number(fuelPrice) } : {}),
          ...(flatConfig ? { flatConfig } : {}),
        },
      });
      if (res.ok) {
        notify('Settings saved.');
        await onSaved();
      } else {
        notify(await apiErrorMessage(res, 'Could not save settings'), 'error');
      }
    } catch {
      notify('Connection problem. Check your internet and try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1">
        {SETTINGS_INDEX.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 inline-flex items-center h-11 px-4 rounded-full border border-line-strong bg-surface text-support font-semibold text-ink hover:bg-sunken"
          >
            {label}
          </a>
        ))}
      </nav>
      <section id="set-profile" aria-labelledby="set-profile-title" className={sectionClass}>
        <h2 id="set-profile-title" className={headingClass}>
          <Building2 className="w-4 h-4 text-terracotta-deep" aria-hidden="true" /> Society
        </h2>
        <div>
          <label htmlFor="society-name" className={labelClass}>
            Name
          </label>
          <input id="society-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="society-address" className={labelClass}>
            Address
          </label>
          <textarea
            id="society-address"
            rows={2}
            required
            maxLength={300}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </div>
        <details className="text-meta">
          <summary className="cursor-pointer font-semibold text-ink">Map location (main gate)</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label htmlFor="gate-lat" className={labelClass}>
                Latitude
              </label>
              <input id="gate-lat" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="gate-lng" className={labelClass}>
                Longitude
              </label>
              <input id="gate-lng" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} />
            </div>
          </div>
        </details>
      </section>

      <section id="set-flats" aria-labelledby="set-flats-title" className={sectionClass}>
        <h2 id="set-flats-title" className={headingClass}>
          Flat numbers
        </h2>
        <FlatConfigEditor value={flats} onChange={setFlats} />
      </section>

      <section id="set-residents" aria-labelledby="set-residents-title" className={sectionClass}>
        <h2 id="set-residents-title" className={headingClass}>
          <Users className="w-4 h-4 text-terracotta-deep" aria-hidden="true" /> Residents
        </h2>
        <Toggle
          id="require-approval"
          label="Admin approves new residents"
          hint="Recommended. New residents can use the apps only after approval."
          checked={requireApproval}
          onChange={setRequireApproval}
        />
      </section>

      <section id="set-rideshare" aria-labelledby="set-rideshare-title" className={sectionClass}>
        <h2 id="set-rideshare-title" className={headingClass}>
          <Car className="w-4 h-4 text-terracotta-deep" aria-hidden="true" /> RideShare
        </h2>
        <div>
          <label htmlFor="emergency-number" className={labelClass}>
            Emergency number
          </label>
          <input
            id="emergency-number"
            type="tel"
            inputMode="tel"
            value={emergencyNumber}
            maxLength={20}
            onChange={(e) => setEmergencyNumber(e.target.value)}
            placeholder="Security desk; empty means 112"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="fuel-price" className={labelClass}>
              Petrol ₹ / litre
            </label>
            <input
              id="fuel-price"
              inputMode="decimal"
              value={fuelPrice}
              maxLength={6}
              onChange={(e) => setFuelPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="103"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="max-detour" className={labelClass}>
              Max detour (min)
            </label>
            <input
              id="max-detour"
              inputMode="numeric"
              maxLength={2}
              value={maxDetour}
              onChange={(e) => setMaxDetour(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
            />
          </div>
        </div>
        <OptionListEditor
          label="Pick-up points"
          hint="Where riders meet, e.g. Main Gate."
          values={pickupPoints}
          onChange={setPickupPoints}
          placeholder="e.g. Main Gate"
        />
        <Toggle
          id="gender-prefs"
          label="Allow women-only / men-only rides"
          checked={allowGenderPref}
          onChange={setAllowGenderPref}
        />
      </section>

      <section id="set-classes" aria-labelledby="set-classes-title" className={sectionClass}>
        <h2 id="set-classes-title" className={headingClass}>
          <BookOpen className="w-4 h-4 text-terracotta-deep" aria-hidden="true" /> Classes
        </h2>
        <OptionListEditor
          label="Class types"
          hint="Residents can still type a new one."
          values={classTypes}
          onChange={setClassTypes}
          placeholder="e.g. Chess"
          maxLength={50}
        />
        <OptionListEditor
          label="Class locations"
          values={classLocations}
          onChange={setClassLocations}
          placeholder="e.g. Clubhouse Hall"
        />
      </section>

      <section id="set-rules" aria-labelledby="set-rules-title" className={sectionClass}>
        <h2 id="set-rules-title" className={headingClass}>
          <ScrollText className="w-4 h-4 text-terracotta-deep" aria-hidden="true" /> Community rules
        </h2>
        <label htmlFor="community-rules" className="sr-only">
          Community rules
        </label>
        <textarea
          id="community-rules"
          rows={5}
          maxLength={5000}
          value={communityRules}
          onChange={(e) => setCommunityRules(e.target.value)}
          placeholder="Shown to residents before they offer or join rides."
          className={inputClass}
        />
      </section>

      {/* Save stays in reach while scrolling a long form */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" icon={Save} loading={saving} className="shadow-overlay w-full sm:w-auto">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
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
    <label htmlFor={id} className="flex items-start justify-between gap-3 min-h-11 cursor-pointer">
      <span>
        <span className="block text-support font-semibold text-ink">{label}</span>
        {hint && <span className="block text-meta text-ink-muted">{hint}</span>}
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
