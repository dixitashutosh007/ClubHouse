'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useRideActivity } from '@/lib/ride-activity';
import {
  Bell,
  X,
  CheckCircle2,
  Car,
  Clock,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { InAppNotification } from '@/types';

export function NotificationBell() {
  const { activePersona } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

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

  const getIconForType = (type: string) => {
    switch (type) {
      case 'RIDE_REQUESTED':
        return <Car className="w-4 h-4 text-emerald-600" />;
      case 'REQUEST_ACCEPTED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'MATCH_FOUND':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'RIDE_CANCELLED':
      case 'REQUEST_REJECTED':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all shadow-xs"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Modal Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-600 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser Push Permission Banner (if not yet granted) */}
            {permission !== 'granted' && (
              <div className="p-3 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-emerald-900 font-medium">
                  Enable device push alerts?
                </span>
                <button
                  onClick={requestPermission}
                  className="px-2 py-1 bg-emerald-700 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-800"
                >
                  Enable Push
                </button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto divide-y divide-zinc-100 p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="text-center py-10 px-4 text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-300 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-zinc-600">All caught up!</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Ride requests, match notifications, and confirmations will show up here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl transition-colors ${
                      notif.read ? 'bg-white hover:bg-zinc-50' : 'bg-emerald-50/40 hover:bg-emerald-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-zinc-100 shrink-0">
                        {getIconForType(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {notif.title}
                          </p>
                          <span className="text-[9px] text-zinc-500">
                            {new Date(notif.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Kolkata',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                          {notif.body}
                        </p>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 mt-2"
                          >
                            <span>View details</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
