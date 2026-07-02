/* =========================================================================
   CYBER CRIME FIGHTER — Case Generator
   Turns a data-driven device into a playable case: the hidden "truth", the
   forensic clues that (partly) reveal it, an identify-the-model line-up, and
   the list of rebuild attributes the player must match. Difficulty scales
   every dimension: clue completeness, decoys, attribute count, threshold,
   red herrings and timer.
   ========================================================================= */

const DIFFICULTY = {
  rookie:   { key:"rookie",   label:"Rookie",           idOptions:3, attrs:4, clueCoverage:1.0, threshold:60, timer:0,   redHerrings:0, appExtra:2 },
  detective:{ key:"detective",label:"Detective",        idOptions:4, attrs:6, clueCoverage:0.85,threshold:72, timer:0,   redHerrings:1, appExtra:3 },
  cyber:    { key:"cyber",    label:"Cyber Crime Unit",  idOptions:5, attrs:8, clueCoverage:0.65,threshold:82, timer:240, redHerrings:2, appExtra:4 },
  blackout: { key:"blackout", label:"Blackout",          idOptions:6, attrs:9, clueCoverage:0.45,threshold:90, timer:150, redHerrings:3, appExtra:5 },
};

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function sample(arr, n){
  const c=[...arr]; const out=[];
  while(out.length<n && c.length){ out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); }
  return out;
}
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// Pick decoy devices that resemble the target (same OS family or same form)
// so identification is a real puzzle, not a giveaway.
function pickDecoys(target, n){
  const pool = DEVICES.filter(d => d.id !== target.id);
  const similar = pool.filter(d => d.form === target.form || d.os === target.os || d.brand === target.brand);
  const rest = pool.filter(d => !similar.includes(d));
  return sample(shuffle(similar).concat(shuffle(rest)), n);
}

