'use client';

import { apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { downscaleImage } from '@/lib/utils/image';
import { MAX_CLASS_PHOTO_CHARS } from '@/lib/validation/schemas';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, BookOpen, CalendarDays, Camera, CheckCircle2, IndianRupee, MapPin, Phone, Save, ShieldAlert, Sparkles, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { FormSection, PageContainer } from '@/components/ui/Layout';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { MODULE_THEMES } from '@/lib/design/modules';
import { cn } from '@/components/ui/cn';
import { classAgeLabel, classDaysLabel, classFeeLabel, classLocationLabel, classTimeLabel } from '@/lib/class-format';
import { useRouter } from 'next/navigation';
import { ClassListing, ClassType, FeeType, LocationType } from '@/types';
import { MAX_CLASS_DESCRIPTION_WORDS, countWords } from '@/lib/validation/words';
import { useIsClient } from '@/hooks/useIsClient';
import { formatHHMM12, istDateString } from '@/lib/utils/time';

const PRESET_SUBJECTS = [
  'Yoga',
  'Music',
  'Art & Craft',
  'Piano',
  'Maths',
  'Language',
  'Fitness',
  'Coding',
  'Hobby',
  'Analytics',
];

const WEEKDAYS = [
  { id: 'MON', label: 'Mon' },
  { id: 'TUE', label: 'Tue' },
  { id: 'WED', label: 'Wed' },
  { id: 'THU', label: 'Thu' },
  { id: 'FRI', label: 'Fri' },
  { id: 'SAT', label: 'Sat' },
  { id: 'SUN', label: 'Sun' },
];

const TIME_SLOTS = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00',
];

const CLASS_ICON = cn(MODULE_THEMES.classes.tint, MODULE_THEMES.classes.text);

/** A pill or tile choice; selected uses the Classes colour */
function choiceClass(selected: boolean, shape: 'tile' | 'pill' = 'tile') {
  return cn(
    'border transition-colors text-support font-semibold',
    shape === 'pill' ? 'min-h-11 px-4 rounded-full' : 'min-h-11 px-3 py-2 rounded-control',
    selected ? 'border-classes-deep bg-classes-tint text-classes-deep' : 'border-line-strong bg-surface text-ink hover:bg-sunken'
  );
}

const DURATIONS = [
  { val: 30, label: '30 mins' },
  { val: 45, label: '45 mins' },
  { val: 60, label: '1 hour' },
  { val: 90, label: '1.5 hours' },
  { val: 120, label: '2 hours' },
  { val: 180, label: '3 hours' },
  { val: 240, label: '4 hours' },
  { val: 360, label: '6 hours' },
  { val: 480, label: '8 hours' },
];

interface ClassEditorProps {
  /** The class being edited; omitted when offering a new class */
  existing?: ClassListing;
}

