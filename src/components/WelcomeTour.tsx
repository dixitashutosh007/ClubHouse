'use client';

import { useState } from 'react';
import { Bell, Car, GraduationCap, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useIsClient } from '@/hooks/useIsClient';
import { APP_NAME } from '@/lib/brand';

const SEEN_KEY = 'clubhouse_tour_seen';

const STEPS: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  {
    icon: Car,
    title: 'Share your commute',
    body: 'Offer the empty seats in your car, or ride with a neighbour going your way. No fares; fuel is shared between you.',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  {
    icon: GraduationCap,
    title: 'Learn from neighbours',
    body: 'Yoga, music, tuition and more, taught in the society. Tap "I’m interested" and the teacher gets in touch.',
    tone: 'bg-violet-100 text-violet-800',
  },
  {
    icon: Bell,
    title: 'Stay in the loop',
    body: 'Ride updates and society notices arrive in the bell at the top. Turn on alerts there to get them on your phone.',
    tone: 'bg-amber-100 text-amber-800',
  },
];

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // no storage (private mode): don't show it every time
  }
}

/** A short welcome, shown once on this device after a resident is approved */
export function WelcomeTour() {
  const isClient = useIsClient();
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState(0);
  if (!isClient || closed || hasSeen()) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setClosed(true);
  };
  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <Dialog open onClose={finish} title={`Welcome to ${APP_NAME}`} description={`${step + 1} of ${STEPS.length}`}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${current.tone}`}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
            <p className="text-sm text-slate-700 mt-0.5">{current.body}</p>
          </div>
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-emerald-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={finish} className="h-11 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800">
            Skip
          </button>
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="h-11 rounded-xl bg-slate-900 text-white text-sm font-bold"
          >
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
