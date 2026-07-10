/**
 * GATE 05 — section sequencer.
 *
 * Executes the sections declared in CONFIG.sequence, in order, with
 * fading transitions between them. Each section is an independent,
 * editable module exporting:
 *
 *   { id, mount(root, ctx), start(ctx), teardown() }
 *
 * `ctx` gives every section the shared config, the layered audio engine,
 * the XR stage (VR LAYER), and `next()` / `goTo(id)` to advance.
 *
 * VR: the agreement section enters the immersive session on Accept
 * (ctx.stage). From then on transitions use the stage's in-headset fade
 * (the DOM fader is invisible inside a headset); the DOM fader still
 * runs for the flat 2D fallback.
 */

import { CONFIG } from './config.js';
import { AudioEngine } from './audio/audio-engine.js';
import { XRStage } from './vr/xr-stage.js';
import * as gate from './sections/section-gate.js';
import * as agreement from './sections/section-agreement.js';
import * as loading from './sections/section-loading.js';
import * as deck from './sections/section-deck.js';
import * as capsule from './sections/section-capsule.js';

const SECTIONS = { gate, agreement, loading, deck, capsule };

const app = document.getElementById('app');
const fader = document.getElementById('fader');
const audio = new AudioEngine(CONFIG);
const stage = new XRStage(CONFIG);

// If the headset session ends before boarding completes (user pressed the
// system exit, removed the headset, …) restart cleanly at the gate.
stage.onSessionEnd = () => {
  if (!window.__gate05BoardingComplete) location.reload();
};

let current = null;   // { module, el }
let index = -1;

import { wait } from './util/wait.js';

async function fadeOut(white = false) {
  if (stage.active) { await stage.fade(1, CONFIG.fadeMs, white ? 0xffffff : 0x000000); return; }
  fader.classList.toggle('is-white', white);
  fader.classList.add('is-active');
  await wait(CONFIG.fadeMs);
}

async function fadeIn() {
  console.debug(`[sequencer] fadeIn (stage.active=${stage.active})`);
  if (stage.active) { await stage.fade(0, CONFIG.fadeMs); return; }
  fader.classList.remove('is-active');
  await wait(CONFIG.fadeMs);
  console.debug('[sequencer] fadeIn done');
}

async function show(id, { white = false } = {}) {
  const module = SECTIONS[id];
  if (!module) throw new Error(`Unknown section: ${id}`);
  console.debug(`[sequencer] show: ${id}`);

  if (current) {
    await fadeOut(white);
    console.debug(`[sequencer] teardown: ${current.el.id}`);
    current.module.teardown?.();
    current.el.remove();
  }

  const el = document.createElement('section');
  el.className = 'section';
  el.id = `section-${id}`;
  app.appendChild(el);

  const ctx = {
    config: CONFIG,
    audio,
    stage,
    next: () => next(),
    goTo: (target, opts) => show(target, opts),
  };
  try {
    module.mount(el, ctx);
  } catch (e) {
    console.error(`[sequencer] mount failed for ${id}:`, e);
    throw e;
  }
  console.debug(`[sequencer] mounted: ${id}`);
  index = CONFIG.sequence.indexOf(id);
  current = { module, el };

  await fadeIn();
  console.debug(`[sequencer] start: ${id}`);
  module.start?.(ctx);
}

function next() {
  const id = CONFIG.sequence[index + 1];
  // White transitions: into the deck (loading→deck) and through the
  // glowing port into the capsule (deck→capsule).
  if (id) show(id, { white: ['loading', 'deck'].includes(CONFIG.sequence[index]) });
}

show(CONFIG.sequence[0]);
