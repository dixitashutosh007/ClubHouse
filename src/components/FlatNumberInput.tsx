'use client';

import { useId, useState } from 'react';
import { FlatNumberConfig } from '@/types';
import { formatFlat, parseFlat } from '@/lib/flat-number';

interface FlatNumberInputProps {
  label: string;
  /** The society's towers and number range; without it, a free-text box */
  config?: FlatNumberConfig;
  /** Free-text placeholder for societies without a setup */
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
}

/**
 * Flat number in the society's own format: pick the tower, type the number.
 * Societies that haven't set up their towers keep a plain text box.
 */
export function FlatNumberInput({ label, config, placeholder, value, onChange, inputClassName }: FlatNumberInputProps) {
  const id = useId();
  const parsed = config ? parseFlat(value, config) : { tower: undefined, number: value };
  const [tower, setTower] = useState(parsed.tower ?? '');
  // A stored value that doesn't fit the setup starts empty rather than showing stray text
  const [number, setNumber] = useState(config ? (/^\d+$/.test(parsed.number) ? parsed.number : '') : value);
  const base =
    inputClassName ??
    'w-full text-sm p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';

  if (!config) {
    return (
      <div>
        <label htmlFor={id} className="text-xs font-bold text-slate-800 block mb-1">
          {label}
        </label>
        <input
          id={id}
          type="text"
          required
          maxLength={32}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'e.g. B-804'}
          className={base}
        />
      </div>
    );
  }

  const update = (nextTower: string, nextNumber: string) => {
    setTower(nextTower);
    setNumber(nextNumber);
    onChange(nextNumber ? formatFlat(nextTower || undefined, nextNumber) : nextTower ? `${nextTower}-` : '');
  };
  const hasTowers = config.towers.length > 0;

  return (
    <fieldset>
      <legend className="text-xs font-bold text-slate-800 mb-1">{label}</legend>
      <div className={`grid gap-2 ${hasTowers ? 'grid-cols-[2fr_3fr]' : 'grid-cols-1'}`}>
        {hasTowers && (
          <div>
            <label htmlFor={`${id}-tower`} className="sr-only">
              Tower or block
            </label>
            <select
              id={`${id}-tower`}
              required
              value={tower}
              onChange={(e) => update(e.target.value, number)}
              className={base}
            >
              <option value="">Tower…</option>
              {config.towers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor={`${id}-number`} className="sr-only">
            Flat number
          </label>
          <input
            id={`${id}-number`}
            type="text"
            inputMode="numeric"
            required
            maxLength={5}
            value={number}
            onChange={(e) => update(tower, e.target.value.replace(/\D/g, ''))}
            placeholder={`${config.minNumber}–${config.maxNumber}`}
            className={base}
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-600 mt-1">
        {hasTowers ? 'Pick your tower, then your flat number' : 'Your flat number'} ({config.minNumber}–{config.maxNumber})
      </p>
    </fieldset>
  );
}
