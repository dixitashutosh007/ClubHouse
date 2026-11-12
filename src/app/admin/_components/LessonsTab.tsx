'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Notify } from './types';
import { ClassListing } from '@/types';

interface LessonsTabProps {
  notify: Notify;
}

export function LessonsTab({ notify }: LessonsTabProps) {
  const [pendingClasses, setPendingClasses] = useState<ClassListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/lessons?pending=true');
      if (res.ok) {
        const data = await res.json();
        setPendingClasses(data.classes ?? []);
      }
    } catch {
      notify('Could not load pending classes', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const handleAction = async (listingId: string, action: 'APPROVE' | 'REJECT') => {
    setActioningId(listingId);
    try {
      const res = await apiFetch('/api/v1/lessons', {
        method: 'PATCH',
        json: {
          listingId,
          action,
          reason: action === 'REJECT' ? 'Declined by society admin' : undefined,
        },
      });
      if (res.ok) {
        notify(action === 'APPROVE' ? 'Class approved and published.' : 'Class listing declined.');
        await loadPending();
      } else {
        const data = await res.json().catch(() => null);
        notify(data?.error ?? 'Action failed', 'error');
      }
    } catch {
      notify('Action failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-zinc-400">Loading pending classes...</div>;
  }

  if (pendingClasses.length === 0) {
    return (
      <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
        <GraduationCap className="w-8 h-8 text-purple-500 mx-auto mb-2" />
        <p className="text-xs font-semibold text-zinc-700">No classes awaiting approval</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          All resident class submissions have been processed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingClasses.map((cls) => (
        <div
          key={cls.id}
          className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-2xs space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-zinc-900">{cls.subject}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  {cls.classType}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Awaiting Approval
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tutor: <span className="font-bold text-zinc-800">{cls.contactName}</span> (Flat {cls.creatorFlat || 'N/A'}) • {cls.contactPhone}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-bold text-emerald-700 block">
                {cls.feeType === 'FREE' ? 'Free' : `₹${cls.feeAmount} (${cls.feeType.replace('_', ' ')})`}
              </span>
              <span className="text-[10px] text-zinc-400">
                {cls.trialAvailable ? 'Trial Available' : 'No Trial'}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-700 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 leading-relaxed">
            &ldquo;{cls.description}&rdquo;
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-zinc-600 bg-zinc-50/50 p-2.5 rounded-xl border border-zinc-100">
            <div>
              <span className="text-zinc-400 block text-[10px]">Location:</span>
              <span className="font-semibold text-zinc-800 truncate block">
                {cls.locationDetail || cls.locationType}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Schedule:</span>
              <span className="font-semibold text-zinc-800 truncate block">
                {cls.scheduleDays ? cls.scheduleDays.join(', ') : 'Flexible'}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Timing:</span>
              <span className="font-semibold text-zinc-800 truncate block">
                {cls.startTime || 'Flexible'} {cls.durationMinutes ? `(${cls.durationMinutes}m)` : ''}
              </span>
            </div>
          </div>

          {cls.photoUrl && (
            <img
              src={cls.photoUrl}
              alt={cls.subject}
              className="max-h-36 rounded-xl border border-zinc-200 object-cover"
            />
          )}

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={() => handleAction(cls.id, 'REJECT')}
              disabled={actioningId === cls.id}
              className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5 inline mr-1" />
              <span>Reject</span>
            </button>
            <button
              onClick={() => handleAction(cls.id, 'APPROVE')}
              disabled={actioningId === cls.id}
              className="px-4 py-1.5 rounded-xl bg-purple-700 text-white hover:bg-purple-800 font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Class</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
