'use client';

import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { ConfirmDialog } from '@/components/ui/Dialog';

/**
 * Hide a neighbour from RideShare: neither of you sees the other's rides or
 * requests. They are not told; it can be undone from Profile.
 */
export function HideResidentButton({
  userId,
  name,
  onHidden,
}: {
  userId: string;
  name: string;
  onHidden: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const hide = async () => {
    setConfirming(false);
    const res = await apiFetch('/api/v1/hidden-residents', { method: 'POST', json: { userId } });
    if (res.ok) onHidden();
    else setError(await apiErrorMessage(res, 'Could not hide this resident.'));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Hide ${name}`}
        className="p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100"
      >
        <EyeOff className="w-4 h-4" aria-hidden="true" />
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-rose-700">
          {error}
        </span>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Hide ${name}?`}
        description="You won't see each other's rides or requests. They aren't told. You can undo this in your profile."
        confirmLabel="Hide"
        cancelLabel="Keep"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void hide()}
      />
    </>
  );
}
