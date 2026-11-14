'use client';

import React, { useState } from 'react';
import { ChevronRight, Search, UserMinus, Users } from 'lucide-react';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { FlatNumberInput } from '@/components/FlatNumberInput';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { FlatNumberConfig, MembershipStatus } from '@/types';
import { AdminMember, Notify } from './types';

type ResidentAction = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE';
type Filter = 'WAITING' | 'ACTIVE' | 'SUSPENDED' | 'ALL';

const STATUS: Record<MembershipStatus, { text: string; status: BadgeStatus }> = {
  ACTIVE: { text: 'Active', status: 'success' },
  PENDING_APPROVAL: { text: 'Waiting', status: 'warning' },
  REGISTERED: { text: 'Waiting', status: 'warning' },
  INVITED: { text: 'Invited', status: 'neutral' },
  REJECTED: { text: 'Rejected', status: 'danger' },
  SUSPENDED: { text: 'Suspended', status: 'danger' },
  DEACTIVATED: { text: 'Left', status: 'neutral' },
};
const STATUS_ORDER: Record<MembershipStatus, number> = {
  PENDING_APPROVAL: 0,
  REGISTERED: 0,
  ACTIVE: 1,
  INVITED: 2,
  SUSPENDED: 3,
  REJECTED: 4,
  DEACTIVATED: 5,
};
/** Actions that cut off a resident are confirmed first */
const CONFIRM: Partial<Record<ResidentAction, { title: string; description: string; label: string }>> = {
  REJECT: { title: 'Reject this registration?', description: 'They will not get access to the apps. You can reactivate them later.', label: 'Reject' },
  SUSPEND: { title: 'Suspend this resident?', description: 'They lose access until you reactivate them.', label: 'Suspend' },
  BLOCK: { title: 'Block this resident?', description: 'They lose access to the society on Club House.', label: 'Block' },
};

