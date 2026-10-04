import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from './firebaseClient';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { supabase } from './supabaseClient';

export interface FCMStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  error?: string;
}

let currentToken: string | null = localStorage.getItem('gsi_fcm_token');
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register Service Worker for FCM Background Notifications
 */
export async function registerFCMServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    swRegistration = registration;
    console.log('[FCM] Service Worker registered with scope:', registration.scope);
    return registration;
  } catch (err) {
    console.warn('[FCM] Service worker registration error:', err);
    return null;
  }
}

export const VAPID_PUBLIC_KEY = 'BBpVZZ3789eDL53X-9jV_R7MdMlUtig8IJVWd9wVsvn-QgVbNqHLvz350x_J937EQj8XzK2lPBgqzb3gYDN84QQ';

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request Notification Permission and obtain Web Push / FCM Subscription
 */
export async function requestFCMToken(userId?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[WebPush] Notification permission was not granted:', permission);
      return null;
    }

    const registration = swRegistration || (await registerFCMServiceWorker());
    if (!registration) {
      console.warn('[WebPush] Cannot get token without service worker registration.');
      return null;
    }

    // Subscribe to standard Web Push
    try {
      const applicationServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      if (sub) {
        const subJson = sub.toJSON();
        const subString = JSON.stringify(subJson);
        currentToken = subString;
        localStorage.setItem('gsi_fcm_token', subString);
        console.log('[WebPush] Web Push subscription obtained successfully!');

        // Save subscription to server endpoint
        if (userId) {
          try {
            await fetch('/api/save-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, subscription: subJson })
            });
          } catch (e) {
            console.warn('[WebPush] Server subscription sync note:', e);
          }

          await saveTokenToDatabase(userId, subString);
        }

        return subString;
      }
    } catch (wpErr) {
      console.warn('[WebPush] Web Push subscription note:', wpErr);
    }

    // Fallback to Firebase Messaging getToken if available
    const supported = await isSupported();
    if (supported) {
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_PUBLIC_KEY
      });

      if (token) {
        currentToken = token;
        localStorage.setItem('gsi_fcm_token', token);
        if (userId) await saveTokenToDatabase(userId, token);
        return token;
      }
    }
  } catch (err: any) {
    console.warn('[WebPush] Error retrieving device push token:', err);
  }

  return null;
}

/**
 * Save token in Supabase profile and Firestore fcm_tokens
 */
export async function saveTokenToDatabase(userId: string, token: string): Promise<void> {
  try {
    // 1. Save to Supabase user_push_tokens table
    try {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        token: token,
        platform: 'pwa',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,token' });
      console.log('[FCM] Token stored in Supabase user_push_tokens.');
    } catch (sbErr) {
      console.warn('[FCM] Supabase user_push_tokens note:', sbErr);
    }

    // 2. Save to Firestore fcm_tokens collection
    try {
      const tokenDocRef = doc(db, 'fcm_tokens', `${userId}_web`);
      await setDoc(tokenDocRef, {
        userId,
        token,
        platform: 'web',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('[FCM] Token stored in Firestore for background dispatch.');
    } catch (fsErr) {
      console.warn('[FCM] Firestore token sync note:', fsErr);
    }
  } catch (err) {
    console.warn('[FCM] Error saving token to database:', err);
  }
}

/**
 * Listen for foreground push messages
 */
export function setupForegroundMessageListener(onNotification: (payload: any) => void) {
  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground push message received:', payload);
        onNotification(payload);

        // Also display native notification if allowed
        if (Notification.permission === 'granted') {
          const title = payload.notification?.title || payload.data?.title || 'GSI PRO — Alerta de Ponto';
          new Notification(title, {
            body: payload.notification?.body || payload.data?.body || 'Lembrete de ponto!',
            icon: '/icons/icon-192.jpg',
            tag: payload.data?.tag || 'ponto-foreground'
          });
        }
      });
    } catch (err) {
      console.warn('[FCM] Foreground listener init note:', err);
    }
  });
}

/**
 * Send a background test push notification via Service Worker
 * Allows workers to test closing the app and seeing the notification appear!
 */
export async function testBackgroundNotification(delaySeconds: number = 4): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration || !registration.active) {
    alert('O Service Worker de notificações ainda está a iniciar. Aguarde alguns segundos e tente novamente.');
    return false;
  }

  registration.active.postMessage({
    type: 'TEST_BACKGROUND_NOTIFICATION',
    delayMs: delaySeconds * 1000,
    body: `Alerta disparado com sucesso via Firebase Cloud Messaging! Você pode registar o seu ponto mesmo com o app fechado.`
  });

  return true;
}

/**
 * Sync shift reminder schedule with the Service Worker
 */
export async function syncRemindersWithServiceWorker(settings: {
  enabled: boolean;
  entryHour: number;
  entryMinute?: number;
  exitHour: number;
  exitMinute?: number;
  days?: number[];
}): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'SYNC_REMINDER_SETTINGS',
        settings
      });
    }
  } catch (err) {
    console.warn('[FCM] Error syncing reminders with SW:', err);
  }
}

/**
 * Triggers a background push notification request by adding a document to the fcm_notifications_queue.
 */
export async function triggerBackgroundNotification(notification: {
  senderId: string;
  senderName: string;
  recipientId: string; // Recipient User ID, 'all' (announcements), or 'group_{groupId}'
  title: string;
  body: string;
  type: 'private_message' | 'group_message' | 'announcement' | 'call';
  data?: Record<string, string>;
}): Promise<void> {
  // 1. Dispatch real Web Push through server endpoint (wakes up closed phones/browsers!)
  try {
    const resp = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: notification.recipientId,
        title: notification.title,
        body: notification.body,
        type: notification.type === 'private_message' ? 'message' : notification.type,
        data: {
          ...notification.data,
          senderId: notification.senderId,
          senderName: notification.senderName
        }
      })
    });
    const result = await resp.json();
    console.log('[WebPush API] Push dispatch result:', result);
  } catch (pushErr) {
    console.warn('[WebPush API] Push dispatch note:', pushErr);
  }

  // 2. Also log to Firestore queue as fallback
  try {
    await addDoc(collection(db, 'fcm_notifications_queue'), {
      senderId: notification.senderId,
      senderName: notification.senderName,
      recipientId: notification.recipientId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      status: 'pending',
      createdAt: serverTimestamp(),
      data: notification.data || {}
    });
  } catch (err) {}
}
