import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleError = (e: any) => {
      const error = audio.error;
      console.error('Audio load error:', error);
      let message = 'Erro ao carregar áudio.';
      if (error) {
        switch (error.code) {
          case 1: message = 'Carregamento abortado.'; break;
          case 2: message = 'Erro de rede.'; break;
          case 3: message = 'Erro ao decodificar (Formato incompatível).'; break;
          case 4: message = 'Áudio não encontrado ou não suportado.'; break;
        }
      }
      setIsLoading(false);
      setIsPlaying(false);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    // Initial check
    if (audio.readyState >= 2) {
      setAudioData();
    }

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('canplaythrough', setAudioData);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('canplaythrough', setAudioData);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          // Force load if it hasn't started
          if (audioRef.current.readyState === 0) {
            audioRef.current.load();
          }
          
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
          }
        }
      } catch (err: any) {
        console.error('Playback error:', err);
        // If it's a format issue, show a more specific alert
        if (err.name === 'NotSupportedError') {
          alert('Este formato de áudio não é suportado pelo seu navegador/celular.');
        } else {
          alert('Não foi possível reproduzir. Tente novamente.');
        }
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / duration) * 100 || 0;

  return (
    <div className={`flex items-center gap-3 min-w-[200px] p-2 rounded-2xl ${isMe ? 'bg-black/10' : 'bg-white/5'}`}>
      <button 
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMe ? 'bg-black/20 hover:bg-black/30' : 'bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37]'}`}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} className="ml-0.5" fill="currentColor" />
        )}
      </button>

      <div className="flex-1 space-y-1">
        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden relative">
          <div 
            className={`absolute left-0 top-0 h-full transition-all duration-100 ${isMe ? 'bg-black/40' : 'bg-[#d4af37]'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest opacity-40">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            <span>{formatTime(duration)}</span>
            <a href={src} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <span className="underline text-[7px]">Abrir</span>
            </a>
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" playsInline />
    </div>
  );
};
