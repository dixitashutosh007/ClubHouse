'use client';

import { useRef } from 'react';
import Link from 'next/link';
import {
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  GraduationCap,
  Megaphone,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { MODULE_THEMES } from '@/lib/design/modules';
import type { BannerKind, HomeBanner } from '@/lib/services/home-banners';

const LOOK: Record<BannerKind, { icon: LucideIcon; label: string }> = {
  SEAT_ACCEPTED: { icon: CheckCircle2, label: 'RideShare' },
  RIDE_REQUESTS: { icon: BellRing, label: 'RideShare' },
  ADMIN_APPROVALS: { icon: ShieldCheck, label: 'Approvals' },
  CIRCLE_JOINED: { icon: Users, label: 'Circle' },
  NOTICE: { icon: Megaphone, label: 'Society notice' },
  NEW_CIRCLE: { icon: CircleDot, label: 'New circle' },
  NEW_CLASS: { icon: GraduationCap, label: 'New class' },
};

interface HomeBannersProps {
  banners: HomeBanner[];
  onOpenNotice: (noticeId: string) => void;
  onDismiss: (banner: HomeBanner) => void;
}

/**
 * One swipeable row of updates on Home: seats, requests, approvals, circles,
 * notices and new circles and classes. Each can be dismissed with ✕, which
 * the server remembers for every device. Nothing moves on its own; phones
 * swipe, larger screens also get arrows, and keyboard users tab through.
 */
export function HomeBanners({ banners, onOpenNotice, onDismiss }: HomeBannersProps) {
  const rowRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  if (banners.length === 0) return null;

  const scroll = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.9, behavior: 'smooth' });
  const dismiss = (b: HomeBanner) => {
    onDismiss(b);
    // The dismissed card's button disappears; keep keyboard focus nearby
    headingRef.current?.focus();
  };

  return (
    <section aria-labelledby="home-updates" className="grid gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h2 id="home-updates" ref={headingRef} tabIndex={-1} className="font-display text-section font-bold text-ink focus:outline-none">
          Updates <span className="text-support font-semibold text-ink-muted">({banners.length})</span>
        </h2>
        {banners.length > 1 && (
          <div className="hidden sm:flex gap-1">
            <IconButton icon={ChevronLeft} label="Earlier updates" variant="secondary" size="sm" onClick={() => scroll(-1)} />
            <IconButton icon={ChevronRight} label="More updates" variant="secondary" size="sm" onClick={() => scroll(1)} />
          </div>
        )}
      </div>
      <ul
        ref={rowRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scroll-px-4 pb-2 sm:mx-0 sm:px-0 sm:scroll-px-0 [scrollbar-width:thin]"
      >
        {banners.map((b) => {
          const theme = MODULE_THEMES[b.tone];
          const { icon: Icon, label } = LOOK[b.kind];
          const titleClass = cn(
            'min-h-6 font-display text-card font-bold text-ink text-left',
            // The title's link or button covers the whole card
            'after:absolute after:inset-0 after:rounded-card focus:outline-none focus-visible:after:ring-3 focus-visible:after:ring-terracotta-deep'
          );
          return (
            <li key={b.id} className={cn('snap-start shrink-0', banners.length === 1 ? 'w-full' : 'w-[85%] sm:w-[calc(50%-0.375rem)]')}>
              <article className={cn('relative h-full rounded-card border border-line p-4 pr-12 flex gap-3 items-start', theme.tint)}>
                <span className={cn('w-10 h-10 rounded-control bg-surface flex items-center justify-center shrink-0', theme.text)}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 grid gap-0.5">
                  <span className={cn('text-tag font-semibold uppercase tracking-wider', theme.text)}>{label}</span>
                  {b.href ? (
                    <Link href={b.href} className={titleClass}>
                      {b.title}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => b.noticeId && onOpenNotice(b.noticeId)} className={titleClass}>
                      {b.title}
                    </button>
                  )}
                  {b.body && <p className="text-support text-ink line-clamp-2">{b.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(b)}
                  aria-label={`Dismiss: ${b.title}`}
                  className="absolute z-10 top-1.5 right-1.5 w-11 h-11 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface/70"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
