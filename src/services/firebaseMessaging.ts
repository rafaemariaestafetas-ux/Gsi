import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from './supabaseClient';

export interface FCMStatus {
  isSupported: boolean;
  permission: string;
  token: string | null;
  platform: 'android';
  error?: string;
}

export const HIGH_PRIORITY_CHANNEL_ID = 'gsi_high_priority_channel';

let currentUserId: string | null = null;
let nativeListenersInitialized = false;
let pendingTokenResolvers: Array<(token: string | null) => void> = [];

/**
 * Configure Android 8.0+ High Priority Notification Channel
 * Heads-up banner, high urgency sound, and vibration for calls and messages.
 */
export async function configureAndroidNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.createChannel({
      id: HIGH_PRIORITY_CHANNEL_ID,
      name: 'Chamadas e Mensagens GSI PRO',
      description: 'Notificações urgentes de chamadas e mensagens em tempo real',
      importance: 5, // High importance (heads-up notification & sound)
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#eab308'
    });
    console.log('[Native Push] Canal Android configurado:', HIGH_PRIORITY_CHANNEL_ID);
  } catch (err) {
    console.warn('[Native Push] Falha ao configurar canal:', err);
  }
}

/**
 * Initializes native event listeners once.
 * Prevents memory leaks and duplicate listener crashes on Android.
 */
function ensureNativeListeners() {
  if (!Capacitor.isNativePlatform() || nativeListenersInitialized) return;
  nativeListenersInitialized = true;

  try {
    // 1. Token registration success listener
    PushNotifications.addListener('registration', async (token: Token) => {
      try {
        console.log('[Native Push] Token FCM registrado com sucesso!');
        const fcmToken = token.value;
        localStorage.setItem('gsi_fcm_token', fcmToken);
        localStorage.setItem('gsi_platform', 'android');

        if (currentUserId) {
          await saveTokenToDatabase(currentUserId, fcmToken, 'android');
        }

        // Resolve all waiting callers
        const resolvers = [...pendingTokenResolvers];
        pendingTokenResolvers = [];
        resolvers.forEach(resolve => {
          try { resolve(fcmToken); } catch {}
        });
      } catch (err) {
        console.error('[Native Push] Erro ao processar token recebido:', err);
      }
    });

    // 2. Token registration error listener
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Native Push] Erro no registro de notificações:', error);
      const resolvers = [...pendingTokenResolvers];
      pendingTokenResolvers = [];
      const cached = localStorage.getItem('gsi_fcm_token');
      resolvers.forEach(resolve => {
        try { resolve(cached); } catch {}
      });
    });
  } catch (err) {
    console.warn('[Native Push] Erro ao inicializar listeners nativos:', err);
  }
}

/**
 * Check if native notification permission is currently granted
 */
export async function checkNativeNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const status = await PushNotifications.checkPermissions();
    return status.receive === 'granted';
  } catch {
    return false;
  }
}

/**
 * Requests native Android notification permissions and registers the device.
 * Stores the FCM token in Supabase (user_push_tokens table) with platform: 'android'.
 * Never throws unhandled errors to guarantee zero crashes on launch or activation.
 */
export async function requestNativeNotificationPermission(userId?: string): Promise<string | null> {
  if (userId) {
    currentUserId = userId;
  }

  if (!Capacitor.isNativePlatform()) {
    console.log('[Native Push] Dispositivo não é Android nativo (Capacitor).');
    return null;
  }

  try {
    ensureNativeListeners();
    await configureAndroidNotificationChannel();

    // 1. Check existing permission
    let status = await PushNotifications.checkPermissions();
    console.log('[Native Push] Status de permissão atual:', status.receive);

    // 2. If not granted, request native permission
    if (status.receive !== 'granted') {
      status = await PushNotifications.requestPermissions();
      console.log('[Native Push] Status após solicitação ao usuário:', status.receive);
    }

    if (status.receive !== 'granted') {
      console.log('[Native Push] Permissão não concedida pelo usuário.');
      return null;
    }

    // 3. Register with Google FCM via Capacitor
    const registrationPromise = new Promise<string | null>((resolve) => {
      let resolved = false;

      // Safety timeout so caller never hangs
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const cached = localStorage.getItem('gsi_fcm_token');
          resolve(cached);
        }
      }, 7000);

      pendingTokenResolvers.push((token) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(token);
        }
      });
    });

    // Call native register
    await PushNotifications.register().catch(regErr => {
      console.warn('[Native Push] Erro ao chamar PushNotifications.register():', regErr);
    });

    const token = await registrationPromise;
    if (token && userId) {
      await saveTokenToDatabase(userId, token, 'android');
    }
    return token;
  } catch (err) {
    console.error('[Native Push] Erro durante ativação de notificações nativas:', err);
    return localStorage.getItem('gsi_fcm_token');
  }
}

