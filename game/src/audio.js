// audio.js — every sound in Sunset Bay is synthesized with WebAudio.
// No audio files exist anywhere in the game: an engine hum whose pitch
// follows speed, a two-tone police siren, pickup blips, a mission jingle,
// a punch thud and a gunshot crack, all built from oscillators and filtered
// noise. Audio starts only after a user gesture (the Start button), and a
// failed AudioContext just means the game plays silent.
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

    // Build the graph on first use (called from the Start button, so the
    // browser allows it) and resume it whenever it was suspended.
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

        // Engine: two detuned oscillators (saw + low square) through a
        // lowpass filter, kept quiet until the player drives.
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
        const sub = this.ctx.createGain();
        sub.gain.value = 0.4;
        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(sub);
        sub.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineOsc2.start();

        // Siren: a square wave whose pitch flips between two tones.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'square';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();

        this.started = true;
      } catch (e) {
        // No audio hardware / blocked: the game plays silent.
      }
    },

    // Engine volume and pitch track the car's speed; silent on foot.
    setEngine(speed, driving) {
      if (!this.started) return;
      const s = Math.abs(speed);
      const target = driving ? 0.045 + Math.min(s / 40, 1) * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      const freq = 52 + s * 5.2;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.06);
      this.engineOsc2.frequency.setTargetAtTime(freq * 0.5, this.ctx.currentTime, 0.06);
      this.engineFilter.frequency.setTargetAtTime(320 + s * 22, this.ctx.currentTime, 0.1);
    },

    // Two-tone siren: the tone flips every 0.42 s while any unit chases.
    setSiren(on, dt) {
      if (!this.started) return;
      if (!on) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
        return;
      }
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(
          this.sirenHigh ? 920 : 660, this.ctx.currentTime, 0.02,
        );
      }
      this.sirenGain.gain.setTargetAtTime(0.028, this.ctx.currentTime, 0.2);
    },

    // One short tone that fades out — the building block for pickups and UI.
    blip(freq = 880, dur = 0.09, type = 'sine', vol = 0.16) {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    // Mission-complete arpeggio: four rising triangle notes.
    jingle() {
      if (!this.started) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        setTimeout(() => this.blip(freq, 0.22, 'triangle', 0.2), i * 130);
      });
    },

    // A low filtered noise burst: punches and car impacts.
    thud() {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    },

    // A sharp highpassed noise crack plus a low square pop.
    shot() {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.09);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
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
