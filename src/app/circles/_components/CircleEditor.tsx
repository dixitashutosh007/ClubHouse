'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, CircleDot, Link2, Lock, Save, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { downscaleImage } from '@/lib/utils/image';
import { MAX_CIRCLE_DESCRIPTION_WORDS, MAX_CLASS_PHOTO_CHARS } from '@/lib/validation/schemas';
import { countWords } from '@/lib/validation/words';
import { circleTypesFor } from '@/lib/circle-types';
import { MODULE_THEMES } from '@/lib/design/modules';
import type { CircleView } from '@/lib/services/circles';
import type { CircleAudience, CircleJoinMode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { FormSection, PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { OptionPicker } from '@/components/ui/OptionPicker';
import { cn } from '@/components/ui/cn';
import { CircleCard } from './CircleCard';

const ICON = cn(MODULE_THEMES.community.tint, MODULE_THEMES.community.text);
const OTHER = '__other__';

const AUDIENCES: { id: CircleAudience; label: string }[] = [
  { id: 'ALL', label: 'Everyone' },
  { id: 'WOMEN', label: 'Women only' },
  { id: 'MEN', label: 'Men only' },
  { id: 'KIDS', label: 'Kids' },
  { id: 'AGE_RANGE', label: 'Age range' },
];

function choiceClass(selected: boolean) {
  return cn(
    'min-h-11 px-4 rounded-full border text-support font-semibold transition-colors',
    selected ? 'bg-community-deep border-community-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink hover:bg-sunken'
  );
}

/** Start a circle, or edit one you run */
export function CircleEditor({ existing }: { existing?: CircleView }) {
  const router = useRouter();
  const { society, membership } = useAuth();
  const isEdit = Boolean(existing);
  const isSocietyAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
  // While a change waits for approval, edit that change rather than the live version
  const reviewed = existing?.pendingChange ?? existing;

  const baseTypes = circleTypesFor(society?.settings);
  // A circle keeps its type even if the society later removes it from the list
  const types =
    existing && !baseTypes.some((t) => t.name === existing.type) ? [{ name: existing.type, subTypes: [] }, ...baseTypes] : baseTypes;

  const [name, setName] = useState(reviewed?.name ?? '');
  const [type, setType] = useState(existing?.type ?? '');
  const subTypesOf = (t: string) => types.find((x) => x.name === t)?.subTypes ?? [];
  const existingCustom = Boolean(existing?.subType && (existing.isCustomSubType || !subTypesOf(existing.type).includes(existing.subType)));
  const [subChoice, setSubChoice] = useState(existing?.subType ? (existingCustom ? OTHER : existing.subType) : '');
  const [customSub, setCustomSub] = useState(existingCustom ? existing!.subType! : '');
  const [description, setDescription] = useState(reviewed?.description ?? '');
  const words = countWords(description);
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? '');
  const [place, setPlace] = useState(existing?.place ?? '');
  const [schedule, setSchedule] = useState(existing?.schedule ?? '');
  const [audience, setAudience] = useState<CircleAudience>(existing?.audience ?? 'ALL');
  const [ageMin, setAgeMin] = useState(String(existing?.ageMin ?? 8));
  const [ageMax, setAgeMax] = useState(String(existing?.ageMax ?? 14));
  const [joinMode, setJoinMode] = useState<CircleJoinMode>(existing?.joinMode ?? 'APPROVAL');
  const [whatsappLink, setWhatsappLink] = useState(reviewed?.whatsappLink ?? '');
  const [otherLink, setOtherLink] = useState(reviewed?.otherLink ?? '');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const subTypes = subTypesOf(type);
  // "Other" has no list: residents type their own sub-type
  const freeSubType = type === 'Other' || (subTypes.length === 0 && existingCustom && type === existing?.type);
  const subType = freeSubType || subChoice === OTHER ? customSub.trim() : subChoice;
  const isCustomSubType = Boolean(subType) && (freeSubType || subChoice === OTHER);

  const pickType = (t: string) => {
    setType(t);
    setSubChoice('');
    setCustomSub('');
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPEG, PNG or WebP).');
      return;
    }
    downscaleImage(file)
      .then((url) =>
        url.length > MAX_CLASS_PHOTO_CHARS ? setError('This photo is too detailed to upload. Please choose another.') : setPhotoUrl(url)
      )
      .catch(() => setError('Could not read this photo. Please choose another.'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!type) return setError('Choose a type for the circle.');
    if ((freeSubType || subChoice === OTHER) && !customSub.trim()) return setError('Type the sub-type, or pick one from the list.');
    if (words > MAX_CIRCLE_DESCRIPTION_WORDS)
      return setError(`Keep the description within ${MAX_CIRCLE_DESCRIPTION_WORDS} words (now ${words}).`);
    if (audience === 'AGE_RANGE' && Number(ageMin) > Number(ageMax)) return setError('The youngest age must not be above the oldest.');

    const payload = {
      name: name.trim(),
      type,
      subType: subType || undefined,
      isCustomSubType: isCustomSubType || undefined,
      description: description.trim(),
      photoUrl: photoUrl || (isEdit ? '' : undefined),
      place: place.trim() || undefined,
      schedule: schedule.trim() || undefined,
      audience,
      ageMin: audience === 'AGE_RANGE' ? Number(ageMin) : undefined,
      ageMax: audience === 'AGE_RANGE' ? Number(ageMax) : undefined,
      joinMode,
      whatsappLink: whatsappLink.trim() || (isEdit ? '' : undefined),
      otherLink: otherLink.trim() || (isEdit ? '' : undefined),
    };
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/circles', {
        method: isEdit ? 'PUT' : 'POST',
        json: isEdit ? { ...payload, circleId: existing!.id } : payload,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; circle?: CircleView; pendingReview?: boolean };
      if (!res.ok) throw new Error(body.error || 'Could not save the circle.');
      const id = body.circle?.id ?? existing?.id;
      setDone(
        isEdit
          ? body.pendingReview
            ? 'Saved. The new name, description or links go live once your society admin approves them; until then members see the current ones.'
            : 'Your changes are live.'
          : body.circle?.status === 'ACTIVE'
            ? 'Your circle is live. Neighbours can find it now.'
            : 'Your circle has been sent to your society admin. It goes live once they approve it.'
      );
      setTimeout(() => router.push(id ? `/circles/${id}` : '/circles/mine'), 2200);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save the circle.');
    } finally {
      setSubmitting(false);
    }
  };

  const preview: CircleView = {
    id: existing?.id ?? 'preview',
    name: name.trim() || 'Your circle',
    type: type || 'Type',
    subType: subType || undefined,
    description: description.trim() || 'A short description of your circle.',
    photoUrl: photoUrl || undefined,
    place: place.trim() || undefined,
    schedule: schedule.trim() || undefined,
    audience,
    ageMin: Number(ageMin),
    ageMax: Number(ageMax),
    joinMode,
    status: 'ACTIVE',
    memberCount: existing?.memberCount ?? 1,
    createdAt: '',
    viewer: { status: 'NONE', canManage: false, isOwner: false },
  };

  return (
    <PageContainer width="default" className="grid gap-6">
      <ModuleHeader
        module="community"
        title={isEdit ? 'Edit circle' : 'Create a circle'}
        description={
          isEdit
            ? isSocietyAdmin
              ? 'Changes go live straight away'
              : 'A new name, description or link is checked by your society admin first'
            : isSocietyAdmin
              ? 'As a society admin, your circle goes live straight away'
              : 'Your society admin approves new circles before neighbours see them'
        }
        backHref={isEdit ? `/circles/${existing!.id}` : '/circles'}
        backLabel={isEdit ? 'Back to the circle' : 'Back to Circles'}
      />

      {done ? (
        <Card padding="lg" className="grid justify-items-center text-center gap-3 py-12">
          <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </span>
          <h2 className="font-display text-section font-bold text-ink">{isEdit ? 'Circle saved' : 'Circle created'}</h2>
          <p role="status" className="text-support text-ink-muted max-w-sm">
            {done}
          </p>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="grid gap-4 min-w-0">
            {existing?.pendingChange && (
              <p role="note" className="p-3 rounded-control bg-warning-bg text-warning text-support">
                A change is waiting for your society admin. Saving again replaces that request.
              </p>
            )}
            <FormSection title="About the circle" icon={CircleDot} iconClassName={ICON}>
              <Input
                label="Name"
                required
                minLength={3}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunday Morning Cricket"
              />

              <fieldset>
                <legend className="text-support font-semibold text-ink mb-1.5">
                  Type{' '}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {types.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      aria-pressed={type === t.name}
                      onClick={() => pickType(t.name)}
                      className={choiceClass(type === t.name)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              {type && subTypes.length > 0 && !freeSubType && (
                <fieldset>
                  <legend className="text-support font-semibold text-ink mb-1.5">{type}: which one? (optional)</legend>
                  <div className="flex flex-wrap gap-2">
                    {subTypes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={subChoice === s}
                        onClick={() => setSubChoice(subChoice === s ? '' : s)}
                        className={choiceClass(subChoice === s)}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={subChoice === OTHER}
                      onClick={() => setSubChoice(subChoice === OTHER ? '' : OTHER)}
                      className={choiceClass(subChoice === OTHER)}
                    >
                      Something else
                    </button>
                  </div>
                </fieldset>
              )}
              {type && (freeSubType || subChoice === OTHER) && (
                <Input
                  label={freeSubType ? 'What is it?' : `Which ${type.toLowerCase()}?`}
                  required
                  maxLength={40}
                  value={customSub}
                  onChange={(e) => setCustomSub(e.target.value)}
                  placeholder={freeSubType ? 'e.g. Book club' : 'e.g. Pickleball'}
                />
              )}

              <Textarea
                label="Description"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the circle does and who it's for"
                hint={`${words}/${MAX_CIRCLE_DESCRIPTION_WORDS} words`}
                error={words > MAX_CIRCLE_DESCRIPTION_WORDS ? `Keep it within ${MAX_CIRCLE_DESCRIPTION_WORDS} words` : undefined}
              />

              <div className="grid gap-1.5">
                <span className="text-support font-semibold text-ink">Photo (optional)</span>
                {photoUrl ? (
                  <div className="relative w-full max-w-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
                    <img src={photoUrl} alt="Circle photo" className="w-full h-36 object-cover rounded-control border border-line" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      aria-label="Remove photo"
                      className="absolute top-2 right-2 w-11 h-11 rounded-full bg-surface/90 border border-line text-ink flex items-center justify-center"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label className="min-h-11 w-fit px-4 inline-flex items-center gap-2 rounded-control border border-dashed border-line-strong text-support font-semibold text-ink cursor-pointer hover:bg-sunken focus-within:ring-3 focus-within:ring-community/30">
                    <Camera className="w-4 h-4" aria-hidden="true" /> Add a photo
                    <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
                  </label>
                )}
              </div>
            </FormSection>

            <FormSection title="When and where" icon={Users} iconClassName={ICON}>
              <OptionPicker
                label="Where you meet (optional)"
                options={society?.settings?.classLocations ?? []}
                value={place}
                onChange={setPlace}
                otherPlaceholder="Or type a place"
              />
              <Input
                label="When (optional)"
                maxLength={80}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. Sundays, 7 am"
              />
              <fieldset>
                <legend className="text-support font-semibold text-ink mb-1.5">Who can join</legend>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={audience === a.id}
                      onClick={() => setAudience(a.id)}
                      className={choiceClass(audience === a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {audience === 'AGE_RANGE' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Youngest age"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                  />
                  <Input
                    label="Oldest age"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                  />
                </div>
              )}
              <fieldset>
                <legend className="text-support font-semibold text-ink mb-1.5">Joining</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['APPROVAL', 'Approval needed', 'You approve each request'],
                      ['OPEN', 'Open', 'Anyone in the society joins at once'],
                    ] as [CircleJoinMode, string, string][]
                  ).map(([id, title, sub]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={joinMode === id}
                      onClick={() => setJoinMode(id)}
                      className={cn(
                        'min-h-11 p-3 rounded-control border text-left transition-colors',
                        joinMode === id ? 'border-community-deep bg-community-tint' : 'border-line-strong bg-surface hover:bg-sunken'
                      )}
                    >
                      <span className={cn('block text-support font-semibold', joinMode === id ? 'text-community-deep' : 'text-ink')}>
                        {title}
                      </span>
                      <span className="block text-meta text-ink-muted">{sub}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </FormSection>

            <FormSection title="Links for members" icon={Link2} iconClassName={ICON}>
              <p className="text-meta text-ink-muted flex gap-1.5">
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" /> Only approved members see these links.
              </p>
              <Input
                label="WhatsApp group invite link (optional)"
                type="url"
                inputMode="url"
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
              />
              <Input
                label="Other link (optional)"
                type="url"
                inputMode="url"
                value={otherLink}
                onChange={(e) => setOtherLink(e.target.value)}
                placeholder="https://…"
              />
            </FormSection>

            {error && (
              <p role="alert" className="p-3 rounded-control bg-danger-bg text-danger text-support">
                {error}
              </p>
            )}
            <Button type="submit" tone="community" size="lg" fullWidth loading={submitting} icon={Save}>
              {isEdit ? 'Save changes' : isSocietyAdmin ? 'Create circle' : 'Send for approval'}
            </Button>
          </div>

          <aside aria-label="Preview" className="hidden lg:grid gap-2 sticky top-24">
            <p className="text-tag font-semibold uppercase tracking-wider text-ink-muted">How neighbours see it</p>
            <div inert>
              <CircleCard circle={preview} preview />
            </div>
          </aside>
        </form>
      )}
    </PageContainer>
  );
}
