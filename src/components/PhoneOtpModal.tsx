'use client';

import { apiFetch, selectSociety } from '@/lib/api-client';
import React, { useState, useEffect } from 'react';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/config';
import {
  DEV_OTP_BYPASS_ENABLED,
  DEV_TEST_OTP,
  OTP_RESEND_COOLDOWN_SECONDS,
  getRecaptchaVerifier,
  resetRecaptchaVerifier,
  toE164IndianMobile,
} from '@/lib/firebase/phone';
import { smsSendErrorMessage } from '@/lib/firebase/sms-errors';
import { AlertCircle, Building2, ChevronRight, KeyRound, Phone, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { OnboardingProgress } from '@/components/ui/OnboardingProgress';
import { SocietySearch, SocietySearchResult } from '@/components/SocietySearch';
import { SocietySummary, User } from '@/types';
import { clearLoggedOutFlag, useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

interface PhoneOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  defaultMobile?: string;
  /** Society invite code to join on first sign-in (from a /join link) */
  societyCode?: string;
  /** Society picked in the search, to join on sign-in (instead of an invite code) */
  societyId?: string;
  /** Skip the full page reload after sign-in */
  skipReload?: boolean;
}

export function PhoneOtpModal({
  isOpen,
  onClose,
  onSuccess,
  defaultMobile = '',
  societyCode,
  societyId,
  skipReload = false,
}: PhoneOtpModalProps) {
  // Until the user edits it, the number field shows the default mobile
  const [phoneInput, setPhone] = useState<string | null>(null);
  const phone =
    phoneInput ?? (defaultMobile ? (defaultMobile.startsWith('+91') ? defaultMobile : `+91${defaultMobile}`) : '+91');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'SOCIETY' | 'CHOOSE'>('PHONE');
  // Residents of several societies pick the one to work in after signing in
  const [mySocieties, setMySocieties] = useState<SocietySummary[]>([]);
  const [signedInUser, setSignedInUser] = useState<User | null>(null);
  const router = useRouter();
  const { refreshAuth } = useAuth();
  // A verified number with no society yet keeps its ID token to search and join one
  const [verifiedIdToken, setVerifiedIdToken] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);

  // Tick once a second while the resend cooldown is running
  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const cooldownSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const e164 = toE164IndianMobile(phone);
    if (!e164) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another code.`);
      return;
    }

    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(
        firebaseAuth,
        e164,
        getRecaptchaVerifier(RECAPTCHA_CONTAINER_ID)
      );
      setConfirmationResult(confirmation);
      setResendAvailableAt(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      setStep('OTP');
    } catch (err: unknown) {
      resetRecaptchaVerifier(RECAPTCHA_CONTAINER_ID);
      console.warn('Firebase Phone Auth send attempt result:', err);
      if (DEV_OTP_BYPASS_ENABLED) {
        // Development without Firebase: continue to the OTP step and use the test code
        setStep('OTP');
      } else {
        setError(smsSendErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let idToken: string;

      if (DEV_OTP_BYPASS_ENABLED && (verificationCode === DEV_TEST_OTP || !confirmationResult)) {
        // Development only: map test numbers to seeded demo users
        if (phone.includes('9876543210')) idToken = 'dev-token-usr-admin-001';
        else if (phone.includes('9822233344')) idToken = 'dev-token-usr-seeker-001';
        else idToken = 'dev-token-usr-offerer-001';
      } else {
        if (!confirmationResult) {
          throw new Error('Please request an SMS verification code first.');
        }
        const result = await confirmationResult.confirm(verificationCode);
        idToken = await result.user.getIdToken();
      }

      // Establish session with server
      const sessionRes = await apiFetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, societyCode, societyId }),
      });

      const sessionData = await sessionRes.json().catch(() => ({}));
      if (sessionRes.status === 404 && sessionData.needsSociety) {
        setVerifiedIdToken(idToken);
        setStep('SOCIETY');
        return;
      }
      if (!sessionRes.ok) {
        throw new Error(sessionData.error || 'Failed to create server session');
      }

      clearLoggedOutFlag();
      if (sessionData.chooseSociety && Array.isArray(sessionData.societies) && !societyCode && !societyId) {
        setSignedInUser(sessionData.user);
        setMySocieties(sessionData.societies);
        setStep('CHOOSE');
        return;
      }
      onSuccess(sessionData.user);
      onClose();
      if (!skipReload) window.location.reload(); // Refresh session state
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Invalid or expired OTP code. Please check and retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Joins the picked society as a pending member, then collects their details on its join page
  const handleJoinSociety = async (society: SocietySearchResult) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/auth/session', {
        method: 'POST',
        json: { idToken: verifiedIdToken, societyId: society.id },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not join this society. Please try again.');
      clearLoggedOutFlag();
      await refreshAuth();
      onClose();
      router.push(`/join/society/${encodeURIComponent(society.id)}`);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Could not join this society. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fieldError = (id: string) =>
    error ? (
      <p id={id} role="alert" className="flex items-start gap-1.5 text-meta font-medium text-danger">
        <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
        {error}
      </p>
    ) : null;
  const inputClass = (invalid: boolean) =>
    `w-full h-12 px-4 rounded-control border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 ${
      invalid ? 'border-danger' : 'border-line-strong focus:border-terracotta-deep'
    }`;
  const Icon = step === 'PHONE' ? Phone : step === 'OTP' ? KeyRound : Building2;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-title"
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-surface rounded-t-sheet sm:rounded-sheet shadow-overlay border border-line p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] grid gap-5"
      >
        <div id={RECAPTCHA_CONTAINER_ID}></div>

        <div className="flex items-start justify-between gap-3">
          <OnboardingProgress current={step === 'PHONE' ? 'Phone' : step === 'OTP' ? 'Verify' : 'Society'} className="flex-1 min-w-0" />
          <IconButton icon={X} label="Close" onClick={onClose} className="-mt-2 -mr-2" />
        </div>

        <div className="grid gap-2">
          <span className="w-12 h-12 rounded-card bg-terracotta-tint text-terracotta-deep flex items-center justify-center">
            <Icon className="w-6 h-6" aria-hidden="true" />
          </span>
          <h2 id="otp-title" className="font-display text-section font-bold text-ink">
            {step === 'PHONE'
              ? 'Sign in with your mobile'
              : step === 'OTP'
                ? 'Enter the code'
                : step === 'CHOOSE'
                  ? 'Choose your society'
                  : 'Find your society'}
          </h2>
          <p className="text-support text-ink-muted">
            {step === 'PHONE'
              ? 'We will text you a 6-digit code to confirm it is you.'
              : step === 'OTP'
                ? `We sent a 6-digit code to ${phone}.`
                : step === 'CHOOSE'
                  ? 'You belong to more than one society. Pick the one to open; you can switch later from your profile menu.'
                  : 'Your number is verified but not registered with a society yet. Pick yours to request to join; a society admin will approve you.'}
          </p>
        </div>

        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="mobile-number-91" className="text-support font-semibold text-ink">
                Mobile number
              </label>
              <input
                id="mobile-number-91"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98111 22233"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'phone-error' : undefined}
                className={`${inputClass(Boolean(error))} text-body font-semibold`}
              />
              {fieldError('phone-error')}
            </div>
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={cooldownSeconds > 0}>
              {cooldownSeconds > 0 ? `Send again in ${cooldownSeconds}s` : 'Send code'}
            </Button>
          </form>
        ) : step === 'OTP' ? (
          <form onSubmit={handleVerifyOtp} className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="6-digit-otp-code" className="text-support font-semibold text-ink">
                6-digit code
              </label>
              <input
                id="6-digit-otp-code"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="••••••"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'otp-error' : undefined}
                className={`${inputClass(Boolean(error))} text-center tracking-[0.5em] text-section font-mono font-bold`}
              />
              {fieldError('otp-error')}
            </div>
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Verify and continue
            </Button>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep('PHONE')}>
                Change number
              </Button>
              <Button
                variant="ghost"
                disabled={loading || cooldownSeconds > 0}
                onClick={(e) => void handleSendOtp(e as unknown as React.FormEvent)}
              >
                {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend code'}
              </Button>
            </div>
          </form>
        ) : step === 'CHOOSE' ? (
          <ul className="grid gap-2" aria-label="Your societies">
            {mySocieties.map((soc) => (
              <li key={soc.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectSociety(soc.id);
                    if (signedInUser) onSuccess(signedInUser);
                    onClose();
                    window.location.reload();
                  }}
                  className="w-full min-h-16 p-3 rounded-card border border-line-strong hover:border-terracotta-deep hover:bg-terracotta-tint text-left flex items-center gap-3 transition-colors"
                >
                  <span className="w-10 h-10 rounded-control bg-terracotta-tint text-terracotta-deep flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-ink">{soc.name}</span>
                    <span className="block text-meta text-ink-muted truncate">{soc.address}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-ink-muted shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-4">
            {fieldError('society-error')}
            <SocietySearch idToken={verifiedIdToken} onPick={handleJoinSociety} busy={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
