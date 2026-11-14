import React from 'react';
import { AlertTriangle, RotateCcw, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { MODULE_THEMES, type ModuleId } from '@/lib/design/modules';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** One sentence at most */
  description?: string;
  /** The one thing to do next */
  action?: React.ReactNode;
  tone?: ModuleId;
  className?: string;
}

/** Nothing to show yet: an icon in the module tint, one line, one action */
export function EmptyState({ icon: Icon, title, description, action, tone = 'home', className }: EmptyStateProps) {
  const theme = MODULE_THEMES[tone];
  return (
    <div className={cn('flex flex-col items-center text-center gap-3 py-10 px-6 rounded-card border border-dashed border-line bg-surface/60', className)}>
      <span className={cn('w-14 h-14 rounded-full flex items-center justify-center', theme.tint, theme.text)}>
        <Icon className="w-7 h-7" aria-hidden="true" />
      </span>
      <div className="grid gap-1 max-w-sm">
        <p className="font-display text-card font-bold text-ink">{title}</p>
        {description && <p className="text-support text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  /** What went wrong, in plain words */
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** Something failed: say what, offer a retry. Announced to screen readers. */
export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 p-4 rounded-card border border-danger/30 bg-danger-bg', className)}>
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
      <div className="grid gap-2 min-w-0">
        <p className="text-support text-ink">{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry} className="justify-self-start">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

/** A grey placeholder block shaped like the content that is loading */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-control bg-sunken animate-pulse motion-reduce:animate-none', className)} />;
}

/** A card-shaped loading placeholder, with a screen-reader message */
export function SkeletonCard({ label = 'Loading', lines = 2 }: { label?: string; lines?: number }) {
  return (
    <div role="status" className="rounded-card border border-line bg-surface p-4 grid gap-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}
