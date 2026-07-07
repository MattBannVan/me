/**
 * GATE 05 — section sequencer.
 *
 * Executes the sections declared in CONFIG.sequence, in order, with
 * full-screen fading transitions between them. Each section is an
 * independent, editable module exporting:
 *
 *   { id, mount(root, ctx), start(ctx), teardown() }
 *
 * `ctx` gives every section the shared config, the layered audio engine,
 * and `next()` / `goTo(id)` to advance the sequence.
 */

import { CONFIG } from './config.js';
import { AudioEngine } from './audio/audio-engine.js';
import * as gate from './sections/section-gate.js';
import * as agreement from './sections/section-agreement.js';
import * as loading from './sections/section-loading.js';
import * as deck from './sections/section-deck.js';

const SECTIONS = { gate, agreement, loading, deck };

const app = document.getElementById('app');
const fader = document.getElementById('fader');
const audio = new AudioEngine(CONFIG);

let current = null;   // { module, el }
let index = -1;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fadeOut(white = false) {
  fader.classList.toggle('is-white', white);
  fader.classList.add('is-active');
  await wait(CONFIG.fadeMs);
}

async function fadeIn() {
  fader.classList.remove('is-active');
  await wait(CONFIG.fadeMs);
}

async function show(id, { white = false } = {}) {
  const module = SECTIONS[id];
  if (!module) throw new Error(`Unknown section: ${id}`);

  if (current) {
    await fadeOut(white);
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
    next: () => next(),
    goTo: (target, opts) => show(target, opts),
  };
  module.mount(el, ctx);
  index = CONFIG.sequence.indexOf(id);
  current = { module, el };

  await fadeIn();
  module.start?.(ctx);
}

function next() {
  const id = CONFIG.sequence[index + 1];
  if (id) show(id, { white: CONFIG.sequence[index] === 'loading' });
}

show(CONFIG.sequence[0]);
