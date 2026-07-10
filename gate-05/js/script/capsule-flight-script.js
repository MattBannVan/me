/**
 * SCRIPT LAYER — capsule flight script (Section 5: Dragon capsule interior).
 *
 * The user is strapped into their seat for the whole section — there is no
 * locomotion, which is what keeps this section rock-stable in VR. Each beat
 * is an editable step; the executor plays them in order.
 *
 * The `actors` object is provided by section-capsule.js and exposes:
 *   hud(text)                — status line (VR HUD panel / DOM line)
 *   wait(ms)
 *   sealHatch(ms)            — hatch closes + seals behind the user (SFX)
 *   harness()                — harness buckles click home (SFX)
 *   lookAt(zone, ms)         — 'down' | 'display' | 'window' | 'forward':
 *                              gaze prompt in VR, scripted camera in 2D
 *   bootDisplays(ms)         — cabin displays power on
 *   armConfirmButton()       — CONFIRM button glows; resolves when pressed
 *                              (controller trigger/touch in VR, click/Enter
 *                              in 2D, auto after config timeout)
 *   countdown(from)          — display counts down with blips + comm chatter
 *   ascend(ms)               — ignition→cutoff: rumble, shake, haptic pulses,
 *                              window transitions from pad sky to space
 *   engineCutoff()           — rumble fades, stars settle, orbit chime
 *   comm()                   — muffled ground-control voice on the comm
 */

export const CAPSULE_FLIGHT_SCRIPT = [
  {
    name: 'hatch-seal',
    run: async (a) => {
      a.hud('HATCH CLOSING — REMAIN SEATED');
      await a.sealHatch(2600);
      a.hud('HATCH SECURE · CABIN PRESSURIZED');
      await a.wait(1400);
    },
  },
  {
    name: 'harness',
    run: async (a) => {
      a.hud('CHECK YOUR HARNESS');
      await a.lookAt('down', 2200);
      a.harness();
      await a.wait(1200);
      await a.lookAt('forward', 1600);
    },
  },
  {
    name: 'systems-boot',
    run: async (a) => {
      a.hud('FLIGHT SYSTEMS COMING ONLINE');
      await a.bootDisplays(2400);
      a.comm();
      await a.wait(900);
    },
  },
  {
    name: 'confirm',
    run: async (a) => {
      a.hud('PRESS CONFIRM WHEN READY');
      await a.lookAt('display', 1500);
      await a.armConfirmButton();
      a.hud('LAUNCH SEQUENCE ARMED');
      await a.wait(1000);
    },
  },
  {
    name: 'countdown',
    run: async (a) => {
      a.comm();
      await a.countdown();
    },
  },
  {
    name: 'ascent',
    run: async (a) => {
      a.hud('');
      await a.ascend();
    },
  },
  {
    name: 'cutoff',
    run: async (a) => {
      await a.engineCutoff();
      a.hud('MAIN ENGINE CUTOFF — WELCOME TO ORBIT');
      a.comm();
      await a.lookAt('window', 2600);
      await a.wait(4200);
    },
  },
];

/** Plays every beat in order. Resolves when the flight is complete. */
export async function runCapsuleFlightScript(actors) {
  for (const beat of CAPSULE_FLIGHT_SCRIPT) {
    console.debug(`[script:capsule] beat: ${beat.name}`);
    await beat.run(actors);
  }
  console.debug('[script:capsule] complete — flight finished');
}
