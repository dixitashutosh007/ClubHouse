'use client';

import { apiFetch } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { downscaleImage } from '@/lib/utils/image';
import { MAX_CLASS_PHOTO_CHARS } from '@/lib/validation/schemas';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  Save,
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClassListing, ClassType, FeeType, LocationType } from '@/types';
import { MAX_CLASS_DESCRIPTION_WORDS, countWords } from '@/lib/validation/words';

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

  const [trialAvailable, setTrialAvailable] = useState<boolean>(existing?.trialAvailable ?? true);
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
        scheduleDays: isFlexibleSchedule ? ['FLEXIBLE'] : scheduleDays,
        startTime: startTime || undefined,
        durationMinutes: durationMinutes || undefined,
        trialAvailable,
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

  return (
    <div className="flex-1 flex flex-col bg-slate-50 pb-6">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/lessons"
              aria-label="Back to Classes"
              className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                {isEdit ? 'Edit class' : 'Offer a Class or Lesson'}
              </h1>
              <p className="text-[11px] text-slate-600 font-medium">
                {society?.name} · Tutor Onboarding
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full flex-1">
        {success ? (
          <div className="p-8 bg-white rounded-3xl border border-emerald-200 text-center space-y-3 shadow-sm animate-fade-in">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Class updated' : 'Class submitted!'}</h2>
            <p className="text-xs text-slate-700 max-w-sm mx-auto">{resultMessage}</p>
            <p className="text-[11px] text-purple-700 font-bold">Redirecting to your listings...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Class Type */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <label className="text-xs font-bold text-slate-900 block">
                Class Type <span className="text-rose-700">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'REGULAR', title: 'Regular', subtitle: 'Ongoing batches' },
                  { id: 'ONE_TIME', title: 'One-Time', subtitle: 'Single session' },
                  { id: 'FESTIVE', title: 'Festive', subtitle: 'Seasonal special' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setClassType(item.id as ClassType)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      classType === item.id
                        ? 'border-purple-600 bg-purple-50/70 text-purple-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">{item.title}</span>
                    <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
                      {item.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Subject & Description */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <label htmlFor="class-subject" className="text-xs font-bold text-slate-900 block mb-1.5">
                  Subject / Category <span className="text-rose-700">*</span>
                </label>
                <select
                  id="class-subject"
                  value={subjectChoice}
                  onChange={(e) => setSubjectChoice(e.target.value)}
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="OTHER">Other (Enter custom subject)...</option>
                </select>
              </div>

              {subjectChoice === 'OTHER' && (
                <div>
                  <label htmlFor="class-custom-subject" className="text-xs font-bold text-slate-900 block mb-1">
                    Custom Subject Name <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="class-custom-subject"
                    type="text"
                    required
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g. Calligraphy, Chess, Public Speaking, Vedic Maths"
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="class-description" className="text-xs font-bold text-slate-900 block mb-1">
                  Class Description <span className="text-rose-700">*</span>
                </label>
                <textarea
                  id="class-description"
                  required
                  rows={3}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-describedby="class-description-count"
                  placeholder="In a few lines: what you teach, who it's for, what to bring."
                  className="w-full text-xs font-medium p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <span
                  id="class-description-count"
                  className={`text-[11px] block text-right mt-0.5 ${
                    descriptionWords > MAX_CLASS_DESCRIPTION_WORDS ? 'text-rose-700 font-bold' : 'text-slate-600'
                  }`}
                >
                  {descriptionWords} / {MAX_CLASS_DESCRIPTION_WORDS} words
                </span>
              </div>
            </div>

            {/* 3. Fee Details */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-900 block mb-1.5">
                  Fee Structure <span className="text-rose-700">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'FREE', label: 'Free' },
                    { id: 'PER_SESSION', label: 'Per Session' },
                    { id: 'PER_MONTH', label: 'Per Month' },
                    { id: 'PER_COURSE', label: 'Per Course' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFeeType(f.id as FeeType)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        feeType === f.id
                          ? 'border-purple-600 bg-purple-50 text-purple-900'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {feeType !== 'FREE' && (
                <div>
                  <label htmlFor="class-fee" className="text-xs font-bold text-slate-900 block mb-1">
                    Amount (₹ INR) <span className="text-rose-700">*</span>
                  </label>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-600"
                    >
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
                      className="w-full text-xs font-bold pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Zero-Payment Policy Disclaimer */}
              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero-Commission Policy:</strong> All fee amounts are strictly informational. Payments must be settled directly between neighbours in person. Club House does not process, hold, or escrow any money.
                </span>
              </div>
            </div>

            {/* 4. Contact Details (Fetch from Login, Editable) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <label className="text-xs font-bold text-slate-900 block">
                Tutor Contact Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="class-contact-name" className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Contact Person Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="class-contact-name"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="class-contact-phone" className="text-[11px] font-semibold text-slate-600 block mb-1">
                    WhatsApp Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="class-contact-phone"
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98111 22233"
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Location */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <label className="text-xs font-bold text-slate-900 block">
                Class Location inside Society <span className="text-rose-700">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CLUBHOUSE', label: 'Club House' },
                  { id: 'FLAT', label: 'My Flat' },
                  { id: 'OTHER', label: 'Other Spot' },
                ].map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setLocationType(loc.id as LocationType)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      locationType === loc.id
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>

              {locationType !== 'FLAT' && classLocations.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Places in your society">
                  {classLocations.map((place) => (
                    <button
                      key={place}
                      type="button"
                      aria-pressed={locationDetail === place}
                      onClick={() => setLocationDetail(locationDetail === place ? '' : place)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        locationDetail === place
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-purple-400'
                      }`}
                    >
                      {place}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="class-location-detail" className="text-[11px] font-semibold text-slate-700 block mb-1">
                  {locationType === 'FLAT' ? 'Flat number' : 'Location details'}
                </label>
                <input
                  id="class-location-detail"
                  type="text"
                  maxLength={120}
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={
                    locationType === 'CLUBHOUSE'
                      ? 'e.g. 1st Floor Aerobics Hall or Badminton Court'
                      : locationType === 'FLAT'
                      ? 'e.g. Tower B - 804'
                      : 'e.g. Society Central Amphitheatre / Garden'
                  }
                  className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* 6. Age Requirements */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Age Requirements</span>
                  <span className="text-[10px] text-slate-600">Is this class open to all ages?</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noAgeLimit}
                    onChange={(e) => setNoAgeLimit(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm"
                  />
                  <span className="text-xs font-semibold text-slate-700">No Age Limit</span>
                </label>
              </div>

              {!noAgeLimit && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label htmlFor="class-age-min" className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Min Age (Years)
                    </label>
                    <input
                      id="class-age-min"
                      type="number"
                      min={2}
                      max={90}
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="class-age-max" className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Max Age (Years)
                    </label>
                    <input
                      id="class-age-max"
                      type="number"
                      min={2}
                      max={90}
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 7. Schedule & Time */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 block">
                  Class Days
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFlexibleSchedule}
                    onChange={(e) => setIsFlexibleSchedule(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm"
                  />
                  <span className="text-xs font-semibold text-slate-700">Open / Flexible Schedule</span>
                </label>
              </div>

              {!isFlexibleSchedule && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {WEEKDAYS.map((day) => {
                    const selected = scheduleDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={`w-10 h-10 rounded-xl text-xs font-extrabold transition-all ${
                          selected
                            ? 'bg-purple-700 text-white shadow-2xs scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label htmlFor="class-start-time" className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Start Time
                  </label>
                  <select
                    id="class-start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="class-duration" className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Duration (Optional)
                  </label>
                  <select
                    id="class-duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.val} value={d.val}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 8. Trial & Expiry & Photos */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span id="class-trial-label" className="text-xs font-bold text-slate-900 block">Free Trial Class</span>
                  <span className="text-[10px] text-slate-600">Allow residents 1 free trial session</span>
                </div>
                <input
                  type="checkbox"
                  checked={trialAvailable}
                  aria-labelledby="class-trial-label"
                  onChange={(e) => setTrialAvailable(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label htmlFor="class-expires" className="text-xs font-bold text-slate-900 block mb-1">
                  Listing Expiry Date (Optional)
                </label>
                <input
                  id="class-expires"
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
                />
              </div>

              {/* Photo Upload */}
              <div className="pt-3 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-900 block mb-1">
                  Class Poster or Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 border-2 border-dashed border-slate-300 hover:border-purple-400 p-4 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-purple-50/30">
                    <Camera className="w-5 h-5 text-slate-600 mb-1" />
                    <span className="text-xs font-semibold text-slate-600">Select Image (Max 5MB)</span>
                    <span className="text-[10px] text-slate-600">PNG, JPG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>

                  {photoPreview && (
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise */}
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview('');
                          setPhotoUrl('');
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Post Class for Approval'}</span>
              </button>
              <p className="text-[10px] text-slate-600 text-center mt-2 font-medium">
                Your listing will be visible to co-residents once approved by the Society Admin.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
