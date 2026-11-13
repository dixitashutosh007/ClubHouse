'use client';

import { useState } from 'react';
import { useIsClient } from '@/hooks/useIsClient';
import { enablePush, isPushConfigured } from '@/lib/firebase/push';

export function useNotifications() {
  const isClient = useIsClient();
  const isSupported = isClient && 'Notification' in window && 'serviceWorker' in navigator;
  // Set after the user answers the permission prompt; otherwise read the browser's value
  const [answeredPermission, setPermission] = useState<NotificationPermission | null>(null);
  const permission: NotificationPermission =
    answeredPermission ?? (isSupported ? Notification.permission : 'default');

  const requestPermission = async () => {
    if (!isSupported) return false;
    try {
      // With Firebase push configured, register this phone so alerts arrive even when the app is closed
      if (isPushConfigured()) {
        const outcome = await enablePush();
        setPermission(Notification.permission);
        if (outcome !== 'enabled') return false;
      }
      const result = isPushConfigured() ? Notification.permission : await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        // Send a friendly local test notification
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('Club House notifications enabled', {
            body: 'You will now receive updates on matches, seat requests, and confirmations.',
            icon: '/icons/icon-192.png',
          });
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error requesting notification permission', e);
      return false;
    }
  };

  return {
    isSupported,
    permission,
    requestPermission,
  };
}
