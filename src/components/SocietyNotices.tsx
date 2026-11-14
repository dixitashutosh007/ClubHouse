'use client';

import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { Announcement } from '@/types';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

const DISMISSED_KEY = 'clubhouse_dismissed_notices';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** The society admins' current notices, minus the ones this resident dismissed */
export function useSocietyNotices() {
  const { activePersona, society } = useAuth();
  const isClient = useIsClient();
  const { data } = useApiData(
    '/api/v1/announcements',
    (json) => (json as { announcements?: Announcement[] }).announcements ?? [],
    'Could not load notices.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);

  const hidden = new Set([...(isClient ? readDismissed() : []), ...dismissedNow]);
  const notices = isClient && data ? data.filter((a) => !hidden.has(a.id)) : [];

  const dismiss = (id: string) => {
    setDismissedNow((cur) => [...cur, id]);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id].slice(-50)));
    } catch {
      // storage unavailable: hidden for this visit only
    }
  };

  return { notices, dismiss };
}

const byline = (n: Announcement) => `${n.fromName ? `${n.fromName} · ` : ''}${formatIstDay(istDateOf(n.createdAt))}`;

/**
 * One notice. `featured` is the highlighted latest notice at the top of Home;
 * tapping opens the full text, and the resident can dismiss it once read.
 */
export function NoticeCard({
  notice,
  featured = false,
  onOpen,
  onDismiss,
}: {
  notice: Announcement;
  featured?: boolean;
  onOpen: (n: Announcement) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <article
      className={cn(
        'relative rounded-card border',
        featured ? 'bg-turmeric-tint border-turmeric/60' : 'bg-surface border-line'
      )}
    >
      <button type="button" onClick={() => onOpen(notice)} className="w-full text-left p-4 pr-14 flex gap-3 items-start rounded-card">
        {featured && (
          <span className="w-10 h-10 rounded-control bg-turmeric text-ink flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 grid gap-0.5">
          {featured && <span className="text-tag font-semibold uppercase tracking-wider text-warning">Society notice</span>}
          <span className="font-display text-card font-bold text-ink">{notice.title}</span>
          <span className="text-support text-ink line-clamp-2 whitespace-pre-line">{notice.body}</span>
          <span className="text-meta text-ink-muted">{byline(notice)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDismiss(notice.id)}
        aria-label={`Dismiss notice: ${notice.title}`}
        className="absolute top-1.5 right-1.5 w-11 h-11 rounded-full flex items-center justify-center text-ink-muted hover:bg-sunken"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </article>
  );
}

/** The full text of a notice */
export function NoticeDialog({ notice, onClose }: { notice: Announcement | null; onClose: () => void }) {
  return (
    <Dialog open={notice !== null} onClose={onClose} title={notice?.title ?? ''} description={notice ? (notice.fromName ? `From ${byline(notice)}` : byline(notice)) : undefined} size="md">
      <p className="text-body text-ink whitespace-pre-line">{notice?.body}</p>
      <Button variant="secondary" fullWidth onClick={onClose} className="mt-5">
        Close
      </Button>
    </Dialog>
  );
}
