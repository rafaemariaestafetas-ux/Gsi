import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Converte base64 data URL ou base64 string num File / Blob pronto para envio para o Supabase Storage
 */
export const base64ToFile = (base64String: string, filename: string, mimeType = 'image/jpeg'): File => {
  const pureBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const byteCharacters = atob(pureBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
};

/**
 * Captura foto usando a câmara nativa do Android (ou seletor nativo)
 * Se for Web, retorna null indicando que a UI deve acionar o input file tradicional
 */
export const captureNativePhoto = async (source: 'camera' | 'photos' = 'camera'): Promise<File | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false,
      correctOrientation: true
    });

    if (photo && photo.base64String) {
      const extension = photo.format || 'jpg';
      const filename = `photo_${Date.now()}.${extension}`;
      return base64ToFile(photo.base64String, filename, `image/${extension}`);
    }
    return null;
  } catch (err: any) {
    // Se o utilizador cancelou a captura nativa
    if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
      return null;
    }
    console.warn('[Camera Native Error]', err);
    return null;
  }
};
