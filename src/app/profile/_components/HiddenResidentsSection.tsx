'use client';

import { EyeOff } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

/** Residents you have hidden from RideShare, with a way to undo it */
export function HiddenResidentsSection() {
  const { data, reload } = useApiData(
    '/api/v1/hidden-residents',
    (json) => (json as { hidden: { userId: string; name: string }[] }).hidden,
    'Could not load hidden residents.'
  );
  if (!data) return null;
  if (data.length === 0) return <p className="text-support text-ink-muted">You have not hidden anyone. Hide a resident from a ride card to stop seeing each other&apos;s rides.</p>;

  const unhide = async (userId: string) => {
    const res = await apiFetch('/api/v1/hidden-residents', { method: 'DELETE', json: { userId } });
    if (res.ok) reload();
  };

  return (
    <ul className="rounded-control border border-line divide-y divide-line overflow-hidden">
      {data.map((h) => (
        <li key={h.userId} className="flex items-center gap-3 pl-3 pr-1 py-1">
          <EyeOff className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
          <span className="flex-1 text-support font-semibold text-ink">{h.name}</span>
          <Button variant="ghost" onClick={() => void unhide(h.userId)} aria-label={`Unhide ${h.name}`}>
            Unhide
          </Button>
        </li>
      ))}
    </ul>
  );
}
