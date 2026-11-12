'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import React, { Suspense, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function QualitativeFeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  );
}

// Opened from a shared ride: ?journeyId=…&toUserId=…&name=…
function FeedbackForm() {
  const router = useRouter();
  const params = useSearchParams();
  const journeyId = params.get('journeyId');
  const toUserId = params.get('toUserId');
  const otherName = params.get('name') || 'your co-rider';
  const [error, setError] = useState('');

  const [outcome, setOutcome] = useState('COMPLETED');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const availableTags = [
    'Reliable & Punctual',
    'Comfortable Ride',
    'Good Communication',
    'Would Ride Together Again',
    'Smooth Driving',
    'Courteous & Respectful',
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch('/api/v1/rides/feedback', {
        json: { journeyId, toUserId, outcome, qualitativeTags: selectedTags, privateNote: note || undefined },
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => router.push('/'), 1200);
      } else {
        setError(await apiErrorMessage(res, 'Could not submit feedback. Please try again.'));
      }
    } catch {
      setError('Connection problem. Please try again.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">How was your commute?</h1>
          <p className="text-xs text-zinc-500">Feedback for {otherName}</p>
        </div>
      </div>

      {!journeyId || !toUserId ? (
        <div className="my-auto text-center py-12 px-6 text-xs text-zinc-600 space-y-3">
          <p>Feedback is left for a specific shared ride.</p>
          <Link href="/rides/my-requests" className="inline-block px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold">
            Go to my rides
          </Link>
        </div>
      ) : submitted ? (
        <div className="my-auto text-center py-12 px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Thank you!</h2>
          <p className="text-xs text-zinc-500">
            Your qualitative feedback helps foster a reliable and respectful society carpool community.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          {/* Journey Outcome */}
          <div>
            <label htmlFor="outcome" className="text-xs font-semibold text-zinc-700 block mb-1.5">Journey Outcome</label>
            <select
              id="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white"
            >
              <option value="COMPLETED">Ride Completed Successfully</option>
              <option value="DRIVER_CANCELLED">Ride was cancelled by the offering resident</option>
              <option value="PASSENGER_CANCELLED">Passenger Cancelled</option>
              <option value="PASSENGER_NO_SHOW">Passenger Did Not Arrive</option>
              <option value="DRIVER_NO_SHOW">Offering resident did not arrive</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Qualitative Tags (No 1-5 star ratings) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-700">Community Feedback Tags</label>
              <span className="text-[10px] text-zinc-500">Select all that apply</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label htmlFor="private-note" className="text-xs font-semibold text-zinc-700 block mb-1.5">
              Private Note (Optional)
            </label>
            <textarea
              id="private-note"
              maxLength={500}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you'd like to share privately with the community moderation team?"
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
              className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white font-semibold text-xs active:scale-98 transition-all hover:bg-zinc-800"
            >
              Submit Feedback
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
