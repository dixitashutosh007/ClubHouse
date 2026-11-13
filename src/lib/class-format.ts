import { ClassListing } from '@/types';
import { formatHHMM12, formatIstDay } from '@/lib/utils/time';

/**
 * How a class is described everywhere it appears (cards, details, admin
 * lists), so the same class never reads two different ways.
 */

const DAY: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };

export function classLocationLabel(cls: Pick<ClassListing, 'locationType' | 'locationDetail'>): string {
  if (cls.locationDetail) return cls.locationDetail;
  if (cls.locationType === 'CLUBHOUSE') return 'Clubhouse';
  if (cls.locationType === 'FLAT') return "Teacher's flat";
  return 'Society premises';
}

/** "Mon, Wed, Fri", "Sat, 21 Nov" for a one-off class, or "Flexible days" */
export function classDaysLabel(cls: Pick<ClassListing, 'classType' | 'classDate' | 'scheduleDays'>): string {
  if (cls.classType !== 'REGULAR' && cls.classDate) return formatIstDay(cls.classDate);
  if (!cls.scheduleDays?.length || cls.scheduleDays.includes('FLEXIBLE')) return 'Flexible days';
  return cls.scheduleDays.map((d) => DAY[d] ?? d).join(', ');
}

/** "7:00 AM · 60 min", or "Time flexible" */
export function classTimeLabel(cls: Pick<ClassListing, 'startTime' | 'durationMinutes'>): string {
  if (!cls.startTime) return 'Time flexible';
  return `${formatHHMM12(cls.startTime)}${cls.durationMinutes ? ` · ${cls.durationMinutes} min` : ''}`;
}

export function classFeeLabel(cls: Pick<ClassListing, 'feeType' | 'feeAmount'>): string {
  if (cls.feeType === 'FREE') return 'Free';
  if (!cls.feeAmount) return 'Flexible';
  const amount = `₹${cls.feeAmount.toLocaleString('en-IN')}`;
  const per = { PER_SESSION: ' / session', PER_MONTH: ' / month', PER_COURSE: ' / course' }[cls.feeType] ?? '';
  return `${amount}${per}`;
}

export function classAgeLabel(cls: Pick<ClassListing, 'noAgeLimit' | 'ageMin' | 'ageMax'>): string {
  if (cls.noAgeLimit) return 'All ages';
  if (cls.ageMin !== undefined && cls.ageMax !== undefined) return `Ages ${cls.ageMin}–${cls.ageMax}`;
  if (cls.ageMin !== undefined) return `Ages ${cls.ageMin}+`;
  return 'All ages';
}
