/**
 * SCRIPT LAYER — user action script for the onboarding-deck section.
 *
 * The user starts with LIMITED CONTROL: this declarative beat list drives
 * their body and camera. Each beat is an editable step — reorder, retime,
 * or add beats freely; the executor below plays them in sequence.
 *
 * The `actors` object is provided by section-deck.js and exposes:
 *   pitchTo(rad, ms)        — tilt the user's head
 *   yawTo(rad, ms)          — turn the user's body
 *   raiseHands(t01, ms)     — bring gloved hands into view (0..1)
 *   waveHands(ms)           — turn/flex the hands while raised
 *   tapLeftBoot(ms)         — lift + lightly tap the deck, with SFX
 *   nod(ms)                 — greeting nod
 *   specialistsNod(ms)      — the specialists return the greeting
 *   specialistMurmur(which) — muffled voice from a specialist ('left'|'right')
 *   hud(text)               — set / clear the HUD status line
 *   wait(ms)
 */

export const USER_ACTION_SCRIPT = [
  {
    name: 'settle',
    run: async (a) => {
      a.hud('MOTOR CONTROL: RESTRICTED — SUIT SYNC IN PROGRESS');
      await a.wait(1800);
    },
  },
  {
    name: 'look-down-at-hands',
    run: async (a) => {
      await Promise.all([a.pitchTo(-0.8, 1600), a.raiseHands(1, 1600)]);
      await a.wait(300);
    },
  },
  {
    name: 'move-hands-around',
    run: async (a) => {
      await a.waveHands(3200);
      await a.wait(250);
    },
  },
  {
    name: 'look-down-at-boots',
    run: async (a) => {
      await Promise.all([a.pitchTo(-1.05, 1400), a.raiseHands(0, 1000)]);
      await a.wait(400);
    },
  },
  {
    name: 'tap-left-boot',
    run: async (a) => {
      await a.tapLeftBoot(1100);
      await a.wait(500);
    },
  },
  {
    name: 'look-back-up',
    run: async (a) => {
      await a.pitchTo(0, 1500);
      await a.wait(300);
    },
  },
  {
    name: 'greet-specialists',
    run: async (a) => {
      a.specialistMurmur('left');
      await a.nod(900);
      a.specialistMurmur('right');
      await a.specialistsNod(1100);
      await a.wait(600);
    },
  },
  {
    name: 'release-control',
    run: async (a) => {
      // Control hand-off is signalled with a brief haptic vibration
      // (handled by section-deck.js right after the script resolves).
      a.hud('MOTOR CONTROL: RESTORED — PROCEED TO CAPSULE PORT');
    },
  },
];

/**
 * VR (headset) variant of the same sequence. Inside a headset the script
 * cannot rotate the user's head or move their real hands — forcing camera
 * motion is a comfort violation and tracking overrides it anyway. So under
 * limited control the beats become GUIDED: the HUD prompts the action and
 * `waitForLook` watches the actual headset pitch until the user performs
 * it (with a timeout so the sequence never stalls). Hands are the tracked
 * controllers wearing the suit gloves; the boot tap and greetings still
 * animate in-world.
 *
 * Extra VR actors: waitForLook(zone, timeoutMs) with zone
 * 'down' | 'down-steep' | 'forward'.
 */
export const USER_ACTION_SCRIPT_XR = [
  {
    name: 'settle',
    run: async (a) => {
      a.hud('MOTOR CONTROL: RESTRICTED — SUIT SYNC IN PROGRESS');
      await a.wait(2200);
    },
  },
  {
    name: 'look-down-at-hands',
    run: async (a) => {
      a.hud('LOOK DOWN — CHECK YOUR GLOVES');
      await a.waitForLook('down', 9000);
      await a.wait(400);
    },
  },
  {
    name: 'move-hands-around',
    run: async (a) => {
      a.hud('MOVE YOUR HANDS — FLEX EACH GLOVE');
      await a.wait(3600);
    },
  },
  {
    name: 'look-down-at-boots',
    run: async (a) => {
      a.hud('CHECK YOUR BOOTS');
      await a.waitForLook('down-steep', 9000);
      await a.wait(400);
    },
  },
  {
    name: 'tap-left-boot',
    run: async (a) => {
      await a.tapLeftBoot(1100);
      await a.wait(500);
    },
  },
  {
    name: 'look-back-up',
    run: async (a) => {
      a.hud('EYES FORWARD');
      await a.waitForLook('forward', 9000);
      await a.wait(300);
    },
  },
  {
    name: 'greet-specialists',
    run: async (a) => {
      a.hud('GREET THE SPECIALISTS');
      a.specialistMurmur('left');
      await a.nod(900);
      a.specialistMurmur('right');
      await a.specialistsNod(1100);
      await a.wait(600);
    },
  },
  {
    name: 'release-control',
    run: async (a) => {
      a.hud('MOTOR CONTROL: RESTORED — PROCEED TO CAPSULE PORT');
    },
  },
];

/**
 * Plays every beat in order. Resolves when the user should get control.
 * mode: 'screen' (flat 2D fallback) | 'xr' (in-headset, gaze-guided).
 */
export async function runUserActionScript(actors, mode = 'screen') {
  const beats = mode === 'xr' ? USER_ACTION_SCRIPT_XR : USER_ACTION_SCRIPT;
  for (const beat of beats) {
    console.debug(`[script:${mode}] beat: ${beat.name}`);
    await beat.run(actors);
  }
  console.debug(`[script:${mode}] complete — releasing control`);
}
