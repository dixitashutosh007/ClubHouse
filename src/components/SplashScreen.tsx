'use client';

import React, { useState } from 'react';
import { clearLoggedOutFlag, useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Car,
  ShieldCheck,
  Users,
  Sparkles,
  ArrowRight,
  Phone,
  Building2,
  GraduationCap,
} from 'lucide-react';
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

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 text-white min-h-[90vh] px-6 py-8 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-28 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Header */}
      <div className="relative z-10 flex flex-col items-center text-center pt-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-xl shadow-emerald-950/60 mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center backdrop-blur-xs">
            <ClubHouseLogo className="w-9 h-9 text-emerald-400" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-2">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Private society apps</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">{APP_NAME}</h1>

        <p className="text-sm text-slate-300 max-w-xs leading-relaxed font-normal">
          {APP_TAGLINE}, only for verified residents of{' '}
          <span className="text-white font-semibold">{society?.name ?? 'your society'}</span>.
        </p>
      </div>

      {/* Center Value Props */}
      <div className="relative z-10 py-6 space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">Verified neighbours only</h2>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              Every member is approved by your society admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">
              {RIDESHARE_NAME} <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
            </h2>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              Share rides to work with neighbours. No fares, settle fuel in person.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">
              Classes <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
            </h2>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              Yoga, music, tuition and more, taught by residents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">Coming soon</h2>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              Community, Marketplace and trusted service reviews.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Actions: Login & Registration */}
      <div className="relative z-10 space-y-3 pt-2">
        {/* Primary Action: Phone / OTP Sign In */}
        <button
          onClick={() => setShowOtpModal(true)}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
        >
          <Phone className="w-4 h-4 text-slate-950" />
          <span>Continue with Mobile (SMS OTP)</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        <p className="text-[11px] text-slate-300 text-center">
          New here? Verify your mobile, then find your society, or use your society&apos;s invite code.
        </p>
        <p className="text-[11px] text-slate-300 text-center">
          By continuing you agree to the{' '}
          <Link href="/terms" className="font-semibold text-white underline">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-white underline">
            Privacy Policy
          </Link>
          .
        </p>

        {/* Secondary Action: Join with Society Invite Code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = inviteCode.trim().toUpperCase();
            if (code) router.push(`/join/${encodeURIComponent(code)}`);
          }}
          className="flex gap-2"
        >
          <label htmlFor="invite-code" className="sr-only">
            Society invite code
          </label>
          <input
            id="invite-code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Society invite code (optional)"
            autoCapitalize="characters"
            className="flex-1 min-w-0 py-3 px-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 text-xs font-semibold outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={!inviteCode.trim()}
            className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/15 text-white font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <Building2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span>Join</span>
          </button>
        </form>
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
