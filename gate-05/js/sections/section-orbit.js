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

  /* Space outside the nose ring — a layered starfield with varied
     brightness and colour temperature for depth, plus a few bright
     foreground stars that gently twinkle. */
  const starGeo = new THREE.BufferGeometry();
  const pts = [], cols = [];
  const tints = [[0.86, 0.9, 1.0], [1, 1, 1], [1, 0.97, 0.88], [1, 0.85, 0.7]];
  for (let i = 0; i < 1500; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 60);
    pts.push(v.x, v.y, v.z);
    const t = tints[(Math.random() ** 2 * tints.length) | 0];
    const b = 0.45 + Math.random() * 0.55;
    cols.push(t[0] * b, t[1] * b, t[2] * b);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Points(starGeo,
    new THREE.PointsMaterial({ size: 0.95, sizeAttenuation: true, vertexColors: true, transparent: true })));

  const brightStars = [];
  const brightTex = glowTexture('#eaf2ff');
  for (let i = 0; i < 16; i++) {
    const dir = new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.15) * 1.1, -1).normalize();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: brightTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.position.copy(dir.multiplyScalar(105));
    s.scale.setScalar(1.4 + Math.random() * 1.6);
    s.userData = { phase: Math.random() * Math.PI * 2, rate: 1.4 + Math.random() * 2.4, base: 0.5 + Math.random() * 0.4 };
    scene.add(s);
    brightStars.push(s);
  }

  // Faint Milky-Way band across the far field for depth.
  const band = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#9fb6e6'), transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  band.scale.set(260, 60, 1);
  band.position.set(-40, 40, -120);
  scene.add(band);

  // Earth: positioned so its limb fills the lower half of the view
  // through the nose ring. Slow self-rotation only (object motion —
  // comfort-safe); the user never moves.
  const earthTex = new THREE.CanvasTexture(earthCanvas());
  earthTex.generateMipmaps = false;
  earthTex.minFilter = THREE.LinearFilter;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(30, 64, 48),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1, metalness: 0.02 })
  );
  earth.position.set(0, -26, -52);
  scene.add(earth);

  // Independent cloud shell — same centre, larger radius, its own spin.
  const cloudTex = new THREE.CanvasTexture(cloudCanvas());
  cloudTex.generateMipmaps = false;
  cloudTex.minFilter = THREE.LinearFilter;
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(30.5, 64, 48),
    new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, roughness: 1, depthWrite: false, opacity: 0.9 })
  );
  clouds.position.copy(earth.position);
  scene.add(clouds);

  // Two-tone atmosphere: a broad haze plus a tighter, brighter rim.
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#7fb8ff'), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  atmo.scale.setScalar(74);
  atmo.position.copy(earth.position);
  scene.add(atmo);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#bfe0ff'), transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  rim.scale.setScalar(64);
  rim.position.copy(earth.position);
  scene.add(rim);

  // Sunlit side faces the capsule: light travels from high behind the
  // camera down onto the planet.
  const earthLight = new THREE.DirectionalLight(0xbcd6f2, 2.2);
  earthLight.position.set(6, 30, 30);
  scene.add(earthLight);

  // A distant space station tumbling slowly across the far field — the
  // rendezvous target teased on the end card (STATION DOCKING).
  const station = buildStation();
  station.position.set(-46, 12, -104);
  scene.add(station);

  // Meteor: a stretched glowing streak, re-armed on a timer to flash
  // across the view now and then.
  const meteor = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#ffffff'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  meteor.scale.set(9, 0.5, 1);
  scene.add(meteor);
  const meteorState = { t: 0, next: 3 + Math.random() * 4, from: new THREE.Vector3(), to: new THREE.Vector3() };

  // Sun: starts hidden behind the limb; the sunrise beat sweeps it up
  // across the view through the nose ring.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#fff3d8'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sun.scale.setScalar(20);
  sun.position.set(8, -18, -70);
  scene.add(sun);
  // Lens-flare ghost that rides between the sun and screen centre.
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#ffe9b0'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flare.scale.setScalar(6);
  scene.add(flare);
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

  return {
    cabin, iris, earth, clouds, atmo, rim, sun, flare, sunLight, cabinLight,
    props, brightStars, station, meteor, meteorState, noseLightBoost: 0,
  };
}

