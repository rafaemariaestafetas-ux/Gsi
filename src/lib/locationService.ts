import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface SimpleCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Utilitário Unificado de Geolocalização Nativa e Web
 * Usa @capacitor/geolocation quando executado nativamente no Android
 * para precisão de hardware sem bloqueios de WebView, com fallback para navigator.geolocation na web.
 */
export const getCurrentLocation = async (options?: { timeout?: number; enableHighAccuracy?: boolean }): Promise<SimpleCoords> => {
  const timeout = options?.timeout || 10000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  if (Capacitor.isNativePlatform()) {
    try {
      // Solicita ou verifica permissões nativas no Android
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
        if (req.location === 'denied') {
          throw new Error('Permissão de GPS negada pelo utilizador.');
        }
      }

      const pos: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge: 10000
      });

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
    } catch (nativeErr: any) {
      console.warn('[Geolocation Native Error]', nativeErr);
      // Fallback para navigator se o plugin falhar
    }
  }

  // Fallback para navegador web ou caso o nativo falhe
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste dispositivo.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge: 10000
      }
    );
  });
};
