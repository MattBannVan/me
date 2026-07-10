/* =========================================================================
   CYBER CRIME FIGHTER — Device Intelligence Database
   -------------------------------------------------------------------------
   The game is fully data-driven. Every round pulls a real-world-style device
   from this table and derives the forensic clues + the "correct rebuild"
   from its attributes. Add a device here and it automatically becomes a
   possible case — no other code changes required. You can also drop a
   `data/devices.json` next to this file to extend the roster at runtime
   (see loadExternalDevices() at the bottom).

   NOTE ON REALISM & SAFETY: attributes describe how a phone *looks and is
   configured* (form factor, launcher, region, carrier, wallpaper). Nothing
   here bypasses security — the mission is to rebuild a wiped decoy from
   evidence, a deduction puzzle. Fictional carriers are used to avoid
   trademark issues while staying believable.
   ========================================================================= */

const CARRIERS = [
  { id: "vertex",   name: "Vertex Wireless", color: "#e5322d", glyph: "V" },
  { id: "nexafone", name: "Nexafone",        color: "#0a84ff", glyph: "N" },
  { id: "orbit",    name: "Orbit Mobile",    color: "#7c3aed", glyph: "O" },
  { id: "pacbell",  name: "PacBell",         color: "#0f9d58", glyph: "P" },
  { id: "ironline", name: "IronLine",        color: "#f2a900", glyph: "I" },
  { id: "civicom",  name: "CiviCom",         color: "#ff5a5f", glyph: "C" },
];

const REGIONS = [
  { id: "us",  name: "United States", lang: "English (US)",  tz: "GMT-5",  timeDefault: "12h", dateFmt: "M/D/YY" },
  { id: "uk",  name: "United Kingdom", lang: "English (UK)", tz: "GMT+0",  timeDefault: "24h", dateFmt: "D/M/YY" },
  { id: "de",  name: "Germany",       lang: "Deutsch",       tz: "GMT+1",  timeDefault: "24h", dateFmt: "D.M.YY" },
  { id: "jp",  name: "Japan",         lang: "日本語",         tz: "GMT+9",  timeDefault: "24h", dateFmt: "Y/M/D" },
  { id: "br",  name: "Brazil",        lang: "Português",     tz: "GMT-3",  timeDefault: "24h", dateFmt: "D/M/Y" },
  { id: "in",  name: "India",         lang: "English (IN)",  tz: "GMT+5:30", timeDefault: "12h", dateFmt: "D/M/Y" },
];

// Wallpaper generators (pure SVG gradients/patterns — data-driven, no assets).
const WALLPAPERS = [
  { id: "aurora",   name: "Aurora",        stops: ["#1e3a8a", "#7c3aed", "#db2777"], style: "gradient" },
  { id: "carbon",   name: "Carbon",        stops: ["#0f172a", "#1e293b"], style: "gradient" },
  { id: "sunset",   name: "Sunset Ridge",  stops: ["#f97316", "#db2777", "#4c1d95"], style: "gradient" },
  { id: "mint",     name: "Mint Glass",    stops: ["#0f766e", "#22d3ee"], style: "gradient" },
  { id: "mono",     name: "Graphite",      stops: ["#111827", "#374151"], style: "gradient" },
  { id: "bloom",    name: "Bloom",         stops: ["#be185d", "#f59e0b"], style: "gradient" },
  { id: "abyss",    name: "Deep Abyss",    stops: ["#020617", "#0b3a53"], style: "gradient" },
  { id: "petals",   name: "Petals",        stops: ["#f472b6", "#c084fc"], style: "dots" },
  { id: "grid",     name: "Neon Grid",     stops: ["#0f172a", "#0891b2"], style: "grid" },
  { id: "family",   name: "Family Photo",  stops: ["#334155", "#64748b"], style: "photo" },
  { id: "car",      name: "Sports Car",    stops: ["#7f1d1d", "#111827"], style: "photo" },
  { id: "pet",      name: "Pet Dog",       stops: ["#78350f", "#a16207"], style: "photo" },
];

