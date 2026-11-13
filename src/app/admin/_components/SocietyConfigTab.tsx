'use client';

import React, { useState } from 'react';
import { BookOpen, Car, CheckCircle2, Inbox, RotateCcw, Save } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { OptionListEditor } from '@/components/ui/OptionListEditor';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { Society, SocietySuggestion } from '@/types';
import { formatIstDateTime } from '@/lib/utils/time';
import { Notify } from './types';

/** Shown to admins until they set their own class subjects */
const DEFAULT_CLASS_TYPES = ['Yoga', 'Music', 'Art & Craft', 'Piano', 'Maths', 'Language', 'Fitness', 'Coding', 'Hobby'];

const MODULE_LABEL: Record<SocietySuggestion['module'], string> = {
  RIDESHARE: 'RideShare',
  CLASSES: 'Classes',
  GENERAL: 'General',
};

interface SocietyConfigTabProps {
  society: Society;
  notify: Notify;
  onSaved: () => Promise<void>;
}

/**
 * Society Configuration: the options each Club House app offers residents in
 * this society (RideShare pick-up points and emergency number, class types
 * and locations), and the suggestions residents send about them.
 * Keyed by society in the parent, so it starts from the saved values.
 */
export function SocietyConfigTab({ society, notify, onSaved }: SocietyConfigTabProps) {
  const settings = society.settings;
  const [emergencyNumber, setEmergencyNumber] = useState(settings.emergencyNumber ?? '');
  const [pickupPoints, setPickupPoints] = useState(settings.pickupPoints ?? []);
  const [fuelPrice, setFuelPrice] = useState(String(settings.fuelPricePerLitre ?? ''));
  const [classTypes, setClassTypes] = useState(
    settings.lessonCategories?.length ? settings.lessonCategories : DEFAULT_CLASS_TYPES
  );
  const [classLocations, setClassLocations] = useState(settings.classLocations ?? []);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/settings', {
        method: 'PUT',
        json: {
          emergencyNumber: emergencyNumber.trim(),
          pickupPoints,
          lessonCategories: classTypes,
          classLocations,
          ...(fuelPrice.trim() ? { fuelPricePerLitre: Number(fuelPrice) } : {}),
        },
      });
      if (res.ok) {
        notify('Society configuration saved.');
        await onSaved();
      } else {
        notify(await apiErrorMessage(res, 'Could not save the configuration'), 'error');
      }
    } catch {
      notify('Connection problem. Check your internet and try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <form onSubmit={save} className="flex flex-col gap-4">
        <section aria-labelledby="config-rideshare" className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
          <h2 id="config-rideshare" className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Car className="w-4 h-4 text-emerald-700" aria-hidden="true" /> RideShare
          </h2>
          <div>
            <label htmlFor="emergency-number" className="text-xs font-semibold text-zinc-800 block mb-1">
              Emergency number
            </label>
            <p className="text-[11px] text-zinc-600 mb-2">
              Residents on a ride see a button to call this number, e.g. your security desk. Leave it empty to use the
              national emergency number 112.
            </p>
            <input
              id="emergency-number"
              type="tel"
              inputMode="tel"
              value={emergencyNumber}
              maxLength={20}
              onChange={(e) => setEmergencyNumber(e.target.value)}
              placeholder="e.g. +91 80 4000 1234"
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="fuel-price" className="text-xs font-semibold text-zinc-800 block mb-1">
              Petrol price (₹ per litre)
            </label>
            <p className="text-[11px] text-zinc-600 mb-2">
              Used to estimate each person&apos;s share of the fuel on a ride. Leave empty to use ₹103.
            </p>
            <input
              id="fuel-price"
              inputMode="decimal"
              value={fuelPrice}
              maxLength={6}
              onChange={(e) => setFuelPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="103"
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <OptionListEditor
            label="Pick-up points"
            hint="Places in the society where riders meet, e.g. Main Gate or Tower B3 Lobby. Residents choose one of these or type their own."
            values={pickupPoints}
            onChange={setPickupPoints}
            placeholder="e.g. Main Gate"
          />
        </section>

        <section aria-labelledby="config-classes" className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
          <h2 id="config-classes" className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Classes
          </h2>
          <OptionListEditor
            label="Class types"
            hint="Subjects residents pick from when they offer a class. They can still type a new one."
            values={classTypes}
            onChange={setClassTypes}
            placeholder="e.g. Chess"
            maxLength={50}
          />
          <OptionListEditor
            label="Class locations"
            hint="Common places where classes are held, e.g. Clubhouse Hall or Amphitheatre."
            values={classLocations}
            onChange={setClassLocations}
            placeholder="e.g. Clubhouse Hall"
          />
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
      </form>

      <SuggestionsInbox notify={notify} />
    </div>
  );
}

function SuggestionsInbox({ notify }: { notify: Notify }) {
  const { data, error, loading, reload } = useApiData(
    '/api/v1/suggestions',
    (json) => (json as { suggestions: SocietySuggestion[] }).suggestions,
    'Could not load residents’ suggestions'
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const setStatus = async (suggestionId: string, status: SocietySuggestion['status']) => {
    setUpdatingId(suggestionId);
    try {
      const res = await apiFetch('/api/v1/suggestions', { method: 'PATCH', json: { suggestionId, status } });
      if (res.ok) reload();
      else notify(await apiErrorMessage(res, 'Could not update the suggestion'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const open = data?.filter((s) => s.status === 'OPEN') ?? [];
  const done = data?.filter((s) => s.status === 'DONE') ?? [];

  return (
    <section aria-labelledby="config-suggestions" className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-3">
      <h2 id="config-suggestions" className="text-sm font-bold text-zinc-900 flex items-center gap-2">
        <Inbox className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Residents&apos; suggestions
        {open.length > 0 && (
          <span className="ml-auto text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
            {open.length} open
          </span>
        )}
      </h2>
      {loading ? (
        <Loading label="Loading suggestions…" />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <p className="text-xs text-zinc-600">No suggestions yet. Residents can send them from RideShare and Classes.</p>
      ) : (
        <ul className="space-y-2">
          {[...open, ...done].map((s) => (
            <li
              key={s.id}
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                s.status === 'DONE' ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-white border-zinc-300 text-zinc-800'
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-900">{MODULE_LABEL[s.module]}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    s.kind === 'REPORT' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-900'
                  }`}
                >
                  {s.kind === 'REPORT' ? 'Problem' : 'Suggestion'}
                </span>
                <span className="text-zinc-600 ml-auto">{formatIstDateTime(s.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{s.message}</p>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">From {s.userName}</span>
                {s.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={updatingId === s.id}
                    onClick={() => setStatus(s.id, 'DONE')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Mark done
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updatingId === s.id}
                    onClick={() => setStatus(s.id, 'OPEN')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 font-semibold disabled:opacity-60"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
