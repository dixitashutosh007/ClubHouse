'use client';

import { useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { SocietySuggestion } from '@/types';
import { formatIstDateTime } from '@/lib/utils/time';
import { Notify } from './types';

const MODULE_LABEL: Record<SocietySuggestion['module'], string> = {
  RIDESHARE: 'RideShare',
  CLASSES: 'Classes',
  GENERAL: 'General',
};

/** Residents' suggestions and problem reports about every app, in one inbox */
export function SuggestionsTab({ notify }: { notify: Notify }) {
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
    <section aria-labelledby="config-suggestions" className="space-y-3">
      <h2 id="config-suggestions" className="sr-only">Residents&apos; suggestions</h2>
      <div className="flex">
        {open.length > 0 && (
          <span className="ml-auto text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
            {open.length} open
          </span>
        )}
      </div>
      {loading ? (
        <Loading label="Loading suggestions…" />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <p className="text-xs text-zinc-600">No suggestions yet.</p>
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
