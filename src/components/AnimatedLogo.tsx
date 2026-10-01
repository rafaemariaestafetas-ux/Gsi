import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export default function AnimatedLogo({ size = 120, withSound = true }: { size?: number, withSound?: boolean }) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playChime = () => {
    if (!withSound) return;
    
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const playTone = (freq: number, start: number, duration: number, volume: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.2, start + duration);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Premium tech chime: three harmonic rising notes
      const now = ctx.currentTime;
      playTone(523.25, now, 1.2, 0.05); // C5
      playTone(659.25, now + 0.1, 1.0, 0.04); // E5
      playTone(783.99, now + 0.2, 0.8, 0.03); // G5
    } catch (e) {
      console.warn('Audio chime failed', e);
    }
  };

  useEffect(() => {
    // We attempt to play on mount, but browsers might block.
    // It will likely work after the user interacts with the page once.
    const timer = setTimeout(playChime, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Hexagon */}
        <motion.path
          d="M50 5L90 27.5V72.5L50 95L10 72.5V27.5L50 5Z"
          stroke="#1e3a8a"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        
        {/* Stylized G */}
        <motion.path
          d="M65 35C60 30 50 30 45 35C40 40 40 50 45 55C50 60 60 60 65 55V50H55"
          stroke="#1e40af"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
        />

        {/* Stylized S */}
        <motion.path
          d="M40 70C45 75 55 75 60 70C65 65 40 65 35 60C30 55 40 45 45 45C55 45 60 50 65 55"
          stroke="#1d4ed8"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 1, ease: "easeOut" }}
        />

        {/* Stylized I */}
        <motion.path
          d="M75 30V75"
          stroke="#3b82f6"
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 1.5, ease: "easeOut" }}
        />

        {/* Glow effect */}
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          stroke="#3b82f6"
          strokeWidth="0.5"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: [0, 0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      
      {/* Brand Text */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2 }}
      >
        <span className="text-xl font-black tracking-[0.2em] text-[#1e3a8a]">GSI</span>
        <span className="text-xl font-light tracking-[0.2em] text-[#1e3a8a] ml-2">PRO</span>
      </motion.div>
    </div>
  );
}
