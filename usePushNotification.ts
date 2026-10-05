import { useState, useEffect, useCallback } from 'react';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  vibrate?: number[];
}

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermissionStatus);
    } else {
      setIsSupported(false);
      setPermission('unsupported');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionStatus);

      if (result === 'granted') {
        // Send a celebratory welcome push notification
        sendNotification({
          title: 'আল ইত্তেহাদ ফোরাম',
          body: '🎉 অভিনন্দন! পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে। গুরুত্বপূর্ণ নোটিশ ও আর্থিক আপডেট এখন সময়মতো পাবেন।',
          tag: 'welcome-notification'
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const sendNotification = useCallback(async ({
    title,
    body,
    icon = '/pwa-192x192.png',
    badge = '/favicon.ico',
    data = {},
    tag,
    vibrate = [200, 100, 200]
  }: PushNotificationOptions): Promise<boolean> => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    try {
      // Prefer service worker showNotification for mobile PWA support
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon,
            badge,
            data: { url: window.location.origin, ...data },
            tag: tag || `ittehad-${Date.now()}`,
            vibrate
          } as any);
          return true;
        }
      }

      // Fallback to standard window.Notification
      new Notification(title, {
        body,
        icon,
        badge,
        tag: tag || `ittehad-${Date.now()}`
      });
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      try {
        new Notification(title, { body, icon });
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    isGranted: permission === 'granted'
  };
}
