'use client';

import { useState } from 'react';
import { Check, Heart } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';

interface JoinCircleButtonProps {
  circleId: string;
  circleName: string;
  joinMode: 'APPROVAL' | 'OPEN';
  /** After a successful join or request: 'APPROVED' (open circle) or 'REQUESTED' */
  onJoined?: (status: 'APPROVED' | 'REQUESTED') => void;
  className?: string;
}

/**
 * "I'm interested" (or "Join circle" for an open circle) wherever a circle is
 * shown in a list. After tapping it says what happened, in place.
 */
export function JoinCircleButton({ circleId, circleName, joinMode, onJoined, className }: JoinCircleButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'APPROVED' | 'REQUESTED' | null>(null);

  if (done) {
    return (
      <p role="status" className={cn('min-h-9 flex items-center gap-1.5 text-support font-semibold text-community-deep', className)}>
        <Check className="w-4 h-4" aria-hidden="true" />
        {done === 'APPROVED' ? 'You joined' : 'Request sent'}
      </p>
    );
  }

  const join = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/v1/circles/members', { method: 'POST', json: { circleId } });
      if (!res.ok) return toast.show(await apiErrorMessage(res, 'Could not send your request.'), 'error');
      const status = ((await res.json()) as { status?: 'APPROVED' | 'REQUESTED' }).status ?? 'REQUESTED';
      setDone(status);
      toast.show(status === 'APPROVED' ? `You joined ${circleName}` : `Request sent to the admins of ${circleName}`, 'success');
      onJoined?.(status);
    } catch {
      toast.show('Connection problem. Check your internet and try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      tone="community"
      icon={Heart}
      loading={busy}
      onClick={() => void join()}
      aria-label={`${joinMode === 'OPEN' ? 'Join' : "I'm interested in"} ${circleName}`}
      className={className}
    >
      {joinMode === 'OPEN' ? 'Join circle' : "I'm interested"}
    </Button>
  );
}
