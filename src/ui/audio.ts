// 8-bit sound effects and chiptune music, synthesised with WebAudio (no files).

export type Sfx =
  | 'hit' | 'shot' | 'crit' | 'death' | 'promote' | 'heal' | 'save' | 'ability' | 'shieldBreak'
  | 'win' | 'lose' | 'start' | 'star' | 'click' | 'select' | 'buy' | 'levelup' | 'relic' | 'coins' | 'achievement';

export type TrackId = 'menu' | 'map' | 'battle' | 'boss';

export interface AudioSettings {
  sound: boolean;
  music: boolean;
  /** 0..1 */
  soundVolume: number;
  /** 0..1 */
  musicVolume: number;
}

// ---------- Music data ----------

const PITCH: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** "A4" → semitones from A4. */
function note(name: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return PITCH[m[1]] + 12 * (Number(m[2]) + 1) - 69;
}

/** "Am" / "Bb" → chord tones (semitones from A4) around octave 3. */
function chord(name: string): number[] {
  const m = /^([A-G][#b]?)(m?)$/.exec(name)!;
  const root = note(`${m[1]}3`);
  return [root, root + (m[2] ? 3 : 4), root + 7];
}

interface Track {
  bpm: number;
  chords: string[];
  /** Eighth-note tokens per bar ("-" rest, "~" hold), bars separated by "|". */
  melody: string;
  /** 16 sixteenths per bar: R root, O octave, F fifth, "." rest. */
  bass: string;
  /** 16 sixteenths per bar: k kick, s snare, h hat. */
  drums: string;
  arp: boolean;
  leadVolume: number;
}

const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 84, chords: ['Am', 'F', 'C', 'G'], arp: true, leadVolume: 0.1,
    melody: 'E5 ~ C5 ~ A4 ~ B4 C5 | D5 ~ C5 ~ A4 ~ F4 ~ | E5 ~ G5 ~ E5 ~ C5 D5 | B4 ~ ~ ~ G4 ~ - -',
    bass: 'R.......F.......', drums: '........h.......',
  },
  map: {
    bpm: 104, chords: ['C', 'G', 'Am', 'F'], arp: true, leadVolume: 0.11,
    melody: 'C5 - E5 G5 ~ E5 D5 C5 | D5 ~ B4 ~ G4 - B4 D5 | E5 ~ C5 E5 A5 ~ G5 E5 | F5 ~ E5 D5 C5 ~ - -',
    bass: 'R...O...R...F...', drums: 'k...h...s...h...',
  },
  battle: {
    bpm: 138, chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E'], arp: false, leadVolume: 0.12,
    melody: 'A4 A4 C5 A4 E5 ~ D5 C5 | B4 ~ A4 B4 C5 ~ - - | F5 F5 E5 D5 C5 ~ A4 C5 | D5 ~ B4 ~ G4 ~ - - | '
      + 'A5 ~ G5 E5 A5 ~ G5 E5 | C5 D5 E5 ~ D5 C5 B4 ~ | D5 F5 A5 ~ F5 D5 A4 ~ | G#4 ~ B4 ~ E5 ~ - -',
    bass: 'R.R.O.R.R.R.O.F.', drums: 'k.h.s.h.k.k.s.h.',
  },
  boss: {
    bpm: 150, chords: ['Dm', 'Bb', 'Gm', 'A'], arp: false, leadVolume: 0.12,
    melody: 'D5 ~ F5 ~ A5 ~ G#5 A5 | F5 ~ D5 ~ Bb4 ~ C5 D5 | G5 ~ Bb5 ~ G5 F5 E5 D5 | C#5 ~ E5 ~ A5 ~ - -',
    bass: 'RRORRRORRRORRORO', drums: 'k.hkk.s.k.hkk.ss',
  },
};

/** Melody expanded to sixteenths: a pitch where a note starts with its length in steps. */
function expandMelody(t: Track): ({ n: number; len: number } | null)[] {
  const tokens = t.melody.split('|').flatMap((bar) => bar.trim().split(/\s+/));
  const steps: ({ n: number; len: number } | null)[] = new Array(tokens.length * 2).fill(null);
  let last: { n: number; len: number } | null = null;
  tokens.forEach((tok, i) => {
    if (tok === '~' && last) last.len += 2;
    else if (tok === '-' || tok === '~') last = null;
    else {
      last = { n: note(tok), len: 2 };
      steps[i * 2] = last;
    }
  });
  return steps;
}

const MELODIES = Object.fromEntries(
  (Object.keys(TRACKS) as TrackId[]).map((id) => [id, expandMelody(TRACKS[id])]),
) as Record<TrackId, ({ n: number; len: number } | null)[]>;

const freq = (semi: number) => 440 * 2 ** (semi / 12);

