'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, MessagesSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { useIsClient } from '@/hooks/useIsClient';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { formatIstTime, istDateOf, relativeDayLabel } from '@/lib/utils/time';
import { MAX_MESSAGE_WORDS, MESSAGE_HISTORY_DAYS, linkParts, messageProblem, messageWords } from '@/lib/validation/circle-message';
import type { CircleView } from '@/lib/services/circles';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';

interface Message {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
  mine: boolean;
  canDelete: boolean;
}

/** New messages are fetched this often while the page is on screen (slower in the background) */
const VISIBLE_POLL_MS = 15_000;
const HIDDEN_POLL_MS = 60_000;
/** Every few checks, reload everything so deletions by others show too */
const FULL_RELOAD_EVERY = 4;

export default function CircleMessagesPage() {
  return (
    <Suspense fallback={<Loading label="Loading messages…" />}>
      <CircleMessages />
    </Suspense>
  );
}

const byTime = (a: Message, b: Message) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

function CircleMessages() {
  const { id } = useParams<{ id: string }>();
  const { activePersona, society, user } = useAuth();
  const toast = useToast();
  const isClient = useIsClient();
  const {
    data: circle,
    loading,
    error,
    reload,
  } = useApiData(
    `/api/v1/circles?id=${encodeURIComponent(id)}`,
    (json) => (json as { circle?: CircleView }).circle ?? null,
    'Could not load the circle.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const isMember = circle?.viewer.status === 'APPROVED';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [canPost, setCanPost] = useState(true);
  const [lostAccess, setLostAccess] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [deleting, setDeleting] = useState<Message | null>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  // Load, then check for new messages every 15 seconds while the page is open
  useEffect(() => {
    if (!isMember) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let after: string | undefined;
    let ticks = 0;
    const tick = async () => {
      const full = after === undefined || ticks % FULL_RELOAD_EVERY === 0;
      ticks++;
      try {
        const res = await apiFetch(
          `/api/v1/circles/messages?circleId=${encodeURIComponent(id)}${full ? '' : `&after=${encodeURIComponent(after!)}`}`
        );
        if (stopped) return;
        if (res.status === 403 || res.status === 404) {
          // Removed from the circle (or it is gone): stop at once
          setLostAccess(true);
          return;
        }
        if (res.ok) {
          const body = (await res.json()) as { messages: Message[]; canPost: boolean };
          if (stopped) return;
          const latest = body.messages.at(-1)?.createdAt;
          if (latest && (!after || latest > after)) after = latest;
          setMessages((cur) => {
            if (full) return body.messages;
            const known = new Set(cur.map((m) => m.id));
            return [...cur, ...body.messages.filter((m) => !known.has(m.id))].sort(byTime);
          });
          setCanPost(body.canPost);
          setLoaded(true);
        }
      } catch {
        // Offline: try again on the next check
      }
      if (!stopped) timer = setTimeout(tick, document.visibilityState === 'visible' ? VISIBLE_POLL_MS : HIDDEN_POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, isMember]);

  // Stay at the newest message when one arrives, unless the reader has scrolled up
  useEffect(() => {
    const list = listRef.current;
    if (!list || !endRef.current) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (firstScroll.current || nearBottom) endRef.current.scrollIntoView({ block: 'end' });
    if (messages.length) firstScroll.current = false;
  }, [messages.length]);

  const problem = text.trim() ? messageProblem(text) : null;
  const words = messageWords(text);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const err = messageProblem(text);
    if (err) return setSendError(err);
    setSending(true);
    setSendError('');
    try {
      const res = await apiFetch('/api/v1/circles/messages', { method: 'POST', json: { circleId: id, text } });
      if (!res.ok) {
        if (res.status === 403) setLostAccess(true);
        return setSendError(await apiErrorMessage(res, 'Could not send the message.'));
      }
      const { message } = (await res.json()) as { message: Omit<Message, 'name'> };
      setMessages((cur) => [...cur.filter((m) => m.id !== message.id), { ...message, name: user?.fullName ?? 'You' }].sort(byTime));
      setText('');
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }));
    } catch {
      setSendError('Connection problem. Check your internet and try again.');
    } finally {
      setSending(false);
    }
  };

  const remove = async (m: Message) => {
    const res = await apiFetch(`/api/v1/circles/messages?circleId=${encodeURIComponent(id)}&messageId=${encodeURIComponent(m.id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return toast.show(await apiErrorMessage(res, 'Could not delete the message.'), 'error');
    setMessages((cur) => cur.filter((x) => x.id !== m.id));
    toast.show('Message deleted', 'success');
  };

  if (loading) return <Loading label="Loading messages…" />;
  if (!circle) {
    if (error && !error.toLowerCase().includes('not found')) return <LoadError message={error} onRetry={reload} />;
  }
  if (!circle || !isMember || lostAccess) {
    return (
      <PageContainer width="narrow" className="grid gap-5">
        <ModuleHeader module="community" title="Messages" backHref={circle ? `/circles/${circle.id}` : '/circles'} backLabel="Back" />
        <EmptyState
          icon={Lock}
          tone="community"
          title="Messages are for members"
          description="Only approved members of this circle can read and send messages."
          action={
            <Button tone="community" href={circle ? `/circles/${circle.id}` : '/circles'}>
              {circle ? 'Back to the circle' : 'Back to Circles'}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow" className="grid gap-4">
      <ModuleHeader
        module="community"
        title={circle.name}
        description="Messages · members only"
        backHref={`/circles/${circle.id}`}
        backLabel="Back to the circle"
      />

      <div
        ref={listRef}
        className="rounded-card border border-line bg-surface p-3 sm:p-4 h-[calc(100dvh-25rem)] min-h-56 lg:h-[calc(100dvh-21rem)] overflow-y-auto"
        tabIndex={0}
        aria-label="Messages"
      >
        {!loaded ? (
          <p className="text-support text-ink-muted p-2">Loading messages…</p>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            tone="community"
            title="No messages yet"
            description={`Say hello to the circle. Messages are kept for ${MESSAGE_HISTORY_DAYS} days.`}
          />
        ) : (
          <div role="log" aria-live="polite" aria-label="Circle messages">
            <ol className="grid gap-2">
              {messages.map((m, i) => {
                const day = istDateOf(m.createdAt);
                const newDay = i === 0 || istDateOf(messages[i - 1].createdAt) !== day;
                const sameAuthor = !newDay && messages[i - 1].userId === m.userId;
                return (
                  <React.Fragment key={m.id}>
                    {newDay && (
                      <li className="justify-self-center my-1 px-3 py-1 rounded-full bg-sunken text-meta font-semibold text-ink-muted">
                        {isClient ? relativeDayLabel(day) : day}
                      </li>
                    )}
                    <li
                      className={cn(
                        'flex items-end gap-1 max-w-[85%] min-w-0',
                        m.mine ? 'justify-self-end flex-row-reverse' : 'justify-self-start'
                      )}
                    >
                      <div className={cn('rounded-card px-3 py-2 min-w-0', m.mine ? 'bg-community-tint text-ink' : 'bg-sunken text-ink')}>
                        {!m.mine && !sameAuthor && <p className="text-meta font-semibold text-community-deep">{m.name}</p>}
                        <p className="text-support whitespace-pre-wrap break-words">
                          {linkParts(m.text).map((p, j) =>
                            p.href ? (
                              <a
                                key={j}
                                href={p.href}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-community-deep underline underline-offset-2 [overflow-wrap:anywhere]"
                              >
                                {p.text}
                              </a>
                            ) : (
                              <React.Fragment key={j}>{p.text}</React.Fragment>
                            )
                          )}
                        </p>
                        <p className="text-meta text-ink-muted mt-0.5">
                          <span className="sr-only">{m.mine ? 'You' : m.name}, </span>
                          {formatIstTime(m.createdAt)}
                        </p>
                      </div>
                      {m.canDelete && (
                        <IconButton
                          icon={Trash2}
                          size="sm"
                          label={m.mine ? 'Delete your message' : `Delete message from ${m.name}`}
                          onClick={() => setDeleting(m)}
                        />
                      )}
                    </li>
                  </React.Fragment>
                );
              })}
              <li ref={endRef} aria-hidden="true" />
            </ol>
          </div>
        )}
      </div>

      {canPost ? (
        <form onSubmit={send} className="grid gap-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <Textarea
              label="Your message"
              hideLabel
              rows={2}
              maxLength={1500}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSendError('');
              }}
              onKeyDown={(e) => {
                // Ctrl/Cmd + Enter sends; Enter alone starts a new line
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
              }}
              placeholder="Write a message (text only, no emoji)"
              aria-describedby="message-help"
              aria-invalid={sendError || problem ? true : undefined}
            />
            <Button type="submit" tone="community" icon={Send} loading={sending} disabled={!text.trim() || Boolean(problem)}>
              Send
            </Button>
          </div>
          <p
            id="message-help"
            role={sendError || problem ? 'alert' : undefined}
            className={cn('text-meta', sendError || problem ? 'text-danger font-medium' : 'text-ink-muted')}
          >
            {sendError || problem || `${words}/${MAX_MESSAGE_WORDS} words · text only · one message every 10 seconds`}
          </p>
        </form>
      ) : (
        <p className="p-3 rounded-control bg-sunken text-support text-ink">This circle is closed, so no new messages can be sent.</p>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this message?"
        description={
          deleting?.mine
            ? 'It is removed for everyone. Messages cannot be edited.'
            : `${deleting?.name ?? 'Their'} message is removed for everyone.`
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const m = deleting;
          setDeleting(null);
          if (m) void remove(m);
        }}
      />
    </PageContainer>
  );
}
