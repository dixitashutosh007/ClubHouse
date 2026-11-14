'use client';

import React, { useState } from 'react';
import { History, ShieldAlert } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { SegmentedTabs, TabPanel } from '@/components/ui/Tabs';
import { AdminMember, ModerationReport, Notify } from './types';

const dateFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });

const CATEGORY: Record<ModerationReport['category'], string> = {
  INAPPROPRIATE_BEHAVIOUR: 'Inappropriate behaviour',
  MISREPRESENTATION: 'Misrepresentation',
  REPEATED_CANCELLATION: 'Repeated cancellation',
  NO_SHOW: 'No-show',
  SAFETY_CONCERN: 'Safety concern',
  HARASSMENT: 'Harassment',
  OTHER: 'Other',
};
const STATUS: Record<ModerationReport['status'], { text: string; status: BadgeStatus }> = {
  OPEN: { text: 'Open', status: 'warning' },
  INVESTIGATING: { text: 'Investigating', status: 'info' },
  RESOLVED: { text: 'Resolved', status: 'success' },
  DISMISSED: { text: 'Dismissed', status: 'neutral' },
};
const URGENT: ModerationReport['category'][] = ['SAFETY_CONCERN', 'HARASSMENT'];

type Queue = 'OPEN' | 'RESOLVED' | 'DISMISSED';

interface ModerationTabProps {
  reports: ModerationReport[];
  /** Members the admin may already see (empty without resident access); used only for names */
  members: AdminMember[];
  loading: boolean;
  notify: Notify;
  onChanged: () => void;
}

/** The safety report queue: open reports first, with the actions the API supports */
export function ModerationTab({ reports, members, loading, notify, onChanged }: ModerationTabProps) {
  const [queue, setQueue] = useState<Queue>('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.user.fullName ?? 'A resident';
  const inQueue = (r: ModerationReport, q: Queue) => (q === 'OPEN' ? r.status === 'OPEN' || r.status === 'INVESTIGATING' : r.status === q);
  const shown = reports
    .filter((r) => inQueue(r, queue))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const updateReport = async (reportId: string, status: 'RESOLVED' | 'DISMISSED', notes: string) => {
    setBusyId(reportId);
    try {
      const res = await apiFetch('/api/v1/moderation/reports', {
        method: 'PATCH',
        json: { reportId, status, resolutionNotes: notes || undefined },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(
          data.autoSuspended
            ? 'Report upheld. This resident now has 3 upheld reports and has been suspended; reactivate them under Residents if needed.'
            : `Report ${status === 'RESOLVED' ? 'resolved' : 'dismissed'}.`
        );
        setResolvingId(null);
        setResolutionText('');
        onChanged();
      } else {
        notify(await apiErrorMessage(res, 'Could not update the report'), 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-support text-ink-muted">Reports are confidential: the reported resident is never told who reported them.</p>

      <SegmentedTabs
        label="Report queue"
        idBase="reports"
        value={queue}
        onChange={setQueue}
        options={(['OPEN', 'RESOLVED', 'DISMISSED'] as Queue[]).map((q) => ({
          value: q,
          label: q === 'OPEN' ? 'Open' : q === 'RESOLVED' ? 'Resolved' : 'Dismissed',
          count: loading ? undefined : reports.filter((r) => inQueue(r, q)).length,
        }))}
        className="sm:max-w-md"
      />

      <TabPanel idBase="reports" value={queue}>
        {loading ? (
          <SkeletonCard label="Loading reports" lines={3} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={queue === 'OPEN' ? 'No open reports' : `No ${queue.toLowerCase()} reports`}
            description={queue === 'OPEN' ? 'Nothing needs your review right now.' : undefined}
          />
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {shown.map((report) => {
              const notesId = `resolution-${report.id}`;
              const earlier = reports.filter((r) => r.reportedUserId === report.reportedUserId && r.id !== report.id);
              const upheld = earlier.filter((r) => r.status === 'RESOLVED').length;
              return (
                <li key={report.id} className="min-w-0">
                  <Card as="article" className="grid gap-3 h-full content-between">
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={URGENT.includes(report.category) ? 'danger' : 'neutral'}>{CATEGORY[report.category]}</Badge>
                        <Badge status={STATUS[report.status].status}>{STATUS[report.status].text}</Badge>
                        <span className="ml-auto text-meta text-ink-muted">{dateFormatter.format(new Date(report.createdAt))}</span>
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-support">
                        <dt className="text-ink-muted">About</dt>
                        <dd className="font-semibold text-ink">{nameOf(report.reportedUserId)}</dd>
                        <dt className="text-ink-muted">From</dt>
                        <dd className="text-ink">{nameOf(report.reporterId)}</dd>
                        {report.journeyId && (
                          <>
                            <dt className="text-ink-muted">Where</dt>
                            <dd className="text-ink">A shared ride</dd>
                          </>
                        )}
                      </dl>
                      <blockquote className="p-3 rounded-control bg-sunken text-support text-ink whitespace-pre-line">{report.description}</blockquote>
                      {earlier.length > 0 && (
                        <p className="flex items-center gap-2 text-meta text-ink-muted">
                          <History className="w-4 h-4 shrink-0" aria-hidden="true" />
                          {earlier.length} other report{earlier.length > 1 ? 's' : ''} about this resident
                          {upheld ? `, ${upheld} upheld` : ''}
                        </p>
                      )}
                      {report.resolutionNotes && (
                        <p className="p-3 rounded-control bg-success-bg text-support text-ink">
                          <span className="font-semibold">Note: </span>
                          {report.resolutionNotes}
                        </p>
                      )}
                    </div>

                    {(report.status === 'OPEN' || report.status === 'INVESTIGATING') && (
                      <div className="pt-3 border-t border-line grid gap-2">
                        {resolvingId === report.id ? (
                          <>
                            <Textarea
                              id={notesId}
                              label="What was done"
                              hint="Resolving upholds the report. Three upheld reports suspend the resident automatically."
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              placeholder="e.g. Spoke to both residents; warned about cancellations"
                              maxLength={1000}
                              rows={3}
                            />
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setResolvingId(null);
                                  setResolutionText('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button loading={busyId === report.id} onClick={() => updateReport(report.id, 'RESOLVED', resolutionText)}>
                                Resolve and uphold
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              variant="secondary"
                              loading={busyId === report.id}
                              onClick={() => updateReport(report.id, 'DISMISSED', 'Reviewed and dismissed')}
                            >
                              Dismiss
                            </Button>
                            <Button onClick={() => setResolvingId(report.id)}>Resolve…</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </TabPanel>
    </div>
  );
}
