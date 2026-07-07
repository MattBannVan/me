/**
 * AUDIO LAYER — Gate 05 / Agent Cyber Lines Ltd.
 *
 * Layered Web Audio engine, deliberately kept open for future edits:
 *
 *   master ──┬── background bus  : looping ambient beds (deck hum, valves)
 *            ├── sfx bus         : interactive one-shots layered on top
 *            └── voice bus       : specialists — routed through a low-pass
 *                                  "muffle" insert so voices read as dull,
 *                                  muffled tones behind a visor.
 *
 * Sounds are declared in js/config.js. Each entry may carry a `url`
 * (real asset, to be provided) and/or a `procedural` placeholder name.
 * When a URL is present it wins; otherwise the procedural synth plays,
 * so the mix works end-to-end before any assets exist.
 *
 * Spatial support: play(..., { position: {x,y,z} }) routes the sound
 * through a PannerNode (HRTF). setListenerPose() is called every frame
 * by the 3D deck so loops and one-shots localize correctly.
 */

export class AudioEngine {
  constructor(config) {
    this.config = config;
    this.ctx = null;
    this.buses = {};
    this.registry = new Map(); // "layer.name" -> definition
    this.activeLoops = new Map();
    this._buffers = new Map();
  }

  /** Must be called from a user gesture (autoplay policy). Idempotent. */
  async init() {
    if (this.ctx) { await this.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    for (const layer of ['background', 'sfx', 'voice']) {
      const gain = this.ctx.createGain();
      const inserts = [];
      if (layer === 'voice') {
        // Muffle insert: dull, muffled specialist voices.
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 520;
        lowpass.Q.value = 0.6;
        inserts.push(lowpass);
      }
      let head = gain;
      for (const node of inserts) { head.connect(node); head = node; }
      head.connect(this.master);
      this.buses[layer] = { gain, inserts, input: gain };
    }

    // Register every sound declared in config — new config entries are
    // picked up automatically, keeping this layer open for expansion.
    for (const [layer, sounds] of Object.entries(this.config.audio)) {
      for (const [name, def] of Object.entries(sounds)) {
        this.registry.set(`${layer}.${name}`, { layer, name, ...def });
      }
    }
    await this.resume();
  }

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch { /* user gesture pending */ }
    }
  }

  /** Register or override a sound at runtime (future edits/expansion). */
  register(layer, name, def) {
    this.registry.set(`${layer}.${name}`, { layer, name, ...def });
  }

  /**
   * Play a sound by "layer.name" key.
   * opts: { position: {x,y,z} } for spatialized (HRTF) playback.
   * Returns a handle with .stop(fadeSeconds).
   */
  async play(key, opts = {}) {
    if (!this.ctx) return null;
    const def = this.registry.get(key);
    if (!def) { console.warn(`[audio] unknown sound: ${key}`); return null; }

    const out = this._outputChain(def, opts);
    let handle;
    if (def.url) {
      handle = await this._playBuffer(def, out);
    } else {
      handle = PROCEDURAL[def.procedural]
        ? PROCEDURAL[def.procedural](this.ctx, out, def)
        : null;
      if (!handle) { console.warn(`[audio] no source for ${key}`); return null; }
    }
    if (def.loop) {
      this.activeLoops.get(key)?.stop(0.2);
      this.activeLoops.set(key, handle);
    }
    return handle;
  }

  stop(key, fadeSeconds = 0.6) {
    this.activeLoops.get(key)?.stop(fadeSeconds);
    this.activeLoops.delete(key);
  }

  stopAll(fadeSeconds = 0.8) {
    for (const [, handle] of this.activeLoops) handle.stop(fadeSeconds);
    this.activeLoops.clear();
  }

  setLayerGain(layer, value, rampSeconds = 0.3) {
    const bus = this.buses[layer];
    if (bus) bus.gain.gain.linearRampToValueAtTime(value, this.ctx.currentTime + rampSeconds);
  }

  /** Called per-frame by the 3D deck to keep spatial audio aligned. */
  setListenerPose(pos, forward, up = { x: 0, y: 1, z: 0 }) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /* ---------------------------------------------------------------- */

  _outputChain(def, opts) {
    const bus = this.buses[def.layer];
    const gain = this.ctx.createGain();
    gain.gain.value = def.gain ?? 0.7;
    if (opts.position) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.setPosition?.(opts.position.x, opts.position.y, opts.position.z);
      if (panner.positionX) {
        panner.positionX.value = opts.position.x;
        panner.positionY.value = opts.position.y;
        panner.positionZ.value = opts.position.z;
      }
      gain.connect(panner);
      panner.connect(bus.input);
    } else {
      gain.connect(bus.input);
    }
    return gain;
  }

  async _playBuffer(def, out) {
    let buffer = this._buffers.get(def.url);
    if (!buffer) {
      const res = await fetch(def.url);
      buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this._buffers.set(def.url, buffer);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!def.loop;
    src.connect(out);
    src.start();
    return makeHandle(this.ctx, out, () => { try { src.stop(); } catch {} });
  }
}

