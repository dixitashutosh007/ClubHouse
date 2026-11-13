'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Car,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { useRideActivity } from '@/lib/ride-activity';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';
import { APP_NAME, RIDESHARE_NAME } from '@/lib/brand';
import { RideOccurrence, RideRequest } from '@/types';

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

/** "Good morning" etc. by the time in India */
function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The Club House home: a greeting, the resident's next ride, quick actions,
 * and the society's apps.
 */
export function AppHubScreen({ onSelectApp }: AppHubScreenProps) {
  const { user, society, membership } = useAuth();
  const isClient = useIsClient();
  const firstName = user?.fullName?.split(' ')[0] || 'Resident';
  const isAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';

  return (
    <div className="flex-1 flex flex-col bg-slate-50 pb-6">
      {/* Greeting */}
      <section className="relative overflow-hidden px-5 pt-6 pb-16 bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white">
        <div aria-hidden="true" className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">{society?.name ?? APP_NAME}</p>
          <h1 className="mt-1 text-[26px] leading-tight font-extrabold tracking-tight">
            {isClient ? greeting(new Date()) : 'Hello'}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-emerald-50">Your neighbourhood, one tap away.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Verified resident{isAdmin ? ' · Admin' : ''}
          </span>
        </div>
      </section>

      <div className="px-4 -mt-10 relative space-y-6">
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

        <p className="pt-2 text-center text-[11px] text-slate-600">
          {APP_NAME} · for the residents of {society?.name ?? 'your society'}
        </p>
      </div>
    </div>
  );
}

type MyRequest = RideRequest & { journey: RideOccurrence | null; offererName: string };

const UPCOMING_RIDE = ['OPEN', 'PARTIALLY_BOOKED', 'FULL'];

/** Checked when the data arrives (not while rendering) */
const isUpcoming = (iso: string) => Date.parse(iso) > Date.now();

/** The resident's next confirmed ride, joined or offered, kept current as things change */
function UpNextCard() {
  const { activePersona } = useAuth();
  const isClient = useIsClient();
  const requests = useApiData(
    '/api/v1/rides/requests',
    (json) =>
      ((json as { requests?: MyRequest[] }).requests ?? []).filter(
        (r) => r.journey && isUpcoming(r.journey.departureWindowStart)
      ),
    'Could not load your rides',
    activePersona
  );
  const offered = useApiData(
    '/api/v1/rides?mine=true',
    (json) =>
      ((json as { rides?: RideOccurrence[] }).rides ?? []).filter(
        (r) => UPCOMING_RIDE.includes(r.status) && isUpcoming(r.departureWindowStart)
      ),
    'Could not load your rides',
    activePersona
  );
  useRideActivity(() => {
    requests.reload();
    offered.reload();
  });


  type NextRide = { when: string; title: string; detail: string; href: string };
  const candidates: NextRide[] = [
    ...(requests.data ?? [])
      .filter((r) => r.status === 'ACCEPTED' && r.journey)
      .map((r) => ({
        when: r.journey!.departureWindowStart,
        title: `To ${r.dropoffName}`,
        detail: `Riding with ${r.offererName} · meet at ${r.pickupName}`,
        href: '/rides/my-requests',
      })),
    ...(offered.data ?? [])
      .map((r) => {
        const joined = r.totalSeats - r.availableSeats;
        return {
          when: r.departureWindowStart,
          title: `To ${r.destinationName}`,
          detail:
            joined > 0
              ? `You're offering · ${joined} neighbour${joined > 1 ? 's' : ''} joining`
              : `You're offering · ${r.availableSeats} seat${r.availableSeats > 1 ? 's' : ''} open`,
          href: `/rides/requests?journeyId=${encodeURIComponent(r.id)}`,
        };
      }),
  ].sort((a, b) => a.when.localeCompare(b.when));
  const next = candidates[0];
  const waiting = (requests.data ?? []).filter((r) => r.status === 'REQUESTED').length;

  const loading = !isClient || (requests.loading && offered.loading);

  return (
    <section
      aria-labelledby="hub-up-next"
      className="rounded-3xl bg-white border border-slate-200 shadow-lg shadow-slate-300/40 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="hub-up-next" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Up next
        </h2>
        {waiting > 0 && (
          <Link
            href="/rides/my-requests"
            className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full"
          >
            {waiting} request{waiting > 1 ? 's' : ''} awaiting reply
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : next ? (
        <Link href={next.href} className="group mt-2 flex items-center gap-3">
          <span className="w-12 shrink-0 rounded-2xl bg-emerald-50 border border-emerald-200 py-1.5 text-center">
            <span className="block text-[10px] font-bold uppercase text-emerald-800">
              {shortDay(relativeDayLabel(istDateOf(next.when)))}
            </span>
            <span className="block text-[13px] font-extrabold text-slate-900">
              {formatIstTime(next.when).replace(/\s?(am|pm)$/i, '')}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-slate-900">{next.title}</span>
            <span className="block truncate text-xs text-slate-700">
              {relativeDayLabel(istDateOf(next.when))}, {formatIstTime(next.when)} · {next.detail}
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-700">No rides planned yet.</p>
          <Link
            href="/rides"
            className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            Open {RIDESHARE_NAME}
          </Link>
        </div>
      )}
    </section>
  );
}
