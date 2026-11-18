'use client';

import { useEffect } from 'react';
import { startInstallCapture } from '@/lib/install-prompt';

// The browser's install offer can arrive before any page mounts, so listen straight away
if (typeof window !== 'undefined') startInstallCapture();

/**
 * Registers the service worker (offline page, push notifications) in
 * production builds. Skipped in development so cached assets never get in
 * the way of hot reloading. Also starts listening for the browser's
 * "install this app" offer, used by the Home card.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  }, []);
  return null;
}
