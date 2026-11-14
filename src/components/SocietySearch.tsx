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
    <div className="grid gap-3">
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
          className="flex-1 min-w-0 h-12 px-4 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep"
        />
        <button
          type="submit"
          disabled={searching}
          aria-label="Search societies"
          className="w-12 h-12 inline-flex items-center justify-center rounded-control bg-terracotta-deep text-ink-inverse hover:bg-terracotta-deep/90 disabled:opacity-60"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-meta font-medium text-danger">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="text-support text-ink-muted">
          No society found. Check the spelling, or ask your society admin for the invite link.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="grid gap-2 max-h-72 overflow-y-auto" aria-label="Matching societies">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(s)}
                className="w-full min-h-14 flex items-start gap-3 p-3 rounded-card border border-line-strong bg-surface text-left hover:border-terracotta-deep hover:bg-terracotta-tint disabled:opacity-60 transition-colors"
              >
                <Building2 className="w-5 h-5 mt-0.5 text-terracotta-deep shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-body font-bold text-ink">{s.name}</span>
                  <span className="block text-meta text-ink-muted truncate">{s.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
