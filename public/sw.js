// Service Worker with support for offline caching, Push Notifications and Client Messages
const CACHE_NAME = 'asyifa-mart-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and exclude Supabase or API endpoints from cache
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (url.includes('/supabase') || url.includes('/api/') || url.includes('supabase.co')) {
    return; // Fetch directly from network
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch a fresh version in background and update the cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* Silent ignore on offline network errors */ });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache newly fetched assets of same-origin
          if (networkResponse.status === 200 && url.startsWith(self.location.origin)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback to index.html for SPA client-side routes if offline
          if (event.request.mode === 'navigate') {
            const cache = await caches.open(CACHE_NAME);
            const cachedIndex = await cache.match('/');
            if (cachedIndex) return cachedIndex;
          }
          return new Response('Koneksi Anda terputus. Silakan coba beberapa saat lagi.', {
            status: 503,
            statusText: 'Offline',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
    })
  );
});

// Handle real Web Push notifications from a server
self.addEventListener('push', (event) => {
  let data = { title: 'ASYIFA MART', body: 'Ada perubahan status pesanan Anda!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'ASYIFA MART', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-512.png',
    badge: data.badge || '/icon-512.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle Client Messages to trigger notifications locally (emulated push)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
    const { title, body, icon, tag } = event.data;
    const options = {
      body: body,
      icon: icon || '/icon-512.png',
      badge: icon || '/icon-512.png',
      vibrate: [100, 50, 100],
      tag: tag || 'order-status-update',
      renotify: true,
      data: {
        url: '/#orders'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Handle clicking on notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Kalau sudah ada tab yang buka app, fokus dan navigasi ke URL tujuan
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      // Belum ada tab, buka window baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
