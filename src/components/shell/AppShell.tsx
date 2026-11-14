'use client';

import React, { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TopBarNav } from '@/components/TopBarNav';
import { BottomNav } from '@/components/BottomNav';
import { RideActivityWatcher } from '@/components/RideActivityWatcher';
import { SideNav } from './SideNav';

/** Holds the sidebar's width while it loads, so the page does not jump */
function SideNavPlaceholder() {
  return <div aria-hidden="true" className="hidden lg:block w-64 shrink-0 border-r border-line bg-surface" />;
}

/**
 * The frame around every page.
 * - Approved residents: top bar and bottom tab bar on phones and tablets;
 *   a sidebar plus slim top bar from 1024px.
 * - Everyone else (signing in, onboarding, waiting for approval): the
 *   original centred card, with no app navigation.
 *
 * Pages built with the Aangan PageContainer (it carries data-full-width) use
 * the full width; pages not yet redesigned keep a readable centred column.
 * This is decided in CSS, so the shell does not depend on the URL.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, membership } = useAuth();
  const member = isAuthenticated && membership?.status === 'ACTIVE';

  if (!member) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col">
        <TopBarNav />
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Suspense fallback={<SideNavPlaceholder />}>
        <SideNav />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBarNav withSidebar />
        <RideActivityWatcher />
        <main id="main" className="flex-1 flex flex-col">
          <div
            className={[
              // Not yet redesigned: the same layout as before, in a centred column
              'flex-1 flex flex-col w-full max-w-[640px] mx-auto bg-ivory md:my-6 md:rounded-3xl md:border md:border-line md:overflow-clip',
              // Redesigned pages (PageContainer) take the whole width
              'has-[[data-full-width]]:max-w-none has-[[data-full-width]]:bg-transparent has-[[data-full-width]]:md:my-0 has-[[data-full-width]]:md:rounded-none has-[[data-full-width]]:md:border-0',
            ].join(' ')}
          >
            {children}
          </div>
        </main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
    </div>
  );
}
