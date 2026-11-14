'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './cn';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  /** Shows a short message; errors stay until dismissed, others for 4 seconds */
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const LOOK: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: AlertTriangle, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
};

/**
 * Short confirmations ("Ride offered") and errors. Messages appear above the
 * bottom bar on phones and top-right on desktop, and are read out by screen
 * readers (polite for confirmations, assertive for errors).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((all) => all.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, message, kind }]);
      if (kind !== 'error') timers.current.set(id, setTimeout(() => dismiss(id), 4000));
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed z-50 inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] px-4 flex flex-col items-center gap-2 pointer-events-none lg:inset-x-auto lg:right-6 lg:top-6 lg:bottom-auto lg:items-end"
      >
        {items.map((t) => {
          const { icon: Icon, className } = LOOK[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-card bg-surface border border-line shadow-overlay px-4 py-3"
            >
              <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', className)} aria-hidden="true" />
              <p className="flex-1 text-support text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-my-3 -mr-3 w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-ink-muted hover:bg-sunken"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Show a toast from any component inside ToastProvider */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
