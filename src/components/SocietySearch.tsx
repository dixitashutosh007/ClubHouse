'use client';

import React, { useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { apiFetch, apiErrorMessage } from '@/lib/api-client';

export interface SocietySearchResult {
  id: string;
  name: string;
  address: string;
}

interface SocietySearchProps {
  /** Firebase ID token from the SMS verification that just succeeded */
  idToken: string;
  onPick: (society: SocietySearchResult) => void;
  busy?: boolean;
}

/** Lets a newly verified number find its society and ask to join it */
export function SocietySearch({ idToken, onPick, busy = false }: SocietySearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocietySearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const res = await apiFetch('/api/v1/societies/search', { method: 'POST', json: { idToken, query } });
      if (res.ok) setResults((await res.json()).societies ?? []);
      else setError(await apiErrorMessage(res, 'Could not search right now. Please try again.'));
    } catch {
      setError('Connection problem. Check your internet and try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="society-search" className="sr-only">
          Society name or area
        </label>
        <input
          id="society-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Society name or area"
          minLength={2}
          required
          className="flex-1 min-w-0 text-sm font-semibold p-3 rounded-xl border-2 border-slate-300 focus:border-emerald-600 bg-white text-slate-900 placeholder:text-slate-500 outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          aria-label="Search societies"
          className="px-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="text-xs text-slate-600">
          No society found. Check the spelling, or ask your society admin for the invite link.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-2 max-h-60 overflow-y-auto" aria-label="Matching societies">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(s)}
                className="w-full flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white text-left hover:border-emerald-500 hover:bg-emerald-50/40 disabled:opacity-60 transition-colors"
              >
                <Building2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900">{s.name}</span>
                  <span className="block text-[11px] text-slate-600 truncate">{s.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
