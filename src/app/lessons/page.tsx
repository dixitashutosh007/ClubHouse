'use client';

import { useApiData } from '@/hooks/useApiData';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  Plus,
  Search,
  MessageCircle,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { ClassListing } from '@/types';
import { APP_NAME } from '@/lib/brand';
import { formatIstDay, istDateOf } from '@/lib/utils/time';

export default function LessonsBrowsePage() {
  const { society, activePersona } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDetailsModal, setActiveDetailsModal] = useState<ClassListing | null>(null);

  const cacheKey = `${activePersona}:${society?.id ?? ''}`;
  const { data: classData, loading } = useApiData(
    '/api/v1/lessons',
    (json) => (json as { classes: ClassListing[] }).classes ?? [],
    'Could not load classes.',
    cacheKey
  );
  const { data: categoryData } = useApiData(
    '/api/v1/lessons/categories',
    (json) => (json as { categories: string[] }).categories ?? [],
    'Could not load class subjects.',
    cacheKey
  );
  const classes = classData ?? [];
  const categories = categoryData ?? [];

  // Filter classes
  const filteredClasses = classes.filter((cls) => {
    // Category filter
    if (selectedCategory !== 'ALL') {
      if (cls.subject.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }

    // Type filter
    if (selectedType !== 'ALL') {
      if (cls.classType !== selectedType) {
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

  const getWhatsAppLink = (cls: ClassListing) => {
    const rawPhone = cls.contactPhone.replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;
    const text = encodeURIComponent(
      `Hello ${cls.contactName}, I saw your "${cls.subject}" class on ${APP_NAME} (${society?.name || 'our society'}) and would love to know more!`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const formatFee = (cls: ClassListing) => {
    if (cls.feeType === 'FREE') return 'Free';
    if (!cls.feeAmount) return 'Flexible';
    const amountStr = `₹${cls.feeAmount.toLocaleString('en-IN')}`;
    switch (cls.feeType) {
      case 'PER_SESSION':
        return `${amountStr} / session`;
      case 'PER_MONTH':
        return `${amountStr} / month`;
      case 'PER_COURSE':
        return `${amountStr} / course`;
      default:
        return amountStr;
    }
  };

  const formatSchedule = (cls: ClassListing) => {
    if (!cls.scheduleDays || cls.scheduleDays.length === 0 || cls.scheduleDays.includes('FLEXIBLE')) {
      return 'Flexible Schedule';
    }
    const dayMap: Record<string, string> = {
      MON: 'Mon',
      TUE: 'Tue',
      WED: 'Wed',
      THU: 'Thu',
      FRI: 'Fri',
      SAT: 'Sat',
      SUN: 'Sun',
    };
    return cls.scheduleDays.map((d) => dayMap[d] || d).join(', ');
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 pb-6">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Classes</h1>
            <p className="text-xs text-slate-600 truncate">Taught by verified residents of {society?.name ?? 'your society'}</p>
          </div>
        </div>

        {/* Search & Class Type Filters */}
        <div className="max-w-3xl mx-auto px-4 pt-2 pb-3 space-y-2.5">
          <div className="relative">
            <Search aria-hidden="true" className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search classes"
              placeholder="Search by subject, teacher or keyword"
              className="w-full text-xs font-medium pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-500 transition-all"
            />
          </div>

          {/* Category Chips Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Subjects
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Secondary Type Filter Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 pt-0.5">
            <span className="text-slate-600">Type:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'REGULAR', label: 'Regular' },
              { id: 'ONE_TIME', label: 'One Time' },
              { id: 'FESTIVE', label: 'Festive' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-2.5 py-0.5 rounded-md transition-colors ${
                  selectedType === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content List */}
      <div className="max-w-3xl mx-auto px-4 py-4 w-full flex-1">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading classes & tutors in your society...</span>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">
              No classes match your current search
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Be the first resident to offer classes in Yoga, Music, Coding, Tuition, or Fitness!
            </p>
            <div className="mt-5">
              <Link
                href="/lessons/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Offer a Class</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClasses.map((cls) => {
              const isFull = cls.status === 'FULL';

              return (
                <div
                  key={cls.id}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-purple-300 hover:shadow-md ${
                    isFull ? 'opacity-75' : ''
                  }`}
                >
                  {/* Top Bar inside Card */}
                  <div className="p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            {cls.subject}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {cls.classType === 'REGULAR'
                              ? 'Regular Classes'
                              : cls.classType === 'FESTIVE'
                              ? 'Festive Special'
                              : 'One-Time Workshop'}
                          </span>
                          {cls.trialAvailable && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Free Trial</span>
                            </span>
                          )}
                          {isFull && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              Batch Full
                            </span>
                          )}
                        </div>

                        <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                          {cls.subject}
                        </h2>
                        <p className="text-xs text-slate-700 font-medium mt-0.5">
                          Taught by <span className="text-slate-900 font-bold whitespace-nowrap">{cls.contactName}</span>
                          {cls.creatorFlat ? <span className="whitespace-nowrap"> · {cls.creatorFlat}</span> : ''}
                        </p>
                      </div>

                      {/* Fee Highlight */}
                      <div className="text-right shrink-0">
                        <span className="text-sm sm:text-base font-extrabold text-emerald-700 block">
                          {formatFee(cls)}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium">Pay in person</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      {cls.description}
                    </p>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate font-medium">
                          {cls.locationType === 'CLUBHOUSE'
                            ? cls.locationDetail || 'Clubhouse'
                            : cls.locationType === 'FLAT'
                            ? cls.locationDetail || 'Resident Flat'
                            : cls.locationDetail || 'Society Premises'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate font-medium">{formatSchedule(cls)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate font-medium">
                          {cls.startTime ? cls.startTime : 'Time flexible'}
                          {cls.durationMinutes ? ` (${cls.durationMinutes}m)` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate font-medium">
                          {cls.noAgeLimit
                            ? 'All Age Groups'
                            : cls.ageMin && cls.ageMax
                            ? `Ages ${cls.ageMin}–${cls.ageMax}`
                            : cls.ageMin
                            ? `Ages ${cls.ageMin}+`
                            : 'Open to all'}
                        </span>
                      </div>
                    </div>

                    {/* Photo thumbnail if present */}
                    {cls.photoUrl && (
                      <div className="mt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise */}
                        <img
                          src={cls.photoUrl}
                          alt={cls.subject}
                          className="w-full max-h-48 object-cover rounded-xl border border-slate-200"
                        />
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 font-medium">
                        Posted {formatIstDay(istDateOf(cls.createdAt))}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveDetailsModal(cls)}
                          className="h-9 px-3 whitespace-nowrap rounded-xl border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          Details
                        </button>
                        <a
                          href={getWhatsAppLink(cls)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${cls.contactName} about ${cls.subject}`}
                          className="h-9 px-3.5 whitespace-nowrap rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {activeDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                  {activeDetailsModal.subject}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  {activeDetailsModal.subject} Class
                </h3>
                <p className="text-xs text-slate-500">
                  Tutor: {activeDetailsModal.contactName} ({activeDetailsModal.creatorFlat || 'Resident'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailsModal(null)}
                aria-label="Close class details"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-2 text-slate-700">
              <p className="font-semibold text-slate-900">About this Class:</p>
              <p className="leading-relaxed">{activeDetailsModal.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Fee</span>
                <span className="font-extrabold text-emerald-700 text-sm mt-0.5 block">
                  {formatFee(activeDetailsModal)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Location</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {activeDetailsModal.locationDetail || activeDetailsModal.locationType}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Schedule</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {formatSchedule(activeDetailsModal)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Age Requirement</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {activeDetailsModal.noAgeLimit
                    ? 'All Ages'
                    : `Ages ${activeDetailsModal.ageMin || 0} - ${activeDetailsModal.ageMax || 'Any'}`}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900">
              <span className="font-bold block mb-0.5">Peer-to-Peer Zero Payment Policy</span>
              All fee amounts shown are informational. Payments and settlements must be handled directly between neighbours in person. Club House does not process financial transactions.
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveDetailsModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <a
                href={getWhatsAppLink(activeDetailsModal)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
