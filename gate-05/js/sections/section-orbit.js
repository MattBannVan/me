/**
 * SECTION 6 — Orbit Arrival (VR GRAPHICS LAYER).
 *
 * MECO is behind you. Still strapped into the seat (zero locomotion — same
 * comfort contract as the launch), the capsule's forward nose cone irises
 * open into a cupola view: Earth turning slowly below, a starfield, and an
 * orbital sunrise sweeping over the limb. Zero-g props drift on tethers to
 * sell weightlessness. All motion is object motion — the user never moves.
 *
 * Sequence lives in js/script/orbit-arrival-script.js. The experience
 * closes here: fade to black, the VR session ends, and the end card teases
 * the next layer (STATION DOCKING).
 *
 * Rendering modes mirror the other 3D sections: immersive VR through the
 * shared XR stage, or a flat 2D fallback with drag-to-look from the seat.
 */

import * as THREE from '../vendor/three.module.min.js';
import { runOrbitArrivalScript } from '../script/orbit-arrival-script.js';
import { wait } from '../util/wait.js';

export const id = 'orbit';

const SEAT = { pos: new THREE.Vector3(0, 0, 0.45), eyeHeight: 1.25 };

let S = null;

export function mount(root, ctx) {
  S = {
    ctx, root,
    xr: ctx.stage.active,
    stage: ctx.stage,
    disposed: false,
    tweens: new Set(),
    gazeWaiters: new Set(),
    look: { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 },
    clock: new THREE.Clock(),
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000104);
  S.scene = scene;
  S.world = buildOrbitScene(scene);

  if (S.xr) {
    S.renderer = ctx.stage.renderer;
    ctx.stage.rig.position.copy(SEAT.pos);
    ctx.stage.rig.rotation.set(0, 0, 0);
    S.camera = ctx.stage.camera;
    root.innerHTML = `
      <div class="loading-stack">
        <h1 class="loading-title">Orbit Arrival</h1>
        <p class="loading-phase">Experience running in headset …</p>
      </div>`;
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);
  S.renderer = renderer;

  const rig = new THREE.Group();
  rig.position.copy(SEAT.pos);
  const pitchObj = new THREE.Group();
  pitchObj.position.y = SEAT.eyeHeight;
  const camera = new THREE.PerspectiveCamera(72, root.clientWidth / root.clientHeight, 0.05, 200);
  pitchObj.add(camera);
  rig.add(pitchObj);
  scene.add(rig);
  S.rig = rig; S.pitchObj = pitchObj; S.camera = camera;

  root.insertAdjacentHTML('beforeend', `
    <div class="visor-frame"></div>
    <div class="deck-hud"><span class="hud-line" id="orbit-hud-line"></span></div>
  `);
  S.hudEl = root.querySelector('#orbit-hud-line');

  const el = renderer.domElement;
  S.onPointerDown = (e) => {
    S.look.dragging = true;
    S.look.lastX = e.clientX; S.look.lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  };
  S.onPointerUp = () => { S.look.dragging = false; };
  S.onPointerMove = (e) => {
    if (!S.look.dragging) return;
    S.look.yaw = THREE.MathUtils.clamp(S.look.yaw - (e.clientX - S.look.lastX) * 0.004, -1.3, 1.3);
    S.look.pitch = THREE.MathUtils.clamp(S.look.pitch - (e.clientY - S.look.lastY) * 0.004, -0.95, 0.7);
    S.look.lastX = e.clientX; S.look.lastY = e.clientY;
  };
  el.addEventListener('pointerdown', S.onPointerDown);
  el.addEventListener('pointerup', S.onPointerUp);
  el.addEventListener('pointermove', S.onPointerMove);

  S.onResize = () => {
    if (S.disposed) return;
    camera.aspect = root.clientWidth / root.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(root.clientWidth, root.clientHeight);
  };
  addEventListener('resize', S.onResize);
}

export async function start(ctx) {
  // Near-silence up here: the faintest cabin hum, comm murmurs on cue.
  ctx.audio.setLayerGain('background', 0.35, 1.5);
  ctx.audio.play('background.deckHum');

  if (S.xr) {
    ctx.stage.setScene(S.scene, (dt, t) => frameUpdate(dt, t));
  } else {
    S.renderer.setAnimationLoop(() => {
      if (!S || S.disposed) return;
      const dt = Math.min(S.clock.getDelta(), 0.05);
      frameUpdate(dt, S.clock.elapsedTime);
      S.renderer.render(S.scene, S.camera);
    });
  }

  await runOrbitArrivalScript(makeActors(ctx));
  await endExperience(ctx);
}

