import React from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorState } from './States';

/** Inline "loading" indicator announced to screen readers (see also Skeleton) */
export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="py-12 flex items-center justify-center gap-2 text-support text-ink-muted">
      <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Failed-to-load message with a retry button */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ErrorState message={message} onRetry={onRetry} />;
}
