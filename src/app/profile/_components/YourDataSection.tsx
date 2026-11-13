'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { LogOut, Trash2 } from 'lucide-react';
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

  const row = 'w-full flex items-center gap-3 p-3.5 text-left text-sm hover:bg-slate-50 disabled:opacity-60';

  return (
    <section aria-labelledby="your-data" className="mt-6">
      <h2 id="your-data" className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
        Your data
      </h2>
      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <button type="button" onClick={() => setConfirmLeave(true)} disabled={busy !== null} className={row}>
          <LogOut className="w-4 h-4 text-slate-700" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-slate-900">Leave {societyName ?? 'this society'}</span>
            <span className="block text-xs text-slate-600">If you are moving out</span>
          </span>
        </button>
        <button type="button" onClick={() => setDeleteOpen(true)} disabled={busy !== null} className={row}>
          <Trash2 className="w-4 h-4 text-rose-700" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-rose-700">Delete my account</span>
            <span className="block text-xs text-slate-600">Erase your details from Club House for good</span>
          </span>
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-slate-600">
        Read the{' '}
        <Link href="/privacy" className="font-semibold text-emerald-800 underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="font-semibold text-emerald-800 underline">
          Terms
        </Link>
        .
      </p>
      {error && (
        <p role="alert" className="mt-2 px-1 text-sm text-rose-700">
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
        <div className="space-y-3">
          <div>
            <label htmlFor={confirmId} className="text-xs font-semibold text-slate-800 block mb-1">
              Type DELETE to confirm
            </label>
            <input
              id={confirmId}
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-600"
            />
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={typed.trim() !== 'DELETE' || busy !== null}
            className="w-full py-2.5 rounded-xl bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
