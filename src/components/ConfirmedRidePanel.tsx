'use client';

import { Car, CheckCircle2, Home, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { RideContactActions } from '@/components/RideContactActions';
import { TripSafetyActions } from '@/components/TripSafetyActions';
import { seekerGreeting } from '@/lib/utils/contact';

interface ConfirmedRidePanelProps {
  offererName: string;
  offererFlat?: string;
  offererMobile?: string;
  /** e.g. "White Honda City" */
  vehicleName?: string;
  plate?: string;
  /** Where to meet, e.g. "Main Gate" */
  meetingPoint: string;
  destination: string;
  /** e.g. "Tomorrow, 8:30 am" */
  when: string;
  /** Show the time next to the meeting point (when the card doesn't already show it) */
  showTime?: boolean;
  journeyId?: string;
  offererPhoto?: string;
}

/**
 * What a resident sees once their request to join a ride is accepted: the
 * car to look for, where to meet, how to reach their fellow resident, and
 * safety sharing.
 */
export function ConfirmedRidePanel({
  offererName,
  offererFlat,
  offererMobile,
  vehicleName,
  plate,
  meetingPoint,
  destination,
  when,
  showTime = false,
  journeyId,
  offererPhoto,
}: ConfirmedRidePanelProps) {
  const { user, society } = useAuth();

  return (
    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 flex flex-col gap-3">
      <p className="font-bold text-emerald-900 flex items-start gap-2 leading-snug">
        {offererPhoto ? (
          <Avatar name={offererName} photoUrl={offererPhoto} size={36} />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-px" aria-hidden="true" />
        )}
        <span>{offererName}, a fellow resident, has graciously accepted your request to ride along.</span>
      </p>

      {(vehicleName || plate) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 rounded-xl bg-white border border-emerald-200">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-600">Look for</p>
            {vehicleName && <p className="font-bold text-slate-900 break-words">{vehicleName}</p>}
          </div>
          {plate && (
            <span className="shrink-0 font-mono font-bold text-[13px] tracking-wide text-slate-900 bg-amber-100 border border-amber-300 px-2 py-1 rounded-md">
              {plate}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-1 text-slate-800">
        <p className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Meet at <span className="font-semibold">{meetingPoint}</span>
            {showTime ? `, ${when}` : ''}
          </span>
        </p>
        {offererFlat && (
          <p className="flex items-start gap-1.5">
            <Home className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Flat <span className="font-semibold">{offererFlat}</span>
            </span>
          </p>
        )}
      </div>

      {offererMobile && (
        <RideContactActions
          name={offererName}
          mobile={offererMobile}
          message={seekerGreeting({
            toName: offererName,
            fromName: user?.fullName ?? '',
            societyName: society?.name,
            destination,
            when,
            meetingPoint,
          })}
        />
      )}

      <TripSafetyActions
        trip={{
          role: 'SEEKER',
          companionName: offererName,
          vehicle: vehicleName,
          plate,
          from: meetingPoint,
          to: destination,
          when,
          journeyId,
        }}
      />
    </div>
  );
}