function generateCase(difficultyKey, index, suspectName){
  const diff = DIFFICULTY[difficultyKey] || DIFFICULTY.rookie;
  const device = rand(DEVICES);
  const region = rand(REGIONS);
  const carrier = rand(CARRIERS);
  const wallpaper = rand(WALLPAPERS);
  const bodyColor = rand(device.bodyColors);
  const osVersion = rand(device.osVersions);
  const timeFormat = region.timeDefault;
  const nav = device.nav;

  // The suspect's real home-screen app set (dock + a few icons).
  const coreApps = APPS.filter(a => a.cat === "core");
  const flavorApps = APPS.filter(a => a.cat !== "core");
  const trueApps = sample(coreApps, 4).concat(sample(flavorApps, 3)).map(a => a.id);

  const truth = {
    device: device.id, region: region.id, carrier: carrier.id,
    wallpaper: wallpaper.id, bodyColor, osVersion, timeFormat, nav,
    apps: trueApps,
  };

  /* ---- Attribute pool (each is a rebuild challenge) ------------------- */
  const attrPool = [];

  attrPool.push({
    key:"osVersion", label:"OS Version", type:"choice", weight:12,
    options: device.osVersions.map(v => ({ id:v, label:`${device.osName} ${v}` })),
    correct: osVersion,
    clue:{ kind:"report", title:"Forensics — build string",
      text:`Recovered boot log fragment lists build for ${device.osName} ${osVersion}.` },
  });

  attrPool.push({
    key:"region", label:"Region & Language", type:"choice", weight:12,
    options: sample(REGIONS.filter(r=>r.id!==region.id), Math.min(diff.idOptions-1, REGIONS.length-1))
             .concat([region]).map(r=>({id:r.id, label:`${r.name} · ${r.lang}`})),
    correct: region.id,
    clue:{ kind:"receipt", title:"Receipt — language & currency",
      text:`Store receipt found on suspect printed in ${region.lang}. Currency and date format point to ${region.name}.` },
  });

  attrPool.push({
    key:"carrier", label:"Carrier", type:"choice", weight:12,
    options: sample(CARRIERS.filter(c=>c.id!==carrier.id), Math.min(diff.idOptions-1, CARRIERS.length-1))
             .concat([carrier]).map(c=>({id:c.id, label:c.name})),
    correct: carrier.id,
    clue:{ kind:"receipt", title:"Bill — carrier account",
      text:`A crumpled ${carrier.name} statement was in the suspect's jacket.` },
  });

  attrPool.push({
    key:"wallpaper", label:"Wallpaper", type:"choice", weight:16,
    options: sample(WALLPAPERS.filter(w=>w.id!==wallpaper.id), Math.min(diff.idOptions, WALLPAPERS.length-1))
             .concat([wallpaper]).map(w=>({id:w.id, label:w.name, wp:true})),
    correct: wallpaper.id,
    clue:{ kind:"social", title:"Social post — lock screen visible",
      text:`In a selfie the suspect posted, the phone's wallpaper is clearly the "${wallpaper.name}" style.` },
  });

  attrPool.push({
    key:"bodyColor", label:"Body Color", type:"swatch", weight:8,
    options: device.bodyColors.map(c=>({id:c, label:c, swatch:c})),
    correct: bodyColor,
    clue:{ kind:"photo", title:"CCTV — the device in hand",
      text:`Arrest-scene photo shows the phone body color clearly.` },
  });

  attrPool.push({
    key:"timeFormat", label:"Clock Format", type:"choice", weight:8,
    options: [{id:"12h",label:"12-hour (AM/PM)"},{id:"24h",label:"24-hour"}],
    correct: timeFormat,
    clue:{ kind:"photo", title:"CCTV — timestamp on screen",
      text:`Freeze-frame catches the lock-screen clock reading in ${timeFormat==="24h"?"24-hour":"12-hour"} format.` },
  });

  attrPool.push({
    key:"nav", label:"Navigation Style", type:"choice", weight:8,
    options: [{id:"gesture",label:"Gesture bar (no buttons)"},{id:"buttons",label:"On-screen back/home buttons"}],
    correct: nav,
    clue:{ kind:"report", title:"Forensics — UI config",
      text:`Case notes: witness saw suspect swipe up from the bottom to go home (${nav==="gesture"?"gesture nav":"button nav"}).` },
  });

  attrPool.push({
    key:"apps", label:"Home Screen Apps", type:"apps", weight:16,
    correct: trueApps,
    appExtra: diff.appExtra,
    clue:{ kind:"social", title:"Social post — home screen glimpse",
      text:`A blurry screen recording reveals several app icons on the suspect's home screen.` },
  });

  // Choose how many attributes to play this round (scaled by difficulty).
  const chosen = attrPool.slice(0, Math.min(diff.attrs, attrPool.length));

  // Redistribute weights so the played attributes total 100 (fair scoring).
  const totalW = chosen.reduce((s,a)=>s+a.weight,0);
  chosen.forEach(a => a.weight = Math.round((a.weight/totalW)*100));
  // fix rounding drift
  const drift = 100 - chosen.reduce((s,a)=>s+a.weight,0);
  if (chosen.length) chosen[0].weight += drift;

  // Clue coverage: on harder modes, some clues are redacted (attribute must
  // be deduced or guessed), which is what raises real difficulty.
  chosen.forEach(a => {
    a.clueGiven = Math.random() < diff.clueCoverage;
  });
  // Always give at least one clue so it's never blind.
  if (!chosen.some(a=>a.clueGiven)) chosen[0].clueGiven = true;

  // Identify-the-model lineup.
  const decoys = pickDecoys(device, diff.idOptions - 1);
  const lineup = shuffle([device, ...decoys]);

  // Red herrings: misleading evidence cards.
  const herrings = [];
  const herringTexts = [
    "A gum wrapper. Forensics confirms: it is, in fact, a gum wrapper.",
    "Anonymous tip claims the phone was 'definitely pink.' Tip came from the suspect's cellmate. Disregard.",
    "A second phone was found — turns out it belongs to the arresting officer.",
    "Handwritten note reads 'call mom.' Sweet, but not evidence.",
  ];
  for (let i=0;i<diff.redHerrings;i++){
    herrings.push({ kind: rand(["photo","report","receipt"]), title:"Unverified", text: herringTexts[i % herringTexts.length], herring:true });
  }

  return {
    index, suspectName, difficulty: diff, device, truth,
    attributes: chosen, lineup, herrings,
    identifyClue: {
      form: FORM_LABELS[device.form],
      camera: CAMERA_LABELS[device.camera],
      size: device.size,
    },
  };
}
