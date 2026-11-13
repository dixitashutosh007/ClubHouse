'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { AuditLogEntry } from './types';
import { AuditTone, describeAuditEvent } from '@/lib/audit-text';

const timestampFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TONE_DOT: Record<AuditTone, string> = {
  good: 'bg-emerald-600',
  bad: 'bg-rose-600',
  neutral: 'bg-slate-400',
};

export function ActivityLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    const res = await apiFetch('/api/v1/admin/audit-logs');
    if (res.ok) {
      setLogs((await res.json()).events ?? []);
      setError('');
    } else {
      setError(await apiErrorMessage(res, 'Could not load activity logs'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadLogs();
    });
    return () => {
      cancelled = true;
    };
  }, [loadLogs]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-700">What has happened in your society recently (latest 100).</p>
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-100"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}
        </p>
      ) : logs === null ? (
        <div className="py-12 text-center text-xs text-zinc-600" role="status">
          Loading activity logs…
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <History className="w-8 h-8 text-zinc-600 mx-auto mb-2" aria-hidden="true" />
          <p className="text-xs font-semibold text-zinc-700">No activity logged yet</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">Administrative and lifecycle events will appear here.</p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {logs.map((log) => {
            const { text, tone } = describeAuditEvent({
              action: log.action,
              actorName: log.actorName,
              subjectName: log.subjectName,
              metadata: log.metadata as Record<string, unknown> | undefined,
            });
            return (
              <li key={log.id} className="flex items-start gap-3 p-3 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TONE_DOT[tone]}`} aria-hidden="true" />
                <span className="flex-1 min-w-0 text-zinc-800">{text}</span>
                <time dateTime={log.createdAt} className="shrink-0 text-[11px] text-zinc-600">
                  {timestampFormatter.format(new Date(log.createdAt))}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
