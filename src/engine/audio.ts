import { PowerUpType, WorldId } from '../types/game';

export const SHERA_COIN_REWARD_AUDIO_URL = '/assets/shera-coin-reward.mp3';
export const COIN_REWARD_COOLDOWN_MS = 20_000;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private soundEnabled = true;
  private musicEnabled = true;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private currentMusicMode: 'menu' | WorldId | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Uploaded 6-second coin-streak / milestone reward clip
  private rewardRawBytes: ArrayBuffer | null = null;
  private rewardBuffer: AudioBuffer | null = null;
  private rewardFetchPromise: Promise<void> | null = null;
  private rewardDecodePromise: Promise<void> | null = null;
  private rewardFallbackAudio: HTMLAudioElement | null = null;
  private activeRewardSource: AudioBufferSourceNode | null = null;
  private isRewardClipPlaying = false;
  private lastRewardClipPlayedAt = -Infinity;

  public init(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.soundEnabled ? 0.9 : 0;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.34 : 0;
      this.musicGain.connect(this.masterGain);

      this.buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.preloadRewardClip();
  }

  public preloadRewardClip(): void {
    if (typeof window === 'undefined') return;

    // Preload HTMLAudioElement fallback for Android mobile browsers / WebView
    if (!this.rewardFallbackAudio && typeof Audio !== 'undefined') {
      const el = new Audio(SHERA_COIN_REWARD_AUDIO_URL);
      el.preload = 'auto';
      el.setAttribute('playsinline', 'true');
      el.volume = this.soundEnabled ? 0.78 : 0;
      el.load();
      this.rewardFallbackAudio = el;
    }

    // Fetch raw audio bytes once so WebAudio can decode synchronously on user gesture
    if (!this.rewardRawBytes && !this.rewardFetchPromise && typeof fetch !== 'undefined') {
      this.rewardFetchPromise = fetch(SHERA_COIN_REWARD_AUDIO_URL)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((buf) => {
          this.rewardRawBytes = buf;
          this.decodeRewardBuffer();
        })
        .catch(() => {
          this.rewardFetchPromise = null;
        });
    } else if (this.rewardRawBytes && !this.rewardBuffer) {
      this.decodeRewardBuffer();
    }
  }

  private decodeRewardBuffer(): void {
    if (!this.ctx || !this.rewardRawBytes || this.rewardBuffer || this.rewardDecodePromise) return;
    const copy = this.rewardRawBytes.slice(0);
    this.rewardDecodePromise = this.ctx
      .decodeAudioData(copy)
      .then((decoded) => {
        this.rewardBuffer = decoded;
      })
      .catch(() => {
        // Fallback HTMLAudioElement remains ready if WebAudio decode fails on a device
      })
      .finally(() => {
        this.rewardDecodePromise = null;
      });
  }

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setSettings(sound: boolean, music: boolean): void {
    this.soundEnabled = sound;
    this.musicEnabled = music;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(sound ? 0.9 : 0, this.ctx.currentTime, 0.03);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(music ? 0.34 : 0, this.ctx.currentTime, 0.05);
    }
    if (this.rewardFallbackAudio) {
      this.rewardFallbackAudio.volume = sound ? 0.78 : 0;
    }
    if (!sound) {
      this.stopRewardClip();
    }
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
    if (this.rewardFallbackAudio && !this.rewardFallbackAudio.paused) {
      this.rewardFallbackAudio.pause();
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (
      this.rewardFallbackAudio &&
      this.isRewardClipPlaying &&
      this.soundEnabled &&
      this.rewardFallbackAudio.paused &&
      !this.activeRewardSource
    ) {
      this.rewardFallbackAudio.play().catch(() => {
        this.isRewardClipPlaying = false;
      });
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    dest: 'sfx' | 'music' = 'sfx',
    delay = 0
  ): void {
    if (!this.ctx || !this.sfxGain || !this.musicGain) return;
    if (dest === 'sfx' && !this.soundEnabled) return;
    if (dest === 'music' && !this.musicEnabled) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.015, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(dest === 'sfx' ? this.sfxGain : this.musicGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(duration: number, filterFreq: number, filterType: BiquadFilterType, volume: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || !this.soundEnabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playUiClick(): void {
    this.init();
    this.playTone(620, 880, 0.07, 'triangle', 0.22);
  }

  public playFootstep(surface: WorldId = 'clouds'): void {
    if (!this.soundEnabled || !this.ctx) return;
    const freq =
      surface === 'crystal'
        ? 145
        : surface === 'lava'
        ? 105
        : surface === 'frozen'
        ? 160
        : 122;
    this.playTone(freq, 52, 0.055, 'sine', 0.14);
    this.playNoise(0.04, surface === 'frozen' ? 1450 : surface === 'dragon' ? 640 : 950, 'bandpass', 0.05);
  }

  public playLaneSwitch(): void {
    this.init();
    this.playTone(260, 440, 0.08, 'sine', 0.16);
    this.playNoise(0.07, 1600, 'bandpass', 0.08);
  }

  public playJump(boosted = false): void {
    this.init();
    if (boosted) {
      this.playTone(220, 760, 0.24, 'triangle', 0.3);
      this.playTone(330, 990, 0.22, 'sine', 0.2, 'sfx', 0.04);
    } else {
      this.playTone(190, 520, 0.16, 'triangle', 0.24);
      this.playNoise(0.09, 1200, 'highpass', 0.06);
    }
  }

  public playDoubleJump(): void {
    this.init();
    this.playTone(320, 820, 0.2, 'triangle', 0.25);
    this.playTone(480, 1080, 0.18, 'sine', 0.16, 'sfx', 0.04);
  }

  public playSlide(): void {
    this.init();
    this.playTone(240, 95, 0.18, 'sawtooth', 0.09);
    this.playNoise(0.22, 800, 'lowpass', 0.16);
  }

  public playCoin(combo = 0): void {
    this.init();
    const semitone = Math.min(combo, 12);
    const pitchMult = Math.pow(2, semitone / 24);
    const base = 880 * pitchMult;
    this.playTone(base, base * 1.02, 0.08, 'sine', 0.22);
    this.playTone(base * 1.5, base * 1.5, 0.13, 'triangle', 0.18, 'sfx', 0.045);
  }

  public playGem(): void {
    this.init();
    this.playTone(784, 784, 0.09, 'sine', 0.24);
    this.playTone(1046, 1046, 0.11, 'sine', 0.22, 'sfx', 0.05);
    this.playTone(1568, 1568, 0.18, 'triangle', 0.24, 'sfx', 0.1);
  }

  public playPowerUp(type: PowerUpType): void {
    this.init();
    if (type === 'rocket' || type === 'speedBoost') {
      this.playTone(150, 740, 0.34, 'sawtooth', 0.18);
      this.playNoise(0.36, 750, 'bandpass', 0.2);
    } else if (type === 'shield' || type === 'hoverboard' || type === 'invincibility') {
      this.playTone(392, 587, 0.16, 'triangle', 0.25);
      this.playTone(587, 987, 0.24, 'sine', 0.25, 'sfx', 0.07);
    } else {
      this.playTone(523, 784, 0.12, 'triangle', 0.24);
      this.playTone(784, 1046, 0.18, 'sine', 0.24, 'sfx', 0.07);
    }
  }

  public playCollision(absorbed = false): void {
    this.init();
    if (absorbed) {
      this.playTone(420, 140, 0.22, 'sawtooth', 0.22);
      this.playTone(880, 440, 0.18, 'sine', 0.2, 'sfx', 0.03);
      this.playNoise(0.18, 1400, 'bandpass', 0.2);
    } else {
      this.playTone(150, 42, 0.36, 'sawtooth', 0.36);
      this.playTone(95, 32, 0.4, 'square', 0.22);
      this.playNoise(0.32, 450, 'lowpass', 0.35);
      // Game over descending sting
      this.playTone(330, 220, 0.32, 'triangle', 0.18, 'sfx', 0.22);
      this.playTone(220, 146, 0.45, 'triangle', 0.2, 'sfx', 0.45);
    }
  }

  public playTrainHorn(): void {
    this.init();
    this.playTone(233, 228, 0.45, 'sawtooth', 0.11);
    this.playTone(293, 288, 0.45, 'sawtooth', 0.09);
    this.playNoise(0.35, 380, 'lowpass', 0.08);
  }

  public playLavaAmbient(): void {
    if (!this.soundEnabled || !this.ctx) return;
    this.playNoise(0.28, 280, 'lowpass', 0.07);
  }

  public playVictory(): void {
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.22, 'triangle', 0.26, 'sfx', i * 0.09);
    });
  }

  public stopRewardClip(): void {
    if (this.activeRewardSource) {
      try {
        this.activeRewardSource.onended = null;
        this.activeRewardSource.stop();
        this.activeRewardSource.disconnect();
      } catch {
        // Ignore already-stopped source errors
      }
      this.activeRewardSource = null;
    }
    if (this.rewardFallbackAudio) {
      try {
        this.rewardFallbackAudio.pause();
        this.rewardFallbackAudio.currentTime = 0;
      } catch {
        // Ignore media reset errors
      }
    }
    this.isRewardClipPlaying = false;
  }

  /**
   * Plays the original uploaded 6-second audio clip (/assets/shera-coin-reward.mp3)
   * on coin-streak or special milestone triggers with:
   * - strict 20-second cooldown (skips without queueing if triggered inside cooldown)
   * - zero overlapping playback
   * - full respect for mute/volume settings and Android AudioContext lifecycle
   */
  public playCoinRewardClip(): boolean {
    if (!this.soundEnabled) return false;
    if (this.isRewardClipPlaying) return false;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastRewardClipPlayedAt < COIN_REWARD_COOLDOWN_MS) {
      return false;
    }

    this.init();

    if (this.rewardBuffer && this.ctx && this.sfxGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.rewardBuffer;
        const clipGain = this.ctx.createGain();
        clipGain.gain.value = 0.85;
        src.connect(clipGain);
        clipGain.connect(this.sfxGain);

        this.activeRewardSource = src;
        this.isRewardClipPlaying = true;
        this.lastRewardClipPlayedAt = now;

        src.onended = () => {
          if (this.activeRewardSource === src) {
            this.activeRewardSource = null;
            this.isRewardClipPlaying = false;
          }
          try {
            clipGain.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        };

        src.start(0);
        return true;
      } catch {
        this.activeRewardSource = null;
        this.isRewardClipPlaying = false;
      }
    }

    if (this.rewardFallbackAudio) {
      this.rewardFallbackAudio.volume = this.soundEnabled ? 0.78 : 0;
      this.rewardFallbackAudio.currentTime = 0;
      this.isRewardClipPlaying = true;
      this.lastRewardClipPlayedAt = now;

      this.rewardFallbackAudio.onended = () => {
        this.isRewardClipPlaying = false;
      };
      this.rewardFallbackAudio.onerror = () => {
        this.isRewardClipPlaying = false;
      };

      const playPromise = this.rewardFallbackAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          this.isRewardClipPlaying = false;
        });
      }
      return true;
    }

    return false;
  }

  public getRewardClipDebugState() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cooldownRemainingMs = Math.max(
      0,
      COIN_REWARD_COOLDOWN_MS - (now - this.lastRewardClipPlayedAt)
    );
    return {
      assetUrl: SHERA_COIN_REWARD_AUDIO_URL,
      isPlaying: this.isRewardClipPlaying,
      soundEnabled: this.soundEnabled,
      preloadedBuffer: Boolean(this.rewardBuffer),
      preloadedElement: Boolean(this.rewardFallbackAudio),
      cooldownRemainingMs,
    };
  }

  public startMusic(mode: 'menu' | WorldId): void {
    if (this.currentMusicMode === mode && this.musicTimer !== null) return;
    this.currentMusicMode = mode;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    const scales: Record<'menu' | WorldId, number[]> = {
      menu: [261.63, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63, 293.66],
      clouds: [293.66, 369.99, 440.0, 587.33, 554.37, 440.0, 369.99, 329.63],
      lava: [196.0, 233.08, 293.66, 311.13, 293.66, 233.08, 220.0, 196.0],
      crystal: [261.63, 311.13, 392.0, 466.16, 523.25, 466.16, 392.0, 349.23],
      dragon: [220.0, 261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66],
      frozen: [329.63, 392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0],
    };

    const intervalMs = mode === 'menu' ? 320 : 195;
    this.musicStep = 0;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicEnabled || this.ctx.state !== 'running') return;
      const scale = scales[mode];
      const note = scale[this.musicStep % scale.length];
      const bass = scale[0] * 0.5;

      this.playTone(note, note, (intervalMs / 1000) * 0.9, 'triangle', mode === 'menu' ? 0.14 : 0.16, 'music');
      if (this.musicStep % 2 === 0) {
        this.playTone(bass, bass, (intervalMs / 1000) * 1.4, 'sine', 0.22, 'music');
      }
      this.musicStep++;
    }, intervalMs);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentMusicMode = null;
  }
}

export const soundEngine = new SoundEngine();
