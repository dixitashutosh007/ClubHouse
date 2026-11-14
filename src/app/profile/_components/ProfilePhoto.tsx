'use client';

import { useId, useState } from 'react';
import { Camera } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { downscaleImage } from '@/lib/utils/image';

/** Add, change or remove your profile photo (shown to ride partners once both agree) */
export function ProfilePhoto({
  name,
  photoUrl,
  onSaved,
}: {
  name: string;
  photoUrl?: string;
  onSaved: () => Promise<void>;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (profilePhotoUrl: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/v1/auth/me', { method: 'PUT', json: { profilePhotoUrl } });
      if (res.ok) await onSaved();
      else setError(await apiErrorMessage(res, 'Could not save the photo.'));
    } catch {
      setError('Connection problem. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPEG, PNG or WebP).');
      return;
    }
    try {
      await save(await downscaleImage(file, 256, 0.8));
    } catch {
      setError('Could not read this photo. Please choose another.');
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} photoUrl={photoUrl} size={72} />
      <div className="grid gap-2 min-w-0">
        <p className="font-display text-section font-bold text-ink truncate">{name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-control border border-line-strong bg-surface text-support font-semibold text-ink cursor-pointer hover:bg-sunken focus-within:ring-3 focus-within:ring-terracotta/30 ${busy ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            {busy ? 'Saving…' : photoUrl ? 'Change photo' : 'Add photo'}
          </label>
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          {photoUrl && (
            <Button variant="ghost" className="text-danger" disabled={busy} onClick={() => void save('')}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-meta text-ink-muted">Neighbours see it only after you both agree to share a ride.</p>
        {error && (
          <p role="alert" className="text-meta font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
