'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadError } from '@/components/ui/LoadState';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
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
  good: 'bg-success',
  bad: 'bg-danger',
  neutral: 'bg-line-strong',
};

/** Audit entries as plain sentences, newest first */
export function ActivityList({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <ul className="rounded-card border border-line bg-surface divide-y divide-line">
      {logs.map((log) => {
        const { text, tone } = describeAuditEvent({
          action: log.action,
          actorName: log.actorName,
          subjectName: log.subjectName,
          metadata: log.metadata as Record<string, unknown> | undefined,
        });
        return (
          <li key={log.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 text-support text-ink">{text}</span>
            <time dateTime={log.createdAt} className="shrink-0 text-meta text-ink-muted">
              {timestampFormatter.format(new Date(log.createdAt))}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

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
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-support text-ink-muted">The latest 100 events in your society.</p>
        <Button variant="secondary" icon={RefreshCw} onClick={() => void loadLogs()}>
          Refresh
        </Button>
      </div>
      {error ? (
        <LoadError message={error} onRetry={() => void loadLogs()} />
      ) : logs === null ? (
        <SkeletonCard label="Loading activity" lines={4} />
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Approvals, settings changes and other admin actions will appear here." />
      ) : (
        <ActivityList logs={logs} />
      )}
    </div>
  );
}