/** Form for offering a new class or editing one of your own */
export function ClassEditor({ existing }: ClassEditorProps) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const { user, society, activePersona } = useAuth();

  // Categories
  const { data: categoryData } = useApiData(
    '/api/v1/lessons/categories',
    (json) => (json as { categories: string[] }).categories ?? [],
    'Could not load class subjects.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const baseCategories = categoryData?.length ? categoryData : PRESET_SUBJECTS;
  // A class keeps its subject even if the society later removes it from the list
  const categories =
    existing && !existing.isCustomSubject && !baseCategories.includes(existing.subject)
      ? [existing.subject, ...baseCategories]
      : baseCategories;

  // Form State (starts from the saved class when editing)
  const [classType, setClassType] = useState<ClassType>(existing?.classType ?? 'REGULAR');
  const [subjectChoice, setSubjectChoice] = useState<string>(
    existing ? (existing.isCustomSubject ? 'OTHER' : existing.subject) : 'Yoga'
  );
  const [customSubject, setCustomSubject] = useState<string>(existing?.isCustomSubject ? existing.subject : '');
  const [description, setDescription] = useState<string>(existing?.description ?? '');
  const descriptionWords = countWords(description);

  const [feeType, setFeeType] = useState<FeeType>(existing?.feeType ?? 'PER_MONTH');
  const isOneOff = classType !== 'REGULAR';
  const [classDate, setClassDate] = useState<string>(existing?.classDate ?? '');
  const isClient = useIsClient();
  const today = isClient ? istDateString() : '';
  // A one-off class is paid per session; regular ones usually per month
  const pickClassType = (next: ClassType) => {
    setClassType(next);
    if (next !== 'REGULAR' && feeType === 'PER_MONTH') setFeeType('PER_SESSION');
    if (next !== 'REGULAR') setTrialAvailable(false);
  };
  const [feeAmount, setFeeAmount] = useState<string>(existing?.feeAmount ? String(existing.feeAmount) : '');

  // Contact details default to the resident's own until they edit them
  const [contactNameInput, setContactName] = useState<string | null>(existing?.contactName ?? null);
  const [contactPhoneInput, setContactPhone] = useState<string | null>(existing?.contactPhone ?? null);
  const contactName = contactNameInput ?? user?.fullName ?? '';
  const contactPhone = contactPhoneInput ?? user?.mobile ?? '';

  const [locationType, setLocationType] = useState<LocationType>(existing?.locationType ?? 'CLUBHOUSE');
  const [locationDetail, setLocationDetail] = useState<string>(existing?.locationDetail ?? '');
  const classLocations = society?.settings?.classLocations ?? [];

  const [noAgeLimit, setNoAgeLimit] = useState<boolean>(existing?.noAgeLimit ?? true);
  const [ageMin, setAgeMin] = useState<string>(String(existing?.ageMin ?? 5));
  const [ageMax, setAgeMax] = useState<string>(String(existing?.ageMax ?? 16));

  const savedFlexible = existing?.scheduleDays?.includes('FLEXIBLE') ?? false;
  const [isFlexibleSchedule, setIsFlexibleSchedule] = useState<boolean>(savedFlexible);
  const [scheduleDays, setScheduleDays] = useState<string[]>(
    existing && !savedFlexible ? existing.scheduleDays : ['MON', 'WED', 'FRI']
  );
  const [startTime, setStartTime] = useState<string>(existing ? existing.startTime ?? '' : '07:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(existing ? existing.durationMinutes ?? 0 : 60);

  const [trialAvailable, setTrialAvailable] = useState<boolean>(existing?.trialAvailable ?? false);
  const [expiresOn, setExpiresOn] = useState<string>(existing?.expiresOn ?? '');

  const [photoUrl, setPhotoUrl] = useState<string>(existing?.photoUrl ?? '');
  const [photoPreview, setPhotoPreview] = useState<string>(existing?.photoUrl ?? '');
  const [resultMessage, setResultMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const toggleDay = (day: string) => {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter((d) => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPEG, PNG or WebP)');
      return;
    }

    // Stored inline with the class, so shrink it to fit the database limit
    downscaleImage(file)
      .then((dataUrl) => {
        if (dataUrl.length > MAX_CLASS_PHOTO_CHARS) {
          setError('This photo is too detailed to upload. Please choose another.');
          return;
        }
        setPhotoPreview(dataUrl);
        setPhotoUrl(dataUrl);
      })
      .catch(() => setError('Could not read this photo. Please choose another.'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalSubject = subjectChoice === 'OTHER' ? customSubject.trim() : subjectChoice;

    if (!finalSubject) {
      setError('Please provide a subject for this class');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a short description for this class');
      return;
    }
    if (descriptionWords > MAX_CLASS_DESCRIPTION_WORDS) {
      setError(`Please keep the description within ${MAX_CLASS_DESCRIPTION_WORDS} words (now ${descriptionWords}).`);
      return;
    }

    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Contact person name and phone number are required');
      return;
    }

    if (isOneOff && !classDate) {
      setError('Please pick the date of the class.');
      return;
    }

    if (feeType !== 'FREE' && (!feeAmount || Number(feeAmount) < 1 || Number(feeAmount) > 100000)) {
      setError('Please enter a fee between ₹1 and ₹1,00,000');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        classType,
        subject: finalSubject,
        isCustomSubject: subjectChoice === 'OTHER',
        description: description.trim(),
        feeType,
        feeAmount: feeType === 'FREE' ? undefined : Number(feeAmount),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        locationType,
        locationDetail: locationDetail.trim() || undefined,
        noAgeLimit,
        ageMin: noAgeLimit ? undefined : Number(ageMin),
        ageMax: noAgeLimit ? undefined : Number(ageMax),
        scheduleDays: isOneOff
          ? [['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(`${classDate}T12:00:00+05:30`).getUTCDay()]]
          : isFlexibleSchedule
            ? ['FLEXIBLE']
            : scheduleDays,
        classDate: isOneOff ? classDate : undefined,
        startTime: startTime || undefined,
        durationMinutes: durationMinutes || undefined,
        trialAvailable: isOneOff ? false : trialAvailable,
        expiresOn: expiresOn || undefined,
        // When editing, an empty string removes a saved photo
        photoUrl: photoUrl || (isEdit ? '' : undefined),
      };

      const res = await apiFetch('/api/v1/lessons', {
        method: isEdit ? 'PUT' : 'POST',
        json: isEdit ? { ...payload, listingId: existing!.id } : payload,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save the class');
      }

      const saved = ((await res.json()) as { listing?: ClassListing }).listing;
      setResultMessage(
        !isEdit
          ? 'Your class has been sent to your society admin. It goes live once they approve it.'
          : saved?.status === 'PENDING_APPROVAL' && existing!.status !== 'PENDING_APPROVAL'
            ? 'Changes saved. Because the class details changed, your society admin will review it again before it is shown.'
            : 'Changes saved.'
      );
      setSuccess(true);
      setTimeout(() => {
        router.push('/lessons/my-listings');
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to save the class');
    } finally {
      setSubmitting(false);
    }
  };

  // Desktop preview: built only from what has been entered
  const previewSubject = (subjectChoice === 'OTHER' ? customSubject.trim() : subjectChoice) || 'Your class';
  const previewDays = classDaysLabel({
    classType,
    classDate: classDate || undefined,
    scheduleDays: isOneOff ? [] : isFlexibleSchedule ? ['FLEXIBLE'] : scheduleDays,
  });
  const previewFee = classFeeLabel({ feeType, feeAmount: feeAmount ? Number(feeAmount) : undefined });

  return (
    <PageContainer width="default" className="grid gap-6">
      <ModuleHeader
        module="classes"
        title={isEdit ? 'Edit class' : 'Teach a class'}
        description={isEdit ? 'Changes to class details are reviewed again by your society admin' : 'Your society admin approves classes before residents see them'}
        backHref={isEdit ? '/lessons/my-listings' : '/lessons'}
        backLabel={isEdit ? 'Back to My classes' : 'Back to Classes'}
      />

      {success ? (
        <Card padding="lg" className="grid justify-items-center text-center gap-3 py-12">
          <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </span>
          <h2 className="font-display text-section font-bold text-ink">{isEdit ? 'Class updated' : 'Class submitted!'}</h2>
          <p role="status" className="text-support text-ink-muted max-w-sm">
            {resultMessage}
          </p>
          <p className="text-meta font-semibold text-classes-deep">Taking you to My classes…</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="grid gap-4 min-w-0">
            <FormSection title="About the class" icon={BookOpen} iconClassName={CLASS_ICON}>
              <fieldset className="grid gap-1.5">
                <legend className="text-support font-semibold text-ink mb-1.5">
                  Class type <span className="text-danger" aria-hidden="true">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'REGULAR', title: 'Regular', subtitle: 'Ongoing batches' },
                    { id: 'ONE_TIME', title: 'One-time', subtitle: 'Single session' },
                    { id: 'FESTIVE', title: 'Festive', subtitle: 'Seasonal special' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={classType === item.id}
                      onClick={() => pickClassType(item.id as ClassType)}
                      className={cn(choiceClass(classType === item.id), 'text-left')}
                    >
                      <span className="block">{item.title}</span>
                      <span className="block text-meta font-normal text-ink-muted">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Select id="class-subject" label="Subject" required value={subjectChoice} onChange={(e) => setSubjectChoice(e.target.value)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="OTHER">Other (type your own)…</option>
              </Select>

              {subjectChoice === 'OTHER' && (
                <Input
                  id="class-custom-subject"
                  label="Your subject"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Calligraphy, Chess, Public speaking"
                />
              )}

              <div className="grid gap-1">
                <Textarea
                  id="class-description"
                  label="Description"
                  required
                  rows={4}
                  maxLength={600}
                  value={description}
                  onChange={(e) => {
                    const next = e.target.value;
                    // Typing stops at the word limit; deleting is always allowed
                    if (countWords(next) > MAX_CLASS_DESCRIPTION_WORDS && next.length > description.length) return;
                    setDescription(next);
                  }}
                  aria-describedby="class-description-count"
                  placeholder="In a few lines: what you teach, who it's for, what to bring."
                />
                <span
                  id="class-description-count"
                  className={cn('text-meta text-right', descriptionWords > MAX_CLASS_DESCRIPTION_WORDS ? 'text-danger font-semibold' : 'text-ink-muted')}
                >
                  {descriptionWords} / {MAX_CLASS_DESCRIPTION_WORDS} words
                </span>
              </div>
            </FormSection>

            <FormSection title="Schedule" icon={CalendarDays} iconClassName={CLASS_ICON}>
              {isOneOff ? (
                <Input
                  id="class-date"
                  label="Date"
                  type="date"
                  required
                  min={today || undefined}
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                />
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="text-support font-semibold text-ink mb-1">Class days</legend>
                  <Checkbox
                    label="Flexible days"
                    description="Agree the days with each student"
                    checked={isFlexibleSchedule}
                    onChange={(e) => setIsFlexibleSchedule(e.target.checked)}
                  />
                  {!isFlexibleSchedule && (
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAYS.map((day) => {
                        const selected = scheduleDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleDay(day.id)}
                            className={cn(
                              'h-11 rounded-control text-meta font-semibold border transition-colors',
                              selected ? 'bg-classes-deep border-classes-deep text-ink-inverse' : 'bg-surface border-line-strong text-ink'
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select id="class-start-time" label="Start time" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {formatHHMM12(t)}
                    </option>
                  ))}
                </Select>
                <Select id="class-duration" label="Duration (optional)" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                  {DURATIONS.map((d) => (
                    <option key={d.val} value={d.val}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
            </FormSection>

            <FormSection title="Fee" icon={IndianRupee} iconClassName={CLASS_ICON}>
              <fieldset className="grid gap-1.5">
                <legend className="text-support font-semibold text-ink mb-1.5">
                  How you charge <span className="text-danger" aria-hidden="true">*</span>
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'FREE', label: 'Free' },
                    { id: 'PER_SESSION', label: 'Per session' },
                    { id: 'PER_MONTH', label: 'Per month' },
                    { id: 'PER_COURSE', label: 'Per course' },
                  ].map((fee) => (
                    <button key={fee.id} type="button" aria-pressed={feeType === fee.id} onClick={() => setFeeType(fee.id as FeeType)} className={choiceClass(feeType === fee.id)}>
                      {fee.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {feeType !== 'FREE' && (
                <div className="grid gap-1.5">
                  <label htmlFor="class-fee" className="text-support font-semibold text-ink">
                    Amount in rupees <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-body font-semibold text-ink-muted">
                      ₹
                    </span>
                    {/* Plain text with a numeric keypad: number inputs snap to steps and change on scroll */}
                    <input
                      id="class-fee"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      required
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
                      placeholder="e.g. 2000"
                      className="w-full h-11 pl-8 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-classes/30 focus:border-classes-deep"
                    />
                  </div>
                </div>
              )}

              <p className="flex items-start gap-2 p-3 rounded-control bg-warning-bg text-meta text-ink">
                <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                <span>Fees are for information only. Students pay you directly, in person; Club House does not handle any money.</span>
              </p>
            </FormSection>

            <FormSection title="Where and who" icon={MapPin} iconClassName={CLASS_ICON}>
              <fieldset className="grid gap-2">
                <legend className="text-support font-semibold text-ink mb-1.5">
                  Place in the society <span className="text-danger" aria-hidden="true">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CLUBHOUSE', label: 'Club House' },
                    { id: 'FLAT', label: 'My flat' },
                    { id: 'OTHER', label: 'Other spot' },
                  ].map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      aria-pressed={locationType === loc.id}
                      onClick={() => setLocationType(loc.id as LocationType)}
                      className={choiceClass(locationType === loc.id)}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
                {locationType !== 'FLAT' && classLocations.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Places in your society">
                    {classLocations.map((place) => (
                      <button
                        key={place}
                        type="button"
                        aria-pressed={locationDetail === place}
                        onClick={() => setLocationDetail(locationDetail === place ? '' : place)}
                        className={choiceClass(locationDetail === place, 'pill')}
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>

              <Input
                id="class-location-detail"
                label={locationType === 'FLAT' ? 'Flat number' : 'Location details'}
                maxLength={120}
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={
                  locationType === 'CLUBHOUSE'
                    ? 'e.g. 1st floor aerobics hall'
                    : locationType === 'FLAT'
                      ? 'e.g. Tower B - 804'
                      : 'e.g. Central amphitheatre or garden'
                }
              />

              <div className="grid gap-2 pt-1 border-t border-line">
                <Checkbox label="Open to all ages" checked={noAgeLimit} onChange={(e) => setNoAgeLimit(e.target.checked)} />
                {!noAgeLimit && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input id="class-age-min" label="Youngest (years)" type="number" min={2} max={90} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
                    <Input id="class-age-max" label="Oldest (years)" type="number" min={2} max={90} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection title="Contact" description="Residents use this to call or WhatsApp you" icon={Phone} iconClassName={CLASS_ICON}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label htmlFor="class-contact-name" className="text-support font-semibold text-ink">
                    Contact name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      id="class-contact-name"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-classes/30 focus:border-classes-deep"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="class-contact-phone" className="text-support font-semibold text-ink">
                    WhatsApp number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      id="class-contact-phone"
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98111 22233"
                      className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-classes/30 focus:border-classes-deep"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="Extras" description="All optional" icon={Sparkles} iconClassName={CLASS_ICON}>
              {!isOneOff && (
                <Checkbox
                  id="class-trial"
                  label="Free trial class"
                  description="Let residents try one session for free"
                  checked={trialAvailable}
                  onChange={(e) => setTrialAvailable(e.target.checked)}
                />
              )}

              <Input
                id="class-expires"
                label={isOneOff ? 'Hide the listing after' : 'Listing ends on'}
                hint={isOneOff ? 'Default: the class date' : undefined}
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />

              <div className="grid gap-1.5">
                <span className="text-support font-semibold text-ink">Poster or photo</span>
                <div className="flex items-center gap-3">
                  <label className="flex-1 min-h-24 border-2 border-dashed border-line-strong hover:border-classes-deep p-4 rounded-card flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-sunken focus-within:ring-3 focus-within:ring-classes/30">
                    <Camera className="w-5 h-5 text-ink-muted" aria-hidden="true" />
                    <span className="text-support font-semibold text-ink">Choose a photo</span>
                    <span className="text-meta text-ink-muted">PNG, JPG or WebP, up to 5 MB</span>
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="sr-only" />
                  </label>
                  {photoPreview && (
                    <div className="relative w-24 h-24 rounded-card overflow-hidden border border-line shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise */}
                      <img src={photoPreview} alt="Your class photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => {
                          setPhotoPreview('');
                          setPhotoUrl('');
                        }}
                        className="absolute top-1 right-1 w-8 h-8 inline-flex items-center justify-center rounded-full bg-ink/70 text-ink-inverse"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </FormSection>

            {/* Submit: problems show right above the button that was pressed */}
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:static z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 lg:py-0 bg-ivory/95 backdrop-blur-sm lg:bg-transparent grid gap-2">
              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 rounded-control bg-danger-bg text-support text-danger">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" tone="classes" size="lg" fullWidth icon={Save} loading={submitting}>
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Send for approval'}
              </Button>
              <p className="text-meta text-ink-muted text-center">Residents see your class once your society admin approves it.</p>
            </div>
          </div>

          {/* Live preview of the class card (desktop) */}
          <aside aria-label="Preview" className="hidden lg:grid gap-2 sticky top-24">
            <p className="text-tag font-semibold uppercase tracking-wider text-ink-muted">How residents will see it</p>
            <Card raised padding="none" className="overflow-hidden">
              {photoPreview && (
                // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise
                <img src={photoPreview} alt="" className="w-full h-32 object-cover border-b border-line" />
              )}
              <div className="p-4 grid gap-2">
                {(trialAvailable && !isOneOff) || isOneOff ? (
                  <div className="flex flex-wrap gap-1.5">
                    {trialAvailable && !isOneOff && <Badge status="success">Free trial</Badge>}
                    {isOneOff && <Badge tone="classes">{classType === 'FESTIVE' ? 'Festive special' : 'One-time workshop'}</Badge>}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-card font-bold text-ink break-words">{previewSubject}</p>
                    <p className="text-support text-ink-muted truncate">{contactName || 'Your name'}</p>
                  </div>
                  <span className="shrink-0 text-support font-bold text-classes-deep">{previewFee}</span>
                </div>
                {description.trim() && <p className="text-support text-ink line-clamp-2">{description}</p>}
                <ul className="grid gap-1 text-meta text-ink-muted">
                  <li>{classLocationLabel({ locationType, locationDetail: locationDetail.trim() || undefined })}</li>
                  <li>{previewDays}</li>
                  <li>{classTimeLabel({ startTime: startTime || undefined, durationMinutes: durationMinutes || undefined })}</li>
                  {!noAgeLimit && <li>{classAgeLabel({ noAgeLimit, ageMin: Number(ageMin), ageMax: Number(ageMax) })}</li>}
                </ul>
              </div>
            </Card>
          </aside>
        </form>
      )}
    </PageContainer>
  );
}
