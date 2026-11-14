'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useMyUpcomingRides } from '@/hooks/useMyUpcomingRides';
import { WelcomeTour } from '@/components/WelcomeTour';
import { NoticeCard, NoticeDialog, useSocietyNotices } from '@/components/SocietyNotices';
import { ModuleCard } from '@/components/ui/Card';
import { PageContainer, SectionHeading } from '@/components/ui/Layout';
import { MODULES } from '@/lib/design/modules';
import { hasPermission } from '@/lib/design/navigation';
import { firstName, homeSummary } from '@/components/home/home-data';
import { Greeting, NewClasses, NextRideCard, PendingActions, QuickActions } from '@/components/home/HomeSections';
import type { Announcement, ClassListing } from '@/types';

/**
 * Club House Home: the resident's neighbourhood at a glance. Every section
 * comes from data the account already has (rides, notices, classes, admin
 * approvals) and is left out when it has nothing to show.
 *
 * Phones: one column. Tablets: wider grids. Desktop: a main column and a
 * right rail for notices and new classes.
 */
export function AppHubScreen() {
  const { user, society, membership, activePersona } = useAuth();
  const upcoming = useMyUpcomingRides();
  const { data: liveClasses } = useApiData(
    '/api/v1/lessons',
    (json) => (json as { classes?: ClassListing[] }).classes ?? [],
    'Could not load classes.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const { notices, dismiss } = useSocietyNotices();
  const [openNotice, setOpenNotice] = useState<Announcement | null>(null);

  const summary = homeSummary(upcoming.items, liveClasses ?? []);
  const [latestNotice, ...olderNotices] = notices;
  const liveApps = MODULES.filter((m) => m.status === 'live');
  const comingSoon = MODULES.filter((m) => m.status !== 'live');
  const detailFor = (id: string) => (id === 'ride' ? summary.rideDetail : id === 'classes' ? summary.classDetail : undefined);

  return (
    <PageContainer width="wide">
      <WelcomeTour />
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="grid gap-6 content-start min-w-0 lg:col-start-1 lg:row-start-1">
          <Greeting name={firstName(user?.fullName)} societyName={society?.name} />

          {latestNotice && <NoticeCard notice={latestNotice} featured onOpen={setOpenNotice} onDismiss={dismiss} />}

          {summary.nextRide && <NextRideCard ride={summary.nextRide} />}

          <PendingActions
            waiting={upcoming.waiting}
            canApproveResidents={hasPermission(membership, 'canApproveResidents')}
            canApproveClasses={hasPermission(membership, 'canApproveClasses')}
          />

          <QuickActions />

          <section aria-labelledby="your-apps" className="grid gap-3">
            <SectionHeading id="your-apps" title="Your apps" />
            <div className="grid sm:grid-cols-2 gap-3">
              {liveApps.map((m) => (
                <ModuleCard key={m.id} module={m} detail={detailFor(m.id)} />
              ))}
            </div>
          </section>
        </div>

        {/* Right rail on desktop; after the main column on phones */}
        <aside aria-label="Around the society" className="grid gap-6 content-start min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <NewClasses classes={summary.newClasses} />
          {olderNotices.length > 0 && (
            <section aria-labelledby="society-notices" className="grid gap-3">
              <SectionHeading id="society-notices" title="Society notices" />
              <div className="grid gap-2">
                {olderNotices.slice(0, 3).map((n) => (
                  <NoticeCard key={n.id} notice={n} onOpen={setOpenNotice} onDismiss={dismiss} />
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Last on phones; under the main column on desktop */}
        <section aria-labelledby="coming-soon" className="grid gap-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <SectionHeading id="coming-soon" title="Coming soon" description="More ways to share with your neighbours." />
          <div className="grid grid-cols-2 gap-3">
            {comingSoon.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        </section>
      </div>

      <NoticeDialog notice={openNotice} onClose={() => setOpenNotice(null)} />
    </PageContainer>
  );
}
