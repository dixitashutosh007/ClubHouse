'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, ChevronRight, GraduationCap, Megaphone, PlusCircle, Presentation, UserRound, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useIsClient } from '@/hooks/useIsClient';
import { APP_NAME } from '@/lib/brand';
import { cn } from '@/components/ui/cn';
import { MODULE_THEMES } from '@/lib/design/modules';

const SEEN_KEY = 'clubhouse_tour_seen';

interface Action {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Page to open; none means the action is on Home itself */
  href?: string;
  tone: string;
}

const ride = cn(MODULE_THEMES.ride.tint, MODULE_THEMES.ride.text);
const classes = cn(MODULE_THEMES.classes.tint, MODULE_THEMES.classes.text);
const home = cn(MODULE_THEMES.home.tint, MODULE_THEMES.home.text);

const ACTIONS: Action[] = [
  { icon: Car, title: 'Find a ride', body: 'Ride to work with a neighbour going your way', href: '/rides', tone: ride },
  { icon: PlusCircle, title: 'Offer a ride', body: 'Share the empty seats in your car. No fares', href: '/rides/offer', tone: ride },
  { icon: GraduationCap, title: 'Browse classes', body: 'Yoga, music, tuition and more in the society', href: '/lessons', tone: classes },
  { icon: Presentation, title: 'Teach a class', body: 'Share a skill with residents', href: '/lessons/create', tone: classes },
  { icon: Megaphone, title: 'Read society notices', body: 'They appear at the top of Home', tone: home },
  { icon: UserRound, title: 'Complete your profile', body: 'Add a photo, your work location and your car', href: '/profile', tone: home },
];

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // no storage (private mode): don't show it every time
  }
}

/**
 * A one-time "Get started" card for newly approved residents: each action
 * goes straight to the page that does it. Residents who saw the earlier
 * tour on this device (same key) are not shown it again.
 */
export function WelcomeTour() {
  const isClient = useIsClient();
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  if (!isClient || closed || hasSeen()) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setClosed(true);
  };

  return (
    <Dialog open onClose={finish} size="md" initialFocus="title" title={`Welcome to ${APP_NAME}`} description="You're approved. Where would you like to start?">
      <div className="grid gap-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <li key={a.title}>
              <button
                type="button"
                onClick={() => {
                  finish();
                  if (a.href) router.push(a.href);
                }}
                className="w-full h-full min-h-16 flex items-center gap-3 p-3 rounded-card border border-line bg-surface text-left hover:bg-sunken transition-colors"
              >
                <span className={cn('w-10 h-10 rounded-control flex items-center justify-center shrink-0', a.tone)}>
                  <a.icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-support font-bold text-ink">{a.title}</span>
                  <span className="block text-meta text-ink-muted">{a.body}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" fullWidth onClick={finish}>
          I&apos;ll look around myself
        </Button>
      </div>
    </Dialog>
  );
}
