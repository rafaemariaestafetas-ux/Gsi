import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { SocialPost, SocialComment } from '../types';
import { 
  Film, 
  Heart, 
  MessageCircle, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Send, 
  X, 
  Sparkles, 
  Play, 
  Pause,
  Share2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReelsViewProps {
  currentUserId: string;
  userName: string;
  userAvatar?: string;
  isAdmin?: boolean;
}

export default function ReelsView({ 
  currentUserId, 
  userName, 
  userAvatar, 
  isAdmin = false 
}: ReelsViewProps) {
  const [reelPosts, setReelPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Unmuted by default for Reels
  const [isPlayingMap, setIsPlayingMap] = useState<Record<string, boolean>>({});

  // Comments drawer state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  const reelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchReels();

    // Realtime channel
    const channel = supabase.channel('reels_feed_realtime');
    channel
      .on('broadcast', { event: 'new_post' }, (resp) => {
        if (resp?.payload) {
          const post = resp.payload as SocialPost;
          if (isVideoPost(post)) {
            setReelPosts(prev => [post, ...prev]);
          }
        }
      })
      .on('broadcast', { event: 'update_post' }, (resp) => {
        if (resp?.payload) {
          const updated = resp.payload as SocialPost;
          setReelPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
        }
      })
      .on('broadcast', { event: 'delete_post' }, (resp) => {
        if (resp?.payload?.postId) {
          const pid = resp.payload.postId;
          setReelPosts(prev => prev.filter(p => p.id !== pid));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isVideoPost = (post: SocialPost) => {
    if (post.media_type === 'video' && post.media_url) return true;
    if (post.media_url && (
      post.media_url.includes('youtube.com') || 
      post.media_url.includes('youtu.be') || 
      post.media_url.includes('youtube-nocookie.com') ||
      post.media_url.endsWith('.mp4') || 
      post.media_url.endsWith('.mov') ||
      post.media_url.includes('video')
    )) {
      return true;
    }
    return false;
  };

  const fetchReels = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const videoOnly = data.filter(isVideoPost);
        setReelPosts(videoOnly);
        if (videoOnly.length > 0) {
          setActiveReelId(videoOnly[0].id);
        }
      } else {
        // Fallback to localStorage
        try {
          const local = localStorage.getItem('gsi_social_feed_posts');
          if (local) {
            const parsed = JSON.parse(local) as SocialPost[];
            const videoOnly = parsed.filter(isVideoPost);
            setReelPosts(videoOnly);
            if (videoOnly.length > 0) setActiveReelId(videoOnly[0].id);
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[ReelsView] Error fetching reels:', err);
    } finally {
      setLoading(false);
    }
  };

  // IntersectionObserver for Snap-Scrolling Autoplay
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (reelId) {
            setActiveReelId(reelId);
            setIsPlayingMap(prev => ({ ...prev, [reelId]: true }));
          }
        }
      });
    }, {
      threshold: 0.65 // Requires 65% visibility to activate reel
    });

    (Object.values(reelRefs.current) as (HTMLDivElement | null)[]).forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, [reelPosts]);

  // Strict Audio/Video isolation across reels
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Pause HTML5 videos not active
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(v => {
      const parentReel = v.closest('[data-reel-id]');
      const reelId = parentReel?.getAttribute('data-reel-id');
      if (reelId !== activeReelId) {
        v.pause();
      }
    });

    // Pause all audio
    document.querySelectorAll('audio').forEach(a => a.pause());

    // Pause non-active YouTube iframes via postMessage
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const parentReel = iframe.closest('[data-reel-id]');
      const reelId = parentReel?.getAttribute('data-reel-id');
      if (reelId !== activeReelId) {
        try {
          iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        } catch (e) {}
      }
    });
  }, [activeReelId]);

  const savePostsToLocalStorage = (updatedPosts: SocialPost[]) => {
    try {
      const local = localStorage.getItem('gsi_social_feed_posts');
      let allPosts: SocialPost[] = local ? JSON.parse(local) : [];
      updatedPosts.forEach(up => {
        const idx = allPosts.findIndex(p => p.id === up.id);
        if (idx !== -1) allPosts[idx] = up;
        else allPosts.unshift(up);
      });
      localStorage.setItem('gsi_social_feed_posts', JSON.stringify(allPosts));
    } catch {}
  };

  const handleToggleLike = async (post: SocialPost) => {
    const hasLiked = (post.likes || []).includes(currentUserId);
    const updatedLikes = hasLiked
      ? (post.likes || []).filter(id => id !== currentUserId)
      : [...(post.likes || []), currentUserId];

    const updatedPost = { ...post, likes: updatedLikes };
    
    setReelPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    savePostsToLocalStorage([updatedPost]);

    // Broadcast
    const channel = supabase.channel('reels_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'update_post',
      payload: updatedPost
    });

    try {
      await supabase.from('social_posts').update({ likes: updatedLikes }).eq('id', post.id);
    } catch (err) {}
  };

  const handleAddComment = async (postId: string) => {
    if (!commentInput.trim()) return;

    const targetPost = reelPosts.find(p => p.id === postId);
    if (!targetPost) return;

    const newComment: SocialComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      post_id: postId,
      user_id: currentUserId,
      author_name: userName,
      author_avatar: userAvatar,
      content: commentInput.trim(),
      created_at: new Date().toISOString()
    };

    const updatedComments = [...(targetPost.comments || []), newComment];
    const updatedPost = { ...targetPost, comments: updatedComments };

    setReelPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
    savePostsToLocalStorage([updatedPost]);
    setCommentInput('');

    // Broadcast
    const channel = supabase.channel('reels_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'update_post',
      payload: updatedPost
    });

    try {
      await supabase.from('social_posts').update({ comments: updatedComments }).eq('id', postId);
    } catch (err) {}
  };

  const handleDeleteReel = async (postId: string) => {
    if (!confirm('Excluir este vídeo dos Reels?')) return;

    setReelPosts(prev => prev.filter(p => p.id !== postId));

    // Broadcast
    const channel = supabase.channel('reels_feed_realtime');
    channel.send({
      type: 'broadcast',
      event: 'delete_post',
      payload: { postId }
    });

    try {
      await supabase.from('social_posts').delete().eq('id', postId);
    } catch (err) {}
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

  const isYouTubeUrl = (url?: string) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com');
  };

  const formatPostDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return 'recente';
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] bg-black overflow-hidden flex flex-col justify-between select-none">
      {/* Top Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#d4af37] text-black flex items-center justify-center font-black shadow-lg shadow-[#d4af37]/30">
            <Film size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wider uppercase">GSI Reels</h2>
            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Vídeos da Obra</p>
          </div>
        </div>

        {/* Global Mute/Unmute Toggle */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black backdrop-blur-md transition-all ${
            !isMuted 
              ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' 
              : 'bg-black/60 border-white/20 text-white/60'
          }`}
        >
          {!isMuted ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
          <span>{!isMuted ? 'Som ON' : 'Mudo'}</span>
        </button>
      </div>

      {/* Reels Snap-Scroll Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full space-y-3 text-white">
          <Film size={36} className="text-[#d4af37] animate-bounce" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Carregando Reels...</p>
        </div>
      ) : reelPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#d4af37]">
            <Film size={32} />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Nenhum Reel publicado</h3>
          <p className="text-xs text-white/50 max-w-xs leading-relaxed">
            Poste um vídeo ou link do YouTube no Feed da Home para ele aparecer aqui em tela cheia!
          </p>
        </div>
      ) : (
        <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none">
          {reelPosts.map((post) => {
            const isActive = activeReelId === post.id;
            const hasLiked = (post.likes || []).includes(currentUserId);
            const likesCount = (post.likes || []).length;
            const commentsCount = (post.comments || []).length;
            const isOwner = post.user_id === currentUserId || isAdmin;

            return (
              <div
                key={post.id}
                data-reel-id={post.id}
                ref={el => { reelRefs.current[post.id] = el; }}
                className="w-full h-[calc(100vh-80px)] snap-start relative flex items-center justify-center bg-black overflow-hidden"
              >
                {/* Media Container */}
                <div className="w-full h-full relative flex items-center justify-center">
                  {isYouTubeUrl(post.media_url) ? (
                    <iframe 
                      src={formatYouTubeEmbedUrl(post.media_url!, isActive)} 
                      className="w-full h-full object-cover border-0 pointer-events-auto scale-[1.02]" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                    />
                  ) : (
                    <video 
                      ref={el => {
                        if (el) {
                          if (isActive) {
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
                        setActiveReelId(post.id);
                        const current = e.currentTarget;
                        document.querySelectorAll('video').forEach(v => {
                          if (v !== current) v.pause();
                        });
                        document.querySelectorAll('audio').forEach(a => a.pause());
                      }}
                      src={post.media_url} 
                      controls={false}
                      loop
                      playsInline
                      preload="auto"
                      className="w-full h-full object-cover" 
                    />
                  )}
                </div>

                {/* Left Bottom Overlay - Author & Caption */}
                <div className="absolute bottom-6 left-4 right-20 z-20 space-y-2.5 text-left pointer-events-auto">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full border-2 border-[#d4af37] overflow-hidden bg-black/60 shadow-lg flex-shrink-0">
                      {post.author_avatar ? (
                        <img src={post.author_avatar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">
                          {post.author_name ? post.author_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white shadow-black drop-shadow-md">{post.author_name}</span>
                        {post.author_role && (
                          <span className="bg-[#d4af37] text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                            {post.author_role}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/60 font-bold drop-shadow-md">{formatPostDate(post.created_at)}</p>
                    </div>
                  </div>

                  {/* Caption Text */}
                  {post.content && (
                    <p className="text-xs text-white/90 line-clamp-3 leading-relaxed drop-shadow-md bg-black/40 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 max-w-sm">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* Right Floating Vertical Action Bar */}
                <div className="absolute bottom-10 right-4 z-20 flex flex-col items-center gap-5 pointer-events-auto">
                  {/* Like Button */}
                  <button
                    onClick={() => handleToggleLike(post)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                      hasLiked 
                        ? 'bg-red-500/20 border-red-500 text-red-500 scale-110 shadow-lg shadow-red-500/30' 
                        : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
                    }`}>
                      <Heart size={22} className={hasLiked ? 'fill-red-500 text-red-500 animate-bounce' : ''} />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-md">{likesCount}</span>
                  </button>

                  {/* Comments Button */}
                  <button
                    onClick={() => setActiveCommentsPostId(post.id)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all">
                      <MessageCircle size={22} />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-md">{commentsCount}</span>
                  </button>

                  {/* Delete Button */}
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteReel(post.id)}
                      className="w-10 h-10 rounded-full bg-black/60 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all"
                      title="Excluir Reel"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comments Drawer Modal */}
      <AnimatePresence>
        {activeCommentsPostId && (
          <motion.div
            initial={{ opacity: 0, y: 300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 300 }}
            className="absolute inset-x-0 bottom-0 z-50 bg-[#0a0e17]/95 border-t border-white/10 rounded-t-[2.5rem] p-6 max-h-[75vh] flex flex-col justify-between shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} className="text-[#d4af37]" />
                <h3 className="text-base font-black text-white">Comentários</h3>
              </div>
              <button
                onClick={() => setActiveCommentsPostId(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 max-h-[45vh]">
              {(() => {
                const target = reelPosts.find(p => p.id === activeCommentsPostId);
                const comments = target?.comments || [];
                if (comments.length === 0) {
                  return <p className="text-xs text-white/40 text-center py-8 italic">Nenhum comentário ainda. Seja o primeiro a comentar!</p>;
                }
                return comments.map((comm) => (
                  <div key={comm.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                      {comm.author_avatar ? (
                        <img src={comm.author_avatar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-black text-white/40">
                          {comm.author_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">{comm.author_name}</span>
                        <span className="text-[9px] font-bold text-white/30">{formatPostDate(comm.created_at)}</span>
                      </div>
                      <p className="text-xs text-white/80">{comm.content}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Add Comment Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddComment(activeCommentsPostId);
                }}
                placeholder="Comente no Reel..."
                className="flex-1 bg-white/5 text-xs text-white placeholder-white/30 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-[#d4af37]"
              />
              <button
                onClick={() => handleAddComment(activeCommentsPostId)}
                disabled={!commentInput.trim()}
                className="px-4 py-3 bg-[#d4af37] text-black font-black rounded-2xl hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
