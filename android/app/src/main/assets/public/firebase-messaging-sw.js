// Firebase Cloud Messaging Service Worker for GSI PRO
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
const firebaseConfig = {
  projectId: "gen-lang-client-0974852104",
  appId: "1:363493350499:web:6455bf8e21c76e3011ac56",
  apiKey: "AIzaSyCBnWRc97iFCW7y7mQ-nTNiJK8nur-KfXM",
  authDomain: "gen-lang-client-0974852104.firebaseapp.com",
  messagingSenderId: "363493350499",
  storageBucket: "gen-lang-client-0974852104.firebasestorage.app"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('FCM compat initialization warning in SW:', e);
}

// Global state for scheduled reminders in Service Worker
let activeReminders = {
  enabled: true,
  entryHour: 8,
  entryMinute: 0,
  exitHour: 17,
  exitMinute: 0,
  days: [1, 2, 3, 4, 5, 6] // Seg-Sab
};

// Handle FCM Background Messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'GSI PRO — Alerta de Ponto';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Lembrete: Não se esqueça de registar a sua jornada de hoje!',
      icon: payload.notification?.icon || payload.data?.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.data?.tag || 'ponto-reminder',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: payload.data?.url || '/',
        action: payload.data?.action || 'open_ponto',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'open_ponto',
          title: '⏱️ Registar Ponto'
        },
        {
          action: 'dismiss',
          title: 'Dispensar'
        }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle standard Web Push events & FCM background payloads
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'GSI PRO', body: event.data.text() };
    }
  }

  console.log('[ServiceWorker] Push event received in background:', data);

  const type = data.type || data.data?.type || 'general';
  const isCall = type === 'call';
  const isMessage = type === 'message' || type === 'private_message';

  const title = data.title || (isCall ? '📞 Chamada a Receber!' : (isMessage ? '💬 Nova Mensagem' : 'GSI PRO'));
  const body = data.body || (isCall ? 'Alguém está a ligar no GSI Pro...' : 'Você recebeu uma nova notificação.');

  const options = {
    body: body,
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: isCall ? 'incoming-call' : (isMessage ? `msg-${data.data?.senderId || Date.now()}` : 'gsi-push'),
    renotify: true,
    requireInteraction: isCall, // Calls stay on screen until answered or rejected!
    vibrate: isCall ? [600, 300, 600, 300, 600, 300, 600] : [250, 100, 250],
    data: {
      url: isCall ? '/?incomingCall=true' : (isMessage ? '/?openMessenger=true' : '/'),
      type: type,
      senderId: data.data?.senderId || '',
      senderName: data.data?.senderName || '',
      senderAvatar: data.data?.senderAvatar || '',
      callType: data.data?.callType || 'video',
      timestamp: Date.now()
    },
    actions: isCall ? [
      { action: 'answer', title: '📞 Atender' },
      { action: 'decline', title: '❌ Recusar' }
    ] : [
      { action: 'open_chat', title: '💬 Responder' },
      { action: 'dismiss', title: 'Fechar' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler: Opens/focuses the app on the Call, Chat or Ponto
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};

  if (action === 'decline' || action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an app window is already open, focus it and dispatch internal event
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (notifData.type === 'call') {
            client.postMessage({
              type: 'INCOMING_CALL_NOTIFICATION',
              payload: notifData
            });
          } else if (notifData.senderId) {
            client.postMessage({
              type: 'OPEN_MESSENGER_CHAT',
              senderId: notifData.senderId
            });
          } else {
            client.postMessage({ type: 'NAVIGATE_TO_PONTO' });
          }
          return client.focus();
        }
      }

      // 2. If app is completely closed, open a fresh window with targeted query parameters
      if (clients.openWindow) {
        const urlToOpen = new URL('/', self.location.origin);
        if (notifData.type === 'call') {
          urlToOpen.searchParams.set('incomingCall', 'true');
          urlToOpen.searchParams.set('callerId', notifData.senderId || '');
          urlToOpen.searchParams.set('callerName', notifData.senderName || '');
          urlToOpen.searchParams.set('callerAvatar', notifData.senderAvatar || '');
          urlToOpen.searchParams.set('callType', notifData.callType || 'video');
        } else if (notifData.senderId) {
          urlToOpen.searchParams.set('openMessenger', 'true');
          urlToOpen.searchParams.set('chatWith', notifData.senderId);
        }
        return clients.openWindow(urlToOpen.href);
      }
    })
  );
});

// Message listener from web client to sync schedule and test background push
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_REMINDER_SETTINGS') {
    activeReminders = { ...activeReminders, ...event.data.settings };
    console.log('[firebase-messaging-sw.js] Synced reminders in background:', activeReminders);
  }

  if (event.data.type === 'TEST_BACKGROUND_NOTIFICATION') {
    const delayMs = event.data.delayMs || 1000;
    setTimeout(() => {
      self.registration.showNotification('🔔 GSI PRO — Alerta de Ponto (Push FCM)', {
        body: event.data.body || 'Alerta recebido com sucesso! O sistema de notificações continua ativo mesmo com o app fechado.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'test-ponto-fcm',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        data: { url: '/', action: 'open_ponto' },
        actions: [
          { action: 'open_ponto', title: '⏱️ Registar Ponto Agora' },
          { action: 'dismiss', title: 'Entendido' }
        ]
      });
    }, delayMs);
  }
});

// PWA Offline Cache & Installability support
const CACHE_NAME = 'gsi-pro-v2';
const PWA_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PWA_ASSETS.map((asset) => cache.add(asset).catch(() => null))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

// Chromium PWA Installability requires a fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept development modules, Vite internals, TypeScript files, node_modules or API calls
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('node_modules') ||
    url.search.includes('import') ||
    url.search.includes('t=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.jsx')
  ) {
    return;
  }

  // Let navigation requests fall back to index.html ONLY if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static icons / manifest
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => fetch(event.request))
    );
  }
});
