'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Copy, Plus } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { SocietyStatus } from '@/types';
import { Notify } from './types';
import { SocietyDetailsDialog } from './SocietyDetailsDialog';

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
  ACTIVE: { label: 'Live', tone: 'bg-success-bg text-success' },
  PENDING_SETUP: { label: 'Waiting for admin', tone: 'bg-warning-bg text-warning' },
  INACTIVE: { label: 'Closed', tone: 'bg-sunken text-ink-muted' },
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
  const [openId, setOpenId] = useState<string | null>(null);

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
    <div className="grid gap-3 [&>*]:min-w-0">
      <Link
        href="/admin/societies/new"
        className="h-12 px-5 justify-self-start rounded-control bg-terracotta-deep hover:bg-terracotta-deep/90 text-ink-inverse text-body font-semibold inline-flex items-center justify-center gap-2"
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
            <li key={s.id} className="p-3.5 rounded-card border border-line bg-surface space-y-2">
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                aria-label={`Open ${s.name}`}
                className="w-full text-left flex items-start gap-3"
              >
                <span className="w-9 h-9 rounded-control bg-sunken text-ink-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-support font-bold text-ink">{s.name}</p>
                  <p className="text-tag text-ink-muted truncate">{s.address}</p>
                </div>
                <span className={`shrink-0 text-tag font-bold px-2 py-0.5 rounded-full ${STATUS[s.status].tone}`}>
                  {STATUS[s.status].label}
                </span>
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
              </button>

              {s.status === 'PENDING_SETUP' && (
                <div className="flex items-center justify-between gap-2 text-meta">
                  <span className="text-ink-muted">
                    Admin {s.pendingAdminName} · {s.pendingAdminMobile} has not signed in yet
                  </span>
                  <button
                    type="button"
                    onClick={() => setCancelId(s.id)}
                    className="shrink-0 inline-flex items-center min-h-11 px-2 rounded-control font-semibold text-danger hover:bg-danger-bg"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {s.status === 'ACTIVE' && s.inviteCode && (
                <div className="flex items-center justify-between gap-2 text-meta">
                  <span className="text-ink-muted">
                    Invite code <span className="font-mono font-bold text-ink">{s.inviteCode}</span>
                    {isClient ? ` · added ${formatIstDay(istDateOf(s.createdAt))}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyInvite(s.inviteCode!)}
                    className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-2 rounded-control font-semibold text-terracotta-deep hover:bg-sunken"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy link
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {openId && <SocietyDetailsDialog societyId={openId} onClose={() => setOpenId(null)} notify={notify} />}

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
