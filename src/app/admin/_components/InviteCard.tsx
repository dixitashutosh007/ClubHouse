'use client';

import { Check, Copy, Share2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useIsClient } from '@/hooks/useIsClient';
import { Society } from '@/types';
import { Notify } from './types';

/** The society's invite link, ready to copy or share with new residents */
export function InviteCard({ society, notify }: { society: Society; notify: Notify }) {
  const isClient = useIsClient();
  const [copied, setCopied] = useState(false);

  if (!society.code) {
    return (
      <section className="mb-4 p-3.5 rounded-2xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
        This society has no invite code yet, so residents can only find it by searching after they verify
        their mobile.
      </section>
    );
  }

  const link = isClient ? `${window.location.origin}/join/${encodeURIComponent(society.code)}` : '';
  const message = `Join ${society.name} on Club House, our society's private community app: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Could not copy. Press and hold the link to copy it.', 'error');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${society.name} on Club House`, text: message });
      } catch {
        // dismissed
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      aria-labelledby="invite-heading"
      className="mb-4 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-2.5"
    >
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-emerald-700" aria-hidden="true" />
        <h2 id="invite-heading" className="text-xs font-bold text-emerald-900">
          Invite residents
        </h2>
        <span className="ml-auto text-[11px] font-mono font-bold text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded-md">
          {society.code}
        </span>
      </div>
      <p className="text-[11px] text-emerald-900">
        New residents open this link, verify their mobile and fill in their flat. You approve them here.
      </p>
      <output className="block text-[11px] font-mono text-slate-800 bg-white border border-emerald-200 rounded-lg px-2.5 py-2 break-all">
        {link}
      </output>
      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!link}
          className="py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          Share
        </button>
      </div>
    </section>
  );
}
