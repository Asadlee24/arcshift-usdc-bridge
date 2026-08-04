// lib/audio.ts
// Premium Web Audio API Synth generators for Web3 micro-interactions (Zero external assets needed)

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    // Standard AudioContext initialization
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

// Check if sound is muted in localStorage
const isMuted = (): boolean => {
  return true;
};

export const toggleMuted = (): boolean => {
  if (typeof window === 'undefined') return true;
  const nextMuted = !isMuted();
  localStorage.setItem('arcshift-muted', String(nextMuted));
  return nextMuted;
};

export const getMuteState = (): boolean => {
  return isMuted();
};

// Play short sleek click/navigation tick
export const playClickSound = () => {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.start();
  osc.stop(ctx.currentTime + 0.08);
};

// Play low cosmic charging sweep when bridge begins
export const playChargeSound = () => {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.8);

  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

  osc.start();
  osc.stop(ctx.currentTime + 0.8);
};

// Play a triumphant success chord progression
export const playSuccessSound = () => {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const playNote = (freq: number, startDelay: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);

    gain.gain.setValueAtTime(0.001, ctx.currentTime + startDelay);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startDelay + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

    osc.start(ctx.currentTime + startDelay);
    osc.stop(ctx.currentTime + startDelay + duration);
  };

  // Play beautiful major triad arpeggio (C major harmony)
  playNote(261.63, 0, 0.5);      // C4
  playNote(329.63, 0.1, 0.5);    // E4
  playNote(392.00, 0.2, 0.5);    // G4
  playNote(523.25, 0.35, 0.8);   // C5
};
