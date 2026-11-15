'use client';

import { OptionListEditor } from '@/components/ui/OptionListEditor';
import type { CircleType } from '@/types';

/**
 * The society's circle types, each with its own sub-types. Removing a type
 * only takes it out of the list; circles already using it keep their label.
 */
export function CircleTypesEditor({ value, onChange }: { value: CircleType[]; onChange: (next: CircleType[]) => void }) {
  const setNames = (names: string[]) =>
    onChange(names.map((name) => value.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? { name, subTypes: [] }));
  const setSubTypes = (name: string, subTypes: string[]) => onChange(value.map((t) => (t.name === name ? { ...t, subTypes } : t)));

  return (
    <div className="grid gap-4">
      <OptionListEditor
        label="Circle types"
        hint="Removing a type does not change circles that already use it. Residents choosing “Other” type their own."
        values={value.map((t) => t.name)}
        onChange={setNames}
        placeholder="e.g. Book club"
        maxLength={40}
      />
      {value.length > 0 && (
        <div className="grid gap-2">
          <p className="text-support font-semibold text-ink">Sub-types (optional)</p>
          {value.map((t) => (
            <details
              key={t.name}
              className="rounded-control border border-line bg-surface [&[open]>summary]:border-b [&[open]>summary]:border-line"
              open={t.subTypes.length > 0 && value.length <= 3}
            >
              <summary className="min-h-11 px-3 flex items-center justify-between gap-2 cursor-pointer text-support font-semibold text-ink">
                {t.name}
                <span className="text-meta font-normal text-ink-muted">
                  {t.subTypes.length ? `${t.subTypes.length} sub-types` : 'None'}
                </span>
              </summary>
              <div className="p-3">
                <OptionListEditor
                  label={`Sub-types of ${t.name}`}
                  values={t.subTypes}
                  onChange={(next) => setSubTypes(t.name, next)}
                  placeholder="e.g. Badminton"
                  maxLength={40}
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
