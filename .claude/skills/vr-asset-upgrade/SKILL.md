---
name: vr-asset-upgrade
description: Upgrade a Three.js/WebXR (or similar procedural 3D) scene by replacing placeholder geometry, canvas textures, and synthesized audio with real, license-clear assets — self-hosted, with the original procedural version kept as an instant fallback. Use when asked to make a 3D/VR experience "more realistic," add real textures/sounds/models, increase visual complexity, or ground a fictional scene in a real-world reference (a real vehicle, real UI, real location).
---

# VR / Three.js real-asset upgrade

This project (gate-05, a WebXR spacecraft-boarding experience) started as a fully
procedural scene: primitive geometry (`BoxGeometry`/`SphereGeometry`), canvas-drawn
textures, and Web Audio oscillator/noise synths. This skill is the workflow used to
layer real, freely-licensed assets on top without ever breaking the "it always
renders something" guarantee the procedural version gave for free.

## The core contract: url wins, else procedural fallback

Before touching assets, check whether the codebase already has this pattern (it
does here — see `js/audio/audio-engine.js`). Every replaceable thing should be:

1. Built instantly from procedural code (geometry, canvas texture, or synth) so the
   scene/sound is never blocked on the network.
2. Asynchronously upgraded in place once a real asset loads — swap
   `mesh.material`, `mesh.material.map`, or an audio buffer, whichever is cheapest.
3. Left alone (procedural) if the real asset 404s, fails to parse, or was never
   found — log a `console.warn`, never throw.

Write (or extend) a small loader utility with this contract baked in — see
`gate-05/js/util/assets.js` for a working example (`loadModel`, `loadAnimatedModel`,
`cloneModel`, `loadTexture`, `loadPbrMaterial`, each resolving `null` on failure).

## 1. Inventory what's procedural

Grep the target section files for `CanvasTexture`, `BoxGeometry`/`SphereGeometry`/
`CylinderGeometry` used as a stand-in for something real, and the audio engine's
`PROCEDURAL` synth table. That's the replacement shopping list.

## 2. Source real assets — direct-download only, license-clear only

A source is only usable if you can `curl`/`Invoke-WebRequest` the file directly —
no login, no API key, no JS-only download button. Good sources found reliable in
practice:

| Asset type | Source | Notes |
|---|---|---|
| Audio (SFX/ambience) | Wikimedia Commons (`upload.wikimedia.org`) | Public domain/CC0 files, CORS `*` enabled (required for Web Audio `fetch`+`decodeAudioData`). Aggressively rate-limits (`429`, `Retry-After: 600`) — retry with backoff, don't hammer it. |
| PBR textures | Poly Haven (`dl.polyhaven.org`) | CC0. JSON API at `api.polyhaven.com/assets?type=textures&categories=X` to discover slugs; direct file pattern `https://dl.polyhaven.org/file/ph-assets/Textures/<jpg|png|exr>/1k/<slug>/<slug>_<diff|nor_gl|rough>_1k.<ext>`. Prefer `jpg`/`png` over `exr` unless you're adding an EXR loader. |
| PBR textures (more variety) | ambientCG (`ambientcg.com/get?file=<AssetID>_1K-JPG.zip`) | CC0. Query `ambientcg.com/api/v2/full_json?type=Material&category=X` for asset IDs. Zip contains Color/NormalGL/Roughness/etc — extract only what you need. |
| Earth/space imagery | Wikimedia-mirrored Solar System Scope textures | CC BY 4.0 (attribution required, not CC0) — good equirectangular day/cloud maps when true public-domain NASA Blue Marble direct URLs can't be confirmed. |
| 3D models (props, kits) | Kenney.nl (`kenney.nl/media/pages/assets/...zip`) | CC0, direct zip, no login. Modular kits (e.g. "Space Station Kit") ship as many small single-piece `.glb` files sharing one `Textures/colormap.png` atlas — keep that folder structure intact when copying files in, GLTFLoader resolves the texture relative to the `.glb`. |
| 3D models (public domain, specific hardware) | NASA 3D Resources GitHub (`raw.githubusercontent.com/nasa/NASA-3D-Resources/...`) | Public domain. May use Draco compression — see the DRACOLoader note below. |
| Avoid | Sketchfab, Poly Pizza | Download flow is login/JS-gated in practice — don't force it; report the gap instead of guessing a URL. |

If a good real match doesn't exist for a given slot, say so explicitly and leave the
procedural version as the permanent implementation for that slot — don't fabricate
a URL or force a mediocre substitute.

## 3. Self-host, don't hotlink

Download everything into the project's own `assets/{audio,textures,models,earth}/`
folder structure and reference it with paths relative to the page (`assets/...`),
the same convention the rest of the config already uses. This avoids CORS
surprises, survives source-site link rot, and keeps the repo reproducible.

Two path-resolution gotchas that cost real debugging time:

- `import` specifiers resolve relative to the **importing module's file**.
- Runtime asset URLs (`fetch`, `GLTFLoader.load(url)`, `DRACOLoader.setDecoderPath(path)`,
  `TextureLoader.load(url)`) resolve relative to the **document's URL** (the page,
  not the JS file that called them). Write vendor-file paths and content-asset
  paths with this distinction in mind — they are not interchangeable.

