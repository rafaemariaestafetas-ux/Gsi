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
let onNotificationReceivedCallback: ((notification: PushNotificationSchema) => void) | null = null;
let onNotificationActionCallback: ((action: ActionPerformed) => void) | null = null;

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
 * Configures all native push listeners strictly ONCE without duplication.
 * Never throws errors to ensure zero crashes.
 */
export function setupNativePushNotifications(options?: {
  userId?: string;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationActionPerformed?: (action: ActionPerformed) => void;
}): void {
  if (options?.userId) {
    currentUserId = options.userId;
  }
  if (options?.onNotificationReceived) {
    onNotificationReceivedCallback = options.onNotificationReceived;
  }
  if (options?.onNotificationActionPerformed) {
    onNotificationActionCallback = options.onNotificationActionPerformed;
  }

  if (!Capacitor.isNativePlatform()) return;
  if (nativeListenersInitialized) return;
  nativeListenersInitialized = true;

  try {
    // 1. Registration Success
    PushNotifications.addListener('registration', async (token: Token) => {
      try {
        console.log('[Native Push] Token FCM registrado com sucesso!');
        const fcmToken = token.value;
        localStorage.setItem('gsi_fcm_token', fcmToken);
        localStorage.setItem('gsi_platform', 'android');

        if (currentUserId) {
          await saveTokenToDatabase(currentUserId, fcmToken, 'android');
        }

        const resolvers = [...pendingTokenResolvers];
        pendingTokenResolvers = [];
        resolvers.forEach(resolve => {
          try { resolve(fcmToken); } catch {}
        });
      } catch (err) {
        console.error('[Native Push] Erro ao processar token recebido:', err);
      }
    }).catch(err => console.warn('[Native Push] addListener registration note:', err));

    // 2. Registration Error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.warn('[Native Push] Erro no registro de notificações:', error);
      const resolvers = [...pendingTokenResolvers];
      pendingTokenResolvers = [];
      const cached = localStorage.getItem('gsi_fcm_token');
      resolvers.forEach(resolve => {
        try { resolve(cached); } catch {}
      });
    }).catch(err => console.warn('[Native Push] addListener registrationError note:', err));

    // 3. Push Notification Received in Foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      try {
        console.log('[Native Push] Recebida em primeiro plano:', notification);
        if (onNotificationReceivedCallback) {
          onNotificationReceivedCallback(notification);
        }
      } catch (err) {
        console.error('[Native Push] Erro no callback pushNotificationReceived:', err);
      }
    }).catch(err => console.warn('[Native Push] addListener pushNotificationReceived note:', err));

    // 4. Push Notification Action Performed (Tapped)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      try {
        console.log('[Native Push] Notificação clicada pelo utilizador:', action);
        if (onNotificationActionCallback) {
          onNotificationActionCallback(action);
        }
      } catch (err) {
        console.error('[Native Push] Erro no callback pushNotificationActionPerformed:', err);
      }
    }).catch(err => console.warn('[Native Push] addListener pushNotificationActionPerformed note:', err));
  } catch (err) {
    console.warn('[Native Push] Erro ao registrar listeners nativos:', err);
  }
}

/**
 * Check if native notification permission is currently granted (silent, no prompt)
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
 * Called ONLY upon user explicit interaction (button click in Settings/Profile or Onboarding).
 * Never throws unhandled errors to guarantee zero crashes.
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
    setupNativePushNotifications({ userId });
    await configureAndroidNotificationChannel();

    // 1. Check existing permission
    let status = await PushNotifications.checkPermissions().catch(() => ({ receive: 'prompt' as any }));
    console.log('[Native Push] Status de permissão verificado:', status.receive);

    // 2. Request native permission ONLY here on user tap
    if (status.receive !== 'granted') {
      status = await PushNotifications.requestPermissions().catch(() => ({ receive: 'denied' as any }));
      console.log('[Native Push] Status após solicitação ao utilizador:', status.receive);
    }

    if (status.receive !== 'granted') {
      console.log('[Native Push] Permissão recusada pelo utilizador.');
      return null;
    }

    // 3. Register with Google FCM via Capacitor
    const registrationPromise = new Promise<string | null>((resolve) => {
      let resolved = false;

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

    await PushNotifications.register().catch(regErr => {
      console.warn('[Native Push] Erro ao chamar PushNotifications.register():', regErr);
    });

    const token = await registrationPromise;
    if (token && (userId || currentUserId)) {
      await saveTokenToDatabase(userId || currentUserId!, token, 'android');
    }
    return token;
  } catch (err) {
    console.error('[Native Push] Erro seguro durante ativação de notificações nativas:', err);
    return localStorage.getItem('gsi_fcm_token');
  }
}

/**
 * Alias for requestNativeNotificationPermission to preserve compatibility
 */
export const requestFCMToken = requestNativeNotificationPermission;

/**
 * Silent initialization on launch without prompting the user.
 * If permission was ALREADY granted in Android, registers silently.
 */
export async function initializePushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await configureAndroidNotificationChannel();
    const granted = await checkNativeNotificationPermission();
    if (granted) {
      await PushNotifications.register().catch(() => {});
    }
  } catch (err) {
    console.warn('[Native Push] Erro seguro na verificação inicial:', err);
  }
}

/**
 * Save native FCM token to Supabase user_push_tokens with platform: 'android'
 */
export async function saveTokenToDatabase(userId: string, token: string, platform: string = 'android'): Promise<void> {
  if (!userId || !token) return;

  try {
    const { error: sbErr } = await supabase.from('user_push_tokens').upsert({
      user_id: userId,
      token: token,
      platform: 'android',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,token' });

    if (sbErr) {
      console.warn('[Native Push] Nota ao salvar token no Supabase:', sbErr.message);
    } else {
      console.log(`[Native Push] Token FCM salvo no Supabase (user_id: ${userId})`);
    }

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
 * Listen for foreground push messages on Android (delegates to callback)
 */
export function setupForegroundMessageListener(onNotification: (payload: any) => void): void {
  onNotificationReceivedCallback = (notification: PushNotificationSchema) => {
    onNotification({
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data
    });
  };
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
 * Deprecated no-ops for backwards compatibility if referenced (Web Push completely disabled on Android)
 */
export async function registerFCMServiceWorker(): Promise<null> {
  return null;
}

export async function syncRemindersWithServiceWorker(): Promise<void> {
  // No-op: Web Service Worker push removed
}
