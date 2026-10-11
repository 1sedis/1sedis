// 8-bit sound effects and a looping chiptune, synthesised with WebAudio (no files).

export type Sfx =
  | 'hit' | 'shot' | 'crit' | 'death' | 'promote' | 'heal' | 'save'
  | 'win' | 'lose' | 'click' | 'buy' | 'relic' | 'coins' | 'ability';

const A4 = 440;
const freq = (semitonesFromA4: number) => A4 * 2 ** (semitonesFromA4 / 12);

// Chord roots (semitones from A4) for a 4-bar loop: Am, F, C, G.
const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const STEPS_PER_BAR = 8;
const STEP_SECONDS = 0.28;
// Lead arpeggio over each bar: index into chord tones (+12 = octave up), -1 = rest.
const LEAD = [0, 1, 2, 1, 12, -1, 2, 1];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private sfxOn = true;
  private musicOn = true;
  private musicTimer: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private lastPlayed = new Map<Sfx, number>();

  constructor() {
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      this.syncMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  configure(sfx: boolean, music: boolean): void {
    this.sfxOn = sfx;
    this.musicOn = music;
    this.syncMusic();
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
    const master = this.ctx.createGain();
    master.gain.value = 0.5;
    master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(master);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  private tone(f: number, start: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, vol: number, filterFreq: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private arp(notes: number[], start: number, each: number, type: OscillatorType, vol: number): void {
    notes.forEach((n, i) => this.tone(freq(n), start + i * each, each * 1.6, type, vol, this.sfxGain));
  }

  play(name: Sfx): void {
    if (!this.sfxOn || !this.ensure() || this.ctx!.state !== 'running') return;
    const t = this.ctx!.currentTime;
    // Throttle rapid repeats so a big melee does not turn into noise.
    const minGap = name === 'hit' || name === 'shot' || name === 'heal' ? 0.07 : 0.03;
    if (t - (this.lastPlayed.get(name) ?? -1) < minGap) return;
    this.lastPlayed.set(name, t);
    const out = this.sfxGain;
    switch (name) {
      case 'hit':
        this.noise(t, 0.05, 0.35, 1600);
        this.tone(220, t, 0.06, 'square', 0.12, out, 110);
        break;
      case 'shot':
        this.tone(900, t, 0.08, 'square', 0.08, out, 300);
        break;
      case 'crit':
        this.noise(t, 0.08, 0.45, 2400);
        this.tone(660, t, 0.1, 'square', 0.14, out, 1320);
        break;
      case 'death':
        this.tone(440, t, 0.28, 'square', 0.12, out, 70);
        this.noise(t, 0.18, 0.25, 700);
        break;
      case 'promote':
        this.arp([3, 7, 10, 15, 19], t, 0.06, 'square', 0.1);
        break;
      case 'heal':
        this.tone(660, t, 0.16, 'sine', 0.12, out, 990);
        break;
      case 'save':
        this.arp([15, 10, 7, 15, 22], t, 0.07, 'triangle', 0.18);
        break;
      case 'win':
        this.arp([3, 7, 10, 15], t, 0.11, 'square', 0.12);
        this.tone(freq(15), t + 0.44, 0.5, 'triangle', 0.18, out);
        break;
      case 'lose':
        this.arp([10, 7, 3, -2], t, 0.15, 'triangle', 0.18);
        break;
      case 'click':
        this.tone(700, t, 0.03, 'square', 0.04, out);
        break;
      case 'buy':
        this.tone(784, t, 0.05, 'square', 0.08, out);
        this.tone(1047, t + 0.05, 0.08, 'square', 0.08, out);
        break;
      case 'coins':
        this.arp([22, 27, 22, 27, 34], t, 0.04, 'square', 0.06);
        break;
      case 'ability':
        this.tone(330, t, 0.18, 'sawtooth', 0.06, out, 1320);
        this.tone(660, t + 0.05, 0.12, 'square', 0.06, out, 990);
        break;
      case 'relic':
        this.arp([3, 10, 15, 22, 27, 34], t, 0.05, 'triangle', 0.14);
        break;
    }
  }

  private syncMusic(): void {
    const shouldPlay = this.musicOn && this.ctx?.state === 'running';
    if (shouldPlay && this.musicTimer === null) {
      this.nextStepTime = this.ctx!.currentTime + 0.1;
      this.musicTimer = window.setInterval(() => this.schedule(), 80);
    } else if (!shouldPlay && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Schedule music notes a little ahead of time. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextStepTime < ctx.currentTime + 0.3) {
      const bar = Math.floor(this.step / STEPS_PER_BAR) % CHORDS.length;
      const pos = this.step % STEPS_PER_BAR;
      const chord = CHORDS[bar];
      const t = this.nextStepTime;
      if (pos % 2 === 0) this.tone(freq(chord[0] - 24), t, STEP_SECONDS * 1.8, 'triangle', 0.5, this.musicGain);
      const lead = LEAD[pos];
      if (lead >= 0) {
        const n = lead >= 12 ? chord[0] + 12 : chord[lead];
        this.tone(freq(n), t, STEP_SECONDS * 0.9, 'square', 0.12, this.musicGain);
      }
      this.nextStepTime += STEP_SECONDS;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
