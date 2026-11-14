'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ConfirmDialog } from '@/components/ui/Dialog';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { GraduationCap, Pencil, Trash2 } from 'lucide-react';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import Link from 'next/link';
import { ClassListing, ClassType, LocationType } from '@/types';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { InterestedResidents } from '../_components/InterestedResidents';

const CLASS_TYPE_LABEL: Record<ClassType, string> = { REGULAR: 'Regular', ONE_TIME: 'One-time', FESTIVE: 'Festive' };
const LOCATION_LABEL: Record<LocationType, string> = { CLUBHOUSE: 'Club House', FLAT: 'Teacher’s flat', OTHER: 'In the society' };
const FEE_SUFFIX = { FREE: '', PER_SESSION: ' / session', PER_MONTH: ' / month', PER_COURSE: ' / course' } as const;

const ACTION_DONE: Record<string, string> = {
  MARK_FULL: 'Marked as full. Residents see the batch is full.',
  DEACTIVATE: 'Class hidden from residents.',
  REACTIVATE: 'Class is live again.',
};

const STATUS: Record<string, { text: string; status: BadgeStatus }> = {
  ACTIVE: { text: 'Live', status: 'success' },
  PENDING_APPROVAL: { text: 'Awaiting approval', status: 'warning' },
  FULL: { text: 'Batch full', status: 'info' },
  REJECTED: { text: 'Declined by admin', status: 'danger' },
  DEACTIVATED: { text: 'Hidden', status: 'neutral' },
};

function feeLabel(cls: ClassListing): string {
  if (cls.feeType === 'FREE' || !cls.feeAmount) return 'Free';
  return `₹${cls.feeAmount.toLocaleString('en-IN')}${FEE_SUFFIX[cls.feeType]}`;
}

export default function MyListingsPage() {
  const { society, activePersona } = useAuth();
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    data,
    loading,
    error: loadError,
    reload: loadMyClasses,
  } = useApiData(
    '/api/v1/lessons?mine=true',
    (json) => (json as { classes: ClassListing[] }).classes ?? [],
    'Could not load your classes.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const classes = data ?? [];

  const handleStatusAction = async (listingId: string, action: string) => {
    try {
      setUpdatingId(listingId);
      const res = await apiFetch('/api/v1/lessons', { method: 'PATCH', json: { listingId, action } });
      if (res.ok) {
        const { listing } = await res.json();
        setMessage(
          listing?.status === 'PENDING_APPROVAL'
            ? 'Sent to your society admin for review.'
            : (ACTION_DONE[action] ?? 'Class updated.')
        );
        loadMyClasses();
      } else {
        setMessage(await apiErrorMessage(res, 'Could not update the class.'));
      }
      setTimeout(() => setMessage(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (listingId: string) => {
    try {
      setUpdatingId(listingId);
      const res = await apiFetch(`/api/v1/lessons?id=${listingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage('Class deleted successfully');
        loadMyClasses();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PageContainer width="default" className="grid gap-5">
      <ModuleHeader
        module="classes"
        title="My classes"
        description="Classes you teach"
        backHref="/lessons"
        backLabel="Back to Classes"
      />

      {message && (
        <div role="status" className="p-3 rounded-control bg-success-bg text-support font-medium text-success">
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard label="Loading your classes" lines={3} />
          <SkeletonCard label="Loading your classes" lines={3} />
        </div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={loadMyClasses} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          tone="classes"
          title="You have not posted any classes yet"
          description="Share a skill with your neighbours: yoga, music, coding, tuition and more."
          action={
            <Button tone="classes" href="/lessons/create">
              Teach a class
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => {
            const isPending = cls.status === 'PENDING_APPROVAL';
            const isActive = cls.status === 'ACTIVE';
            const isFull = cls.status === 'FULL';
            const isDeactivated = cls.status === 'DEACTIVATED';
            const isRejected = cls.status === 'REJECTED';
            const look = STATUS[cls.status] ?? STATUS.DEACTIVATED;
            const busy = updatingId === cls.id;

            return (
              <li key={cls.id} className="min-w-0">
                <Card as="article" className="grid gap-3 h-full content-between">
                  <div className="grid gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 grid gap-1">
                        <Badge status={look.status} className="justify-self-start">
                          {look.text}
                        </Badge>
                        <h2 className="font-display text-card font-bold text-ink break-words">{cls.subject}</h2>
                        <p className="text-support text-ink-muted">
                          {CLASS_TYPE_LABEL[cls.classType]} · {feeLabel(cls)} · {cls.locationDetail || LOCATION_LABEL[cls.locationType]}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0 -mr-2">
                        <Link
                          href={`/lessons/edit/${encodeURIComponent(cls.id)}`}
                          aria-label={`Edit ${cls.subject} class`}
                          className="w-11 h-11 inline-flex items-center justify-center rounded-full text-ink hover:bg-sunken"
                        >
                          <Pencil className="w-5 h-5" aria-hidden="true" />
                        </Link>
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${cls.subject} class`}
                          className="text-danger"
                          disabled={busy}
                          onClick={() => setConfirmDeleteId(cls.id)}
                        />
                      </div>
                    </div>

                    <p className="text-support text-ink line-clamp-3">{cls.description}</p>

                    {isPending && <p className="text-meta text-ink-muted">Residents see this class once your society admin approves it.</p>}

                    {isRejected && cls.rejectionReason && (
                      <p className="p-3 rounded-control bg-danger-bg text-support text-ink">
                        <strong className="text-danger">Admin note:</strong> {cls.rejectionReason}
                      </p>
                    )}

                    {(isActive || isFull) && (
                      <div>
                        <InterestedResidents listing={cls} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
                    <span className="text-meta text-ink-muted mr-auto">Posted {formatIstDay(istDateOf(cls.createdAt))}</span>
                    {isActive && (
                      <>
                        <Button variant="secondary" disabled={busy} onClick={() => handleStatusAction(cls.id, 'MARK_FULL')}>
                          Mark full
                        </Button>
                        <Button variant="ghost" disabled={busy} onClick={() => handleStatusAction(cls.id, 'DEACTIVATE')}>
                          Hide
                        </Button>
                      </>
                    )}
                    {isFull && (
                      <>
                        <Button tone="classes" disabled={busy} onClick={() => handleStatusAction(cls.id, 'REACTIVATE')}>
                          Re-open batch
                        </Button>
                        <Button variant="ghost" disabled={busy} onClick={() => handleStatusAction(cls.id, 'DEACTIVATE')}>
                          Hide
                        </Button>
                      </>
                    )}
                    {isDeactivated && (
                      <Button tone="classes" disabled={busy} onClick={() => handleStatusAction(cls.id, 'REACTIVATE')}>
                        Show again
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this class?"
        description="Residents will no longer see it. This cannot be undone."
        confirmLabel="Delete class"
        destructive
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) void handleDelete(id);
        }}
      />
    </PageContainer>
  );
}
