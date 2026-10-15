import { useState, useEffect, useCallback, useRef } from 'react';
import { getMonthlySavingsNotification, getDailyNotification } from './notificationMessages';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  vibrate?: number[];
  requireInteraction?: boolean;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotification(currentMemberName?: string) {
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(false);
  const memberNameRef = useRef(currentMemberName);

  useEffect(() => {
    memberNameRef.current = currentMemberName;
    if (currentMemberName) {
      localStorage.setItem('al_ittehad_cached_member_name', currentMemberName);
    }
  }, [currentMemberName]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermissionStatus);
    } else {
      setIsSupported(false);
      setPermission('unsupported');
    }
  }, []);

  const sendNotification = useCallback(async ({
    title,
    body,
    icon = '/pwa-192x192.png',
    badge = '/favicon.ico',
    data = {},
    tag,
    vibrate = [200, 100, 200],
    requireInteraction = false
  }: PushNotificationOptions): Promise<boolean> => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    try {
      // Prefer service worker showNotification for mobile PWA and background support
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon,
            badge,
            data: { url: window.location.origin, ...data },
            tag: tag || `ittehad-${Date.now()}`,
            vibrate,
            requireInteraction
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
      console.error('Error sending notification:', error);
      try {
        new Notification(title, { body, icon });
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  // Register Web Push subscription on server (for background push even when app is closed)
  const subscribeToWebPush = useCallback(async (customMemberInfo?: any) => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const res = await fetch('/api/notifications/vapid-public-key');
      if (!res.ok) return false;
      const { publicKey } = await res.json();
      if (!publicKey) return false;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      if (subscription) {
        const cachedName = memberNameRef.current || localStorage.getItem('al_ittehad_cached_member_name') || 'সম্মানিত সদস্য';
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            memberInfo: customMemberInfo || { name: cachedName, role: 'member' }
          })
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Web push subscription note:', err);
      return false;
    }
  }, []);

  // Check and fire scheduled notifications (Monthly 1st & Daily custom notification)
  const checkAndSendScheduledNotifications = useCallback((customName?: string) => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

    const name = customName || memberNameRef.current || localStorage.getItem('al_ittehad_cached_member_name') || 'সম্মানিত সদস্য';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDay = now.getDate();
    const monthKey = `${currentYear}-${currentMonth}`;
    const dayKey = `${currentYear}-${currentMonth}-${String(currentDay).padStart(2, '0')}`;

    // 1. Check Monthly 1st savings reminder
    if (currentDay === 1) {
      const lastMonthly = localStorage.getItem('al_ittehad_monthly_notified');
      if (lastMonthly !== monthKey) {
        const monthly = getMonthlySavingsNotification(name);
        sendNotification({
          title: monthly.title,
          body: monthly.body,
          tag: `monthly-savings-${monthKey}`,
          requireInteraction: true
        });
        localStorage.setItem('al_ittehad_monthly_notified', monthKey);
      }
    }

    // 2. Check Daily custom notification
    const lastDaily = localStorage.getItem('al_ittehad_daily_notified');
    if (lastDaily !== dayKey) {
      // If it's day 1, monthly notification was already prioritized
      if (currentDay !== 1) {
        const daily = getDailyNotification(now, name);
        sendNotification({
          title: daily.title,
          body: daily.body,
          tag: `daily-ittehad-${dayKey}`
        });
      }
      localStorage.setItem('al_ittehad_daily_notified', dayKey);
    }
  }, [sendNotification]);

  // Request Notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionStatus);

      if (result === 'granted') {
        const name = memberNameRef.current || localStorage.getItem('al_ittehad_cached_member_name') || 'সম্মানিত সদস্য';

        // 1. Send welcoming confirmation notification
        sendNotification({
          title: 'আল ইত্তেহাদ ফোরাম',
          body: '🎉 অভিনন্দন! পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে। প্রতি মাসের ১ তারিখে সঞ্চয়ের নোটিশ এবং প্রতিদিন সুন্দর আপডেট সরাসরি আপনার ডিভাইসে পাবেন।',
          tag: 'welcome-notification'
        });

        // 2. Subscribe to server Web Push for background delivery
        await subscribeToWebPush();

        // 3. Immediately run schedule check
        checkAndSendScheduledNotifications(name);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [sendNotification, subscribeToWebPush, checkAndSendScheduledNotifications]);

  // Run schedule check on load and set up periodic timer
  useEffect(() => {
    if (permission === 'granted') {
      checkAndSendScheduledNotifications();
      subscribeToWebPush();

      // Check once every 30 minutes in foreground/tab
      const interval = setInterval(() => {
        checkAndSendScheduledNotifications();
      }, 30 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [permission, checkAndSendScheduledNotifications, subscribeToWebPush]);

  // Test triggers for previewing
  const triggerMonthlySavingsTest = useCallback((customName?: string) => {
    const name = customName || memberNameRef.current || localStorage.getItem('al_ittehad_cached_member_name') || 'সম্মানিত সদস্য';
    const monthly = getMonthlySavingsNotification(name);
    return sendNotification({
      title: monthly.title,
      body: monthly.body,
      tag: `test-monthly-${Date.now()}`,
      requireInteraction: true
    });
  }, [sendNotification]);

  const triggerDailyNotificationTest = useCallback((customName?: string) => {
    const name = customName || memberNameRef.current || localStorage.getItem('al_ittehad_cached_member_name') || 'সম্মানিত সদস্য';
    const daily = getDailyNotification(new Date(), name);
    return sendNotification({
      title: daily.title,
      body: daily.body,
      tag: `test-daily-${Date.now()}`
    });
  }, [sendNotification]);

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    subscribeToWebPush,
    checkAndSendScheduledNotifications,
    triggerMonthlySavingsTest,
    triggerDailyNotificationTest,
    isGranted: permission === 'granted'
  };
}
