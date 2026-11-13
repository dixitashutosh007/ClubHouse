'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import React, { Suspense, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportForm />
    </Suspense>
  );
}

// Opened from a ride or profile: ?userId=…&journeyId=…&name=…
function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reportedUserId = params.get('userId');
  const journeyId = params.get('journeyId') ?? undefined;
  const reportedName = params.get('name') || 'this resident';
  const [error, setError] = useState('');

  const [category, setCategory] = useState('INAPPROPRIATE_BEHAVIOUR');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch('/api/v1/moderation/reports', {
        json: { reportedUserId, journeyId, category, description },
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => router.push('/rides'), 1200);
      } else {
        setError(await apiErrorMessage(res, 'Could not submit the report. Please try again.'));
      }
    } catch {
      setError('Connection problem. Please try again.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/rides"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Report an Issue</h1>
          <p className="text-xs text-zinc-500">Confidential report about {reportedName}</p>
        </div>
      </div>

      {!reportedUserId ? (
        <div className="my-auto text-center py-12 px-6 text-xs text-zinc-600 space-y-3">
          <p>Reports are made about a specific resident, from one of your rides.</p>
          <Link href="/rides/my-requests" className="inline-block px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold">
            Go to my rides
          </Link>
        </div>
      ) : submitted ? (
        <div className="my-auto text-center py-12 px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Report Received</h2>
          <p className="text-xs text-zinc-500">
            Society administrators have received your report and will review it confidentially.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <div>
            <label htmlFor="category" className="text-xs font-semibold text-zinc-700 block mb-1">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white"
            >
              <option value="INAPPROPRIATE_BEHAVIOUR">Inappropriate Behaviour</option>
              <option value="MISREPRESENTATION">Misrepresentation</option>
              <option value="REPEATED_CANCELLATION">Repeated Cancellation</option>
              <option value="NO_SHOW">No-Show</option>
              <option value="SAFETY_CONCERN">Safety Concern</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="text-xs font-semibold text-zinc-700 block mb-1">
              Description of the Incident
            </label>
            <textarea
              id="description"
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details of what occurred..."
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:outline-hidden"
            />
          </div>

          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-rose-600 text-white font-semibold text-xs active:scale-98 transition-all hover:bg-rose-700"
            >
              Submit Confidential Report
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
