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

/** Plays every beat in order. Resolves when the user should get control. */
export async function runUserActionScript(actors) {
  for (const beat of USER_ACTION_SCRIPT) {
    await beat.run(actors);
  }
}
