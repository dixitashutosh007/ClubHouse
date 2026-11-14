'use client';

import { Suspense } from 'react';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/States';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { ClassListing } from '@/types';
import { ClassEditor } from '../../_components/ClassEditor';

/** Edit one of your own classes (the API also lets class approvers edit) */
export default function EditClassPage() {
  return (
    <Suspense fallback={<Loading label="Loading your class…" />}>
      <EditClass />
    </Suspense>
  );
}

function EditClass() {
  const { id } = useParams<{ id: string }>();
  const { activePersona, society } = useAuth();
  const { data, error, loading, reload } = useApiData(
    '/api/v1/lessons?mine=true',
    (json) => (json as { classes?: ClassListing[] }).classes ?? [],
    'Could not load your class.',
    `${activePersona}:${society?.id ?? ''}`
  );

  if (loading) return <Loading label="Loading your class…" />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const listing = data?.find((c) => c.id === id);
  if (!listing) {
    return (
      <PageContainer width="narrow">
        <EmptyState
          icon={GraduationCap}
          tone="classes"
          title="Class not found"
          description="This class was not found among your classes."
          action={
            <Button tone="classes" href="/lessons/my-listings">
              Back to My classes
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return <ClassEditor key={listing.id} existing={listing} />;
}
