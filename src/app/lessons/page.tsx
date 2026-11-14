'use client';

import { useApiData } from '@/hooks/useApiData';
import { apiFetch } from '@/lib/api-client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Check, Clock, GraduationCap, Heart, MapPin, MessageCircle, Phone, Search, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/Layout';
import { LoadError } from '@/components/ui/LoadState';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { cn } from '@/components/ui/cn';
import { ClassListing } from '@/types';
import { APP_NAME } from '@/lib/brand';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { classAgeLabel, classDaysLabel, classFeeLabel, classLocationLabel, classTimeLabel } from '@/lib/class-format';

export default function LessonsBrowsePage() {
  const { society, activePersona, user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDetailsModal, setActiveDetailsModal] = useState<ClassListing | null>(null);

  const cacheKey = `${activePersona}:${society?.id ?? ''}`;
  const { data: classData, loading, error: loadError, reload } = useApiData(
    '/api/v1/lessons',
    (json) => (json as { classes: ClassListing[] }).classes ?? [],
    'Could not load classes.',
    cacheKey
  );
  const classes = classData ?? [];
  // Only subjects that have a class right now
  const subjects = [...new Set(classes.map((c) => c.subject))].sort((x, y) => x.localeCompare(y));

  // Filter classes
  const filteredClasses = classes.filter((cls) => {
    // Category filter
    if (selectedCategory !== 'ALL') {
      if (cls.subject.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = cls.subject.toLowerCase().includes(q);
      const matchDesc = cls.description.toLowerCase().includes(q);
      const matchTutor = (cls.contactName || '').toLowerCase().includes(q);
      const matchLoc = (cls.locationDetail || '').toLowerCase().includes(q);
      if (!matchSubject && !matchDesc && !matchTutor && !matchLoc) {
        return false;
      }
    }

    return true;
  });

  // Classes this resident said they're interested in (only their teachers see who)
  const { data: interestData } = useApiData(
    '/api/v1/lessons/interest',
    (json) => (json as { listingIds?: string[] }).listingIds ?? [],
    'Could not load your interests.',
    `${activePersona}:${society?.id ?? ''}`
  );
  const [interestOverrides, setInterestOverrides] = useState<Record<string, boolean>>({});
  const interested = new Set(
    [...(interestData ?? []), ...Object.keys(interestOverrides)].filter((id) => interestOverrides[id] ?? true)
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [interestNote, setInterestNote] = useState<string | null>(null);

  const [withdrawing, setWithdrawing] = useState<ClassListing | null>(null);
  const toggleInterest = async (cls: ClassListing) => {
    const on = !interested.has(cls.id);
    setBusyId(cls.id);
    try {
      const res = await apiFetch('/api/v1/lessons/interest', { method: on ? 'POST' : 'DELETE', json: { listingId: cls.id } });
      if (res.ok) {
        setInterestOverrides((cur) => ({ ...cur, [cls.id]: on }));
        setInterestNote(on ? cls.id : null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const getWhatsAppLink = (cls: ClassListing) => {
    const rawPhone = cls.contactPhone.replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;
    const text = encodeURIComponent(
      `Hello ${cls.contactName}, I saw your "${cls.subject}" class on ${APP_NAME} (${society?.name || 'our society'}) and would love to know more!`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const contactClass = 'h-11 rounded-control text-support font-semibold flex items-center justify-center gap-1.5 transition-colors';

  /** "✓ Interested" when on; tapping it then asks before withdrawing */
  const interestButton = (cls: ClassListing) => {
    const on = interested.has(cls.id);
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => (on ? setWithdrawing(cls) : void toggleInterest(cls))}
        disabled={busyId === cls.id}
        className={cn(
          contactClass,
          'border disabled:opacity-60',
          on ? 'bg-classes-deep border-classes-deep text-ink-inverse' : 'bg-surface border-classes-deep/40 text-classes-deep hover:bg-classes-tint'
        )}
      >
        {on ? <Check className="w-4 h-4" aria-hidden="true" /> : <Heart className="w-4 h-4" aria-hidden="true" />}
        {on ? 'Interested' : "I'm interested"}
      </button>
    );
  };

  /** Interest, Call and WhatsApp for a class someone else teaches */
  const contactActions = (cls: ClassListing) => (
    <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
      {interestButton(cls)}
      <a
        href={`tel:${cls.contactPhone.replace(/[^\d+]/g, '')}`}
        aria-label={`Call ${cls.contactName}`}
        className={cn(contactClass, 'border border-line-strong bg-surface text-ink hover:bg-sunken')}
      >
        <Phone className="w-4 h-4" aria-hidden="true" /> Call
      </a>
      <a
        href={getWhatsAppLink(cls)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp ${cls.contactName} about ${cls.subject}`}
        className={cn(contactClass, 'bg-success text-ink-inverse hover:bg-success/90')}
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
      </a>
    </div>
  );

  return (
    <PageContainer width="wide" className="grid gap-5">
      <ModuleHeader
        module="classes"
        description="Learn from neighbours who teach"
      />

      {/* One row: search, and a subject picker */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search aria-hidden="true" className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search classes"
            placeholder="Search classes, teachers or places"
            className="w-full h-11 pl-9 pr-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-classes/30 focus:border-classes-deep"
          />
        </div>
        <label htmlFor="class-subject-filter" className="sr-only">
          Subject
        </label>
        <select
          id="class-subject-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-11 max-w-[40%] px-3 rounded-control border border-line-strong bg-surface text-support font-semibold text-ink"
        >
          <option value="ALL">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
          <SkeletonCard label="Loading classes" lines={3} />
          <SkeletonCard label="Loading classes" lines={3} />
          <SkeletonCard label="Loading classes" lines={3} />
        </div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={reload} />
      ) : filteredClasses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          tone="classes"
          title={classes.length ? 'No classes match your search' : 'No classes yet'}
          description={classes.length ? 'Try another word or subject.' : 'Be the first to teach something.'}
          action={
            classes.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
              >
                Show all classes
              </Button>
            ) : (
              <Button tone="classes" href="/lessons/create">
                Teach a class
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
          {filteredClasses.map((cls) => {
            const isFull = cls.status === 'FULL';
            return (
              <li key={cls.id} className="min-w-0">
                <Card as="article" padding="none" className="h-full flex flex-col overflow-hidden">
                  {cls.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise
                    <img src={cls.photoUrl} alt={cls.subject} className="w-full h-40 object-cover border-b border-line" />
                  )}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    {(cls.classType !== 'REGULAR' || cls.trialAvailable || isFull) && (
                      <div className="flex flex-wrap gap-1.5">
                        {isFull && <Badge status="warning">Batch full</Badge>}
                        {cls.trialAvailable && (
                          <Badge status="success" icon={Sparkles}>
                            Free trial
                          </Badge>
                        )}
                        {cls.classType !== 'REGULAR' && <Badge tone="classes">{cls.classType === 'FESTIVE' ? 'Festive special' : 'One-time workshop'}</Badge>}
                      </div>
                    )}

                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <h2 className="font-display text-card font-bold text-ink break-words">{cls.subject}</h2>
                        <p className="text-support text-ink-muted">
                          <span className="font-semibold text-ink whitespace-nowrap">{cls.contactName}</span>
                          {cls.creatorFlat ? <span className="whitespace-nowrap"> · {cls.creatorFlat}</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-support font-bold text-classes-deep">{classFeeLabel(cls)}</span>
                    </div>

                    <p className="text-support text-ink line-clamp-2">{cls.description}</p>

                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-meta text-ink-muted">
                      <li className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{classLocationLabel(cls)}</span>
                      </li>
                      <li className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{classDaysLabel(cls)}</span>
                      </li>
                      <li className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{classTimeLabel(cls)}</span>
                      </li>
                      {!cls.noAgeLimit && (
                        <li className="flex items-center gap-1.5 min-w-0">
                          <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{classAgeLabel(cls)}</span>
                        </li>
                      )}
                    </ul>

                    <button
                      type="button"
                      onClick={() => setActiveDetailsModal(cls)}
                      aria-label={`More about ${cls.subject}`}
                      className="justify-self-start self-start min-h-11 -my-2 text-support font-semibold text-classes-deep underline underline-offset-2"
                    >
                      View details
                    </button>

                    <div className="mt-auto pt-3 border-t border-line grid gap-2">
                      {cls.createdByUserId === user?.id ? (
                        <Button variant="tonal" tone="classes" fullWidth href="/lessons/my-listings">
                          Your class · see who&apos;s interested
                        </Button>
                      ) : (
                        contactActions(cls)
                      )}
                      {interestNote === cls.id && (
                        <p role="status" className="text-meta text-classes-deep">
                          The teacher can now see your name, flat and mobile to get in touch.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Details */}
      <Dialog
        open={activeDetailsModal !== null}
        onClose={() => setActiveDetailsModal(null)}
        size="md"
        title={activeDetailsModal?.subject ?? 'Class'}
        description={
          activeDetailsModal
            ? `${activeDetailsModal.contactName}${activeDetailsModal.creatorFlat ? ` · ${activeDetailsModal.creatorFlat}` : ''}`
            : undefined
        }
      >
        {activeDetailsModal && (
          <div className="grid gap-4">
            {activeDetailsModal.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise
              <img src={activeDetailsModal.photoUrl} alt={activeDetailsModal.subject} className="w-full max-h-56 object-cover rounded-card" />
            )}
            <p className="text-body text-ink whitespace-pre-line">{activeDetailsModal.description}</p>
            <dl className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Fee', classFeeLabel(activeDetailsModal)],
                  ['Where', classLocationLabel(activeDetailsModal)],
                  [activeDetailsModal.classType === 'REGULAR' ? 'Days' : 'Date', classDaysLabel(activeDetailsModal)],
                  ['Time', classTimeLabel(activeDetailsModal)],
                  ['Ages', classAgeLabel(activeDetailsModal)],
                  ...(activeDetailsModal.trialAvailable ? [['Trial', 'First class free']] : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="p-3 rounded-control bg-classes-tint">
                  <dt className="text-tag font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
                  <dd className="text-support font-bold text-ink mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-meta text-ink-muted">Fees are paid to the teacher in person. Club House handles no payments.</p>
            {activeDetailsModal.createdByUserId !== user?.id && contactActions(activeDetailsModal)}
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw your interest?"
        description={withdrawing ? `${withdrawing.contactName} will no longer see you in their list for ${withdrawing.subject}.` : ''}
        confirmLabel="Withdraw"
        cancelLabel="Stay interested"
        destructive
        onCancel={() => setWithdrawing(null)}
        onConfirm={() => {
          const cls = withdrawing;
          setWithdrawing(null);
          if (cls) void toggleInterest(cls);
        }}
      />
    </PageContainer>
  );
}
