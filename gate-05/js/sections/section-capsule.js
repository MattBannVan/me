/**
 * SECTION 5 — Dragon Capsule Interior: strap-in + launch (VR GRAPHICS LAYER).
 *
 * The user arrives through the glowing port and is now STRAPPED INTO A SEAT
 * for the entire section — no locomotion at all, which is what makes this
 * the most comfortable, stable kind of VR content: the cabin is a static
 * visual anchor and all "motion" happens outside the window (sky → space)
 * and through audio + controller haptics.
 *
 * Sequence (js/script/capsule-flight-script.js): hatch seals behind you,
 * harness clicks home, displays boot, you press the glowing CONFIRM
 * button (controller trigger/touch in VR, click/Enter in 2D, auto after a
 * timeout so the flight never stalls), countdown, powered ascent with
 * engine rumble + cabin shake + haptic pulses, engine cutoff into orbit.
 *
 * Rendering modes mirror section-deck: immersive VR through the shared XR
 * stage, or a flat 2D fallback with drag-to-look from the seat.
 */

import * as THREE from '../vendor/three.module.min.js';
import { runCapsuleFlightScript } from '../script/capsule-flight-script.js';
import { wait } from '../util/wait.js';

export const id = 'capsule';

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
    shakeAmp: 0,
    confirm: { armed: false, resolve: null },
    clock: new THREE.Clock(),
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020409);
  S.scene = scene;

  S.cabin = buildCabin(scene);           // everything shakeable lives here

  if (S.xr) {
    S.renderer = ctx.stage.renderer;
    ctx.stage.rig.position.copy(SEAT.pos);
    ctx.stage.rig.rotation.set(0, 0, 0);   // facing -z = console + window
    S.camera = ctx.stage.camera;
    root.innerHTML = `
      <div class="loading-stack">
        <h1 class="loading-title">Dragon Crew Capsule</h1>
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
  const camera = new THREE.PerspectiveCamera(72, root.clientWidth / root.clientHeight, 0.05, 60);
  pitchObj.add(camera);
  rig.add(pitchObj);
  scene.add(rig);
  S.rig = rig; S.pitchObj = pitchObj; S.camera = camera;

  root.insertAdjacentHTML('beforeend', `
    <div class="visor-frame"></div>
    <div class="deck-hud"><span class="hud-line" id="capsule-hud-line"></span></div>
  `);
  S.hudEl = root.querySelector('#capsule-hud-line');

  // Seated free look (drag) — no movement keys in the capsule.
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
  // Cabin ambience: quiet hum only — the hatch seal, comms and rumble are
  // all scripted events on top.
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

  await runCapsuleFlightScript(makeActors(ctx));
  await endFlight(ctx);
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
/* CABIN — enclosed interior, console, displays, window, hatch, seats     */
/* ====================================================================== */

function panelTex(base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildCabin(scene) {
  const cabin = new THREE.Group();
  scene.add(cabin);

  const R = 1.5, H = 2.5;
  const wallTex = panelTex('#141a24', '#20293a');
  wallTex.repeat.set(6, 2);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.92, H, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.65, metalness: 0.4, side: THREE.BackSide })
  );
  wall.position.y = H / 2;
  cabin.add(wall);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.92, 32),
    new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.7, metalness: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  cabin.add(floor);

  const dome = new THREE.Mesh(
    new THREE.ConeGeometry(R, 0.9, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.8, side: THREE.BackSide })
  );
  dome.position.y = H + 0.45;
  cabin.add(dome);

  // Soft cabin lighting
  cabin.add(new THREE.AmbientLight(0x36415a, 1.5));
  const key = new THREE.PointLight(0xcfe2ff, 5, 6, 1.6);
  key.position.set(0, H - 0.3, 0);
  cabin.add(key);

  /* Console: tilted panel in front of the seat with three displays. */
  const console3d = new THREE.Group();
  console3d.position.set(0, 1.05, -1.05);
  console3d.rotation.x = -0.42;
  const consoleBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.55, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1a212e, roughness: 0.5, metalness: 0.5 })
  );
  console3d.add(consoleBody);
  cabin.add(console3d);

  const mkDisplay = (w, h, x, y) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = Math.round(512 * (h / w));
    const tex = new THREE.CanvasTexture(canvas);
    // These textures repaint constantly — mipmaps would go stale and
    // bleed the old image in at minified angles.
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, color: 0x222222 }) // dark until boot
    );
    mesh.position.set(x, y, 0.045);
    console3d.add(mesh);
    return { canvas, tex, mesh, on: false };
  };
  const displays = {
    telemetry: mkDisplay(0.42, 0.3, -0.5, 0.05),
    status:    mkDisplay(0.5, 0.36, 0, 0.06),
    checklist: mkDisplay(0.42, 0.3, 0.5, 0.05),
  };
  drawTelemetry(displays.telemetry, { alt: 0, vel: 0 });
  drawStatus(displays.status, 'STANDBY', '');
  drawChecklist(displays.checklist, 0);

  /* CONFIRM button on a pedestal within arm's reach of the seat. */
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.5, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x1a212e, roughness: 0.5, metalness: 0.5 })
  );
  pedestal.position.set(0.34, 0.75, -0.35);
  cabin.add(pedestal);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x24303f, emissive: 0x000000, roughness: 0.35,
  });
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 20), buttonMat);
  button.position.set(0.34, 1.015, -0.35);
  cabin.add(button);

  /* Window: porthole above the console, canvas-driven sky. */
  const winCanvas = document.createElement('canvas');
  winCanvas.width = winCanvas.height = 512;
  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.generateMipmaps = false;
  winTex.minFilter = THREE.LinearFilter;
  const windowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 40),
    new THREE.MeshBasicMaterial({ map: winTex })
  );
  windowDisc.position.set(0, 1.85, -1.38);
  windowDisc.rotation.x = 0.12;
  cabin.add(windowDisc);
  const windowRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.045, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.35, metalness: 0.7 })
  );
  windowRim.position.copy(windowDisc.position);
  windowRim.position.z -= 0.02;
  windowRim.rotation.copy(windowDisc.rotation);
  cabin.add(windowRim);
  const winState = { canvas: winCanvas, tex: winTex, stars: mkStars(90) };
  drawWindow(winState, 0);

  // Light spilling in from the window (dims as the sky darkens).
  const winLight = new THREE.PointLight(0xbcd8f0, 4, 5, 1.8);
  winLight.position.set(0, 1.8, -1.1);
  cabin.add(winLight);

  /* Hatch behind the seat — still glowing from the port; it iris-closes. */
  const hatch = new THREE.Group();
  hatch.position.set(0, 1.5, 1.42);
  hatch.rotation.y = Math.PI;
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  hatch.add(glowDisc);
  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a212e, roughness: 0.5, metalness: 0.6 })
  );
  iris.position.z = 0.01;
  iris.scale.setScalar(0.001);
  hatch.add(iris);
  const hatchRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.05, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.35, metalness: 0.7 })
  );
  hatch.add(hatchRim);
  cabin.add(hatch);
  const hatchLight = new THREE.PointLight(0xffffff, 8, 5, 1.8);
  hatchLight.position.set(0, 1.5, 1.1);
  cabin.add(hatchLight);

  /* Seats: the user's recliner (with suited legs + harness straps visible
     when looking down) and two empty companion seats. */
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x11161e, roughness: 0.7 });
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8edf4, roughness: 0.5 });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.6 });

  const mkSeat = (x, z, yaw) => {
    const seat = new THREE.Group();
    seat.position.set(x, 0, z);
    seat.rotation.y = yaw;
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), seatMat);
    pan.position.set(0, 0.45, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.1), seatMat);
    back.position.set(0, 0.9, 0.26);
    back.rotation.x = 0.18;
    const legRest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.42), seatMat);
    legRest.position.set(0, 0.28, -0.4);
    legRest.rotation.x = 0.5;
    seat.add(pan, back, legRest);
    return seat;
  };
  const userSeat = mkSeat(SEAT.pos.x, SEAT.pos.z, 0);
  cabin.add(userSeat, mkSeat(-0.85, 0.55, 0.35), mkSeat(0.85, 0.55, -0.35));

  // Suited legs + boots on the user's leg rest (the look-down payoff).
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.4), suit);
    thigh.position.set(side * 0.12, 0.56, -0.2);
    thigh.rotation.x = 0.35;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.4), suit);
    shin.position.set(side * 0.12, 0.42, -0.55);
    shin.rotation.x = 0.7;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.16), suit);
    boot.position.set(side * 0.12, 0.28, -0.78);
    userSeat.add(thigh, shin, boot);
  }
  // Harness straps over the chest — kept below eye level so they only
  // enter the view when the user looks down at their torso.
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.03), strapMat);
    strap.position.set(side * 0.11, 0.85, 0.02);
    strap.rotation.x = -0.06;
    strap.rotation.z = side * 0.3;
    userSeat.add(strap);
  }

  return {
    group: cabin, displays, button, buttonMat, winState, winLight,
    hatch: { glowDisc, iris, light: hatchLight },
  };
}

/* ---------------------- display canvas painters ----------------------- */

function screenBase(g, w, h) {
  g.fillStyle = '#060b12';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1c3550';
  g.lineWidth = 4;
  g.strokeRect(4, 4, w - 8, h - 8);
}

function drawTelemetry(d, { alt, vel }) {
  const g = d.canvas.getContext('2d');
  const { width: w, height: h } = d.canvas;
  screenBase(g, w, h);
  g.fillStyle = '#4fd8ff';
  g.font = '600 34px monospace';
  g.fillText('TELEMETRY', 28, 56);
  g.fillStyle = '#9fe8ff';
  g.font = '30px monospace';
  g.fillText(`ALT ${String(Math.round(alt)).padStart(6, ' ')} m`, 28, 130);
  g.fillText(`VEL ${String(Math.round(vel)).padStart(6, ' ')} m/s`, 28, 190);
  g.fillStyle = '#55e6a5';
  g.font = '26px monospace';
  g.fillText('CABIN 101.3 kPa', 28, 260);
  d.tex.needsUpdate = true;
}

function drawStatus(d, big, small) {
  const g = d.canvas.getContext('2d');
  const { width: w, height: h } = d.canvas;
  screenBase(g, w, h);
  g.textAlign = 'center';
  g.fillStyle = '#4fd8ff';
  g.font = '600 30px monospace';
  g.fillText('ACL-0500 · DRAGON', w / 2, 60);
  g.fillStyle = '#e8f1ff';
  g.font = '700 110px monospace';
  g.fillText(big, w / 2, h / 2 + 40);
  g.fillStyle = '#8ea3c4';
  g.font = '28px monospace';
  g.fillText(small, w / 2, h - 44);
  g.textAlign = 'left';
  d.tex.needsUpdate = true;
}

function drawChecklist(d, done) {
  const items = ['HATCH SEAL', 'HARNESS', 'FLIGHT SYS', 'CREW CONFIRM', 'IGNITION'];
  const g = d.canvas.getContext('2d');
  const { width: w, height: h } = d.canvas;
  screenBase(g, w, h);
  g.fillStyle = '#4fd8ff';
  g.font = '600 34px monospace';
  g.fillText('PRE-FLIGHT', 28, 56);
  g.font = '28px monospace';
  items.forEach((label, i) => {
    const y = 110 + i * 48;
    g.fillStyle = i < done ? '#55e6a5' : '#54627d';
    g.fillText(`${i < done ? '■' : '□'} ${label}`, 28, y);
  });
  d.tex.needsUpdate = true;
}

/* ------------------------- window sky painter ------------------------- */

function mkStars(n) {
  const stars = [];
  for (let i = 0; i < n; i++) {
    stars.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.4 });
  }
  return stars;
}

/** t01: 0 = daylight on the pad, 1 = orbital black with stars + Earth limb. */
function drawWindow(win, t01) {
  const g = win.canvas.getContext('2d');
  const s = win.canvas.width;
  const lerp = (a, b) => Math.round(a + (b - a) * t01);
  const top = `rgb(${lerp(110, 1)},${lerp(160, 2)},${lerp(215, 8)})`;
  const bottom = `rgb(${lerp(150, 4)},${lerp(190, 8)},${lerp(230, 18)})`;
  const grad = g.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);

  // Stars fade in once the sky is dark enough.
  const starAlpha = Math.max(0, (t01 - 0.55) / 0.45);
  if (starAlpha > 0) {
    g.fillStyle = `rgba(235,243,255,${0.9 * starAlpha})`;
    for (const st of win.stars) {
      g.beginPath();
      g.arc(st.x * s, st.y * s, st.r, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Earth limb rising into the bottom of the window near orbit.
  if (t01 > 0.8) {
    const a = (t01 - 0.8) / 0.2;
    const cy = s + s * (1.15 - 0.45 * a);
    g.fillStyle = `rgba(70,130,190,${0.95 * a})`;
    g.beginPath(); g.arc(s / 2, cy, s * 1.05, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(190,225,255,${0.8 * a})`;
    g.lineWidth = 6;
    g.beginPath(); g.arc(s / 2, cy, s * 1.05, 0, Math.PI * 2); g.stroke();
  }
  win.tex.needsUpdate = true;
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
  down:    { check: (p) => p < -0.5,            pitch2d: -0.85 },
  display: { check: (p) => p < -0.15,           pitch2d: -0.35 },
  window:  { check: (p) => p > 0.15,            pitch2d: 0.32 },
  forward: { check: (p) => Math.abs(p) < 0.22,  pitch2d: 0 },
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
  const cab = S.cabin;
  const cfg = ctx.config.capsule;
  return {
    wait,

    hud: (text) => {
      if (S.xr) { S.stage.hud(text); return; }
      S.hudEl.textContent = text || '';
      S.hudEl.classList.toggle('is-visible', !!text);
    },

    /** VR: gaze prompt with generous timeout. 2D: scripted camera tween. */
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

    sealHatch: async (ms) => {
      ctx.audio.play('sfx.hatchSeal', { position: { x: 0, y: 1.5, z: 1.3 } });
      const { iris, glowDisc, light } = cab.hatch;
      await tween(ms, (e) => {
        iris.scale.setScalar(Math.max(0.001, e));
        glowDisc.material.color.setScalar(1 - e * 0.9);
        light.intensity = 8 * (1 - e);
      });
    },

    harness: () => {
      ctx.audio.play('sfx.harnessClick', { position: { x: 0, y: 1.0, z: 0.4 } });
      drawChecklist(cab.displays.checklist, 2);
    },

    bootDisplays: async (ms) => {
      const list = [cab.displays.telemetry, cab.displays.status, cab.displays.checklist];
      for (const d of list) {
        await wait(ms / list.length);
        d.mesh.material.color.set(0xffffff);   // un-dim: screen is now lit
        d.on = true;
        ctx.audio.play('sfx.uiConfirm');
      }
      drawChecklist(cab.displays.checklist, 3);
      drawStatus(cab.displays.status, 'READY', 'AWAITING CREW CONFIRM');
    },

    /** Glow the button; resolve on press (VR trigger/touch, 2D click/Enter),
        or automatically after the config timeout so the flight never stalls. */
    armConfirmButton: () => new Promise((resolve) => {
      S.confirm.armed = true;
      const finish = () => {
        if (!S.confirm.armed) return;
        S.confirm.armed = false;
        S.confirm.resolve = null;
        cab.buttonMat.emissive.set(0x2a5c30);
        cab.buttonMat.color.set(0x3f7a4a);
        ctx.audio.play('sfx.uiConfirm');
        if (S.xr) S.stage.pulseHaptics(0.5, 120);
        drawChecklist(cab.displays.checklist, 4);
        cleanup();
        resolve();
      };
      S.confirm.resolve = finish;

      let cleanup = () => {};
      if (!S.xr) {
        const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') finish(); };
        const onClick = () => finish();
        addEventListener('keydown', onKey);
        S.renderer.domElement.addEventListener('pointerdown', onClick);
        cleanup = () => {
          removeEventListener('keydown', onKey);
          S.renderer.domElement.removeEventListener('pointerdown', onClick);
        };
      }
      const timeoutMs = ctx.config.deckMode === 'movie' ? 1600 : cfg.confirmTimeoutMs;
      wait(timeoutMs).then(() => { if (S && !S.disposed) finish(); });
    }),

    countdown: async () => {
      for (let n = cfg.countdownFrom; n >= 1; n--) {
        drawStatus(cab.displays.status, `T-${n}`, 'IGNITION SEQUENCE');
        ctx.audio.play('sfx.uiConfirm');
        await wait(1000);
      }
      drawStatus(cab.displays.status, 'LIFTOFF', '');
    },

    ascend: async () => {
      ctx.audio.play('background.engineRumble');
      if (S.xr) {
        // Haptic pulses ride the rumble for as long as the burn lasts.
        S.hapticInterval = setInterval(() => S.stage?.pulseHaptics(0.45, 320), 420);
      }
      const ms = cfg.ascentMs;
      await tween(ms, (e, raw) => {
        // Shake ramps in, holds through max-Q, eases toward cutoff.
        S.shakeAmp = Math.sin(Math.min(raw * 3, 1) * Math.PI / 2) * (1 - raw * 0.55) * 0.006;
        drawWindow(cab.winState, e);
        cab.winLight.intensity = 4 * (1 - e * 0.85);
        const alt = 200000 * e * e;
        const vel = 7600 * e;
        drawTelemetry(cab.displays.telemetry, { alt, vel });
        if (Math.random() < 0.05) drawStatus(cab.displays.status, 'ASCENT', `THROTTLE ${Math.round(96 - raw * 12)}%`);
      });
    },

    engineCutoff: async () => {
      clearInterval(S.hapticInterval);
      ctx.audio.stop('background.engineRumble', 1.6);
      await tween(1400, (e) => { S.shakeAmp = 0.006 * (1 - e) * 0.45; });
      S.shakeAmp = 0;
      cab.group.position.set(0, 0, 0);
      drawWindow(cab.winState, 1);
      drawStatus(cab.displays.status, 'ORBIT', 'MECO CONFIRMED');
      drawChecklist(cab.displays.checklist, 5);
      ctx.audio.play('sfx.orbitChime');
      if (S.xr) S.stage.pulseHaptics(0.3, 500);
    },

    comm: () => {
      // Ground control over the cabin speaker — up by the console.
      ctx.audio.play('voice.groundControl', { position: { x: 0, y: 2.0, z: -1.2 } });
    },
  };
}