// ---------- Engine ----------

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private pulse!: PeriodicWave;
  private settings: AudioSettings = { sound: true, music: true, soundVolume: 0.8, musicVolume: 0.6 };
  private track: TrackId = 'menu';
  private trackGain: GainNode | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private lastPlayed = new Map<Sfx, number>();
  private unlockEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];

  constructor() {
    for (const ev of this.unlockEvents) window.addEventListener(ev, this.unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume().then(() => this.syncMusic());
    });
  }

  /** Browsers (iOS Safari above all) only start audio inside a user gesture. */
  private unlock = (): void => {
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    // Ask iOS 17+ to play through the silent switch like a game does.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        // not supported
      }
    }
    if (ctx.state !== 'running') void ctx.resume().then(() => this.syncMusic());
    // Playing a silent buffer inside the gesture fully unlocks iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === 'running') {
      for (const ev of this.unlockEvents) window.removeEventListener(ev, this.unlock, { capture: true });
    }
    this.syncMusic();
  };

  configure(settings: AudioSettings): void {
    this.settings = settings;
    if (this.ctx) this.applyVolumes();
    this.syncMusic();
  }

  /** Switch the background music, crossfading from the current track. */
  setTrack(id: TrackId): void {
    if (id === this.track) return;
    this.track = id;
    if (this.timer !== null) this.startTrack(true);
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    // A gentle compressor keeps big fights from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // 25% duty pulse wave: the classic NES lead.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    this.pulse = ctx.createPeriodicWave(real, imag);
    return true;
  }

  private applyVolumes(): void {
    const t = this.ctx!.currentTime;
    this.sfxGain.gain.setTargetAtTime(this.settings.soundVolume * 1.6, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume * 1.1, t, 0.05);
  }

  // ---------- Building blocks ----------

  private voice(f: number, start: number, dur: number, vol: number, out: AudioNode, opts: {
    type?: OscillatorType; pulse?: boolean; slideTo?: number; attack?: number;
  } = {}): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    if (opts.pulse) osc.setPeriodicWave(this.pulse);
    else osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(f, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
    const g = ctx.createGain();
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  private noise(start: number, dur: number, vol: number, out: AudioNode, filter: BiquadFilterType, f: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bq).connect(g).connect(out);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.03);
  }

  private arp(notes: number[], start: number, each: number, vol: number, pulse = true): void {
    notes.forEach((n, i) => this.voice(freq(n), start + i * each, each * 1.8, vol, this.sfxGain, { pulse }));
  }

  // ---------- Sound effects ----------

  play(name: Sfx, delay = 0): void {
    if (!this.settings.sound || !this.ensure() || this.ctx!.state !== 'running') return;
    const t = this.ctx!.currentTime + delay;
    const minGap = name === 'hit' || name === 'shot' || name === 'heal' || name === 'click' ? 0.07 : 0.03;
    if (delay === 0 && t - (this.lastPlayed.get(name) ?? -1) < minGap) return;
    this.lastPlayed.set(name, t);
    const out = this.sfxGain;
    switch (name) {
      case 'hit':
        this.noise(t, 0.06, 0.5, out, 'bandpass', 1500);
        this.voice(200, t, 0.07, 0.18, out, { slideTo: 90 });
        break;
      case 'shot':
        this.voice(1100, t, 0.09, 0.1, out, { pulse: true, slideTo: 320 });
        this.noise(t, 0.04, 0.15, out, 'highpass', 4000);
        break;
      case 'crit':
        this.noise(t, 0.1, 0.6, out, 'bandpass', 2600);
        this.voice(520, t, 0.12, 0.18, out, { slideTo: 1560 });
        this.voice(1040, t + 0.04, 0.1, 0.1, out, { pulse: true });
        break;
      case 'death':
        this.voice(420, t, 0.32, 0.16, out, { slideTo: 55 });
        this.noise(t, 0.25, 0.35, out, 'lowpass', 900);
        break;
      case 'promote':
        this.arp([note('C5'), note('E5'), note('G5'), note('C6'), note('E6')], t, 0.055, 0.12);
        break;
      case 'heal':
        this.voice(freq(note('E5')), t, 0.18, 0.12, out, { type: 'sine', slideTo: freq(note('B5')) });
        break;
      case 'save':
        this.arp([note('C6'), note('G5'), note('E5'), note('C6'), note('G6')], t, 0.07, 0.14, false);
        break;
      case 'ability':
        this.voice(300, t, 0.2, 0.08, out, { type: 'sawtooth', slideTo: 1200 });
        this.voice(600, t + 0.05, 0.14, 0.07, out, { pulse: true, slideTo: 900 });
        break;
      case 'shieldBreak':
        this.noise(t, 0.15, 0.45, out, 'highpass', 3000);
        this.voice(1500, t, 0.12, 0.08, out, { type: 'triangle', slideTo: 400 });
        break;
      case 'start':
        this.arp([note('G4'), note('C5'), note('E5')], t, 0.08, 0.12);
        this.voice(freq(note('G5')), t + 0.24, 0.35, 0.14, out, { pulse: true });
        this.noise(t + 0.24, 0.2, 0.3, out, 'highpass', 5000);
        break;
      case 'win':
        this.arp([note('C5'), note('E5'), note('G5'), note('C6')], t, 0.1, 0.13);
        this.voice(freq(note('E6')), t + 0.42, 0.5, 0.14, out, { pulse: true });
        this.voice(freq(note('C4')), t + 0.42, 0.5, 0.2, out, { type: 'triangle' });
        break;
      case 'lose':
        this.arp([note('G4'), note('E4'), note('C4'), note('G3')], t, 0.16, 0.14, false);
        this.voice(freq(note('C3')), t + 0.64, 0.6, 0.2, out, { type: 'triangle' });
        break;
      case 'star':
        this.voice(freq(note('E6')), t, 0.12, 0.1, out, { pulse: true });
        this.voice(freq(note('B6')), t + 0.05, 0.18, 0.08, out, { type: 'triangle' });
        break;
      case 'click':
        this.voice(880, t, 0.025, 0.05, out, { pulse: true });
        break;
      case 'select':
        this.voice(660, t, 0.04, 0.07, out, { pulse: true, slideTo: 990 });
        break;
      case 'buy':
        this.voice(784, t, 0.05, 0.1, out, { pulse: true });
        this.voice(1047, t + 0.05, 0.09, 0.1, out, { pulse: true });
        break;
      case 'levelup':
        this.arp([note('C5'), note('G5'), note('C6'), note('G6')], t, 0.05, 0.11);
        break;
      case 'coins':
        this.arp([note('B5'), note('E6'), note('B5'), note('E6'), note('B6')], t, 0.045, 0.08);
        break;
      case 'relic':
        this.arp([note('C5'), note('G5'), note('C6'), note('E6'), note('G6'), note('C7')], t, 0.05, 0.11, false);
        break;
      case 'achievement':
        this.arp([note('G5'), note('C6'), note('E6'), note('G6')], t, 0.07, 0.12);
        this.voice(freq(note('C7')), t + 0.3, 0.4, 0.1, out, { type: 'triangle' });
        break;
    }
  }

  // ---------- Music ----------

  private syncMusic(): void {
    const should = this.settings.music && this.ctx?.state === 'running';
    if (should && this.timer === null) {
      this.startTrack(false);
      this.timer = window.setInterval(() => this.schedule(), 25);
    } else if (!should && this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
      this.fadeOut(this.trackGain);
      this.trackGain = null;
    }
  }

  private fadeOut(g: GainNode | null): void {
    if (!g || !this.ctx) return;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.5);
    setTimeout(() => g.disconnect(), 700);
  }

  private startTrack(crossfade: boolean): void {
    const ctx = this.ctx!;
    if (crossfade) this.fadeOut(this.trackGain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + (crossfade ? 0.6 : 1.2));
    g.connect(this.musicGain);
    this.trackGain = g;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.trackGain) return;
    const t = TRACKS[this.track];
    const melody = MELODIES[this.track];
    const sixteenth = 60 / t.bpm / 4;
    const out = this.trackGain;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const total = t.chords.length * 16;
      const s = this.step % total;
      const bar = Math.floor(s / 16);
      const pos = s % 16;
      const tones = chord(t.chords[bar]);
      const time = this.nextTime;

      const lead = melody[s];
      if (lead) this.voice(freq(lead.n), time, sixteenth * lead.len * 0.95, t.leadVolume, out, { pulse: true, attack: 0.01 });

      const b = t.bass[pos];
      if (b !== '.') {
        const n = tones[0] - 12 + (b === 'O' ? 12 : b === 'F' ? 7 : 0);
        this.voice(freq(n), time, sixteenth * 1.8, 0.32, out, { type: 'triangle' });
      }

      if (t.arp && pos % 2 === 0) {
        const n = tones[(pos / 2) % 3] + 12;
        this.voice(freq(n), time, sixteenth * 1.5, 0.035, out, { pulse: true });
      }

      switch (t.drums[pos]) {
        case 'k':
          this.voice(150, time, 0.14, 0.5, out, { type: 'sine', slideTo: 40 });
          break;
        case 's':
          this.noise(time, 0.12, 0.28, out, 'highpass', 1800);
          this.voice(190, time, 0.06, 0.12, out, { type: 'triangle' });
          break;
        case 'h':
          this.noise(time, 0.03, 0.12, out, 'highpass', 7000);
          break;
      }
      this.nextTime += sixteenth;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