/* ------------------------------------------------------------------ */
/* Procedural placeholder synths — swapped out automatically when the  */
/* real audio URLs are provided in js/config.js.                       */
/* ------------------------------------------------------------------ */

function makeHandle(ctx, out, killFn) {
  let stopped = false;
  return {
    stop(fadeSeconds = 0.4) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
      setTimeout(killFn, fadeSeconds * 1000 + 60);
    },
  };
}

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

const PROCEDURAL = {
  /** Low, barely-there onboarding-deck air handler hum. */
  deckHum(ctx, out) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 46;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 92.5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc.connect(out);
    osc2.connect(g2).connect(out);
    osc.start(); osc2.start();
    return makeHandle(ctx, out, () => { osc.stop(); osc2.stop(); });
  },

  /** Faint pressure-relief valves: irregular filtered-noise hiss bursts. */
  pressureValves(ctx, out) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 3);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 1.4;
    const env = ctx.createGain();
    env.gain.value = 0;
    src.connect(bp).connect(env).connect(out);
    src.start();
    let alive = true;
    (function schedule() {
      if (!alive) return;
      const t = ctx.currentTime + 0.8 + Math.random() * 4.5;
      const len = 0.5 + Math.random() * 1.4;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16 + Math.random() * 0.1, t + len * 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      setTimeout(schedule, (t + len - ctx.currentTime) * 1000);
    })();
    return makeHandle(ctx, out, () => { alive = false; src.stop(); });
  },

  /** Short UI confirmation blip. */
  uiConfirm(ctx, out) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(990, t + 0.09);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(env).connect(out);
    osc.start(t); osc.stop(t + 0.3);
    return makeHandle(ctx, out, () => {});
  },

  /** Dull thud of a boot lightly tapping the deck plating. */
  bootTap(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.35, t);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(env).connect(out);
    noise.connect(lp).connect(nEnv).connect(out);
    osc.start(t); osc.stop(t + 0.25);
    noise.start(t); noise.stop(t + 0.1);
    return makeHandle(ctx, out, () => {});
  },

  /** Soft double-pulse cueing the haptic "control granted" moment. */
  hapticCue(ctx, out) {
    const t = ctx.currentTime;
    for (const dt of [0, 0.16]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 210;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t + dt);
      env.gain.exponentialRampToValueAtTime(0.5, t + dt + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.12);
      osc.connect(env).connect(out);
      osc.start(t + dt); osc.stop(t + dt + 0.15);
    }
    return makeHandle(ctx, out, () => {});
  },

  /** Rising white-out swell as the user crosses into the capsule port. */
  portEnter(ctx, out) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(6000, t + 2.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 2.0);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    src.connect(lp).connect(env).connect(out);
    src.start(t); src.stop(t + 3.1);
    return makeHandle(ctx, out, () => {});
  },

  /**
   * Muffled specialist voice: a short murmur of band-limited tone bursts.
   * The voice bus low-pass does the final dulling.
   */
  muffledVoice(ctx, out, def) {
    const t = ctx.currentTime;
    const syllables = 3 + Math.floor(Math.random() * 4);
    let cursor = t;
    for (let i = 0; i < syllables; i++) {
      const len = 0.12 + Math.random() * 0.16;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 95 + Math.random() * 55;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, cursor);
      env.gain.exponentialRampToValueAtTime(0.5, cursor + len * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, cursor + len);
      osc.connect(lp).connect(env).connect(out);
      osc.start(cursor); osc.stop(cursor + len + 0.02);
      cursor += len + 0.04 + Math.random() * 0.09;
    }
    return makeHandle(ctx, out, () => {});
  },
};
