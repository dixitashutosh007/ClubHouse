'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Bike, Car, CheckCircle2, Home, Search, Send, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { AgreementDialog } from '@/components/AgreementDialog';
import { FormSection } from '@/components/ui/Layout';
import { OnboardingProgress } from '@/components/ui/OnboardingProgress';
import { cn } from '@/components/ui/cn';
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
  const [error, setErrorText] = useState('');
  // Which field the message is about, so it shows right under that field
  const [errorField, setErrorField] = useState('');
  const setError = (text: string, field = '') => {
    setErrorText(text);
    setErrorField(text ? field : '');
  };
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
      setError('Please provide your full legal name as registered with the society.', 'name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid work or personal email required for verification.', 'email');
      return;
    }
    if (!flatNumber.trim()) {
      setError('Flat / Apartment number is required for society verification.', 'flat');
      return;
    }
    if (!isLegalFullyAccepted) {
      setShowLegalModal(true);
      setError('Please review and check all mandatory clauses in the Club House Legal Agreement popup.', 'legal');
      return;
    }

    // Offerer vehicle validation (Requirement 2: Follow Indian standard vehicle format)
    if (commuteRole === 'OFFERER') {
      if (!make.trim() || !model.trim() || !regNumber.trim()) {
        setError('To register as a Ride Offerer, vehicle Make, Model, and Registration number are required.', 'vehicle');
        return;
      }
      const regCheck = validateIndianRegistration(regNumber);
      if (!regCheck.isValid) {
        setError(regCheck.error || 'Please enter a valid Indian vehicle number (e.g. KA-04-MB-1234 or 22-BH-1234-AA)', 'plate');
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

  const errorFor = (field: string) =>
    error && errorField === field ? (
      <p role="alert" className="flex items-start gap-1.5 text-meta font-medium text-danger">
        <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
        {error}
      </p>
    ) : null;
  const fieldErr = (field: string) => (error && errorField === field ? error : undefined);
  const HOME_ICON = 'bg-terracotta-tint text-terracotta-deep';
  const choice = (on: boolean) =>
    cn(
      'min-h-14 p-3 rounded-control border flex flex-col items-center justify-center gap-0.5 text-support font-semibold transition-colors',
      on ? 'border-terracotta-deep bg-terracotta-tint text-terracotta-deep' : 'border-line-strong bg-surface text-ink hover:bg-sunken'
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full sm:max-w-xl bg-ivory rounded-t-sheet sm:rounded-sheet shadow-overlay border border-line flex flex-col max-h-[94dvh] overflow-hidden"
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 bg-surface border-b border-line grid gap-3 shrink-0">
          <OnboardingProgress current={success ? 'Approval' : 'Details'} />
          <div>
            <p className="text-tag font-semibold uppercase tracking-wider text-terracotta-deep">{society?.name ?? 'Your society'}</p>
            <h2 id="onboarding-title" className="font-display text-section font-bold text-ink">
              Tell us about you
            </h2>
            <p className="text-support text-ink-muted">Your society admin checks your name and flat before you can use the apps.</p>
          </div>
        </div>

        {success ? (
          <div role="status" className="p-8 grid justify-items-center text-center gap-3">
            <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
            </span>
            <h3 className="font-display text-section font-bold text-ink">Sent for approval</h3>
            <p className="text-support text-ink-muted max-w-xs">
              Your details{commuteRole === 'OFFERER' ? ' and vehicle' : ''} have gone to the {society?.name} admins. We will let you know when you are approved.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid gap-4 content-start">
              <FormSection title="About you" icon={UserRound} iconClassName={HOME_ICON}>
                <div className="grid gap-1">
                  <Input
                    id="onboarding-name"
                    label="Full name"
                    hint="As your society admin knows you"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ashutosh Dixit"
                    error={fieldErr('name')}
                  />
                </div>
                <Input
                  id="onboarding-email"
                  label="Email"
                  hint="Work or personal"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  error={fieldErr('email')}
                />
                <Select
                  id="onboarding-gender"
                  label="Gender"
                  hint="Only used for rides limited to women or men. Never shown to other residents."
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </Select>
              </FormSection>

              <FormSection title="Your home" icon={Home} iconClassName={HOME_ICON}>
                <FlatNumberInput
                  label="Flat number"
                  config={society?.settings?.flatConfig}
                  placeholder={society?.settings?.flat_format_example ? `Format: ${society.settings.flat_format_example}` : 'e.g. Tower B - 804'}
                  value={flatNumber}
                  onChange={setFlatNumber}
                />
                {errorFor('flat')}
              </FormSection>

              <FormSection title="How you'll use RideShare" description="You can find and offer rides either way; this sets up your profile" icon={Car} iconClassName="bg-ride-tint text-ride-deep">
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mostly">
                  <button type="button" aria-pressed={commuteRole === 'SEEKER'} onClick={() => setCommuteRole('SEEKER')} className={choice(commuteRole === 'SEEKER')}>
                    <Search className="w-5 h-5" aria-hidden="true" />
                    Find rides
                    <span className="text-meta font-normal text-ink-muted">Ride with neighbours</span>
                  </button>
                  <button type="button" aria-pressed={commuteRole === 'OFFERER'} onClick={() => setCommuteRole('OFFERER')} className={choice(commuteRole === 'OFFERER')}>
                    <Car className="w-5 h-5" aria-hidden="true" />
                    Offer rides
                    <span className="text-meta font-normal text-ink-muted">Share your car or bike</span>
                  </button>
                </div>

                {commuteRole === 'OFFERER' && (
                  <fieldset className="grid gap-3 p-3 rounded-card bg-ride-tint/60 border border-line">
                    <legend className="px-1 text-support font-semibold text-ink">Your vehicle</legend>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vehicle type">
                      <button
                        type="button"
                        aria-pressed={vehicleType === 'CAR'}
                        onClick={() => {
                          setVehicleType('CAR');
                          setCapacity(3);
                        }}
                        className={choice(vehicleType === 'CAR')}
                      >
                        <Car className="w-5 h-5" aria-hidden="true" /> Car
                      </button>
                      <button
                        type="button"
                        aria-pressed={vehicleType === 'TWO_WHEELER'}
                        onClick={() => {
                          setVehicleType('TWO_WHEELER');
                          setCapacity(1);
                        }}
                        className={choice(vehicleType === 'TWO_WHEELER')}
                      >
                        <Bike className="w-5 h-5" aria-hidden="true" /> Two-wheeler
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input id="onboarding-make" label="Make" required value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Hyundai" />
                      <Input id="onboarding-model" label="Model" required value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Creta" />
                    </div>
                    {errorFor('vehicle')}
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        id="onboarding-plate"
                        label="Number plate"
                        required
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder="KA-04-MB-1234"
                        className="font-mono font-semibold uppercase"
                        error={fieldErr('plate')}
                      />
                      <Select id="onboarding-seats" label="Seats to offer" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
                        {vehicleType === 'TWO_WHEELER' ? (
                          <option value={1}>1 pillion seat</option>
                        ) : (
                          [1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} seat{n > 1 ? 's' : ''}
                            </option>
                          ))
                        )}
                      </Select>
                    </div>
                    <Input
                      id="onboarding-mileage"
                      label="Mileage (km per litre)"
                      hint="Only for the fuel-share estimate. Riders settle with you in person; the app takes no payments."
                      type="number"
                      min="5"
                      max="60"
                      step="0.5"
                      inputMode="decimal"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </fieldset>
                )}

                <PlacesAutocompleteInput
                  value={workLocation}
                  onChange={(loc, place) => {
                    setWorkLocation(loc);
                    setWorkCoords(place ? { lat: place.lat, lng: place.lng } : null);
                  }}
                  placeholder="Search office, tech park or metro"
                  label="Where you usually go"
                  required
                />
              </FormSection>

              <FormSection title="Agreement" icon={ShieldCheck} iconClassName={HOME_ICON}>
                <div className="flex items-center justify-between gap-3 p-3 rounded-control bg-sunken">
                  <p className="text-support text-ink">Club House terms and your society&apos;s rules</p>
                  <span
                    className={cn(
                      'shrink-0 text-tag font-semibold px-2 py-0.5 rounded-full',
                      isLegalFullyAccepted ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
                    )}
                  >
                    {isLegalFullyAccepted ? 'Accepted' : 'To do'}
                  </span>
                </div>
                <Button variant="secondary" fullWidth icon={ShieldCheck} onClick={() => setShowLegalModal(true)}>
                  {isLegalFullyAccepted ? 'Review the agreement' : 'Read and accept the agreement'}
                </Button>
                {errorFor('legal')}
              </FormSection>
            </div>

            <div className="shrink-0 p-4 sm:px-6 border-t border-line bg-surface grid gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {error && !['name', 'email', 'flat', 'legal', 'vehicle', 'plate'].includes(errorField) && (
                <p role="alert" className="flex items-start gap-2 p-3 rounded-control bg-danger-bg text-support text-danger">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {error}
                </p>
              )}
              {error && ['name', 'email', 'flat', 'legal', 'vehicle', 'plate'].includes(errorField) && (
                <p className="text-meta text-danger text-center">Please check the highlighted section above.</p>
              )}
              <Button type="submit" size="lg" fullWidth icon={Send} loading={submitting}>
                Send for approval
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* The agreement: all four clauses must be ticked */}
      <AgreementDialog
        open={showLegalModal}
        values={[agreePeerOnly, agreeTrustOrLeave, agreeNoDeveloperObligation, agreeSocietyRules]}
        onToggle={(i, on) => [setAgreePeerOnly, setAgreeTrustOrLeave, setAgreeNoDeveloperObligation, setAgreeSocietyRules][i](on)}
        onClose={() => setShowLegalModal(false)}
        onConfirm={() => {
          setShowLegalModal(false);
          setError('');
        }}
        societyName={society?.name}
        communityRules={society?.settings?.community_rules}
      />
    </div>
  );
}
