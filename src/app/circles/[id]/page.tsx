'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  CircleDot,
  Crown,
  ExternalLink,
  Flag,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Phone,
  ShieldCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstDateTime } from '@/lib/utils/time';
import type { CircleView } from '@/lib/services/circles';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { PageContainer, SectionHeading } from '@/components/ui/Layout';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { unreadLabel, useCircleUnread } from '@/hooks/useCircleUnread';
import { circleAudienceLabel, circleTypeLabel, isStillAhead, memberCountLabel, viewerStatusLabel } from '../_components/circle-format';

interface MemberRow {
  userId: string;
  name: string;
  role: 'OWNER' | 'CO_ADMIN' | 'MEMBER';
  status: string;
  requestedAt: string;
}

type MemberAction = 'APPROVE' | 'REJECT' | 'REMOVE' | 'MAKE_CO_ADMIN' | 'REMOVE_CO_ADMIN' | 'TRANSFER_OWNERSHIP';

export default function CirclePage() {
  return (
    <Suspense fallback={<Loading label="Loading the circle…" />}>
      <CircleDetail />
    </Suspense>
  );
}

function CircleDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { activePersona, society, membership } = useAuth();
  const isSocietyAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
  const cacheKey = `${activePersona}:${society?.id ?? ''}`;
  const {
    data: circle,
    loading,
    error,
    reload,
  } = useApiData(
    `/api/v1/circles?id=${encodeURIComponent(id)}`,
    (json) => (json as { circle?: CircleView }).circle ?? null,
    'Could not load the circle.',
    cacheKey
  );
  const canManage = Boolean(circle?.viewer.canManage && circle.status !== 'CLOSED');
  const roster = useApiData(
    canManage ? `/api/v1/circles/members?circleId=${encodeURIComponent(id)}` : null,
    (json) => json as { requests: MemberRow[]; members: MemberRow[] },
    'Could not load requests and members.',
    cacheKey
  );

  const isClient = useIsClient();
  const { unread } = useCircleUnread();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    label: string;
    destructive?: boolean;
    run: () => Promise<void>;
  }>(null);
  const [rejecting, setRejecting] = useState<MemberRow | null>(null);
  const [note, setNote] = useState('');

  const refresh = () => {
    reload();
    if (canManage) roster.reload();
  };

  /** Runs one request and shows the outcome */
  const send = async (path: string, init: Parameters<typeof apiFetch>[1], ok: string, fail: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(path, init);
      if (!res.ok) {
        toast.show(await apiErrorMessage(res, fail), 'error');
        return false;
      }
      toast.show(ok, 'success');
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Loading the circle…" />;
  if (!circle) {
    if (error && !error.toLowerCase().includes('not found')) return <LoadError message={error} onRetry={reload} />;
    return (
      <PageContainer width="narrow" className="grid gap-5">
        <ModuleHeader module="community" title="Circle" backHref="/circles" backLabel="Back to Circles" />
        <EmptyState
          icon={CircleDot}
          tone="community"
          title="Circle not found"
          description="It may have been closed, or it isn't open to you yet."
          action={
            <Button tone="community" href="/circles">
              Back to Circles
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const v = circle.viewer;
  const isMember = v.status === 'APPROVED';
  const canSeePrivate = isMember;
  const canEditCoAdmins = v.isOwner || isSocietyAdmin;
  const waitUntil = isClient && isStillAhead(v.canRequestAfter) ? v.canRequestAfter! : null;
  const mine = viewerStatusLabel(circle);

  const join = () =>
    send(
      '/api/v1/circles/members',
      { method: 'POST', json: { circleId: circle.id } },
      circle.joinMode === 'OPEN' ? `You joined ${circle.name}` : 'Request sent to the circle admins',
      'Could not send your request.'
    );
  const leave = (withdraw: boolean) =>
    setConfirm({
      title: withdraw ? 'Withdraw your request?' : `Leave ${circle.name}?`,
      description: withdraw ? 'You can ask again later.' : 'You lose access to the group link and member list. You can ask to join again.',
      label: withdraw ? 'Withdraw' : 'Leave',
      destructive: true,
      run: async () => {
        await send(
          `/api/v1/circles/members?circleId=${encodeURIComponent(circle.id)}`,
          { method: 'DELETE' },
          withdraw ? 'Request withdrawn' : `You left ${circle.name}`,
          'Could not update your membership.'
        );
      },
    });
  const memberAction = (row: MemberRow, action: MemberAction, ok: string, noteText?: string) =>
    send(
      '/api/v1/circles/members',
      { method: 'PATCH', json: { circleId: circle.id, userId: row.userId, action, note: noteText || undefined } },
      ok,
      'Could not update the member.'
    );
  const closeCircle = () =>
    setConfirm({
      title: `Close ${circle.name}?`,
      description: 'Members are told, and the circle no longer shows to anyone. This cannot be undone.',
      label: 'Close circle',
      destructive: true,
      run: async () => {
        if (
          await send(
            '/api/v1/circles',
            { method: 'PATCH', json: { circleId: circle.id, action: 'CLOSE' } },
            'Circle closed',
            'Could not close the circle.'
          )
        ) {
          router.push('/circles/mine');
        }
      },
    });

  const facts: [typeof Users, string][] = [
    [Users, `${memberCountLabel(circle.memberCount)} · ${circleAudienceLabel(circle)}`],
    ...(circle.place ? ([[MapPin, circle.place]] as [typeof Users, string][]) : []),
    ...(circle.schedule ? ([[CalendarDays, circle.schedule]] as [typeof Users, string][]) : []),
  ];

  return (
    <PageContainer width="default" className="grid gap-5">
      <ModuleHeader
        module="community"
        title={circle.name}
        description={circleTypeLabel(circle)}
        backHref="/circles"
        backLabel="Back to Circles"
      />

      {circle.status === 'PENDING_APPROVAL' && (
        <p role="status" className="p-3 rounded-control bg-warning-bg text-warning text-support">
          This circle is waiting for your society admin. Only you and the admins can see it for now.
        </p>
      )}
      {circle.status === 'REJECTED' && (
        <p role="status" className="p-3 rounded-control bg-danger-bg text-danger text-support">
          Your society admin did not approve this circle.{circle.rejectionReason ? ` Reason: ${circle.rejectionReason}` : ''}
        </p>
      )}
      {circle.status === 'CLOSED' && (
        <p role="status" className="p-3 rounded-control bg-sunken text-ink text-support">
          {circle.archived
            ? 'This circle closed more than 60 days ago and is archived. Only society admins can still see it.'
            : 'This circle has been closed. Members can still read its messages until it is archived 60 days after closing.'}
        </p>
      )}
      {circle.hasNoOwner && circle.status !== 'CLOSED' && (
        <p role="status" className="p-3 rounded-control bg-warning-bg text-warning text-support">
          The owner has left the society. A society admin can make a member the new owner below.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="grid gap-5 min-w-0">
          <Card padding="none" className="overflow-hidden">
            {circle.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs
              <img src={circle.photoUrl} alt={circle.name} className="w-full max-h-64 object-cover border-b border-line" />
            )}
            <div className="p-4 sm:p-5 grid gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="community">{circleTypeLabel(circle)}</Badge>
                <Badge>{circle.joinMode === 'OPEN' ? 'Open to join' : 'Approval needed'}</Badge>
                {mine && <Badge status={v.status === 'REJECTED' ? 'danger' : v.status === 'REQUESTED' ? 'info' : 'success'}>{mine}</Badge>}
              </div>
              <p className="text-body text-ink whitespace-pre-line">{circle.description}</p>
              <ul className="grid gap-1.5 text-support text-ink-muted">
                {facts.map(([Icon, text]) => (
                  <li key={text} className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="break-words">{text}</span>
                  </li>
                ))}
              </ul>

              {/* What the viewer can do: join, or leave (the owner hands over first). Society
                  admins can join too; managing a circle does not make them a member. */}
              {circle.status === 'ACTIVE' && !v.isOwner && (
                <div className="pt-3 border-t border-line grid gap-2">
                  {v.status === 'NONE' && (
                    <Button tone="community" fullWidth icon={Heart} loading={busy} onClick={join}>
                      {circle.joinMode === 'OPEN' ? 'Join circle' : "I'm interested"}
                    </Button>
                  )}
                  {v.status === 'REQUESTED' && (
                    <>
                      <p role="status" className="text-support text-ink">
                        Your request is with the circle admins. You will be told when they answer.
                      </p>
                      <Button variant="secondary" fullWidth loading={busy} onClick={() => leave(true)}>
                        Withdraw request
                      </Button>
                    </>
                  )}
                  {v.status === 'REJECTED' && (
                    <>
                      <p role="status" className="text-support text-ink">
                        The circle admins did not approve your request.{v.rejectionNote ? ` Note: “${v.rejectionNote}”` : ''}
                      </p>
                      {waitUntil ? (
                        <p className="text-meta text-ink-muted">You can ask again after {formatIstDateTime(waitUntil)}.</p>
                      ) : (
                        <Button tone="community" variant="tonal" fullWidth loading={busy} onClick={join}>
                          Ask again
                        </Button>
                      )}
                    </>
                  )}
                  {isMember && (
                    <Button variant="ghost" fullWidth icon={LogOut} loading={busy} onClick={() => leave(false)}>
                      Leave circle
                    </Button>
                  )}
                  {v.status === 'NONE' && (
                    <p className="text-meta text-ink-muted">Member names, contacts and the group link show once you are in.</p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {canSeePrivate && circle.members && (
            <Card padding="md" className="grid gap-4">
              <SectionHeading title="For members" />
              {isMember && (
                <Button tone="community" fullWidth icon={MessagesSquare} href={`/circles/${circle.id}/messages`}>
                  {unread[circle.id] ? `Messages · ${unreadLabel(unread[circle.id])}` : 'Messages'}
                </Button>
              )}
              {(circle.whatsappLink || circle.otherLink) && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {circle.whatsappLink && (
                    <a
                      href={circle.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 px-4 rounded-control bg-success text-ink-inverse text-support font-semibold inline-flex items-center justify-center gap-2 hover:bg-success/90"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" /> Open WhatsApp group
                    </a>
                  )}
                  {circle.otherLink && (
                    <a
                      href={circle.otherLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 px-4 rounded-control border border-line-strong bg-surface text-ink text-support font-semibold inline-flex items-center justify-center gap-2 hover:bg-sunken"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" /> Open link
                    </a>
                  )}
                </div>
              )}
              {circle.admins && circle.admins.length > 0 && (
                <div className="grid gap-2">
                  <h3 className="text-support font-semibold text-ink">Run by</h3>
                  <ul className="grid gap-2">
                    {circle.admins.map((a) => (
                      <li key={a.userId} className="flex items-center gap-3 p-3 rounded-control bg-community-tint min-w-0">
                        {a.role === 'OWNER' ? (
                          <Crown className="w-4 h-4 text-community-deep shrink-0" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-community-deep shrink-0" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-support font-semibold text-ink truncate">{a.name}</span>
                          <span className="block text-meta text-ink-muted">{a.role === 'OWNER' ? 'Owner' : 'Co-admin'}</span>
                        </span>
                        {a.phone && (
                          <a
                            href={`tel:${a.phone.replace(/[^\d+]/g, '')}`}
                            aria-label={`Call ${a.name}`}
                            className="min-h-11 px-3 rounded-control border border-line-strong bg-surface text-ink text-support font-semibold inline-flex items-center gap-1.5 hover:bg-sunken"
                          >
                            <Phone className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">{a.phone}</span>
                            <span className="sm:hidden">Call</span>
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-2">
                <h3 className="text-support font-semibold text-ink">Members ({circle.members.length})</h3>
                <ul className="flex flex-wrap gap-2">
                  {circle.members.map((m) => (
                    <li key={m.userId} className="px-3 py-1.5 rounded-full bg-sunken text-support text-ink">
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {!v.canManage && circle.status === 'ACTIVE' && (
            <Link
              href={`/report?circleId=${encodeURIComponent(circle.id)}&name=${encodeURIComponent(`the circle “${circle.name}”`)}`}
              className="justify-self-start min-h-11 inline-flex items-center gap-1.5 text-support font-semibold text-danger underline underline-offset-2"
            >
              <Flag className="w-4 h-4" aria-hidden="true" /> Report this circle
            </Link>
          )}
        </div>

        {canManage && (
          <aside aria-label="Manage the circle" className="grid gap-4 min-w-0">
            <Card padding="md" className="grid gap-3">
              <SectionHeading title="Manage" level={2} />
              {circle.pendingChange && (
                <div className="p-3 rounded-control bg-warning-bg text-support text-warning grid gap-1">
                  <p className="font-semibold">A change is waiting for your society admin</p>
                  <p>New name: {circle.pendingChange.name}</p>
                </div>
              )}
              {circle.status !== 'REJECTED' && (
                <Button variant="tonal" tone="community" fullWidth icon={Pencil} href={`/circles/edit/${circle.id}`}>
                  Edit circle
                </Button>
              )}
              {(v.isOwner || isSocietyAdmin) && (
                <Button variant="ghost" fullWidth icon={X} onClick={closeCircle}>
                  Close circle
                </Button>
              )}
            </Card>

            {circle.status === 'ACTIVE' && (
              <Card padding="md" className="grid gap-3">
                <SectionHeading title={`Requests (${roster.data?.requests.length ?? 0})`} level={2} />
                {roster.loading ? (
                  <p className="text-support text-ink-muted">Loading…</p>
                ) : roster.error ? (
                  <LoadError message={roster.error} onRetry={roster.reload} />
                ) : !roster.data?.requests.length ? (
                  <p className="text-support text-ink-muted">No one is waiting.</p>
                ) : (
                  <ul className="grid gap-2">
                    {roster.data.requests.map((r) => (
                      <li key={r.userId} className="p-3 rounded-control border border-line grid gap-2">
                        <span className="text-support font-semibold text-ink">{r.name}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            tone="community"
                            icon={Check}
                            disabled={busy}
                            onClick={() => void memberAction(r, 'APPROVE', `${r.name} is in`)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setNote('');
                              setRejecting(r);
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            <Card padding="md" className="grid gap-3">
              <SectionHeading title="Members" level={2} />
              {roster.data?.members.length ? (
                <ul className="grid gap-2">
                  {roster.data.members.map((m) => (
                    <li key={m.userId} className="p-3 rounded-control border border-line grid gap-2">
                      <span className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-support font-semibold text-ink truncate">{m.name}</span>
                        {m.role !== 'MEMBER' && <Badge tone="community">{m.role === 'OWNER' ? 'Owner' : 'Co-admin'}</Badge>}
                      </span>
                      {m.role !== 'OWNER' && (
                        <div className="flex flex-wrap gap-2">
                          {canEditCoAdmins && m.role === 'MEMBER' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void memberAction(m, 'MAKE_CO_ADMIN', `${m.name} is now a co-admin`)}
                            >
                              Make co-admin
                            </Button>
                          )}
                          {canEditCoAdmins && m.role === 'CO_ADMIN' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void memberAction(m, 'REMOVE_CO_ADMIN', `${m.name} is now a member`)}
                            >
                              Remove co-admin
                            </Button>
                          )}
                          {canEditCoAdmins && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Crown}
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: `Make ${m.name} the owner?`,
                                  description: v.isOwner
                                    ? 'You become a co-admin. Only the owner can manage co-admins and close the circle.'
                                    : 'They will run the circle from now on.',
                                  label: 'Make owner',
                                  run: async () => void (await memberAction(m, 'TRANSFER_OWNERSHIP', `${m.name} is now the owner`)),
                                })
                              }
                            >
                              Make owner
                            </Button>
                          )}
                          {(m.role === 'MEMBER' || canEditCoAdmins) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={UserMinus}
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: `Remove ${m.name}?`,
                                  description:
                                    'They lose access to the group link and member list, and are told. They can ask to join again.',
                                  label: 'Remove',
                                  destructive: true,
                                  run: async () => void (await memberAction(m, 'REMOVE', `${m.name} was removed`)),
                                })
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-support text-ink-muted">{roster.loading ? 'Loading…' : 'No members yet.'}</p>
              )}
            </Card>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.label ?? 'OK'}
        cancelLabel="Cancel"
        destructive={confirm?.destructive}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const run = confirm?.run;
          setConfirm(null);
          if (run) void run();
        }}
      />
      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Decline ${rejecting?.name ?? ''}?`}
        description="They can ask again after 3 days."
      >
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const row = rejecting;
            setRejecting(null);
            if (row) void memberAction(row, 'REJECT', 'Request declined', note.trim());
          }}
        >
          <Textarea
            label="Note for them (optional)"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. This circle is for Tower B residents"
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="flex-1">
              Decline
            </Button>
          </div>
        </form>
      </Dialog>
    </PageContainer>
  );
}
