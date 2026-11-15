'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CircleDot, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import type { CircleView } from '@/lib/services/circles';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { SectionHeading } from '@/components/ui/Layout';
import { LoadError } from '@/components/ui/LoadState';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { circleAudienceLabel, circleStatusLabel, circleTypeLabel, memberCountLabel } from '@/app/circles/_components/circle-format';
import type { Notify } from './types';

type Decision = { circle: CircleView; action: 'REJECT' | 'REJECT_CHANGE' };

/** Society admins approve new circles and changes, and see every circle */
export function CirclesTab({ notify, onChanged }: { notify: Notify; onChanged?: () => void }) {
  const { activePersona, society } = useAuth();
  const { data, loading, error, reload } = useApiData(
    '/api/v1/circles?view=all',
    (json) => (json as { circles?: CircleView[] }).circles ?? [],
    'Could not load circles.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');

  const circles = data ?? [];
  const pending = circles.filter((c) => c.status === 'PENDING_APPROVAL');
  const changes = circles.filter((c) => c.status === 'ACTIVE' && c.pendingChange);
  const needOwner = circles.filter((c) => c.status === 'ACTIVE' && c.hasNoOwner);

  const act = async (circle: CircleView, action: 'APPROVE' | 'REJECT' | 'APPROVE_CHANGE' | 'REJECT_CHANGE', why?: string) => {
    setBusyId(circle.id);
    try {
      const res = await apiFetch('/api/v1/circles', { method: 'PATCH', json: { circleId: circle.id, action, reason: why || undefined } });
      if (!res.ok) return notify(await apiErrorMessage(res, 'Could not update the circle.'), 'error');
      notify(
        {
          APPROVE: `${circle.name} is live`,
          REJECT: `${circle.name} was declined`,
          APPROVE_CHANGE: 'Change approved and live',
          REJECT_CHANGE: 'Change declined; the circle stays as it was',
        }[action]
      );
      reload();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SkeletonCard label="Loading circles" lines={3} />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const field = (label: string, before: string | undefined, after: string | undefined) =>
    (before ?? '') === (after ?? '') ? null : (
      <div key={label} className="grid gap-1 min-w-0">
        <dt className="text-tag font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
        <dd className="grid sm:grid-cols-2 gap-2 text-support">
          <span className="p-2 rounded-control bg-sunken text-ink-muted break-words">
            <span className="sr-only">Now: </span>
            <del>{before || '(none)'}</del>
          </span>
          <span className="p-2 rounded-control bg-community-tint text-ink break-words">
            <span className="sr-only">Requested: </span>
            <ins className="no-underline">{after || '(none)'}</ins>
          </span>
        </dd>
      </div>
    );

  return (
    <div className="grid gap-6">
      <section aria-labelledby="circle-approvals" className="grid gap-3">
        <SectionHeading
          id="circle-approvals"
          title={`Waiting for approval (${pending.length + changes.length})`}
          description="Any society admin can approve circles and changes."
        />
        {pending.length + changes.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            tone="community"
            title="Nothing waiting"
            description="New circles and changes to names, descriptions or links appear here."
          />
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {pending.map((c) => (
              <li key={c.id} className="min-w-0">
                <Card as="article" className="grid gap-3 h-full content-between">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge status="warning">New circle</Badge>
                      <Badge tone="community">{circleTypeLabel(c)}</Badge>
                      <Badge>{circleAudienceLabel(c)}</Badge>
                    </div>
                    <h3 className="font-display text-card font-bold text-ink break-words">{c.name}</h3>
                    <p className="p-3 rounded-control bg-sunken text-support text-ink whitespace-pre-line">{c.description}</p>
                    <p className="text-meta text-ink-muted">
                      {[
                        c.place,
                        c.schedule,
                        c.joinMode === 'OPEN' ? 'Open to join' : 'Approval needed',
                        c.whatsappLink ? 'Has a WhatsApp link' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button tone="community" icon={Check} loading={busyId === c.id} onClick={() => void act(c, 'APPROVE')}>
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      icon={X}
                      disabled={busyId === c.id}
                      onClick={() => (setReason(''), setDeclining({ circle: c, action: 'REJECT' }))}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
            {changes.map((c) => (
              <li key={`${c.id}-change`} className="min-w-0">
                <Card as="article" className="grid gap-3 h-full content-between">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge status="warning">Change to a live circle</Badge>
                      <Badge tone="community">{circleTypeLabel(c)}</Badge>
                    </div>
                    <h3 className="font-display text-card font-bold text-ink break-words">
                      <Link href={`/circles/${c.id}`} className="underline underline-offset-2">
                        {c.name}
                      </Link>
                    </h3>
                    <p className="text-meta text-ink-muted">Members keep seeing the current version until you approve.</p>
                    <dl className="grid gap-2">
                      {field('Name', c.name, c.pendingChange!.name)}
                      {field('Description', c.description, c.pendingChange!.description)}
                      {field('WhatsApp link', c.whatsappLink, c.pendingChange!.whatsappLink)}
                      {field('Other link', c.otherLink, c.pendingChange!.otherLink)}
                    </dl>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button tone="community" icon={Check} loading={busyId === c.id} onClick={() => void act(c, 'APPROVE_CHANGE')}>
                      Approve change
                    </Button>
                    <Button
                      variant="secondary"
                      icon={X}
                      disabled={busyId === c.id}
                      onClick={() => (setReason(''), setDeclining({ circle: c, action: 'REJECT_CHANGE' }))}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {needOwner.length > 0 && (
        <section aria-labelledby="circle-owners" className="grid gap-3">
          <SectionHeading
            id="circle-owners"
            title="Circles without an owner"
            description="Their owner left the society. Open one and make a member the owner."
          />
          <ul className="grid gap-2">
            {needOwner.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/circles/${c.id}`}
                  className="min-h-11 px-4 py-3 rounded-control border border-warning bg-warning-bg text-support font-semibold text-ink flex items-center justify-between gap-2"
                >
                  {c.name} <span className="text-meta text-ink-muted">{memberCountLabel(c.memberCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="circle-all" className="grid gap-3">
        <SectionHeading
          id="circle-all"
          title={`All circles (${circles.length})`}
          description="Open a circle to manage members, edit it or close it."
        />
        {circles.length === 0 ? (
          <p className="text-support text-ink-muted">No circles yet.</p>
        ) : (
          <ul className="grid gap-2 xl:grid-cols-2">
            {circles.map((c) => {
              const status = circleStatusLabel(c.status);
              return (
                <li key={c.id} className="min-w-0">
                  <Link
                    href={`/circles/${c.id}`}
                    className="min-h-11 p-3 rounded-control border border-line bg-surface hover:bg-sunken grid gap-1"
                  >
                    <span className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-support font-semibold text-ink truncate">{c.name}</span>
                      {status ? (
                        <Badge status={c.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'}>{status}</Badge>
                      ) : (
                        <Badge status="success">Live</Badge>
                      )}
                    </span>
                    <span className="text-meta text-ink-muted">
                      {circleTypeLabel(c)} · {memberCountLabel(c.memberCount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={declining !== null}
        onClose={() => setDeclining(null)}
        title={declining?.action === 'REJECT' ? `Decline ${declining.circle.name}?` : 'Decline this change?'}
        description={
          declining?.action === 'REJECT'
            ? 'The resident is told, with your reason.'
            : 'The circle stays as it is, and the resident is told.'
        }
      >
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const d = declining;
            setDeclining(null);
            if (d) void act(d.circle, d.action, reason.trim());
          }}
        >
          <Textarea label="Reason (optional)" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="flex-1">
              Decline
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
