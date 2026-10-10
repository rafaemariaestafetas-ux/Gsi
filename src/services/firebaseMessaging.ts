import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from './firebaseClient';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { supabase } from './supabaseClient';

export interface FCMStatus {
  isSupported: boolean;
  permission: NotificationPermission | string;
  token: string | null;
  platform: 'android' | 'web-push' | 'pwa';
  error?: string;
}

let currentToken: string | null = localStorage.getItem('gsi_fcm_token');
let swRegistration: ServiceWorkerRegistration | null = null;
let nativeListenersInitialized = false;

export const HIGH_PRIORITY_CHANNEL_ID = 'gsi_high_priority_channel';
export const VAPID_PUBLIC_KEY = 'BBpVZZ3789eDL53X-9jV_R7MdMlUtig8IJVWd9wVsvn-QgVbNqHLvz350x_J937EQj8XzK2lPBgqzb3gYDN84QQ';

/**
 * 1. Configure Android 8.0+ High Priority Notification Channel
 * Guarantees heads-up banner, high urgency sound, and vibration for incoming calls and messages.
 */
export async function configureAndroidNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.createChannel({
      id: HIGH_PRIORITY_CHANNEL_ID,
      name: 'Chamadas e Mensagens GSI PRO',
      description: 'Notificações urgentes de chamadas e mensagens em tempo real com o app fechado',
      importance: 5, // High importance (heads-up notification & sound)
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#eab308'
    });
    console.log('[Native FCM] Canal de alta prioridade configurado com sucesso:', HIGH_PRIORITY_CHANNEL_ID);
  } catch (err) {
    console.warn('[Native FCM] Falha ao configurar canal de notificação:', err);
  }
}

/**
 * Helper to convert VAPID base64 key
 */
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
 * Register Service Worker for Web Push / PWA background notifications
 */
export async function registerFCMServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || Capacitor.isNativePlatform()) {
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

/**
 * 2. Request Notification Permission and obtain Token
 * Uses Native FCM (@capacitor/push-notifications) on Android and Web Push on Browsers/PWAs.
 */
export async function requestFCMToken(userId?: string): Promise<string | null> {
  // A. NATIVE ANDROID FLOW (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      console.log('[Native FCM] Iniciando configuração de push nativo no Android...');
      await configureAndroidNotificationChannel();

      // Check existing permissions (Android 13+ POST_NOTIFICATIONS)
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Native FCM] Status atual de permissão:', permStatus.receive);

      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Native FCM] Novo status após solicitação:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Native FCM] Permissão de notificações não concedida pelo usuário.');
        return null;
      }

      // Register with FCM and await token
      return new Promise<string | null>((resolve) => {
        let hasResolved = false;

        const timeoutId = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            const fallbackToken = localStorage.getItem('gsi_fcm_token');
            console.log('[Native FCM] Timeout aguardando token, usando cache:', fallbackToken ? 'Sim' : 'Não');
            resolve(fallbackToken);
          }
        }, 12000);

        PushNotifications.addListener('registration', async (token: Token) => {
          if (hasResolved) return;
          hasResolved = true;
          clearTimeout(timeoutId);

          const fcmToken = token.value;
          console.log('[Native FCM] Token FCM nativo obtido com sucesso:', fcmToken);
          currentToken = fcmToken;
          localStorage.setItem('gsi_fcm_token', fcmToken);
          localStorage.setItem('gsi_platform', 'android');

          if (userId) {
            await saveTokenToDatabase(userId, fcmToken, 'android');
          }

          resolve(fcmToken);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('[Native FCM] Erro no registro de notificações:', error);
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        });

        // Trigger native registration
        PushNotifications.register().catch(err => {
          console.warn('[Native FCM] PushNotifications.register falhou:', err);
        });
      });
    } catch (androidErr) {
      console.error('[Native FCM] Erro ao obter token FCM nativo:', androidErr);
      return null;
    }
  }

  // B. WEB / PWA FLOW
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[WebPush] Permissão de notificação não concedida:', permission);
      return null;
    }

    const registration = swRegistration || (await registerFCMServiceWorker());
    if (!registration) {
      console.warn('[WebPush] Não foi possível obter token sem Service Worker.');
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
        localStorage.setItem('gsi_platform', 'web-push');
        console.log('[WebPush] Subscrição Web Push obtida com sucesso!');

        if (userId) {
          await saveTokenToDatabase(userId, subString, 'web-push');
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
        localStorage.setItem('gsi_platform', 'web-push');
        if (userId) await saveTokenToDatabase(userId, token, 'web-push');
        return token;
      }
    }
  } catch (err: any) {
    console.warn('[WebPush] Erro ao obter token Web Push:', err);
  }

  return null;
}

