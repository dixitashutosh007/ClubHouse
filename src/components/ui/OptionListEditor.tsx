'use client';

import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface OptionListEditorProps {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  maxLength?: number;
}

/**
 * Edits a short list of options (pick-up points, class locations…): each
 * option is a removable chip, and new ones are typed and added.
 */
export function OptionListEditor({
  label,
  hint,
  values,
  onChange,
  placeholder,
  maxItems = 30,
  maxLength = 80,
}: OptionListEditorProps) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setError(`"${value}" is already in the list.`);
      return;
    }
    if (values.length >= maxItems) {
      setError(`You can add up to ${maxItems} options.`);
      return;
    }
    onChange([...values, value]);
    setDraft('');
    setError('');
  };

  return (
    <div>
      <label htmlFor={inputId} className="text-meta font-semibold text-ink block mb-1">
        {label}
      </label>
      {hint && <p className="text-tag text-ink-muted mb-2">{hint}</p>}

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 mb-2" aria-label={label}>
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-surface border border-line-strong text-meta text-ink"
            >
              <span>{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="w-8 h-8 -my-1 -mr-2 rounded-full flex items-center justify-center text-ink-muted hover:bg-sunken hover:text-danger"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-tag text-ink-muted italic mb-2">Nothing added yet.</p>
      )}

      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 min-w-0 text-meta p-2.5 rounded-control border border-line-strong bg-surface focus:outline-none focus:ring-3 focus:ring-terracotta/30"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-3 rounded-control bg-ink text-ink-inverse text-meta font-semibold flex items-center gap-1 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add
        </button>
      </div>
      {error && (
        <p role="alert" className="text-tag text-danger mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