## 4. Recompress before committing

Texture sites often ship normal/roughness maps as large lossless PNGs (multi-MB
each) that are massive overkill for real-time use. Recompress with Pillow:

```python
from PIL import Image
im = Image.open(path).convert("RGB")
im.save(path.replace(".png", ".jpg"), "JPEG", quality=84, optimize=True)
```

This routinely cuts a 5MB normal map to under 300KB with no visible quality loss
at game/VR texel density. Do this for every downloaded texture before wiring it
in — check total `assets/` folder size stays in the low single-digit MB range for
a web/Quest-target experience.

## 5. Add the loader layer once, reuse everywhere

Vendor `GLTFLoader.js` (and `DRACOLoader.js` + its 3 decoder files, if any source
model uses Draco compression — check by grepping the raw `.glb` for `"uri"` vs. a
`KHR_draco_mesh_compression` extension reference) at the **same three.js revision**
as the already-vendored `three.module.min.js` — verify the revision by comparing
file size/byte-diff against `unpkg.com/three@X.Y.Z/build/three.module.min.js`
rather than guessing from the copyright year comment. Rewrite each vendored
loader's `from 'three'` import to point at the local build.

Then write one small `assets.js` utility (loadModel/loadTexture/loadPbrMaterial
pattern) that every section imports, instead of ad hoc fetches scattered through
section files.

## 6. Clone correctly

- A **unique URL used exactly once** (e.g. two different specialist characters,
  each its own file): load directly, don't clone.
- A **static, non-skinned prop reused many times** (crates, pipes, panels):
  `sourceObject3D.clone(true)` is safe and cheap.
- A **skinned/animated character reused from the same URL more than once**:
  plain `Object3D.clone()` does **not** rebind the skeleton to the cloned bone
  hierarchy — the clone will silently animate using the original's skeleton. Use
  `THREE.SkeletonUtils.clone` (a separate three.js addon) instead, or just avoid
  the situation by giving each instance its own load call if the source is cheap.
- Also remember `gltf.animations` lives on the **loader result**, not on
  `gltf.scene` — a bare `.clone()` of the scene silently drops animation clips.

## 7. Drive existing animation hooks by inspecting real node names

Don't guess bone/node names. Extract the glTF JSON chunk from a `.glb` (12-byte
header, then an 8-byte chunk header, then the JSON payload) with a short Python
script and print `nodes`, `meshes`, `materials`, `animations`, `skins` — this
takes seconds and avoids a lot of blind trial and error:

```python
import struct, json
def read_glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    off = 12
    chunk_len, chunk_type = struct.unpack_from("<II", data, off)
    return json.loads(data[off+8:off+8+chunk_len])
```

Then target the real bone/mesh names via `scene.getObjectByName(...)` from your
existing gesture/animation code, applied **after** `AnimationMixer.update(dt)` so a
scripted override wins for the specific bone(s) it drives while an `idle` clip
keeps animating everything else.

## 8. Grounding fictional content in a real-world reference

If asked to match "real launch footage" or similar and you can't watch/download
video (no video-analysis tool, and broadcast footage/audio is typically
copyrighted even when freely viewable — unlike public-domain NASA stills):

- Use `WebSearch`/`WebFetch` for **factual, descriptive** research (real
  timelines, terminology, cabin layout, suit design) — cite sources, paraphrase,
  never reproduce scripted dialogue verbatim.
- If browser automation with screenshot capability is available, static image
  search (e.g. Google Images) is far more reliable than trying to stream video in
  a sandboxed/automated browser — video playback is frequently throttled or
  blocked in those environments; treat 2-3 failed play attempts as a signal to
  pivot, not a signal to keep retrying.
- Use what you see/read only as **reference to inform original, hand-built work**
  (procedural geometry, canvas UI, material choices) — don't save or embed the
  copyrighted frames themselves into the project.

## 9. Verify in-browser

ES modules and `fetch` need `http://`, not `file://` — serve the folder locally
(`python3 -m http.server` works anywhere Python's available) before testing.

- Read the console with an error-only filter after every navigation; a clean
  console across every section is the real pass/fail signal, more reliable than
  eyeballing wall-clock animation timing.
- Automated/headless browser tabs can be **heavily throttled** (Chrome suspends
  `requestAnimationFrame` when a tab isn't OS-focused) — if a scripted sequence
  seems to hang for many multiples of its configured duration, that's very likely
  an automation-environment artifact, not an app bug. Don't burn time waiting it
  out. Instead, temporarily point the app's entry sequence directly at just the
  section under test (e.g. `CONFIG.sequence = ['orbit']`) for a fast, isolated
  visual check, then revert the change.
- Fix every real warning/error found immediately (e.g. a missing `DRACOLoader`
  shows up as a clean, catchable `console.warn` thanks to the fallback contract —
  fix it and re-verify rather than leaving a permanently-failing asset load).

## 10. Keep a running asset/attribution log

Note the source, license, and any attribution requirement for every real asset
next to where it's wired in (a one-line code comment is enough) — CC0 needs
nothing, but CC BY (e.g. Solar System Scope textures) needs credit somewhere
user-visible eventually. This is much cheaper to capture at download time than to
reconstruct later.
