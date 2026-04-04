// Firebase Messaging Service Worker
// Ce fichier DOIT être à la racine /public pour que FCM fonctionne

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// La config est injectée dynamiquement via le message FIREBASE_CONFIG
let messaging = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    const firebaseConfig = event.data.config;
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    messaging = firebase.messaging();

    // Gestion des messages en background
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const data = payload.data || {};

      self.registration.showNotification(title || 'Papyri', {
        body: body || '',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data,
        actions: [
          { action: 'open', title: 'Ouvrir' },
          { action: 'dismiss', title: 'Ignorer' },
        ],
        vibrate: [200, 100, 200],
      });
    });
  }
});

// Clic sur la notification → ouvre l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenêtre est déjà ouverte, la focus
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'NOTIFICATION_CLICK', data });
            return;
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
