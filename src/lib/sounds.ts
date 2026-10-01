/**
 * GSI PRO - Sistema de Sons Premium
 */

export const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (freq: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      // Pitch slide up for a positive "confirmation" feel
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, start + duration);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    
    // Premium "Confirm" Chime: Arpeggio de Dó Maior (C-E-G-C)
    playTone(523.25, now, 0.6, 0.1);         // C5
    playTone(659.25, now + 0.08, 0.6, 0.08);  // E5
    playTone(783.99, now + 0.16, 0.6, 0.06);  // G5
    playTone(1046.50, now + 0.24, 0.8, 0.04); // C6 (High Octave Sparkle)
    
  } catch (e) {
    console.warn('Falha ao reproduzir som', e);
  }
};

export const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    
    const playTone = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.5, 0.05); // A5
    playTone(880, now + 0.2, 0.5, 0.05); // A5 second beep
  } catch (e) {}
};
