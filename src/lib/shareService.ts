import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Utilitário central de Compartilhamento Nativo / Web
 * Usa @capacitor/share em Android Nativo para abrir o diálogo padrão do sistema (WhatsApp, Drive, Email, etc.)
 * e fallback para Web Share API ou download/cópia de link na Web.
 */
export const shareContent = async (options: {
  title: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}) => {
  try {
    if (Capacitor.isNativePlatform()) {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: options.title,
          text: options.text,
          url: options.url,
          dialogTitle: options.dialogTitle || 'Partilhar com...'
        });
        return true;
      }
    } else if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    console.warn('[Share error]', err);
  }
  return false;
};
