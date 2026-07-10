/* ============================================================
   avatar.js — 3D avatar of Matt for the front page.

   This ships a lightweight PROCEDURAL placeholder bust so the page
   works with zero external assets. It is built to be swapped for a
   high-quality model later:

     • Drop a .glb/.gltf file somewhere in the repo (e.g.
       /assets/models/matt.glb) and set `modelUrl` in the config
       passed to createAvatar() (see index.html).
     • When `modelUrl` is set, a GLTFLoader is loaded on demand and the
       procedural placeholder is replaced by your model. The rest of the
       scene (lighting, camera, drag-to-rotate, speak animation) stays.

   Public API returned by createAvatar():
     • setSpeaking(bool) — drive the mouth / head "talking" animation.
     • dispose()         — stop the loop and release GL resources.
   ============================================================ */

import * as THREE from '../vendor/three.module.min.js';

export function createAvatar(canvas, config = {}) {
  const modelUrl = config.modelUrl || null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.15, 4.2);

  // ---- Lighting: soft studio setup ----
  const ambient = new THREE.AmbientLight(0xb9a7ff, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.5, 3.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8f7bff, 0.9);
  fill.position.set(-3, 1, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xd0bcff, 1.6);
  rim.position.set(-1.5, 2.5, -3);
  scene.add(rim);

  // ---- Contact shadow catcher ----
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3, 48),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.35;
  floor.receiveShadow = true;
  scene.add(floor);

  // The whole avatar lives in this group so swapping the model, spinning,
  // and idle motion all operate on one handle.
  const avatar = new THREE.Group();
  scene.add(avatar);

  // Parts we animate; populated by whichever builder runs.
  let parts = { head: null, mouth: null, eyes: [], root: null };

  function buildPlaceholder() {
    const group = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c9a8, roughness: 0.75, metalness: 0.02 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c2431, roughness: 0.6 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f7, roughness: 0.35 });
    const eyeDark = new THREE.MeshStandardMaterial({ color: 0x241d34, roughness: 0.2 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4f378b, roughness: 0.85 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7a3b4a, roughness: 0.5 });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 48), skin);
    head.scale.set(0.95, 1.08, 0.92);
    head.position.y = 0.55;
    head.castShadow = true;
    group.add(head);

    // Hair cap
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat
    );
    hair.scale.set(0.98, 1.06, 0.96);
    hair.position.y = 0.6;
    hair.castShadow = true;
    group.add(hair);

    // Ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), skin);
      ear.position.set(sx * 0.66, 0.5, 0.02);
      ear.scale.set(0.6, 1, 0.7);
      group.add(ear);
    }

    // Eyes (white + pupil), tracked for blinking
    const eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.26, 0.6, 0.62);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), eyeWhite);
      white.scale.set(1, 0.72, 0.5);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 20), eyeDark);
      pupil.position.z = 0.06;
      eye.add(white, pupil);
      group.add(eye);
      eyes.push(eye);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), hairMat);
      brow.position.set(sx * 0.26, 0.74, 0.66);
      brow.rotation.z = sx * -0.06;
      group.add(brow);
    }

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 16), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.5, 0.72);
    group.add(nose);

    // Mouth — scales vertically to fake lip-sync while speaking
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), mouthMat);
    mouth.position.set(0, 0.33, 0.66);
    group.add(mouth);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 24), skin);
    neck.position.y = 0.02;
    neck.castShadow = true;
    group.add(neck);

    // Shoulders / torso (bust)
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.85, 0.7, 40, 1, true),
      shirtMat
    );
    torso.position.y = -0.55;
    torso.castShadow = true;
    group.add(torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 16, 40), shirtMat);
    collar.position.y = -0.2;
    collar.rotation.x = Math.PI / 2;
    group.add(collar);

    parts = { head, mouth, eyes, root: group };
    avatar.add(group);
  }

  async function buildFromModel(url) {
    // GLTFLoader is a three.js addon, loaded on demand so the placeholder
    // path stays 100% offline. Pinned to the same three version we vendor.
    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
    );
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    // Frame the model to a consistent size/position.
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = 2.2 / (Math.max(size.x, size.y, size.z) || 1);
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));

    // Try to find a mouth/jaw morph or node for lip-sync; optional.
    let mouth = null;
    model.traverse((o) => {
      if (!mouth && /mouth|jaw/i.test(o.name)) mouth = o;
    });

    parts = { head: model, mouth, eyes: [], root: model };
    avatar.add(model);
  }

  // Build placeholder immediately; if a real model is configured, swap it in
  // when it finishes loading (falling back to the placeholder on error).
  buildPlaceholder();
  if (modelUrl) {
    buildFromModel(modelUrl)
      .then(() => {
        if (parts.root && parts.root !== avatar.children[0]) {
          avatar.remove(avatar.children[0]); // drop the placeholder
        }
      })
      .catch((err) => console.warn('[avatar] model load failed, keeping placeholder:', err));
  }

  // ---- Interaction: drag to rotate, otherwise gentle auto-spin ----
  let targetRotY = 0;
  let pointerDown = false;
  let lastX = 0;
  let userInteracted = false;

  const onDown = (e) => { pointerDown = true; userInteracted = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); };
  const onMove = (e) => {
    if (!pointerDown) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    targetRotY += (x - lastX) * 0.01;
    lastX = x;
  };
  const onUp = () => { pointerDown = false; };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  // ---- Speaking state ----
  let speaking = false;
  function setSpeaking(v) { speaking = !!v; }

  // ---- Resize ----
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- Animation loop ----
  const clock = new THREE.Clock();
  let blinkTimer = 2 + Math.random() * 3;
  let raf = 0;

  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    if (!userInteracted) targetRotY += dt * 0.25; // slow idle spin until touched
    avatar.rotation.y += (targetRotY - avatar.rotation.y) * 0.08;

    // Breathing bob
    avatar.position.y = Math.sin(t * 1.1) * 0.02;

    if (parts.head) {
      // Subtle head sway; stronger nod while speaking
      const nod = speaking ? Math.sin(t * 9) * 0.05 : 0;
      parts.head.rotation.x = Math.sin(t * 0.7) * 0.03 + nod;
    }

    // Mouth lip-sync fake
    if (parts.mouth) {
      const open = speaking ? 0.5 + Math.abs(Math.sin(t * 12)) * 1.6 : 0.5;
      if (parts.mouth.morphTargetInfluences) {
        parts.mouth.morphTargetInfluences[0] = speaking ? Math.abs(Math.sin(t * 12)) : 0;
      } else {
        parts.mouth.scale.y = open;
      }
    }

    // Blink
    blinkTimer -= dt;
    let blink = 1;
    if (blinkTimer < 0.15 && blinkTimer > 0) blink = Math.max(0.05, blinkTimer / 0.15);
    if (blinkTimer < 0) blinkTimer = 2.5 + Math.random() * 3.5;
    for (const eye of parts.eyes) eye.scale.y = blink;

    renderer.render(scene, camera);
  }
  tick();

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
    renderer.dispose();
  }

  return { setSpeaking, dispose, scene, camera, renderer };
}
