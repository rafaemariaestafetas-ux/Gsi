import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, CheckCircle2, Cloud, CloudOff } from 'lucide-react';
import { useNetworkStatus } from '../services/networkService';
import { subscribeSyncStatus, subscribeQueue, processQueue } from '../services/offlineSyncService';

export default function NetworkStatusBar() {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showOnlineRestored, setShowOnlineRestored] = useState(false);

  useEffect(() => {
    const unsubSync = subscribeSyncStatus(setIsSyncing);
    const unsubQueue = subscribeQueue((items) => setPendingCount(items.length));
    return () => {
      unsubSync();
      unsubQueue();
    };
  }, []);

  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowOnlineRestored(true);
      const timer = setTimeout(() => {
        setShowOnlineRestored(false);
        clearWasOffline();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, clearWasOffline]);

  // If online and not showing "restored/syncing" and not manually syncing, don't show banner
  const isOffline = !isOnline;
  const isReconnecting = isOnline && (showOnlineRestored || isSyncing);

  if (!isOffline && !isReconnecting) {
    return null;
  }

  return (
    <div 
      className="fixed z-[9990] left-0 right-0 pointer-events-none flex justify-center px-4 transition-all duration-300"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 0.35rem)'
      }}
    >
      <AnimatePresence mode="wait">
        {isOffline ? (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto bg-[#1a1409]/95 border border-amber-500/50 shadow-lg shadow-amber-950/40 rounded-full px-4 py-1.5 flex items-center gap-2.5 backdrop-blur-md max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <WifiOff size={14} className="text-amber-400 shrink-0" />
            <span className="text-[11px] font-bold tracking-tight text-amber-200">
              Sem internet — a trabalhar em modo offline
            </span>
            {pendingCount > 0 && (
              <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border border-amber-400/30">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="online-banner"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto bg-[#0a1b14]/95 border border-emerald-500/50 shadow-lg shadow-emerald-950/40 rounded-full px-4 py-1.5 flex items-center gap-2.5 backdrop-blur-md max-w-sm"
          >
            {isSyncing ? (
              <RefreshCw size={13} className="text-emerald-400 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            )}
            <span className="text-[11px] font-bold tracking-tight text-emerald-200">
              {isSyncing ? 'Ligado — a sincronizar...' : 'Ligado — sincronizado'}
            </span>
            {pendingCount > 0 && !isSyncing && (
              <button
                onClick={() => processQueue()}
                className="bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 border border-emerald-400/30 cursor-pointer pointer-events-auto"
              >
                Sincronizar {pendingCount}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
