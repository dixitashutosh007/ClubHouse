import type { UpcomingRide } from '@/hooks/useMyUpcomingRides';
import type { ClassListing } from '@/types';

export interface HomeSummary {
  /** The next ride the resident is confirmed on (offering or accepted), if any */
  nextRide: UpcomingRide | null;
  /** RideShare tile line, only when there is something real to say */
  rideDetail?: string;
  /** Classes tile line, only when classes are live */
  classDetail?: string;
  /** Up to three most recently posted live classes */
  newClasses: ClassListing[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What Home shows, from data the resident's account already has. Nothing
 * is invented: a section without data is left out.
 */
export function homeSummary(upcoming: UpcomingRide[], liveClasses: ClassListing[]): HomeSummary {
  return {
    nextRide: upcoming.find((r) => r.confirmed) ?? null,
    rideDetail: upcoming.length ? `${plural(upcoming.length, 'upcoming ride')}` : undefined,
    classDetail: liveClasses.length ? `${plural(liveClasses.length, 'class', 'classes')} live` : undefined,
    newClasses: [...liveClasses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
  };
}

/** "Rohan" from "Rohan Gupta"; empty when there is no real name yet */
export function firstName(fullName: string | undefined): string {
  const name = (fullName ?? '').trim();
  if (!name || name === 'Resident Member') return '';
  return name.split(/\s+/)[0];
}
