import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={install}
        className="flex items-center gap-2 bg-[#d4af37] text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#d4af37]/20 hover:bg-[#b8962d] transition-all"
      >
        <Download size={14} />
        Instalar GSI PRO
      </motion.button>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 bg-[#d4af37] text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#d4af37]/20 hover:bg-[#b8962d] transition-all"
        >
          <Download size={14} />
          Instalar no iPhone
        </motion.button>

        <AnimatePresence>
          {showIOSGuide && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-[2rem] p-8 relative"
              >
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="absolute top-6 right-6 text-white/40 hover:text-white"
                >
                  <X size={20} />
                </button>

                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#d4af37]/20">
                    <Download className="text-[#d4af37]" size={32} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Instalar GSI PRO</h3>
                    <p className="text-white/60 text-sm font-medium leading-relaxed">
                      Siga estes passos para adicionar o app à sua tela de início:
                    </p>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex items-start gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0">1</div>
                      <p className="text-white/80 text-sm font-medium pt-1.5 flex items-center gap-2">
                        Toque no botão <Share size={16} className="text-blue-400" /> (Compartilhar) na barra do Safari.
                      </p>
                    </div>
                    <div className="flex items-start gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0">2</div>
                      <p className="text-white/80 text-sm font-medium pt-1.5">
                        Role para baixo e selecione <strong>'Adicionar à Tela de Início'</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                  >
                    Entendi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
};
