import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, AlertCircle, ExternalLink, RefreshCw, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
  recordedDuration?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe, recordedDuration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(recordedDuration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const isWebAudioModeRef = useRef<boolean>(false);

  // Clean up Web Audio resources on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
      }
    };
  }, []);

  // Sync recordedDuration if passed
  useEffect(() => {
    if (recordedDuration && recordedDuration > 0) {
      setDuration(recordedDuration);
    }
  }, [recordedDuration]);

  // Reset states when src changes
  useEffect(() => {
    stopAllPlayback();
    audioBufferRef.current = null;
    isWebAudioModeRef.current = false;
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    setHasError(!src || src.trim() === '');
    setIsLoading(false);
    if (recordedDuration && recordedDuration > 0) {
      setDuration(recordedDuration);
    } else {
      setDuration(0);
    }
  }, [src, recordedDuration]);

  const stopAllPlayback = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    setIsPlaying(false);
  };

  // Web Audio fallback player for Safari / iOS when HTML5 Audio fails
  const playViaWebAudio = async (startFromSec: number = 0) => {
    try {
      setIsLoading(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (!audioBufferRef.current) {
        const response = await fetch(src, { mode: 'cors' });
        const arrayBuffer = await response.arrayBuffer();
        audioBufferRef.current = await new Promise((resolve, reject) => {
          ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });
      }

      const buffer = audioBufferRef.current;
      if (!buffer) throw new Error('Audio buffer decode returned null');

      const totalDur = buffer.duration;
      if (totalDur && isFinite(totalDur) && totalDur > 0) {
        setDuration(totalDur);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const offset = Math.max(0, Math.min(startFromSec, totalDur));
      source.start(0, offset);
      sourceNodeRef.current = source;
      startTimeRef.current = ctx.currentTime - offset;
      isWebAudioModeRef.current = true;

      setIsPlaying(true);
      setIsLoading(false);
      setHasError(false);

      source.onended = () => {
        if (isWebAudioModeRef.current) {
          const elapsed = ctx.currentTime - startTimeRef.current;
          if (elapsed >= totalDur - 0.2) {
            setIsPlaying(false);
            setCurrentTime(0);
            pauseOffsetRef.current = 0;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          }
        }
      };

      const updateWebAudioProgress = () => {
        if (!isWebAudioModeRef.current) return;
        const current = ctx.currentTime - startTimeRef.current;
        if (current <= totalDur) {
          setCurrentTime(current);
          animFrameRef.current = requestAnimationFrame(updateWebAudioProgress);
        } else {
          setCurrentTime(totalDur);
          setIsPlaying(false);
          pauseOffsetRef.current = 0;
        }
      };
      animFrameRef.current = requestAnimationFrame(updateWebAudioProgress);

    } catch (webAudioErr) {
      console.warn('[AudioPlayer] Web Audio API fallback error:', webAudioErr);
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);
    }
  };

  const togglePlay = async () => {
    if (!src) return;

    // If already playing in Web Audio mode, pause it
    if (isPlaying && isWebAudioModeRef.current) {
      if (audioContextRef.current) {
        pauseOffsetRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      }
      stopAllPlayback();
      return;
    }

    // If resuming in Web Audio mode
    if (!isPlaying && isWebAudioModeRef.current && audioBufferRef.current) {
      await playViaWebAudio(pauseOffsetRef.current || currentTime);
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      await playViaWebAudio(currentTime);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Try HTML5 Audio First
    try {
      setIsLoading(true);
      setHasError(false);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.warn('[AudioPlayer] HTML5 audio.play() failed, trying Web Audio API:', err);
      // Seamlessly fallback to Web Audio API
      await playViaWebAudio(currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
    setIsLoading(false);
    setHasError(false);
  };

  const handleTimeUpdate = () => {
    if (isWebAudioModeRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime !== undefined && !isNaN(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
    }
    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
      setDuration(prev => (prev > 0 ? prev : audio.duration));
    } else if (audio.currentTime > duration) {
      setDuration(audio.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
      } catch {}
    }
  };

  const handleError = () => {
    if (isPlaying || isLoading) {
      console.warn('[AudioPlayer] HTML5 audio error triggered, falling back to Web Audio API...');
      playViaWebAudio(currentTime);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const newProgress = clickX / rect.width;
    const targetTime = newProgress * duration;

    setCurrentTime(targetTime);
    pauseOffsetRef.current = targetTime;

    if (isWebAudioModeRef.current) {
      if (isPlaying) {
        stopAllPlayback();
        playViaWebAudio(targetTime);
      }
    } else if (audioRef.current) {
      try {
        audioRef.current.currentTime = targetTime;
      } catch {}
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time) || time <= 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (!src || src.trim() === '') {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-2xl text-[10px] ${isMe ? 'text-black/60 bg-black/10' : 'text-white/60 bg-white/5'}`}>
        <AlertCircle size={14} />
        <span>Áudio indisponível</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 min-w-[210px] p-2.5 rounded-2xl transition-all select-none ${isMe ? 'bg-black/10' : 'bg-white/5'}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline={true}
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        className="hidden"
      />

      <button 
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        aria-label={hasError ? "Tentar novamente" : isPlaying ? "Pausar" : "Tocar áudio"}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 shadow-sm ${
          isMe 
            ? 'bg-black/20 hover:bg-black/30 text-black active:scale-95' 
            : 'bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] active:scale-95'
        }`}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : hasError ? (
          <RefreshCw size={15} />
        ) : isPlaying ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} className="ml-0.5" fill="currentColor" />
        )}
      </button>

      <div className="flex-1 space-y-1.5 min-w-0">
        {/* Scrubbable Seek Bar */}
        <div 
          onClick={handleSeek}
          className="h-2 bg-black/15 hover:bg-black/25 rounded-full overflow-hidden relative cursor-pointer transition-all"
          title="Clique para avançar ou retroceder"
        >
          <div 
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-75 ${isMe ? 'bg-[#00a884]' : 'bg-[#d4af37]'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest opacity-60">
          <span>{hasError ? 'Erro' : formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            <span>{hasError ? 'Tente novamente' : formatTime(duration)}</span>
            <a 
              href={src} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline flex items-center gap-0.5 opacity-80 hover:opacity-100 transition-opacity"
              title="Abrir arquivo de áudio"
            >
              <Volume2 size={9} />
              <span>Ouvir</span>
              <ExternalLink size={7} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
