'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Copy, Plus } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { SocietyStatus } from '@/types';
import { Notify } from './types';

interface AdminSociety {
  id: string;
  name: string;
  address: string;
  status: SocietyStatus;
  createdAt: string;
  pendingAdminName?: string;
  pendingAdminMobile?: string;
  inviteCode?: string;
}

const STATUS: Record<SocietyStatus, { label: string; tone: string }> = {
  ACTIVE: { label: 'Live', tone: 'bg-emerald-100 text-emerald-900' },
  PENDING_SETUP: { label: 'Waiting for admin', tone: 'bg-amber-100 text-amber-900' },
  INACTIVE: { label: 'Closed', tone: 'bg-slate-100 text-slate-700' },
};

/** App admins: every society on the platform, and the way to add one */
export function SocietiesTab({ notify }: { notify: Notify }) {
  const isClient = useIsClient();
  const { data, error, loading, reload } = useApiData(
    '/api/v1/admin/societies',
    (json) => (json as { societies: AdminSociety[] }).societies,
    'Could not load societies.'
  );
  const [cancelId, setCancelId] = useState<string | null>(null);

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${encodeURIComponent(code)}`);
      notify('Invite link copied.');
    } catch {
      notify('Could not copy the link.', 'error');
    }
  };

  const cancel = async (societyId: string) => {
    const res = await apiFetch('/api/v1/admin/societies', { method: 'PATCH', json: { societyId, action: 'CANCEL' } });
    if (res.ok) {
      notify('Society setup cancelled.');
      reload();
    } else notify(await apiErrorMessage(res, 'Could not cancel the setup.'), 'error');
  };

  return (
    <div className="space-y-3">
      <Link
        href="/admin/societies/new"
        className="h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" aria-hidden="true" /> Add a society
      </Link>

      {loading ? (
        <Loading label="Loading societies…" />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <ul className="space-y-2">
          {data?.map((s) => (
            <li key={s.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  <p className="text-[11px] text-slate-600 truncate">{s.address}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS[s.status].tone}`}>
                  {STATUS[s.status].label}
                </span>
              </div>

              {s.status === 'PENDING_SETUP' && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700">
                    Admin {s.pendingAdminName} · {s.pendingAdminMobile} has not signed in yet
                  </span>
                  <button
                    type="button"
                    onClick={() => setCancelId(s.id)}
                    className="shrink-0 font-semibold text-rose-700 underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {s.status === 'ACTIVE' && s.inviteCode && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700">
                    Invite code <span className="font-mono font-bold text-slate-900">{s.inviteCode}</span>
                    {isClient ? ` · added ${formatIstDay(istDateOf(s.createdAt))}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyInvite(s.inviteCode!)}
                    className="shrink-0 flex items-center gap-1 font-semibold text-emerald-800"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy link
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={cancelId !== null}
        title="Cancel this society's setup?"
        description="The society will be closed and its admin won't be able to activate it."
        confirmLabel="Cancel setup"
        cancelLabel="Keep it"
        destructive
        onCancel={() => setCancelId(null)}
        onConfirm={() => {
          const id = cancelId;
          setCancelId(null);
          if (id) void cancel(id);
        }}
      />
    </div>
  );
}
