'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';

/**
 * What a resident sees while their society admin reviews them: where they
 * are in the process, a way to nudge the admins, and it opens by itself
 * once they're approved.
 */
export function PendingApprovalScreen() {
  const { user, society, membership, refreshAuth, logout } = useAuth();
  const [reminder, setReminder] = useState<'idle' | 'sending' | 'sent' | 'already'>('idle');

  // Check again every minute, so the app opens as soon as an admin approves
  useEffect(() => {
    const timer = setInterval(() => void refreshAuth(), 60_000);
    return () => clearInterval(timer);
  }, [refreshAuth]);

  const remind = async () => {
    setReminder('sending');
    const res = await apiFetch('/api/v1/membership/remind', { method: 'POST' }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { alreadyReminded?: boolean }) : null;
    setReminder(data?.alreadyReminded ? 'already' : data ? 'sent' : 'idle');
  };

  const steps = [
    { label: 'Mobile number verified', done: true },
    { label: 'Your details sent', done: true, hint: membership?.flatNumber ? `Flat ${membership.flatNumber}` : undefined },
    { label: 'Society admin approval', done: false, hint: 'Usually within a day' },
  ];

  return (
    <div className="flex-1 flex flex-col p-5 gap-4 bg-slate-50">
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">Almost there, {user?.fullName.split(' ')[0]}</h1>
            <p className="text-xs text-slate-700">
              An admin of <span className="font-semibold">{society?.name ?? 'your society'}</span> is checking that you live
              here.
            </p>
          </div>
        </div>

        <ol className="space-y-3" aria-label="Your registration">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  s.done ? 'bg-emerald-600 text-white' : 'border-2 border-amber-500 bg-white'
                }`}
              >
                {s.done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : null}
              </span>
              <span>
                <span className={`block text-sm ${s.done ? 'text-slate-900' : 'font-bold text-slate-900'}`}>
                  {s.label}
                  <span className="sr-only">{s.done ? ' (done)' : ' (waiting)'}</span>
                </span>
                {s.hint && <span className="block text-xs text-slate-600">{s.hint}</span>}
              </span>
            </li>
          ))}
        </ol>

        <p className="text-xs text-slate-700">
          RideShare and Classes open automatically once you&apos;re approved. You can keep this screen open.
        </p>

        <button
          type="button"
          onClick={remind}
          disabled={reminder !== 'idle'}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60"
        >
          {reminder === 'sending' ? 'Sending…' : reminder === 'idle' ? 'Remind my society admin' : 'Admin reminded'}
        </button>
        {reminder !== 'idle' && reminder !== 'sending' && (
          <p role="status" className="text-xs text-emerald-800 text-center">
            {reminder === 'sent' ? 'We let your admins know.' : 'Your admins were already reminded today.'}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="mx-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 underline"
      >
        <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}
