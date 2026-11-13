'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PlacesAutocompleteInput } from '@/components/PlacesAutocompleteInput';
import { PhoneOtpModal } from '@/components/PhoneOtpModal';
import { useAuth } from '@/context/AuthContext';
import { User } from '@/types';
import { FlatNumberInput } from '@/components/FlatNumberInput';

/** How the resident reached the join page: an invite link or the society search */
export type JoinTarget = { societyCode: string } | { societyId: string };

export function JoinSocietyForm({ target }: { target: JoinTarget }) {
  const router = useRouter();
  const { user, society, isAuthenticated, refreshAuth } = useAuth();

  // Registration requires a verified mobile number (phone OTP sign-in) first
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const signedInUser = verifiedUser ?? (isAuthenticated ? user : null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [gender, setGender] = useState('MALE');

  // Multi-clause legal disclaimer modal
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [agreePeerOnly, setAgreePeerOnly] = useState(false);
  const [agreeTrustOrLeave, setAgreeTrustOrLeave] = useState(false);
  const [agreeNoDeveloperObligation, setAgreeNoDeveloperObligation] = useState(false);
  const [agreeSocietyRules, setAgreeSocietyRules] = useState(false);

  const isLegalFullyAccepted = agreePeerOnly && agreeTrustOrLeave && agreeNoDeveloperObligation && agreeSocietyRules;

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLegalFullyAccepted) {
      setShowLegalModal(true);
      setError('Please review and check all mandatory clauses in the Club House Legal Agreement popup.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...target,
          fullName,
          email,
          flatNumber,
          gender,
          workLocationName: workLocation,
        }),
      });

      if (res.ok) {
        // The SMS sign-in on this page skipped the app reload, so load the
        // session now; otherwise Home still shows the signed-out screen
        await refreshAuth();
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (e) {
      console.error(e);
      setError('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/"
          aria-label="Back"
          className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Join your society</h1>
          <p className="text-xs text-zinc-500">Official Society Invitation</p>
        </div>
      </div>

      {submitted ? (
        <div className="my-auto text-center py-12 px-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Registration Submitted!</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Your registration is currently under review by your Society Admins. Once approved, you will have full access to Ride Share.
          </p>
          <button
            type="button"
            onClick={async () => {
              await refreshAuth();
              router.push('/');
            }}
            className="inline-block px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold"
          >
            Return to Home
          </button>
        </div>
      ) : !signedInUser ? (
        <div className="my-auto text-center py-12 px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Verify your mobile number</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            We&apos;ll send a one-time code by SMS. Your verified number is what co-residents see once you share a ride.
          </p>
          <button
            type="button"
            onClick={() => setShowOtpModal(true)}
            className="inline-block px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold"
          >
            Continue with mobile OTP
          </button>
          <PhoneOtpModal
            isOpen={showOtpModal}
            onClose={() => setShowOtpModal(false)}
            onSuccess={(verified) => {
              setVerifiedUser(verified);
              void refreshAuth();
            }}
            {...('societyCode' in target ? { societyCode: target.societyCode } : { societyId: target.societyId })}
            skipReload
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3.5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="full-name" className="text-xs font-semibold text-zinc-700 block mb-1">Full Name</label>
            <input
              id="full-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Iyer"
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FlatNumberInput
                label="Flat number"
                config={society?.settings?.flatConfig}
                placeholder="e.g. Tower A-503"
                value={flatNumber}
                onChange={setFlatNumber}
              />
            </div>
            <div>
              <label htmlFor="gender" className="text-xs font-semibold text-zinc-700 block mb-1">Gender</label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1">Mobile Number</label>
            <div className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{signedInUser?.mobile || 'Verified'}</span>
            </div>
          </div>

          <div>
            <label htmlFor="email-address" className="text-xs font-semibold text-zinc-700 block mb-1">Email Address</label>
            <input
              id="email-address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="resident@example.com"
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1">Primary Work Location (Google Places)</label>
            <PlacesAutocompleteInput
              value={workLocation}
              onChange={(loc) => setWorkLocation(loc)}
              placeholder="Search destination tech park, office campus, or metro..."
              label=""
            />
          </div>

          {/* Society Rules & Mandatory Legal Disclaimer Modal Trigger */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Club House Legal Terms & Community Rules</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isLegalFullyAccepted
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {isLegalFullyAccepted ? 'Accepted ✓' : 'Required'}
              </span>
            </div>

            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Before registration, you must open and agree to all 4 mandatory clauses in the legal disclaimer modal.
            </p>

            <button
              type="button"
              onClick={() => setShowLegalModal(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-bold text-zinc-800 flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <span>{isLegalFullyAccepted ? 'Review Accepted Terms & Disclaimers' : 'Open Legal Disclaimer & Agreement Popup'}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>

          <div className="mt-auto pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-emerald-700 text-white font-semibold text-xs active:scale-98 transition-all hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Registering...' : 'Submit Society Registration'}
            </button>
          </div>
        </form>
      )}

      {/* POPUP MODAL: LEGAL DISCLAIMER & MANDATORY CHECKBOXES */}
      {showLegalModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900">Legal Disclaimers & Usage Policy</h3>
                  <p className="text-[11px] text-zinc-600 font-medium">
                    Please read the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">
                      Terms
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">
                      Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto py-3 space-y-3.5 flex-1 pr-1 text-xs">
              {/* Highlighted Warning Box */}
              <div className="p-3 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-900 space-y-1">
                <span className="font-extrabold text-xs flex items-center gap-1.5 text-rose-800 uppercase tracking-wider">
                  ⚠️ Critical Notice: Trust & Developer Obligation
                </span>
                <p className="text-[11px] leading-relaxed font-semibold">
                  If you do not trust this App or fellow residents, please DO NOT use this App. The app developer and platform owner have ZERO obligation to provide responses, customer service, or mediation to your queries or disputes.
                </p>
              </div>

              {/* Mandatory Clauses Checkboxes */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreePeerOnly}
                    onChange={(e) => setAgreePeerOnly(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-zinc-900 block">Clause 1: Non-Commercial Peer Matchmaking Only</strong>
                    <span className="text-zinc-600">
                      I acknowledge that Club House is strictly a neighbor directory and peer-match tool. It is NOT a taxi, transport service, or commercial vehicle carrier.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTrustOrLeave}
                    onChange={(e) => setAgreeTrustOrLeave(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-rose-950 block">Clause 2: Voluntary Usage & Absolute Discretion</strong>
                    <span className="text-rose-900">
                      I understand that if I do not trust this app, its data, or fellow residents, I must not use this app. My participation is 100% voluntary and at my own sole risk.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeNoDeveloperObligation}
                    onChange={(e) => setAgreeNoDeveloperObligation(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-amber-950 block">Clause 3: Zero Developer / Owner Support Obligation</strong>
                    <span className="text-amber-900">
                      I acknowledge and accept that the app developer, creator, and owner have NO obligation to answer my questions, investigate complaints, resolve road disputes, or provide technical guarantees.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeSocietyRules}
                    onChange={(e) => setAgreeSocietyRules(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-zinc-900 block">Clause 4: Punctuality & Society Code of Conduct</strong>
                    <span className="text-zinc-600">
                      I agree to abide by all resident society bylaws, maintain civil behavior with co-residents, and give advance notice for cancellations.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="py-2.5 px-4 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!isLegalFullyAccepted}
                onClick={() => {
                  if (isLegalFullyAccepted) {
                    setShowLegalModal(false);
                    setError('');
                  }
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                  isLegalFullyAccepted
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-600/30 cursor-pointer'
                    : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLegalFullyAccepted ? 'Agree & Confirm All 4 Clauses' : 'Check All 4 Boxes to Proceed'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
