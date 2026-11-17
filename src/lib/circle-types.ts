import type { CircleType, SocietySettings } from '@/types';

/** The circle types a society starts with; admins change them in Society Settings */
export const DEFAULT_CIRCLE_TYPES: CircleType[] = [
  {
    name: 'Sports',
    subTypes: ['Cricket', 'Football', 'Chess', 'Games', 'Basketball', 'Snooker', 'Table Tennis', 'Badminton', 'Squash', 'Tennis Ball Cricket', 'Box Cricket'],
  },
  { name: 'Yoga', subTypes: [] },
  { name: 'Community', subTypes: [] },
  { name: 'Dance', subTypes: [] },
  { name: 'Music', subTypes: [] },
  { name: 'Party', subTypes: [] },
  { name: 'Other', subTypes: [] },
];

export const DEFAULT_MAX_CIRCLES_PER_RESIDENT = 5;

/** The society's circle types, or the defaults until an admin sets them */
export function circleTypesFor(settings: Pick<SocietySettings, 'circleTypes'> | undefined): CircleType[] {
  return settings?.circleTypes?.length ? settings.circleTypes : DEFAULT_CIRCLE_TYPES;
}

export function maxCirclesFor(settings: Pick<SocietySettings, 'maxCirclesPerResident'> | undefined): number {
  return settings?.maxCirclesPerResident ?? DEFAULT_MAX_CIRCLES_PER_RESIDENT;
}

/** Days a resident waits after a rejected join request before asking again */
export const CIRCLE_REQUEST_COOLDOWN_DAYS = 3;

/** A closed circle stays readable for its members this long, then is archived */
export const CIRCLE_ARCHIVE_DAYS = 60;

/** Closed more than 60 days ago: hidden from members, kept for society admins */
export function isCircleArchived(circle: { status: string; closedAt?: string }, now = Date.now()): boolean {
  return circle.status === 'CLOSED' && Boolean(circle.closedAt) && now - Date.parse(circle.closedAt!) > CIRCLE_ARCHIVE_DAYS * 86_400_000;
}
