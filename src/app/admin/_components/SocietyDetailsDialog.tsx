'use client';

import { useState } from 'react';
import { ShieldCheck, UserPlus, X } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Dialog } from '@/components/ui/Dialog';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { Notify } from './types';

interface Details {
  society: { id: string; name: string; address: string; status: string; inviteCode?: string };
  counts: { residents: number; waiting: number };
  admins: { userId: string; name: string; mobile: string; role: string; flatNumber: string }[];
  invitedAdmins: string[];
}

/** One society: its numbers and admins, with add / revoke (app admins only) */
export function SocietyDetailsDialog({
  societyId,
  onClose,
  notify,
}: {
  societyId: string;
  onClose: () => void;
  notify: Notify;
}) {
  const { data, error, loading, reload } = useApiData<Details>(
    `/api/v1/admin/societies/details?id=${encodeURIComponent(societyId)}`,
    (json) => json as Details,
    'Could not load this society.'
  );
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async (method: 'POST' | 'DELETE', body: Record<string, string>, done: string) => {
    setBusy(true);
    const res = await apiFetch('/api/v1/admin/societies/admins', { method, json: { societyId, ...body } });
    setBusy(false);
    if (res.ok) {
      notify(done);
      setMobile('');
      reload();
    } else notify(await apiErrorMessage(res, 'Could not update the admins.'), 'error');
  };

  const live = data?.society.status === 'ACTIVE';

  return (
    <Dialog open onClose={onClose} title={data?.society.name ?? 'Society'} description={data?.society.address}>
      {loading ? (
        <Loading label="Loading…" />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-control bg-sunken p-2">
              <dt className="text-tag text-ink-muted">Residents</dt>
              <dd className="text-card font-display font-bold text-ink">{data.counts.residents}</dd>
            </div>
            <div className="rounded-control bg-sunken p-2">
              <dt className="text-tag text-ink-muted">Waiting</dt>
              <dd className="text-card font-display font-bold text-ink">{data.counts.waiting}</dd>
            </div>
            <div className="rounded-control bg-sunken p-2">
              <dt className="text-tag text-ink-muted">Code</dt>
              <dd className="text-support font-mono font-bold text-ink pt-1">{data.society.inviteCode ?? '—'}</dd>
            </div>
          </dl>

          <section aria-label="Admins" className="space-y-2">
            <h3 className="text-meta font-bold text-ink-muted uppercase tracking-wide">Admins</h3>
            {data.admins.length === 0 && data.invitedAdmins.length === 0 && (
              <p className="text-support text-ink-muted">No admins yet.</p>
            )}
            <ul className="space-y-1.5">
              {data.admins.map((a) => (
                <li key={a.userId} className="flex items-center gap-2 p-2 rounded-control border border-line">
                  <ShieldCheck className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-support font-semibold text-ink truncate">{a.name}</p>
                    <p className="text-tag text-ink-muted">
                      {a.mobile}
                      {a.role === 'SUPER_ADMIN' ? ' · App admin' : ''}
                    </p>
                  </div>
                  {a.role === 'SOCIETY_ADMIN' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => change('DELETE', { userId: a.userId }, `${a.name} is no longer an admin.`)}
                      className="text-meta font-semibold text-danger px-2 py-1 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
              {data.invitedAdmins.map((m) => (
                <li key={m} className="flex items-center gap-2 p-2 rounded-control border border-dashed border-line-strong">
                  <UserPlus className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-support font-semibold text-ink">{m}</p>
                    <p className="text-tag text-ink-muted">Becomes admin on first sign-in</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Withdraw invitation for ${m}`}
                    onClick={() => change('DELETE', { mobile: m }, 'Invitation withdrawn.')}
                    className="p-1.5 text-ink-muted disabled:opacity-50"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {live && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (mobile.trim()) void change('POST', { mobile }, 'Admin added.');
              }}
            >
              <label htmlFor="new-admin-mobile" className="sr-only">
                Mobile number of the new admin
              </label>
              <input
                id="new-admin-mobile"
                type="tel"
                inputMode="tel"
                placeholder="Mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="flex-1 min-w-0 h-11 px-3 rounded-control border border-line-strong text-support"
              />
              <button
                type="submit"
                disabled={busy || !mobile.trim()}
                className="h-11 px-4 rounded-control bg-terracotta-deep text-ink-inverse text-support font-bold disabled:opacity-50"
              >
                Add admin
              </button>
            </form>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
