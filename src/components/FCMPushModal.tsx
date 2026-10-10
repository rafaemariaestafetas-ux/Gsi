import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Smartphone, 
  ShieldCheck, 
  Send, 
  RefreshCw, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  requestFCMToken, 
  testBackgroundNotification, 
  syncRemindersWithServiceWorker 
} from '../services/firebaseMessaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

interface FCMPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function FCMPushModal({ isOpen, onClose, userId }: FCMPushModalProps) {
  const [permission, setPermission] = useState<string>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(localStorage.getItem('gsi_fcm_token'));
  const [isActivating, setIsActivating] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [entryHour, setEntryHour] = useState(8);
  const [exitHour, setExitHour] = useState(17);
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      PushNotifications.checkPermissions().then(status => {
        setPermission(status.receive === 'granted' ? 'granted' : 'default');
      }).catch(() => {});
      setFcmToken(localStorage.getItem('gsi_fcm_token'));
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      setFcmToken(localStorage.getItem('gsi_fcm_token'));
    }
  }, [isOpen]);

  const handleActivateFCM = async () => {
    setIsActivating(true);
    try {
      const token = await requestFCMToken(userId);
      if (token) {
        setFcmToken(token);
        setPermission('granted');
        await syncRemindersWithServiceWorker({
          enabled: true,
          entryHour,
          exitHour,
          days: activeDays
        });
      } else {
        alert('Não foi possível ativar as notificações push. Verifique se concedeu permissão nas configurações do sistema.');
      }
    } catch (err: any) {
      console.error('Error activating FCM:', err);
    } finally {
      setIsActivating(false);
    }
  };

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      await handleActivateFCM();
      return;
    }

    setTestCountdown(5);
    const success = await testBackgroundNotification(5);
    if (!success) return;

    let timeLeft = 5;
    const interval = setInterval(() => {
      timeLeft -= 1;
      setTestCountdown(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(interval);
        setTestCountdown(null);
      }
    }, 1000);
  };

  const handleSaveSchedule = async () => {
    await syncRemindersWithServiceWorker({
      enabled: true,
      entryHour,
      exitHour,
      days: activeDays
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleDay = (dayIndex: number) => {
    setActiveDays(prev => 
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-7 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shadow-lg shadow-[#d4af37]/10">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Notificações Push (FCM)
                </h3>
                <p className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest">
                  Alertas com o App Fechado
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* FCM Status Badge */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
            permission === 'granted' && fcmToken
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            {permission === 'granted' && fcmToken ? (
              <CheckCircle size={22} className="flex-shrink-0 text-green-400" />
            ) : (
              <AlertTriangle size={22} className="flex-shrink-0 text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">
                {permission === 'granted' && fcmToken
                  ? 'Alertas em Segundo Plano Ativos'
                  : 'Ativação Necessária'}
              </p>
              <p className="text-[10px] opacity-80 mt-0.5">
                {permission === 'granted' && fcmToken
                  ? 'O dispositivo está registrado no Firebase Cloud Messaging e receberá lembretes mesmo fechado.'
                  : 'Autorize as notificações push para que o sistema alerte os horários de entrada e saída.'}
              </p>
            </div>
          </div>

          {/* Action to Request / Re-sync FCM Token */}
          {(!fcmToken || permission !== 'granted') && (
            <button
              onClick={handleActivateFCM}
              disabled={isActivating}
              className="w-full py-4 bg-[#d4af37] text-black font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {isActivating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Conectando ao Firebase...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Ativar Alertas no Meu Dispositivo
                </>
              )}
            </button>
          )}

          {/* Test Background Push Button */}
          <div className="p-5 bg-black/25 border border-white/5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Smartphone size={16} className="text-[#d4af37]" />
                  Teste de Notificação com App Fechado
                </h4>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Dispara um alerta push em 5 segundos para você testar com a tela bloqueada ou app minimizado.
                </p>
              </div>
            </div>

            {testCountdown !== null ? (
              <div className="p-4 bg-[#d4af37]/20 border border-[#d4af37]/40 rounded-xl text-center space-y-1 animate-pulse">
                <p className="text-sm font-black text-[#d4af37] uppercase">
                  Feche ou minimize o app agora! ({testCountdown}s)
                </p>
                <p className="text-[9px] text-white/70">
                  O alerta via Firebase Cloud Messaging surgirá no seu celular / computador.
                </p>
              </div>
            ) : (
              <button
                onClick={handleTestNotification}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Send size={14} className="text-[#d4af37]" />
                Testar Alerta com App Fechado
              </button>
            )}
          </div>

          {/* Schedule Configuration for Clock In / Clock Out */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white">
              <Clock size={16} className="text-[#d4af37]" />
              <h4 className="text-xs font-black uppercase tracking-wider">Horários dos Alertas de Ponto</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-black/25 border border-white/5 rounded-2xl space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Entrada (Início)
                </label>
                <select
                  value={entryHour}
                  onChange={(e) => setEntryHour(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] text-white font-black text-sm p-3 rounded-xl border border-white/5 outline-none focus:border-[#d4af37]"
                >
                  {[6, 7, 8, 9, 10].map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-black/25 border border-white/5 rounded-2xl space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Saída (Fim de Turno)
                </label>
                <select
                  value={exitHour}
                  onChange={(e) => setExitHour(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] text-white font-black text-sm p-3 rounded-xl border border-white/5 outline-none focus:border-[#d4af37]"
                >
                  {[16, 17, 18, 19, 20, 21].map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Days Selection */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
                Dias da Semana Ativos
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {[
                  { id: 1, label: 'Seg' },
                  { id: 2, label: 'Ter' },
                  { id: 3, label: 'Qua' },
                  { id: 4, label: 'Qui' },
                  { id: 5, label: 'Sex' },
                  { id: 6, label: 'Sáb' },
                  { id: 0, label: 'Dom' },
                ].map(d => {
                  const isActive = activeDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${
                        isActive
                          ? 'bg-[#d4af37] text-black shadow-md shadow-[#d4af37]/20'
                          : 'bg-black/25 text-white/40 border border-white/5'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSaveSchedule}
              className="w-full py-3.5 bg-white/5 hover:bg-[#d4af37]/20 border border-white/10 hover:border-[#d4af37]/40 text-white hover:text-[#d4af37] font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle size={15} className="text-green-400" />
                  Horários Sincronizados com o Service Worker!
                </>
              ) : (
                'Salvar e Sincronizar Horários'
              )}
            </button>
          </div>

          {/* Helpful Information Notice */}
          <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex items-start gap-3">
            <Info size={16} className="text-[#d4af37] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/50 leading-relaxed">
              <strong>Como funciona com o app fechado:</strong> O Service Worker do Firebase Cloud Messaging roda em segundo plano através do sistema operacional e do navegador, disparando as notificações diretamente na barra de status do seu dispositivo.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
