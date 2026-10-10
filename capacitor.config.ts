import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração do Capacitor - GSI PRO
 * Versão atual: 1.0.0 (Mantenha sincronizado com package.json e src/version.ts)
 */
export const APP_VERSION = '1.0.0';

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
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