/**
 * 3. Save token to Supabase user_push_tokens and Server / Firestore
 * Saves with platform: 'android' for Capacitor or 'web-push' for browser.
 */
export async function saveTokenToDatabase(userId: string, token: string, platform?: string): Promise<void> {
  const actualPlatform = platform || (Capacitor.isNativePlatform() ? 'android' : 'web-push');

  try {
    // 1. Save to Supabase user_push_tokens table (with platform: 'android' or 'web-push')
    try {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        token: token,
        platform: actualPlatform,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,token' });
      console.log(`[Push] Token salvo no Supabase (user_id: ${userId}, platform: ${actualPlatform}).`);
    } catch (sbErr) {
      console.warn('[Push] Supabase user_push_tokens note:', sbErr);
    }

    // 2. Save via server endpoint
    try {
      await fetch('/api/save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token,
          platform: actualPlatform
        })
      });
    } catch (apiErr) {
      console.warn('[Push] Server token registration note:', apiErr);
    }

    // 3. Save to Firestore fcm_tokens collection
    try {
      const tokenDocRef = doc(db, 'fcm_tokens', `${userId}_${actualPlatform}`);
      await setDoc(tokenDocRef, {
        userId,
        token,
        platform: actualPlatform,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('[Push] Token salvo no Firestore para background queue.');
    } catch (fsErr) {
      console.warn('[Push] Firestore token sync note:', fsErr);
    }
  } catch (err) {
    console.warn('[Push] Erro geral ao salvar token:', err);
  }
}

/**
 * Listen for foreground push messages
 */
export function setupForegroundMessageListener(onNotification: (payload: any) => void) {
  // If native Android, PushNotifications handles foreground messages
  if (Capacitor.isNativePlatform()) {
    if (!nativeListenersInitialized) {
      nativeListenersInitialized = true;
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[Native Push] Foreground notification recebida:', notification);
        onNotification({
          notification: {
            title: notification.title,
            body: notification.body
          },
          data: notification.data
        });
      }).catch(() => {});
    }
    return;
  }

  // Web Browser flow
  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('[FCM Web] Foreground push message received:', payload);
        onNotification(payload);

        if (Notification.permission === 'granted') {
          const title = payload.notification?.title || payload.data?.title || 'GSI PRO';
          new Notification(title, {
            body: payload.notification?.body || payload.data?.body || 'Nova notificação!',
            icon: '/icons/icon-192.png',
            tag: payload.data?.tag || 'gsi-notification'
          });
        }
      });
    } catch (err) {
      console.warn('[FCM Web] Foreground listener note:', err);
    }
  });
}

/**
 * Send a background test push notification
 * Works with the app completely closed!
 */
export async function testBackgroundNotification(delaySeconds: number = 4): Promise<boolean> {
  const token = localStorage.getItem('gsi_fcm_token');
  const platform = localStorage.getItem('gsi_platform') || (Capacitor.isNativePlatform() ? 'android' : 'web-push');

  if (!token) {
    alert('Nenhum token de notificação encontrado. Por favor, ative as notificações primeiro.');
    return false;
  }

  try {
    const isJson = typeof token === 'string' && token.startsWith('{');
    const resp = await fetch('/api/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: isJson ? undefined : token,
        subscription: isJson ? JSON.parse(token) : undefined,
        platform: Capacitor.isNativePlatform() ? 'android' : platform,
        delaySeconds
      })
    });
    return resp.ok;
  } catch (err) {
    console.warn('[Test Push] Erro ao disparar teste:', err);
    return false;
  }
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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || Capacitor.isNativePlatform()) return;

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
 * 4. Triggers background push notification for recipient (wakes up closed phones!)
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
  // 1. Dispatch through server endpoint (handles Android Native FCM + Web Push)
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
    console.log('[Push API] Notificação enviada:', result);
  } catch (pushErr) {
    console.warn('[Push API] Falha na requisição de push:', pushErr);
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
