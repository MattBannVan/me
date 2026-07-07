/**
 * SECTION 4 — SpaceX Onboarding Deck (VR GRAPHICS LAYER).
 *
 * Three.js interior: the user stands suited (visor open) on the onboarding
 * deck at the port to the Dragon crew capsule. The port glows bright white.
 * Two specialists in black uniforms flank it, their body language urging
 * the user to enter.
 *
 * Rendering modes:
 *  - IMMERSIVE VR (ctx.stage.active): renders through the shared XR stage
 *    into the headset. The intro script runs gaze-guided (see
 *    user-action-script.js), gloves ride the tracked controllers, and
 *    locomotion is left-stick smooth move + right-stick snap turn.
 *  - FLAT 2D fallback: own renderer/canvas, scripted camera intro, then
 *    WASD/drag controls.
 *
 * Independently, CONFIG.deckMode selects:
 *  - 'open-world' : after the scripted intro the user receives control
 *                   (signalled by a brief haptic vibration) and must
 *                   eventually enter the capsule port.
 *  - 'movie'      : fully scripted — the rig walks itself into the port.
 *
 * Control of the user's body during the intro lives in
 * js/script/user-action-script.js (SCRIPT LAYER).
 * Sound routing lives in js/audio/audio-engine.js (AUDIO LAYER) — this
 * section only asks for sounds by name and feeds the listener pose.
 */

import * as THREE from '../vendor/three.module.min.js';
import { runUserActionScript } from '../script/user-action-script.js';

export const id = 'deck';

/* Deck layout constants (metres) */
const DECK = {
  width: 6, depth: 13, height: 3.4,
  backZ: -8,                     // wall holding the capsule port
  portPos: new THREE.Vector3(0, 1.55, -7.9),
  boundsX: 2.35, boundsZ: { min: -7.0, max: 3.4 },
};

let S = null; // section state

