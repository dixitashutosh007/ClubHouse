'use client';

import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Society } from '@/types';
import { Notify } from './types';

interface SocietySettingsFormProps {
  society: Society;
  /** DETAILS: name, location and rules. COMMUTE: detour and approval settings. */
  section: 'DETAILS' | 'COMMUTE';
  notify: Notify;
  onSaved: () => Promise<void>;
}

const inputClass =
  'w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500';

/**
 * Society profile and settings. Keyed by society in the parent, so the form
 * starts from the saved values whenever the society changes.
 */
export function SocietySettingsForm({ society, section, notify, onSaved }: SocietySettingsFormProps) {
  const [name, setName] = useState(society.name);
  const [address, setAddress] = useState(society.address);
  const [latitude, setLatitude] = useState(society.latitude);
  const [longitude, setLongitude] = useState(society.longitude);
  const [communityRules, setCommunityRules] = useState(society.settings.community_rules ?? '');
  const [flatFormatPattern, setFlatFormatPattern] = useState(society.settings.flat_format_pattern ?? '');
  const [flatFormatExample, setFlatFormatExample] = useState(society.settings.flat_format_example ?? '');
  const [maxDetour, setMaxDetour] = useState(society.settings.max_detour_minutes);
  const [requireApproval, setRequireApproval] = useState(society.settings.require_admin_approval);
  const [allowGenderPref, setAllowGenderPref] = useState(society.settings.allow_gender_preferences);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/settings', {
        method: 'PUT',
        json:
          section === 'DETAILS'
            ? {
                name,
                address,
                latitude,
                longitude,
                community_rules: communityRules,
                flat_format_pattern: flatFormatPattern || undefined,
                flat_format_example: flatFormatExample || undefined,
              }
            : {
                max_detour_minutes: maxDetour,
                require_admin_approval: requireApproval,
                allow_gender_preferences: allowGenderPref,
              },
      });
      if (res.ok) {
        notify(section === 'DETAILS' ? 'Society details and rules updated.' : 'Commute settings updated.');
        await onSaved();
      } else {
        notify(await apiErrorMessage(res, 'Could not save settings'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const submitButton = (
    <div className="mt-auto pt-4">
      <button
        type="submit"
        disabled={isSaving}
        className="w-full py-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-60"
      >
        <Save className="w-4 h-4" aria-hidden="true" />
        <span>
          {isSaving ? 'Saving…' : section === 'DETAILS' ? 'Save Society Details & Rules' : 'Update Commute Settings'}
        </span>
      </button>
    </div>
  );

  if (section === 'COMMUTE') {
    return (
      <form onSubmit={save} className="flex-1 flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
          <div>
            <label htmlFor="max-detour" className="text-xs font-semibold text-zinc-700 block mb-1">
              Max Allowed Commute Detour (Minutes)
            </label>
            <input
              id="max-detour"
              type="number"
              min={1}
              max={60}
              value={maxDetour}
              onChange={(e) => setMaxDetour(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Commute matches with a longer detour are not recommended.
            </p>
          </div>

          <label className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="text-xs font-semibold text-zinc-800 block">Require Admin Approval</span>
              <span className="text-[10px] text-zinc-500">New residents need manual review before using Ride Share</span>
            </span>
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded-sm"
            />
          </label>

          <label className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="text-xs font-semibold text-zinc-800 block">Allow Gender Preferences</span>
              <span className="text-[10px] text-zinc-500">Let offerers limit a ride to women or men only</span>
            </span>
            <input
              type="checkbox"
              checked={allowGenderPref}
              onChange={(e) => setAllowGenderPref(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded-sm"
            />
          </label>
        </div>
        {submitButton}
      </form>
    );
  }

  return (
    <form onSubmit={save} className="flex-1 flex flex-col gap-4">
      <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-emerald-950">
        <span className="font-semibold block mb-0.5">Society Profile Settings</span>
        Update society name, gate location coordinates, and community carpool rules.
      </div>

      <div>
        <label htmlFor="society-name" className="text-xs font-semibold text-zinc-700 block mb-1">
          Society Official Name
        </label>
        <input
          id="society-name"
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} font-medium`}
        />
      </div>

      <div>
        <label htmlFor="society-address" className="text-xs font-semibold text-zinc-700 block mb-1">
          Society Address & Gate
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="gate-lat" className="text-xs font-semibold text-zinc-700 block mb-1">
            Gate Latitude
          </label>
          <input
            id="gate-lat"
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(e) => setLatitude(Number(e.target.value))}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
          />
        </div>
        <div>
          <label htmlFor="gate-lng" className="text-xs font-semibold text-zinc-700 block mb-1">
            Gate Longitude
          </label>
          <input
            id="gate-lng"
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(e) => setLongitude(Number(e.target.value))}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
          />
        </div>
      </div>

      <div>
        <label htmlFor="community-rules" className="text-xs font-semibold text-zinc-700 block mb-1">
          Society Carpool & Community Rules
        </label>
        <textarea
          id="community-rules"
          rows={5}
          maxLength={5000}
          value={communityRules}
          onChange={(e) => setCommunityRules(e.target.value)}
          placeholder="Enter society-specific carpool guidelines and etiquette..."
          className={inputClass}
        />
        <p className="text-[10px] text-zinc-500 mt-1">
          Shown to residents before they offer or request rides.
        </p>
      </div>

      <fieldset className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
        <legend className="text-xs font-bold text-zinc-800 px-1">Tower & Flat Format</legend>
        <p className="text-[11px] text-zinc-500 mb-3">
          How residents should write their flat number during registration.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="flat-example" className="text-[11px] font-semibold text-zinc-700 block mb-1">
              Example
            </label>
            <input
              id="flat-example"
              type="text"
              maxLength={50}
              value={flatFormatExample}
              onChange={(e) => setFlatFormatExample(e.target.value)}
              placeholder="e.g. Tower A - 1202 or #422"
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white font-medium"
            />
          </div>
          <div>
            <label htmlFor="flat-pattern" className="text-[11px] font-semibold text-zinc-700 block mb-1">
              Validation pattern (optional regex)
            </label>
            <input
              id="flat-pattern"
              type="text"
              maxLength={100}
              value={flatFormatPattern}
              onChange={(e) => setFlatFormatPattern(e.target.value)}
              placeholder="e.g. ^(Tower [A-Z]|#)[0-9A-Za-z -]+$"
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white font-mono text-[11px]"
            />
          </div>
        </div>
      </fieldset>

      {submitButton}
    </form>
  );
}