export function teardown() {
  if (!S) return;
  S.disposed = true;
  S.ctx.audio.stopAll(0.8);
  if (S.xr) {
    S.stage.setScene(null, null);
  } else {
    removeEventListener('resize', S.onResize);
    const el = S.renderer.domElement;
    el.removeEventListener('pointerdown', S.onPointerDown);
    el.removeEventListener('pointerup', S.onPointerUp);
    el.removeEventListener('pointermove', S.onPointerMove);
    S.renderer.setAnimationLoop(null);
    S.renderer.dispose();
  }
  S = null;
}

/* ====================================================================== */
/* SCENE — cupola cabin, nose-cone iris, Earth, stars, sun, zero-g props  */
/* ====================================================================== */

function buildOrbitScene(scene) {
  /* Cabin shell: a shortened version of the capsule around the seat, with
     a wide nose ring ahead where the cone irises open. */
  const cabin = new THREE.Group();
  scene.add(cabin);

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x141a24, roughness: 0.65, metalness: 0.4, side: THREE.BackSide,
  });
  // The shell leaves a forward gap (θ centered on -z) — the bulkhead
  // annulus covers the seam, so the nose ring truly opens onto space.
  const gap = 1.6;                                     // rad, forward opening
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.35, 2.6, 32, 1, true, Math.PI + gap / 2, Math.PI * 2 - gap),
    shellMat
  );
  shell.position.y = 1.3;
  cabin.add(shell);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 32),
    new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.7, metalness: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  cabin.add(floor);

  // Forward bulkhead with the nose ring cut ahead of the seat — centered
  // on eye level so the view through it owns the forward field.
  const ringR = 1.15;
  const bulkhead = new THREE.Mesh(
    new THREE.RingGeometry(ringR, 2.6, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a222e, roughness: 0.6, metalness: 0.45, side: THREE.DoubleSide })
  );
  bulkhead.position.set(0, 1.35, -1.5);
  cabin.add(bulkhead);
  const noseRim = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.07, 16, 48),
    new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.35, metalness: 0.7 })
  );
  noseRim.position.copy(bulkhead.position);
  cabin.add(noseRim);

  // Iris: a dark cone-cover disc that scales away when the nose opens.
  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(ringR - 0.02, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a212e, roughness: 0.5, metalness: 0.6 })
  );
  iris.position.set(0, 1.35, -1.51);
  cabin.add(iris);

  cabin.add(new THREE.AmbientLight(0x2c3850, 1.6));
  const cabinLight = new THREE.PointLight(0x9fb6d8, 4, 7, 1.6);
  cabinLight.position.set(0, 2.2, 0);
  cabin.add(cabinLight);
  const fill = new THREE.PointLight(0x8098bc, 2.2, 5, 1.6);
  fill.position.set(0, 0.9, -0.4);
  cabin.add(fill);

  /* Seat + suited legs + harness (same silhouette as the capsule). */
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x11161e, roughness: 0.7 });
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8edf4, roughness: 0.5 });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.6 });
  const seat = new THREE.Group();
  seat.position.copy(SEAT.pos);
  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), seatMat);
  pan.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.1), seatMat);
  back.position.set(0, 0.9, 0.26);
  back.rotation.x = 0.18;
  const legRest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.42), seatMat);
  legRest.position.set(0, 0.28, -0.4);
  legRest.rotation.x = 0.5;
  seat.add(pan, back, legRest);
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.4), suit);
    thigh.position.set(side * 0.12, 0.56, -0.2);
    thigh.rotation.x = 0.35;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.4), suit);
    shin.position.set(side * 0.12, 0.42, -0.55);
    shin.rotation.x = 0.7;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.16), suit);
    boot.position.set(side * 0.12, 0.28, -0.78);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.03), strapMat);
    strap.position.set(side * 0.11, 0.85, 0.02);
    strap.rotation.x = -0.06;
    strap.rotation.z = side * 0.3;
    seat.add(thigh, shin, boot, strap);
  }
  cabin.add(seat);

  /* Space outside the nose ring. */
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 40);
    pts.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfeafc, size: 0.9, sizeAttenuation: true })));

  // Earth: positioned so its limb fills the lower half of the view
  // through the nose ring. Slow self-rotation only (object motion —
  // comfort-safe); the user never moves.
  const earthTex = new THREE.CanvasTexture(earthCanvas());
  earthTex.generateMipmaps = false;
  earthTex.minFilter = THREE.LinearFilter;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 32),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1 })
  );
  earth.position.set(0, -26, -52);
  scene.add(earth);
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#7fb8ff'), transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  atmo.scale.setScalar(72);
  atmo.position.copy(earth.position);
  scene.add(atmo);
  // Sunlit side faces the capsule: light travels from high behind the
  // camera down onto the planet.
  const earthLight = new THREE.DirectionalLight(0xbcd6f2, 2.2);
  earthLight.position.set(6, 30, 30);
  scene.add(earthLight);

  // Sun: starts hidden behind the limb; the sunrise beat sweeps it up
  // across the view through the nose ring.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#fff3d8'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sun.scale.setScalar(20);
  sun.position.set(8, -18, -70);
  scene.add(sun);
  const sunLight = new THREE.DirectionalLight(0xfff0d0, 0);
  sunLight.position.copy(sun.position);
  scene.add(sunLight);

  /* Zero-g props on tethers: a checklist card and a glove. Released by
     the first beat; they drift on slow sine paths. */
  const props = [];
  const mkProp = (mesh, home) => {
    mesh.position.copy(home);
    cabin.add(mesh);
    props.push({ mesh, home, released: false, phase: Math.random() * Math.PI * 2 });
  };
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.22, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.8 })
  );
  mkProp(card, new THREE.Vector3(-0.45, 1.0, -0.35));
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.16), suit.clone());
  mkProp(glove, new THREE.Vector3(0.5, 0.9, -0.3));

  return { cabin, iris, earth, atmo, sun, sunLight, cabinLight, props, noseLightBoost: 0 };
}

