'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import React, { Suspense, useState } from 'react';
import { CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, Textarea } from '@/components/ui/Field';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState } from '@/components/ui/States';
import { cn } from '@/components/ui/cn';

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
        setTimeout(() => router.push('/rides'), 1200);
      } else {
        setError(await apiErrorMessage(res, 'Could not submit feedback. Please try again.'));
      }
    } catch {
      setError('Connection problem. Please try again.');
    }
  };

  return (
    <PageContainer width="narrow" className="grid gap-5">
      <ModuleHeader module="ride" title="How was your commute?" description={`Feedback for ${otherName}`} backHref="/rides" backLabel="Back to RideShare" />

      {!journeyId || !toUserId ? (
        <EmptyState
          icon={MessageSquareHeart}
          tone="ride"
          title="Choose a ride first"
          description="Feedback is left for a specific shared ride."
          action={
            <Button tone="ride" href="/rides/my-requests">
              Go to my rides
            </Button>
          }
        />
      ) : submitted ? (
        <Card padding="lg" className="grid justify-items-center text-center gap-3 py-12">
          <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </span>
          <h2 role="status" className="font-display text-section font-bold text-ink">Thank you!</h2>
          <p className="text-support text-ink-muted max-w-sm">Your feedback helps keep shared commutes in your society reliable and respectful.</p>
        </Card>
      ) : (
        <Card as="section" padding="lg">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <Select id="outcome" label="How did the ride go?" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="COMPLETED">Ride completed</option>
              <option value="DRIVER_CANCELLED">The offering resident cancelled</option>
              <option value="PASSENGER_CANCELLED">The passenger cancelled</option>
              <option value="PASSENGER_NO_SHOW">The passenger did not arrive</option>
              <option value="DRIVER_NO_SHOW">The offering resident did not arrive</option>
              <option value="OTHER">Other</option>
            </Select>

            <fieldset className="grid gap-2">
              <legend className="text-support font-semibold text-ink">What went well?</legend>
              <p className="text-meta text-ink-muted -mt-1">Choose any that apply. There are no star ratings.</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={isSelected}
                      className={cn(
                        'min-h-11 px-4 rounded-full text-support font-medium border transition-colors',
                        isSelected ? 'bg-ride-deep border-ride-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink hover:bg-sunken'
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Textarea
              id="private-note"
              label="Private note (optional)"
              hint="Only the society's moderation team sees this."
              maxLength={500}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you would like to share privately?"
            />

            {error && (
              <div role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
                {error}
              </div>
            )}

            <Button type="submit" tone="ride" size="lg" fullWidth>
              Submit feedback
            </Button>
          </form>
        </Card>
      )}
    </PageContainer>
  );
}
