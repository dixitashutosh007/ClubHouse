'use client';

import { EyeOff } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { apiFetch } from '@/lib/api-client';

/** Residents you have hidden from RideShare, with a way to undo it */
export function HiddenResidentsSection() {
  const { data, reload } = useApiData(
    '/api/v1/hidden-residents',
    (json) => (json as { hidden: { userId: string; name: string }[] }).hidden,
    'Could not load hidden residents.'
  );
  if (!data || data.length === 0) return null;

  const unhide = async (userId: string) => {
    const res = await apiFetch('/api/v1/hidden-residents', { method: 'DELETE', json: { userId } });
    if (res.ok) reload();
  };

  return (
    <section aria-labelledby="hidden-residents" className="mt-6">
      <h2 id="hidden-residents" className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
        Hidden residents
      </h2>
      <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        {data.map((h) => (
          <li key={h.userId} className="flex items-center gap-3 p-3.5 text-sm">
            <EyeOff className="w-4 h-4 text-slate-600" aria-hidden="true" />
            <span className="flex-1 font-semibold text-slate-900">{h.name}</span>
            <button type="button" onClick={() => void unhide(h.userId)} className="text-xs font-semibold text-emerald-800">
              Unhide
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
