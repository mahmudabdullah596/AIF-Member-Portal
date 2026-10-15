// Service Worker Web Push & Notification Handler for Al-Ittihad Forum
// Handles background push events, notification click actions, and scheduled notifications

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'আল ইত্তেহাদ ফোরাম',
        body: event.data.text()
      };
    }
  }

  const title = data.title || 'আল ইত্তেহাদ ফোরাম';
  const options = {
    body: data.body || 'আপনার জন্য নতুন নোটিফিকেশন এসেছে।',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/favicon.ico',
    data: data.data || { url: '/' },
    tag: data.tag || `al-ittehad-${Date.now()}`,
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a tab is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Support for periodic background sync if supported by browser
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'check-al-ittehad-notifications') {
    event.waitUntil(
      fetch('/api/notifications/today')
        .then(res => res.json())
        .then(info => {
          if (info && info.notification) {
            return self.registration.showNotification(info.notification.title, {
              body: info.notification.body,
              icon: '/pwa-192x192.png',
              badge: '/favicon.ico',
              tag: `daily-${info.dateStr}`
            });
          }
        })
        .catch(err => console.log('Periodic sync notification error:', err))
    );
  }
});
