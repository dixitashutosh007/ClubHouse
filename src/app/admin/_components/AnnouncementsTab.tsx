'use client';

import React, { useState } from 'react';
import { Megaphone, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NoticeCard } from '@/components/SocietyNotices';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Input, Textarea } from '@/components/ui/Field';
import { SectionHeading } from '@/components/ui/Layout';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { LoadError } from '@/components/ui/LoadState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatIstDay, istDateOf } from '@/lib/utils/time';
import { Announcement } from '@/types';
import { Notify } from './types';


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
  const [from, setFrom] = useState('');
  const [send, setSend] = useState(true);
  const [posting, setPosting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  // "Edit" without an edit API: take the notice down and post a corrected one
  const [repostId, setRepostId] = useState<string | null>(null);
  const { user } = useAuth();
  const [now] = useState(() => new Date().toISOString());

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await apiFetch('/api/v1/announcements', {
        json: {
          title: title.trim(),
          body: body.trim(),
          notify: send,
          ...(expiresOn ? { expiresOn } : {}),
          ...(from.trim() ? { from: from.trim() } : {}),
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { notified: number };
        if (repostId) {
          // The corrected notice is up: take the old one down
          await apiFetch(`/api/v1/announcements?id=${encodeURIComponent(repostId)}`, { method: 'DELETE' });
          setRepostId(null);
        }
        notify(send ? `Notice posted and sent to ${data.notified} residents.` : 'Notice posted.');
        setTitle('');
        setBody('');
        setExpiresOn('');
        setFrom('');
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

  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;
  const preview: Announcement = {
    id: 'preview',
    societyId: '',
    title: title.trim() || 'Your notice title',
    body: body.trim() || 'The details residents will read.',
    createdBy: '',
    fromName: from.trim() || (user ? `${user.fullName}, Society admin` : undefined),
    createdAt: now,
    expiresOn: expiresOn || undefined,
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card as="section" aria-labelledby="new-notice" padding="lg" className="grid gap-4">
          <h2 id="new-notice" className="font-display text-card font-bold text-ink">
            {repostId ? 'Correct and post again' : 'New notice'}
          </h2>
          {repostId && (
            <p className="p-3 rounded-control bg-info-bg text-support text-ink">
              Notices can&apos;t be edited once posted. Posting this takes the old one down and puts this one up.
            </p>
          )}
          <form onSubmit={post} className="grid gap-4">
            <Input
              id="notice-title"
              label="Title"
              hint={`${titleLen}/80 characters`}
              required
              minLength={3}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water supply off on Sunday 10 am–2 pm"
            />
            <Textarea
              id="notice-body"
              label="Details"
              hint={`${bodyLen}/1000 characters`}
              required
              minLength={5}
              maxLength={1000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input id="notice-from" label="From (optional)" maxLength={60} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your name, Society admin" />
              <Input id="notice-until" label="Show until (optional)" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
            <Checkbox id="notice-send" label="Also send it as a notification" description="Residents get an alert on their phone" checked={send} onChange={(e) => setSend(e.target.checked)} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" icon={Megaphone} loading={posting} disabled={titleLen < 3 || bodyLen < 5}>
                {posting ? 'Posting…' : repostId ? 'Post corrected notice' : 'Post notice'}
              </Button>
              {repostId && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRepostId(null);
                    setTitle('');
                    setBody('');
                    setFrom('');
                    setExpiresOn('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        <aside aria-label="Preview" className="grid gap-2 xl:sticky xl:top-24">
          <p className="text-tag font-semibold uppercase tracking-wider text-ink-muted">How residents will see it</p>
          <div inert>
            <NoticeCard notice={preview} featured onOpen={() => {}} onDismiss={() => {}} />
          </div>
        </aside>
      </div>

      <section aria-labelledby="current-notices" className="grid gap-3">
        <SectionHeading id="current-notices" title="Live notices" />
        {loading ? (
          <SkeletonCard label="Loading notices" />
        ) : error ? (
          <LoadError message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Megaphone} title="No live notices" description="Notices you post appear on every resident's Home." />
        ) : (
          <ul className="grid gap-2">
            {data.map((n) => (
              <li key={n.id}>
                <Card className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 grid gap-1">
                    <p className="flex flex-wrap items-center gap-2 text-support font-bold text-ink">
                      {n.title}
                      <span className="text-tag font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">Live</span>
                    </p>
                    <p className="text-support text-ink line-clamp-2">{n.body}</p>
                    <p className="text-meta text-ink-muted">
                      {n.fromName ? `${n.fromName} · ` : ''}
                      Posted {formatIstDay(istDateOf(n.createdAt))}
                      {n.expiresOn ? ` · until ${formatIstDay(n.expiresOn)}` : ' · no end date'}
                    </p>
                  </div>
                  <IconButton
                    icon={RotateCcw}
                    label={`Correct and post again: ${n.title}`}
                    onClick={() => {
                      setRepostId(n.id);
                      setTitle(n.title);
                      setBody(n.body);
                      setFrom(n.fromName ?? '');
                      setExpiresOn(n.expiresOn ?? '');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                  <IconButton icon={Trash2} label={`Take down: ${n.title}`} className="text-danger" onClick={() => setRemoveId(n.id)} />
                </Card>
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
