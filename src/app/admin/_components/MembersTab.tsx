'use client';

import React, { useState } from 'react';
import { Check, UserMinus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { MembershipStatus } from '@/types';
import { AdminMember } from './types';

const STATUS_TEXT: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  PENDING_APPROVAL: 'Waiting',
  REGISTERED: 'Registered',
  INVITED: 'Invited',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Left',
};

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  ACTIVE: 'Active / Approved',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended / Blocked',
};

function matchesFilter(member: AdminMember, filter: StatusFilter): boolean {
  if (filter === 'ACTIVE') return member.status === 'ACTIVE';
  if (filter === 'PENDING') return member.status === 'PENDING_APPROVAL';
  if (filter === 'SUSPENDED') {
    return member.status === 'SUSPENDED' || member.status === 'DEACTIVATED' || member.status === 'REJECTED';
  }
  return true;
}

interface MembersTabProps {
  pendingMembers: AdminMember[];
  allMembers: AdminMember[];
  loading: boolean;
  onAction: (targetUserId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE') => void;
  /** Remove residents who have moved out */
  onRemove: (targetUserIds: string[]) => Promise<void>;
}

export function MembersTab({ pendingMembers, allMembers, loading, onAction, onRemove }: MembersTabProps) {
  const [view, setView] = useState<'PENDING' | 'ALL'>('PENDING');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const toggle = (userId: string) =>
    setSelected((cur) => (cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId]));

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex gap-2" role="group" aria-label="Member list">
          {(['PENDING', 'ALL'] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setStatusFilter(v === 'PENDING' ? 'PENDING' : 'ALL');
              }}
              aria-pressed={view === v}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                view === v ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {v === 'PENDING'
                ? `Pending Approvals (${pendingMembers.length})`
                : `All Residents (${allMembers.length})`}
            </button>
          ))}
        </div>

        {view === 'ALL' && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1" role="group" aria-label="Filter by status">
            <span className="text-[11px] text-zinc-600 font-medium mr-1">Filter:</span>
            {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                aria-pressed={statusFilter === st}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                  statusFilter === st ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {FILTER_LABELS[st]}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-600" role="status">
          Loading members…
        </div>
      ) : view === 'PENDING' ? (
        pendingMembers.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-600 border border-dashed rounded-2xl">
            No pending resident verification requests.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingMembers.map((mem) => (
              <div key={mem.id} className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900">{mem.user.fullName}</h3>
                    <p className="text-xs text-zinc-600 font-medium">Flat {mem.flatNumber}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5 font-mono">{mem.user.mobile}</p>
                    {mem.user.email && <p className="text-[11px] text-zinc-600 font-mono">{mem.user.email}</p>}
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                    Awaiting Approval
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => onAction(mem.userId, 'REJECT')}
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 text-xs font-semibold hover:bg-zinc-50 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" /> Reject
                  </button>
                  <button
                    onClick={() => onAction(mem.userId, 'APPROVE')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" /> Approve Resident
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {allMembers
            .filter((mem) => matchesFilter(mem, statusFilter))
            .map((mem) => {
              const isActive = mem.status === 'ACTIVE';
              const isPending = mem.status === 'PENDING_APPROVAL';
              const canReactivate = mem.status === 'SUSPENDED' || mem.status === 'DEACTIVATED';

              return (
                <div key={mem.id} className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    {mem.role === 'RESIDENT' && mem.status !== 'DEACTIVATED' && (
                      <input
                        type="checkbox"
                        checked={selected.includes(mem.userId)}
                        onChange={() => toggle(mem.userId)}
                        aria-label={`Select ${mem.user.fullName}`}
                        className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-900">{mem.user.fullName}</span>
                        {mem.role === 'SOCIETY_ADMIN' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-900 text-white">Admin</span>
                        )}
                        {mem.role === 'SUPER_ADMIN' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white">
                            Super Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600">Flat {mem.flatNumber || 'Unassigned'}</p>
                      <p className="text-[11px] text-zinc-600 font-mono">{mem.user.mobile}</p>
                      {mem.user.email && <p className="text-[11px] text-zinc-600 font-mono">{mem.user.email}</p>}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPending
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {STATUS_TEXT[mem.status]}
                    </span>
                  </div>

                  {mem.role !== 'SUPER_ADMIN' && (
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2 text-xs">
                      {isActive && (
                        <>
                          <button
                            onClick={() => onAction(mem.userId, 'SUSPEND')}
                            className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-medium"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => onAction(mem.userId, 'BLOCK')}
                            className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium"
                          >
                            Block User
                          </button>
                        </>
                      )}
                      {canReactivate && (
                        <button
                          onClick={() => onAction(mem.userId, 'REACTIVATE')}
                          className="px-3 py-1 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 font-medium"
                        >
                          Reactivate Resident
                        </button>
                      )}
                      {isPending && (
                        <button
                          onClick={() => onAction(mem.userId, 'APPROVE')}
                          className="px-3 py-1 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 font-medium"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {view === 'ALL' && selected.length > 0 && (
        <div className="sticky bottom-20 mt-3 p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-bold flex items-center gap-1.5"
          >
            <UserMinus className="w-4 h-4" aria-hidden="true" /> Remove (moved out)
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${selected.length} resident${selected.length === 1 ? '' : 's'}?`}
        description="Use this for residents who have moved out. Their upcoming rides and classes are cancelled and they lose access. They can ask to join again later."
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          const ids = selected;
          setConfirmRemove(false);
          setSelected([]);
          void onRemove(ids);
        }}
      />
    </div>
  );
}
