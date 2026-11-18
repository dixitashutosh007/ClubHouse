'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useRideActivity } from '@/lib/ride-activity';
import { useToast } from '@/components/ui/Toast';
import { HomeBanners } from '@/components/home/HomeBanners';
import { InstallPrompt } from '@/components/home/InstallPrompt';
import type { HomeBanner } from '@/lib/services/home-banners';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useCircleUnread } from '@/hooks/useCircleUnread';
import { useMyUpcomingRides } from '@/hooks/useMyUpcomingRides';
import { WelcomeTour } from '@/components/WelcomeTour';
import { NoticeCard, NoticeDialog, useSocietyNotices } from '@/components/SocietyNotices';
import { ModuleCard } from '@/components/ui/Card';
import { PageContainer, SectionHeading } from '@/components/ui/Layout';
import { MODULES } from '@/lib/design/modules';
import { firstName, homeSummary } from '@/components/home/home-data';
import { Greeting, NewClasses, NextRideCard, QuickActions } from '@/components/home/HomeSections';
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
  const { user, society, activePersona } = useAuth();
  const toast = useToast();
  const upcoming = useMyUpcomingRides();
  const { data: liveClasses } = useApiData(
    '/api/v1/lessons',
    (json) => (json as { classes?: ClassListing[] }).classes ?? [],
    'Could not load classes.',
    `${activePersona}:${society?.id ?? ''}`
  );
  // Only the number of live circles (the list itself carries no private details)
  const { data: liveCircles } = useApiData(
    '/api/v1/circles',
    (json) => ((json as { circles?: unknown[] }).circles ?? []).length,
    'Could not load circles.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const { notices } = useSocietyNotices();
  const [openNotice, setOpenNotice] = useState<Announcement | null>(null);

  // The banner row, built on the server for this resident (dismissals apply on every device)
  const bannerData = useApiData(
    '/api/v1/home/banners',
    (json) => json as { banners: HomeBanner[]; dismissedNoticeIds: string[] },
    'Could not load updates.',
    `${activePersona}:${society?.id ?? ''}`
  );
  useRideActivity(() => bannerData.reload());
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);
  const banners = (bannerData.data?.banners ?? []).filter((b) => !dismissedNow.includes(b.id));
  const dismissBanner = async (b: HomeBanner) => {
    setDismissedNow((cur) => [...cur, b.id]);
    const res = await apiFetch(`/api/v1/home/banners?id=${encodeURIComponent(b.id)}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setDismissedNow((cur) => cur.filter((id) => id !== b.id));
      toast.show('Could not dismiss that. Please try again.', 'error');
    }
  };
  // Notices dismissed from the row stay readable on Home as earlier notices
  const readNotices = new Set([
    ...(bannerData.data?.dismissedNoticeIds ?? []),
    ...dismissedNow.filter((id) => id.startsWith('notice:')).map((id) => id.slice('notice:'.length)),
  ]);
  const earlierNotices = notices.filter((n) => readNotices.has(n.id));

  const summary = homeSummary(upcoming.items, liveClasses ?? []);
  const liveApps = MODULES.filter((m) => m.status === 'live');
  const comingSoon = MODULES.filter((m) => m.status !== 'live');
  const circleUnread = useCircleUnread().total;
  const circleDetail = circleUnread
    ? `${circleUnread >= 99 ? '99+' : circleUnread} new ${circleUnread === 1 ? 'message' : 'messages'}`
    : liveCircles
      ? `${liveCircles} ${liveCircles === 1 ? 'circle' : 'circles'} to join`
      : undefined;
  const detailFor = (id: string) =>
    id === 'ride' ? summary.rideDetail : id === 'classes' ? summary.classDetail : id === 'community' ? circleDetail : undefined;

  return (
    <PageContainer width="wide">
      <WelcomeTour />
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="grid gap-6 content-start min-w-0 lg:col-start-1 lg:row-start-1">
          <Greeting name={firstName(user?.fullName)} societyName={society?.name} />

          <HomeBanners
            banners={banners}
            onOpenNotice={(id) => setOpenNotice(notices.find((n) => n.id === id) ?? null)}
            onDismiss={(b) => void dismissBanner(b)}
          />

          {summary.nextRide && <NextRideCard ride={summary.nextRide} />}

          <InstallPrompt />

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
          {earlierNotices.length > 0 && (
            <section aria-labelledby="society-notices" className="grid gap-3">
              <SectionHeading id="society-notices" title="Earlier notices" />
              <div className="grid gap-2">
                {earlierNotices.slice(0, 3).map((n) => (
                  <NoticeCard key={n.id} notice={n} onOpen={setOpenNotice} />
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