// App catalog — generic stylized apps (no trademarks). Each has an icon key
// resolved by assets.js. `category` drives evidence hints.
const APPS = [
  { id: "phone",    name: "Phone",     cat: "core"   },
  { id: "messages", name: "Messages",  cat: "core"   },
  { id: "camera",   name: "Camera",    cat: "core"   },
  { id: "photos",   name: "Photos",    cat: "core"   },
  { id: "browser",  name: "Browser",   cat: "core"   },
  { id: "maps",     name: "Maps",      cat: "core"   },
  { id: "clock",    name: "Clock",     cat: "core"   },
  { id: "settings", name: "Settings",  cat: "core"   },
  { id: "wallet",   name: "Wallet",    cat: "finance"},
  { id: "bank",     name: "VaultBank", cat: "finance"},
  { id: "crypto",   name: "CoinStash", cat: "finance"},
  { id: "chat",     name: "Whisper",   cat: "social" },
  { id: "social",   name: "Pulse",     cat: "social" },
  { id: "video",    name: "Streamr",   cat: "media"  },
  { id: "music",    name: "SoundBox",  cat: "media"  },
  { id: "games",    name: "Arcade",    cat: "games"  },
  { id: "vpn",      name: "GhostVPN",  cat: "privacy"},
  { id: "notes",    name: "Notes",     cat: "core"   },
];

/* Device roster. Attributes chosen to be visually + configurably distinct so
   the deduction puzzle has real signal. `form` and `camera` drive the
   identify-the-device step; `os`/`osVersions`/`launcher`/`nav` drive rebuild. */
const DEVICES = [
  {
    id: "aurora-x15pro", brand: "Aurora", model: "X15 Pro", year: 2024,
    os: "iOS-like", osName: "AuroraOS", osVersions: ["17.4", "17.5", "18.0"],
    form: "dynamic-island", size: "large", camera: "square-triple",
    nav: "gesture", launcher: "AuroraOS", clockStyle: "stacked-serif",
    bodyColors: ["#4b5563", "#e5e7eb", "#1f2937", "#c9a86a"],
    tags: ["flagship", "premium"],
  },
  {
    id: "aurora-x13", brand: "Aurora", model: "X13", year: 2022,
    os: "iOS-like", osName: "AuroraOS", osVersions: ["16.2", "16.6", "17.0"],
    form: "notch", size: "standard", camera: "vertical-dual",
    nav: "gesture", launcher: "AuroraOS", clockStyle: "stacked-serif",
    bodyColors: ["#1d4ed8", "#111827", "#e5e7eb", "#ec4899"],
    tags: ["mainstream"],
  },
  {
    id: "aurora-mini", brand: "Aurora", model: "X SE", year: 2022,
    os: "iOS-like", osName: "AuroraOS", osVersions: ["15.7", "16.4", "17.0"],
    form: "home-button", size: "compact", camera: "single",
    nav: "buttons", launcher: "AuroraOS", clockStyle: "stacked-serif",
    bodyColors: ["#111827", "#e5e7eb", "#dc2626"],
    tags: ["budget", "compact"],
  },
  {
    id: "helix-s24u", brand: "Helix", model: "Nova S24 Ultra", year: 2024,
    os: "Android", osName: "Android 14", osVersions: ["13", "14"],
    form: "punch-hole-center", size: "large", camera: "pill-vertical",
    nav: "gesture", launcher: "OneShell", clockStyle: "big-thin",
    bodyColors: ["#1c1917", "#a3a3a3", "#4c1d95", "#065f46"],
    tags: ["flagship", "stylus"],
  },
  {
    id: "helix-a35", brand: "Helix", model: "Nova A35", year: 2023,
    os: "Android", osName: "Android 13", osVersions: ["12", "13"],
    form: "punch-hole-center", size: "standard", camera: "vertical-dual",
    nav: "buttons", launcher: "OneShell", clockStyle: "big-thin",
    bodyColors: ["#0f172a", "#e2e8f0", "#7c3aed", "#0369a1"],
    tags: ["midrange"],
  },
  {
    id: "quill-p8", brand: "Quill", model: "Pixela 8", year: 2023,
    os: "Android", osName: "Android 14", osVersions: ["13", "14"],
    form: "punch-hole-center", size: "standard", camera: "horizontal-bar",
    nav: "gesture", launcher: "PureLauncher", clockStyle: "geometric",
    bodyColors: ["#f1f5f9", "#0f172a", "#f59e0b", "#84cc16"],
    tags: ["stock-android", "photography"],
  },
  {
    id: "quill-p7a", brand: "Quill", model: "Pixela 7a", year: 2022,
    os: "Android", osName: "Android 13", osVersions: ["12", "13"],
    form: "punch-hole-center", size: "compact", camera: "horizontal-bar",
    nav: "gesture", launcher: "PureLauncher", clockStyle: "geometric",
    bodyColors: ["#334155", "#e2e8f0", "#0ea5e9"],
    tags: ["stock-android", "budget"],
  },
  {
    id: "kestrel-edge", brand: "Kestrel", model: "Edge 40", year: 2023,
    os: "Android", osName: "Android 13", osVersions: ["12", "13"],
    form: "punch-hole-center", size: "standard", camera: "vertical-dual",
    nav: "gesture", launcher: "CleanUI", clockStyle: "big-thin",
    bodyColors: ["#4d7c0f", "#1e293b", "#7dd3fc"],
    tags: ["curved-screen"],
  },
  {
    id: "onyx-flip5", brand: "Onyx", model: "Flip 5", year: 2023,
    os: "Android", osName: "Android 13", osVersions: ["13", "14"],
    form: "punch-hole-center", size: "compact", camera: "horizontal-dual",
    nav: "gesture", launcher: "OneShell", clockStyle: "big-thin",
    bodyColors: ["#8b5cf6", "#111827", "#facc15"],
    tags: ["foldable", "compact"],
  },
  {
    id: "titan-rugged", brand: "Titan", model: "Rugged R2", year: 2022,
    os: "Android", osName: "Android 12", osVersions: ["11", "12"],
    form: "notch", size: "large", camera: "square-triple",
    nav: "buttons", launcher: "stock", clockStyle: "geometric",
    bodyColors: ["#1c1917", "#ca8a04", "#166534"],
    tags: ["rugged", "burner-friendly"],
  },
];

