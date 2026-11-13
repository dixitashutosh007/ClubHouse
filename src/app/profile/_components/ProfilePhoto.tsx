'use client';

import { useId, useState } from 'react';
import { Camera } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
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
    <div className="flex items-center gap-4 mb-5">
      <Avatar name={name} photoUrl={photoUrl} size={64} />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label
            htmlFor={inputId}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50 ${busy ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            {photoUrl ? 'Change photo' : 'Add photo'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          {photoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save('')}
              className="text-xs font-semibold text-rose-700 underline"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-600">Neighbours see it only after you both agree to share a ride.</p>
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
