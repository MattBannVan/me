/**
 * ASSET LOADER — real glTF models and PBR textures, with graceful
 * fallback to `null` on any failure (offline, 404, blocked, unsupported)
 * so callers can always fall back to building procedural geometry, the
 * same "url wins, else fall back" contract the AUDIO LAYER already uses
 * (see js/audio/audio-engine.js).
 *
 * Every load is cached by URL (+ options for textures) so re-mounting a
 * section or spawning multiple instances of the same prop never re-fetches
 * or re-parses the same file twice.
 */

import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/loaders/DRACOLoader.js';

// Some source models (e.g. the NASA astronaut) ship Draco-compressed
// geometry. The decoder is lazy-loaded by DRACOLoader itself only when a
// compressed model is actually fetched, so wiring it up costs nothing
// for the (majority of) models that don't use it.
const dracoLoader = new DRACOLoader();
// Unlike `import`, which resolves relative to this module, setDecoderPath
// resolves against the document's URL (gate-05/index.html) — same
// convention as every other asset path in js/config.js.
dracoLoader.setDecoderPath('js/vendor/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();

const gltfCache = new Map();    // url -> Promise<{scene, animations}|null>
const textureCache = new Map(); // cacheKey -> Promise<THREE.Texture|null>

/**
 * Loads a glTF/GLB once and caches the whole parse result (scene graph +
 * animation clips — gltf.animations lives on the loader result, NOT on
 * gltf.scene, so anything that needs the clips must go through this, not
 * a bare .clone()). Resolves `null` (never rejects) on failure.
 */
export function loadGLTF(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve) => {
      gltfLoader.load(
        url,
        (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations || [] }),
        undefined,
        (err) => { console.warn(`[assets] model load failed: ${url}`, err); resolve(null); },
      );
    }));
  }
  return gltfCache.get(url);
}

/**
 * Loads a model's scene graph for SINGLE, UN-CLONED use (e.g. a
 * skinned/animated character loaded from its own unique URL). Resolves
 * `null` on failure.
 */
export async function loadModel(url) {
  const gltf = await loadGLTF(url);
  return gltf ? gltf.scene : null;
}

/**
 * Loads a model and its animation clips together, for driving a
 * THREE.AnimationMixer. Resolves `null` on failure.
 */
export async function loadAnimatedModel(url) {
  return loadGLTF(url);
}

/**
 * Loads a model and returns a deep clone, for scattering multiple
 * instances of a STATIC (non-skinned) prop. Plain Object3D.clone(true)
 * does not correctly rebind SkinnedMesh skeletons to the cloned bone
 * hierarchy — only use this for rigid geometry (props, greebles), never
 * for animated/skinned characters (load those individually via
 * loadModel/loadAnimatedModel instead).
 */
export async function cloneModel(url) {
  const source = await loadModel(url);
  return source ? source.clone(true) : null;
}

/**
 * Loads a single texture once; resolves `null` on failure.
 * opts.colorSpace: THREE.SRGBColorSpace for color/albedo maps (default),
 *   THREE.NoColorSpace for normal/roughness/metalness/AO data maps.
 * opts.repeat: [x, y] tiling factor (wrap defaults to RepeatWrapping).
 * opts.anisotropy: filtering quality for oblique surfaces (floors/walls).
 */
export function loadTexture(url, opts = {}) {
  const {
    colorSpace = THREE.SRGBColorSpace,
    repeat = null,
    wrap = THREE.RepeatWrapping,
    anisotropy = 4,
  } = opts;
  const key = `${url}|${colorSpace}|${repeat?.join(',')}|${wrap}|${anisotropy}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, new Promise((resolve) => {
      textureLoader.load(
        url,
        (tex) => {
          tex.colorSpace = colorSpace;
          tex.wrapS = tex.wrapT = wrap;
          tex.anisotropy = anisotropy;
          if (repeat) tex.repeat.set(repeat[0], repeat[1]);
          resolve(tex);
        },
        undefined,
        (err) => { console.warn(`[assets] texture load failed: ${url}`, err); resolve(null); },
      );
    }));
  }
  return textureCache.get(key);
}

/**
 * Loads a PBR map set (color/normal/roughness, any of which may be omitted)
 * and returns a THREE.MeshStandardMaterial. Any map that fails to load is
 * simply left unset — the material still renders (flat-shaded) rather than
 * the whole surface silently vanishing.
 *
 * paths: { map, normalMap, roughnessMap, aoMap, metalnessMap }
 * matOpts: extra MeshStandardMaterial constructor fields (color, roughness, metalness…)
 */
export async function loadPbrMaterial(paths, { repeat = [1, 1], ...matOpts } = {}) {
  const [map, normalMap, roughnessMap, aoMap, metalnessMap] = await Promise.all([
    paths.map ? loadTexture(paths.map, { colorSpace: THREE.SRGBColorSpace, repeat }) : null,
    paths.normalMap ? loadTexture(paths.normalMap, { colorSpace: THREE.NoColorSpace, repeat }) : null,
    paths.roughnessMap ? loadTexture(paths.roughnessMap, { colorSpace: THREE.NoColorSpace, repeat }) : null,
    paths.aoMap ? loadTexture(paths.aoMap, { colorSpace: THREE.NoColorSpace, repeat }) : null,
    paths.metalnessMap ? loadTexture(paths.metalnessMap, { colorSpace: THREE.NoColorSpace, repeat }) : null,
  ]);
  return new THREE.MeshStandardMaterial({
    map, normalMap, roughnessMap, aoMap, metalnessMap,
    ...matOpts,
  });
}
