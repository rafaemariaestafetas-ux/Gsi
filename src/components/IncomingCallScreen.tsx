import React from 'react';
import { motion } from 'motion/react';
import { Phone, PhoneOff, Video, Mic, ShieldCheck } from 'lucide-react';
import { triggerSuccessHaptic, triggerWarningHaptic, triggerLightHaptic } from '../lib/haptics';

interface IncomingCallScreenProps {
  callerName: string;
  callerAvatar?: string | null;
  callType: 'video' | 'audio';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline
}) => {
  const isVideo = callType === 'video';

  const handleAccept = () => {
    triggerSuccessHaptic();
    onAccept();
  };

  const handleDecline = () => {
    triggerWarningHaptic();
    onDecline();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[1000] bg-[#0a0e17] text-white flex flex-col justify-between items-center px-6 py-10 select-none overflow-hidden"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)'
      }}
    >
      {/* Background Animated Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.15, 0.3, 0.15]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#d4af37]/15 blur-3xl"
        />
      </div>

      {/* Top Header Badge */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
          <ShieldCheck size={14} className="text-[#d4af37]" />
          <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
            GSI PRO • Chamada Segura
          </span>
        </div>

        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="inline-flex items-center gap-2 mt-2 px-4 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-widest uppercase"
        >
          {isVideo ? <Video size={14} className="animate-pulse" /> : <Mic size={14} className="animate-pulse" />}
          <span>A Receber Chamada de {isVideo ? 'Vídeo' : 'Voz'}</span>
        </motion.div>
      </div>

      {/* Center Caller Profile & Pulse Rings */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative flex items-center justify-center w-64 h-64">
          {/* Outer Pulsing Ring 3 */}
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
            className="absolute w-36 h-36 rounded-full border-2 border-emerald-500/40"
          />
          {/* Middle Pulsing Ring 2 */}
          <motion.div
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            className="absolute w-36 h-36 rounded-full border border-emerald-400/50"
          />
          {/* Inner Pulsing Ring 1 */}
          <motion.div
            animate={{ scale: [1, 1.25], opacity: [0.7, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute w-36 h-36 rounded-full bg-emerald-500/10 border border-emerald-400/60"
          />

          {/* Avatar Container */}
          <motion.div
            animate={{ scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-emerald-500 via-[#d4af37] to-emerald-400 shadow-2xl shadow-emerald-500/30"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center border-2 border-slate-900">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  alt={callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1c2431] to-[#0a0e17] text-white text-5xl font-black">
                  {(callerName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Floating Type Icon Badge */}
            <div className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full bg-[#1c2431] border-2 border-emerald-500/80 flex items-center justify-center text-emerald-400 shadow-lg">
              {isVideo ? <Video size={20} /> : <Phone size={20} />}
            </div>
          </motion.div>
        </div>

        {/* Caller Name & Status */}
        <div className="text-center mt-6 space-y-2 max-w-xs">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md line-clamp-2">
            {callerName || 'Colega de Obra'}
          </h2>
          <p className="text-sm text-slate-400 font-medium tracking-wide">
            GSI Messenger
          </p>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-10 w-full max-w-sm flex items-center justify-around px-4">
        {/* Recusar (Decline Button) */}
        <div className="flex flex-col items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleDecline}
            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-600/50 border border-red-400/30 active:scale-95 transition-transform"
            aria-label="Recusar chamada"
          >
            <PhoneOff size={32} />
          </motion.button>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Recusar
          </span>
        </div>

        {/* Atender (Accept Button) */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-emerald-500"
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleAccept}
              className="relative w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-emerald-500/60 border border-emerald-300/40 active:scale-95 transition-transform"
              aria-label="Atender chamada"
            >
              <Phone size={34} className="fill-slate-950" />
            </motion.button>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-black">
            Atender
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default IncomingCallScreen;
