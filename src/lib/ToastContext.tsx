import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from './haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global trigger para uso fora do React se necessário
let globalToastHandler: ((message: string, type?: ToastType, title?: string, duration?: number) => void) | null = null;

export const showGlobalToast = (message: string, type: ToastType = 'info', title?: string, duration?: number) => {
  if (globalToastHandler) {
    globalToastHandler(message, type, title, duration);
  } else {
    console.log(`[Toast ${type.toUpperCase()}]`, message);
  }
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (message: string, type: ToastType = 'info', title?: string, duration: number = 3500) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(5)}`;
    const newToast: ToastMessage = { id, type, title, message, duration };

    // Haptic feedback de acordo com o tipo
    if (type === 'success') {
      triggerSuccessHaptic();
    } else if (type === 'error' || type === 'warning') {
      triggerWarningHaptic();
    } else {
      triggerLightHaptic();
    }

    setToasts((prev) => [...prev.slice(-2), newToast]); // Mantém no máximo 3 visíveis ao mesmo tempo

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  };

  useEffect(() => {
    globalToastHandler = addToast;
    return () => {
      globalToastHandler = null;
    };
  }, []);

  const showSuccess = (msg: string, title?: string) => addToast(msg, 'success', title);
  const showError = (msg: string, title?: string) => addToast(msg, 'error', title);
  const showWarning = (msg: string, title?: string) => addToast(msg, 'warning', title);
  const showInfo = (msg: string, title?: string) => addToast(msg, 'info', title);

  return (
    <ToastContext.Provider value={{ toast: addToast, showSuccess, showError, showWarning, showInfo, dismissToast }}>
      {children}
      {/* Toast Floating Container */}
      <div 
        className="fixed z-[9999] pointer-events-none flex flex-col items-center gap-2.5 w-full max-w-sm left-1/2 -translate-x-1/2 px-4"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 1rem)'
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -25, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`
                pointer-events-auto w-full rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl border flex items-center gap-3.5
                ${t.type === 'success' 
                  ? 'bg-[#0f172a]/95 border-[#d4af37]/60 text-white shadow-[#d4af37]/10' 
                  : t.type === 'error'
                  ? 'bg-[#1c0f12]/95 border-red-500/50 text-white shadow-red-950/30'
                  : t.type === 'warning'
                  ? 'bg-[#1f1606]/95 border-amber-500/50 text-white shadow-amber-950/30'
                  : 'bg-[#0f172a]/95 border-white/20 text-white shadow-black/40'}
              `}
            >
              {/* Icon Container */}
              <div className="flex-shrink-0">
                {t.type === 'success' && (
                  <div className="w-9 h-9 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                    <CheckCircle2 size={20} className="stroke-[2.5]" />
                  </div>
                )}
                {t.type === 'error' && (
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                    <XCircle size={20} className="stroke-[2.5]" />
                  </div>
                )}
                {t.type === 'warning' && (
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <AlertTriangle size={20} className="stroke-[2.5]" />
                  </div>
                )}
                {t.type === 'info' && (
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-cyan-400">
                    <Info size={20} className="stroke-[2.5]" />
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pr-1">
                {t.title && (
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#d4af37] leading-tight mb-0.5">
                    {t.title}
                  </p>
                )}
                <p className="text-xs font-bold leading-snug tracking-tight text-white/90">
                  {t.message}
                </p>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex-shrink-0"
                title="Fechar"
              >
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: showGlobalToast,
      showSuccess: (m, t) => showGlobalToast(m, 'success', t),
      showError: (m, t) => showGlobalToast(m, 'error', t),
      showWarning: (m, t) => showGlobalToast(m, 'warning', t),
      showInfo: (m, t) => showGlobalToast(m, 'info', t),
      dismissToast: () => {}
    };
  }
  return context;
};
