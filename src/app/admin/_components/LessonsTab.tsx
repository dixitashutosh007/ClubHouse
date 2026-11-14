'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Check, GraduationCap, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SectionHeading } from '@/components/ui/Layout';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { apiFetch } from '@/lib/api-client';
import { Notify } from './types';
import { ClassListing } from '@/types';
import { classDaysLabel, classFeeLabel, classLocationLabel, classTimeLabel } from '@/lib/class-format';

interface LessonsTabProps {
  notify: Notify;
}

export function LessonsTab({ notify }: LessonsTabProps) {
  const [pendingClasses, setPendingClasses] = useState<ClassListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ClassListing | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/lessons?pending=true');
      if (res.ok) setPendingClasses((await res.json()).classes ?? []);
      else notify('Could not load pending classes', 'error');
    } catch {
      notify('Could not load pending classes', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadPending();
    });
    return () => {
      cancelled = true;
    };
  }, [loadPending]);

  const handleAction = async (listingId: string, action: 'APPROVE' | 'REJECT') => {
    setActioningId(listingId);
    try {
      const res = await apiFetch('/api/v1/lessons', {
        method: 'PATCH',
        json: {
          listingId,
          action,
          reason: action === 'REJECT' ? 'Declined by society admin' : undefined,
        },
      });
      if (res.ok) {
        notify(action === 'APPROVE' ? 'Class approved and published.' : 'Class listing declined.');
        await loadPending();
      } else {
        const data = await res.json().catch(() => null);
        notify(data?.error ?? 'Action failed', 'error');
      }
    } catch {
      notify('Action failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const TYPE: Record<string, string> = { REGULAR: 'Regular', ONE_TIME: 'One-time', FESTIVE: 'Festive' };

  return (
    <section aria-labelledby="class-approvals" className="grid gap-3">
      <SectionHeading id="class-approvals" title={`Waiting for approval${loading ? '' : ` (${pendingClasses.length})`}`} />
      {loading ? (
        <SkeletonCard label="Loading classes waiting for approval" lines={3} />
      ) : pendingClasses.length === 0 ? (
        <EmptyState icon={GraduationCap} tone="classes" title="No classes waiting" description="New classes from residents appear here for approval." />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {pendingClasses.map((cls) => (
            <li key={cls.id} className="min-w-0">
              <Card as="article" className="grid gap-3 h-full content-between">
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 grid gap-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge status="warning">Awaiting approval</Badge>
                        <Badge tone="classes">{TYPE[cls.classType] ?? cls.classType}</Badge>
                        {cls.trialAvailable && <Badge status="success">Free trial</Badge>}
                      </div>
                      <h3 className="font-display text-card font-bold text-ink break-words">{cls.subject}</h3>
                      <p className="text-support text-ink-muted">
                        <span className="font-semibold text-ink">{cls.contactName}</span>
                        {cls.creatorFlat ? ` · Flat ${cls.creatorFlat}` : ''} · {cls.contactPhone}
                      </p>
                    </div>
                    <span className="shrink-0 text-support font-bold text-classes-deep">{classFeeLabel(cls)}</span>
                  </div>
                  <p className="p-3 rounded-control bg-sunken text-support text-ink whitespace-pre-line">{cls.description}</p>
                  <dl className="grid grid-cols-3 gap-2 text-meta">
                    {[
                      ['Where', classLocationLabel(cls)],
                      ['When', classDaysLabel(cls)],
                      ['Time', classTimeLabel(cls)],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="font-semibold text-ink truncate">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {cls.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise
                    <img src={cls.photoUrl} alt={cls.subject} className="max-h-40 rounded-control border border-line object-cover" />
                  )}
                </div>
                <div className="pt-3 border-t border-line flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" icon={X} className="text-danger" disabled={actioningId === cls.id} onClick={() => setRejecting(cls)}>
                    Reject
                  </Button>
                  <Button tone="classes" icon={Check} loading={actioningId === cls.id} onClick={() => handleAction(cls.id, 'APPROVE')}>
                    Approve
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={rejecting !== null}
        title="Reject this class?"
        description={rejecting ? `${rejecting.contactName} is told their ${rejecting.subject} class was declined.` : ''}
        confirmLabel="Reject class"
        cancelLabel="Keep"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={() => {
          const cls = rejecting;
          setRejecting(null);
          if (cls) void handleAction(cls.id, 'REJECT');
        }}
      />
    </section>
  );
}