/** A compact ISS-style station: central spine, pressurized modules,
    radiators and four gold solar arrays. Reads as a silhouette at range. */
function buildStation() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xcdd4dd, roughness: 0.5, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x39414d, roughness: 0.6, metalness: 0.5 });
  const panel = new THREE.MeshStandardMaterial({
    color: 0x1a2c5a, roughness: 0.35, metalness: 0.3, emissive: 0x102048, emissiveIntensity: 0.4,
  });

  // Central truss.
  const truss = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 0.35), dark);
  g.add(truss);

  // Pressurized modules strung along the spine.
  for (const z of [-1.4, 0, 1.4]) {
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16), hull);
    mod.rotation.z = Math.PI / 2;
    mod.position.set(z, 0, 0);
    g.add(mod);
  }
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), hull);
  g.add(node);

  // Radiator fins.
  for (const s of [-1, 1]) {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 1.1), dark);
    rad.position.set(s * 2.2, 0.5, 0);
    g.add(rad);
  }

  // Four solar arrays on outboard booms.
  for (const s of [-1, 1]) {
    for (const yy of [-1.4, 1.4]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.02, 3.4), panel);
      wing.position.set(s * 3.6, 0, 0);
      wing.position.z = yy;
      g.add(wing);
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.12), dark);
    boom.position.set(s * 2.6, 0, 0);
    g.add(boom);
  }
  g.scale.setScalar(1.3);
  return g;
}

/** Procedural Earth texture: layered ocean, continents with coastal
    shelves, deserts, forest belts and polar caps. */
function earthCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');

  // Deep-to-shallow ocean gradient by latitude.
  const ocean = g.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#0e2f57');
  ocean.addColorStop(0.5, '#12467e');
  ocean.addColorStop(1, '#0e2f57');
  g.fillStyle = ocean;
  g.fillRect(0, 0, 1024, 512);

  // Landmass blobs, each with a shallow-water shelf and interior biomes.
  const landmass = (x, y, scale) => {
    const outline = [];
    const lobes = 9 + ((Math.random() * 4) | 0);
    for (let j = 0; j < lobes; j++) {
      const a = (j / lobes) * Math.PI * 2;
      const r = (30 + Math.random() * 60) * scale;
      outline.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62]);
    }
    const trace = (pad, fill) => {
      g.beginPath();
      outline.forEach(([px, py], j) => {
        const dx = (px - x) * pad, dy = (py - y) * pad;
        const nx = x + (px - x) + dx, ny = y + (py - y) + dy;
        j ? g.lineTo(nx, ny) : g.moveTo(nx, ny);
      });
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    trace(0.08, 'rgba(90,170,200,0.5)');   // continental shelf
    trace(0.0, '#2f6b3d');                  // land
    // Interior desert / arid patches.
    g.save();
    trace(0.0, '#2f6b3d'); g.clip();
    g.fillStyle = 'rgba(178,150,92,0.55)';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(x + (Math.random() - 0.5) * 60 * scale, y + (Math.random() - 0.5) * 40 * scale,
        (14 + Math.random() * 24) * scale, (8 + Math.random() * 16) * scale, Math.random(), 0, Math.PI * 2);
      g.fill();
    }
    // Darker forest belts.
    g.fillStyle = 'rgba(28,74,40,0.5)';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(x + (Math.random() - 0.5) * 60 * scale, y + (Math.random() - 0.5) * 40 * scale,
        (16 + Math.random() * 22) * scale, (7 + Math.random() * 12) * scale, Math.random(), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };
  for (let i = 0; i < 22; i++) landmass(Math.random() * 1024, 110 + Math.random() * 300, 0.7 + Math.random() * 0.7);

  // Polar caps with soft edges.
  for (const [y0, y1, dir] of [[0, 40, 1], [512, 472, -1]]) {
    const cap = g.createLinearGradient(0, y0, 0, y1 + dir * 26);
    cap.addColorStop(0, '#eef5fa');
    cap.addColorStop(1, 'rgba(238,245,250,0)');
    g.fillStyle = cap;
    g.fillRect(0, Math.min(y0, y1 + dir * 26), 1024, 66);
  }
  return c;
}

