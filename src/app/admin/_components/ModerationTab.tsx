'use client';

import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { ModerationReport, Notify } from './types';

const dateFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });

interface ModerationTabProps {
  reports: ModerationReport[];
  loading: boolean;
  notify: Notify;
  onChanged: () => void;
}

export function ModerationTab({ reports, loading, notify, onChanged }: ModerationTabProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const updateReport = async (reportId: string, status: 'RESOLVED' | 'DISMISSED', notes: string) => {
    const res = await apiFetch('/api/v1/moderation/reports', {
      method: 'PATCH',
      json: { reportId, status, resolutionNotes: notes || undefined },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      notify(
        data.autoSuspended
          ? `Report upheld. This resident now has 3 upheld reports and has been suspended; reactivate them under Residents if needed.`
          : `Report marked as ${status.toLowerCase()}.`
      );
      setResolvingId(null);
      setResolutionText('');
      onChanged();
    } else {
      notify(await apiErrorMessage(res, 'Could not update the report'), 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 mb-3 text-xs text-zinc-600">
        <span className="font-semibold text-zinc-900 block mb-0.5">Community Safety Reports</span>
        Review resident complaints, reported no-shows, and safety concerns confidentially.
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-zinc-500" role="status">
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-xs font-semibold text-zinc-700">No moderation reports</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Your society carpool community is in good standing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const notesId = `resolution-${report.id}`;
            return (
              <div key={report.id} className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900">{report.category.replace(/_/g, ' ')}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          report.status === 'OPEN' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Reported on {dateFormatter.format(new Date(report.createdAt))}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-700 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 leading-relaxed">
                  &ldquo;{report.description}&rdquo;
                </p>

                {report.resolutionNotes && (
                  <div className="p-2 bg-emerald-50 rounded-lg text-[11px] text-emerald-800">
                    <span className="font-semibold block">Resolution note:</span>
                    {report.resolutionNotes}
                  </div>
                )}

                {report.status === 'OPEN' && (
                  <div className="pt-2 border-t border-zinc-100 space-y-2">
                    {resolvingId === report.id ? (
                      <div className="space-y-2">
                        <label htmlFor={notesId} className="sr-only">
                          Resolution note
                        </label>
                        <textarea
                          id={notesId}
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="Add action taken / resolution note..."
                          maxLength={1000}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateReport(report.id, 'RESOLVED', resolutionText)}
                            className="flex-1 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
                          >
                            Confirm Resolved
                          </button>
                          <button
                            onClick={() => {
                              setResolvingId(null);
                              setResolutionText('');
                            }}
                            className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-semibold rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => updateReport(report.id, 'DISMISSED', 'Reviewed and dismissed')}
                          className="px-3 py-1 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => setResolvingId(report.id)}
                          className="px-3 py-1 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800"
                        >
                          Resolve Report
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