/** Procedural Earth texture: ocean, noise-blob continents, cloud streaks. */
function earthCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#123a6b';
  g.fillRect(0, 0, 1024, 512);
  // continents
  g.fillStyle = '#2e6b3f';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 1024, y = 120 + Math.random() * 280;
    g.beginPath();
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      const r = 28 + Math.random() * 55;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62);
    }
    g.closePath(); g.fill();
  }
  // polar caps
  g.fillStyle = '#e8f2f8';
  g.fillRect(0, 0, 1024, 34);
  g.fillRect(0, 478, 1024, 34);
  // cloud streaks
  g.fillStyle = 'rgba(255,255,255,0.34)';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 1024, y = Math.random() * 512;
    g.beginPath();
    g.ellipse(x, y, 30 + Math.random() * 70, 5 + Math.random() * 9, Math.random(), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function glowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color + 'aa');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ====================================================================== */
/* Tweens, gaze zones, actors                                             */
/* ====================================================================== */

function tween(ms, update) {
  return new Promise((resolve) => {
    S.tweens.add({ t0: performance.now(), ms, update, resolve });
  });
}
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function stepTweens(now) {
  for (const tw of [...S.tweens]) {
    const t = Math.min(1, (now - tw.t0) / tw.ms);
    tw.update(easeInOut(t), t);
    if (t >= 1) { S.tweens.delete(tw); tw.resolve(); }
  }
}

const GAZE_ZONES = {
  earth:   { check: (p) => p < -0.12, pitch2d: -0.3 },
  forward: { check: (p) => Math.abs(p) < 0.22, pitch2d: 0 },
};

function stepGazeWaiters() {
  if (!S.gazeWaiters.size) return;
  const pitch = S.xr ? S.stage.lookPitch() : S.look.pitch;
  const now = performance.now();
  for (const w of [...S.gazeWaiters]) {
    if (w.check(pitch) || now > w.deadline) {
      S.gazeWaiters.delete(w);
      w.resolve();
    }
  }
}

