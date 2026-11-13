'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Car,
  GraduationCap,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { useMyUpcomingRides } from '@/hooks/useMyUpcomingRides';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';
import { RIDESHARE_NAME } from '@/lib/brand';

interface AppHubScreenProps {
  onSelectApp: (appName: string) => void;
}

interface LiveApp {
  id: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  /** Tile and icon colours */
  tile: string;
  iconBg: string;
  cta: string;
  ctaColor: string;
}

const LIVE_APPS: LiveApp[] = [
  {
    id: 'rideshare',
    title: 'RideShare',
    tagline: 'Share your commute with neighbours. No fares, ever.',
    icon: Car,
    tile: 'from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-400',
    iconBg: 'from-emerald-600 to-teal-700',
    cta: 'Open',
    ctaColor: 'text-emerald-800',
  },
  {
    id: 'lessons',
    title: 'Classes',
    tagline: 'Yoga, music, tuition and more, taught by residents.',
    icon: GraduationCap,
    tile: 'from-violet-50 to-fuchsia-50 border-violet-200 hover:border-violet-400',
    iconBg: 'from-violet-600 to-purple-700',
    cta: 'Explore',
    ctaColor: 'text-violet-800',
  },
];

const COMING_SOON: { title: string; icon: LucideIcon }[] = [
  { title: 'Community', icon: MessageSquare },
  { title: 'Marketplace', icon: ShoppingBag },
  { title: 'Reviews', icon: Star },
];

/** "Today", "Tmrw", or the first three letters of the day label */
function shortDay(label: string): string {
  if (label === 'Today') return label;
  if (label === 'Tomorrow') return 'Tmrw';
  return label.slice(0, 3);
}

/**
 * The Club House home: the resident's next ride, then the society's apps.
 * Kept minimal; the society's name is already in the top bar.
 */
export function AppHubScreen({ onSelectApp }: AppHubScreenProps) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 pb-6">
      <div className="px-4 pt-4 space-y-6">
        <UpNextCard />

        {/* Live apps */}
        <section aria-labelledby="hub-apps">
          <h2 id="hub-apps" className="mb-2.5 px-1 text-sm font-extrabold text-slate-900">
            Your apps
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {LIVE_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelectApp(app.id)}
                  className={`group text-left rounded-3xl border bg-gradient-to-br p-4 shadow-xs hover:shadow-md active:scale-[0.98] transition-all flex flex-col gap-3 min-h-[168px] ${app.tile}`}
                >
                  <span
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-sm ${app.iconBg}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-extrabold text-slate-900">{app.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-slate-700">{app.tagline}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${app.ctaColor}`}>
                    {app.cta}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Coming soon */}
        <section aria-labelledby="hub-soon">
          <h2 id="hub-soon" className="mb-2.5 px-1 text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" aria-hidden="true" /> Coming soon
          </h2>
          <ul className="grid grid-cols-3 gap-2.5">
            {COMING_SOON.map(({ title, icon: Icon }) => (
              <li
                key={title}
                className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 flex flex-col items-center gap-1.5 text-center"
              >
                <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                </span>
                <span className="text-[12px] font-semibold text-slate-800">{title}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** The resident's next confirmed ride, joined or offered, kept current as things change */
function UpNextCard() {
  const isClient = useIsClient();
  const { items, waiting, loading: dataLoading } = useMyUpcomingRides();
  const next = items.find((i) => i.confirmed);
  // Shown only when a ride is offered or accepted; Home stays clean otherwise
  if (!isClient || dataLoading || !next) return null;
  const loading = false;

  return (
    <section
      aria-labelledby="hub-up-next"
      className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-br from-slate-900 via-emerald-950 to-emerald-800 shadow-lg shadow-emerald-900/20"
    >
      {/* Soft light and a fine grid for depth */}
      <div aria-hidden="true" className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-emerald-400/25 blur-3xl" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="relative flex items-center justify-between gap-2">
        <h2 id="hub-up-next" className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-200 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4" aria-hidden="true" /> Up next
        </h2>
        {waiting > 0 && (
          <Link
            href="/rides/my-requests"
            className="text-[11px] font-bold text-amber-950 bg-amber-300 px-2.5 py-0.5 rounded-full"
          >
            {waiting} awaiting reply
          </Link>
        )}
      </div>

      {loading ? (
        <div className="relative mt-4 space-y-2" aria-hidden="true">
          <div className="h-5 w-2/3 rounded bg-white/15 animate-pulse" />
          <div className="h-3.5 w-1/2 rounded bg-white/10 animate-pulse" />
        </div>
      ) : next ? (
        <Link href={next.href} className="group relative mt-4 flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/20 px-3 py-2 text-center backdrop-blur-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-200">
              {shortDay(relativeDayLabel(istDateOf(next.when)))}
            </span>
            <span className="block text-lg font-extrabold leading-tight">
              {formatIstTime(next.when).replace(/\s?(am|pm)$/i, '')}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold">{next.title}</span>
            <span className="block truncate text-xs text-emerald-100">{next.detail}</span>
          </span>
          <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      ) : (
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <p className="text-base font-semibold">Nothing planned yet</p>
          <Link
            href="/rides"
            className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-900 hover:bg-emerald-50"
          >
            Open {RIDESHARE_NAME}
          </Link>
        </div>
      )}
    </section>
  );
}
