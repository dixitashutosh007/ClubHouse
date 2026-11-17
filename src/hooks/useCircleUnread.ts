'use client';

import { useAuth } from '@/context/AuthContext';
import { useApiData } from '@/hooks/useApiData';

/** Unread message counts per circle for the signed-in resident (circle id → count) */
export function useCircleUnread(): { unread: Record<string, number>; total: number } {
  const { activePersona, society, membership } = useAuth();
  const { data } = useApiData(
    membership?.status === 'ACTIVE' ? '/api/v1/circles/messages/unread' : null,
    (json) => json as { unread: Record<string, number>; total: number },
    'Could not load unread messages.',
    `${activePersona}:${society?.id ?? ''}`
  );
  return data ?? { unread: {}, total: 0 };
}

/** "3 new", or "99+ new" at the cap */
export function unreadLabel(n: number): string {
  return `${n >= 99 ? '99+' : n} new`;
}
