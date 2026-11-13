'use client';

import { OptionListEditor } from '@/components/ui/OptionListEditor';
import { flatExample } from '@/lib/flat-number';
import { FlatNumberConfig } from '@/types';

/** The editor's raw values; numbers stay text until saved */
export interface FlatConfigDraft {
  towers: string[];
  minNumber: string;
  maxNumber: string;
}

export function draftFromConfig(config?: FlatNumberConfig): FlatConfigDraft {
  return config
    ? { towers: config.towers, minNumber: String(config.minNumber), maxNumber: String(config.maxNumber) }
    : { towers: [], minNumber: '', maxNumber: '' };
}

/** The config to save, null when not filled in, or an error message */
export function configFromDraft(draft: FlatConfigDraft): FlatNumberConfig | null | string {
  if (!draft.minNumber && !draft.maxNumber && draft.towers.length === 0) return null;
  const minNumber = Number(draft.minNumber);
  const maxNumber = Number(draft.maxNumber);
  if (!draft.minNumber || !draft.maxNumber || !Number.isInteger(minNumber) || !Number.isInteger(maxNumber)) {
    return 'Enter the lowest and highest flat numbers';
  }
  if (minNumber < 1 || maxNumber < minNumber) return 'The lowest flat number must be 1 or more and not above the highest';
  return { towers: draft.towers.map((t) => t.trim().toUpperCase()), minNumber, maxNumber };
}

const numberInput =
  'w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';

/**
 * Towers or blocks, and the flat number range. Residents then pick their
 * tower and type a number in range, so flat numbers stay consistent.
 */
export function FlatConfigEditor({ value, onChange }: { value: FlatConfigDraft; onChange: (draft: FlatConfigDraft) => void }) {
  const config = configFromDraft(value);
  return (
    <div className="space-y-3">
      <OptionListEditor
        label="Towers or blocks"
        hint="e.g. A1, A2, B. Leave empty if flats have no tower (just a number like 443)."
        values={value.towers}
        onChange={(towers) => onChange({ ...value, towers: towers.map((t) => t.toUpperCase()) })}
        placeholder="e.g. A1"
        maxItems={100}
        maxLength={12}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="flat-min" className="text-xs font-semibold text-slate-800 block mb-1">
            Lowest flat number
          </label>
          <input
            id="flat-min"
            inputMode="numeric"
            maxLength={5}
            value={value.minNumber}
            onChange={(e) => onChange({ ...value, minNumber: e.target.value.replace(/\D/g, '') })}
            placeholder="e.g. 101"
            className={numberInput}
          />
        </div>
        <div>
          <label htmlFor="flat-max" className="text-xs font-semibold text-slate-800 block mb-1">
            Highest flat number
          </label>
          <input
            id="flat-max"
            inputMode="numeric"
            maxLength={5}
            value={value.maxNumber}
            onChange={(e) => onChange({ ...value, maxNumber: e.target.value.replace(/\D/g, '') })}
            placeholder="e.g. 2404"
            className={numberInput}
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-700">
        {config && typeof config === 'object'
          ? `Residents will enter flats like ${flatExample(config)}.`
          : typeof config === 'string'
            ? config
            : 'Not set up yet: residents type their flat number freely.'}
      </p>
    </div>
  );
}
