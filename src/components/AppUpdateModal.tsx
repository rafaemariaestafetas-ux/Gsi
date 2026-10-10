import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck,
  Package,
  Check,
  Flame,
  Clock
} from 'lucide-react';
import { ReleaseInfo, downloadAndInstallApk, GITHUB_RELEASES_WEB_URL } from '../services/appUpdateService';

interface AppUpdateModalProps {
  release: ReleaseInfo;
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export default function AppUpdateModal({ 
  release, 
  isOpen, 
  onClose,
  isMandatory: propIsMandatory 
}: AppUpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Decide if update is mandatory (either via prop or detected from release body)
  const isMandatory = propIsMandatory ?? release.isMandatory ?? false;

  const apk = release.apkAsset;
  const apkDownloadUrl = apk?.browser_download_url || release.html_url || GITHUB_RELEASES_WEB_URL;
  const fileName = apk?.name || `GSI_PRO_${release.latestVersion || 'update'}.apk`;

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleStartUpdate = async () => {
    setErrorMsg(null);
    setDownloading(true);
    setProgressPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(apk?.size || 0);

    const result = await downloadAndInstallApk(
      apkDownloadUrl,
      fileName,
      (percent, loaded, total) => {
        setProgressPercent(percent);
        setDownloadedBytes(loaded);
        if (total > 0) setTotalBytes(total);
      }
    );

    setDownloading(false);
    if (result.success) {
      setDownloadCompleted(true);
    } else {
      setErrorMsg(result.error || 'Não foi possível concluir o download ou abrir o instalador.');
    }
  };

  // Helper to render changelog content with clean modern gold-accented bullet points
  const renderChangelog = (bodyText: string) => {
    if (!bodyText || !bodyText.trim()) {
      return (
        <div className="flex items-start gap-2.5 text-white/70 text-xs py-1">
          <Sparkles className="w-4 h-4 text-[#d4af37] flex-shrink-0 mt-0.5" />
          <span>Esta atualização inclui melhorias de desempenho, estabilidade e otimizações gerais do sistema GSI PRO.</span>
        </div>
      );
    }

    const lines = bodyText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          // If line starts with header prefix like '### ' or '## '
          if (line.startsWith('#')) {
            const cleanTitle = line.replace(/^#+\s*/, '');
            return (
              <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-[#d4af37] pt-1">
                {cleanTitle}
              </h4>
            );
          }

          // If line starts with bullet marker like '-', '*', '•'
          const isBullet = /^[-*•]\s+/.test(line);
          const cleanText = isBullet ? line.replace(/^[-*•]\s+/, '') : line;

          return (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-white/80 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] flex-shrink-0 mt-1.5 shadow-[0_0_6px_#d4af37]" />
              <span className="flex-1">{cleanText}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 18 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg bg-[#0a0e17] border border-[#d4af37]/30 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] text-white overflow-hidden"
        >
          {/* Ambient Gold & Obsidian Glows */}
          <div className="absolute -top-28 -right-28 w-60 h-60 bg-[#d4af37]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-28 w-60 h-60 bg-[#b8962d]/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Subtle top golden light line */}
          <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />

          {/* Close button (only visible if update is NOT mandatory and not downloading) */}
          {!isMandatory && !downloading && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-pointer"
              title="Mais tarde"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Header with animated icon and badges */}
          <div className="flex items-start gap-4 mb-5">
            {/* Animated Golden Badge */}
            <div className="relative flex-shrink-0">
              <motion.div 
                className="absolute inset-0 rounded-2xl bg-[#d4af37]/30 blur-md"
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a1f2c] via-[#0d121c] to-[#080b11] border border-[#d4af37]/40 flex items-center justify-center shadow-lg shadow-black/80">
                <Sparkles className="w-7 h-7 text-[#d4af37]" />
              </div>
            </div>

            <div className="flex-1 pr-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#d4af37]/15 text-[#e6c65b] border border-[#d4af37]/30 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-ping" />
                {isMandatory ? 'Atualização Obrigatória' : 'Nova Atualização'}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                Nova versão disponível
              </h2>
              <p className="text-xs text-white/50 mt-0.5 font-medium">
                GSI PRO • Aplicativo Oficial
              </p>
            </div>
          </div>

          {/* Version Comparison Card (Versão atual → Nova versão) */}
          <div className="relative mb-5 p-4 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              {/* Versão Atual */}
              <div className="flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block mb-0.5">
                  Versão Atual
                </span>
                <span className="text-sm font-bold font-mono text-white/70">
                  v{release.currentVersion}
                </span>
              </div>

              {/* Arrow Connector */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 flex-shrink-0 text-[#d4af37]">
                <ArrowRight className="w-4 h-4" />
              </div>

              {/* Nova Versão */}
              <div className="flex-1 text-right">
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#d4af37] text-black">
                    Nova
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#d4af37]">
                    Versão
                  </span>
                </div>
                <span className="text-base font-black font-mono text-[#d4af37] tracking-tight">
                  v{release.latestVersion}
                </span>
              </div>
            </div>
          </div>

          {/* Changelog Card */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#d4af37]" />
                Novidades & Melhorias
              </span>
              {apk?.size ? (
                <span className="text-[11px] font-medium text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                  Tamanho: {formatSize(apk.size)}
                </span>
              ) : null}
            </div>

            <div className="max-h-40 overflow-y-auto p-4 rounded-2xl bg-black/50 border border-white/10 text-xs custom-scrollbar">
              {renderChangelog(release.body)}
            </div>
          </div>

          {/* Error Message Box */}
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-200">Falha no download</p>
                <p className="mt-0.5 text-rose-300/90 leading-relaxed">{errorMsg}</p>
                <a
                  href={release.html_url || GITHUB_RELEASES_WEB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold underline text-[#d4af37] hover:text-[#f3e5ab]"
                >
                  Baixar diretamente no GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          )}

          {/* Download Progress Card */}
          {downloading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 rounded-2xl bg-[#d4af37]/5 border border-[#d4af37]/30 shadow-inner"
            >
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-[#e6c65b] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#d4af37]" />
                  A descarregar arquivo APK...
                </span>
                <span className="font-mono text-sm font-black text-white">{progressPercent}%</span>
              </div>

              {/* Golden Progress Bar Track */}
              <div className="w-full h-3 bg-black/80 border border-white/10 rounded-full overflow-hidden p-0.5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#b8962d] via-[#d4af37] to-[#fae69e] shadow-[0_0_12px_#d4af37]"
                  style={{ width: `${progressPercent}%` }}
                  transition={{ ease: "easeOut", duration: 0.2 }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/50 mt-2">
                <span>Não feche o aplicativo durante o download</span>
                {downloadedBytes > 0 && (
                  <span className="font-mono text-white/70">
                    {formatSize(downloadedBytes)} {totalBytes > 0 ? `de ${formatSize(totalBytes)}` : ''}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Download Completed Notification */}
          {downloadCompleted && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-emerald-300">Download concluído com sucesso!</p>
                <p className="text-white/70 mt-0.5 leading-relaxed">
                  A tela de instalação do Android foi aberta. Confirme para instalar a nova versão do GSI PRO.
                </p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!downloading && !downloadCompleted ? (
              <>
                {/* Botão Principal: Atualizar Agora */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleStartUpdate}
                  className="w-full sm:flex-1 py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.15em] bg-gradient-to-r from-[#d4af37] via-[#e5c358] to-[#c29e2e] text-black shadow-lg shadow-[#d4af37]/25 hover:shadow-[#d4af37]/45 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  Atualizar Agora
                </motion.button>

                {/* Botão Secundário: Mais Tarde (Apenas se a atualização não for obrigatória) */}
                {!isMandatory && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer active:scale-95"
                  >
                    Mais tarde
                  </button>
                )}
              </>
            ) : downloadCompleted ? (
              <div className="w-full flex gap-3">
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-2 border border-white/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Abrir Instalador Novamente
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-[#d4af37] text-black hover:bg-[#b8962d] transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="w-full text-center text-xs text-white/50 py-2 font-medium">
                Por favor, aguarde o download finalizar...
              </div>
            )}
          </div>

          {/* Footer note: Reassurance & GitHub Link */}
          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
            <span className="flex items-center gap-1.5 text-white/50">
              <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
              Assinatura oficial GSI PRO
            </span>
            <a
              href={release.html_url || GITHUB_RELEASES_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#d4af37] hover:text-[#f3e5ab] flex items-center gap-1 font-semibold transition-colors"
            >
              Ver no GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
