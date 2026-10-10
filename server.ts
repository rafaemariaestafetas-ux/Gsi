import express from 'express';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Initialize Firebase Admin SDK for Native FCM Push Notifications (Android Capacitor)
let adminMessaging: any = null;
try {
  let adminApp: any = null;
  if (getAdminApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string' && process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{')
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
          : process.env.FIREBASE_SERVICE_ACCOUNT;
        adminApp = initAdminApp({
          credential: cert(sa),
          projectId: 'gen-lang-client-0974852104'
        });
      } catch (saErr: any) {
        console.warn('[Firebase Admin] Service account parse note:', saErr.message);
      }
    }
    if (!adminApp) {
      adminApp = initAdminApp({
        projectId: 'gen-lang-client-0974852104'
      });
    }
  } else {
    adminApp = getAdminApps()[0];
  }
  adminMessaging = getAdminMessaging(adminApp);
  console.log('[Firebase Admin] Native FCM Messaging ready for Android');
} catch (adminErr: any) {
  console.warn('[Firebase Admin] Initialization note:', adminErr.message);
}

// Standard Web Push VAPID configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BBpVZZ3789eDL53X-9jV_R7MdMlUtig8IJVWd9wVsvn-QgVbNqHLvz350x_J937EQj8XzK2lPBgqzb3gYDN84QQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'Lb7hFYdZNyzYteYKxUpU0MzgGioy7_EpUX0XL3zlojw';

