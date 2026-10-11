import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  SwitchCamera, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  Clock, 
  WifiOff, 
  ChevronDown,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { triggerLightHaptic, triggerWarningHaptic } from '../lib/haptics';

export type CallStatusType = 'outgoing' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

interface ActiveCallScreenProps {
  status: CallStatusType;
  callType: 'video' | 'audio';
  partnerName: string;
  partnerAvatar?: string | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn?: boolean;
  isRemoteCameraOff?: boolean;
  durationSeconds: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onToggleSpeaker?: () => void;
  onHangUp: () => void;
  onMinimize?: () => void;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  status,
  callType,
  partnerName,
  partnerAvatar,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  isMuted,
  isCameraOff,
  isSpeakerOn = true,
  isRemoteCameraOff = false,
  durationSeconds,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleSpeaker,
  onHangUp,
  onMinimize
}) => {
  const isVideo = callType === 'video';
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Keep screen awake during call
  useEffect(() => {
    let released = false;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // WakeLock may fail if low battery or unsupported
      }
    };

    if (status !== 'ended') {
      requestWakeLock();
    }

    return () => {
      released = true;
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };
  }, [status]);

  // Format call duration: mm:ss
  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'outgoing':
        return 'A chamar...';
      case 'connecting':
        return 'A conectar...';
      case 'reconnecting':
        return 'Reconectando...';
      case 'ended':
        return 'Chamada terminada';
      case 'connected':
      default:
        return formatDuration(durationSeconds);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-[#0a0e17] text-white flex flex-col justify-between overflow-hidden select-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)'
      }}
    >
      {/* Hidden audio element for remote audio stream playback */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }} 
      />

      {/* =========================================================================
          1. VIDEO / VOICE BACKGROUND CANVAS
          ========================================================================= */}
      {isVideo ? (
        <div className="absolute inset-0 w-full h-full bg-slate-950 overflow-hidden">
          {/* Remote Video Stream Fullscreen */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              isRemoteCameraOff || status !== 'connected' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* Fallback if remote camera is off or still connecting */}
          {(isRemoteCameraOff || status !== 'connected') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0d121c] via-[#0a0e17] to-[#0d121c] p-6 text-center">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-[#d4af37]/40 to-slate-700 shadow-2xl">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                    {partnerAvatar ? (
                      <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl font-black text-[#d4af37]">
                        {(partnerName || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {status === 'outgoing' && (
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-[#d4af37]/60"
                  />
                )}
              </div>

              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
                {partnerName}
              </h3>
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
                {isRemoteCameraOff ? (
                  <>
                    <VideoOff size={14} className="text-amber-400" />
                    <span>Câmara do interlocutor desligada</span>
                  </>
                ) : (
                  <span>{getStatusLabel()}</span>
                )}
              </div>
            </div>
          )}

          {/* Picture-in-Picture Local Video (Draggable, bottom/top corner) */}
          {!isCameraOff && status === 'connected' && (
            <motion.div
              drag
              dragConstraints={{ left: -160, right: 160, top: -200, bottom: 200 }}
              whileDrag={{ scale: 1.05 }}
              className="absolute top-20 right-4 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-[#d4af37]/50 shadow-2xl bg-black/80 z-40 touch-none cursor-grab active:cursor-grabbing"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-1 left-2 text-[9px] font-black uppercase text-white/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                Eu
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        /* VOICE CALL VIEW */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0e17] via-[#0e1626] to-[#0a0e17] p-6 text-center overflow-hidden">
          {/* Subtle Ambient Glow Circles */}
          <div className="absolute w-80 h-80 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />

          {/* Large Center Avatar with Acoustic Wave Pulses */}
          <div className="relative flex items-center justify-center my-auto">
            {status === 'connected' && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.05, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-44 h-44 rounded-full border border-[#d4af37]/40"
                />
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                  className="absolute w-44 h-44 rounded-full border border-emerald-400/30"
                />
              </>
            )}

            {status === 'outgoing' && (
              <motion.div
                animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                className="absolute w-44 h-44 rounded-full border-2 border-[#d4af37]/50"
              />
            )}

            <div className="relative w-40 h-40 rounded-full p-1.5 bg-gradient-to-tr from-[#d4af37] via-slate-700 to-[#d4af37]/60 shadow-2xl shadow-[#d4af37]/20 z-10">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center border-2 border-slate-950">
                {partnerAvatar ? (
                  <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-black text-[#d4af37]">
                    {(partnerName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Caller Details & State */}
          <div className="relative z-10 text-center space-y-2 mt-4 max-w-xs">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-md line-clamp-1">
              {partnerName}
            </h2>

            <div className="flex items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                {status === 'connected' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                ) : status === 'reconnecting' ? (
                  <WifiOff size={14} className="text-amber-400 animate-pulse" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-ping" />
                )}
                <span className="text-xs font-bold tracking-widest uppercase text-slate-300">
                  {getStatusLabel()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. TOP HEADER OVERLAY (Controls / Status / Minimize)
          ========================================================================= */}
      <div className="relative z-30 flex items-center justify-between px-6 pt-2">
        {/* Back / Minimize button */}
        {onMinimize ? (
          <button
            onClick={() => {
              triggerLightHaptic();
              onMinimize();
            }}
            className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/90 active:scale-95 transition-all"
            title="Minimizar chamada"
          >
            <ChevronDown size={22} />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}

        {/* Center Pill: Status & Encryption */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg">
            <ShieldCheck size={13} className="text-[#d4af37]" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              GSI Criptografia Ponta-a-Ponta
            </span>
          </div>
          {isVideo && (
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/80 drop-shadow">
              <Clock size={12} className="text-[#d4af37]" />
              <span>{getStatusLabel()}</span>
            </div>
          )}
        </div>

        {/* Placeholder balance */}
        <div className="w-10 h-10" />
      </div>

      {/* =========================================================================
          3. FLOATING GLASS CONTROL BAR (Bottom)
          ========================================================================= */}
      <div className="relative z-30 w-full px-6 flex justify-center pb-4">
        <div className="flex items-center gap-4 sm:gap-6 px-6 py-4 rounded-full bg-black/60 backdrop-blur-2xl border border-white/15 shadow-2xl">
          {/* Mute Microphone Toggle */}
          <button
            onClick={() => {
              triggerLightHaptic();
              onToggleMute();
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
            }`}
            title={isMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Camera On / Off Toggle (Video Calls Only) */}
          {isVideo && (
            <button
              onClick={() => {
                triggerLightHaptic();
                onToggleCamera();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                isCameraOff
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
              title={isCameraOff ? 'Ligar Câmara' : 'Desligar Câmara'}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          {/* Flip Camera (Front / Back cycle - Video Calls Only) */}
          {isVideo && !isCameraOff && (
            <button
              onClick={() => {
                triggerLightHaptic();
                onFlipCamera();
              }}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-md"
              title="Alternar Câmara Frente/Trás"
            >
              <SwitchCamera size={22} />
            </button>
          )}

          {/* Speakerphone Toggle */}
          {onToggleSpeaker && (
            <button
              onClick={() => {
                triggerLightHaptic();
                onToggleSpeaker();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                isSpeakerOn
                  ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40'
                  : 'bg-white/10 hover:bg-white/20 text-white/70 border border-white/10'
              }`}
              title={isSpeakerOn ? 'Altifalante Ligado' : 'Altifalante Desligado'}
            >
              {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
          )}

          {/* Hang Up (Encerrar Chamada - Red Highlight) */}
          <button
            onClick={() => {
              triggerWarningHaptic();
              onHangUp();
            }}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/50 active:scale-90 transition-transform border border-red-400/40"
            title="Encerrar Chamada"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. CALL SUMMARY OVERLAY (When Ended)
          ========================================================================= */}
      <AnimatePresence>
        {status === 'ended' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0a0e17]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 mb-6 shadow-2xl">
              <CheckCircle2 size={40} className="text-[#d4af37]" />
            </div>

            <h3 className="text-2xl font-black uppercase tracking-wider text-white mb-2">
              Chamada Terminada
            </h3>
            
            <p className="text-sm text-slate-400 mb-6">
              com <span className="text-white font-bold">{partnerName}</span>
            </p>

            <div className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-base font-black tracking-widest text-[#d4af37]">
              Duração: {formatDuration(durationSeconds)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          5. EXIT CONFIRMATION MODAL (Android Back button safety)
          ========================================================================= */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-lg font-bold text-white">Encerrar a chamada?</h4>
              <p className="text-xs text-slate-300">
                Se sair agora, a chamada ativa com {partnerName} será desligada.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Continuar
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onHangUp();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Encerrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActiveCallScreen;
