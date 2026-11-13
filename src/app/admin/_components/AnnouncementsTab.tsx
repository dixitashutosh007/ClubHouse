'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { Announcement } from '@/types';
import { Notify } from './types';

const input =
  'w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600';

/** Post a notice to every resident (shown on Home and sent as a notification) */
export function AnnouncementsTab({ notify }: { notify: Notify }) {
  const { data, error, loading, reload } = useApiData(
    '/api/v1/announcements',
    (json) => (json as { announcements: Announcement[] }).announcements,
    'Could not load notices.'
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [send, setSend] = useState(true);
  const [posting, setPosting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await apiFetch('/api/v1/announcements', {
        json: { title: title.trim(), body: body.trim(), notify: send, ...(expiresOn ? { expiresOn } : {}) },
      });
      if (res.ok) {
        const data = (await res.json()) as { notified: number };
        notify(send ? `Notice posted and sent to ${data.notified} residents.` : 'Notice posted.');
        setTitle('');
        setBody('');
        setExpiresOn('');
        reload();
      } else notify(await apiErrorMessage(res, 'Could not post the notice'), 'error');
    } catch {
      notify('Connection problem. Check your internet and try again.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    const res = await apiFetch(`/api/v1/announcements?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      notify('Notice taken down.');
      reload();
    } else notify(await apiErrorMessage(res, 'Could not take the notice down'), 'error');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={post} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div>
          <label htmlFor="notice-title" className="text-xs font-semibold text-slate-800 block mb-1">
            Title
          </label>
          <input
            id="notice-title"
            required
            minLength={3}
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Water supply off on Sunday 10 am–2 pm"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="notice-body" className="text-xs font-semibold text-slate-800 block mb-1">
            Details
          </label>
          <textarea
            id="notice-body"
            required
            minLength={5}
            maxLength={1000}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="notice-until" className="text-xs font-semibold text-slate-800 block mb-1">
            Show until (optional)
          </label>
          <input id="notice-until" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={input} />
        </div>
        <label htmlFor="notice-send" className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-slate-800">Also send it as a notification</span>
          <input
            id="notice-send"
            type="checkbox"
            checked={send}
            onChange={(e) => setSend(e.target.checked)}
            className="w-5 h-5 accent-emerald-700"
          />
        </label>
        <button
          type="submit"
          disabled={posting}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60"
        >
          {posting ? 'Posting…' : 'Post notice'}
        </button>
      </form>

      <section aria-labelledby="current-notices">
        <h2 id="current-notices" className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Current notices
        </h2>
        {loading ? (
          <Loading label="Loading notices…" />
        ) : error ? (
          <LoadError message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <p className="p-3 rounded-2xl bg-white border border-dashed border-slate-300 text-xs text-slate-700">No notices.</p>
        ) : (
          <ul className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
            {data.map((n) => (
              <li key={n.id} className="p-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-700 line-clamp-2">{n.body}</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {formatIstDay(istDateOf(n.createdAt))}
                    {n.expiresOn ? ` · until ${formatIstDay(n.expiresOn)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveId(n.id)}
                  aria-label={`Take down: ${n.title}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-700 hover:bg-rose-50 shrink-0"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={removeId !== null}
        title="Take this notice down?"
        description="Residents will no longer see it on Home."
        confirmLabel="Take down"
        cancelLabel="Keep"
        destructive
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          const id = removeId;
          setRemoveId(null);
          if (id) void remove(id);
        }}
      />
    </div>
  );
}
