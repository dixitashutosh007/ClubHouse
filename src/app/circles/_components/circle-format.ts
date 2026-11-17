import type { CircleView } from '@/lib/services/circles';

/** "Sports · Cricket" */
export function circleTypeLabel(c: Pick<CircleView, 'type' | 'subType'>): string {
  return c.subType ? `${c.type} · ${c.subType}` : c.type;
}

/** Who the circle is for, in plain words */
export function circleAudienceLabel(c: Pick<CircleView, 'audience' | 'ageMin' | 'ageMax'>): string {
  switch (c.audience) {
    case 'WOMEN':
      return 'Women only';
    case 'MEN':
      return 'Men only';
    case 'KIDS':
      return 'Kids';
    case 'AGE_RANGE':
      return `Ages ${c.ageMin ?? '?'}–${c.ageMax ?? '?'}`;
    default:
      return 'Everyone';
  }
}

export function memberCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'member' : 'members'}`;
}

/** The viewer's own status, for badges */
export function viewerStatusLabel(c: CircleView): string | null {
  if (c.viewer.role === 'OWNER') return 'Owner';
  if (c.viewer.role === 'CO_ADMIN') return 'Co-admin';
  if (c.viewer.status === 'APPROVED') return 'Member';
  if (c.viewer.status === 'REQUESTED') return 'Request sent';
  if (c.viewer.status === 'REJECTED') return 'Not approved';
  return null;
}

export function circleStatusLabel(status: CircleView['status'], archived = false): string | null {
  if (archived) return 'Archived';
  if (status === 'PENDING_APPROVAL') return 'Waiting for approval';
  if (status === 'REJECTED') return 'Not approved';
  if (status === 'CLOSED') return 'Closed';
  return null;
}

/** True while a time is still ahead (read on the client only) */
export function isStillAhead(iso: string | undefined): boolean {
  return Boolean(iso) && Date.parse(iso!) > Date.now();
}
