/**
 * SECTION 3 — Loading / Flight Setup In Progress.
 *
 * Two renderings of the same sequence, chosen by whether the immersive
 * VR session is active (ctx.stage.active):
 *
 *  - VR: a 3D "flight setup" hologram floats in front of the user —
 *    spinning diagnostic ring, orbiting capsule, progress arc and phase
 *    text — rendered through the shared XR stage.
 *  - 2D fallback: the DOM layout with the #flight-setup-graphic slot.
 *    A built-in animated SVG plays by default; provide
 *    config.loading.graphicUrl — or replace the slot's contents — to
 *    swap it out without touching the rest of the section.
 *
 * When the setup phases complete, the sequencer fades (to white) into
 * the SpaceX onboarding deck.
 */

import * as THREE from '../vendor/three.module.min.js';
import { wait } from '../util/wait.js';

export const id = 'loading';

let ctxRef = null;
let running = false;
let vr = null;   // VR-mode state { scene, ring, capsuleOrbit, arc, phaseTex, … }

export function mount(root, ctx) {
  ctxRef = ctx;
  if (ctx.stage.active) { mountVR(root, ctx); return; }

  root.innerHTML = `
    <div class="loading-stack">
      <div id="flight-setup-graphic" aria-label="Flight setup in progress"></div>
      <h1 class="loading-title">Flight Setup In Progress</h1>
      <p class="loading-phase" id="loading-phase">Initializing …</p>
      <div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loading-bar">
        <div class="bar-fill" id="bar-fill"></div>
      </div>
    </div>
  `;

  const slot = root.querySelector('#flight-setup-graphic');
  const { graphicUrl } = ctx.config.loading;
  if (graphicUrl) {
    const img = document.createElement('img');
    img.src = graphicUrl;
    img.alt = 'Flight setup animation';
    slot.appendChild(img);
  } else {
    slot.innerHTML = defaultFlightSetupSVG();
  }
}

export async function start(ctx) {
  const { phases, durationMs } = ctx.config.loading;
  const step = durationMs / phases.length;
  running = true;

  for (let i = 0; i < phases.length; i++) {
    const pct = (i + 1) / phases.length;
    if (!running) return;
    if (vr) {
      setVRPhase(phases[i], pct);
    } else {
      const phaseEl = document.getElementById('loading-phase');
      const fill = document.getElementById('bar-fill');
      const bar = document.getElementById('loading-bar');
      if (phaseEl) phaseEl.textContent = phases[i];
      if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
      bar?.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
    }
    ctx.audio.play('sfx.uiConfirm');
    await wait(step);
  }

  // All phases complete → fade into the onboarding deck.
  await wait(700);
  if (running) ctx.next();
}

export function teardown() {
  running = false;
  if (vr) { ctxRef.stage.setScene(null, null); vr = null; }
  ctxRef = null;
}

/* ====================================================================== */
/* VR rendering — flight-setup hologram in front of the user              */
/* ====================================================================== */

function mountVR(root, ctx) {
  // Minimal DOM note for anyone looking at the flat screen while the
  // experience runs in-headset.
  root.innerHTML = `
    <div class="loading-stack">
      <h1 class="loading-title">Flight Setup In Progress</h1>
      <p class="loading-phase">Experience running in headset …</p>
    </div>
  `;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.add(new THREE.AmbientLight(0x334866, 1.6));
  const key = new THREE.PointLight(0x9fd8ff, 8, 12);
  key.position.set(0, 2.4, 0.5);
  scene.add(key);

  // Faint starfield so the void has depth.
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 400; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 8);
    pts.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x6fa8cc, size: 0.05 })));

  // Hologram cluster ~2 m in front of the user at chest height.
  const holo = new THREE.Group();
  holo.position.set(0, 1.35, -2);
  scene.add(holo);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.015, 12, 80),
    new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.85 })
  );
  holo.add(ring);

  // Progress arc fills as phases complete.
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.02, 12, 80, 0.01), arcMat);
  arc.rotation.z = Math.PI / 2;
  holo.add(arc);

  // Little capsule on orbit.
  const orbit = new THREE.Group();
  const capsule = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8edf4, roughness: 0.4 })
  );
  capsule.position.x = 0.5;
  capsule.rotation.z = -Math.PI / 2;
  orbit.add(capsule);
  holo.add(orbit);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x4fd8ff })
  );
  holo.add(core);

  // Phase text panel under the hologram.
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.172),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  panel.position.set(0, -0.75, 0);
  holo.add(panel);

  vr = { scene, ring, orbit, arc, canvas, tex, progress: 0 };
  setVRPhase('Initializing …', 0);

  ctx.stage.rig.position.set(0, 0, 0);
  ctx.stage.rig.rotation.set(0, 0, 0);
  ctx.stage.setScene(scene, (dt, t) => {
    ring.rotation.z = t * 0.6;
    ring.rotation.x = Math.sin(t * 0.4) * 0.25;
    orbit.rotation.z = t * 1.4;
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
    // Feed the audio layer the listener pose.
    ctx.audio.setListenerPose(
      ctx.stage.headWorldPosition(), ctx.stage.headWorldDirection()
    );
  });
}