webpush.setVapidDetails(
  'mailto:rafaaprodrigu3s@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Supabase client for reading & managing user push subscriptions
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mqefmsrrtfhasqakzwuq.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_z-HkuOTB-ndnP2gEIsVB4A_vkXXVnD2';
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory fallback map of user push subscriptions { userId: [PushSubscription] }
const userSubscriptionsMap = new Map<string, any[]>();
// In-memory fallback map of user Android tokens { userId: [tokenString] }
const userAndroidTokensMap = new Map<string, string[]>();

/**
 * Send Native Android FCM notification via Firebase Admin or REST fallback
 */
async function sendAndroidFCM(token: string, payload: {
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  const cleanData: Record<string, string> = {};
  if (payload.data) {
    for (const [key, val] of Object.entries(payload.data)) {
      if (val !== undefined && val !== null) {
        cleanData[key] = typeof val === 'string' ? val : JSON.stringify(val);
      }
    }
  }
  cleanData.title = payload.title;
  cleanData.body = payload.body || '';
  cleanData.type = payload.type || 'general';

  // 1. Firebase Admin SDK
  if (adminMessaging) {
    try {
      await adminMessaging.send({
        token,
        notification: {
          title: payload.title,
          body: payload.body || ''
        },
        data: cleanData,
        android: {
          priority: 'high',
          ttl: payload.type === 'call' ? 60 * 1000 : 3600 * 1000,
          notification: {
            channelId: 'gsi_high_priority_channel',
            priority: (payload.type === 'call' ? 'max' : 'high') as any,
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public',
            tag: payload.type === 'call' ? 'call_incoming' : `msg_${payload.data?.senderId || 'chat'}`
          }
        }
      });
      console.log(`[FCM Admin] Native Android notification sent to ${token.slice(0, 15)}...`);
      return true;
    } catch (err: any) {
      console.warn('[FCM Admin] Send attempt note:', err.code || err.message);
    }
  }

  // 2. Direct FCM Legacy REST API fallback if FCM_SERVER_KEY configured
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  if (fcmServerKey) {
    try {
      const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`
        },
        body: JSON.stringify({
          to: token,
          priority: 'high',
          notification: {
            title: payload.title,
            body: payload.body || '',
            sound: 'default',
            android_channel_id: 'gsi_high_priority_channel'
          },
          data: cleanData
        })
      });
      if (resp.ok) {
        console.log(`[FCM REST] Notification dispatched via REST to ${token.slice(0, 15)}...`);
        return true;
      }
    } catch (restErr: any) {
      console.warn('[FCM REST] Send error note:', restErr.message);
    }
  }

  return false;
}

/**
 * 1. Get VAPID public key for Web Push subscription
 */
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * 2. Save user token (supports Native Android FCM and Web Push)
 */
app.post('/api/save-token', async (req, res) => {
  try {
    const { userId, token, platform = 'android' } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ error: 'Missing userId or token' });
    }

    if (platform === 'android') {
      const existing = userAndroidTokensMap.get(userId) || [];
      if (!existing.includes(token)) {
        existing.push(token);
        userAndroidTokensMap.set(userId, existing);
      }
    } else {
      try {
        const sub = typeof token === 'string' && token.startsWith('{') ? JSON.parse(token) : null;
        if (sub?.endpoint) {
          const existing = userSubscriptionsMap.get(userId) || [];
          const filtered = existing.filter(s => s.endpoint !== sub.endpoint);
          filtered.push(sub);
          userSubscriptionsMap.set(userId, filtered);
        }
      } catch {}
    }

    // Save in Supabase user_push_tokens with platform: 'android' or 'web-push'
    try {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        token: token,
        platform: platform,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,token' });
    } catch (sbErr) {
      console.warn('[Server] Supabase token save note:', sbErr);
    }

    console.log(`[Server] Push token saved for user ${userId} (Platform: ${platform})`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Server] Error in /api/save-token:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2.1 Save Web Push subscription (backwards compatibility)
 */
app.post('/api/save-subscription', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing userId or subscription endpoint' });
    }

    const existing = userSubscriptionsMap.get(userId) || [];
    const filtered = existing.filter(s => s.endpoint !== subscription.endpoint);
    filtered.push(subscription);
    userSubscriptionsMap.set(userId, filtered);

    try {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        token: JSON.stringify(subscription),
        platform: 'web-push',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,token' });
    } catch (sbErr) {
      console.warn('[Server] Supabase token save note:', sbErr);
    }

    console.log(`[Server] Web Push subscription saved for user ${userId}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Server] Error saving subscription:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Send Push Notification to a user or group (handles Native Android FCM + Web Push)
 */
app.post('/api/send-push', async (req, res) => {
  try {
    const { recipientId, title, body, type, data } = req.body;
    if (!recipientId || !title) {
      return res.status(400).json({ error: 'Missing recipientId or title' });
    }

    console.log(`[Server] Dispatching push to "${recipientId}": "${title}" (Type: ${type})`);

    // Determine target recipient user IDs
    let targetUserIds: string[] = [];
    if (recipientId.startsWith('group_')) {
      const groupId = recipientId.replace('group_', '');
      try {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId);
        if (members && members.length > 0) {
          targetUserIds = members
            .map(m => m.user_id)
            .filter(id => id !== data?.senderId);
        }
      } catch (grpErr) {
        console.warn('[Server] Group members fetch note:', grpErr);
      }
    } else {
      targetUserIds = [recipientId];
    }

    if (targetUserIds.length === 0) {
      return res.json({ success: false, reason: 'no_target_users', sentCount: 0 });
    }

    // Query tokens from Supabase user_push_tokens
    interface TokenRecord {
      user_id: string;
      token: string;
      platform?: string;
    }
    const tokenRecords: TokenRecord[] = [];

    try {
      const { data: dbRows, error } = await supabase
        .from('user_push_tokens')
        .select('user_id, token, platform')
        .in('user_id', targetUserIds);

      if (!error && dbRows) {
        tokenRecords.push(...dbRows);
      }
    } catch (sbErr) {
      console.warn('[Server] Supabase tokens fetch note:', sbErr);
    }

    // Add in-memory tokens if missing from DB
    for (const uid of targetUserIds) {
      // In-memory Android tokens
      const androidTokens = userAndroidTokensMap.get(uid) || [];
      for (const t of androidTokens) {
        if (!tokenRecords.some(r => r.token === t)) {
          tokenRecords.push({ user_id: uid, token: t, platform: 'android' });
        }
      }
      // In-memory Web subscriptions
      const webSubs = userSubscriptionsMap.get(uid) || [];
      for (const s of webSubs) {
        const str = JSON.stringify(s);
        if (!tokenRecords.some(r => r.token === str)) {
          tokenRecords.push({ user_id: uid, token: str, platform: 'web-push' });
        }
      }
    }

    if (tokenRecords.length === 0) {
      console.log(`[Server] No registered tokens found for target users.`);
      return res.json({ success: false, reason: 'no_tokens_found', sentCount: 0 });
    }

    let androidCount = 0;
    let webCount = 0;

    const payloadString = JSON.stringify({
      title,
      body: body || '',
      type: type || 'general',
      data: data || {},
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      timestamp: Date.now()
    });

    const sendPromises = tokenRecords.map(async (row) => {
      const isAndroid = row.platform === 'android' || (!row.token.startsWith('{') && !row.token.includes('endpoint'));

      if (isAndroid) {
        // Send via Native Android FCM
        const ok = await sendAndroidFCM(row.token, {
          title,
          body: body || '',
          type: type || 'general',
          data: data || {}
        });
        if (ok) androidCount++;
      } else {
        // Send via Web Push
        try {
          const sub = typeof row.token === 'string' ? JSON.parse(row.token) : row.token;
          if (sub?.endpoint) {
            await webpush.sendNotification(sub, payloadString, {
              TTL: type === 'call' ? 60 : 3600,
              urgency: type === 'call' ? 'high' : 'normal'
            });
            webCount++;
          }
        } catch (err: any) {
          console.warn('[Server] Error sending Web Push:', err?.statusCode, err?.message);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            try {
              await supabase.from('user_push_tokens').delete().eq('token', row.token);
            } catch {}
          }
        }
      }
    });

    await Promise.allSettled(sendPromises);

    const totalSent = androidCount + webCount;
    console.log(`[Server] Push notification delivered to ${totalSent}/${tokenRecords.length} devices (Android: ${androidCount}, Web: ${webCount}).`);
    res.json({
      success: true,
      sentCount: totalSent,
      androidCount,
      webCount,
      total: tokenRecords.length
    });
  } catch (err: any) {
    console.error('[Server] Error in /api/send-push:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Test Push Notification on current device (supports Native Android and Web)
 */
app.post('/api/test-push', async (req, res) => {
  try {
    const { token, subscription, platform = 'android', delaySeconds = 4 } = req.body;
    if (!token && (!subscription || !subscription.endpoint)) {
      return res.status(400).json({ error: 'Missing token or subscription' });
    }

    console.log(`[Server] Scheduling test push notification in ${delaySeconds}s (Platform: ${platform})`);

    setTimeout(async () => {
      try {
        if (platform === 'android' && token) {
          await sendAndroidFCM(token, {
            title: '🔔 GSI PRO — Alerta de Teste Nativo',
            body: 'Notificação FCM recebida com sucesso! Você receberá chamadas e mensagens mesmo com o app completamente fechado.',
            type: 'test',
            data: { url: '/' }
          });
        } else if (subscription && subscription.endpoint) {
          await webpush.sendNotification(subscription, JSON.stringify({
            title: '🔔 GSI PRO — Alerta de Teste (Web)',
            body: 'Notificação recebida com sucesso! Você receberá chamadas e mensagens mesmo com o app fechado.',
            type: 'test',
            data: { url: '/' },
            icon: '/icons/icon-192.png'
          }));
        }
        console.log('[Server] Test push dispatched successfully!');
      } catch (err: any) {
        console.warn('[Server] Test push send error:', err?.message);
      }
    }, delaySeconds * 1000);

    res.json({ success: true, message: `Disparando notificação em ${delaySeconds}s... Feche o app para testar!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. Daily.co Room Creation & WebRTC Session Provisioning
 */
const DAILY_API_KEY = process.env.DAILY_API_KEY || process.env.VITE_DAILY_API_KEY || '936b7be1a5dcefba534ee77df06b37d0d34bcd9d7f733ebc1c8721b374734c2a';
const DAILY_DOMAIN = process.env.DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN || 'gsi';

app.get('/api/daily/config', (req, res) => {
  res.json({
    hasApiKey: !!DAILY_API_KEY,
    domain: DAILY_DOMAIN
  });
});

app.post('/api/daily/room', async (req, res) => {
  try {
    const { roomName, callType, callerId, receiverId } = req.body;
    const cleanName = (roomName || `gsi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    let roomUrl = '';
    let apiCreated = false;

    if (DAILY_API_KEY) {
      try {
        console.log(`[Daily API] Creating room: ${cleanName} via Daily REST API...`);
        const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DAILY_API_KEY}`
          },
          body: JSON.stringify({
            name: cleanName,
            properties: {
              exp: Math.floor(Date.now() / 1000) + 7200, // Room expires in 2 hours
              eject_at_room_exp: true,
              enable_chat: false,
              enable_screenshare: false,
              start_video_off: callType === 'audio',
              start_audio_off: false
            }
          })
        });

        if (dailyRes.ok) {
          const roomData = await dailyRes.json() as any;
          roomUrl = roomData.url;
          apiCreated = true;
          console.log('[Daily API] Room created successfully:', roomUrl);
        } else {
          const errData = await dailyRes.json().catch(() => ({})) as any;
          console.warn('[Daily API] Room creation response note:', dailyRes.status, errData?.info || errData);
          if (errData?.info?.includes('already exists') || dailyRes.status === 400) {
            // Room name exists or was reused, use direct daily URL
            roomUrl = `https://${DAILY_DOMAIN}.daily.co/${cleanName}`;
          }
        }
      } catch (apiErr: any) {
        console.warn('[Daily API] REST error, using domain fallback:', apiErr.message);
      }
    }

    if (!roomUrl) {
      roomUrl = `https://${DAILY_DOMAIN}.daily.co/${cleanName}`;
      console.log(`[Daily] Generated room URL with domain ${DAILY_DOMAIN}: ${roomUrl}`);
    }

    // Try saving record into Supabase calls table if available
    if (callerId && receiverId) {
      try {
        await supabase.from('calls').insert({
          caller_id: callerId,
          receiver_id: receiverId,
          room_name: cleanName,
          room_url: roomUrl,
          call_type: callType || 'video',
          status: 'initiated',
          created_at: new Date().toISOString()
        });
      } catch (dbErr) {
        // Table may not exist yet, schema is optional
      }
    }

    res.json({
      success: true,
      roomUrl,
      roomName: cleanName,
      apiCreated
    });
  } catch (err: any) {
    console.error('[Server] Error in /api/daily/room:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily/call-status', async (req, res) => {
  try {
    const { roomName, status, duration } = req.body;
    if (roomName) {
      try {
        await supabase.from('calls')
          .update({
            status: status || 'completed',
            duration: Number(duration) || 0
          })
          .eq('room_name', roomName);
      } catch {}
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server and mount Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[GSI Pro Server] Running on http://0.0.0.0:${port}`);
  });
}

startServer();
