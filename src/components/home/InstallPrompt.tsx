'use client';

import { useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { APP_NAME } from '@/lib/brand';
import { dismissInstall, promptInstall, shouldOfferInstall, subscribeInstall } from '@/lib/install-prompt';

/**
 * "Add Club House to your home screen", from a resident's second visit.
 * Android and desktop Chrome get an Install button that opens the browser's
 * own dialog; iPhones get the two Share-sheet steps. ✕ hides it for good on
 * this device (installing is per device), and it never shows once installed.
 */
export function InstallPrompt() {
  const toast = useToast();
  const offer = useSyncExternalStore(subscribeInstall, shouldOfferInstall, () => null);
  const [busy, setBusy] = useState(false);
  if (!offer) return null;

  const install = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast.show(`${APP_NAME} is on your home screen`, 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="install-title" className="relative rounded-card border border-line bg-surface p-4 pr-14 grid gap-3">
      <div className="flex gap-3 items-start">
        <span className="w-10 h-10 rounded-control bg-home-tint text-home-deep flex items-center justify-center shrink-0">
          <SquarePlus className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 grid gap-0.5">
          <h2 id="install-title" className="font-display text-card font-bold text-ink">
            Add {APP_NAME} to your home screen
          </h2>
          <p className="text-support text-ink-muted">Open it like an app, in one tap.</p>
        </div>
      </div>

      {offer === 'prompt' ? (
        <Button icon={Download} loading={busy} onClick={() => void install()} className="justify-self-start">
          Install
        </Button>
      ) : (
        <ol className="grid gap-1.5 text-support text-ink list-decimal pl-5">
          <li>
            Tap <Share className="inline w-4 h-4 -mt-0.5" aria-hidden="true" /> <strong>Share</strong> in Safari&apos;s toolbar
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>
          </li>
        </ol>
      )}

      <IconButton icon={X} label="Not now: hide this on this phone" onClick={dismissInstall} className="absolute top-1.5 right-1.5" />
    </section>
  );
}
