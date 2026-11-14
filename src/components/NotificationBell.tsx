'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/hooks/useIsClient';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useRideActivity } from '@/lib/ride-activity';
import { ArrowLeft, Bell, BellRing, Car, CheckCircle2, Flag, Megaphone, Siren, Sparkles, X, XCircle, type LucideIcon } from 'lucide-react';
import { Button, IconButton, buttonClasses } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { groupNotifications } from '@/lib/notification-groups';
import Link from 'next/link';
import { InAppNotification } from '@/types';
import { formatIstDateTime } from '@/lib/utils/time';

/** Icon and colour for each kind of notification */
const TYPE_LOOK: Record<string, { icon: LucideIcon; className: string }> = {
  RIDE_REQUESTED: { icon: Car, className: 'bg-ride-tint text-ride-deep' },
  MATCH_FOUND: { icon: Sparkles, className: 'bg-ride-tint text-ride-deep' },
  REQUEST_ACCEPTED: { icon: CheckCircle2, className: 'bg-success-bg text-success' },
  RIDE_STARTED: { icon: Car, className: 'bg-info-bg text-info' },
  RIDE_COMPLETED: { icon: Flag, className: 'bg-success-bg text-success' },
  REQUEST_REJECTED: { icon: XCircle, className: 'bg-warning-bg text-warning' },
  RIDE_CANCELLED: { icon: XCircle, className: 'bg-warning-bg text-warning' },
  SOS_ALERT: { icon: Siren, className: 'bg-danger-bg text-danger' },
  GENERAL: { icon: Megaphone, className: 'bg-terracotta-tint text-terracotta-deep' },
};
const lookFor = (type: string) => TYPE_LOOK[type] ?? TYPE_LOOK.GENERAL;

/** The type's icon in its colour */
function TypeIcon({ type, size = 'md' }: { type: string; size?: 'md' | 'lg' }) {
  const { icon: Icon, className } = lookFor(type);
  return (
    <span className={cn('rounded-control flex items-center justify-center shrink-0', size === 'lg' ? 'w-12 h-12' : 'w-10 h-10', className)}>
      <Icon className="w-5 h-5" aria-hidden="true" />
    </span>
  );
}

export function NotificationBell() {
  const { activePersona } = useAuth();
  const isClient = useIsClient();
  const { permission, requestPermission } = useNotifications();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  // The notification opened in full
  const [detail, setDetail] = useState<InAppNotification | null>(null);

  const openDetail = (notif: InAppNotification) => {
    setDetail(notif);
    if (!notif.read) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      void apiFetch('/api/v1/notifications', { method: 'PATCH', json: { notificationId: notif.id } }).catch(() => {});
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  }, []);

  useEffect(() => {
    // Load once; afterwards the app-wide watcher announces new activity
    const timeout = setTimeout(fetchNotifications, 0);
    return () => clearTimeout(timeout);
  }, [fetchNotifications, activePersona]);
  useRideActivity(() => void fetchNotifications());

  const markAllRead = async () => {
    try {
      await apiFetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const close = () => {
    setIsOpen(false);
    setDetail(null);
  };
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setDetail(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);


  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative w-11 h-11 flex items-center justify-center rounded-full bg-surface border border-line text-ink hover:bg-sunken transition-colors"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-danger text-tag font-bold text-ink-inverse ring-2 ring-surface"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Phones: a bottom sheet. Desktop: a panel under the bell. Rendered at the page root:
          the top bar's blur would otherwise trap position: fixed inside it */}
      {isOpen && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-end lg:block bg-ink/50 lg:bg-transparent" onClick={(e) => e.target === e.currentTarget && close()}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            className="w-full lg:w-[400px] lg:fixed lg:top-16 lg:right-6 bg-surface border border-line shadow-overlay rounded-t-sheet lg:rounded-card flex flex-col max-h-[85dvh] lg:max-h-[70vh] overflow-hidden pb-[env(safe-area-inset-bottom)] lg:pb-0"
          >
            <div className="flex items-center gap-2 pl-4 pr-2 py-2 border-b border-line">
              <h2 id="notifications-title" ref={headingRef} tabIndex={-1} className="flex-1 font-display text-card font-bold text-ink focus:outline-none">
                Notifications
                {unreadCount > 0 && <span className="ml-2 align-middle text-tag font-semibold px-2 py-0.5 rounded-full bg-danger-bg text-danger">{unreadCount} new</span>}
              </h2>
              {unreadCount > 0 && !detail && (
                <Button variant="ghost" size="md" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
              <IconButton icon={X} label="Close notifications" onClick={close} />
            </div>

            {permission !== 'granted' && !detail && (
              <div className="flex items-center gap-3 px-4 py-3 bg-sunken border-b border-line">
                <BellRing className="w-5 h-5 text-terracotta-deep shrink-0" aria-hidden="true" />
                <p className="flex-1 text-support text-ink">Get ride updates on this device too</p>
                <Button size="md" variant="tonal" onClick={requestPermission}>
                  Turn on
                </Button>
              </div>
            )}

            {detail ? (
              <div className="p-4 grid gap-4 overflow-y-auto">
                <Button variant="ghost" icon={ArrowLeft} className="justify-self-start -ml-2" onClick={() => setDetail(null)}>
                  All notifications
                </Button>
                <div className="flex items-start gap-3">
                  <TypeIcon type={detail.type} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-body font-bold text-ink">{detail.title}</h3>
                    <p className="text-meta text-ink-muted">{formatIstDateTime(detail.createdAt)}</p>
                  </div>
                </div>
                <p className="text-body text-ink whitespace-pre-line">{detail.body}</p>
                {detail.link && detail.link !== '/' && (
                  <Link href={detail.link} onClick={close} className={buttonClasses({ fullWidth: true })}>
                    Open
                  </Link>
                )}
              </div>
            ) : notifications.length === 0 ? (
              <div className="grid justify-items-center text-center gap-2 px-6 py-12">
                <span className="w-14 h-14 rounded-full bg-sunken text-ink-muted flex items-center justify-center">
                  <Bell className="w-7 h-7" aria-hidden="true" />
                </span>
                <p className="text-body font-bold text-ink">You&apos;re all caught up</p>
                <p className="text-support text-ink-muted max-w-xs">Ride requests, confirmations and society notices will show up here.</p>
              </div>
            ) : (
              <div className="overflow-y-auto">
                {groupNotifications(notifications).map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h3 className="sticky top-0 z-[1] px-4 py-1.5 bg-sunken text-tag font-semibold uppercase tracking-wider text-ink-muted">{group.label}</h3>
                    <ul className="divide-y divide-line">
                      {group.items.map((notif) => (
                        <li key={notif.id}>
                          <button
                            type="button"
                            onClick={() => openDetail(notif)}
                            className={cn('w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken', !notif.read && 'bg-terracotta-tint/50')}
                          >
                            <TypeIcon type={notif.type} />
                            <span className="flex-1 min-w-0">
                              <span className="flex items-start justify-between gap-2">
                                <span className={cn('text-support text-ink', notif.read ? 'font-medium' : 'font-bold')}>
                                  {notif.title}
                                  {!notif.read && <span className="sr-only"> (unread)</span>}
                                </span>
                                <span className="text-meta text-ink-muted shrink-0">{formatIstDateTime(notif.createdAt)}</span>
                              </span>
                              <span className="block text-meta text-ink-muted mt-0.5 line-clamp-2 whitespace-pre-line">{notif.body}</span>
                            </span>
                            {!notif.read && <span aria-hidden="true" className="mt-2 w-2.5 h-2.5 rounded-full bg-terracotta-deep shrink-0" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
