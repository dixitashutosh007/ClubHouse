'use client';

import { useState } from 'react';
import { CircleDot } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { SegmentedTabs, TabPanel } from '@/components/ui/Tabs';
import type { CircleView } from '@/lib/services/circles';
import { CircleCard } from '../_components/CircleCard';

type Tab = 'joined' | 'managing' | 'requests';

const EMPTY: Record<Tab, { title: string; description: string }> = {
  joined: { title: 'You have not joined a circle yet', description: 'Find one for a sport, hobby or interest.' },
  managing: { title: 'You do not run a circle', description: 'Start one and invite your neighbours.' },
  requests: { title: 'No requests', description: 'Circles you ask to join show here until the admins answer.' },
};

/** Circles you belong to, run, or have asked to join */
export default function MyCirclesPage() {
  const { society, activePersona } = useAuth();
  const { data, loading, error, reload } = useApiData(
    '/api/v1/circles?view=mine',
    (json) => (json as { circles?: CircleView[] }).circles ?? [],
    'Could not load your circles.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const circles = data ?? [];
  const lists: Record<Tab, CircleView[]> = {
    // Run by you: owner or co-admin, including circles still waiting for approval
    managing: circles.filter((c) => c.viewer.role === 'OWNER' || c.viewer.role === 'CO_ADMIN'),
    joined: circles.filter((c) => c.viewer.role === 'MEMBER' && c.status !== 'CLOSED'),
    requests: circles.filter((c) => c.viewer.status === 'REQUESTED' || c.viewer.status === 'REJECTED'),
  };
  const [picked, setPicked] = useState<Tab | null>(null);
  // Start on the first tab that has something in it
  const tab: Tab = picked ?? ((['managing', 'joined', 'requests'] as Tab[]).find((t) => lists[t].length) || 'joined');

  return (
    <PageContainer width="wide" className="grid gap-5">
      <ModuleHeader module="community" title="My circles" description="Circles you belong to, run or asked to join" />
      <SegmentedTabs
        label="My circles"
        tone="community"
        idBase="my-circles"
        value={tab}
        onChange={setPicked}
        options={[
          { value: 'joined', label: 'Joined', count: lists.joined.length },
          { value: 'managing', label: 'Running', count: lists.managing.length },
          { value: 'requests', label: 'Requests', count: lists.requests.length },
        ]}
      />
      <TabPanel idBase="my-circles" value={tab}>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
            <SkeletonCard label="Loading your circles" lines={3} />
            <SkeletonCard label="Loading your circles" lines={3} />
          </div>
        ) : error ? (
          <LoadError message={error} onRetry={reload} />
        ) : lists[tab].length === 0 ? (
          <EmptyState
            icon={CircleDot}
            tone="community"
            title={EMPTY[tab].title}
            description={EMPTY[tab].description}
            action={
              <Button tone="community" href={tab === 'managing' ? '/circles/create' : '/circles'}>
                {tab === 'managing' ? 'Create a circle' : 'Browse circles'}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
            {lists[tab].map((c) => (
              <li key={c.id} className="min-w-0">
                <CircleCard circle={c} />
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
    </PageContainer>
  );
}
