import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Cloud, CloudOff, CheckCircle2, Clock, WifiOff, RefreshCw } from 'lucide-react';
import { playSuccessSound } from '../lib/sounds';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../lib/haptics';
import { AbsenceJustificationModal } from './AbsenceJustificationModal';
import { TimeEntry } from '../types';

interface ClockMarkingProps {
  onMark: (hours: number) => void;
  onAbsence: (reason: string) => void;
  isDarkMode: boolean;
  hasMarkedToday?: boolean;
  todayEntry?: TimeEntry | null;
  isOffline?: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => void;
}

export default function ClockMarking({ 
  onMark, 
  onAbsence, 
  isDarkMode, 
  hasMarkedToday = false,
  todayEntry,
  isOffline = false,
  pendingSyncCount = 0,
  onSyncNow
}: ClockMarkingProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedHours, setSelectedHours] = useState(8);
  const [isSunday, setIsSunday] = useState(new Date().getDay() === 0);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setIsSunday(new Date().getDay() === 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAbsenceClick = () => {
    setIsAbsenceModalOpen(true);
  };

  const handleConfirmAbsence = (reason: string) => {
    setIsAbsenceModalOpen(false);
    onAbsence(reason);
  };

  const progress = (selectedHours / 15) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-10 px-6 space-y-12">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Marcar Ponto</h2>
          <span className="bg-[#d4af37] text-black text-[10px] font-black px-2 py-0.5 rounded uppercase">NEW</span>
        </div>
        {isSunday && (
          <div className="bg-red-500/20 text-red-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-500/30 inline-block mt-2">
            Domingo: Dia de Folga
          </div>
        )}
      </div>
      
      {/* ... (Clock UI stays same) ... */}
      <div className="relative group">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full border-[12px] border-[#1c2431] bg-[#0a0e17] flex flex-col items-center justify-center shadow-2xl overflow-hidden">
          <div className="absolute inset-0 border-2 border-cyan-400/30 rounded-full" />
          <motion.div 
            className="absolute inset-0 border-t-4 border-cyan-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />

          <div className="z-10 text-center space-y-1">
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest">
              {format(currentTime, "EEEE", { locale: ptBR })}
            </p>
            <p className="text-sm font-black text-white uppercase tracking-tight">
              {format(currentTime, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-6xl font-black text-white tabular-nums tracking-tighter">
              {format(currentTime, "HH:mm")}
              <span className="text-2xl opacity-40 ml-1">{format(currentTime, ":ss")}</span>
            </p>
          </div>

          {Array.from({ length: 12 }).map((_, i) => (
            <div 
              key={i}
              className="absolute w-1 h-3 bg-cyan-400/40 rounded-full"
              style={{ 
                transform: `rotate(${i * 30}deg) translateY(-135px)`,
                transformOrigin: 'bottom center',
                top: '50%',
                left: '50%',
                marginLeft: '-0.125rem',
                marginTop: '-135px'
              }}
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-8">
        {!isSunday && (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Meta Diária</p>
              <p className="text-xs font-black text-white">{selectedHours}h / 15h</p>
            </div>
            <div className="h-2 bg-[#1c2431] rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            
            <div className="flex justify-between gap-2">
              {[7, 8, 9, 10, 12].map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    triggerLightHaptic();
                    setSelectedHours(h);
                  }}
                  className={`flex-1 py-3 rounded-xl text-xs font-black transition-all border ${selectedHours === h ? 'bg-white text-black border-white' : 'bg-[#1c2431] text-white/40 border-white/5 hover:border-white/20'}`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          {/* Offline Notice Banner if disconnected and not marked yet */}
          {isOffline && !hasMarkedToday && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <CloudOff size={16} />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-amber-300 leading-tight">Modo Offline Activo</p>
                <p className="text-[10px] text-white/60 leading-tight">Pode marcar ponto à vontade. Será guardado no telemóvel e sincronizado assim que houver rede.</p>
              </div>
            </div>
          )}

          {!isSunday ? (
            hasMarkedToday ? (
              todayEntry?.sync_status === 'pending_sync' ? (
                <div className="w-full bg-amber-500/10 border border-amber-500/40 text-amber-300 py-5 px-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 shadow-lg shadow-amber-950/20">
                  <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-amber-400">
                    <Cloud size={18} className="animate-pulse" />
                    Ponto Guardado Offline
                  </div>
                  <span className="text-[11px] font-semibold text-amber-200/90 text-center leading-snug">
                    Pendente de sincronização — vai enviar para o Supabase assim que voltar a rede.
                  </span>
                  {!isOffline && onSyncNow && (
                    <button
                      onClick={onSyncNow}
                      className="mt-1 bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <RefreshCw size={12} />
                      Sincronizar Agora
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] flex flex-col items-center justify-center gap-1 shadow-lg">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    Ponto Registado
                  </span>
                  <span className="text-[8px] opacity-70 tracking-widest font-bold">
                    Sincronizado na cloud com sucesso!
                  </span>
                </div>
              )
            ) : (
              <button
                onClick={() => {
                  triggerSuccessHaptic();
                  playSuccessSound();
                  onMark(selectedHours);
                }}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
              >
                Marcar Ponto
              </button>
            )
          ) : (
            <button
              disabled
              className="w-full bg-[#1c2431] text-white/20 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] cursor-not-allowed border border-white/5"
            >
              Folga (Domingo)
            </button>
          )}
          
          {!hasMarkedToday && (
            <button 
              onClick={() => {
                triggerWarningHaptic();
                handleAbsenceClick();
              }}
              className="w-full bg-white/5 border border-white/10 text-white/70 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all active:scale-[0.97]"
            >
              Marcar Falta / Justificar
            </button>
          )}

          {/* Pending items counter if any offline points await sync */}
          {pendingSyncCount > 0 && todayEntry?.sync_status !== 'pending_sync' && (
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-xl py-2 px-3">
              <Cloud size={13} className="animate-pulse" />
              <span>{pendingSyncCount} ponto{pendingSyncCount > 1 ? 's' : ''} guardado{pendingSyncCount > 1 ? 's' : ''} offline aguardando envio</span>
            </div>
          )}
        </div>

        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] text-center">
          {isSunday 
            ? 'Bom descanso! Voltamos amanhã.' 
            : hasMarkedToday 
            ? (todayEntry?.sync_status === 'pending_sync' ? 'Guardado localmente. Aguardando rede.' : 'Ponto de hoje sincronizado.') 
            : `Entrada Livre até 23:59 | Total Selecionado: ${selectedHours}h`}
        </p>
      </div>

      {/* Modal de Justificativa de Falta Premium Dark/Dourado */}
      <AbsenceJustificationModal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        onConfirm={handleConfirmAbsence}
      />
    </div>
  );
}
