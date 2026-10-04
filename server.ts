import express from 'express';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

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

/**
 * 1. Get VAPID public key for Web Push subscription
 */
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * 2. Save user push subscription
 */
app.post('/api/save-subscription', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing userId or subscription endpoint' });
    }

    // Save in in-memory cache
    const existing = userSubscriptionsMap.get(userId) || [];
    const filtered = existing.filter(s => s.endpoint !== subscription.endpoint);
    filtered.push(subscription);
    userSubscriptionsMap.set(userId, filtered);

    // Save in Supabase user_push_tokens
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
 * 3. Send Web Push Notification to a user (calls, messages, announcements)
 */
app.post('/api/send-push', async (req, res) => {
  try {
    const { recipientId, title, body, type, data } = req.body;
    if (!recipientId || !title) {
      return res.status(400).json({ error: 'Missing recipientId or title' });
    }

    console.log(`[Server] Sending push to recipient ${recipientId}: "${title}" (Type: ${type})`);

    // Collect all subscriptions for recipient
    let subscriptions: any[] = [];

    // From in-memory map
    const inMem = userSubscriptionsMap.get(recipientId);
    if (inMem && inMem.length > 0) {
      subscriptions.push(...inMem);
    }

    // From Supabase
    try {
      const { data: dbTokens, error } = await supabase
        .from('user_push_tokens')
        .select('token')
        .eq('user_id', recipientId);

      if (!error && dbTokens) {
        dbTokens.forEach(row => {
          try {
            const sub = typeof row.token === 'string' ? JSON.parse(row.token) : row.token;
            if (sub?.endpoint && !subscriptions.some(s => s.endpoint === sub.endpoint)) {
              subscriptions.push(sub);
            }
          } catch {}
        });
      }
    } catch (sbErr) {
      console.warn('[Server] Supabase tokens fetch note:', sbErr);
    }

    if (subscriptions.length === 0) {
      console.log(`[Server] No active push subscriptions found for user ${recipientId}.`);
      return res.json({ success: false, reason: 'no_subscriptions_found', sentCount: 0 });
    }

    const payloadString = JSON.stringify({
      title,
      body: body || '',
      type: type || 'general',
      data: data || {},
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      timestamp: Date.now()
    });

    let sentCount = 0;
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payloadString, {
          TTL: type === 'call' ? 60 : 3600, // Short TTL for calls, 1h for messages
          urgency: type === 'call' ? 'high' : 'normal'
        });
        sentCount++;
      } catch (err: any) {
        console.warn('[Server] Error sending push to device:', err?.statusCode, err?.message);
        // Clean up expired subscriptions (404 Not Found or 410 Gone)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            const updated = (userSubscriptionsMap.get(recipientId) || []).filter(s => s.endpoint !== sub.endpoint);
            userSubscriptionsMap.set(recipientId, updated);
            await supabase.from('user_push_tokens').delete().eq('token', JSON.stringify(sub));
          } catch {}
        }
      }
    });

    await Promise.allSettled(sendPromises);

    console.log(`[Server] Push notification successfully delivered to ${sentCount}/${subscriptions.length} devices.`);
    res.json({ success: true, sentCount, total: subscriptions.length });
  } catch (err: any) {
    console.error('[Server] Error in /api/send-push:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Test Web Push Notification on current device
 */
app.post('/api/test-push', async (req, res) => {
  try {
    const { subscription, delaySeconds = 4 } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription' });
    }

    console.log(`[Server] Scheduling test push notification in ${delaySeconds}s`);

    setTimeout(async () => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({
          title: '🔔 GSI PRO — Alerta de Teste (App Fechado)',
          body: 'Notificação recebida com sucesso! Você receberá chamadas e mensagens mesmo com o app fechado.',
          type: 'test',
          data: { url: '/' },
          icon: '/icons/icon-192.png'
        }));
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
