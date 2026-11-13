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
import { Phone, KeyRound, AlertCircle, Loader2, Building2 } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-150">
        <div id={RECAPTCHA_CONTAINER_ID}></div>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
            {step === 'PHONE' ? (
              <Phone className="w-6 h-6" />
            ) : step === 'OTP' ? (
              <KeyRound className="w-6 h-6" />
            ) : (
              <Building2 className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-lg font-bold text-zinc-900">
            {step === 'PHONE'
              ? 'Sign in with Mobile'
              : step === 'OTP'
                ? 'Enter Verification Code'
                : step === 'CHOOSE'
                  ? 'Choose your society'
                  : 'Find your society'}
          </h2>
          <p className="text-xs text-zinc-600 mt-1">
            {step === 'PHONE'
              ? 'We will send a 6-digit OTP to verify your resident identity.'
              : step === 'OTP'
                ? `Enter the 6-digit verification code sent to ${phone}.`
                : step === 'CHOOSE'
                  ? 'You belong to more than one society. Pick the one to open; you can switch later from your profile menu.'
                  : 'Your number is verified but not registered with a society yet. Pick yours to request to join; a society admin will approve you.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="mobile-number-91" className="text-xs font-bold text-slate-800 block mb-1">
                Mobile Number (+91)
              </label>
              <input
                id="mobile-number-91"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98111 22233"
                className="w-full text-sm font-semibold p-3 rounded-xl border-2 border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-900 placeholder:text-slate-400 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center justify-center gap-1 shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : cooldownSeconds > 0 ? (
                  `Resend in ${cooldownSeconds}s`
                ) : (
                  'Send OTP'
                )}
              </button>
            </div>
          </form>
        ) : step === 'OTP' ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="6-digit-otp-code" className="text-xs font-bold text-slate-800 block mb-1">
                6-Digit OTP Code
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
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] text-xl font-mono font-extrabold p-3 rounded-xl border-2 border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-950 placeholder:text-slate-300 outline-none transition-all shadow-inner"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('PHONE')}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 flex items-center justify-center gap-1 shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
              </button>
            </div>
          </form>
        ) : step === 'CHOOSE' ? (
          <ul className="space-y-2" aria-label="Your societies">
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
                  className="w-full p-3.5 rounded-2xl border border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-left flex items-center gap-3"
                >
                  <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{soc.name}</span>
                    <span className="block text-xs text-slate-600 truncate">{soc.address}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <SocietySearch idToken={verifiedIdToken} onPick={handleJoinSociety} busy={loading} />
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
