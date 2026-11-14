import { istDateOf, istDateString } from '@/lib/utils/time';

export interface NotificationGroup<T> {
  label: 'Today' | 'Earlier';
  items: T[];
}

/**
 * Splits notifications (newest first) into Today and Earlier by their
 * Asia/Kolkata date. Empty groups are left out.
 */
export function groupNotifications<T extends { createdAt: string }>(items: T[], now: Date = new Date()): NotificationGroup<T>[] {
  const today = istDateString(now);
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: NotificationGroup<T>[] = [
    { label: 'Today', items: sorted.filter((n) => istDateOf(n.createdAt) === today) },
    { label: 'Earlier', items: sorted.filter((n) => istDateOf(n.createdAt) !== today) },
  ];
  return groups.filter((g) => g.items.length > 0);
}
