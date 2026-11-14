'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';

/** The four clauses every resident accepts before joining (wording is fixed; do not edit without approval) */
export const AGREEMENT_CLAUSES = [
  {
    title: 'Clause 1: Non-Commercial Peer Matchmaking Only',
    body: 'I acknowledge that Club House is strictly a neighbor directory and peer-match tool. It is NOT a taxi, transport service, or commercial vehicle carrier.',
  },
  {
    title: 'Clause 2: Voluntary Usage & Absolute Discretion',
    body: 'I understand that if I do not trust this app, its data, or fellow residents, I must not use this app. My participation is 100% voluntary and at my own sole risk.',
  },
  {
    title: 'Clause 3: Zero Developer / Owner Support Obligation',
    body: 'I acknowledge and accept that the app developer, creator, and owner have NO obligation to answer my questions, investigate complaints, resolve road disputes, or provide technical guarantees.',
  },
  {
    title: 'Clause 4: Punctuality & Society Code of Conduct',
    body: 'I agree to abide by all resident society bylaws, maintain civil behavior with co-residents, and give advance notice for cancellations.',
  },
] as const;

interface AgreementDialogProps {
  open: boolean;
  /** Whether each clause is ticked, in AGREEMENT_CLAUSES order */
  values: boolean[];
  onToggle: (index: number, checked: boolean) => void;
  onClose: () => void;
  /** Called when all four are ticked and the resident confirms */
  onConfirm: () => void;
  societyName?: string;
  communityRules?: string;
}

/** The joining agreement: all four clauses must be ticked to continue */
export function AgreementDialog({ open, values, onToggle, onClose, onConfirm, societyName, communityRules }: AgreementDialogProps) {
  if (!open) return null;
  const allAccepted = AGREEMENT_CLAUSES.every((_, i) => values[i]);
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-ink/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className="w-full sm:max-w-lg bg-surface rounded-t-sheet sm:rounded-sheet p-5 shadow-overlay border border-line flex flex-col max-h-[92dvh] overflow-hidden"
      >
        <div className="pb-3 border-b border-line">
          <h3 id="legal-title" className="font-display text-card font-bold text-ink">
            Agreement and community rules
          </h3>
          <p className="text-meta text-ink-muted">
            Please read the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-terracotta-deep underline">
              Terms
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-terracotta-deep underline">
              Privacy Policy
            </a>
          </p>
        </div>

        <div className="overflow-y-auto py-3 grid gap-3 flex-1 pr-1">
          <div className="p-3 rounded-control bg-danger-bg text-ink grid gap-1">
            <p className="text-support font-bold text-danger">Critical notice: trust and developer obligation</p>
            <p className="text-support">
              If you do not trust this App or fellow residents, please DO NOT use this App. The app developer and platform owner have ZERO obligation to
              provide responses, customer service, or mediation to your queries or disputes.
            </p>
          </div>

          {communityRules && (
            <div className="p-3 rounded-control bg-sunken">
              <p className="text-support font-semibold text-ink mb-1">{societyName ? `${societyName} community carpool rules` : 'Community rules'}</p>
              <p className="text-support text-ink-muted whitespace-pre-line">{communityRules}</p>
            </div>
          )}

          {AGREEMENT_CLAUSES.map((c, i) => (
            <Checkbox
              key={c.title}
              label={c.title}
              description={c.body}
              checked={Boolean(values[i])}
              onChange={(e) => onToggle(i, e.target.checked)}
              className="p-3 rounded-control border border-line bg-surface hover:bg-sunken"
            />
          ))}
        </div>

        <div className="pt-3 border-t border-line flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1" icon={CheckCircle2} disabled={!allAccepted} onClick={() => allAccepted && onConfirm()}>
            {allAccepted ? 'Agree to all 4 clauses' : 'Tick all 4 to continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
