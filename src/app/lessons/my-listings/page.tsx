'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ConfirmDialog } from '@/components/ui/Dialog';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { ClassListing, ClassType, LocationType } from '@/types';
import { formatIstDay, istDateOf } from '@/lib/utils/time';

const CLASS_TYPE_LABEL: Record<ClassType, string> = { REGULAR: 'Regular', ONE_TIME: 'One-time', FESTIVE: 'Festive' };
const LOCATION_LABEL: Record<LocationType, string> = { CLUBHOUSE: 'Club House', FLAT: 'Teacher’s flat', OTHER: 'In the society' };
const FEE_SUFFIX = { FREE: '', PER_SESSION: ' / session', PER_MONTH: ' / month', PER_COURSE: ' / course' } as const;

function feeLabel(cls: ClassListing): string {
  if (cls.feeType === 'FREE' || !cls.feeAmount) return 'Free';
  return `₹${cls.feeAmount.toLocaleString('en-IN')}${FEE_SUFFIX[cls.feeType]}`;
}

export default function MyListingsPage() {
  const { society, activePersona } = useAuth();
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    data,
    loading,
    reload: loadMyClasses,
  } = useApiData(
    '/api/v1/lessons?mine=true',
    (json) => (json as { classes: ClassListing[] }).classes ?? [],
    'Could not load your classes.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const classes = data ?? [];

  const handleStatusAction = async (listingId: string, action: string) => {
    try {
      setUpdatingId(listingId);
      const res = await apiFetch('/api/v1/lessons', { method: 'PATCH', json: { listingId, action } });
      if (res.ok) {
        const { listing } = await res.json();
        setMessage(
          listing?.status === 'PENDING_APPROVAL'
            ? 'Sent to your society admin for review.'
            : `Class updated: ${action.replace('_', ' ').toLowerCase()}`
        );
        loadMyClasses();
      } else {
        setMessage(await apiErrorMessage(res, 'Could not update the class.'));
      }
      setTimeout(() => setMessage(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (listingId: string) => {
    try {
      setUpdatingId(listingId);
      const res = await apiFetch(`/api/v1/lessons?id=${listingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage('Class deleted successfully');
        loadMyClasses();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 pb-6">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/lessons"
              aria-label="Back to Classes"
              className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                My Posted Classes
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Tutor Dashboard · {society?.name}
              </p>
            </div>
          </div>

          <Link
            href="/lessons/create"
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-700 text-white hover:bg-purple-800 transition-all flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Post Class</span>
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full flex-1">
        {message && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-medium animate-fade-in flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-600">Loading your listings...</div>
        ) : classes.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <GraduationCap className="w-10 h-10 text-purple-400 mx-auto mb-2" />
            <h3 className="font-extrabold text-slate-900 text-sm">You haven&apos;t posted any classes yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Share your skills with co-residents! Post yoga, music, piano, coding, or tuition classes.
            </p>
            <div className="mt-5">
              <Link
                href="/lessons/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Post Your First Class</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((cls) => {
              const isPending = cls.status === 'PENDING_APPROVAL';
              const isActive = cls.status === 'ACTIVE';
              const isFull = cls.status === 'FULL';
              const isDeactivated = cls.status === 'DEACTIVATED';
              const isRejected = cls.status === 'REJECTED';

              return (
                <div
                  key={cls.id}
                  className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900">{cls.subject}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-800'
                              : isFull
                              ? 'bg-blue-100 text-blue-800'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isActive
                            ? 'Live & Active'
                            : isPending
                            ? 'Awaiting Approval'
                            : isFull
                            ? 'Batch Full'
                            : isRejected
                            ? 'Declined by Admin'
                            : 'Deactivated'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {CLASS_TYPE_LABEL[cls.classType]} · {feeLabel(cls)} · {cls.locationDetail || LOCATION_LABEL[cls.locationType]}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/lessons/edit/${encodeURIComponent(cls.id)}`}
                        aria-label={`Edit ${cls.subject} class`}
                        className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-violet-800 hover:bg-violet-50 rounded-xl transition-colors"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(cls.id)}
                        disabled={updatingId === cls.id}
                        aria-label={`Delete ${cls.subject} class`}
                        className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3">
                    {cls.description}
                  </p>

                  {isRejected && cls.rejectionReason && (
                    <div className="p-2.5 bg-rose-50 rounded-xl text-[11px] text-rose-800 border border-rose-200">
                      <strong>Admin note:</strong> {cls.rejectionReason}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-600">Posted {formatIstDay(istDateOf(cls.createdAt))}</span>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <>
                          <button
                            onClick={() => handleStatusAction(cls.id, 'MARK_FULL')}
                            disabled={updatingId === cls.id}
                            className="px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium text-[11px]"
                          >
                            Mark as Full
                          </button>
                          <button
                            onClick={() => handleStatusAction(cls.id, 'DEACTIVATE')}
                            disabled={updatingId === cls.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-[11px]"
                          >
                            Deactivate
                          </button>
                        </>
                      )}

                      {isFull && (
                        <>
                          <button
                            onClick={() => handleStatusAction(cls.id, 'REACTIVATE')}
                            disabled={updatingId === cls.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 font-medium text-[11px]"
                          >
                            Re-open Batch
                          </button>
                          <button
                            onClick={() => handleStatusAction(cls.id, 'DEACTIVATE')}
                            disabled={updatingId === cls.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-[11px]"
                          >
                            Deactivate
                          </button>
                        </>
                      )}

                      {isDeactivated && (
                        <button
                          onClick={() => handleStatusAction(cls.id, 'REACTIVATE')}
                          disabled={updatingId === cls.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 font-medium text-[11px]"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this class?"
        description="Residents will no longer see it. This cannot be undone."
        confirmLabel="Delete class"
        destructive
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) void handleDelete(id);
        }}
      />
    </div>
  );
}