/* ====================================================================== */
/* Flight end — fade out, close the VR session, show the end card         */
/* ====================================================================== */

async function endFlight(ctx) {
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
        <h1 style="margin:0 0 0.6rem;font-size:1.4rem;letter-spacing:0.12em;">WELCOME TO ORBIT</h1>
        <p style="color:var(--acl-muted);line-height:1.6;margin:0;">
          Main engine cutoff confirmed — flight ACL-0500 complete.<br/>
          Next section — ORBIT ARRIVAL — is a future layer of this experience.
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

  // Launch shake: jitter the CABIN (never the camera) — the user's head
  // stays the stable reference, which is what keeps this comfortable.
  const cab = S.cabin;
  if (S.shakeAmp > 0) {
    cab.group.position.set(
      (Math.random() - 0.5) * S.shakeAmp * 2,
      (Math.random() - 0.5) * S.shakeAmp,
      (Math.random() - 0.5) * S.shakeAmp * 2,
    );
  }

  // Armed CONFIRM button: pulse its glow and, in VR, resolve on a
  // controller touch or any squeezed trigger/grip button.
  if (S.confirm.armed) {
    const pulse = (Math.sin(t * 6) + 1) / 2;
    cab.buttonMat.emissive.setRGB(0.1 + 0.5 * pulse, 0.35 + 0.45 * pulse, 0.5 + 0.5 * pulse);
    if (S.xr) {
      const btnPos = new THREE.Vector3();
      cab.button.getWorldPosition(btnPos);
      const gp = new THREE.Vector3();
      let pressed = false;
      for (const grip of S.stage.controllerGrips) {
        grip.getWorldPosition(gp);
        if (gp.distanceTo(btnPos) < 0.16) pressed = true;
      }
      for (const src of S.stage.session?.inputSources ?? []) {
        if (src.gamepad?.buttons?.some((b) => b.pressed)) pressed = true;
      }
      if (pressed) S.confirm.resolve?.();
    }
  }

  // Feed the AUDIO LAYER the listener pose.
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  S.camera.getWorldPosition(camPos);
  S.camera.getWorldDirection(camDir);
  S.ctx.audio.setListenerPose(camPos, camDir);
}
