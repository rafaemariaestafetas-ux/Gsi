import { supabase } from './supabaseClient';
import { isOnline, subscribeNetworkStatus } from './networkService';
import { showGlobalToast } from '../lib/ToastContext';
import { TimeEntry } from '../types';

export type QueueItemType = 'time_entry' | 'message';

export interface OfflineQueueItem {
  id: string;
  type: QueueItemType;
  payload: any;
  createdAt: string;
  retryCount?: number;
}

const STORAGE_KEY = 'gsi_offline_sync_queue';
let isProcessing = false;

type QueueListener = (items: OfflineQueueItem[]) => void;
type SyncStatusListener = (isSyncing: boolean) => void;

const queueListeners = new Set<QueueListener>();
const syncStatusListeners = new Set<SyncStatusListener>();

function notifyQueueChange() {
  const items = getPendingItems();
  queueListeners.forEach(listener => {
    try { listener(items); } catch (e) { console.error(e); }
  });
}

function notifySyncStatus(syncing: boolean) {
  syncStatusListeners.forEach(listener => {
    try { listener(syncing); } catch (e) { console.error(e); }
  });
}

export function subscribeQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  listener(getPendingItems());
  return () => { queueListeners.delete(listener); };
}

export function subscribeSyncStatus(listener: SyncStatusListener): () => void {
  syncStatusListeners.add(listener);
  listener(isProcessing);
  return () => { syncStatusListeners.delete(listener); };
}

export function getPendingItems(type?: QueueItemType): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: OfflineQueueItem[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (type) {
      return parsed.filter(item => item.type === type);
    }
    return parsed;
  } catch (err) {
    console.warn('[OfflineSync] Error reading queue:', err);
    return [];
  }
}

function saveQueue(items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyQueueChange();
  } catch (err) {
    console.error('[OfflineSync] Failed to save queue:', err);
  }
}

export function addToQueue(type: QueueItemType, payload: any): OfflineQueueItem {
  const currentQueue = getPendingItems();
  const id = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Deduplicate time entries: if an entry already exists for the same user and date, replace it
  let filteredQueue = currentQueue;
  if (type === 'time_entry') {
    filteredQueue = currentQueue.filter(item => {
      if (item.type !== 'time_entry') return true;
      const p = item.payload;
      const isSameDate = p.user_id === payload.user_id &&
        p.day === payload.day &&
        p.month === payload.month &&
        p.year === payload.year;
      return !isSameDate;
    });
  }

  // Deduplicate messages: if temporary id matches, replace
  if (type === 'message' && payload.id) {
    filteredQueue = filteredQueue.filter(item => {
      if (item.type !== 'message') return true;
      return item.payload?.id !== payload.id;
    });
  }

  const newItem: OfflineQueueItem = {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0
  };

  filteredQueue.push(newItem);
  saveQueue(filteredQueue);
  return newItem;
}

export function removeQueueItem(id: string) {
  const currentQueue = getPendingItems();
  const updated = currentQueue.filter(item => item.id !== id);
  saveQueue(updated);
}

export function updateQueueItem(id: string, updates: Partial<OfflineQueueItem>) {
  const currentQueue = getPendingItems();
  const updated = currentQueue.map(item => item.id === id ? { ...item, ...updates } : item);
  saveQueue(updated);
}

export function isItemPending(type: QueueItemType, matchFn: (payload: any) => boolean): boolean {
  const items = getPendingItems(type);
  return items.some(item => matchFn(item.payload));
}

// Update local cache for time entries when synced
function markTimeEntryAsSyncedLocally(entry: TimeEntry) {
  try {
    const key = `entries_${entry.month}_${entry.year}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const entries: TimeEntry[] = JSON.parse(raw);
    const updated = entries.map(e => {
      if (e.day === entry.day && e.month === entry.month && e.year === entry.year && e.user_id === entry.user_id) {
        return { ...e, sync_status: 'synced' as const };
      }
      return e;
    });
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('[OfflineSync] Failed to update local time entry cache:', e);
  }
}

// Update local cache for direct messages when synced
function markMessageAsSyncedLocally(tempId: string, serverId: string, receiverId: string) {
  try {
    const cacheKey = `gsi_chat_cache_${receiverId}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    const msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;
    const updated = msgs.map((m: any) => {
      if (m.id === tempId) {
        return { ...m, id: serverId, sync_status: 'synced' };
      }
      return m;
    });
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('[OfflineSync] Failed to update message cache:', e);
  }
}

