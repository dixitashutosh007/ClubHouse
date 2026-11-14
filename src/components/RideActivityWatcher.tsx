'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Car, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { emitRideActivity } from '@/lib/ride-activity';
import { InAppNotification } from '@/types';
import { isPushActive, refreshPushRegistration } from '@/lib/firebase/push';

/** How often to check for news while the app is on screen, and while it is in the background */
const VISIBLE_POLL_MS = 10_000;
const HIDDEN_POLL_MS = 60_000;
const TOAST_MS = 12_000;

/** Notifications important enough to pop up over the page */
const POPUP_TYPES: InAppNotification['type'][] = [
  'RIDE_REQUESTED',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'RIDE_CANCELLED',
  'RIDE_STARTED',
  'SOS_ALERT',
];

/**
 * Watches the signed-in resident's notifications across the whole app. When
 * something new arrives it refreshes open ride screens, pops up the key
 * updates (a seat request, an acceptance, a cancellation) at the top of the
 * page, and shows a phone notification if the app is in the background and
 * the resident allowed them.
 */
export function RideActivityWatcher() {
  const { membership, activePersona } = useAuth();
  const isActive = membership?.status === 'ACTIVE';
  const [toasts, setToasts] = useState<InAppNotification[]>([]);
  // Notifications already known; null until the first load, which never pops up
  const seen = useRef<Set<string> | null>(null);

  const check = useCallback(async () => {
    let list: InAppNotification[];
    try {
      const res = await apiFetch('/api/v1/notifications');
      if (!res.ok) return;
      list = ((await res.json()) as { notifications?: InAppNotification[] }).notifications ?? [];
    } catch {
      return; // offline: try again on the next tick
    }

    if (seen.current === null) {
      seen.current = new Set(list.map((n) => n.id));
      return;
    }
    const fresh = list.filter((n) => !seen.current!.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => seen.current!.add(n.id));

    emitRideActivity();
    const popups = fresh.filter((n) => !n.read && POPUP_TYPES.includes(n.type));
    if (popups.length === 0) return;

    if (document.visibilityState === 'visible') {
      setToasts((current) => [...popups, ...current].slice(0, 3));
    } else if (!isPushActive()) {
      // Real push already alerts this phone when the app is in the background
      void showSystemNotifications(popups);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refreshPushRegistration();
    seen.current = null; // a different resident or society: start afresh
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      await check();
      if (stopped) return;
      timer = setTimeout(tick, document.visibilityState === 'visible' ? VISIBLE_POLL_MS : HIDDEN_POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isActive, activePersona, membership?.societyId, check]);

  // Each popup closes by itself after a while
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((current) => current.slice(0, -1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismiss = (id: string, markRead: boolean) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    if (markRead) {
      void apiFetch('/api/v1/notifications', { method: 'PATCH', json: { notificationId: id } }).catch(() => {});
    }
  };

  return (
    <div
      aria-live="polite"
      className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto w-full max-w-sm bg-surface rounded-card shadow-overlay border border-line p-3.5 flex items-start gap-3 animate-in slide-in-from-top-4 fade-in duration-300"
        >
          <span className={`w-10 h-10 rounded-control flex items-center justify-center shrink-0 ${iconTone(toast.type)}`}>
            <ToastIcon type={toast.type} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-support font-bold text-ink">{toast.title}</p>
            <p className="text-meta text-ink-muted mt-0.5">{toast.body}</p>
            {toast.link && (
              <Link
                href={toast.link}
                onClick={() => dismiss(toast.id, true)}
                className="inline-flex items-center min-h-11 -mb-2 text-support font-semibold text-ride-deep underline underline-offset-2"
              >
                {toast.type === 'RIDE_REQUESTED' ? 'Review request' : 'View ride'}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id, false)}
            aria-label="Dismiss notification"
            className="w-11 h-11 -m-2 inline-flex items-center justify-center rounded-full text-ink-muted hover:bg-sunken shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function iconTone(type: InAppNotification['type']): string {
  if (type === 'REQUEST_ACCEPTED') return 'bg-success-bg text-success';
  if (type === 'RIDE_REQUESTED') return 'bg-ride-tint text-ride-deep';
  return 'bg-warning-bg text-warning';
}

function ToastIcon({ type }: { type: InAppNotification['type'] }) {
  if (type === 'REQUEST_ACCEPTED') return <CheckCircle2 className="w-5 h-5" aria-hidden="true" />;
  if (type === 'RIDE_REQUESTED') return <Car className="w-5 h-5" aria-hidden="true" />;
  return <AlertCircle className="w-5 h-5" aria-hidden="true" />;
}

/** Phone notifications while the app is in the background, if the resident allowed them */
async function showSystemNotifications(items: InAppNotification[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    for (const n of items) {
      await reg.showNotification(n.title, {
        body: n.body,
        icon: '/icons/icon-192.png',
        tag: n.id,
        data: { url: n.link ?? '/' },
      });
    }
  } catch {
    // Notifications are a convenience; the in-app list still has them
  }
}
