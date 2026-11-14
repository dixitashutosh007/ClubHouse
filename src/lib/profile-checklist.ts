import type { User } from '@/types';

export interface ChecklistItem {
  id: 'photo' | 'work' | 'vehicle';
  label: string;
  /** Section on the profile page that completes it */
  href: string;
  done: boolean;
}

/**
 * What a resident can still add to their profile, worked out only from what
 * is saved: a photo, a work location picked from the suggestions (so it has
 * coordinates) and, for residents who mainly offer rides, a vehicle.
 */
export function profileChecklist(
  user: Pick<User, 'profilePhotoUrl' | 'workLocationName' | 'workLatitude' | 'workLongitude' | 'commuteIntent'>,
  vehicleCount: number
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'photo', label: 'Add a profile photo', href: '#profile-photo', done: Boolean(user.profilePhotoUrl) },
    {
      id: 'work',
      label: 'Add your work location',
      href: '#commute',
      done: Boolean(user.workLocationName && user.workLatitude !== undefined && user.workLongitude !== undefined),
    },
  ];
  if (user.commuteIntent === 'OFFERER' || user.commuteIntent === 'BOTH' || vehicleCount > 0) {
    items.push({ id: 'vehicle', label: 'Add your vehicle', href: '#vehicles', done: vehicleCount > 0 });
  }
  return items;
}
