import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Share, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={handleClick}
        className="flex items-center gap-2 bg-[#d4af37] text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#d4af37]/20 hover:bg-[#b8962d] active:scale-95 transition-all"
        title="Instalar aplicativo na tela inicial"
      >
        <Download size={14} />
        {isIOS ? 'Instalar no iPhone' : 'Instalar App'}
      </motion.button>

      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-[2rem] p-7 relative text-slate-100 shadow-2xl"
            >
              <button 
                onClick={() => setShowGuide(false)}
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#d4af37]/20">
                  <Download className="text-[#d4af37]" size={30} />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Instalar GSI PRO</h3>
                  <p className="text-white/60 text-xs font-medium leading-relaxed">
                    {isIOS 
                      ? 'Adicione o app direto na tela de início do seu iPhone:'
                      : 'Siga os passos abaixo no Google Chrome do seu celular:'}
                  </p>
                </div>

                <div className="space-y-3 text-left">
                  {isIOS ? (
                    <>
                      <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0 text-xs">1</div>
                        <p className="text-white/80 text-xs font-medium pt-1 flex items-center gap-1.5">
                          Toque em <Share size={14} className="text-blue-400" /> (Compartilhar) no Safari.
                        </p>
                      </div>
                      <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0 text-xs">2</div>
                        <p className="text-white/80 text-xs font-medium pt-1">
                          Role para baixo e toque em <strong>'Adicionar à Tela de Início'</strong>.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0 text-xs">1</div>
                        <p className="text-white/80 text-xs font-medium pt-1 flex items-center gap-1">
                          Toque no menu <MoreVertical size={14} className="text-amber-400 inline" /> (3 pontinhos no topo).
                        </p>
                      </div>
                      <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0 text-xs">2</div>
                        <p className="text-white/80 text-xs font-medium pt-1">
                          Toque em <strong>'Instalar aplicativo'</strong> ou <strong>'Adicionar à tela inicial'</strong>.
                        </p>
                      </div>
                      <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] font-black shrink-0 text-xs">3</div>
                        <p className="text-white/80 text-xs font-medium pt-1">
                          Confirme em <strong>'Instalar'</strong>. O app abrirá em tela cheia com ícone próprio!
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (isInstallable) {
                        install();
                      }
                      setShowGuide(false);
                    }}
                    className="w-full bg-[#d4af37] hover:bg-[#b8962d] text-black py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md"
                  >
                    {isInstallable ? 'Instalar Agora' : 'Entendido'}
                  </button>
                  <button
                    onClick={() => setShowGuide(false)}
                    className="w-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white py-2.5 rounded-2xl font-semibold text-xs transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