function setVRPhase(label, pct) {
  const g = vr.canvas.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  g.fillStyle = '#4fd8ff';
  g.font = '600 44px monospace';
  g.textAlign = 'center';
  g.fillText('FLIGHT SETUP IN PROGRESS', 512, 56);
  g.fillStyle = '#8ea3c4';
  g.font = '34px monospace';
  g.fillText(label, 512, 120);
  vr.tex.needsUpdate = true;

  // Grow the progress arc (TorusGeometry arc length can't be edited in
  // place — swap the geometry).
  vr.arc.geometry.dispose();
  vr.arc.geometry = new THREE.TorusGeometry(0.56, 0.02, 12, 80, Math.max(0.01, pct * Math.PI * 2));
}

/* ====================================================================== */
/* 2D fallback — default flight-setup animation (SMIL/CSS SVG)            */
/* ====================================================================== */

function defaultFlightSetupSVG() {
  return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated flight setup diagnostic">
    <defs>
      <radialGradient id="ringGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.55" stop-color="#4fd8ff" stop-opacity="0"/>
        <stop offset="0.85" stop-color="#4fd8ff" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#4fd8ff" stop-opacity="0"/>
        <stop offset="1" stop-color="#4fd8ff" stop-opacity="0.6"/>
      </linearGradient>
    </defs>

    <circle cx="100" cy="100" r="96" fill="url(#ringGlow)"/>

    <!-- outer dashed diagnostic ring (slow spin) -->
    <g>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#1f2c47" stroke-width="2"/>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#4fd8ff" stroke-width="2"
              stroke-dasharray="10 14" stroke-linecap="round" opacity="0.8">
        <animateTransform attributeName="transform" type="rotate"
                          from="0 100 100" to="360 100 100" dur="14s" repeatCount="indefinite"/>
      </circle>
    </g>

    <!-- radar sweep -->
    <g>
      <path d="M 100 100 L 100 30 A 70 70 0 0 1 148 49 Z" fill="url(#sweep)">
        <animateTransform attributeName="transform" type="rotate"
                          from="0 100 100" to="360 100 100" dur="3.2s" repeatCount="indefinite"/>
      </path>
      <circle cx="100" cy="100" r="70" fill="none" stroke="#26385c" stroke-width="1.5"/>
      <circle cx="100" cy="100" r="46" fill="none" stroke="#26385c" stroke-width="1"/>
      <line x1="30" y1="100" x2="170" y2="100" stroke="#1a2742" stroke-width="1"/>
      <line x1="100" y1="30" x2="100" y2="170" stroke="#1a2742" stroke-width="1"/>
    </g>

    <!-- planet / pad marker -->
    <circle cx="100" cy="100" r="14" fill="#0c1220" stroke="#4fd8ff" stroke-width="2">
      <animate attributeName="stroke-opacity" values="1;0.35;1" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="100" cy="100" r="4" fill="#4fd8ff"/>

    <!-- capsule on orbit -->
    <g>
      <animateTransform attributeName="transform" type="rotate"
                        from="0 100 100" to="360 100 100" dur="5.5s" repeatCount="indefinite"/>
      <g transform="translate(100 30)">
        <path d="M -6 4 C -6 -3 -3 -7 0 -7 C 3 -7 6 -3 6 4 Z" fill="#dfe9f5"/>
        <rect x="-6" y="4" width="12" height="3" rx="1.5" fill="#8fa5bd"/>
        <circle cx="0" cy="-1" r="2" fill="#0f2038"/>
      </g>
    </g>

    <!-- telemetry ticks -->
    <g fill="#4fd8ff" font-family="monospace" font-size="7" opacity="0.85" text-anchor="middle">
      <text x="100" y="14">ACL-0500</text>
      <text x="100" y="192">FLIGHT SETUP</text>
    </g>
  </svg>`;
}