const FORM_LABELS = {
  "dynamic-island":   "Pill cutout (top-center, merges with UI)",
  "notch":            "Wide notch (top-center)",
  "home-button":      "Physical home button, thick bezels",
  "punch-hole-center":"Center punch-hole camera",
  "punch-hole-left":  "Left-corner punch-hole camera",
};
const CAMERA_LABELS = {
  "square-triple":   "Square module, three lenses",
  "vertical-dual":   "Two lenses stacked vertically",
  "horizontal-dual": "Two lenses side by side",
  "horizontal-bar":  "Full-width horizontal camera bar",
  "pill-vertical":   "Vertical row of separate lenses (no module)",
  "single":          "Single rear lens",
};

function getCarrier(id){ return CARRIERS.find(c => c.id === id); }
function getRegion(id){ return REGIONS.find(r => r.id === id); }
function getWallpaper(id){ return WALLPAPERS.find(w => w.id === id); }
function getApp(id){ return APPS.find(a => a.id === id); }
function getDevice(id){ return DEVICES.find(d => d.id === id); }

/* Validate an externally-supplied device before trusting it. Device fields
   flow into innerHTML and into case generation, so reject anything with a bad
   shape (would crash rand(device.bodyColors) etc.) or unsafe characters (would
   allow HTML/JS injection). */
function isSafeStr(s){ return typeof s === "string" && s.length > 0 && !/[<>]/.test(s); }
function isValidExternalDevice(d){
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  const reqStr = ["id","brand","model","os","osName","launcher","clockStyle","size"];
  if (!reqStr.every(k => isSafeStr(d[k]))) return false;
  if (!Object.prototype.hasOwnProperty.call(FORM_LABELS, d.form)) return false;
  if (!Object.prototype.hasOwnProperty.call(CAMERA_LABELS, d.camera)) return false;
  if (d.nav !== "gesture" && d.nav !== "buttons") return false;
  if (!Array.isArray(d.osVersions) || !d.osVersions.length || !d.osVersions.every(isSafeStr)) return false;
  if (!Array.isArray(d.bodyColors) || !d.bodyColors.length ||
      !d.bodyColors.every(c => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c))) return false;
  if ("year" in d && typeof d.year !== "number") return false;
  if ("tags" in d && (!Array.isArray(d.tags) || !d.tags.every(isSafeStr))) return false;
  return true;
}

/* Optional runtime extension: if a data/devices.json exists it is merged in.
   This is what lets you "load relevant information on real world devices" and
   grow the challenge pool without touching code. Entries are validated first. */
async function loadExternalDevices(){
  try {
    const res = await fetch("data/devices.json", { cache: "no-store" });
    if (!res.ok) return;
    const extra = await res.json();
    if (!Array.isArray(extra)) return;
    for (const d of extra) {
      if (!isValidExternalDevice(d)) { console.warn("Skipping invalid external device", d && d.id); continue; }
      if (!DEVICES.some(x => x.id === d.id)) DEVICES.push(d);
    }
  } catch (_) { /* no external file — fine */ }
}
