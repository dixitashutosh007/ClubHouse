'use client';

import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { Announcement } from '@/types';

const DISMISSED_KEY = 'clubhouse_dismissed_notices';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** The society admins' current notices, on Home; each resident can dismiss one once read */
export function SocietyNotices() {
  const { activePersona, society } = useAuth();
  const isClient = useIsClient();
  const { data } = useApiData(
    '/api/v1/announcements',
    (json) => (json as { announcements?: Announcement[] }).announcements ?? [],
    'Could not load notices.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);
  if (!isClient || !data) return null;

  const hidden = new Set([...readDismissed(), ...dismissedNow]);
  const notices = data.filter((a) => !hidden.has(a.id)).slice(0, 3);
  if (notices.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissedNow((cur) => [...cur, id]);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id].slice(-50)));
    } catch {
      // storage unavailable: hidden for this visit only
    }
  };

  return (
    <section aria-labelledby="notices" className="space-y-2">
      <h2 id="notices" className="px-1 text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
        <Megaphone className="w-4 h-4 text-amber-600" aria-hidden="true" /> Society notices
      </h2>
      {notices.map((n) => (
        <article key={n.id} className="relative p-3.5 pr-10 rounded-2xl bg-amber-50 border border-amber-200">
          <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
          <p className="mt-0.5 text-xs text-slate-800 whitespace-pre-line">{n.body}</p>
          <p className="mt-1.5 text-[11px] text-slate-600">{formatIstDay(istDateOf(n.createdAt))}</p>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label={`Dismiss notice: ${n.title}`}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-amber-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </article>
      ))}
    </section>
  );
}
