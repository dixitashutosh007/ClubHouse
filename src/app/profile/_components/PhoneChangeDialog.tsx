'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PhoneAuthProvider, updatePhoneNumber } from 'firebase/auth';
import { Dialog } from '@/components/ui/Dialog';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { firebaseAuth } from '@/lib/firebase/config';
import {
  DEV_OTP_BYPASS_ENABLED,
  DEV_TEST_OTP,
  getRecaptchaVerifier,
  resetRecaptchaVerifier,
  toE164IndianMobile,
} from '@/lib/firebase/phone';
import { smsSendErrorMessage } from '@/lib/firebase/sms-errors';

const RECAPTCHA_ID = 'profile-recaptcha';

interface PhoneChangeDialogProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/**
 * Verified mobile number change: an SMS OTP links the new number to the
 * Firebase account, then the server reads the number from a fresh ID token.
 */
export function PhoneChangeDialog({ open, userId, onClose, onChanged }: PhoneChangeDialogProps) {
  const [newPhone, setNewPhone] = useState('');
  const [step, setStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setStep('INPUT');
    setNewPhone('');
    setCode('');
    setVerificationId(null);
    setError('');
    onClose();
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const e164 = toE164IndianMobile(newPhone);
    if (!e164) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      if (DEV_OTP_BYPASS_ENABLED) {
        // Development without Firebase: use the test code
        setVerificationId(null);
        setStep('OTP');
        return;
      }
      setError('For security, please sign out and sign in again before changing your number.');
      return;
    }

    setBusy(true);
    try {
      const provider = new PhoneAuthProvider(firebaseAuth);
      setVerificationId(await provider.verifyPhoneNumber(e164, getRecaptchaVerifier(RECAPTCHA_ID)));
      setStep('OTP');
    } catch (err) {
      resetRecaptchaVerifier(RECAPTCHA_ID);
      console.warn('Phone verification SMS failed', err);
      setError(smsSendErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setBusy(true);
    try {
      let body: { idToken: string; devPhoneNumber?: string };
      const currentUser = firebaseAuth.currentUser;
      if (verificationId && currentUser) {
        await updatePhoneNumber(currentUser, PhoneAuthProvider.credential(verificationId, code.trim()));
        body = { idToken: await currentUser.getIdToken(true) };
      } else if (DEV_OTP_BYPASS_ENABLED && code.trim() === DEV_TEST_OTP) {
        body = { idToken: `dev-token-${userId}`, devPhoneNumber: toE164IndianMobile(newPhone) ?? undefined };
      } else {
        throw new Error('Please request a new verification code.');
      }

      const res = await apiFetch('/api/v1/auth/phone', { json: body });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Failed to update phone number'));

      await onChanged();
      close();
    } catch (err: unknown) {
      setError(
        typeof err === 'object' && err && 'code' in err && err.code === 'auth/invalid-verification-code'
          ? 'Incorrect code. Please check and retry.'
          : err instanceof Error
            ? err.message
            : 'Error verifying phone number'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Update Mobile Number"
      description="Your new number is verified by SMS before it is saved."
    >
      <div id={RECAPTCHA_ID}></div>
      {error && (
        <p role="alert" className="mb-3 p-3 rounded-control bg-danger-bg text-support text-danger">
          {error}
        </p>
      )}

      {step === 'INPUT' ? (
        <form onSubmit={sendCode} className="grid gap-3">
          <div>
            <label htmlFor="new-phone" className="text-support font-semibold text-ink block mb-1.5">
              New Mobile Number
            </label>
            <input
              id="new-phone"
              type="tel"
              required
              autoComplete="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep font-semibold"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="flex-1 h-11 rounded-control border border-line-strong bg-surface text-ink text-body font-semibold hover:bg-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-11 rounded-control bg-terracotta-deep text-ink-inverse text-body font-semibold hover:bg-terracotta-deep/90 flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Sending" /> : 'Send code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmCode} className="grid gap-3">
          <div>
            <label htmlFor="phone-otp" className="text-support font-semibold text-ink block mb-1.5">
              Enter the code sent to {newPhone}
            </label>
            <input
              id="phone-otp"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep text-center tracking-[0.4em] font-bold font-mono"
            />
            {DEV_OTP_BYPASS_ENABLED && (
              <p className="text-meta text-ink-muted mt-1">Dev test code: {DEV_TEST_OTP}</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('INPUT')}
              className="flex-1 h-11 rounded-control border border-line-strong bg-surface text-ink text-body font-semibold hover:bg-sunken"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-11 rounded-control bg-terracotta-deep text-ink-inverse text-body font-semibold hover:bg-terracotta-deep/90 flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Verifying" /> : 'Verify & Save'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