export function mount(root, ctx) {
  S = {
    ctx, root,
    xr: ctx.stage.active,
    stage: ctx.stage,
    disposed: false,
    tweens: new Set(),
    gazeWaiters: new Set(),
    controlGranted: false,
    boarding: false,
    keys: new Set(),
    look: { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 },
    murmurTimer: null,
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x04060a, 8, 22);
  buildDeckInterior(scene);
  S.port = buildCapsulePort(scene);
  S.specialists = [
    buildSpecialist(scene, new THREE.Vector3(-1.35, 0, -6.4), 0.45),
    buildSpecialist(scene, new THREE.Vector3(1.35, 0, -6.4), -0.45),
  ];
  S.scene = scene;
  S.clock = new THREE.Clock();

  if (S.xr) {
    // Shared XR renderer — the headset shows the scene; the flat screen
    // mirrors it. Just leave a note in the DOM.
    S.renderer = ctx.stage.renderer;
    S.player = buildPlayerRigXR(scene, ctx.stage);
    root.innerHTML = `
      <div class="loading-stack">
        <h1 class="loading-title">Onboarding Deck</h1>
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
  S.player = buildPlayerRig(scene);

  // HUD + visor frame overlays (2D only — in VR the stage HUD is used and
  // the visor is your actual headset).
  root.insertAdjacentHTML('beforeend', `
    <div class="visor-frame"></div>
    <div class="deck-hud"><span class="hud-line" id="deck-hud-line"></span></div>
  `);
  S.hudEl = root.querySelector('#deck-hud-line');

  S.onResize = () => {
    if (S.disposed) return;
    S.player.camera.aspect = root.clientWidth / root.clientHeight;
    S.player.camera.updateProjectionMatrix();
    renderer.setSize(root.clientWidth, root.clientHeight);
  };
  addEventListener('resize', S.onResize);
}

export async function start(ctx) {
  startAmbientAudio(ctx);

  if (S.xr) {
    ctx.stage.setScene(S.scene, (dt, t) => frameUpdate(dt, t));
  } else {
    S.renderer.setAnimationLoop(() => {
      if (!S || S.disposed) return;
      const dt = Math.min(S.clock.getDelta(), 0.05);
      frameUpdate(dt, S.clock.elapsedTime);
      S.renderer.render(S.scene, S.player.camera);
    });
  }

  const actors = makeActors(ctx);
  await runUserActionScript(actors, S.xr ? 'xr' : 'screen');

  if (ctx.config.deckMode === 'movie') {
    await playMovieEnding(ctx);
  } else {
    grantControl(ctx);
  }
}

export function teardown() {
  if (!S) return;
  S.disposed = true;
  clearTimeout(S.murmurTimer);
  S.ctx.audio.stopAll(0.8);
  if (S.xr) {
    S.stage.setScene(null, null);
  } else {
    removeEventListener('resize', S.onResize);
    removeInputListeners();
    S.renderer.setAnimationLoop(null);
    S.renderer.dispose();
  }
  S = null;
}

/* ====================================================================== */
/* ENVIRONMENT — deck interior                                            */
/* ====================================================================== */

function panelTexture(base, line, size = 256, grid = 4) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = line;
  g.lineWidth = 2;
  const step = size / grid;
  for (let i = 0; i <= grid; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildDeckInterior(scene) {
  const { width, depth, height, backZ } = DECK;
  const centerZ = backZ + depth / 2;

  const floorTex = panelTexture('#11161f', '#1f2c3d', 256, 4);
  floorTex.repeat.set(width / 1.5, depth / 1.5);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.55 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = centerZ;
  scene.add(floor);

  const wallTex = panelTexture('#161c27', '#232f42', 256, 3);
  wallTex.repeat.set(depth / 2.2, height / 2.2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.35 });

  const mkWall = (w, h, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  };
  mkWall(depth, height, new THREE.Vector3(-width / 2, height / 2, centerZ), Math.PI / 2);
  mkWall(depth, height, new THREE.Vector3(width / 2, height / 2, centerZ), -Math.PI / 2);
  mkWall(width, height, new THREE.Vector3(0, height / 2, backZ), 0);       // port wall
  mkWall(width, height, new THREE.Vector3(0, height / 2, backZ + depth), Math.PI);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.85 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, height, centerZ);
  scene.add(ceil);

  // Ceiling light strips + cool downlights
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xdff2ff });
  for (let z = backZ + 1.5; z < backZ + depth; z += 2.4) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.12), stripMat);
    strip.position.set(0, height - 0.03, z);
    scene.add(strip);
    const light = new THREE.PointLight(0xcfe2ff, 6, 7, 1.6);
    light.position.set(0, height - 0.4, z);
    scene.add(light);
  }
  scene.add(new THREE.AmbientLight(0x2a3548, 1.2));

  // Wall conduits + valve boxes (the pressure-relief hardware you hear)
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.4, metalness: 0.8 });
  for (const side of [-1, 1]) {
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, depth - 0.5), conduitMat);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(side * (width / 2 - 0.12), 2.6, centerZ);
    scene.add(conduit);

    const valve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.22), conduitMat);
    valve.position.set(side * (width / 2 - 0.18), 2.2, -4.2);
    scene.add(valve);
  }

  // Wordmark panel on the side wall
  const brand = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.5),
    new THREE.MeshBasicMaterial({ map: textTexture('ONBOARDING DECK 05', '#9fb4d4'), transparent: true })
  );
  brand.position.set(-DECK.width / 2 + 0.02, 2.45, -3.5);
  brand.rotation.y = Math.PI / 2;
  scene.add(brand);
}

function textTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = '600 62px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.letterSpacing = '16px';
  g.fillText(text, 512, 84);
  return new THREE.CanvasTexture(c);
}

/* ====================================================================== */
/* Dragon capsule entry port — bright, glowing white light                */
/* ====================================================================== */

function buildCapsulePort(scene) {
  const group = new THREE.Group();
  group.position.copy(DECK.portPos);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.12, 24, 64),
    new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.3, metalness: 0.7, emissive: 0x445566 })
  );
  group.add(ring);

  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.88, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  glowDisc.position.z = 0.02;
  group.add(glowDisc);

  // Additive halo sprites for the bloom-like white glow
  const haloTex = radialGlowTexture();
  for (const [scale, opacity] of [[3.4, 0.55], [5.2, 0.28]]) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, color: 0xffffff, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(scale);
    halo.position.z = 0.08;
    group.add(halo);
  }

  const light = new THREE.PointLight(0xffffff, 26, 12, 1.7);
  light.position.z = 0.6;
  group.add(light);

  // Gentle breathing of the glow
  group.userData.update = (t) => {
    const pulse = 1 + Math.sin(t * 1.6) * 0.08;
    light.intensity = 26 * pulse;
    group.children
      .filter((c) => c.isSprite)
      .forEach((halo, i) => { halo.material.opacity = (i === 0 ? 0.55 : 0.28) * pulse; });
  };

  scene.add(group);
  return group;
}

function radialGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(235,245,255,0.5)');
  grad.addColorStop(1, 'rgba(235,245,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ====================================================================== */
/* Specialists — black uniforms, body language pointing at the port       */
/* ====================================================================== */

function buildSpecialist(scene, position, faceYaw) {
  const uniform = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.75 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1c2129, roughness: 0.5, metalness: 0.4 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.15, metalness: 0.9 });

  const g = new THREE.Group();
  g.position.copy(position);
  g.rotation.y = faceYaw;

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.82, 0.2), uniform);
  legs.position.y = 0.41;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), uniform);
  torso.position.y = 1.12;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.27), trim);
  chest.position.y = 1.3;
  const head = new THREE.Group();
  head.position.y = 1.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), uniform);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16, -0.6, 1.2, 1.1, 0.9), visor);
  head.add(helmet, face);

  // Idle arm hangs on the outer side; the inner arm sweeps back toward
  // the port — "after you" body language urging the user to enter.
  const inner = position.x < 0 ? 1 : -1;
  const idleArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.13), uniform);
  idleArm.position.set(-inner * 0.3, 1.12, 0);

  const gestureArm = new THREE.Group();
  gestureArm.position.set(inner * 0.3, 1.38, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), uniform);
  upper.position.y = -0.22;
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.15), trim);
  glove.position.y = -0.5;
  gestureArm.add(upper, glove);

  g.add(legs, torso, chest, head, idleArm, gestureArm);
  scene.add(g);

  const sp = {
    group: g, head, gestureArm,
    voicePos: g.position.clone().setY(1.62),
    nodOffset: 0,
    update(t) {
      // Subtle sway + a repeating open-palm sweep toward the port:
      // arm raised toward center, angled back — "after you".
      g.position.y = Math.sin(t * 0.9 + position.x) * 0.012;
      const sweep = (Math.sin(t * 1.1) + 1) / 2;               // 0..1
      gestureArm.rotation.z = inner * (0.55 + sweep * 0.3);    // raised toward center
      gestureArm.rotation.x = 0.5 + sweep * 0.35;              // angled back at the port
      head.rotation.x = this.nodOffset;
      head.rotation.y = Math.sin(t * 0.5 + position.x * 2) * 0.12;
    },
  };
  return sp;
}

/* ====================================================================== */
/* Player rig — suited user: camera, gloved hands, boots                  */
/* ====================================================================== */

const suitMat = () => new THREE.MeshStandardMaterial({ color: 0xe8edf4, roughness: 0.5 });
const sealMat = () => new THREE.MeshStandardMaterial({ color: 0x30455f, roughness: 0.4, metalness: 0.5 });

function mkHand(side, suit, seal) {
  const wrist = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.11), suit);
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.026, 0.06), suit);
  fingers.position.set(0, 0, -0.08);
  fingers.rotation.x = -0.25;
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.055), suit);
  thumb.position.set(side * 0.055, 0, -0.02);
  thumb.rotation.y = side * 0.5;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.09, 14), seal);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.09;
  wrist.add(palm, fingers, thumb, cuff);
  return wrist;
}

function mkBoot(side, suit, seal) {
  const boot = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.3), suit);
  foot.position.y = 0.065;
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.8 });
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.32), soleMat);
  sole.position.y = 0.015;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 14), seal);
  cuff.position.set(0, 0.17, 0.06);
  boot.add(foot, sole, cuff);
  boot.position.set(side * 0.15, 0, -0.16);
  return boot;
}

function buildPlayerRig(scene) {
  const rig = new THREE.Group();          // body position + yaw
  rig.position.set(0, 0, 2.6);
  const pitchObj = new THREE.Group();     // head pitch
  pitchObj.position.y = 1.68;
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 60);
  pitchObj.add(camera);
  rig.add(pitchObj);
  scene.add(rig);

  const suit = suitMat();
  const seal = sealMat();

  const handL = mkHand(-1, suit, seal);
  const handR = mkHand(1, suit, seal);
  handL.position.set(-0.21, -0.78, -0.48);   // lowered / out of view
  handR.position.set(0.21, -0.78, -0.48);
  handL.rotation.x = handR.rotation.x = -0.6;
  pitchObj.add(handL, handR);

  const bootL = mkBoot(-1, suit, seal);
  const bootR = mkBoot(1, suit, seal);
  rig.add(bootL, bootR);

  return {
    rig, pitchObj, camera,
    hands: { left: handL, right: handR, raised: 0 },
    boots: { left: bootL, right: bootR },
    handsHome: { y: -0.78, raisedY: -0.26 },
  };
}

/**
 * VR player rig: the shared stage rig is placed on the deck; suit gloves
 * ride the tracked controller grips (index 0/1 handedness varies — the
 * glove shape is symmetric enough at this scale) and boots sit at the
 * rig's floor.
 */
function buildPlayerRigXR(scene, stage) {
  stage.rig.position.set(0, 0, 2.6);
  stage.rig.rotation.set(0, 0, 0);        // facing -z = the capsule port

  const suit = suitMat();
  const seal = sealMat();

  const gloves = [];
  stage.controllerGrips.forEach((grip, i) => {
    const glove = mkHand(i === 0 ? -1 : 1, suit, seal);
    glove.rotation.x = -Math.PI / 3;       // align palm with grip pose
    grip.add(glove);
    gloves.push(glove);
  });

  const bootL = mkBoot(-1, suit, seal);
  const bootR = mkBoot(1, suit, seal);
  stage.rig.add(bootL, bootR);

  return {
    rig: stage.rig,
    camera: stage.camera,
    hands: { left: gloves[0], right: gloves[1], raised: 1 },
    boots: { left: bootL, right: bootR },
    handsHome: { y: 0, raisedY: 0 },
  };
}

/* ====================================================================== */
/* Tweens + actor implementations for the SCRIPT LAYER                    */
/* ====================================================================== */

function tween(ms, update) {
  return new Promise((resolve) => {
    const entry = { t0: performance.now(), ms, update, resolve };
    S.tweens.add(entry);
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

const GAZE_ZONES = {
  'down':       (pitch) => pitch < -0.5,
  'down-steep': (pitch) => pitch < -0.85,
  'forward':    (pitch) => pitch > -0.2,
};

function makeActors(ctx) {
  const p = S.player;
  return {
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    hud: (text) => {
      if (S.xr) { S.stage.hud(text); return; }
      S.hudEl.textContent = text || '';
      S.hudEl.classList.toggle('is-visible', !!text);
    },
    /** VR: resolve when the headset actually looks at the zone (or timeout). */
    waitForLook: (zone, timeoutMs = 9000) =>
      new Promise((resolve) => {
        S.gazeWaiters.add({ check: GAZE_ZONES[zone], deadline: performance.now() + timeoutMs, resolve });
      }),
    pitchTo: (rad, ms) => {
      const from = S.look.pitch;
      return tween(ms, (e) => { S.look.pitch = from + (rad - from) * e; });
    },
    yawTo: (rad, ms) => {
      const from = S.look.yaw;
      return tween(ms, (e) => { S.look.yaw = from + (rad - from) * e; });
    },
    raiseHands: (target, ms) => {
      const from = p.hands.raised;
      return tween(ms, (e) => {
        p.hands.raised = from + (target - from) * e;
        const y = p.handsHome.y + (p.handsHome.raisedY - p.handsHome.y) * p.hands.raised;
        p.hands.left.position.y = y;
        p.hands.right.position.y = y;
        p.hands.left.rotation.x = -0.6 + p.hands.raised * 0.8;
        p.hands.right.rotation.x = -0.6 + p.hands.raised * 0.8;
      });
    },
    waveHands: (ms) =>
      tween(ms, (_, tRaw) => {
        const s = Math.sin(tRaw * Math.PI * 4);
        p.hands.left.rotation.z = s * 0.55;
        p.hands.right.rotation.z = -s * 0.55;
        p.hands.left.rotation.y = s * 0.3;
        p.hands.right.rotation.y = -s * 0.3;
        p.hands.left.position.x = -0.21 - s * 0.03;
        p.hands.right.position.x = 0.21 + s * 0.03;
      }),
    tapLeftBoot: async (ms) => {
      const boot = p.boots.left;
      const wp = new THREE.Vector3();
      boot.getWorldPosition(wp);
      await tween(ms * 0.45, (e) => { boot.position.y = 0.14 * e; boot.rotation.x = -0.3 * e; });
      ctx.audio.play('sfx.bootTap', { position: wp });
      await tween(ms * 0.25, (e) => { boot.position.y = 0.14 * (1 - e); boot.rotation.x = -0.3 * (1 - e); });
    },
    // In VR we never rotate the user's head — the greeting nod is theirs
    // to perform, so the beat just leaves them a moment for it.
    nod: (ms) => S.xr
      ? new Promise((r) => setTimeout(r, ms))
      : tween(ms, (_, tRaw) => {
          S.nodPitch = Math.sin(tRaw * Math.PI) * -0.22;
        }).then(() => { S.nodPitch = 0; }),
    specialistsNod: (ms) =>
      tween(ms, (_, tRaw) => {
        const v = Math.sin(tRaw * Math.PI) * 0.3;
        for (const sp of S.specialists) sp.nodOffset = v;
      }).then(() => { for (const sp of S.specialists) sp.nodOffset = 0; }),
    specialistMurmur: (which) => {
      const sp = which === 'left' ? S.specialists[0] : S.specialists[1];
      ctx.audio.play('voice.specialistMurmur', { position: sp.voicePos });
    },
  };
}

/* ====================================================================== */
/* AUDIO for this section — kept faint by design: pressure-relief valves  */
/* + dull muffled specialist tones. Extend via CONFIG.audio.              */
/* ====================================================================== */

function startAmbientAudio(ctx) {
  ctx.audio.setLayerGain('background', 0.9, 0.1);
  ctx.audio.play('background.deckHum');
  // Valves are physically on the side walls — spatialize them there.
  ctx.audio.play('background.pressureValves', { position: { x: 2.8, y: 2.2, z: -4.2 } });

  // Occasional muffled chatter between the specialists.
  const murmurLoop = () => {
    if (!S || S.disposed || S.boarding) return;
    const sp = S.specialists[Math.random() < 0.5 ? 0 : 1];
    ctx.audio.play('voice.specialistMurmur', { position: sp.voicePos });
    S.murmurTimer = setTimeout(murmurLoop, 6000 + Math.random() * 8000);
  };
  S.murmurTimer = setTimeout(murmurLoop, 9000);
}

/* ====================================================================== */
/* Control hand-off, input, movement, boarding                            */
/* ====================================================================== */

function grantControl(ctx) {
  S.controlGranted = true;
  ctx.audio.play('sfx.hapticCue');
  if (S.xr) {
    // The brief vibration that signals control is granted — through the
    // actual VR controllers.
    S.stage.pulseHaptics(0.7, 250);
  } else {
    pulseHaptics(ctx.config.deck.hapticPatternMs);
    addInputListeners();
  }
  setTimeout(() => {
    if (!S || S.boarding) return;
    if (S.xr) S.stage.hud('');
    else S.hudEl?.classList.remove('is-visible');
  }, 5000);
}

function pulseHaptics(pattern) {
  // Phone/handset vibration where supported…
  navigator.vibrate?.(pattern);
  // …and any connected gamepad actuators.
  for (const pad of navigator.getGamepads?.() ?? []) {
    pad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration: pattern.reduce((a, b) => a + b, 0),
      strongMagnitude: 0.6, weakMagnitude: 0.4,
    });
  }
}

function addInputListeners() {
  const el = S.renderer.domElement;
  S.onKeyDown = (e) => S.keys.add(e.code);
  S.onKeyUp = (e) => S.keys.delete(e.code);
  S.onPointerDown = (e) => {
    S.look.dragging = true;
    S.look.lastX = e.clientX; S.look.lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  };
  S.onPointerUp = () => { S.look.dragging = false; };
  S.onPointerMove = (e) => {
    if (!S.look.dragging) return;
    S.look.yaw -= (e.clientX - S.look.lastX) * 0.004;
    S.look.pitch -= (e.clientY - S.look.lastY) * 0.004;
    S.look.pitch = Math.max(-1.35, Math.min(1.1, S.look.pitch));
    S.look.lastX = e.clientX; S.look.lastY = e.clientY;
  };
  addEventListener('keydown', S.onKeyDown);
  addEventListener('keyup', S.onKeyUp);
  el.addEventListener('pointerdown', S.onPointerDown);
  el.addEventListener('pointerup', S.onPointerUp);
  el.addEventListener('pointermove', S.onPointerMove);
}

function removeInputListeners() {
  if (!S?.onKeyDown) return;
  removeEventListener('keydown', S.onKeyDown);
  removeEventListener('keyup', S.onKeyUp);
  const el = S.renderer.domElement;
  el.removeEventListener('pointerdown', S.onPointerDown);
  el.removeEventListener('pointerup', S.onPointerUp);
  el.removeEventListener('pointermove', S.onPointerMove);
}

const clampToDeck = (rig) => {
  rig.position.x = Math.max(-DECK.boundsX, Math.min(DECK.boundsX, rig.position.x));
  rig.position.z = Math.max(DECK.boundsZ.min, Math.min(DECK.boundsZ.max, rig.position.z));
};

function stepMovement(dt, ctx) {
  if (!S.controlGranted || S.boarding) return;

  if (S.xr) {
    // Left stick: smooth locomotion relative to where the headset faces.
    const axes = S.stage.getMoveAxes();
    if (Math.hypot(axes.x, axes.y) > 0.15) {
      const fwd = S.stage.headWorldDirection();
      fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).negate();
      const move = new THREE.Vector3()
        .addScaledVector(fwd, -axes.y)
        .addScaledVector(right, -axes.x)
        .multiplyScalar(ctx.config.deck.moveSpeed * dt);
      S.player.rig.position.add(move);
      clampToDeck(S.player.rig);
    }
    // Right stick: snap turn.
    const snap = S.stage.consumeSnapTurn();
    if (snap) S.player.rig.rotation.y -= snap * THREE.MathUtils.degToRad(ctx.config.vr.snapTurnDeg);

    // Boarding trigger uses the actual head position — the user may also
    // simply walk there physically.
    const head = S.stage.headWorldPosition();
    const flatDist = Math.hypot(head.x - DECK.portPos.x, head.z - DECK.portPos.z);
    if (flatDist < ctx.config.deck.portEnterRadius + 0.35) beginBoarding(ctx);
    return;
  }

  const speed = ctx.config.deck.moveSpeed;
  const dir = new THREE.Vector3(
    (S.keys.has('KeyD') || S.keys.has('ArrowRight') ? 1 : 0) -
    (S.keys.has('KeyA') || S.keys.has('ArrowLeft') ? 1 : 0),
    0,
    (S.keys.has('KeyS') || S.keys.has('ArrowDown') ? 1 : 0) -
    (S.keys.has('KeyW') || S.keys.has('ArrowUp') ? 1 : 0),
  );
  if (dir.lengthSq() > 0) {
    dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), S.look.yaw).multiplyScalar(speed * dt);
    const rig = S.player.rig;
    rig.position.x += dir.x;
    rig.position.z += dir.z;
    clampToDeck(rig);

    // Boarding trigger: the user has reached the capsule entry port.
    const flatDist = Math.hypot(rig.position.x - DECK.portPos.x, rig.position.z - DECK.portPos.z);
    if (flatDist < ctx.config.deck.portEnterRadius + 0.35) beginBoarding(ctx);
  }
}

async function beginBoarding(ctx) {
  if (S.boarding) return;
  S.boarding = true;
  if (S.xr) S.stage.hud('ENTERING DRAGON CREW CAPSULE');
  else {
    S.hudEl.textContent = 'ENTERING DRAGON CREW CAPSULE';
    S.hudEl.classList.add('is-visible');
  }
  ctx.audio.play('sfx.portEnter');
  ctx.audio.setLayerGain('background', 0.15, 2.2);

  // Glide the last half-metre into the white light.
  const rig = S.player.rig;
  const from = rig.position.clone();
  let to;
  if (S.xr) {
    // Account for where the head actually is inside the play space so the
    // HEAD (not the rig origin) ends up at the port.
    const head = S.stage.headWorldPosition();
    to = new THREE.Vector3(
      rig.position.x + (DECK.portPos.x - head.x),
      0,
      rig.position.z + (DECK.portPos.z + 0.35 - head.z),
    );
  } else {
    to = new THREE.Vector3(DECK.portPos.x, 0, DECK.portPos.z + 0.35);
  }
  await tween(2400, (e) => {
    rig.position.lerpVectors(from, to, e);
    if (!S.xr) {
      S.look.pitch += (0 - S.look.pitch) * 0.04;
      S.look.yaw += (0 - S.look.yaw) * 0.04;
    }
  });

  // White-out, then the end card.
  window.__gate05BoardingComplete = true;
  if (S.xr) {
    await S.stage.fade(1, ctx.config.fadeMs + 400, 0xffffff);
    await new Promise((r) => setTimeout(r, 600));
    await S.stage.endSession();               // back to the flat page…
    S.stage.renderer.domElement.style.display = 'none';
    showEndCard(ctx, null);
  } else {
    const fader = document.getElementById('fader');
    fader.classList.add('is-white', 'is-active');
    await new Promise((r) => setTimeout(r, ctx.config.fadeMs + 400));
    showEndCard(ctx, fader);
  }
}

function showEndCard(ctx, fader) {
  S.root.querySelector('.deck-hud')?.remove();
  S.root.querySelector('.visor-frame')?.remove();
  if (!S.xr) S.renderer.domElement.style.display = 'none';
  S.root.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;inset:0;display:grid;place-items:center;background:var(--acl-bg);">
      <div style="text-align:center;max-width:32rem;padding:1rem;">
        <p style="font-family:var(--acl-mono);letter-spacing:0.3em;color:var(--acl-cyan);margin:0 0 0.8rem;">AGENT CYBER LINES LTD.</p>
        <h1 style="margin:0 0 0.6rem;font-size:1.4rem;letter-spacing:0.12em;">BOARDING COMPLETE</h1>
        <p style="color:var(--acl-muted);line-height:1.6;margin:0;">
          You are aboard the Dragon crew capsule.<br/>
          Next section — CAPSULE INTERIOR — is a future layer of this experience.
        </p>
      </div>
    </div>
  `);
  if (fader) {
    fader.classList.remove('is-active');
    setTimeout(() => fader.classList.remove('is-white'), ctx.config.fadeMs);
  }
}

/** 'movie' mode ending: the rig walks itself into the port. */
async function playMovieEnding(ctx) {
  const rig = S.player.rig;
  const from = rig.position.clone();
  const to = new THREE.Vector3(0, 0, DECK.portPos.z + 1.6);
  await tween(5200, (e) => { rig.position.lerpVectors(from, to, e); });
  beginBoarding(ctx);
}

/* ====================================================================== */
/* Per-frame update (shared by the XR stage loop and the 2D loop)         */
/* ====================================================================== */

function frameUpdate(dt, t) {
  if (!S || S.disposed) return;
  const now = performance.now();

  stepTweens(now);
  stepGazeWaiters();
  stepMovement(dt, S.ctx);

  if (!S.xr) {
    S.player.rig.rotation.y = S.look.yaw;
    S.player.pitchObj.rotation.x = S.look.pitch + (S.nodPitch || 0);
  }

  S.port.userData.update(t);
  for (const sp of S.specialists) sp.update(t);

  // Feed the AUDIO LAYER the listener pose for spatialized sound.
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  S.player.camera.getWorldPosition(camPos);
  S.player.camera.getWorldDirection(camDir);
  S.ctx.audio.setListenerPose(camPos, camDir);
}
