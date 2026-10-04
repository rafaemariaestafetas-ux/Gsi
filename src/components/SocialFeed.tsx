import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { SocialPost, SocialComment, Profile } from '../types';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  Video, 
  Send, 
  Trash2, 
  MoreVertical, 
  Loader2, 
  Plus, 
  X, 
  Sparkles,
  Play,
  Film,
  Camera,
  Link as LinkIcon,
  Smile,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SocialFeedProps {
  currentUserId: string;
  userName: string;
  userRole?: string;
  userAvatar?: string;
  isAdmin?: boolean;
}

export default function SocialFeed({ 
  currentUserId, 
  userName, 
  userRole = 'Oficial', 
  userAvatar,
  isAdmin = false 
}: SocialFeedProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [content, setContent] = useState('');
  
  // Media attachments state
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');

  // Comment & Reaction states
  const [expandedPostComments, setExpandedPostComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null);

  // Autoplay on Scroll states (Instagram / Reels style)
  const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Unmuted by default!
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Smarter center detection to ensure ONLY the video in the middle of the screen plays
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const findCenteredPost = () => {
      const windowCenter = window.innerHeight / 2;
      let closestPostId: string | null = null;
      let minDistance = Infinity;

      Object.entries(postRefs.current as Record<string, HTMLDivElement | null>).forEach(([postId, el]) => {
        if (!el) return;
        const rect = (el as HTMLDivElement).getBoundingClientRect();
        
        // Element must be inside the center band of the screen
        if (rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25) {
          const elCenter = rect.top + rect.height / 2;
          const distance = Math.abs(elCenter - windowCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestPostId = postId;
          }
        }
      });

      if (closestPostId && closestPostId !== activeVideoPostId) {
        setActiveVideoPostId(closestPostId);
      }
    };

    // IntersectionObserver with middle-band rootMargin
    const observer = new IntersectionObserver(() => {
      findCenteredPost();
    }, {
      rootMargin: '-15% 0px -15% 0px',
      threshold: [0, 0.25, 0.5, 0.75]
    });

    (Object.values(postRefs.current) as (HTMLDivElement | null)[]).forEach(ref => {
      if (ref) observer.observe(ref);
    });

    // Also run on scroll with requestAnimationFrame for silky smooth accuracy
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          findCenteredPost();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [posts, activeVideoPostId]);

  // Strict Audio Overlap Prevention: Pause all other media whenever active video changes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 1. Pause HTML5 videos that do not belong to activeVideoPostId
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(v => {
      const parentPost = v.closest('[data-post-id]');
      const postId = parentPost?.getAttribute('data-post-id');
      if (postId !== activeVideoPostId) {
        v.pause();
      }
    });

    // 2. Pause all voice messages/audio players
    const allAudios = document.querySelectorAll('audio');
    allAudios.forEach(a => a.pause());

    // 3. Pause non-active YouTube iframes via postMessage
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const parentPost = iframe.closest('[data-post-id]');
      const postId = parentPost?.getAttribute('data-post-id');
      if (postId !== activeVideoPostId) {
        try {
          iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        } catch (e) {}
      }
    });
  }, [activeVideoPostId]);

  useEffect(() => {
    fetchPosts();

    // Realtime channel for instant feed updates
    const channel = supabase.channel('social_feed_realtime');
    
    channel
      .on('broadcast', { event: 'new_post' }, (resp) => {
        if (resp?.payload) {
          const newPost = resp.payload as SocialPost;
          setPosts(prev => {
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        }
      })
      .on('broadcast', { event: 'update_post' }, (resp) => {
        if (resp?.payload) {
          const updatedPost = resp.payload as SocialPost;
          setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
        }
      })
      .on('broadcast', { event: 'delete_post' }, (resp) => {
        if (resp?.payload?.postId) {
          const pid = resp.payload.postId;
          setPosts(prev => prev.filter(p => p.id !== pid));
        }
      })
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'social_posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPosts(data);
      } else {
        // Fallback to localStorage if table doesn't exist yet
        try {
          const local = localStorage.getItem('gsi_social_feed_posts');
          if (local) setPosts(JSON.parse(local));
        } catch {}
      }
    } catch (err) {
      console.warn('[SocialFeed] Fetch posts error, using fallback:', err);
      try {
        const local = localStorage.getItem('gsi_social_feed_posts');
        if (local) setPosts(JSON.parse(local));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const savePostsToLocalStorage = (updatedPosts: SocialPost[]) => {
    try {
      localStorage.setItem('gsi_social_feed_posts', JSON.stringify(updatedPosts));
    } catch {}
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMediaType('image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
        setMediaUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMediaType('video');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
        setMediaUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatYouTubeEmbedUrl = (rawUrl: string, isAutoplay: boolean = false): string => {
    if (!rawUrl) return rawUrl;
    let url = rawUrl.trim();

    let videoId = '';

    if (url.includes('/shorts/')) {
      videoId = url.split('/shorts/')[1]?.split('?')[0]?.split('&')[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1]?.split('&')[0]?.split('?')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
    } else if (url.includes('/embed/')) {
      videoId = url.split('/embed/')[1]?.split('?')[0]?.split('&')[0];
    }

    if (videoId) {
      const muteFlag = isMuted ? 1 : 0;
      const params = isAutoplay 
        ? `?autoplay=1&mute=${muteFlag}&enablejsapi=1&playsinline=1` 
        : `?autoplay=0&enablejsapi=1&playsinline=1`;
      return `https://www.youtube.com/embed/${videoId}${params}`;
    }

    return url;
  };

  const handleAddVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    const formattedUrl = formatYouTubeEmbedUrl(videoUrlInput.trim());

    setMediaType('video');
    setMediaUrl(formattedUrl);
    setMediaPreview(formattedUrl);
    setShowVideoUrlInput(false);
    setVideoUrlInput('');
  };

  const clearMediaSelection = () => {
    setMediaType('none');
    setMediaUrl('');
    setMediaPreview(null);
    setSelectedFile(null);
    setShowVideoUrlInput(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if (!content.trim() && !mediaUrl) return;

    setIsPosting(true);
    let finalMediaType = mediaType;
    let finalMediaUrl = mediaUrl;

    // Auto-detect YouTube links in content if no media explicitly selected
    if (finalMediaType === 'none' && content) {
      const ytMatch = content.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s]+/i);
      if (ytMatch && ytMatch[0]) {
        const embedUrl = formatYouTubeEmbedUrl(ytMatch[0]);
        if (embedUrl) {
          finalMediaType = 'video';
          finalMediaUrl = embedUrl;
        }
      }
    }

    // Upload file if selected
    if (selectedFile) {
      try {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `social-feed/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          finalMediaUrl = publicUrl;
        }
      } catch (err) {
        console.warn('File upload error, using DataURL fallback:', err);
      }
    }

    const newPost: SocialPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: currentUserId,
      author_name: userName,
      author_role: userRole,
      author_avatar: userAvatar,
      content: content.trim(),
      media_type: finalMediaType,
      media_url: finalMediaUrl || undefined,
      created_at: new Date().toISOString(),
      likes: [],
      comments: []
    };

    // Optimistically update React state
    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    savePostsToLocalStorage(updatedPosts);

    // Broadcast over WebSocket
    const channel = supabase.channel('social_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'new_post',
      payload: newPost
    });

    // Save to Supabase DB
    try {
      const { error } = await supabase.from('social_posts').insert([newPost]);
      if (error && error.code === 'PGRST204') {
        // Table fallback handling
        console.warn('Supabase social_posts table missing, saved locally and broadcasted.');
      }
    } catch (err) {
      console.warn('Supabase insert failed:', err);
    }

    // Reset Form
    setContent('');
    clearMediaSelection();
    setIsPosting(false);
  };

  const handleToggleLike = async (post: SocialPost) => {
    const hasLiked = (post.likes || []).includes(currentUserId);
    const updatedLikes = hasLiked
      ? (post.likes || []).filter(id => id !== currentUserId)
      : [...(post.likes || []), currentUserId];

    const updatedPost = { ...post, likes: updatedLikes };
    
    // Optimistic update
    const updatedPosts = posts.map(p => p.id === post.id ? updatedPost : p);
    setPosts(updatedPosts);
    savePostsToLocalStorage(updatedPosts);

    // Broadcast update
    const channel = supabase.channel('social_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'update_post',
      payload: updatedPost
    });

    // DB Sync
    try {
      await supabase.from('social_posts').update({ likes: updatedLikes }).eq('id', post.id);
    } catch (err) {}
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;

    const newComment: SocialComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      post_id: postId,
      user_id: currentUserId,
      author_name: userName,
      author_avatar: userAvatar,
      content: text,
      created_at: new Date().toISOString()
    };

    const updatedComments = [...(targetPost.comments || []), newComment];
    const updatedPost = { ...targetPost, comments: updatedComments };

    // Update state
    const updatedPosts = posts.map(p => p.id === postId ? updatedPost : p);
    setPosts(updatedPosts);
    savePostsToLocalStorage(updatedPosts);

    // Clear input
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    // Broadcast update
    const channel = supabase.channel('social_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'update_post',
      payload: updatedPost
    });

    // DB Sync
    try {
      await supabase.from('social_posts').update({ comments: updatedComments }).eq('id', postId);
    } catch (err) {}
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta publicação?')) return;

    const updatedPosts = posts.filter(p => p.id !== postId);
    setPosts(updatedPosts);
    savePostsToLocalStorage(updatedPosts);

    // Broadcast deletion
    const channel = supabase.channel('social_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'delete_post',
      payload: { postId }
    });

    // DB Sync
    try {
      await supabase.from('social_posts').delete().eq('id', postId);
    } catch (err) {}
  };

  const formatPostDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
    } catch {
      return 'recentemente';
    }
  };

  const isYouTubeUrl = (url?: string) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com');
  };

  const isYouTubeShorts = (url?: string) => {
    if (!url) return false;
    return url.includes('/shorts/');
  };

  return (
    <div className="space-y-6">
      {/* Feed Title Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#d4af37] to-amber-200 flex items-center justify-center text-black font-black shadow-lg shadow-[#d4af37]/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Feed da Equipe</h3>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Mural Social & Atividades da Obra</p>
          </div>
        </div>

        {/* Global Sound Toggle Button (Instagram Style) */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all text-xs font-black ${
            !isMuted 
              ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]/40 shadow-sm shadow-[#d4af37]/10' 
              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
          }`}
          title={!isMuted ? 'Som do Feed Ativado' : 'Som Mudo (Clique para Ativar)'}
        >
          {!isMuted ? <Volume2 size={16} className="animate-pulse text-[#d4af37]" /> : <VolumeX size={16} />}
          <span className="hidden sm:inline">{!isMuted ? 'Som LIGADO' : 'Sem Som'}</span>
        </button>
      </div>

      {/* Post Composer Box */}
      <div className="bg-[#1c2431]/80 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full border-2 border-[#d4af37]/60 overflow-hidden flex-shrink-0 bg-[#0a0e17]">
            {userAvatar ? (
              <img src={userAvatar} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`O que está acontecendo na obra hoje, ${userName}?`}
              className="w-full bg-[#0a0e17]/60 text-white placeholder-white/30 border border-white/10 rounded-2xl p-3.5 text-xs focus:outline-none focus:border-[#d4af37] transition-all resize-none min-h-[85px]"
            />

            {/* Media Attachment Previews */}
            <AnimatePresence>
              {mediaPreview && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0a0e17] max-h-[220px] flex items-center justify-center"
                >
                  {mediaType === 'image' && (
                    <img src={mediaPreview} className="max-h-[220px] w-full object-cover rounded-2xl" />
                  )}
                  {mediaType === 'video' && (
                    isYouTubeUrl(mediaPreview) ? (
                      <iframe 
                        src={formatYouTubeEmbedUrl(mediaPreview)} 
                        className="w-full h-[200px] rounded-2xl border-0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowFullScreen
                      />
                    ) : (
                      <video src={mediaPreview} controls className="max-h-[200px] w-full rounded-2xl bg-black" />
                    )
                  )}
                  <button
                    onClick={clearMediaSelection}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors border border-white/20"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* YouTube / Video URL Input Bar */}
            <AnimatePresence>
              {showVideoUrlInput && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 bg-[#0a0e17] border border-[#d4af37]/40 rounded-2xl p-2"
                >
                  <LinkIcon size={16} className="text-[#d4af37] ml-2 flex-shrink-0" />
                  <input
                    type="text"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    placeholder="Cole o link do vídeo (YouTube, Vimeo, MP4)..."
                    className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
                  />
                  <button
                    onClick={handleAddVideoUrl}
                    className="px-3 py-1.5 bg-[#d4af37] text-black text-xs font-black rounded-xl hover:bg-amber-300 transition-all flex-shrink-0"
                  >
                    Anexar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input 
          ref={imageInputRef} 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleSelectImage} 
        />
        <input 
          ref={videoInputRef} 
          type="file" 
          accept="video/*" 
          className="hidden" 
          onChange={handleSelectVideo} 
        />

        {/* Actions Bar */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-bold transition-all border border-emerald-500/20"
              title="Adicionar Foto"
            >
              <ImageIcon size={16} />
              <span className="hidden sm:inline">Foto</span>
            </button>

            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-400 text-xs font-bold transition-all border border-purple-500/20"
              title="Enviar Vídeo"
            >
              <Video size={16} />
              <span className="hidden sm:inline">Vídeo</span>
            </button>

            <button
              onClick={() => setShowVideoUrlInput(!showVideoUrlInput)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 text-xs font-bold transition-all border border-amber-500/20"
              title="Link de Vídeo"
            >
              <LinkIcon size={16} />
              <span className="hidden sm:inline">Link</span>
            </button>
          </div>

          <button
            onClick={handleCreatePost}
            disabled={isPosting || (!content.trim() && !mediaUrl)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-amber-300 text-black text-xs font-black hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPosting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Publicando...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Publicar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 size={32} className="text-[#d4af37] animate-spin" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Carregando feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-[#1c2431]/40 border border-white/5 rounded-3xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-white/5 mx-auto flex items-center justify-center text-white/30">
            <Sparkles size={28} />
          </div>
          <h4 className="text-base font-black text-white">Nenhuma publicação no feed</h4>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Seja o primeiro a compartilhar fotos, vídeos ou avisos com a equipe!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => {
            const hasLiked = (post.likes || []).includes(currentUserId);
            const isOwner = post.user_id === currentUserId || isAdmin;
            const commentsCount = (post.comments || []).length;
            const likesCount = (post.likes || []).length;
            const isCommentsOpen = !!expandedPostComments[post.id];
            const isActiveVideo = activeVideoPostId === post.id;

            return (
              <motion.div
                key={post.id}
                data-post-id={post.id}
                ref={el => { postRefs.current[post.id] = el; }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1c2431]/80 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-4 relative group"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-[#d4af37]/40 overflow-hidden flex-shrink-0 bg-[#0a0e17]">
                      {post.author_avatar ? (
                        <img src={post.author_avatar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 font-bold">
                          {post.author_name ? post.author_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white">{post.author_name}</h4>
                        {post.author_role && (
                          <span className="bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {post.author_role}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 font-bold">
                        {formatPostDate(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Actions / Delete */}
                  {isOwner && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-all"
                      title="Excluir publicação"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Post Content Text */}
                {post.content && (
                  <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                    {post.content}
                  </p>
                )}

                {/* Media Attachment */}
                {post.media_url && (
                  <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0a0e17]/80 flex items-center justify-center w-full">
                    {post.media_type === 'image' && (
                      <div className="w-full max-h-[480px] rounded-2xl overflow-hidden bg-[#0a0e17] flex items-center justify-center">
                        <img 
                          src={post.media_url} 
                          loading="lazy"
                          onClick={() => setActiveImageZoom(post.media_url!)}
                          className="w-full max-h-[480px] object-cover rounded-2xl cursor-pointer hover:scale-[1.01] transition-transform" 
                        />
                      </div>
                    )}
                    {post.media_type === 'video' && (
                      isYouTubeUrl(post.media_url) ? (
                        isYouTubeShorts(post.media_url) ? (
                          <div className="w-full max-w-[360px] mx-auto h-[480px] sm:h-[540px] rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center p-0.5">
                            <iframe 
                              src={formatYouTubeEmbedUrl(post.media_url!, isActiveVideo)} 
                              className="w-full h-full rounded-2xl border-0" 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="w-full h-[280px] sm:h-[360px] md:h-[420px] rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center aspect-video sm:aspect-auto">
                            <iframe 
                              src={formatYouTubeEmbedUrl(post.media_url!, isActiveVideo)} 
                              className="w-full h-full rounded-2xl border-0" 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                              allowFullScreen
                            />
                          </div>
                        )
                      ) : (
                        <div className="w-full min-h-[300px] max-h-[520px] rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center">
                          <video 
                            ref={el => {
                              if (el) {
                                if (isActiveVideo) {
                                  el.muted = isMuted;
                                  el.play().catch(() => {
                                    el.muted = true;
                                    el.play().catch(() => {});
                                  });
                                } else {
                                  el.pause();
                                }
                              }
                            }}
                            onPlay={(e) => {
                              // Ensure only one video/audio plays at a time
                              setActiveVideoPostId(post.id);
                              const currentVideo = e.currentTarget;
                              document.querySelectorAll('video').forEach(v => {
                                if (v !== currentVideo) v.pause();
                              });
                              document.querySelectorAll('audio').forEach(a => a.pause());
                            }}
                            src={post.media_url} 
                            controls 
                            playsInline
                            preload="metadata"
                            className="w-full max-h-[520px] rounded-2xl bg-black object-contain" 
                          />
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Likes & Comments Count Bar */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-4">
                    {/* Like Button */}
                    <button
                      onClick={() => handleToggleLike(post)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1.5 rounded-xl ${
                        hasLiked 
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-transparent'
                      }`}
                    >
                      <Heart size={16} className={hasLiked ? 'fill-red-500 text-red-500 animate-bounce' : ''} />
                      <span>{likesCount}</span>
                    </button>

                    {/* Comment Toggle Button */}
                    <button
                      onClick={() => setExpandedPostComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1.5 rounded-xl ${
                        isCommentsOpen 
                          ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30' 
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-transparent'
                      }`}
                    >
                      <MessageCircle size={16} />
                      <span>{commentsCount}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Comments Section */}
                <AnimatePresence>
                  {isCommentsOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-white/5 pt-3 space-y-3 overflow-hidden"
                    >
                      {/* Comments List */}
                      {post.comments && post.comments.length > 0 ? (
                        <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                          {post.comments.map((comment) => (
                            <div 
                              key={comment.id}
                              className="bg-[#0a0e17]/60 border border-white/5 rounded-2xl p-2.5 flex items-start gap-2.5"
                            >
                              <div className="w-7 h-7 rounded-full border border-white/10 overflow-hidden flex-shrink-0 bg-white/5">
                                {comment.author_avatar ? (
                                  <img src={comment.author_avatar} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-white/30 font-bold">
                                    {comment.author_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-white">{comment.author_name}</span>
                                  <span className="text-[9px] text-white/30 font-bold">{formatPostDate(comment.created_at)}</span>
                                </div>
                                <p className="text-xs text-white/80 break-words">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 text-center py-2 italic">Sem comentários ainda. Digite abaixo para comentar!</p>
                      )}

                      {/* Add Comment Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(post.id);
                          }}
                          placeholder="Escreva um comentário..."
                          className="flex-1 bg-[#0a0e17]/80 text-white placeholder-white/30 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#d4af37]"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!commentInputs[post.id]?.trim()}
                          className="px-3 py-2 rounded-xl bg-[#d4af37] text-black font-black hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      <AnimatePresence>
        {activeImageZoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveImageZoom(null)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <button
              onClick={() => setActiveImageZoom(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center"
            >
              <X size={20} />
            </button>
            <img 
              src={activeImageZoom} 
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