const FILTERS: { id: Filter; label: string; test: (m: AdminMember) => boolean }[] = [
  { id: 'WAITING', label: 'Waiting', test: (m) => m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED' },
  { id: 'ACTIVE', label: 'Active', test: (m) => m.status === 'ACTIVE' },
  { id: 'SUSPENDED', label: 'Suspended / left', test: (m) => ['SUSPENDED', 'REJECTED', 'DEACTIVATED'].includes(m.status) },
  { id: 'ALL', label: 'All', test: () => true },
];

const ROLE: Record<string, string> = { SOCIETY_ADMIN: 'Society admin', SUPER_ADMIN: 'App admin', RESIDENT: 'Resident' };

interface MembersTabProps {
  pendingMembers: AdminMember[];
  allMembers: AdminMember[];
  loading: boolean;
  flatConfig?: FlatNumberConfig;
  notify: Notify;
  onAction: (targetUserId: string, action: ResidentAction) => Promise<void> | void;
  /** Remove residents who have moved out */
  onRemove: (targetUserIds: string[]) => Promise<void>;
  /** Reload after an edit */
  onChanged: () => Promise<void>;
}

/** Every resident of the society: find, review, edit, approve, suspend, block or remove */
export function MembersTab({
  pendingMembers,
  allMembers,
  loading,
  flatConfig,
  notify,
  onAction,
  onRemove,
  onChanged,
}: MembersTabProps) {
  const [filter, setFilter] = useState<Filter>(pendingMembers.length > 0 ? 'WAITING' : 'ACTIVE');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string[] | null>(null);

  const q = query.trim().toLowerCase();
  const shown = allMembers
    .filter(FILTERS.find((f) => f.id === filter)!.test)
    .filter(
      (m) =>
        !q ||
        m.user.fullName.toLowerCase().includes(q) ||
        (m.flatNumber ?? '').toLowerCase().includes(q) ||
        m.user.mobile.includes(q)
    );
  const open = allMembers.find((m) => m.userId === openId) ?? null;
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const selectable = (m: AdminMember) => m.role === 'RESIDENT' && m.status !== 'DEACTIVATED';
  const columns: Column<AdminMember>[] = [
    {
      key: 'select',
      header: 'Select',
      srOnlyHeader: true,
      className: 'w-10',
      render: (m) =>
        selectable(m) ? (
          <input
            type="checkbox"
            checked={selected.includes(m.userId)}
            onChange={() => toggle(m.userId)}
            aria-label={`Select ${m.user.fullName}`}
            className="w-5 h-5 accent-terracotta-deep"
          />
        ) : null,
    },
    {
      key: 'name',
      header: 'Resident',
      sortValue: (m) => m.user.fullName.toLowerCase(),
      render: (m) => (
        <span className="flex items-center gap-3 min-w-0">
          <Avatar name={m.user.fullName} photoUrl={m.user.profilePhotoUrl} size={32} />
          <span className="min-w-0">
            <span className="block font-semibold text-ink truncate">{m.user.fullName}</span>
            {m.role !== 'RESIDENT' && <span className="block text-meta text-terracotta-deep">{ROLE[m.role]}</span>}
          </span>
        </span>
      ),
    },
    { key: 'flat', header: 'Flat', sortValue: (m) => m.flatNumber ?? '', render: (m) => m.flatNumber || '—', className: 'whitespace-nowrap' },
    { key: 'mobile', header: 'Mobile', render: (m) => <span className="whitespace-nowrap">{m.user.mobile || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (m) => STATUS_ORDER[m.status],
      render: (m) => <Badge status={STATUS[m.status].status}>{STATUS[m.status].text}</Badge>,
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (m) => m.createdAt,
      render: (m) => <span className="whitespace-nowrap text-ink-muted">{formatIstDay(istDateOf(m.createdAt))}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      className: 'text-right',
      render: (m) => (
        <span className="inline-flex items-center gap-2 justify-end">
          {(m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED') && (
            <Button size="sm" onClick={() => void onAction(m.userId, 'APPROVE')} aria-label={`Approve ${m.user.fullName}`}>
              Approve
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setOpenId(m.userId)} aria-label={`Open ${m.user.fullName}`}>
            Open
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4 min-w-0 [&>*]:min-w-0">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="relative">
          <label htmlFor="resident-search" className="sr-only">
            Search residents
          </label>
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            id="resident-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, flat or mobile"
            className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter residents">
          {FILTERS.map((f) => {
            const count = allMembers.filter(f.test).length;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'shrink-0 h-11 px-4 rounded-full text-support font-semibold border whitespace-nowrap',
                  filter === f.id ? 'bg-terracotta-deep border-terracotta-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink hover:bg-sunken'
                )}
              >
                {f.label} <span className="opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <SkeletonCard label="Loading residents" lines={4} />
      ) : (
        <DataTable
          caption="Residents"
          columns={columns}
          rows={shown}
          rowKey={(m) => m.id}
          pageSize={25}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={<EmptyState icon={Users} title={q ? 'No residents match' : 'No residents here'} description={q ? 'Try another name, flat or number.' : undefined} />}
          renderCard={(m) => (
            <div className="flex items-center gap-2 pl-3 rounded-card border border-line bg-surface">
              {selectable(m) ? (
                <input
                  type="checkbox"
                  checked={selected.includes(m.userId)}
                  onChange={() => toggle(m.userId)}
                  aria-label={`Select ${m.user.fullName}`}
                  className="w-5 h-5 accent-terracotta-deep shrink-0"
                />
              ) : (
                <span className="w-5 shrink-0" aria-hidden="true" />
              )}
              <button type="button" onClick={() => setOpenId(m.userId)} className="flex-1 min-w-0 flex items-center gap-3 py-3 pr-3 text-left">
                <Avatar name={m.user.fullName} photoUrl={m.user.profilePhotoUrl} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-support font-semibold text-ink truncate">{m.user.fullName}</span>
                  <span className="block text-meta text-ink-muted truncate">
                    Flat {m.flatNumber || '—'}
                    {m.role !== 'RESIDENT' ? ` · ${ROLE[m.role]}` : ''}
                  </span>
                </span>
                <Badge status={STATUS[m.status].status}>{STATUS[m.status].text}</Badge>
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}
        />
      )}

      {selected.length > 0 && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 p-3 rounded-card bg-ink text-ink-inverse flex flex-wrap items-center justify-between gap-3 shadow-overlay">
          <span className="text-support font-semibold">{selected.length} selected</span>
          <span className="flex gap-2">
            <Button variant="ghost" className="text-ink-inverse hover:bg-ink-inverse/10" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button variant="danger" icon={UserMinus} onClick={() => setConfirmRemove(selected)}>
              Remove (moved out)
            </Button>
          </span>
        </div>
      )}

      {open && (
        <ResidentDetail
          key={open.userId}
          member={open}
          flatConfig={flatConfig}
          notify={notify}
          onClose={() => setOpenId(null)}
          onAction={async (action) => {
            await onAction(open.userId, action);
            setOpenId(null);
          }}
          onRemove={() => {
            setOpenId(null);
            setConfirmRemove([open.userId]);
          }}
          onSaved={async () => {
            await onChanged();
            setOpenId(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title={`Remove ${confirmRemove?.length ?? 0} resident${confirmRemove?.length === 1 ? '' : 's'}?`}
        description="For residents who have moved out. Their upcoming rides and classes are cancelled and they lose access. They can ask to join again later."
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          const ids = confirmRemove ?? [];
          setConfirmRemove(null);
          setSelected([]);
          void onRemove(ids);
        }}
      />
    </div>
  );
}

function ResidentDetail({
  member,
  flatConfig,
  notify,
  onClose,
  onAction,
  onRemove,
  onSaved,
}: {
  member: AdminMember;
  flatConfig?: FlatNumberConfig;
  notify: Notify;
  onClose: () => void;
  onAction: (action: ResidentAction) => Promise<void>;
  onRemove: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(member.user.fullName);
  const [flatNumber, setFlatNumber] = useState(member.flatNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<ResidentAction | null>(null);
  const [confirm, setConfirm] = useState<ResidentAction | null>(null);
  const s = member.status;
  const isAppAdmin = member.role === 'SUPER_ADMIN';
  const run = async (action: ResidentAction) => {
    setBusy(action);
    try {
      await onAction(action);
    } finally {
      setBusy(null);
    }
  };
  const ask = (action: ResidentAction) => (CONFIRM[action] ? setConfirm(action) : void run(action));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/residents', {
        method: 'PATCH',
        json: {
          targetUserId: member.userId,
          ...(fullName.trim() !== member.user.fullName ? { fullName: fullName.trim() } : {}),
          ...(flatNumber.trim() && flatNumber.trim() !== member.flatNumber ? { flatNumber: flatNumber.trim() } : {}),
        },
      });
      if (res.ok) {
        notify(`${fullName.trim()}'s details updated.`);
        await onSaved();
      } else notify(await apiErrorMessage(res, 'Could not save the changes'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmText = confirm ? CONFIRM[confirm] : undefined;
  return (
    <Dialog open onClose={onClose} size="md" title={member.user.fullName} description={`${ROLE[member.role]} · ${STATUS[s].text}`}>
      {editing ? (
        <form onSubmit={save} className="grid gap-4">
          <Input id="edit-name" label="Name" required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <FlatNumberInput label="Flat number" config={flatConfig} value={flatNumber} onChange={setFlatNumber} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4">
          <dl className="rounded-control border border-line divide-y divide-line">
            {[
              ['Flat', member.flatNumber || '—'],
              ['Mobile', member.user.mobile || '—'],
              ['Email', member.user.email || '—'],
              ['Joined', formatIstDay(istDateOf(member.createdAt))],
            ].map(([k, v]) => (
              <div key={k} className="px-3 py-2 flex justify-between gap-3 text-support">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-semibold text-ink text-right break-all">{v}</dd>
              </div>
            ))}
          </dl>

          {!isAppAdmin && (
            <div className="grid grid-cols-2 gap-2">
              {(s === 'PENDING_APPROVAL' || s === 'REGISTERED') && (
                <>
                  <Button loading={busy === 'APPROVE'} onClick={() => ask('APPROVE')}>
                    Approve
                  </Button>
                  <Button variant="secondary" className="text-danger" onClick={() => ask('REJECT')}>
                    Reject
                  </Button>
                </>
              )}
              {s === 'ACTIVE' && (
                <>
                  <Button variant="secondary" onClick={() => ask('SUSPEND')}>
                    Suspend
                  </Button>
                  <Button variant="secondary" className="text-danger" onClick={() => ask('BLOCK')}>
                    Block
                  </Button>
                </>
              )}
              {(s === 'SUSPENDED' || s === 'DEACTIVATED' || s === 'REJECTED') && (
                <Button loading={busy === 'REACTIVATE'} onClick={() => ask('REACTIVATE')}>
                  Reactivate
                </Button>
              )}
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit details
              </Button>
              {member.role === 'RESIDENT' && s !== 'DEACTIVATED' && (
                <Button variant="secondary" className="text-danger col-span-2" icon={UserMinus} onClick={onRemove}>
                  Remove (moved out)
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirmText?.title ?? ''}
        description={confirmText?.description ?? ''}
        confirmLabel={confirmText?.label ?? 'Confirm'}
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action) void run(action);
        }}
      />
    </Dialog>
  );
}
