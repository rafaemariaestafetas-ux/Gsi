import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Utilitário central de Feedback Tátil (Haptics)
 * Fornece vibração nativa rica em Android através do Capacitor Haptics
 * com fallback gracioso para navigator.vibrate na Web e sem falhas caso não suportado.
 */

// Vibração leve para cliques normais e seleção de botões
export const triggerLightHaptic = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch (err) {
    // Silencioso em caso de restrição do sistema
  }
};

// Vibração média para marcação de ponto, envio de mensagem e ações importantes
export const triggerMediumHaptic = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
  } catch (err) {
    // Silencioso
  }
};

// Vibração forte de sucesso (ex: ponto marcado com sucesso)
export const triggerSuccessHaptic = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 50, 60]);
    }
  } catch (err) {
    // Silencioso
  }
};

// Vibração de alerta/recusa (ex: chamada recusada ou erro)
export const triggerWarningHaptic = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 40, 50]);
    }
  } catch (err) {
    // Silencioso
  }
};

// Vibração para recebimento de mensagem no chat
export const triggerMessageReceivedHaptic = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([25, 20, 25]);
    }
  } catch (err) {
    // Silencioso
  }
};

// Vibração contínua para chamada a entrar
let callVibrationInterval: any = null;

export const startCallVibration = () => {
  stopCallVibration();
  const vibrateStep = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch {}
  };
  vibrateStep();
  callVibrationInterval = setInterval(vibrateStep, 2000);
};

export const stopCallVibration = () => {
  if (callVibrationInterval) {
    clearInterval(callVibrationInterval);
    callVibrationInterval = null;
  }
};


