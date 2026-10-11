import { Network, ConnectionStatus } from '@capacitor/network';
import { useState, useEffect } from 'react';

type NetworkListener = (isOnline: boolean) => void;
const listeners = new Set<NetworkListener>();

let currentOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isInitialized = false;

// Initialize Capacitor Network listener
export async function initNetworkService() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const status: ConnectionStatus = await Network.getStatus();
    currentOnlineState = status.connected;
  } catch (err) {
    currentOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  try {
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      const prev = currentOnlineState;
      currentOnlineState = status.connected;
      if (prev !== currentOnlineState) {
        listeners.forEach(fn => fn(currentOnlineState));
      }
    });
  } catch (err) {
    // Fallback to window events in browser/PWA
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        currentOnlineState = true;
        listeners.forEach(fn => fn(true));
      });
      window.addEventListener('offline', () => {
        currentOnlineState = false;
        listeners.forEach(fn => fn(false));
      });
    }
  }
}

// Check current network status synchronously
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return currentOnlineState;
}

// Check current network status asynchronously with native probe
export async function getNetworkStatus(): Promise<boolean> {
  try {
    const status = await Network.getStatus();
    currentOnlineState = status.connected;
    return status.connected;
  } catch {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    currentOnlineState = online;
    return online;
  }
}

// Subscribe to network changes
export function subscribeNetworkStatus(callback: NetworkListener): () => void {
  listeners.add(callback);
  callback(currentOnlineState);
  return () => {
    listeners.delete(callback);
  };
}

// React Hook for network status
export function useNetworkStatus() {
  const [online, setOnline] = useState<boolean>(isOnline());
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    initNetworkService();

    const unsubscribe = subscribeNetworkStatus((status) => {
      setOnline((prev) => {
        if (!prev && status) {
          setWasOffline(true);
        }
        return status;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline: online, wasOffline, clearWasOffline: () => setWasOffline(false) };
}
