import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

/**
 * Configuração do Capacitor - GSI PRO
 * Versão atual: 1.0.1 (Mantenha sincronizado com package.json e src/version.ts)
 */
export const APP_VERSION = '1.0.1';

const config: CapacitorConfig = {
  appId: 'com.gsipro.app',
  appName: 'GSI PRO',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#0a0e17',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