/**
 * Alias for requestNativeNotificationPermission to preserve compatibility
 */
export const requestFCMToken = requestNativeNotificationPermission;

/**
 * Initializes push notifications on app launch if on native platform.
 */
export async function initializePushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await requestNativeNotificationPermission();
  } catch (err) {
    console.warn('[Native Push] Erro na inicialização:', err);
  }
}

/**
 * Save native FCM token to Supabase user_push_tokens with platform: 'android'
 */
export async function saveTokenToDatabase(userId: string, token: string, platform: string = 'android'): Promise<void> {
  if (!userId || !token) return;

  try {
    // 1. Save to Supabase user_push_tokens table with platform: 'android'
    const { error: sbErr } = await supabase.from('user_push_tokens').upsert({
      user_id: userId,
      token: token,
      platform: 'android',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,token' });

    if (sbErr) {
      console.warn('[Native Push] Nota ao salvar token no Supabase:', sbErr.message);
    } else {
      console.log(`[Native Push] Token FCM salvo no Supabase com platform: 'android' (user_id: ${userId})`);
    }

    // 2. Also inform server proxy if online
    try {
      await fetch('/api/save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token,
          platform: 'android'
        })
      });
    } catch {}
  } catch (err) {
    console.warn('[Native Push] Erro geral ao salvar token:', err);
  }
}

/**
 * Listen for foreground push messages on Android
 */
export function setupForegroundMessageListener(onNotification: (payload: any) => void): void {
  if (!Capacitor.isNativePlatform()) return;

  try {
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      try {
        console.log('[Native Push] Notificação recebida em foreground:', notification);
        onNotification({
          notification: {
            title: notification.title,
            body: notification.body
          },
          data: notification.data
        });
      } catch (err) {
        console.error('[Native Push] Erro no callback de pushNotificationReceived:', err);
      }
    }).catch(() => {});
  } catch (err) {
    console.warn('[Native Push] Erro ao registrar foreground listener:', err);
  }
}

/**
 * Dispatches a test push notification to this Android device via backend
 */
export async function testBackgroundNotification(delaySeconds: number = 4): Promise<boolean> {
  const token = localStorage.getItem('gsi_fcm_token');

  if (!token) {
    alert('Nenhum token FCM nativo encontrado. Ative as notificações no app primeiro.');
    return false;
  }

  try {
    const resp = await fetch('/api/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: 'android',
        delaySeconds
      })
    });
    return resp.ok;
  } catch (err) {
    console.warn('[Native Push] Erro ao disparar teste push:', err);
    return false;
  }
}

/**
 * Trigger push notification for recipient (private message, group message, calls, announcements)
 */
export async function triggerBackgroundNotification(notification: {
  senderId: string;
  senderName: string;
  recipientId: string;
  title: string;
  body: string;
  type: 'private_message' | 'group_message' | 'announcement' | 'call';
  data?: Record<string, string>;
}): Promise<void> {
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
    const result = await resp.json().catch(() => null);
    console.log('[Native Push] Envio de notificação para destinatário concluído:', result);
  } catch (err) {
    console.warn('[Native Push] Erro ao disparar notificação:', err);
  }
}

/**
 * Deprecated no-ops for backwards compatibility if referenced
 */
export async function registerFCMServiceWorker(): Promise<null> {
  return null;
}

export async function syncRemindersWithServiceWorker(): Promise<void> {
  // No-op: Web Service Worker push removed
}
