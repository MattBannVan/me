/**
 * GATE 05 — Agent Cyber Lines Ltd. — experience configuration.
 *
 * Everything tweakable lives here: the section sequence, render mode,
 * timings, and — importantly — the AUDIO URL SLOTS. Real audio URLs are
 * "to be provided": drop them into the `url` fields below and the audio
 * engine will stream them instead of its procedural placeholders.
 */

export const CONFIG = {
  carrier: {
    name: 'Agent Cyber Lines Ltd.',
    gate: 'GATE 05',
    flight: 'ACL-0500',
    craft: 'VR CRAFT · DRAGON CLASS',
  },

  /**
   * Render mode for the 3D deck section:
   *  - 'open-world' : scripted intro, then control is handed to the user
   *                   (move + look, must eventually enter the capsule port).
   *  - 'movie'      : the entire section plays as a scripted movie —
   *                   the camera walks itself into the port. No input needed.
   */
  deckMode: 'open-world',

  /** Section execution order. Each id maps to js/sections/section-<id>.js */
  sequence: ['gate', 'agreement', 'loading', 'deck', 'capsule', 'orbit'],

  /**
   * VR (WebXR) — once the user accepts the terms, the rest of the
   * experience runs as an immersive-vr session (Meta Quest etc.; the
   * page must be served over HTTPS). If no headset/WebXR is available
   * the flat 2D fallback plays instead.
   */
  vr: {
    enabled: true,
    referenceSpace: 'local-floor',
    snapTurnDeg: 30,
  },

  /** Fade transition length between sections (must match CSS .fader). */
  fadeMs: 900,

  loading: {
    /** Minimum time the flight-setup sequence takes (ms). */
    durationMs: 6500,
    /**
     * Optional URL for a custom animated graphic (SVG/GIF/APNG/WebM poster).
     * When null, the built-in animated "flight setup" SVG is used.
     */
    graphicUrl: null,
    phases: [
      'Linking neural interface …',
      'Pressurizing cabin systems …',
      'Calibrating haptic array …',
      'Syncing flight telemetry …',
      'Suit integrity verified',
      'Boarding corridor unlocked',
    ],
  },

  /**
   * AUDIO LAYERS — background loops with interactive SFX layered on top,
   * plus a dedicated muffled voice bus. Set `url` when the real audio
   * URLs are provided; `procedural` names the built-in placeholder that
   * plays if the URL is missing OR fails to load/decode. Add new entries
   * freely — the engine registers whatever it finds here, so this layer
   * stays open for future edits.
   *
   * Real assets currently wired: public-domain NASA recordings hosted on
   * Wikimedia Commons (upload.wikimedia.org serves CORS `*`, required
   * for Web Audio):
   *   - SLS engine test fire  → background.engineRumble
   *   - Quindar comm tone     → sfx.quindar (precedes voice murmurs)
   *   - Apollo 15 comm check  → voice.stationComm
   * More verified alternates (drop into any `url` slot):
   *   https://upload.wikimedia.org/wikipedia/commons/3/39/Pete_Conrad_First_Steps_on_Moon_Quote.ogg
   *   https://upload.wikimedia.org/wikipedia/commons/7/75/Sputnik_-_Beep.mp3
   *   https://upload.wikimedia.org/wikipedia/commons/4/45/Quindar_-_Sound_%281%29.mp3
   */
  audio: {
    background: {
      deckHum:        { url: null, procedural: 'deckHum',        loop: true, gain: 0.30 },
      pressureValves: { url: null, procedural: 'pressureValves', loop: true, gain: 0.55 },
      engineRumble: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/SLS_Test_Fire.mp3',
        procedural: 'engineRumble', loop: true, gain: 0.85,
      },
    },
    sfx: {
      uiConfirm:    { url: null, procedural: 'uiConfirm',    gain: 0.5 },
      bootTap:      { url: null, procedural: 'bootTap',      gain: 0.8 },
      hapticCue:    { url: null, procedural: 'hapticCue',    gain: 0.6 },
      portEnter:    { url: null, procedural: 'portEnter',    gain: 0.7 },
      hatchSeal:    { url: null, procedural: 'hatchSeal',    gain: 0.7 },
      noseCone:     { url: null, procedural: 'hatchSeal',    gain: 0.6 },
      harnessClick: { url: null, procedural: 'harnessClick', gain: 0.7 },
      orbitChime:   { url: null, procedural: 'orbitChime',   gain: 0.45 },
      /** The real NASA mission-comm keying tone — cues each voice murmur. */
      quindar: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Quindar_tones.ogg',
        procedural: 'uiConfirm', gain: 0.3,
      },
    },
    voice: {
      /** Specialists speak in dull, muffled tones (low-pass voice bus). */
      specialistMurmur: { url: null, procedural: 'muffledVoice', gain: 0.5 },
      /** Ground control over the cabin comm — same dull, radio-muffled feel. */
      groundControl:    { url: null, procedural: 'muffledVoice', gain: 0.4 },
      /** Station traffic on the rendezvous channel — real Apollo 15 comm
          check, dulled by the voice bus low-pass into radio murmur. */
      stationComm: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/A15-test.ogg',
        procedural: 'muffledVoice', gain: 0.3,
      },
    },
  },

  deck: {
    /** Walk speed (m/s) once control is handed to the user. */
    moveSpeed: 1.6,
    /** Haptic pulse (ms) signalling that control has been granted. */
    hapticPatternMs: [60, 40, 120],
    /** Distance (m) from the port at which boarding triggers. */
    portEnterRadius: 0.9,
  },

  capsule: {
    /** Countdown length in seconds. */
    countdownFrom: 5,
    /** Powered-ascent duration (ms) — engine rumble, shake, sky→space. */
    ascentMs: 14000,
    /** How long the CONFIRM button waits before auto-confirming (ms). */
    confirmTimeoutMs: 12000,
  },

  orbit: {
    /** Nose-cone opening duration (ms). */
    noseOpenMs: 4500,
    /** Orbital-sunrise sweep duration (ms). */
    sunriseMs: 7000,
    /** Quiet free-look float before the section closes (ms). */
    floatMs: 12000,
  },
};
