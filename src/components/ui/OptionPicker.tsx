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
      <legend className="text-support font-semibold text-ink mb-1.5">{label}</legend>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? '' : option)}
                className={`min-h-11 px-4 rounded-full text-support font-semibold border transition-colors ${
                  selected ? 'bg-ride-deep border-ride-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink hover:bg-sunken'
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
        className="w-full h-11 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-ride/30 focus:border-ride-deep px-3"
      />
    </fieldset>
  );
}
