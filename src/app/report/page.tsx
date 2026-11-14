'use client';

import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import React, { Suspense, useState } from 'react';
import { CheckCircle2, Flag, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, Textarea } from '@/components/ui/Field';
import { PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState } from '@/components/ui/States';

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
    <PageContainer width="narrow" className="grid gap-5">
      <ModuleHeader module="ride" title="Report an issue" description={`Confidential report about ${reportedName}`} backHref="/rides" backLabel="Back to RideShare" />

      {!reportedUserId ? (
        <EmptyState
          icon={Flag}
          tone="ride"
          title="Choose a resident first"
          description="Reports are made about a specific resident, from one of your rides."
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
          <h2 role="status" className="font-display text-section font-bold text-ink">Report received</h2>
          <p className="text-support text-ink-muted max-w-sm">Your society admins will review it confidentially.</p>
        </Card>
      ) : (
        <Card as="section" padding="lg">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <p className="flex items-start gap-2 p-3 rounded-control bg-info-bg text-support text-ink">
              <ShieldAlert className="w-5 h-5 text-info shrink-0" aria-hidden="true" />
              {reportedName} is not told who reported them. In an emergency, call 112.
            </p>
            <Select id="category" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="INAPPROPRIATE_BEHAVIOUR">Inappropriate behaviour</option>
              <option value="MISREPRESENTATION">Misrepresentation</option>
              <option value="REPEATED_CANCELLATION">Repeated cancellation</option>
              <option value="NO_SHOW">No-show</option>
              <option value="SAFETY_CONCERN">Safety concern</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="OTHER">Other</option>
            </Select>

            <Textarea
              id="description"
              label="What happened?"
              required
              minLength={5}
              maxLength={1000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, with the date and place if you can."
            />

            {error && (
              <div role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
                {error}
              </div>
            )}

            <Button type="submit" variant="danger" size="lg" fullWidth>
              Submit confidential report
            </Button>
          </form>
        </Card>
      )}
    </PageContainer>
  );
}
