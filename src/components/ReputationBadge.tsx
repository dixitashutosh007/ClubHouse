import { BadgeCheck } from 'lucide-react';
import type { Reputation } from '@/types';

/** "12 rides · 95% reliable", or "New" for someone with no rated rides yet */
export function reputationText(rep: Reputation | undefined): string {
  if (!rep || rep.rides === 0) return 'New';
  const rides = `${rep.rides} ride${rep.rides === 1 ? '' : 's'}`;
  return rep.reliablePercent === null ? rides : `${rides} · ${rep.reliablePercent}% reliable`;
}

/** A neighbour's track record from ratings after shared rides */
export function ReputationBadge({ reputation }: { reputation?: Reputation }) {
  const isNew = !reputation || reputation.rides === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isNew ? 'text-slate-600' : 'text-emerald-800'}`}
      title={reputation?.topTags.length ? reputation.topTags.join(', ') : undefined}
    >
      <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
      {reputationText(reputation)}
    </span>
  );
}
