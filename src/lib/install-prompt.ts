/**
 * "Add Club House to your home screen". The browser offers installation
 * once, early, through the beforeinstallprompt event (Chrome and Edge on
 * Android and desktop). We keep that event so the Home card can open the
 * browser's own install dialog later. iPhones have no such event: they
 * install through Share → Add to Home Screen.
 *
 * Everything here is remembered on this device only: installing is per
 * device, so a dismissal on one phone should not hide the card on another.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS_KEY = 'clubhouse_visits';
const VISIT_COUNTED_KEY = 'clubhouse_visit_counted';
const DISMISSED_KEY = 'clubhouse_install_dismissed';

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let version = 0;
let started = false;
const listeners = new Set<() => void>();

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string) {
  try {
    store?.setItem(key, value);
  } catch {
    // Private browsing or storage turned off: the card simply shows less often
  }
}

/** Starts listening (once, as early as possible) and counts this visit */
export function startInstallCapture() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep it for the Home card instead of the browser's own mini-bar
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installedNow = true;
    deferred = null;
    safeSet(localStorage, DISMISSED_KEY, 'installed');
    emit();
  });
  // One visit per browser session (a tab kept open is still one visit)
  if (!safeGet(sessionStorage, VISIT_COUNTED_KEY)) {
    safeSet(sessionStorage, VISIT_COUNTED_KEY, '1');
    safeSet(localStorage, VISITS_KEY, String(visitCount() + 1));
  }
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes whenever the install state changes (for useSyncExternalStore) */
export const installVersion = () => version;

export function visitCount(): number {
  return Number(safeGet(typeof window === 'undefined' ? undefined : localStorage, VISITS_KEY)) || 0;
}

/** Already running as an installed app */
export function isInstalled(): boolean {
  if (installedNow) return true;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS reports itself as a Mac with touch
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export const canPromptInstall = () => deferred !== null;

export function isInstallDismissed(): boolean {
  return Boolean(safeGet(typeof window === 'undefined' ? undefined : localStorage, DISMISSED_KEY));
}

export function dismissInstall() {
  safeSet(localStorage, DISMISSED_KEY, 'dismissed');
  emit();
}

/** Opens the browser's own install dialog */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null; // the browser allows each event to be used once
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') safeSet(localStorage, DISMISSED_KEY, 'installed');
  emit();
  return outcome;
}

/**
 * Whether the Home card should show: from the second visit, not installed,
 * not dismissed on this device, and only where installing is possible
 * (an install event from the browser, or an iPhone/iPad).
 */
export function shouldOfferInstall(): 'prompt' | 'ios' | null {
  if (typeof window === 'undefined' || isInstalled() || isInstallDismissed() || visitCount() < 2) return null;
  if (canPromptInstall()) return 'prompt';
  if (isIos()) return 'ios';
  return null;
}
