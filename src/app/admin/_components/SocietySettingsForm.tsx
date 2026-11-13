'use client';

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
  'w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';
const labelClass = 'text-xs font-semibold text-slate-800 block mb-1';
const sectionClass = 'p-4 rounded-2xl bg-white border border-slate-200 space-y-3';
const headingClass = 'text-sm font-bold text-slate-900 flex items-center gap-2';

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
    <form onSubmit={save} className="flex flex-col gap-4">
      <section aria-labelledby="set-profile" className={sectionClass}>
        <h2 id="set-profile" className={headingClass}>
          <Building2 className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Society
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
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-800">Map location (main gate)</summary>
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

      <section aria-labelledby="set-flats" className={sectionClass}>
        <h2 id="set-flats" className={headingClass}>
          Flat numbers
        </h2>
        <FlatConfigEditor value={flats} onChange={setFlats} />
      </section>

      <section aria-labelledby="set-residents" className={sectionClass}>
        <h2 id="set-residents" className={headingClass}>
          <Users className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Residents
        </h2>
        <Toggle
          id="require-approval"
          label="Admin approves new residents"
          hint="Recommended. New residents can use the apps only after approval."
          checked={requireApproval}
          onChange={setRequireApproval}
        />
      </section>

      <section aria-labelledby="set-rideshare" className={sectionClass}>
        <h2 id="set-rideshare" className={headingClass}>
          <Car className="w-4 h-4 text-emerald-700" aria-hidden="true" /> RideShare
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

      <section aria-labelledby="set-classes" className={sectionClass}>
        <h2 id="set-classes" className={headingClass}>
          <BookOpen className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Classes
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

      <section aria-labelledby="set-rules" className={sectionClass}>
        <h2 id="set-rules" className={headingClass}>
          <ScrollText className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Community rules
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

      <button
        type="submit"
        disabled={saving}
        className="h-12 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Save className="w-4 h-4" aria-hidden="true" />
        {saving ? 'Saving…' : 'Save settings'}
      </button>
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
    <label htmlFor={id} className="flex items-start justify-between gap-3 cursor-pointer">
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {hint && <span className="block text-[11px] text-slate-600">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 accent-emerald-700"
      />
    </label>
  );
}
