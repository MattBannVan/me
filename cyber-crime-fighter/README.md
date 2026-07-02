# 🚔 Cyber Crime Fighter

**Play it:** `https://xr-intelligence.com/cyber-crime-fighter/`
(or open `index.html` locally — no build step, no dependencies)

A story-driven **deduction & device-rebuild puzzle**. A bank heist crew is in
custody, four million is missing, and the only lead — the ringleader's phone —
got wiped by a booby-trapped alarm during the arrest. The DA's plan: rebuild a
**convincing decoy** of each suspect's phone from forensic evidence, walk it into
the interview room, and let the suspect *believe* it's been cracked so they flip.
You're the broke tech grad they call when nobody on the squad can pull it off.

> ⚖️ **This is a work of fiction and a puzzle game.** Nothing here bypasses,
> unlocks, or defeats any real device security. The challenge is *identification
> and reconstruction from evidence* — a forensics-flavored deduction game.

---

## How it plays

Each **case** runs a four-phase loop:

1. **Evidence Board** — read the forensic clues (CCTV stills, receipts, lab
   reports, social posts). On harder tiers, some evidence is a **red herring**.
2. **Identify the Model** — match the physical description (form factor, camera
   layout, size) to the exact handset in a line-up of look-alikes.
3. **Rebuild the Decoy** — configure an **emulated phone** to match the suspect's:
   OS version, region/language, carrier, wallpaper, body color, clock format,
   navigation style, and home-screen apps. The phone updates live as you work.
4. **The Reveal** — a **believability meter** scores your rebuild against the
   truth. Clear the threshold and the suspect cracks. Miss it and they smell the
   fake — reset and go again.

Solve all three suspects to recover the loot and land the job.

## Difficulty & scalability

Four clearance levels (**Rookie → Detective → Cyber Crime Unit → Blackout**)
scale every dimension, and cases **escalate one tier per round**:

| Dial | Rookie | Blackout |
|------|--------|----------|
| Models in line-up | 3 | 6 |
| Attributes to rebuild | 4 | 9 |
| Clue coverage | 100% | 45% |
| Believability needed | 60% | 90% |
| Timer / red herrings | none | 150s / 3 |

## Data-driven device intel

Every round pulls a device from a **real-world-style intelligence database**
(`js/devices.js`) and derives the clues and correct answers from its attributes
(form factor, camera, OS, launcher, nav style, colors). **Add a device and it
automatically becomes a possible case** — no other code changes needed.

You can also extend the roster at runtime without touching code: drop entries
into [`data/devices.json`](data/devices.json) and they're merged in on load.
Fictional carriers/brands are used to keep it trademark-safe while realistic.

## Tech

- **Zero dependencies.** Plain HTML/CSS/JS, no build, no frameworks.
- **All 2D art is hand-built inline SVG** (`js/assets.js`) — characters, scenes,
  app icons, wallpapers, evidence, and every phone form factor. Crisp at any
  resolution, nothing loaded from the network.
- **Procedural audio** via the WebAudio API (`js/audio.js`) — no sound files.

```
cyber-crime-fighter/
├── index.html            # entry point
├── css/style.css
├── data/devices.json     # optional runtime device roster
└── js/
    ├── devices.js        # device / carrier / region / app intel
    ├── assets.js         # inline-SVG art library
    ├── audio.js          # procedural WebAudio SFX
    ├── story.js          # narrative beats
    ├── casegen.js        # case generator + difficulty scaling
    ├── device-emu.js     # emulated phone renderer
    └── game.js           # engine / UI state machine
```

## Extending it

- **New phone:** append an object to `DEVICES` in `js/devices.js` (or
  `data/devices.json`). Set `form`, `camera`, `os`, `osName`, `osVersions`,
  `launcher`, `nav`, `clockStyle`, `bodyColors`.
- **New wallpaper / carrier / region / app:** add to the arrays at the top of
  `js/devices.js`.
- **New clue type or rebuild attribute:** add to the `attrPool` in
  `js/casegen.js`; the UI and scoring pick it up automatically.
