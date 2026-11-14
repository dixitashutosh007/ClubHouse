'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { disablePush } from '@/lib/firebase/push';

interface YourDataSectionProps {
  societyName?: string;
  /** Called after leaving the society or deleting the account */
  onGone: () => Promise<void>;
}

/** Leave the society (moving out) or delete your account */
export function YourDataSection({ societyName, onGone }: YourDataSectionProps) {
  const confirmId = useId();
  const [busy, setBusy] = useState<'leave' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const leave = async () => {
    setBusy('leave');
    setError('');
    const res = await apiFetch('/api/v1/account/leave', { method: 'POST' });
    setBusy(null);
    if (res.ok) await onGone();
    else setError(await apiErrorMessage(res, 'Could not leave the society.'));
  };

  const remove = async () => {
    setBusy('delete');
    setError('');
    await disablePush();
    const res = await apiFetch('/api/v1/account', { method: 'DELETE', json: { confirm: 'DELETE' } });
    setBusy(null);
    if (res.ok) {
      setDeleteOpen(false);
      await onGone();
    } else setError(await apiErrorMessage(res, 'Could not delete your account.'));
  };

  const row = 'w-full min-h-14 flex items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken disabled:opacity-60';

  return (
    <div className="grid gap-3">
      <div className="rounded-control border border-line divide-y divide-line overflow-hidden">
        <button type="button" onClick={() => setConfirmLeave(true)} disabled={busy !== null} className={row}>
          <LogOut className="w-5 h-5 text-ink-muted shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-support font-semibold text-ink">Leave {societyName ?? 'this society'}</span>
            <span className="block text-meta text-ink-muted">If you are moving out</span>
          </span>
          <ChevronRight className="w-4 h-4 text-ink-muted" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setDeleteOpen(true)} disabled={busy !== null} className={row}>
          <Trash2 className="w-5 h-5 text-danger shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-support font-semibold text-danger">Delete my account</span>
            <span className="block text-meta text-ink-muted">Erase your details from Club House for good</span>
          </span>
          <ChevronRight className="w-4 h-4 text-ink-muted" aria-hidden="true" />
        </button>
      </div>
      <p className="text-meta text-ink-muted">
        Read the{' '}
        <Link href="/privacy" className="font-semibold text-terracotta-deep underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="font-semibold text-terracotta-deep underline">
          Terms
        </Link>
        .
      </p>
      {error && (
        <p role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title={`Leave ${societyName ?? 'this society'}?`}
        description="Your upcoming rides and classes here are cancelled and neighbours are told. You can ask to join again later."
        confirmLabel="Leave society"
        cancelLabel="Stay"
        destructive
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          void leave();
        }}
      />

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setTyped('');
        }}
        title="Delete your account?"
        description="Your name, mobile, email, flat, vehicles and photo are erased, your upcoming rides and classes are cancelled, and you are signed out. This can't be undone."
      >
        <div className="grid gap-3">
          <Input id={confirmId} label="Type DELETE to confirm" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          <Button variant="danger" fullWidth loading={busy === 'delete'} disabled={typed.trim() !== 'DELETE' || busy !== null} onClick={remove}>
            {busy === 'delete' ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
