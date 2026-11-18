// audio.js — fully synthesized WebAudio sound for Sunset Bay. No audio files.
// Engine hum (pitch follows speed), two-tone police siren, pickup blips,
// mission jingle, punch thud, gunshot crack. Everything is generated with
// oscillators and filtered noise, so the game needs zero network requests.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    sirenHigh: false,
    sirenTimer: 0,
    muted: false,
    started: false,

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        // Engine: two detuned saws through a lowpass.
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'square';
        this.engineOsc2.frequency.value = 28;
        const g2 = this.ctx.createGain(); g2.gain.value = 0.4;
        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(g2); g2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineOsc2.start();
        // Siren: square wave, tone flipped by update().
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'square';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.started = true;
      } catch (e) { /* audio is optional; the game plays silent */ }
    },

    setEngine(speed, driving) {
      if (!this.started) return;
      const s = Math.abs(speed);
      const target = driving ? 0.045 + Math.min(s / 40, 1) * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      const f = 52 + s * 5.2;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
      this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.06);
      this.engineFilter.frequency.setTargetAtTime(320 + s * 22, this.ctx.currentTime, 0.1);
    },

    setSiren(on, dt) {
      if (!this.started) return;
      if (!on) { this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); return; }
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 920 : 660, this.ctx.currentTime, 0.02);
      }
      this.sirenGain.gain.setTargetAtTime(0.028, this.ctx.currentTime, 0.2);
    },

    blip(freq = 880, dur = 0.09, type = 'sine', vol = 0.16) {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    jingle() {
      if (!this.started) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 130);
      });
    },

    thud() {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      const g = this.ctx.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    shot() {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.09);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
      const g = this.ctx.createGain(); g.gain.value = 0.4;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      this.blip(180, 0.07, 'square', 0.12);
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
