'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, CalendarClock, GraduationCap, PenLine, PlusCircle, Search, UserCheck } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/context/AuthContext';
import { useIsClient } from '@/hooks/useIsClient';
import { cn } from '@/components/ui/cn';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/Layout';
import { MODULE_THEMES, type ModuleId } from '@/lib/design/modules';
import { classDaysLabel, classFeeLabel, classTimeLabel } from '@/lib/class-format';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';
import type { UpcomingRide } from '@/hooks/useMyUpcomingRides';
import type { ClassListing } from '@/types';

/** "Namaste, Rohan" and the society name */
export function Greeting({ name, societyName }: { name: string; societyName?: string }) {
  return (
    <header className="grid gap-1">
      <h1 className="font-display text-page md:text-display font-extrabold tracking-tight text-ink">
        {name ? `Namaste, ${name}` : 'Namaste'}
      </h1>
      {societyName && <p className="text-body text-ink-muted">Here’s what’s happening at {societyName}</p>}
    </header>
  );
}

/** The next confirmed ride, in RideShare's colour */
export function NextRideCard({ ride }: { ride: UpcomingRide }) {
  const isClient = useIsClient();
  return (
    <Link
      href={ride.href}
      className="group relative overflow-hidden rounded-sheet bg-ride text-ink-inverse p-5 md:p-6 grid gap-2 transition-shadow hover:shadow-raised"
    >
      <span
        aria-hidden="true"
        className="absolute -right-10 -bottom-14 w-48 h-48 rounded-full border-[20px] border-white/10 pointer-events-none"
      />
      <span className="relative flex items-center gap-1.5 text-tag font-semibold uppercase tracking-wider">
        <CalendarClock className="w-4 h-4" aria-hidden="true" /> Up next · RideShare
      </span>
      {isClient && (
        <span className="relative text-support font-semibold">
          {relativeDayLabel(istDateOf(ride.when))}, {formatIstTime(ride.when)}
        </span>
      )}
      <span className="relative font-display text-section md:text-page font-bold leading-tight">{ride.title}</span>
      <span className="relative flex items-center justify-between gap-3 text-support">
        <span className="min-w-0 truncate">{ride.detail}</span>
        <ArrowRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function ActionRow({ href, icon: Icon, text, tone }: { href: string; icon: typeof BellRing; text: string; tone: ModuleId }) {
  const theme = MODULE_THEMES[tone];
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 min-h-14 px-4 py-3 rounded-card bg-surface border border-line hover:bg-sunken">
        <span className={cn('w-10 h-10 rounded-control flex items-center justify-center shrink-0', theme.tint, theme.text)}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="flex-1 text-support font-semibold text-ink">{text}</span>
        <ArrowRight className="w-4 h-4 text-ink-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Things waiting on the resident; admins also see approvals they can act on */
export function PendingActions({ waiting, canApproveResidents, canApproveClasses }: { waiting: number; canApproveResidents: boolean; canApproveClasses: boolean }) {
  const isAdminWithApprovals = canApproveResidents || canApproveClasses;
  if (waiting === 0 && !isAdminWithApprovals) return null;
  return (
    <section aria-label="Needs your attention">
      <ul className="grid gap-2">
        {waiting > 0 && (
          <ActionRow href="/rides/my-requests" icon={BellRing} tone="ride" text={`${plural(waiting, 'ride request')} awaiting a reply`} />
        )}
        {isAdminWithApprovals && <AdminApprovals canApproveResidents={canApproveResidents} canApproveClasses={canApproveClasses} />}
      </ul>
    </section>
  );
}

interface Overview {
  residents: { waiting: number };
  classes: { waiting: number };
}

/** Only mounted for admins with an approval permission; the overview API checks the role itself */
function AdminApprovals({ canApproveResidents, canApproveClasses }: { canApproveResidents: boolean; canApproveClasses: boolean }) {
  const { society } = useAuth();
  const { data } = useApiData('/api/v1/admin/overview', (json) => json as Overview, 'Could not load approvals.', society?.id ?? '');
  if (!data) return null;
  const residents = canApproveResidents ? data.residents.waiting : 0;
  const classes = canApproveClasses ? data.classes.waiting : 0;
  return (
    <>
      {residents > 0 && (
        <ActionRow href="/admin?tab=MEMBERS" icon={UserCheck} tone="home" text={`${plural(residents, 'resident')} waiting for approval`} />
      )}
      {classes > 0 && (
        <ActionRow href="/admin?tab=LESSONS" icon={GraduationCap} tone="classes" text={`${plural(classes, 'class', 'classes')} waiting for approval`} />
      )}
    </>
  );
}

const QUICK_ACTIONS: { label: string; href: string; icon: typeof Search; tone: ModuleId }[] = [
  { label: 'Find a ride', href: '/rides', icon: Search, tone: 'ride' },
  { label: 'Offer a ride', href: '/rides/offer', icon: PlusCircle, tone: 'ride' },
  { label: 'Browse classes', href: '/lessons', icon: GraduationCap, tone: 'classes' },
  { label: 'Teach a class', href: '/lessons/create', icon: PenLine, tone: 'classes' },
];

/** Shortcuts into the live apps */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions">
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon, tone }) => {
          const theme = MODULE_THEMES[tone];
          return (
            <li key={href}>
              <Link
                href={href}
                className="h-full min-h-20 flex flex-col items-start justify-between gap-3 p-4 rounded-card bg-surface border border-line hover:border-line-strong hover:shadow-raised transition-shadow"
              >
                <span className={cn('w-10 h-10 rounded-control flex items-center justify-center', theme.tint, theme.text)}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-support font-bold text-ink">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The most recently posted live classes */
export function NewClasses({ classes }: { classes: ClassListing[] }) {
  if (classes.length === 0) return null;
  return (
    <section aria-labelledby="new-classes" className="grid gap-3">
      <SectionHeading
        id="new-classes"
        title="New in Classes"
        action={
          <Link href="/lessons" className="inline-flex items-center min-h-11 px-2 -mr-2 rounded-control text-support font-semibold text-classes-deep hover:underline">
            See all
          </Link>
        }
      />
      <ul className="grid gap-2">
        {classes.map((c) => (
          <li key={c.id}>
            <Card as="div" padding="none">
              <Link href="/lessons" className="block p-4 rounded-card hover:bg-sunken">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-card font-bold text-ink">{c.subject}</span>
                  <span className="shrink-0 text-support font-bold text-classes-deep">{classFeeLabel(c)}</span>
                </span>
                <span className="block text-meta text-ink-muted">
                  {c.contactName} · {classDaysLabel(c)}
                  {c.startTime ? ` · ${classTimeLabel(c)}` : ''}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
