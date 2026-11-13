'use client';

import React, { useState } from 'react';
import { ChevronRight, Search, UserMinus } from 'lucide-react';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { FlatNumberInput } from '@/components/FlatNumberInput';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { FlatNumberConfig, MembershipStatus } from '@/types';
import { AdminMember, Notify } from './types';

type ResidentAction = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE';
type Filter = 'WAITING' | 'ACTIVE' | 'SUSPENDED' | 'ALL';

const STATUS: Record<MembershipStatus, { text: string; tone: string }> = {
  ACTIVE: { text: 'Active', tone: 'bg-emerald-100 text-emerald-900' },
  PENDING_APPROVAL: { text: 'Waiting', tone: 'bg-amber-100 text-amber-900' },
  REGISTERED: { text: 'Waiting', tone: 'bg-amber-100 text-amber-900' },
  INVITED: { text: 'Invited', tone: 'bg-slate-100 text-slate-800' },
  REJECTED: { text: 'Rejected', tone: 'bg-rose-100 text-rose-900' },
  SUSPENDED: { text: 'Suspended', tone: 'bg-rose-100 text-rose-900' },
  DEACTIVATED: { text: 'Left', tone: 'bg-slate-100 text-slate-800' },
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

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="relative">
        <label htmlFor="resident-search" className="sr-only">
          Search residents
        </label>
        <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          id="resident-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, flat or mobile"
          className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter residents">
        {FILTERS.map((f) => {
          const count = allMembers.filter(f.test).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                filter === f.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-800'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-700" role="status">
          Loading residents…
        </p>
      ) : shown.length === 0 ? (
        <p className="p-4 rounded-2xl bg-white border border-dashed border-slate-300 text-sm text-slate-700 text-center">
          No residents here.
        </p>
      ) : (
        <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {shown.map((m) => (
            <li key={m.id} className="flex items-center gap-2 pl-3">
              {m.role === 'RESIDENT' && m.status !== 'DEACTIVATED' ? (
                <input
                  type="checkbox"
                  checked={selected.includes(m.userId)}
                  onChange={() => toggle(m.userId)}
                  aria-label={`Select ${m.user.fullName}`}
                  className="w-4 h-4 accent-emerald-700 shrink-0"
                />
              ) : (
                <span className="w-4 shrink-0" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => setOpenId(m.userId)}
                className="flex-1 min-w-0 flex items-center gap-3 py-3 pr-3 text-left hover:bg-slate-50"
              >
                <Avatar name={m.user.fullName} photoUrl={m.user.profilePhotoUrl} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 truncate">
                    {m.user.fullName}
                    {m.role !== 'RESIDENT' && <span className="ml-1.5 text-[10px] font-bold text-emerald-800">{ROLE[m.role]}</span>}
                  </span>
                  <span className="block text-xs text-slate-600 truncate">Flat {m.flatNumber || '—'}</span>
                </span>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS[m.status].tone}`}>
                  {STATUS[m.status].text}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="sticky bottom-20 p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => setConfirmRemove(selected)}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-bold flex items-center gap-1.5"
          >
            <UserMinus className="w-4 h-4" aria-hidden="true" /> Remove (moved out)
          </button>
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
  const s = member.status;
  const isAppAdmin = member.role === 'SUPER_ADMIN';
  const btn = 'h-10 rounded-xl text-sm font-bold';

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

  return (
    <Dialog open onClose={onClose} title={member.user.fullName} description={`${ROLE[member.role]} · ${STATUS[s].text}`}>
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <div>
            <label htmlFor="edit-name" className="text-xs font-semibold text-slate-800 block mb-1">
              Name
            </label>
            <input
              id="edit-name"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-sm p-2.5 rounded-xl border border-slate-300"
            />
          </div>
          <FlatNumberInput label="Flat number" config={flatConfig} value={flatNumber} onChange={setFlatNumber} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className={`${btn} border border-slate-300 text-slate-800`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`${btn} bg-slate-900 text-white disabled:opacity-60`}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <dl className="text-sm divide-y divide-slate-100">
            {[
              ['Flat', member.flatNumber || '—'],
              ['Mobile', member.user.mobile || '—'],
              ['Email', member.user.email || '—'],
              ['Joined', formatIstDay(istDateOf(member.createdAt))],
            ].map(([k, v]) => (
              <div key={k} className="py-1.5 flex justify-between gap-3">
                <dt className="text-slate-600">{k}</dt>
                <dd className="font-semibold text-slate-900 text-right break-all">{v}</dd>
              </div>
            ))}
          </dl>

          {!isAppAdmin && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditing(true)} className={`${btn} border border-slate-300 text-slate-800`}>
                Edit details
              </button>
              {(s === 'PENDING_APPROVAL' || s === 'REGISTERED') && (
                <>
                  <button type="button" onClick={() => void onAction('APPROVE')} className={`${btn} bg-emerald-700 text-white`}>
                    Approve
                  </button>
                  <button type="button" onClick={() => void onAction('REJECT')} className={`${btn} border border-rose-300 text-rose-800`}>
                    Reject
                  </button>
                </>
              )}
              {s === 'ACTIVE' && (
                <>
                  <button type="button" onClick={() => void onAction('SUSPEND')} className={`${btn} border border-amber-400 text-amber-900`}>
                    Suspend
                  </button>
                  <button type="button" onClick={() => void onAction('BLOCK')} className={`${btn} border border-rose-300 text-rose-800`}>
                    Block
                  </button>
                </>
              )}
              {(s === 'SUSPENDED' || s === 'DEACTIVATED' || s === 'REJECTED') && (
                <button type="button" onClick={() => void onAction('REACTIVATE')} className={`${btn} bg-emerald-700 text-white`}>
                  Reactivate
                </button>
              )}
              {member.role === 'RESIDENT' && s !== 'DEACTIVATED' && (
                <button type="button" onClick={onRemove} className={`${btn} border border-slate-300 text-rose-800`}>
                  Remove (moved out)
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={onClose} className={`${btn} w-full border border-slate-300 text-slate-800`}>
            Close
          </button>
        </div>
      )}
    </Dialog>
  );
}
