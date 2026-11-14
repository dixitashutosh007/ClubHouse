'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';

interface EmailChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Email is contact information only and is stored as unverified */
export function EmailChangeDialog({ open, onClose, onSaved }: EmailChangeDialogProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setEmail('');
    setError('');
    onClose();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch('/api/v1/auth/me', { method: 'PUT', json: { email: email.trim().toLowerCase() } });
      if (!res.ok) {
        setError(await apiErrorMessage(res, 'Failed to update email'));
        return;
      }
      await onSaved();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Update Email Address"
      description="Used for account notices only. It is never shown to other residents."
    >
      {error && (
        <p role="alert" className="mb-3 p-3 rounded-control bg-danger-bg text-support text-danger">
          {error}
        </p>
      )}
      <form onSubmit={save} className="grid gap-3">
        <div>
          <label htmlFor="new-email" className="text-support font-semibold text-ink block mb-1.5">
            New Email Address
          </label>
          <input
            id="new-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="resident@workplace.com"
            className="w-full h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="flex-1 h-11 rounded-control border border-line-strong bg-surface text-ink text-body font-semibold hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 h-11 rounded-control bg-terracotta-deep text-ink-inverse text-body font-semibold hover:bg-terracotta-deep/90 flex items-center justify-center gap-1 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" /> : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