/** Separate translucent cloud layer, drawn onto its own sphere so it can
    rotate at a different rate from the surface (parallax depth). */
function cloudCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 512);
  // Banded weather systems: swirled ellipse clusters along latitudes.
  for (let band = 0; band < 6; band++) {
    const cy = 60 + band * 75 + (Math.random() - 0.5) * 30;
    const puffs = 20 + ((Math.random() * 14) | 0);
    for (let i = 0; i < puffs; i++) {
      const x = Math.random() * 1024;
      const y = cy + (Math.random() - 0.5) * 46;
      g.fillStyle = `rgba(255,255,255,${0.18 + Math.random() * 0.4})`;
      g.beginPath();
      g.ellipse(x, y, 26 + Math.random() * 74, 6 + Math.random() * 12, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  // A couple of cyclone spirals for interest.
  for (let s = 0; s < 3; s++) {
    const cx = Math.random() * 1024, cy = 120 + Math.random() * 270;
    for (let a = 0; a < 26; a++) {
      const ang = a * 0.5, rad = a * 2.4;
      g.fillStyle = `rgba(255,255,255,${0.5 - a * 0.016})`;
      g.beginPath();
      g.ellipse(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.7, 7, 4, ang, 0, Math.PI * 2);
      g.fill();
    }
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
        W.sun.scale.setScalar(20 + e * 10);          // blooms as it crests
        W.sunLight.intensity = e * 2.2;
        W.sunLight.color.setRGB(1, 0.86 + e * 0.1, 0.7 + e * 0.2);
        // Atmosphere ignites along the limb; the tighter rim flares hottest.
        W.atmo.material.opacity = 0.5 + e * 0.35;
        W.rim.material.opacity = 0.35 + Math.sin(Math.min(1, e) * Math.PI) * 0.5;
        W.rim.material.color.setRGB(0.75 + e * 0.25, 0.88, 1);
        // Lens-flare ghost tracks half-way from the sun toward centre.
        W.flare.position.copy(W.sun.position).multiplyScalar(0.55);
        W.flare.material.opacity = Math.sin(Math.min(1, e) * Math.PI) * 0.6;
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
  W.clouds.rotation.y = t * 0.012;          // clouds drift a touch faster
  W.cabinLight.intensity = 3 + W.noseLightBoost * 2.5;

  // Bright stars twinkle.
  for (const s of W.brightStars) {
    const u = s.userData;
    s.material.opacity = u.base + Math.sin(t * u.rate + u.phase) * 0.35;
  }

  // Station: very slow cross-drift with a lazy tumble — distant, calm.
  if (W.station) {
    W.station.position.x += dt * 0.16;
    if (W.station.position.x > 60) W.station.position.x = -60;
    W.station.rotation.y += dt * 0.05;
    W.station.rotation.z = Math.sin(t * 0.07) * 0.1;
  }

  // Meteor streaks: re-armed on a timer, then swept across the far field.
  const ms = W.meteorState;
  if (ms.t > 0) {
    ms.t -= dt;
    const e = 1 - Math.max(0, ms.t) / ms.dur;
    W.meteor.position.lerpVectors(ms.from, ms.to, e);
    W.meteor.material.opacity = Math.sin(Math.min(1, e) * Math.PI) * 0.9;
    if (ms.t <= 0) W.meteor.material.opacity = 0;
  } else {
    ms.next -= dt;
    if (ms.next <= 0) {
      ms.dur = ms.t = 0.9 + Math.random() * 0.5;
      ms.next = 5 + Math.random() * 7;
      const y = 20 + Math.random() * 40, z = -90 - Math.random() * 30;
      ms.from.set(-70, y, z);
      ms.to.set(70, y - 30 - Math.random() * 20, z);
      const ang = Math.atan2(ms.to.y - ms.from.y, ms.to.x - ms.from.x);
      W.meteor.material.rotation = ang;
    }
  }

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
