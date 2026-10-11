import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, Check, FileText } from 'lucide-react';
import { triggerLightHaptic, triggerWarningHaptic } from '../lib/haptics';

interface AbsenceJustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const AbsenceJustificationModal: React.FC<AbsenceJustificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [selectedQuickReason, setSelectedQuickReason] = useState<string | null>(null);

  const quickReasons = [
    'Atestado Médico / Doença',
    'Assunto Pessoal Urgente',
    'Compromisso Familiar',
    'Transporte / Trânsito',
    'Condições Climáticas'
  ];

  const handleSelectQuick = (text: string) => {
    triggerLightHaptic();
    setSelectedQuickReason(text);
    setReason(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      triggerWarningHaptic();
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setSelectedQuickReason(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-[#0f172a] border border-[#d4af37]/30 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl relative overflow-hidden"
        >
          {/* Top Gold Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Justificar Falta
                </h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  Registo oficial de ausência
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 active:scale-[0.97] transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Quick Chips */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] block mb-2">
                Motivos Frequentes
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickReasons.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => handleSelectQuick(qr)}
                    className={`
                      text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all text-left active:scale-[0.97]
                      ${selectedQuickReason === qr
                        ? 'bg-[#d4af37] text-black border-[#d4af37] shadow-sm shadow-[#d4af37]/30'
                        : 'bg-white/5 text-white/70 border-white/10 hover:border-white/25 hover:text-white'}
                    `}
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1.5">
                Descrição Detalhada
              </label>
              <div className="relative">
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Escreva a justificativa para este dia de trabalho..."
                  className="w-full bg-[#0a0e17] border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30 transition-all resize-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions: Consistent Primary & Secondary Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-black uppercase tracking-wider active:scale-[0.97] transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!reason.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c04b] text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Check size={14} className="stroke-[3]" />
                <span>Confirmar</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
