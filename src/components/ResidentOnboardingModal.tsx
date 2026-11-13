'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Mail,
  Car,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { PlacesAutocompleteInput } from '@/components/PlacesAutocompleteInput';
import { validateIndianRegistration } from '@/lib/utils/indian-vehicle';
import { FlatNumberInput } from '@/components/FlatNumberInput';

interface OnboardingModalProps {
  isOpen: boolean;
  onCompleted: () => void;
}

export function ResidentOnboardingModal({ isOpen, onCompleted }: OnboardingModalProps) {
  const { user, society, refreshAuth } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email?.includes('@societyapps.org') ? '' : (user?.email || ''));
  const [flatNumber, setFlatNumber] = useState('');
  const [commuteRole, setCommuteRole] = useState<'SEEKER' | 'OFFERER'>('SEEKER');
  const [workLocation, setWorkLocation] = useState(user?.workLocationName || '');
  const [workCoords, setWorkCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'>('PREFER_NOT_TO_SAY');

  // Vehicle Details (Mandatory if Offerer)
  const [vehicleType, setVehicleType] = useState<'CAR' | 'TWO_WHEELER'>('CAR');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const color = '';
  const [regNumber, setRegNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [mileage, setMileage] = useState('15'); // km/L for fuel points estimation

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Requirement 4: Legal Disclaimer Modal with multi-check boxes
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [agreePeerOnly, setAgreePeerOnly] = useState(false);
  const [agreeTrustOrLeave, setAgreeTrustOrLeave] = useState(false);
  const [agreeNoDeveloperObligation, setAgreeNoDeveloperObligation] = useState(false);
  const [agreeSocietyRules, setAgreeSocietyRules] = useState(false);

  const isLegalFullyAccepted = agreePeerOnly && agreeTrustOrLeave && agreeNoDeveloperObligation && agreeSocietyRules;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!fullName.trim() || fullName.length < 3) {
      setError('Please provide your full legal name as registered with the society.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid work or personal email required for verification.');
      return;
    }
    if (!flatNumber.trim()) {
      setError('Flat / Apartment number is required for society verification.');
      return;
    }
    if (!isLegalFullyAccepted) {
      setShowLegalModal(true);
      setError('Please review and check all mandatory clauses in the Club House Legal Agreement popup.');
      return;
    }

    // Offerer vehicle validation (Requirement 2: Follow Indian standard vehicle format)
    if (commuteRole === 'OFFERER') {
      if (!make.trim() || !model.trim() || !regNumber.trim()) {
        setError('To register as a Ride Offerer, vehicle Make, Model, and Registration number are required.');
        return;
      }
      const regCheck = validateIndianRegistration(regNumber);
      if (!regCheck.isValid) {
        setError(regCheck.error || 'Please enter a valid Indian vehicle number (e.g. KA-04-MB-1234 or 22-BH-1234-AA)');
        return;
      }
    }

    try {
      setSubmitting(true);

      // 1. If Offerer, register vehicle first
      if (commuteRole === 'OFFERER') {
        const vehRes = await apiFetch('/api/v1/user/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: vehicleType,
            make: make.trim(),
            model: model.trim(),
            color: color.trim(),
            registrationNumber: regNumber.trim().toUpperCase(),
            capacity: vehicleType === 'TWO_WHEELER' ? 1 : Number(capacity),
            mileageKmPerLitre: mileage ? Number(mileage) : 15,
          }),
        });
        if (!vehRes.ok) {
          const errData = await vehRes.json();
          throw new Error(errData.error || 'Failed to save vehicle details');
        }
      }

      // 2. Save profile updates and mark profile completed
      const profileRes = await apiFetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          flatNumber: flatNumber.trim().toUpperCase(),
          commuteIntent: commuteRole,
          workLocationName: workLocation,
          workLatitude: workCoords?.lat,
          workLongitude: workCoords?.lng,
          gender,
          profileCompleted: true,
        }),
      });

      if (!profileRes.ok) {
        const pErr = await profileRes.json();
        throw new Error(pErr.error || 'Failed to submit profile application');
      }

      setSuccess(true);
      await refreshAuth();
      setTimeout(() => {
        onCompleted();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Building2 className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
              {society?.name ?? 'Society'} Resident Verification
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-white">Complete Your Resident Profile</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Society admins verify your flat & identity to maintain a safe co-resident community.
          </p>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center my-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Application Submitted!</h3>
            <p className="text-xs text-slate-600 max-w-xs mt-2 leading-relaxed">
              Your details and vehicle have been submitted to the <span className="font-semibold">{society?.name} Management Committee</span> for verification.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Full Name & Mobile */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                  <span>Full Legal Name</span>
                  <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">Requires Admin Match</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ashutosh Dixit"
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 bg-white outline-none"
                />
              </div>

              {/* Email with Verification Tag */}
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                  <span>Work / Personal Email</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Verification Required</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 bg-white outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                </div>
              </div>

              <div>
                <label htmlFor="onboarding-gender" className="text-xs font-bold text-slate-800 block mb-1">
                  Gender
                </label>
                <select
                  id="onboarding-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Only used for rides an offerer limits to women or men. Never shown to other residents.
                </p>
              </div>

              {/* Flat Number, in the society's format */}
              <FlatNumberInput
                label="Flat number"
                config={society?.settings?.flatConfig}
                placeholder={society?.settings?.flat_format_example ? `Format: ${society.settings.flat_format_example}` : 'e.g. Tower B - 804'}
                value={flatNumber}
                onChange={setFlatNumber}
              />
            </div>

            {/* Primary Commute Role: Seeker or Offerer (No "Both" tab) */}
            <div className="pt-1">
              <label className="text-xs font-bold text-slate-800 block mb-1.5">
                Primary Commute Role
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCommuteRole('SEEKER')}
                  className={`py-3 px-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                    commuteRole === 'SEEKER'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Ride Seeker</span>
                  <span className={`text-[10px] font-normal ${commuteRole === 'SEEKER' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Find seats to work
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommuteRole('OFFERER')}
                  className={`py-3 px-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                    commuteRole === 'OFFERER'
                      ? 'bg-emerald-700 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>Ride Offerer</span>
                  <span className={`text-[10px] font-normal ${commuteRole === 'OFFERER' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    Share car / 2-wheeler
                  </span>
                </button>
              </div>
            </div>

            {/* Conditional Vehicle Section if Offerer (Requirement 3: Mandatory for Offerer, 2-wheeler & 4-wheeler support) */}
            {commuteRole === 'OFFERER' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950">Vehicle Information (Mandatory)</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                    Required for Offerer
                  </span>
                </div>

                {/* 2-Wheeler vs 4-Wheeler */}
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleType('CAR');
                      setCapacity(3);
                    }}
                    className={`py-2 px-2 rounded-lg border text-center cursor-pointer transition-all ${
                      vehicleType === 'CAR'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-emerald-200'
                    }`}
                  >
                    🚗 Car / 4-Wheeler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleType('TWO_WHEELER');
                      setCapacity(1);
                    }}
                    className={`py-2 px-2 rounded-lg border text-center cursor-pointer transition-all ${
                      vehicleType === 'TWO_WHEELER'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-emerald-200'
                    }`}
                  >
                    🛵 2-Wheeler / Bike
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 block mb-1">Make (Brand)</span>
                    <input
                      type="text"
                      required={commuteRole === 'OFFERER'}
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="e.g. Hyundai / Honda"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 block mb-1">Model</span>
                    <input
                      type="text"
                      required={commuteRole === 'OFFERER'}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. Creta / Activa"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 block mb-1">Registration Plate</span>
                    <input
                      type="text"
                      required={commuteRole === 'OFFERER'}
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      placeholder="KA-04-MB-1234"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold uppercase outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 block mb-1">Seats Available</span>
                    <select
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                    >
                      {vehicleType === 'TWO_WHEELER' ? (
                        <option value={1}>1 Pillion Seat</option>
                      ) : (
                        <>
                          <option value={1}>1 Seat</option>
                          <option value={2}>2 Seats</option>
                          <option value={3}>3 Seats</option>
                          <option value={4}>4 Seats</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Fuel Mileage Input for fair Fuel Share Points Estimation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Vehicle Fuel Mileage (km/L)
                    </label>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                      Advisory Fuel Share
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="60"
                      step="0.5"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">km/L</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Used to calculate advisory fuel share points. Settle directly with co-riders in person. No app payments.
                  </p>
                </div>
              </div>
            )}

            {/* Work Hub Location with Google Maps Autocomplete */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Typical Work Location / Hub (Google Places)
              </label>
              <PlacesAutocompleteInput
                value={workLocation}
                onChange={(loc, place) => {
                  setWorkLocation(loc);
                  setWorkCoords(place ? { lat: place.lat, lng: place.lng } : null);
                }}
                placeholder="Search workplace, office campus, tech park or metro..."
                label=""
                required
              />
            </div>

            {/* Society Rules & Mandatory Legal Disclaimer Modal Trigger */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Club House Legal Terms & Society Rules</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isLegalFullyAccepted
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {isLegalFullyAccepted ? 'Accepted ✓' : 'Action Required'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Before participating, you must review the disclaimer popup and accept all clauses regarding platform non-obligation and community usage.
              </p>

              <button
                type="button"
                onClick={() => setShowLegalModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <span>{isLegalFullyAccepted ? 'Review Accepted Terms & Disclaimers' : 'Open Legal Disclaimer & Agreement Popup'}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Verification to Society Admin</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* POPUP MODAL: LEGAL DISCLAIMER & MANDATORY CHECKBOXES */}
      {showLegalModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Legal Disclaimers & Usage Policy</h3>
                  <p className="text-[11px] text-slate-600 font-medium">
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

              {/* Society Rules Box */}
              {society?.settings?.community_rules && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">
                    {society.name} Community Carpool Rules:
                  </span>
                  <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                    {society.settings.community_rules}
                  </p>
                </div>
              )}

              {/* Mandatory Clauses Checkboxes */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreePeerOnly}
                    onChange={(e) => setAgreePeerOnly(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-slate-900 block">Clause 1: Non-Commercial Peer Matchmaking Only</strong>
                    <span className="text-slate-600">
                      I acknowledge that Club House is strictly a neighbor directory and peer-match tool. It is NOT a taxi, transport service, or commercial vehicle carrier.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTrustOrLeave}
                    onChange={(e) => setAgreeTrustOrLeave(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
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
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-amber-950 block">Clause 3: Zero Developer / Owner Support Obligation</strong>
                    <span className="text-amber-900">
                      I acknowledge and accept that the app developer, creator, and owner have NO obligation to answer my questions, investigate complaints, resolve road disputes, or provide technical guarantees.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeSocietyRules}
                    onChange={(e) => setAgreeSocietyRules(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-[11px] leading-snug">
                    <strong className="text-slate-900 block">Clause 4: Punctuality & Society Code of Conduct</strong>
                    <span className="text-slate-600">
                      I agree to abide by all resident society bylaws, maintain civil behavior with co-residents, and give advance notice for cancellations.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
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
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
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