function makeActors(ctx) {
  const W = S.world;
  const cfg = ctx.config.orbit;
  return {
    wait,

    hud: (text) => {
      if (S.xr) { S.stage.hud(text); return; }
      S.hudEl.textContent = text || '';
      S.hudEl.classList.toggle('is-visible', !!text);
    },

    lookAt: (zone, ms) => {
      const z = GAZE_ZONES[zone];
      if (S.xr) {
        return new Promise((resolve) => {
          S.gazeWaiters.add({ check: z.check, deadline: performance.now() + Math.max(ms * 3, 5000), resolve });
        });
      }
      const from = S.look.pitch;
      return tween(ms, (e) => { S.look.pitch = from + (z.pitch2d - from) * e; });
    },

    releaseProps: () => {
      ctx.audio.play('sfx.harnessClick', { position: { x: 0, y: 1.0, z: 0.4 } });
      for (const p of W.props) p.released = true;
    },

    openNoseCone: async () => {
      ctx.audio.play('sfx.noseCone', { position: { x: 0, y: 1.45, z: -1.4 } });
      await tween(cfg.noseOpenMs, (e) => {
        W.iris.scale.setScalar(Math.max(0.001, 1 - e));
        W.noseLightBoost = e;             // earthlight floods the cabin
      });
      W.iris.visible = false;
      if (S.xr) S.stage.pulseHaptics(0.3, 200);
    },

    sunrise: async () => {
      const from = W.sun.position.clone();
      const to = new THREE.Vector3(6, 6, -70);
      await tween(cfg.sunriseMs, (e) => {
        W.sun.position.lerpVectors(from, to, e);
        W.sunLight.position.copy(W.sun.position);
        W.sun.material.opacity = Math.min(1, e * 1.6);
        W.sunLight.intensity = e * 2.2;
        W.atmo.material.opacity = 0.55 + e * 0.3;
      });
      ctx.audio.play('sfx.orbitChime');
      if (S.xr) S.stage.pulseHaptics(0.25, 300);
    },

    float: () => wait(ctx.config.deckMode === 'movie' ? 5000 : cfg.floatMs),

    comm: (channel) => {
      // Quindar keying tone, then the (muffled) comm voice.
      const position = { x: 0, y: 2.0, z: -1.2 };
      ctx.audio.play('sfx.quindar', { position });
      ctx.audio.play(channel === 'station' ? 'voice.stationComm' : 'voice.groundControl',
        { position });
    },
  };
}

/* ====================================================================== */
/* Experience end — fade out, close the VR session, show the end card     */
/* ====================================================================== */

async function endExperience(ctx) {
  window.__gate05BoardingComplete = true;   // deliberate exit — don't reload
  if (S.xr) {
    await S.stage.fade(1, ctx.config.fadeMs + 300, 0x000000);
    await wait(400);
    await S.stage.endSession();
    S.stage.renderer.domElement.style.display = 'none';
  } else {
    const fader = document.getElementById('fader');
    fader.classList.remove('is-white');
    fader.classList.add('is-active');
    await wait(ctx.config.fadeMs + 300);
    S.renderer.domElement.style.display = 'none';
    fader.classList.remove('is-active');
  }
  showEndCard();
}

function showEndCard() {
  S.root.querySelector('.deck-hud')?.remove();
  S.root.querySelector('.visor-frame')?.remove();
  S.root.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;inset:0;display:grid;place-items:center;background:var(--acl-bg);">
      <div style="text-align:center;max-width:32rem;padding:1rem;">
        <p style="font-family:var(--acl-mono);letter-spacing:0.3em;color:var(--acl-cyan);margin:0 0 0.8rem;">AGENT CYBER LINES LTD.</p>
        <h1 style="margin:0 0 0.6rem;font-size:1.4rem;letter-spacing:0.12em;">ORBIT ARRIVAL COMPLETE</h1>
        <p style="color:var(--acl-muted);line-height:1.6;margin:0;">
          Flight ACL-0500 · orbit 402 km · rendezvous plotted.<br/>
          Next section — STATION DOCKING — is a future layer of this experience.
        </p>
      </div>
    </div>
  `);
}

/* ====================================================================== */
/* Per-frame update (shared by the XR stage loop and the 2D loop)         */
/* ====================================================================== */

function frameUpdate(dt, t) {
  if (!S || S.disposed) return;
  stepTweens(performance.now());
  stepGazeWaiters();

  if (!S.xr) {
    S.rig.rotation.y = S.look.yaw;
    S.pitchObj.rotation.x = S.look.pitch;
  }

  const W = S.world;
  W.earth.rotation.y = t * 0.008;           // slow planet turn
  W.cabinLight.intensity = 3 + W.noseLightBoost * 2.5;

  // Zero-g props: gentle tethered drift once released.
  for (const p of W.props) {
    if (!p.released) continue;
    p.mesh.position.set(
      p.home.x + Math.sin(t * 0.5 + p.phase) * 0.1,
      p.home.y + Math.sin(t * 0.35 + p.phase * 2) * 0.14 + 0.08,
      p.home.z + Math.cos(t * 0.42 + p.phase) * 0.09,
    );
    p.mesh.rotation.x = t * 0.3 + p.phase;
    p.mesh.rotation.y = t * 0.22 + p.phase;
  }

  // Feed the AUDIO LAYER the listener pose.
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  S.camera.getWorldPosition(camPos);
  S.camera.getWorldDirection(camDir);
  S.ctx.audio.setListenerPose(camPos, camDir);
}
