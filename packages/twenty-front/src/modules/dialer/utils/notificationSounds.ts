// notification sounds for dialer feedback
// uses Web Audio API to generate pleasant, non-intrusive notification sounds
// no external audio files required — all sounds are synthesized

let audioContext: AudioContext | null = null;
let soundsEnabled = true;
let masterVolume = 0.7;

const getAudioContext = (): AudioContext | null => {
  if (soundsEnabled === false) return null;

  try {
    if (audioContext === null) {
      audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }

    if (audioContext !== null && audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    return audioContext;
  } catch {
    return null;
  }
};

const playTone = (
  frequency: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = 'sine',
): void => {
  const ctx = getAudioContext();
  if (ctx === null) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    const scaledVolume = volume * masterVolume;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(scaledVolume, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // silent fail for sound playback
  }
};

const playToneSequence = (
  tones: Array<{
    frequency: number;
    duration: number;
    delay: number;
    volume?: number;
    type?: OscillatorType;
  }>,
): void => {
  const ctx = getAudioContext();
  if (ctx === null) return;

  tones.forEach(
    ({ frequency, duration, delay, volume = 0.25, type = 'sine' }) => {
      setTimeout(() => {
        playTone(frequency, duration, volume, type);
      }, delay);
    },
  );
};

export const playCallStartSound = (): void => {
  const ctx = getAudioContext();
  if (ctx === null) return;

  try {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    const frequencies = [440, 554];
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + 0.15 + i * 0.15);
    });
  } catch {
    // silent fail
  }
};

export const playCallEndSound = (): void => {
  const ctx = getAudioContext();
  if (ctx === null) return;

  try {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25 * masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    const frequencies = [440, 349.23, 293.66];
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 0.25);
    });
  } catch {
    // silent fail
  }
};

export const playCallConnectedSound = (): void => {
  playToneSequence([
    { frequency: 523.25, duration: 0.1, delay: 0, volume: 0.2 },
    { frequency: 659.25, duration: 0.1, delay: 80, volume: 0.22 },
    { frequency: 783.99, duration: 0.2, delay: 160, volume: 0.25 },
  ]);
};

export const playDialingStartedSound = (): void => {
  playToneSequence([
    { frequency: 349.23, duration: 0.08, delay: 0, volume: 0.15 },
    { frequency: 440, duration: 0.08, delay: 70, volume: 0.18 },
    { frequency: 523.25, duration: 0.12, delay: 140, volume: 0.2 },
  ]);
};

export const playIncomingCallSound = (): void => {
  playToneSequence([
    { frequency: 659.25, duration: 0.15, delay: 0, volume: 0.25 },
    { frequency: 523.25, duration: 0.15, delay: 150, volume: 0.25 },
    { frequency: 659.25, duration: 0.15, delay: 300, volume: 0.25 },
    { frequency: 523.25, duration: 0.15, delay: 450, volume: 0.25 },
  ]);
};

export const playSuccessSound = (): void => {
  playToneSequence([
    { frequency: 523.25, duration: 0.15, delay: 0, volume: 0.2 },
    { frequency: 659.25, duration: 0.2, delay: 120, volume: 0.25 },
  ]);
};

export const playErrorSound = (): void => {
  playTone(220, 0.3, 0.2, 'square');
};

export const playNotificationSound = (): void => {
  playTone(880, 0.15, 0.25, 'sine');
};

// ringback tone — bell-like with harmonics, loops until stopped
let ringbackTimer: ReturnType<typeof setTimeout> | null = null;

const playRingbackPhrase = (): void => {
  const ctx = getAudioContext();
  if (ctx === null) return;

  const bell = (freq: number, start: number, dur: number): void => {
    [1, 2.02, 3.01].forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * harmonic;
      const vol = (0.12 * masterVolume) / (i + 1);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  };

  const t = ctx.currentTime;
  bell(523.25, t, 0.25);
  bell(659.25, t + 0.2, 0.25);
  bell(783.99, t + 0.4, 0.35);
  bell(880, t + 0.75, 0.5);
};

export const startRingbackTone = (): void => {
  stopRingbackTone();
  playRingbackPhrase();
  ringbackTimer = setInterval(playRingbackPhrase, 2000);
};

export const stopRingbackTone = (): void => {
  if (ringbackTimer !== null) {
    clearInterval(ringbackTimer);
    ringbackTimer = null;
  }
};

export const setNotificationSoundsEnabled = (enabled: boolean): void => {
  soundsEnabled = enabled;

  if (enabled === false && audioContext !== null) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
};

export const isNotificationSoundsEnabled = (): boolean => {
  return soundsEnabled;
};

export const setMasterVolume = (volume: number): void => {
  masterVolume = Math.max(0, Math.min(1, volume));
};

export const getMasterVolume = (): number => {
  return masterVolume;
};

export const initializeAudio = (): boolean => {
  const ctx = getAudioContext();
  return ctx !== null;
};
