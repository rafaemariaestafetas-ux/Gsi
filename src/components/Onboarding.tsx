import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  MessageSquare, 
  Bell, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  MapPin, 
  Mic, 
  Check, 
  HardHat, 
  Radio
} from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../lib/haptics';

interface OnboardingProps {
  onComplete: () => void;
  userId?: string;
  onRequestNotifications?: () => Promise<boolean | string | null>;
}

export const ONBOARDING_STORAGE_KEY = 'gsi_onboarding_done';

export default function Onboarding({ onComplete, onRequestNotifications }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActivatingNotifications, setIsActivatingNotifications] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);

  const totalSteps = 5;

  const handleFinish = () => {
    triggerSuccessHaptic();
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    onComplete();
  };

  const handleSkip = () => {
    triggerLightHaptic();
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    onComplete();
  };

  const handleNext = () => {
    triggerLightHaptic();
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    triggerLightHaptic();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleActivateNotifications = async () => {
    triggerMediumHaptic();
    setIsActivatingNotifications(true);
    try {
      if (onRequestNotifications) {
        const res = await onRequestNotifications();
        if (res) {
          setNotificationGranted(true);
          triggerSuccessHaptic();
          // Small delay so user sees confirmation before auto-advancing
          setTimeout(() => {
            setCurrentStep(4);
          }, 800);
          return;
        }
      }
    } catch (err) {
      console.warn('[Onboarding] Erro ao ativar notificações:', err);
    } finally {
      setIsActivatingNotifications(false);
    }
    // Advance to next step even if declined
    setCurrentStep(4);
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-[#0a0e17] text-white flex flex-col justify-between overflow-hidden select-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        paddingLeft: '1.25rem',
        paddingRight: '1.25rem'
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[140%] h-[50%] bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.15)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[20%] right-[-10%] w-[80%] h-[50%] bg-[radial-gradient(ellipse_at_bottom,rgba(30,58,138,0.15)_0%,transparent_70%)]" />
      </div>

      {/* Top Header: Brand & Skip Button */}
      <div className="relative z-10 flex items-center justify-between w-full h-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d4af37]">
            GSI PRO <span className="text-white/40 font-normal">| TUTORIAL</span>
          </span>
        </div>

        {currentStep < totalSteps - 1 && (
          <button
            onClick={handleSkip}
            className="text-xs font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Main Content Area (Slide Animations) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center my-4 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* STEP 1: Bem-vindo */}
          {currentStep === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6 w-full"
            >
              <div className="relative flex items-center justify-center py-4">
                <div className="absolute w-44 h-44 rounded-full bg-[#d4af37]/10 blur-2xl animate-pulse" />
                <AnimatedLogo size={130} withSound={false} />
              </div>

              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-black uppercase tracking-widest">
                  <Sparkles size={12} /> Plataforma Oficial de Obra
                </span>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  Bem-vindo ao <span className="text-[#d4af37]">GSI PRO</span>
                </h1>
                <p className="text-sm text-white/70 max-w-xs leading-relaxed font-medium">
                  O teu sistema de ponto, equipa e comunicação num só sítio.
                </p>
              </div>

              {/* Feature pills */}
              <div className="grid grid-cols-3 gap-2 w-full pt-2">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center text-center space-y-1.5">
                  <Clock size={18} className="text-[#d4af37]" />
                  <span className="text-[11px] font-bold text-white">Ponto</span>
                  <span className="text-[9px] text-white/40">Rápido & GPS</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center text-center space-y-1.5">
                  <MessageSquare size={18} className="text-[#d4af37]" />
                  <span className="text-[11px] font-bold text-white">Chat</span>
                  <span className="text-[9px] text-white/40">Grupos & Áudios</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center text-center space-y-1.5">
                  <Radio size={18} className="text-[#d4af37]" />
                  <span className="text-[11px] font-bold text-white">Offline</span>
                  <span className="text-[9px] text-white/40">Sync Automático</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Marcar Ponto */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6 w-full"
            >
              {/* Interactive visual mockup */}
              <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                      <Clock size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-white">Registo Diário</p>
                      <p className="text-[9px] text-white/40">Hoje • 08:00h às 17:00h</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Sincronizado
                  </span>
                </div>

                <div className="py-4 space-y-3">
                  <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                    <span className="text-xs text-white/60">Obra Atual:</span>
                    <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1">
                      <HardHat size={12} /> Obra Chiado Central
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="py-2.5 rounded-xl bg-[#d4af37] text-black font-black text-xs text-center shadow-lg shadow-[#d4af37]/20">
                      8 HORAS
                    </div>
                    <div className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 font-bold text-xs text-center">
                      9 HORAS
                    </div>
                    <div className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs text-center">
                      FALTA
                    </div>
                  </div>
                </div>

                <div className="w-full py-2.5 rounded-xl bg-[#d4af37] text-black font-black text-xs flex items-center justify-center gap-2 shadow-md">
                  <Check size={14} className="stroke-[3]" /> MARCAR PONTO AGORA
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Marca o teu ponto <span className="text-[#d4af37]">em segundos</span>
                </h2>
                <p className="text-sm text-white/70 max-w-xs leading-relaxed font-medium">
                  Regista horas, obra e faltas de forma rápida e organizada. Funciona mesmo sem internet com sincronização automática!
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Chat e Equipa */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6 w-full"
            >
              {/* Chat visual mockup */}
              <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-2xl relative space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#d4af37] text-black font-black text-xs flex items-center justify-center">
                      GP
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-white">Equipa de Engenharia</p>
                      <p className="text-[9px] text-[#d4af37] font-semibold">14 colegas ativos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    <Sparkles size={10} className="text-[#d4af37]" /> Temas Disponíveis
                  </div>
                </div>

                {/* Chat Bubbles */}
                <div className="space-y-2.5 text-left text-xs py-1">
                  <div className="max-w-[80%] bg-white/10 text-white/90 p-2.5 rounded-2xl rounded-tl-sm border border-white/10">
                    <p className="text-[10px] font-bold text-[#d4af37] mb-0.5">Mário Ferreira</p>
                    O carregamento de material acabou de chegar à obra.
                  </div>
                  <div className="max-w-[80%] ml-auto bg-[#d4af37] text-black font-medium p-2.5 rounded-2xl rounded-tr-sm shadow-md">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-black" />
                      <div className="h-1 flex-1 bg-black/20 rounded-full overflow-hidden">
                        <div className="w-2/3 h-full bg-black" />
                      </div>
                      <span className="text-[10px] font-bold">0:18</span>
                    </div>
                  </div>
                  <div className="max-w-[75%] bg-white/10 text-white/90 p-2 rounded-xl flex items-center gap-2 border border-white/10">
                    <MapPin size={14} className="text-blue-400 shrink-0" />
                    <span className="text-[10px] truncate">Obra Parque das Nações</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Fala com a equipa <span className="text-[#d4af37]">em tempo real</span>
                </h2>
                <p className="text-sm text-white/70 max-w-xs leading-relaxed font-medium">
                  Mensagens, grupos, áudios, fotos e localização — tudo no Messenger integrado com temas personalizáveis.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Notificações */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6 w-full"
            >
              <div className="relative py-4">
                <div className="w-28 h-28 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center relative">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], rotate: [0, -10, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  >
                    <Bell size={52} className="text-[#d4af37]" />
                  </motion.div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-[#0a0e17] flex items-center justify-center text-[10px] font-black text-white">
                    !
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Não percas <span className="text-[#d4af37]">nada importante</span>
                </h2>
                <p className="text-sm text-white/70 max-w-xs leading-relaxed font-medium">
                  Ativa as notificações para receber mensagens, chamadas e alertas de ponto mesmo com o app fechado.
                </p>
              </div>

              {/* Action buttons specific to Notification Step */}
              <div className="w-full space-y-2.5 pt-2">
                <button
                  onClick={handleActivateNotifications}
                  disabled={isActivatingNotifications || notificationGranted}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#d4af37] text-black font-black text-sm tracking-wide shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-75"
                >
                  {isActivatingNotifications ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>A configurar permissões...</span>
                    </>
                  ) : notificationGranted ? (
                    <>
                      <CheckCircle2 size={18} className="text-black" />
                      <span>Notificações ativadas!</span>
                    </>
                  ) : (
                    <>
                      <Bell size={18} />
                      <span>Ativar notificações</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNext}
                  className="w-full py-3 px-6 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white font-bold text-xs active:scale-[0.98] transition-all"
                >
                  Agora não
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Pronto */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6 w-full"
            >
              <div className="relative py-4">
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#d4af37]/20 to-emerald-500/20 border border-[#d4af37]/40 flex items-center justify-center relative shadow-2xl">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  >
                    <ShieldCheck size={56} className="text-[#d4af37]" />
                  </motion.div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  <Check size={12} className="stroke-[3]" /> Configuração Concluída
                </span>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  Tudo <span className="text-[#d4af37]">pronto!</span>
                </h2>
                <p className="text-sm text-white/70 max-w-xs leading-relaxed font-medium">
                  Já podes começar a usar o GSI PRO. Bom trabalho na obra!
                </p>
              </div>

              <div className="w-full pt-4">
                <button
                  onClick={handleFinish}
                  className="w-full py-4 px-6 rounded-2xl bg-[#d4af37] text-black font-black text-base tracking-wide shadow-xl shadow-[#d4af37]/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <span>Começar</span>
                  <ArrowRight size={20} className="stroke-[2.5]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation: Dots & Buttons (Except for Step 3 and 4 which have customized CTAs) */}
      <div className="relative z-10 w-full max-w-md mx-auto pt-2 space-y-4">
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                triggerLightHaptic();
                setCurrentStep(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-7 bg-[#d4af37]'
                  : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ir para o passo ${idx + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons for Step 0, 1, 2 */}
        {currentStep < 3 && (
          <div className="flex items-center gap-3">
            {currentStep > 0 ? (
              <button
                onClick={handlePrev}
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center active:scale-95 transition-all"
                aria-label="Voltar"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}

            <button
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-[#d4af37] text-black font-black text-sm tracking-wide shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span>Continuar</span>
              <ArrowRight size={18} className="stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