// Update local cache for group messages when synced
function markGroupMessageAsSyncedLocally(tempId: string, serverId: string, groupId: string) {
  try {
    const cacheKey = `gsi_group_cache_${groupId}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    const msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;
    const updated = msgs.map((m: any) => {
      if (m.id === tempId) {
        return { ...m, id: serverId, sync_status: 'synced' };
      }
      return m;
    });
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('[OfflineSync] Failed to update group message cache:', e);
  }
}

/**
 * Main queue processing routine
 */
export async function processQueue(): Promise<{ timeEntriesSynced: number; messagesSynced: number; errors: number }> {
  if (isProcessing) {
    return { timeEntriesSynced: 0, messagesSynced: 0, errors: 0 };
  }

  if (!isOnline()) {
    console.log('[OfflineSync] Device is offline, postponing sync');
    return { timeEntriesSynced: 0, messagesSynced: 0, errors: 0 };
  }

  const items = getPendingItems();
  if (items.length === 0) {
    return { timeEntriesSynced: 0, messagesSynced: 0, errors: 0 };
  }

  isProcessing = true;
  notifySyncStatus(true);

  let timeEntriesSynced = 0;
  let messagesSynced = 0;
  let errors = 0;

  try {
    for (const item of items) {
      if (!isOnline()) {
        break; // Stop if network drops mid-process
      }

      if (item.type === 'time_entry') {
        const entry = item.payload as TimeEntry;
        try {
          // Prepare clean payload for PostgreSQL
          const cleanEntry: any = {
            day: entry.day,
            month: entry.month,
            year: entry.year,
            hours: entry.hours,
            obra: entry.obra,
            description: entry.description,
            user_id: entry.user_id,
            is_absence: !!entry.is_absence,
            absence_reason: entry.absence_reason || ''
          };

          // Upsert/Replace: first delete matching day/month/year/user_id
          await supabase
            .from('time_entries')
            .delete()
            .eq('day', entry.day)
            .eq('month', entry.month)
            .eq('year', entry.year)
            .eq('user_id', entry.user_id);

          const { error: insertError } = await supabase
            .from('time_entries')
            .insert([cleanEntry]);

          if (insertError) {
            throw insertError;
          }

          // Successfully synced
          removeQueueItem(item.id);
          markTimeEntryAsSyncedLocally(entry);
          timeEntriesSynced++;
        } catch (err) {
          console.error('[OfflineSync] Error syncing time entry:', err);
          errors++;
          updateQueueItem(item.id, { retryCount: (item.retryCount || 0) + 1 });
        }
      } else if (item.type === 'message') {
        const msg = item.payload;
        try {
          const isGroup = !!msg.is_group || !!msg.group_id;

          if (isGroup) {
            const dbPayload: any = {
              group_id: msg.group_id,
              sender_id: msg.sender_id,
              sender_name: msg.sender_name || 'Utilizador',
              content: msg.content,
              type: msg.type || 'text',
              media_url: msg.media_url || null
            };

            const { data: inserted, error: grpError } = await supabase
              .from('group_messages')
              .insert([dbPayload])
              .select();

            if (grpError) throw grpError;

            const serverId = inserted?.[0]?.id || msg.id;
            removeQueueItem(item.id);
            markGroupMessageAsSyncedLocally(msg.id, serverId, msg.group_id);
            messagesSynced++;
          } else {
            // Direct message
            const dbPayload: any = {
              content: msg.content,
              sender_id: msg.sender_id,
              receiver_id: msg.receiver_id,
              media_url: msg.media_url || null,
              type: msg.type || 'text'
            };

            const { data: inserted, error: msgError } = await supabase
              .from('messages')
              .insert([dbPayload])
              .select();

            if (msgError) throw msgError;

            const serverId = inserted?.[0]?.id || msg.id;
            removeQueueItem(item.id);
            markMessageAsSyncedLocally(msg.id, serverId, msg.receiver_id);
            messagesSynced++;
          }
        } catch (err) {
          console.error('[OfflineSync] Error syncing message:', err);
          errors++;
          updateQueueItem(item.id, { retryCount: (item.retryCount || 0) + 1 });
        }
      }
    }
  } finally {
    isProcessing = false;
    notifySyncStatus(false);
  }

  // Toasts as requested:
  // "Quando a internet voltar: Mostra toast: 'X pontos sincronizados com sucesso.'"
  if (timeEntriesSynced > 0) {
    const text = timeEntriesSynced === 1 
      ? '1 ponto sincronizado com sucesso.' 
      : `${timeEntriesSynced} pontos sincronizados com sucesso.`;
    showGlobalToast(text, 'success', 'SINCRONIZAÇÃO');
  }

  if (messagesSynced > 0) {
    const text = messagesSynced === 1
      ? '1 mensagem sincronizada.'
      : `${messagesSynced} mensagens sincronizadas.`;
    showGlobalToast(text, 'success', 'CHAT SINCRONIZADO');
  }

  // Dispatch custom browser event so components can re-render
  if (typeof window !== 'undefined' && (timeEntriesSynced > 0 || messagesSynced > 0)) {
    window.dispatchEvent(new CustomEvent('gsi:offline_sync_completed', {
      detail: { timeEntriesSynced, messagesSynced, errors }
    }));
  }

  return { timeEntriesSynced, messagesSynced, errors };
}

// Automatically bind to network change to process queue when internet returns
let autoSyncInitialized = false;

export function initOfflineSync() {
  if (autoSyncInitialized) return;
  autoSyncInitialized = true;

  subscribeNetworkStatus((online) => {
    if (online) {
      // Process queue with a tiny debounce to ensure socket/connection is steady
      setTimeout(() => {
        processQueue().catch(() => {});
      }, 1000);
    }
  });

  // Initial check on launch
  if (isOnline()) {
    setTimeout(() => {
      processQueue().catch(() => {});
    }, 1500);
  }
}
