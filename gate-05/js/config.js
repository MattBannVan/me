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
      /** Public-domain mechanical drone (Wikimedia Commons), self-hosted. */
      deckHum: {
        url: 'assets/audio/deckHum.ogg',
        procedural: 'deckHum', loop: true, gain: 0.30,
      },
      /** Public-domain compressed-air burst loop — pressure-relief hiss. */
      pressureValves: {
        url: 'assets/audio/pressureValves.ogg',
        procedural: 'pressureValves', loop: true, gain: 0.55,
      },
      engineRumble: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/SLS_Test_Fire.mp3',
        procedural: 'engineRumble', loop: true, gain: 0.85,
      },
    },
    sfx: {
      /** CC0 short digital confirmation blip (Wikimedia Commons). */
      uiConfirm: {
        url: 'assets/audio/uiConfirm.ogg',
        procedural: 'uiConfirm', gain: 0.5,
      },
      /** Public-domain dull thud — boot on deck plating. */
      bootTap: {
        url: 'assets/audio/bootTap.ogg',
        procedural: 'bootTap', gain: 0.8,
      },
      hapticCue: { url: null, procedural: 'hapticCue', gain: 0.6 },
      /** Crisp fabric/glove-flex rustle. No usable real recording exists
          on a directly-downloadable license-clear source (checked
          Wikimedia Commons — nothing suitable) — stays procedural. */
      fabricRustle: { url: null, procedural: 'fabricRustle', gain: 0.45 },
      /** No good real "rising swell into bright light" match found —
          procedural placeholder stays authoritative for this one. */
      portEnter: { url: null, procedural: 'portEnter', gain: 0.7 },
      /** Public-domain hydraulic/pneumatic descent — servo + seal thud.
          Source clip runs ~24s; trimmed to the ~2.5s the seal beat
          actually takes (see AudioEngine._playBuffer's `trimSec`). */
      hatchSeal: {
        url: 'assets/audio/hatchSeal.ogg', trimSec: 2.5,
        procedural: 'hatchSeal', gain: 0.7,
      },
      noseCone: {
        url: 'assets/audio/hatchSeal.ogg', trimSec: 2.2,
        procedural: 'hatchSeal', gain: 0.6,
      },
      /** CC0 mechanical click — harness buckle latching. */
      harnessClick: {
        url: 'assets/audio/harnessClick.ogg',
        procedural: 'harnessClick', gain: 0.7,
      },
      /** CC0 cabin-chime — "welcome to orbit". */
      orbitChime: {
        url: 'assets/audio/orbitChime.ogg',
        procedural: 'orbitChime', gain: 0.45,
      },
      /** The real NASA mission-comm keying tone — cues each voice murmur. */
      quindar: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Quindar_tones.ogg',
        procedural: 'uiConfirm', gain: 0.3,
      },
    },
    voice: {
      /** Specialists speak in dull, muffled tones (low-pass voice bus). */
      specialistMurmur: { url: null, procedural: 'muffledVoice', gain: 0.5 },
      /** Ground control over the cabin comm — real public-domain NASA
          Apollo 13 "Houston, we've had a problem" clip, dulled by the
          voice bus low-pass into radio murmur. */
      groundControl: {
        url: 'assets/audio/groundControl.ogg',
        procedural: 'muffledVoice', gain: 0.4,
      },
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

  /**
   * REAL ASSETS — glTF models + PBR texture sets, self-hosted under
   * gate-05/assets/ (see js/util/assets.js for the loader; every load
   * resolves `null` on failure so callers keep their procedural-geometry
   * fallback, the same contract the AUDIO LAYER uses for its URLs).
   *
   * Sources (all direct-downloadable, license-clear):
   *  - metalPlate, floor: Poly Haven (CC0) — dl.polyhaven.org
   *  - plastic: ambientCG (CC0) — ambientcg.com
   *  - earth day/clouds: Solar System Scope textures, NASA-sourced
   *    equirectangular maps mirrored on Wikimedia Commons (CC BY 4.0 —
   *    attribution: Solar System Scope, solarsystemscope.com/textures)
   *  - specialists: Kenney "Mini Characters" (CC0) — kenney.nl
   *  - astronaut: NASA 3D Resources (public domain) — github.com/nasa/NASA-3D-Resources
   *  - station: Kenney "Space Station Kit" (CC0) — kenney.nl
   */
  assets: {
    textures: {
      metalPlate: {
        map: 'assets/textures/metal_plate_diff_1k.jpg',
        normalMap: 'assets/textures/metal_plate_nor_1k.jpg',
        roughnessMap: 'assets/textures/metal_plate_rough_1k.jpg',
      },
      floor: {
        map: 'assets/textures/floor_diff_1k.jpg',
        normalMap: 'assets/textures/floor_nor_1k.jpg',
        roughnessMap: 'assets/textures/floor_rough_1k.jpg',
      },
      plastic: {
        map: 'assets/textures/plastic_diff_1k.jpg',
        normalMap: 'assets/textures/plastic_nor_1k.jpg',
        roughnessMap: 'assets/textures/plastic_rough_1k.jpg',
      },
      /** Scuba-suede (technical stretch synthetic) — closest CC0 match to
          a flight-suit/glove fabric. Applied with sheen shading, not flat
          MeshStandardMaterial, so it actually reads as cloth. */
      fabric: {
        map: 'assets/textures/fabric_diff_1k.jpg',
        normalMap: 'assets/textures/fabric_nor_1k.jpg',
        roughnessMap: 'assets/textures/fabric_rough_1k.jpg',
      },
      /** Smooth white plastic (ambientCG Plastic010, CC0) — the real
          Crew Dragon cabin is smooth white composite bulkheads, not
          gritty industrial metal, so the capsule interior gets its own
          clean material distinct from the deck's worn diamond-plate. */
      cabin: {
        map: 'assets/textures/cabin_diff_1k.jpg',
        normalMap: 'assets/textures/cabin_nor_1k.jpg',
        roughnessMap: 'assets/textures/cabin_rough_1k.jpg',
      },
    },
    earth: {
      day: 'assets/earth/earth_daymap_2k.jpg',
      clouds: 'assets/earth/earth_clouds_2k.jpg',
    },
    models: {
      specialists: [
        'assets/models/characters/character-male-a.glb',
        'assets/models/characters/character-female-a.glb',
      ],
      astronaut: 'assets/models/astronaut/astronaut.glb',
      stationDir: 'assets/models/station/',
    },
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
