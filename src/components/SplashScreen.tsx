'use client';

import React, { useState } from 'react';
import { clearLoggedOutFlag, useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Building2, Car, GraduationCap, Phone, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OnboardingProgress } from '@/components/ui/OnboardingProgress';
import { cn } from '@/components/ui/cn';
import { MODULE_THEMES } from '@/lib/design/modules';
import { PhoneOtpModal } from '@/components/PhoneOtpModal';
import { ClubHouseLogo } from '@/components/ClubHouseLogo';
import { APP_NAME, APP_TAGLINE, RIDESHARE_NAME } from '@/lib/brand';
import Link from 'next/link';

interface SplashScreenProps {
  onSuccessLogin?: () => void;
}

export function SplashScreen({ onSuccessLogin }: SplashScreenProps) {
  const { society } = useAuth();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  const features = [
    { icon: ShieldCheck, title: 'Verified neighbours only', body: 'Every member is approved by your society admin.', tone: cn(MODULE_THEMES.home.tint, MODULE_THEMES.home.text) },
    { icon: Car, title: RIDESHARE_NAME, body: 'Share rides to work with neighbours. No fares; settle fuel in person.', tone: cn(MODULE_THEMES.ride.tint, MODULE_THEMES.ride.text), live: true },
    { icon: GraduationCap, title: 'Classes', body: 'Yoga, music, tuition and more, taught by residents.', tone: cn(MODULE_THEMES.classes.tint, MODULE_THEMES.classes.text), live: true },
    { icon: Users, title: 'Coming soon', body: 'Community, Marketplace and trusted service reviews.', tone: 'bg-sunken text-ink-muted' },
  ];

  return (
    <div className="flex-1 w-full max-w-md mx-auto flex flex-col gap-6 px-4 sm:px-6 py-8 min-h-[90vh] bg-ivory text-ink">
      <OnboardingProgress current="Phone" />

      <div className="grid justify-items-center text-center gap-3 pt-2">
        <span className="w-16 h-16 rounded-card bg-terracotta-deep text-ink-inverse flex items-center justify-center shadow-raised">
          <ClubHouseLogo className="w-9 h-9" />
        </span>
        <h1 className="font-display text-page font-bold text-ink">{APP_NAME}</h1>
        <p className="text-body text-ink-muted max-w-xs">
          {APP_TAGLINE}, only for verified residents of <span className="font-semibold text-ink">{society?.name ?? 'your society'}</span>.
        </p>
      </div>

      <ul className="grid gap-2">
        {features.map((f) => (
          <li key={f.title} className="flex items-center gap-3 p-3 rounded-card bg-surface border border-line">
            <span className={cn('w-10 h-10 rounded-control flex items-center justify-center shrink-0', f.tone)}>
              <f.icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-support font-bold text-ink">
                {f.title}
                {f.live && <span className="text-tag font-semibold px-1.5 rounded-full bg-success-bg text-success">Live</span>}
              </span>
              <span className="block text-meta text-ink-muted">{f.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 mt-auto">
        <Button size="lg" fullWidth icon={Phone} onClick={() => setShowOtpModal(true)}>
          Continue with your mobile
        </Button>
        <p className="text-meta text-ink-muted text-center">
          New here? Verify your mobile, then find your society or use its invite code.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = inviteCode.trim().toUpperCase();
            if (code) router.push(`/join/${encodeURIComponent(code)}`);
          }}
          className="grid gap-1.5"
        >
          <label htmlFor="invite-code" className="text-support font-semibold text-ink">
            Have an invite code?
          </label>
          <div className="flex gap-2">
            <input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. ABC123"
              autoCapitalize="characters"
              className="flex-1 min-w-0 h-11 px-3 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep"
            />
            <Button type="submit" variant="secondary" icon={Building2} disabled={!inviteCode.trim()}>
              Join
            </Button>
          </div>
        </form>

        <p className="text-meta text-ink-muted text-center">
          By continuing you agree to the{' '}
          <Link href="/terms" className="font-semibold text-terracotta-deep underline">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-terracotta-deep underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* Firebase Phone Auth OTP Modal */}
      <PhoneOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onSuccess={() => {
          setShowOtpModal(false);
          clearLoggedOutFlag();
          if (onSuccessLogin) onSuccessLogin();
          else window.location.reload();
        }}
      />
    </div>
  );
}
