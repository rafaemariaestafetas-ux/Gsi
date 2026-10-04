import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Announcement } from '../types';
import { 
  Megaphone, 
  Send, 
  Trash2, 
  Loader2, 
  Plus, 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Upload, 
  X, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  ExternalLink,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { triggerBackgroundNotification } from '../services/firebaseMessaging';

interface AnnouncementBoardProps {
  isAdmin: boolean;
  userId: string;
  userName: string;
}

export interface ParsedAnnouncement {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'none';
  badge: string;
  created_at: string;
  user_id: string;
  author_name: string;
}

const BADGE_PRESETS = [
  { label: '⚡ URGENTE', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { label: '🛡️ SEGURANÇA', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  { label: '🏗️ OBRA', color: 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40' },
  { label: '📢 COMUNICADO', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { label: '🏆 DESTAQUE', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { label: '📅 REUNIÃO', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
];

export function parseAnnouncementItem(raw: Announcement): ParsedAnnouncement {
  let title = raw.title || 'Comunicado Oficial';
  let subtitle = raw.subtitle || '';
  let content = raw.content || '';
  let media_url = raw.media_url || '';
  let media_type: 'image' | 'video' | 'none' = (raw.media_type as any) || (raw.media_url ? 'image' : 'none');
  let badge = raw.badge || '📢 COMUNICADO';

  // Check if content was encoded as JSON
  if (raw.content && typeof raw.content === 'string' && raw.content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw.content);
      if (parsed.title) title = parsed.title;
      if (parsed.subtitle) subtitle = parsed.subtitle;
      if (parsed.text || parsed.content) content = parsed.text || parsed.content;
      if (parsed.media_url) media_url = parsed.media_url;
      if (parsed.media_type) media_type = parsed.media_type;
      if (parsed.badge) badge = parsed.badge;
    } catch {
      // Fallback to raw text
    }
  }

  // Detect media type if not set
  if (media_url && media_type === 'none') {
    if (media_url.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i) || media_url.includes('video')) {
      media_type = 'video';
    } else {
      media_type = 'image';
    }
  }

  return {
    id: raw.id || `ann_${raw.created_at}`,
    title,
    subtitle,
    content,
    media_url: media_url || undefined,
    media_type,
    badge,
    created_at: raw.created_at,
    user_id: raw.user_id,
    author_name: raw.author_name || 'Diretoria GSI'
  };
}

const DEFAULT_SLIDE: ParsedAnnouncement = {
  id: 'default_announcement',
  title: 'Bem-vindo ao Painel de Comunicados GSI PRO',
  subtitle: 'Avisos Oficiais e Diretrizes das Obras',
  content: 'Fique atento a este espaço para acompanhar atualizações importantes sobre frentes de obra, normas de segurança, escalas e novidades da empresa.',
  badge: '🏗️ GSI PRO OFICIAL',
  media_type: 'none',
  created_at: new Date().toISOString(),
  user_id: 'system',
  author_name: 'Diretoria GSI'
};

export default function AnnouncementBoard({ isAdmin, userId, userName }: AnnouncementBoardProps) {
  const [announcements, setAnnouncements] = useState<ParsedAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Video playback states
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lightbox Modal
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; title: string } | null>(null);

  // Editor Modal States
  const [showEditor, setShowEditor] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newBadge, setNewBadge] = useState('📢 COMUNICADO');
  const [newMediaType, setNewMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const SLIDE_DURATION = 8000; // 8 seconds per slide

  useEffect(() => {
    fetchAnnouncements();

    // Supabase Real-time listener for new announcements
    const channel = supabase
      .channel('announcements-carousel')
      .on('postgres_changes' as any, { event: '*', table: 'announcements', schema: 'public' }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        const parsedList = data.map(parseAnnouncementItem);
        setAnnouncements(parsedList);
      } else {
        setAnnouncements([]);
      }
    } catch (err) {
      console.warn('Erro ao buscar comunicados:', err);
    } finally {
      setLoading(false);
    }
  };

  const slides = announcements.length > 0 ? announcements : [DEFAULT_SLIDE];

  // Auto-advance Carousel Timer with smooth progress
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const interval = 100;
    const step = (interval / SLIDE_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          paginate(1);
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [slides.length, isPaused, currentIndex]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setProgress(0);
    setCurrentIndex((prev) => {
      let next = prev + newDirection;
      if (next >= slides.length) next = 0;
      if (next < 0) next = slides.length - 1;
      return next;
    });
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setProgress(0);
    setCurrentIndex(index);
  };

  const currentSlide = slides[currentIndex] || DEFAULT_SLIDE;

  // File selection for upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isVideo = file.type.startsWith('video/');
    setNewMediaType(isVideo ? 'video' : 'image');

    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setMediaPreview(null);
    setNewMediaType('none');
    setNewMediaUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePostAnnouncement = async () => {
    if (!newTitle.trim() && !newContent.trim()) {
      alert('Por favor, informe ao menos um título ou mensagem.');
      return;
    }

    setIsPosting(true);
    let uploadedMediaUrl = newMediaUrl.trim();

    try {
      // Upload media file if chosen
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || 'dat';
        const fileName = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `announcements/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, { cacheControl: '3600', upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          uploadedMediaUrl = publicUrl;
        } else {
          // If storage bucket isn't ready, use data URL if image is reasonable
          if (mediaPreview && selectedFile.size < 4 * 1024 * 1024) {
            uploadedMediaUrl = mediaPreview;
          }
        }
      }

      // Encode rich structured announcement
      const payload = {
        title: newTitle.trim() || 'Aviso Oficial GSI',
        subtitle: newSubtitle.trim() || undefined,
        text: newContent.trim(),
        media_url: uploadedMediaUrl || undefined,
        media_type: newMediaType !== 'none' ? newMediaType : (uploadedMediaUrl ? 'image' : 'none'),
        badge: newBadge || '📢 COMUNICADO'
      };

      const encodedContent = JSON.stringify(payload);

      const { error: insertError } = await supabase.from('announcements').insert([{
        content: encodedContent,
        user_id: userId,
        author_name: userName || 'Diretoria GSI'
      }]);

      if (insertError) {
        console.error('Erro ao inserir anúncio:', insertError);
        alert('Erro ao publicar aviso. Verifique sua conexão.');
      } else {
        // Send push notification to team
        triggerBackgroundNotification({
          senderId: userId,
          senderName: userName,
          recipientId: 'all',
          title: `📢 ${payload.title}`,
          body: payload.subtitle || payload.text.substring(0, 100),
          type: 'announcement',
          data: { url: '/' }
        });

        // Reset form
        setNewTitle('');
        setNewSubtitle('');
        setNewContent('');
        setNewMediaUrl('');
        removeSelectedFile();
        setShowEditor(false);
        fetchAnnouncements();
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Falha geral ao publicar anúncio:', err);
      alert('Falha ao processar a publicação.');
    } finally {
      setIsPosting(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Deseja realmente excluir este comunicado do carrossel?')) return;
    try {
      await supabase.from('announcements').delete().eq('id', id);
      fetchAnnouncements();
      setCurrentIndex(0);
    } catch (err) {
      alert('Erro ao excluir anúncio.');
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.96
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.96,
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
    })
  };

  return (
    <div className="space-y-3 relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shadow-sm">
            <Megaphone size={14} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white/70">
              Quadro de Avisos
            </h3>
            <span className="text-[9px] font-bold text-[#d4af37] uppercase tracking-widest">
              Destaques & Comunicados
            </span>
          </div>

          {!notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && (
            <button 
              onClick={requestNotificationPermission}
              className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-amber-500 hover:text-black transition-all border border-amber-500/20"
            >
              <Bell size={11} /> Alertas
            </button>
          )}
        </div>

        {isAdmin && (
          <button 
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37] hover:bg-[#e5c04b] text-black rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md shadow-[#d4af37]/20"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>Novo Aviso</span>
          </button>
        )}
      </div>

      {/* Main Luxury Carousel Card */}
      <div 
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="relative bg-gradient-to-br from-[#1c2431]/95 via-[#141b26]/90 to-[#0e1420]/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl group select-none min-h-[220px]"
      >
        {/* Glowing Top Progress Bar */}
        {slides.length > 1 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-30">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#d4af37] to-[#ffd700] shadow-[0_0_10px_#d4af37]"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
        )}

        {/* Carousel Slide Area with Drag Gesture */}
        <div className="relative overflow-hidden min-h-[220px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentSlide.id || currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 50) paginate(-1);
                else if (info.offset.x < -50) paginate(1);
              }}
              className="w-full p-5 sm:p-6 flex flex-col justify-between"
            >
              {/* Top Row: Badge, Date & Admin Action */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]/30 shadow-sm">
                    {currentSlide.badge}
                  </span>
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    {format(new Date(currentSlide.created_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Slide Counter */}
                  {slides.length > 1 && (
                    <span className="text-[10px] font-black text-white/40 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                      {currentIndex + 1} / {slides.length}
                    </span>
                  )}

                  {isAdmin && currentSlide.id !== 'default_announcement' && (
                    <button 
                      onClick={() => deleteAnnouncement(currentSlide.id)}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1"
                      title="Excluir este aviso"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Middle Section: Layout with optional Media */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Text Content */}
                <div className={`${currentSlide.media_url ? 'md:col-span-7' : 'md:col-span-12'} space-y-2`}>
                  <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                    {currentSlide.title}
                  </h4>

                  {currentSlide.subtitle && (
                    <p className="text-xs font-bold text-[#d4af37] leading-relaxed">
                      {currentSlide.subtitle}
                    </p>
                  )}

                  <p className="text-xs font-normal text-white/80 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {currentSlide.content}
                  </p>
                </div>

                {/* Media Attachment (Photo or Video) */}
                {currentSlide.media_url && (
                  <div className="md:col-span-5 relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner group/media">
                    {currentSlide.media_type === 'video' ? (
                      <div className="relative aspect-video w-full flex items-center justify-center bg-black">
                        <video 
                          ref={videoRef}
                          src={currentSlide.media_url} 
                          className="w-full h-full object-cover"
                          loop
                          muted={isVideoMuted}
                          autoPlay
                          playsInline
                        />
                        {/* Video Controls Overlay */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current) {
                                if (videoRef.current.paused) {
                                  videoRef.current.play();
                                  setIsVideoPlaying(true);
                                } else {
                                  videoRef.current.pause();
                                  setIsVideoPlaying(false);
                                }
                              }
                            }}
                            className="w-9 h-9 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-transform"
                          >
                            {isVideoPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsVideoMuted(prev => !prev);
                            }}
                            className="w-9 h-9 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-transform"
                          >
                            {isVideoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLightboxMedia({ url: currentSlide.media_url!, type: 'video', title: currentSlide.title })}
                            className="w-9 h-9 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-transform"
                            title="Expandir vídeo"
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setLightboxMedia({ url: currentSlide.media_url!, type: 'image', title: currentSlide.title })}
                        className="relative aspect-video w-full cursor-pointer overflow-hidden group/img"
                      >
                        <img 
                          src={currentSlide.media_url} 
                          alt={currentSlide.title} 
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-end p-2.5">
                          <span className="p-1.5 rounded-lg bg-black/60 text-white/90 backdrop-blur-md">
                            <Maximize2 size={12} />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Footer: Author signature */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
                  Publicado por <strong className="text-white/70">{currentSlide.author_name}</strong>
                </span>

                <span className="text-[9px] uppercase tracking-widest font-black text-[#d4af37]/80">
                  GSI PRO Obras
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Chevrons */}
        {slides.length > 1 && (
          <>
            <button 
              onClick={() => paginate(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-[#d4af37] text-white/70 hover:text-black border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 shadow-lg active:scale-95"
              title="Aviso anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => paginate(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-[#d4af37] text-white/70 hover:text-black border border-white/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 shadow-lg active:scale-95"
              title="Próximo aviso"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Bottom Pagination Dots / Pills */}
        {slides.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-md">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`transition-all rounded-full ${
                  currentIndex === idx 
                    ? 'w-5 h-1.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37]' 
                    : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
                }`}
                title={`Ir para aviso ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admin Creator Modal */}
      <AnimatePresence>
        {showEditor && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#1c2431] border border-[#d4af37]/30 rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden text-white"
            >
              {/* Modal Header (Fixed) */}
              <div className="flex items-center justify-between border-b border-white/10 p-5 flex-shrink-0 bg-[#141b26]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Criar Comunicado no Carrossel
                    </h3>
                    <p className="text-[10px] text-white/50">
                      Adicione avisos com título, subtítulo, fotos ou vídeos para a equipa
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditor(false)} 
                  className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body (Scrollable with touch momentum) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                {/* Category / Badge Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">
                    Categoria / Selo
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_PRESETS.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setNewBadge(b.label)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black border transition-all ${
                          newBadge === b.label 
                            ? `${b.color} scale-105 shadow-md` 
                            : 'bg-[#0a0e17] border-white/5 text-white/40 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Título & Subtítulo */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1">
                      Título Principal *
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ex: Treinamento Obrigatório de Segurança e EPIs"
                      className="w-full bg-[#0a0e17] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1">
                      Subtítulo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={newSubtitle}
                      onChange={(e) => setNewSubtitle(e.target.value)}
                      placeholder="Ex: Todas as quintas-feiras no Canteiro Central"
                      className="w-full bg-[#0a0e17] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#d4af37] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1">
                      Conteúdo / Instruções *
                    </label>
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Descreva as instruções detalhadas, regras, horários ou avisos gerais para todos os colaboradores..."
                      rows={3}
                      className="w-full bg-[#0a0e17] border border-white/10 rounded-xl p-3.5 text-xs text-white outline-none focus:border-[#d4af37] transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Anexo de Mídia (Foto ou Vídeo) */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] flex items-center justify-between">
                    <span>Anexar Foto ou Vídeo</span>
                    {mediaPreview && (
                      <button 
                        type="button" 
                        onClick={removeSelectedFile}
                        className="text-red-400 hover:underline text-[9px] lowercase font-normal"
                      >
                        remover mídia
                      </button>
                    )}
                  </label>

                  {/* Preview Box */}
                  {mediaPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#d4af37]/40 bg-black">
                      {newMediaType === 'video' ? (
                        <video src={mediaPreview} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Upload File Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3.5 rounded-2xl border border-dashed border-white/15 hover:border-[#d4af37] bg-[#0a0e17] flex flex-col items-center justify-center gap-1.5 text-white/60 hover:text-white transition-all text-center"
                      >
                        <Upload size={18} className="text-[#d4af37]" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Subir Arquivo</span>
                        <span className="text-[8px] text-white/30">Foto ou Vídeo</span>
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*,video/*" 
                        onChange={handleFileSelect} 
                      />

                      {/* URL Link Option */}
                      <div className="p-3 rounded-2xl border border-white/10 bg-[#0a0e17] flex flex-col justify-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-white/40">Ou cole link direto:</span>
                        <input 
                          type="url"
                          value={newMediaUrl}
                          onChange={(e) => {
                            setNewMediaUrl(e.target.value);
                            if (e.target.value) {
                              setMediaPreview(e.target.value);
                              setNewMediaType(e.target.value.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? 'video' : 'image');
                            }
                          }}
                          placeholder="https://exemplo.com/foto.jpg"
                          className="w-full bg-[#1c2431] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons (Fixed Footer - Always Visible) */}
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-white/10 bg-[#141b26] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePostAnnouncement}
                  disabled={isPosting || (!newTitle.trim() && !newContent.trim())}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:from-[#e5c04b] hover:to-[#ffd700] text-black font-black uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-[#d4af37]/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isPosting ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                  <span>{isPosting ? 'A Publicar...' : 'Publicar Comunicado'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox / Expanded Media Modal */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            onClick={() => setLightboxMedia(null)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setLightboxMedia(null)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              {lightboxMedia.type === 'video' ? (
                <video src={lightboxMedia.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-2xl border border-white/10 shadow-2xl" />
              ) : (
                <img src={lightboxMedia.url} alt={lightboxMedia.title} className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-white/10 shadow-2xl" />
              )}
              <p className="text-sm font-bold text-white mt-3 text-center">{lightboxMedia.title}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
