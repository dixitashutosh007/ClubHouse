'use client';

import { useId } from 'react';

interface OptionPickerProps {
  label: string;
  /** The society's standard options */
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** Placeholder for the "type your own" box */
  otherPlaceholder?: string;
  maxLength?: number;
}

/**
 * Pick one of the society's standard options, or type your own. Typing a
 * value that matches an option selects that option.
 */
export function OptionPicker({ label, options, value, onChange, otherPlaceholder, maxLength = 80 }: OptionPickerProps) {
  const inputId = useId();
  const isStandard = options.some((o) => o === value);

  return (
    <fieldset>
      <legend className="text-xs font-bold text-slate-800 mb-1.5">{label}</legend>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? '' : option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selected
                    ? 'bg-emerald-700 border-emerald-700 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-500'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
      <label htmlFor={inputId} className="sr-only">
        {options.length > 0 ? `Or type another ${label.toLowerCase()}` : label}
      </label>
      <input
        id={inputId}
        type="text"
        value={isStandard ? '' : value}
        maxLength={maxLength}
        placeholder={otherPlaceholder ?? (options.length > 0 ? 'Or type another place' : 'Type a place')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
      />
    </fieldset>
  );
}
