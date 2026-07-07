/**
 * VR LAYER — XR stage for Gate 05.
 *
 * Owns the one persistent WebGL renderer + immersive-vr session that every
 * in-VR section shares (WebXR allows a single session/canvas, so sections
 * hand their scenes to the stage instead of creating renderers).
 *
 * Entered from the agreement "Accept" click (requestSession must run inside
 * a user gesture). From that moment on, loading + deck render in-headset.
 * If WebXR is unavailable (desktop browser), tryEnter() resolves false and
 * the experience continues with the flat 2D fallback.
 *
 * Provides the VR equivalents of the DOM facilities:
 *   fade(opacity, ms, color) — camera-attached fade sphere (DOM fader is
 *                              invisible in-headset)
 *   hud(text)                — camera-locked text panel
 *   pulseHaptics(i, ms)      — controller haptic actuators
 *   getMoveAxes()/consumeSnapTurn() — thumbstick locomotion input
 *   lookPitch()              — headset gaze pitch (for gaze-guided beats)
 */

import * as THREE from '../vendor/three.module.min.js';

export class XRStage {
  constructor(config) {
    this.config = config;
    this.active = false;
    this.session = null;
    this.renderer = null;
    this.scene = null;
    this.onFrame = null;
    this.onSessionEnd = null;

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
    this.rig = new THREE.Group();          // locomotion moves this
    this.rig.add(this.camera);

    this.controllerGrips = [];
    this._fade = { opacity: 0, target: 0, ms: 1, resolve: null, t0: 0 };
    this._snapCooldown = 0;
    this._clock = new THREE.Clock();
  }

  async supported() {
    try {
      return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'));
    } catch { return false; }
  }

  /** Call from a user gesture. Resolves true if the headset session began. */
  async tryEnter() {
    if (this.active) return true;
    if (!await this.supported()) return false;
    try { await this._enter(); return true; }
    catch (e) { console.warn('[xr] enter failed:', e); return false; }
  }

  async _enter() {
    if (!this.renderer) this._buildRenderer();
    this.session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor'],
    });
    this.session.addEventListener('end', () => {
      this.active = false;
      this.session = null;
      this.renderer.setAnimationLoop(null);
      this.onSessionEnd?.();
    });
    await this.renderer.xr.setSession(this.session);
    this.active = true;
    this._clock.start();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType(this.config.vr.referenceSpace);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;';
    document.body.appendChild(canvas);

    // Controller grip spaces — parented to the rig so tracked hands follow
    // thumbstick locomotion. Sections attach glove meshes to these.
    for (const i of [0, 1]) {
      const grip = this.renderer.xr.getControllerGrip(i);
      this.rig.add(grip);
      this.controllerGrips.push(grip);
    }

    // Camera-attached fade sphere (replaces the DOM fader in-headset).
    this.fadeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000, side: THREE.BackSide, transparent: true,
        opacity: 0, depthTest: false, depthWrite: false,
      })
    );
    this.fadeMesh.renderOrder = 999;
    this.camera.add(this.fadeMesh);

    // Camera-locked HUD text panel.
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 1024; this.hudCanvas.height = 96;
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    this.hudMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.084),
      new THREE.MeshBasicMaterial({
        map: this.hudTexture, transparent: true,
        depthTest: false, depthWrite: false,
      })
    );
    this.hudMesh.renderOrder = 998;
    this.hudMesh.position.set(0, -0.32, -1.1);
    this.hudMesh.visible = false;
    this.camera.add(this.hudMesh);
  }

  /** A section hands over its scene (and per-frame update) to the stage. */
  setScene(scene, onFrame) {
    if (this.scene) this.scene.remove(this.rig);
    this.scene = scene;
    this.onFrame = onFrame;
    if (scene) scene.add(this.rig);
  }

  _frame() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._stepFade();
    if (this._snapCooldown > 0) this._snapCooldown -= dt;
    this.onFrame?.(dt, this._clock.elapsedTime);
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }

  /* ------------------------------ fade ------------------------------ */

  fade(targetOpacity, ms = 900, color = 0x000000) {
    if (!this.fadeMesh) return Promise.resolve();
    this._fade.resolve?.();  // settle any pending fade promise
    this.fadeMesh.material.color.set(color);
    return new Promise((resolve) => {
      this._fade = {
        from: this.fadeMesh.material.opacity, target: targetOpacity,
        ms: Math.max(ms, 1), t0: performance.now(), resolve,
      };
    });
  }

  _stepFade() {
    const f = this._fade;
    if (!f.resolve) return;
    const t = Math.min(1, (performance.now() - f.t0) / f.ms);
    this.fadeMesh.material.opacity = f.from + (f.target - f.from) * t;
    if (t >= 1) { const r = f.resolve; f.resolve = null; r(); }
  }

  /* ------------------------------ HUD ------------------------------- */

  hud(text) {
    if (!this.hudMesh) return;
    if (!text) { this.hudMesh.visible = false; return; }
    const g = this.hudCanvas.getContext('2d');
    g.clearRect(0, 0, 1024, 96);
    g.fillStyle = 'rgba(5,7,13,0.7)';
    g.beginPath(); g.roundRect(112, 8, 800, 80, 40); g.fill();
    g.strokeStyle = 'rgba(79,216,255,0.6)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e8f1ff';
    g.font = '600 34px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 512, 50);
    this.hudTexture.needsUpdate = true;
    this.hudMesh.visible = true;
  }

  /* --------------------------- input/haptics ------------------------ */

  pulseHaptics(intensity = 0.6, ms = 220) {
    for (const src of this.session?.inputSources ?? []) {
      src.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
    }
  }

  /** Left-thumbstick move vector {x, y} in [-1, 1] (standard xr mapping). */
  getMoveAxes() {
    for (const src of this.session?.inputSources ?? []) {
      if (src.handedness === 'left' && src.gamepad) {
        const a = src.gamepad.axes;
        return { x: a[2] ?? a[0] ?? 0, y: a[3] ?? a[1] ?? 0 };
      }
    }
    return { x: 0, y: 0 };
  }

  /** Right-thumbstick snap turn: returns -1 | 0 | +1 once per flick. */
  consumeSnapTurn() {
    for (const src of this.session?.inputSources ?? []) {
      if (src.handedness === 'right' && src.gamepad) {
        const x = src.gamepad.axes[2] ?? src.gamepad.axes[0] ?? 0;
        if (Math.abs(x) > 0.7 && this._snapCooldown <= 0) {
          this._snapCooldown = 0.35;
          return Math.sign(x);
        }
      }
    }
    return 0;
  }

  /** Headset gaze pitch in radians (negative = looking down). */
  lookPitch() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  }

  /** Headset world position (for boarding triggers, spatial audio). */
  headWorldPosition(target = new THREE.Vector3()) {
    return this.camera.getWorldPosition(target);
  }

  headWorldDirection(target = new THREE.Vector3()) {
    return this.camera.getWorldDirection(target);
  }

  async endSession() {
    try { await this.session?.end(); } catch { /* already ended */ }
  }
}
