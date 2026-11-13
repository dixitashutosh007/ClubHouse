'use client';

import { apiFetch } from '@/lib/api-client';
import { firebaseApp } from '@/lib/firebase/config';

/**
 * Push notifications through Firebase Cloud Messaging. They reach the phone
 * even when Club House is closed. Needs the web push key
 * (NEXT_PUBLIC_FIREBASE_VAPID_KEY, from Firebase console → Project settings →
 * Cloud Messaging → Web Push certificates); without it the app falls back
 * to in-app alerts while open.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const TOKEN_KEY = 'clubhouse_push_token';

export type PushResult = 'enabled' | 'denied' | 'unsupported' | 'not-configured' | 'failed';

export function isPushConfigured(): boolean {
  return Boolean(VAPID_KEY);
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

/** True once this browser has registered for push */
export function isPushActive(): boolean {
  return isPushConfigured() && Boolean(storedToken());
}

async function currentToken(): Promise<string | null> {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported()) || !('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

async function register(token: string): Promise<boolean> {
  const res = await apiFetch('/api/v1/notifications/devices', { json: { token } });
  if (res.ok) storeToken(token);
  return res.ok;
}

/** Asks permission (from a tap) and registers this browser for push */
export async function enablePush(): Promise<PushResult> {
  if (!isPushConfigured()) return 'not-configured';
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const token = await currentToken();
    if (!token) return 'unsupported';
    return (await register(token)) ? 'enabled' : 'failed';
  } catch (err) {
    console.warn('Could not enable push notifications', err);
    return 'failed';
  }
}

let refreshedThisSession = false;

/**
 * Keeps the registration current: tokens can change, and a different
 * resident may have signed in on this browser. Runs once per page load.
 */
export async function refreshPushRegistration(): Promise<void> {
  if (refreshedThisSession || !isPushConfigured()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  refreshedThisSession = true;
  try {
    const token = await currentToken();
    if (token) await register(token);
  } catch (err) {
    console.warn('Could not refresh push registration', err);
  }
}

/** Stops push on this browser for the signed-in resident (call before signing out) */
export async function disablePush(): Promise<void> {
  const token = storedToken();
  storeToken(null);
  refreshedThisSession = false;
  if (!token) return;
  try {
    await apiFetch('/api/v1/notifications/devices', { method: 'DELETE', json: { token } });
    const { deleteToken, getMessaging } = await import('firebase/messaging');
    await deleteToken(getMessaging(firebaseApp));
  } catch {
    // Best effort: the server also drops tokens that stop working
  }
}
