import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

/** The stages of joining Club House, shown on every onboarding screen */
export const ONBOARDING_STEPS = ['Phone', 'Verify', 'Society', 'Details', 'Approval'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Where a new resident is in joining: done steps are ticked, the current
 * one is marked for screen readers with aria-current="step".
 */
export function OnboardingProgress({ current, className }: { current: OnboardingStep; className?: string }) {
  const at = ONBOARDING_STEPS.indexOf(current);
  return (
    <nav aria-label="Joining progress" className={className}>
      <p className="sr-only">
        Step {at + 1} of {ONBOARDING_STEPS.length}: {current}
      </p>
      <ol className="flex items-center gap-1" aria-hidden="false">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = i < at;
          const here = i === at;
          return (
            <li key={step} aria-current={here ? 'step' : undefined} className="flex-1 min-w-0 grid gap-1.5">
              <span className={cn('h-1.5 rounded-full', done || here ? 'bg-terracotta-deep' : 'bg-line')} />
              <span
                className={cn(
                  'flex items-center gap-1 text-tag truncate',
                  here ? 'font-bold text-ink' : done ? 'font-semibold text-ink-muted' : 'text-ink-muted'
                )}
              >
                {done && <Check className="w-3 h-3 shrink-0 text-success" aria-hidden="true" />}
                <span className={cn('truncate', !here && 'hidden sm:inline')}>{step}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
