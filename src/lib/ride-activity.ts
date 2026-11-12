'use client';

import { useEffect, useRef } from 'react';

/**
 * Tells open screens that something changed on a ride (a request, an
 * acceptance, a cancellation) so they reload their data. Raised by the
 * notification watcher when new notifications arrive, and by screens after
 * the resident changes something themselves.
 */
const RIDE_ACTIVITY_EVENT = 'clubhouse:ride-activity';

export function emitRideActivity(): void {
  window.dispatchEvent(new Event(RIDE_ACTIVITY_EVENT));
}

/**
 * Runs `onActivity` when ride activity is announced, and when the resident
 * comes back to the app (tab shown again), so screens never show stale rides.
 */
export function useRideActivity(onActivity: () => void): void {
  const callback = useRef(onActivity);
  useEffect(() => {
    callback.current = onActivity;
  });

  useEffect(() => {
    const run = () => callback.current();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener(RIDE_ACTIVITY_EVENT, run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(RIDE_ACTIVITY_EVENT, run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
