/**
 * SCRIPT LAYER — orbit arrival script (Section 6: weightless in orbit).
 *
 * The user is still strapped into their seat — zero locomotion keeps this
 * section as stable as the launch. All motion is object motion (drifting
 * props, the opening nose cone, the sun sweeping over the Earth limb),
 * never self-motion, so there is nothing to fight the vestibular system.
 *
 * The `actors` object is provided by section-orbit.js and exposes:
 *   hud(text)              — status line (VR HUD panel / DOM line)
 *   wait(ms)
 *   releaseProps()         — zero-g props start drifting on their tethers
 *   openNoseCone(ms)       — the forward cone irises open onto Earth (SFX)
 *   lookAt(zone, ms)       — 'earth' | 'forward': gaze prompt in VR,
 *                            scripted camera in 2D
 *   sunrise(ms)            — the sun sweeps up over the Earth limb (chime)
 *   comm(channel)          — muffled voice: 'ground' | 'station'
 */

export const ORBIT_ARRIVAL_SCRIPT = [
  {
    name: 'weightless',
    run: async (a) => {
      a.hud('MECO +10 s — YOU ARE WEIGHTLESS · HARNESS REMAINS ENGAGED');
      a.releaseProps();
      await a.wait(4500);
    },
  },
  {
    name: 'nose-cone-open',
    run: async (a) => {
      a.hud('NOSE CONE OPENING');
      await a.openNoseCone();
      await a.wait(800);
    },
  },
  {
    name: 'look-at-earth',
    run: async (a) => {
      a.hud('LOOK OUT — EARTH BELOW');
      await a.lookAt('earth', 2600);
      a.comm('ground');
      await a.wait(3000);
    },
  },
  {
    name: 'orbital-sunrise',
    run: async (a) => {
      a.hud('ORBITAL SUNRISE');
      await a.sunrise();
      await a.wait(1200);
    },
  },
  {
    name: 'quiet-float',
    run: async (a) => {
      a.hud('');
      a.comm('station');
      await a.float();
    },
  },
  {
    name: 'rendezvous-plotted',
    run: async (a) => {
      a.hud('RENDEZVOUS PLOTTED — STATION DOCKING AHEAD');
      a.comm('station');
      await a.wait(4200);
    },
  },
];

/** Plays every beat in order. Resolves when the section is complete. */
export async function runOrbitArrivalScript(actors) {
  for (const beat of ORBIT_ARRIVAL_SCRIPT) {
    console.debug(`[script:orbit] beat: ${beat.name}`);
    await beat.run(actors);
  }
  console.debug('[script:orbit] complete — orbit arrival finished');
}
