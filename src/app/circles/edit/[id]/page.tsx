'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { CircleDot } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError, Loading } from '@/components/ui/LoadState';
import { EmptyState } from '@/components/ui/States';
import type { CircleView } from '@/lib/services/circles';
import { CircleEditor } from '../../_components/CircleEditor';

/** Edit a circle you run (owner, co-admin or society admin) */
export default function EditCirclePage() {
  return (
    <Suspense fallback={<Loading label="Loading the circle…" />}>
      <EditCircle />
    </Suspense>
  );
}

function EditCircle() {
  const { id } = useParams<{ id: string }>();
  const { activePersona, society } = useAuth();
  const { data, error, loading, reload } = useApiData(
    `/api/v1/circles?id=${encodeURIComponent(id)}`,
    (json) => (json as { circle?: CircleView }).circle ?? null,
    'Could not load the circle.',
    `${activePersona}:${society?.id ?? ''}`
  );

  if (loading) return <Loading label="Loading the circle…" />;
  if (error && !error.includes('not found')) return <LoadError message={error} onRetry={reload} />;
  if (!data || !data.viewer.canManage || data.status === 'CLOSED' || data.status === 'REJECTED') {
    return (
      <PageContainer width="narrow">
        <EmptyState
          icon={CircleDot}
          tone="community"
          title="You can't edit this circle"
          description="Only the circle's owner and co-admins can edit an open circle."
          action={
            <Button tone="community" href="/circles/mine">
              Back to My circles
            </Button>
          }
        />
      </PageContainer>
    );
  }
  return <CircleEditor key={data.id} existing={data} />;
}
