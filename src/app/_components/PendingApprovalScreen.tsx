'use client';

import { useEffect, useState } from 'react';
import { Bell, Car, Check, Clock, GraduationCap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OnboardingProgress } from '@/components/ui/OnboardingProgress';
import { cn } from '@/components/ui/cn';
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
    <div className="flex-1 w-full max-w-xl mx-auto flex flex-col gap-5 px-4 sm:px-6 py-8 bg-ivory">
      <OnboardingProgress current="Approval" />

      <section aria-labelledby="pending-title" className="p-5 sm:p-6 rounded-sheet bg-surface border border-line shadow-raised grid gap-5">
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-card bg-warning-bg text-warning flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="grid gap-1">
            <h1 id="pending-title" className="font-display text-section font-bold text-ink">
              Almost there, {user?.fullName.split(' ')[0]}
            </h1>
            <p className="text-support text-ink-muted">
              An admin of <span className="font-semibold text-ink">{society?.name ?? 'your society'}</span> is checking that you live here.
            </p>
          </div>
        </div>

        <ol className="grid gap-3" aria-label="Your registration">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                  s.done ? 'bg-success text-ink-inverse' : 'border-2 border-warning bg-warning-bg'
                )}
              >
                {s.done ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
              </span>
              <span>
                <span className={cn('block text-body text-ink', !s.done && 'font-bold')}>
                  {s.label}
                  <span className="sr-only">{s.done ? ' (done)' : ' (waiting)'}</span>
                </span>
                {s.hint && <span className="block text-meta text-ink-muted">{s.hint}</span>}
              </span>
            </li>
          ))}
        </ol>

        <div className="grid gap-2 p-4 rounded-card bg-sunken">
          <p className="text-support font-semibold text-ink">What happens next</p>
          <ul className="grid gap-2 text-support text-ink">
            <li className="flex items-start gap-2">
              <Bell className="w-4 h-4 mt-0.5 text-terracotta-deep shrink-0" aria-hidden="true" />
              This screen opens the apps by itself once you are approved. You can keep it open.
            </li>
            <li className="flex items-start gap-2">
              <Car className="w-4 h-4 mt-0.5 text-ride-deep shrink-0" aria-hidden="true" />
              Then you can find or offer rides with neighbours.
            </li>
            <li className="flex items-start gap-2">
              <GraduationCap className="w-4 h-4 mt-0.5 text-classes-deep shrink-0" aria-hidden="true" />
              And join or teach classes in the society.
            </li>
          </ul>
        </div>

        <div className="grid gap-2">
          <Button size="lg" fullWidth onClick={remind} loading={reminder === 'sending'} disabled={reminder !== 'idle'}>
            {reminder === 'sending' ? 'Sending…' : reminder === 'idle' ? 'Remind my society admin' : 'Admin reminded'}
          </Button>
          {reminder !== 'idle' && reminder !== 'sending' && (
            <p role="status" className="text-support text-success text-center">
              {reminder === 'sent' ? 'We let your admins know.' : 'Your admins were already reminded today.'}
            </p>
          )}
        </div>
      </section>

      <Button variant="ghost" icon={LogOut} className="mx-auto" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
