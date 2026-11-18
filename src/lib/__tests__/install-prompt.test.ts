import { describe, it, expect, beforeEach, vi } from 'vitest';

/** A tiny browser: storage, events, display mode and user agent */
function fakeBrowser({ ios = false, standalone = false } = {}) {
  const store = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  const target = new EventTarget();
  const local = store();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', store());
  vi.stubGlobal('window', Object.assign(target, { matchMedia: () => ({ matches: standalone }) }));
  vi.stubGlobal('navigator', {
    userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (Linux; Android 14)',
    platform: 'Linux',
    maxTouchPoints: 5,
  });
  return { target, local, newSession: () => vi.stubGlobal('sessionStorage', store()) };
}

const installEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') =>
  Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) });

async function load() {
  vi.resetModules();
  return import('../install-prompt');
}

describe('install prompt', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('waits for a second visit, and counts one visit per browser session', async () => {
    const b = fakeBrowser();
    let m = await load();
    m.startInstallCapture();
    b.target.dispatchEvent(installEvent());
    expect(m.visitCount()).toBe(1);
    expect(m.shouldOfferInstall()).toBeNull();
    // Same session again: still the first visit
    m = await load();
    m.startInstallCapture();
    expect(m.visitCount()).toBe(1);
    // A new session is the second visit
    b.newSession();
    m = await load();
    m.startInstallCapture();
    b.target.dispatchEvent(installEvent());
    expect(m.shouldOfferInstall()).toBe('prompt');
  });

  it('opens the browser dialog and stops offering once installed', async () => {
    const b = fakeBrowser();
    b.local.setItem('clubhouse_visits', '3');
    const m = await load();
    m.startInstallCapture();
    const event = installEvent('accepted');
    b.target.dispatchEvent(event);
    expect(await m.promptInstall()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalled();
    expect(m.shouldOfferInstall()).toBeNull();
    expect(await m.promptInstall()).toBe('unavailable');
  });

  it('remembers ✕ on this device', async () => {
    const b = fakeBrowser();
    b.local.setItem('clubhouse_visits', '2');
    const m = await load();
    m.startInstallCapture();
    b.target.dispatchEvent(installEvent());
    m.dismissInstall();
    expect(m.shouldOfferInstall()).toBeNull();
  });

  it('shows the Share steps on an iPhone, and nothing when already installed or with no way to install', async () => {
    let b = fakeBrowser({ ios: true });
    b.local.setItem('clubhouse_visits', '2');
    let m = await load();
    expect(m.shouldOfferInstall()).toBe('ios');

    b = fakeBrowser({ ios: true, standalone: true });
    b.local.setItem('clubhouse_visits', '2');
    m = await load();
    expect(m.shouldOfferInstall()).toBeNull();

    // A desktop browser that never offers installing
    b = fakeBrowser();
    b.local.setItem('clubhouse_visits', '5');
    m = await load();
    expect(m.shouldOfferInstall()).toBeNull();
  });

  it('hides for good once the browser reports the app installed', async () => {
    const b = fakeBrowser();
    b.local.setItem('clubhouse_visits', '2');
    const m = await load();
    m.startInstallCapture();
    b.target.dispatchEvent(installEvent());
    b.target.dispatchEvent(new Event('appinstalled'));
    expect(m.shouldOfferInstall()).toBeNull();
    expect(b.local.getItem('clubhouse_install_dismissed')).toBe('installed');
  });
});
