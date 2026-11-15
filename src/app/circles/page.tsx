'use client';

import { useState } from 'react';
import { CircleDot, Plus, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { cn } from '@/components/ui/cn';
import type { CircleView } from '@/lib/services/circles';
import { CircleCard } from './_components/CircleCard';

/** Every live circle in the society, with search and type filters */
export default function CirclesBrowsePage() {
  const { society, activePersona } = useAuth();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const { data, loading, error, reload } = useApiData(
    '/api/v1/circles',
    (json) => (json as { circles?: CircleView[] }).circles ?? [],
    'Could not load circles.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const circles = data ?? [];
  // Only types that have a circle right now
  const types = [...new Set(circles.map((c) => c.type))].sort((a, b) => a.localeCompare(b));
  const q = query.trim().toLowerCase();
  const shown = circles.filter(
    (c) =>
      (type === 'ALL' || c.type === type) &&
      (!q || [c.name, c.description, c.type, c.subType, c.place, c.schedule].some((v) => v?.toLowerCase().includes(q)))
  );

  const chip = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={cn(
        'min-h-11 px-4 rounded-full border text-support font-semibold whitespace-nowrap transition-colors',
        type === value
          ? 'bg-community-deep border-community-deep text-ink-inverse'
          : 'bg-surface border-line-strong text-ink hover:bg-sunken'
      )}
    >
      {label}
    </button>
  );

  return (
    <PageContainer width="wide" className="grid gap-5">
      <ModuleHeader
        module="community"
        description="Groups for sports, hobbies and more in your society"
        action={
          <Button tone="community" size="sm" href="/circles/create" icon={Plus} className="hidden sm:inline-flex">
            Create a circle
          </Button>
        }
      />

      <div className="relative">
        <Search aria-hidden="true" className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search circles"
          placeholder="Search circles, places or times"
          className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-community/30 focus:border-community-deep"
        />
      </div>

      {types.length > 1 && (
        <div role="group" aria-label="Circle type" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap">
          {chip('ALL', 'All')}
          {types.map((t) => chip(t, t))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
          <SkeletonCard label="Loading circles" lines={3} />
          <SkeletonCard label="Loading circles" lines={3} />
          <SkeletonCard label="Loading circles" lines={3} />
        </div>
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          tone="community"
          title={circles.length ? 'No circles match your search' : 'No circles yet'}
          description={circles.length ? 'Try another word or type.' : 'Start one for a sport, hobby or interest you share with neighbours.'}
          action={
            circles.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setType('ALL');
                }}
              >
                Show all circles
              </Button>
            ) : (
              <Button tone="community" href="/circles/create">
                Create a circle
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
          {shown.map((c) => (
            <li key={c.id} className="min-w-0">
              <CircleCard circle={c} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
