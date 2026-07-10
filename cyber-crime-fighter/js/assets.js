/* =========================================================================
   CYBER CRIME FIGHTER — 2D Art (hand-built SVG asset library)
   All artwork is generated as inline SVG so the game is fully self-contained
   (no external images, crisp at any resolution). Functions return SVG markup
   strings that get injected into the DOM.
   ========================================================================= */

const ART = {};

/* ---- helpers ---------------------------------------------------------- */
function svg(w, h, body, extra = "") {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" ${extra}>${body}</svg>`;
}
function grad(id, stops, x1=0,y1=0,x2=0,y2=1){
  const s = stops.map((c,i)=>`<stop offset="${(i/(stops.length-1))*100}%" stop-color="${c}"/>`).join("");
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}

/* ---- Characters ------------------------------------------------------- */
// A young broke tech student in a hoodie.
ART.student = function(){
  return svg(200, 220, `
    <defs>${grad("hood", ["#4338ca","#312e81"])}${grad("skin", ["#f1c9a5","#e0a97e"])}</defs>
    <ellipse cx="100" cy="210" rx="70" ry="12" fill="#000" opacity="0.25"/>
    <path d="M40 220 Q40 140 100 140 Q160 140 160 220 Z" fill="url(#hood)"/>
    <path d="M70 150 Q100 130 130 150 L128 200 L72 200 Z" fill="#111827"/>
    <circle cx="100" cy="95" r="42" fill="url(#skin)"/>
    <path d="M58 92 Q56 45 100 45 Q144 45 142 92 Q142 70 100 66 Q58 70 58 92Z" fill="url(#hood)"/>
    <circle cx="84" cy="95" r="5" fill="#1f2937"/>
    <circle cx="116" cy="95" r="5" fill="#1f2937"/>
    <path d="M86 118 Q100 126 114 118" stroke="#a15b3d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M74 82 Q84 78 94 82" stroke="#7c3f24" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M106 82 Q116 78 126 82" stroke="#7c3f24" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="150" y="150" width="34" height="52" rx="6" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/>
    <rect x="155" y="156" width="24" height="34" rx="2" fill="#0ea5e9" opacity="0.4"/>
  `);
};

// Detective Reyes — worn jacket, badge, tired eyes.
ART.detective = function(){
  return svg(200, 220, `
    <defs>${grad("coat", ["#374151","#1f2937"])}${grad("skin2", ["#caa06f","#a97c4f"])}</defs>
    <ellipse cx="100" cy="210" rx="72" ry="12" fill="#000" opacity="0.25"/>
    <path d="M34 220 Q34 138 100 138 Q166 138 166 220 Z" fill="url(#coat)"/>
    <path d="M84 140 L100 175 L116 140 L120 210 L80 210 Z" fill="#111827"/>
    <path d="M96 140 L100 160 L104 140Z" fill="#9ca3af"/>
    <circle cx="100" cy="92" r="40" fill="url(#skin2)"/>
    <path d="M60 88 Q58 48 100 48 Q142 48 140 88 L140 74 Q100 64 60 74Z" fill="#4b5563"/>
    <circle cx="85" cy="92" r="5" fill="#1f2937"/>
    <circle cx="115" cy="92" r="5" fill="#1f2937"/>
    <path d="M72 90 Q84 86 94 90" stroke="#374151" stroke-width="3" fill="none"/>
    <path d="M106 90 Q116 86 128 90" stroke="#374151" stroke-width="3" fill="none"/>
    <path d="M86 114 Q100 120 114 114" stroke="#6b3f28" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M78 122 Q100 128 122 122 L118 132 Q100 138 82 132Z" fill="#4b5563"/>
    <circle cx="128" cy="176" r="13" fill="#f2c744" stroke="#a16207" stroke-width="2"/>
    <path d="M128 168 l3 6 6 0 -5 4 2 7 -6 -4 -6 4 2 -7 -5 -4 6 0z" fill="#a16207"/>
  `);
};

// Suspect — dramatic silhouette in interrogation light.
ART.suspect = function(){
  return svg(200, 220, `
    <defs>${grad("shad", ["#111827","#030712"])}</defs>
    <ellipse cx="100" cy="210" rx="66" ry="12" fill="#000" opacity="0.35"/>
    <path d="M42 220 Q42 140 100 140 Q158 140 158 220 Z" fill="url(#shad)"/>
    <circle cx="100" cy="92" r="42" fill="url(#shad)"/>
    <circle cx="84" cy="90" r="4" fill="#ef4444" opacity="0.85"/>
    <circle cx="116" cy="90" r="4" fill="#ef4444" opacity="0.85"/>
    <path d="M84 116 Q100 112 116 116" stroke="#374151" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="20" y="0" width="18" height="220" fill="#fbbf24" opacity="0.06"/>
    <rect x="162" y="0" width="18" height="220" fill="#fbbf24" opacity="0.06"/>
  `);
};

/* ---- Scenes ----------------------------------------------------------- */
ART.scene = function(name){
  if (name === "apartment") return svg(800, 400, `
    <defs>${grad("night",["#0b1020","#1e1b4b"])}</defs>
    <rect width="800" height="400" fill="url(#night)"/>
    <rect x="40" y="30" width="240" height="150" rx="6" fill="#0f172a" stroke="#334155" stroke-width="3"/>
    ${Array.from({length:24}).map((_,i)=>`<rect x="${60+ (i%6)*36}" y="${50+Math.floor(i/6)*32}" width="20" height="20" fill="${["#fbbf24","#0ea5e9","#111827"][i%3]}" opacity="0.7"/>`).join("")}
    <rect x="0" y="300" width="800" height="100" fill="#111827"/>
    <rect x="380" y="200" width="300" height="110" rx="8" fill="#1f2937"/>
    <rect x="400" y="215" width="150" height="90" rx="4" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/>
    <rect x="410" y="225" width="130" height="10" rx="2" fill="#22d3ee" opacity="0.5"/>
    <rect x="410" y="245" width="90" height="8" rx="2" fill="#64748b"/>
    <rect x="410" y="262" width="110" height="8" rx="2" fill="#64748b"/>
    <rect x="560" y="250" width="80" height="60" fill="#334155"/>
    <circle cx="600" cy="230" r="14" fill="#fbbf24" opacity="0.5"/>
    <rect x="120" y="260" width="70" height="50" fill="#78350f"/>
    <text x="40" y="360" fill="#94a3b8" font-size="16" font-family="monospace">3:14 AM · rent due · inbox: 12 rejections</text>
  `);
  if (name === "precinct") return svg(800, 400, `
    <defs>${grad("day",["#1e293b","#0f172a"])}</defs>
    <rect width="800" height="400" fill="url(#day)"/>
    <rect x="0" y="0" width="800" height="70" fill="#0b1220"/>
    <text x="30" y="46" fill="#38bdf8" font-size="26" font-family="monospace" letter-spacing="3">METRO PD · CYBER CRIME UNIT</text>
    <rect x="0" y="320" width="800" height="80" fill="#111827"/>
    ${Array.from({length:5}).map((_,i)=>`<g transform="translate(${60+i*150},110)"><rect x="0" y="0" width="120" height="150" rx="6" fill="#1e293b" stroke="#334155" stroke-width="2"/><rect x="12" y="14" width="96" height="70" fill="#0f172a" stroke="#22d3ee"/><rect x="20" y="100" width="80" height="10" fill="#475569"/><rect x="20" y="118" width="60" height="8" fill="#475569"/></g>`).join("")}
    <circle cx="700" cy="150" r="34" fill="#f2c744" stroke="#a16207" stroke-width="3"/>
    <path d="M700 130 l6 12 13 1 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -1z" fill="#a16207"/>
  `);
  if (name === "interrogation") return svg(800, 400, `
    <rect width="800" height="400" fill="#050810"/>
    <ellipse cx="400" cy="260" rx="230" ry="60" fill="#fbbf24" opacity="0.10"/>
    <ellipse cx="400" cy="120" rx="90" ry="18" fill="#fde68a" opacity="0.15"/>
    <path d="M360 20 L440 20 L410 120 L390 120 Z" fill="#1f2937"/>
    <ellipse cx="400" cy="122" rx="42" ry="14" fill="#fde68a" opacity="0.5"/>
    <rect x="250" y="250" width="300" height="30" rx="4" fill="#1f2937"/>
    <rect x="270" y="280" width="20" height="90" fill="#111827"/>
    <rect x="510" y="280" width="20" height="90" fill="#111827"/>
    <text x="300" y="360" fill="#64748b" font-size="15" font-family="monospace">INTERVIEW ROOM 2 · REC ●</text>
  `);
  if (name === "victory") return svg(800, 400, `
    <defs>${grad("win",["#064e3b","#065f46"])}</defs>
    <rect width="800" height="400" fill="url(#win)"/>
    ${Array.from({length:40}).map(()=>{const x=Math.random()*800,y=Math.random()*400,c=["#fbbf24","#22d3ee","#f472b6","#a3e635"][Math.floor(Math.random()*4)];return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="8" height="12" fill="${c}" transform="rotate(${(Math.random()*90).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`}).join("")}
    <text x="400" y="210" fill="#ecfdf5" font-size="40" font-family="monospace" text-anchor="middle" letter-spacing="2">LOOT RECOVERED</text>
  `);
  return svg(800,400,`<rect width="800" height="400" fill="#0f172a"/>`);
};

/* ---- App icons -------------------------------------------------------- */
const APP_ICON_DEFS = {
  phone:   ["#22c55e", `<path d="M22 20 q4-4 8 0 l6 6 q3 3 0 6 l-4 3 q8 12 20 20 l3-4 q3-3 6 0 l6 6 q4 4 0 8 l-3 3 q-6 5-16-1 -18-11-31-31 -6-10-1-16z" fill="#fff"/>`],
  messages:["#0ea5e9", `<path d="M18 22 h44 a6 6 0 0 1 6 6 v24 a6 6 0 0 1-6 6 H40 l-12 10 v-10 H18 a6 6 0 0 1-6-6 V28 a6 6 0 0 1 6-6z" fill="#fff"/>`],
  camera:  ["#334155", `<rect x="14" y="26" width="52" height="38" rx="8" fill="#e5e7eb"/><rect x="30" y="20" width="20" height="10" rx="3" fill="#e5e7eb"/><circle cx="40" cy="45" r="13" fill="#0ea5e9"/><circle cx="40" cy="45" r="6" fill="#0b1220"/>`],
  photos:  ["#fff",     `<circle cx="40" cy="26" r="8" fill="#ef4444"/><circle cx="26" cy="42" r="8" fill="#f59e0b"/><circle cx="54" cy="42" r="8" fill="#22c55e"/><circle cx="33" cy="56" r="8" fill="#3b82f6"/><circle cx="47" cy="56" r="8" fill="#a855f7"/>`],
  browser: ["#2563eb", `<circle cx="40" cy="42" r="24" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="40" cy="42" rx="10" ry="24" fill="none" stroke="#fff" stroke-width="3"/><line x1="16" y1="42" x2="64" y2="42" stroke="#fff" stroke-width="3"/><path d="M32 34 l14 6 -6 14 z" fill="#fff"/>`],
  maps:    ["#16a34a", `<path d="M40 16 a16 16 0 0 1 16 16 c0 12-16 32-16 32 s-16-20-16-32 a16 16 0 0 1 16-16z" fill="#fff"/><circle cx="40" cy="32" r="6" fill="#16a34a"/>`],
  clock:   ["#111827", `<circle cx="40" cy="42" r="24" fill="#fff"/><line x1="40" y1="42" x2="40" y2="26" stroke="#111827" stroke-width="3"/><line x1="40" y1="42" x2="53" y2="42" stroke="#ef4444" stroke-width="3"/>`],
  settings:["#64748b", `<circle cx="40" cy="42" r="10" fill="#e5e7eb"/><g fill="#e5e7eb">${Array.from({length:8}).map((_,i)=>`<rect x="37" y="12" width="6" height="12" transform="rotate(${i*45} 40 42)"/>`).join("")}</g>`],
  wallet:  ["#0f766e", `<rect x="16" y="26" width="48" height="32" rx="6" fill="#fff"/><rect x="16" y="34" width="48" height="8" fill="#0f766e"/><circle cx="54" cy="50" r="4" fill="#0f766e"/>`],
  bank:    ["#1d4ed8", `<path d="M40 18 l24 12 H16 z" fill="#fff"/><rect x="20" y="34" width="6" height="20" fill="#fff"/><rect x="37" y="34" width="6" height="20" fill="#fff"/><rect x="54" y="34" width="6" height="20" fill="#fff"/><rect x="16" y="56" width="48" height="6" fill="#fff"/>`],
  crypto:  ["#f59e0b", `<circle cx="40" cy="42" r="22" fill="#fff"/><text x="40" y="52" font-size="26" text-anchor="middle" fill="#f59e0b" font-family="serif">₿</text>`],
  chat:    ["#7c3aed", `<path d="M18 24 h44 a5 5 0 0 1 5 5 v20 a5 5 0 0 1-5 5 H36 l-14 10 v-10 h-4 a5 5 0 0 1-5-5 V29 a5 5 0 0 1 5-5z" fill="#fff"/><circle cx="30" cy="39" r="3" fill="#7c3aed"/><circle cx="40" cy="39" r="3" fill="#7c3aed"/><circle cx="50" cy="39" r="3" fill="#7c3aed"/>`],
  social:  ["#ec4899", `<rect x="18" y="20" width="44" height="44" rx="12" fill="none" stroke="#fff" stroke-width="4"/><circle cx="40" cy="42" r="11" fill="none" stroke="#fff" stroke-width="4"/><circle cx="54" cy="28" r="3" fill="#fff"/>`],
  video:   ["#dc2626", `<rect x="14" y="24" width="52" height="36" rx="8" fill="#fff"/><path d="M34 34 l14 8 -14 8 z" fill="#dc2626"/>`],
  music:   ["#db2777", `<circle cx="30" cy="54" r="8" fill="#fff"/><circle cx="56" cy="48" r="8" fill="#fff"/><rect x="36" y="22" width="4" height="34" fill="#fff"/><rect x="62" y="16" width="4" height="34" fill="#fff"/><path d="M36 22 l26-6 v6 l-26 6z" fill="#fff"/>`],
  games:   ["#0891b2", `<rect x="14" y="30" width="52" height="24" rx="12" fill="#fff"/><circle cx="27" cy="42" r="3" fill="#0891b2"/><rect x="24" y="39" width="6" height="0.1" stroke="#0891b2" stroke-width="6" stroke-linecap="round"/><circle cx="52" cy="38" r="3.5" fill="#0891b2"/><circle cx="59" cy="45" r="3.5" fill="#0891b2"/>`],
  vpn:     ["#111827", `<path d="M40 16 l20 8 v14 c0 14-10 22-20 26 -10-4-20-12-20-26 V24 z" fill="#22d3ee"/><path d="M34 42 l5 5 10-11" stroke="#111827" stroke-width="4" fill="none" stroke-linecap="round"/>`],
  notes:   ["#eab308", `<rect x="20" y="18" width="40" height="48" rx="4" fill="#fff"/><line x1="27" y1="30" x2="53" y2="30" stroke="#eab308" stroke-width="3"/><line x1="27" y1="40" x2="53" y2="40" stroke="#eab308" stroke-width="3"/><line x1="27" y1="50" x2="45" y2="50" stroke="#eab308" stroke-width="3"/>`],
};
ART.appIcon = function(id, rounded=18){
  const def = APP_ICON_DEFS[id] || ["#475569", `<circle cx="40" cy="42" r="16" fill="#fff"/>`];
  return svg(80, 80, `<rect x="4" y="4" width="72" height="72" rx="${rounded}" fill="${def[0]}"/>${def[1]}`);
};

/* ---- Carrier logos ---------------------------------------------------- */
ART.carrierLogo = function(carrier){
  return svg(120, 44, `
    <rect width="120" height="44" rx="8" fill="${carrier.color}"/>
    <text x="60" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800"
      font-size="18" fill="#fff" letter-spacing="1">${carrier.name.toUpperCase()}</text>
  `);
};
ART.carrierGlyph = function(carrier){
  return svg(44,44,`<rect width="44" height="44" rx="10" fill="${carrier.color}"/><text x="22" y="30" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="Arial">${carrier.glyph}</text>`);
};

/* ---- Wallpapers ------------------------------------------------------- */
const _wpCache = {};
ART.wallpaper = function(wp, w=300, h=620){
  // Cache per wallpaper+size: random-placed dots would otherwise re-roll on
  // every PHONE.render(), making a fixed wallpaper visibly flicker.
  const cacheKey = `${wp.id}_${w}x${h}`;
  if (_wpCache[cacheKey]) return _wpCache[cacheKey];
  const id = "wp_" + wp.id;
  let overlay = "";
  if (wp.style === "dots"){
    overlay = Array.from({length:60}).map(()=>`<circle cx="${(Math.random()*w).toFixed(0)}" cy="${(Math.random()*h).toFixed(0)}" r="${(Math.random()*6+1).toFixed(1)}" fill="#fff" opacity="${(Math.random()*0.4).toFixed(2)}"/>`).join("");
  } else if (wp.style === "grid"){
    let lines="";
    for(let x=0;x<=w;x+=30) lines+=`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#22d3ee" stroke-width="1" opacity="0.25"/>`;
    for(let y=0;y<=h;y+=30) lines+=`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#22d3ee" stroke-width="1" opacity="0.25"/>`;
    overlay=lines;
  } else if (wp.style === "photo"){
    // Stylized "photograph" — abstract subject on the gradient.
    if (wp.id==="family") overlay = `<g opacity="0.9"><circle cx="${w*0.38}" cy="${h*0.5}" r="34" fill="#f1c9a5"/><circle cx="${w*0.62}" cy="${h*0.52}" r="30" fill="#e0a97e"/><rect x="${w*0.28}" y="${h*0.58}" width="120" height="120" rx="30" fill="#334155"/></g>`;
    else if (wp.id==="car") overlay = `<g opacity="0.95"><path d="M${w*0.15} ${h*0.55} q${w*0.1}-40 ${w*0.35}-40 q${w*0.25} 0 ${w*0.35} 40 l0 30 h-${w*0.7}z" fill="#ef4444"/><circle cx="${w*0.3}" cy="${h*0.62}" r="18" fill="#111827"/><circle cx="${w*0.7}" cy="${h*0.62}" r="18" fill="#111827"/></g>`;
    else overlay = `<g opacity="0.95"><ellipse cx="${w*0.5}" cy="${h*0.55}" rx="60" ry="50" fill="#a16207"/><circle cx="${w*0.42}" cy="${h*0.48}" r="6" fill="#111"/><circle cx="${w*0.58}" cy="${h*0.48}" r="6" fill="#111"/><ellipse cx="${w*0.5}" cy="${h*0.6}" rx="12" ry="8" fill="#1c1917"/></g>`;
  }
  const out = svg(w, h, `<defs>${grad(id, wp.stops, 0,0, 0.4,1)}</defs><rect width="${w}" height="${h}" fill="url(#${id})"/>${overlay}`, `preserveAspectRatio="xMidYMid slice"`);
  _wpCache[cacheKey] = out;
  return out;
};

/* ---- Evidence items --------------------------------------------------- */
ART.evidence = function(kind){
  if (kind==="photo") return svg(160,160,`<rect width="160" height="160" rx="6" fill="#e5e7eb"/><rect x="8" y="8" width="144" height="120" fill="#0f172a"/><circle cx="80" cy="70" r="30" fill="#334155"/><rect x="50" y="100" width="60" height="30" fill="#1e293b"/><rect x="8" y="132" width="144" height="20" fill="#e5e7eb"/><text x="14" y="147" font-size="11" fill="#334155" font-family="monospace">EXHIBIT · CCTV</text>`);
  if (kind==="receipt") return svg(160,160,`<rect x="24" y="6" width="112" height="148" fill="#f8fafc"/><line x1="36" y1="30" x2="124" y2="30" stroke="#94a3b8" stroke-width="2"/>${Array.from({length:7}).map((_,i)=>`<line x1="36" y1="${48+i*13}" x2="${100+(i%3)*18}" y2="${48+i*13}" stroke="#cbd5e1" stroke-width="3"/>`).join("")}<rect x="36" y="132" width="88" height="12" fill="#0f172a"/>`);
  if (kind==="report") return svg(160,160,`<rect x="18" y="10" width="124" height="140" fill="#0b1220" stroke="#22d3ee"/><text x="30" y="34" fill="#22d3ee" font-size="12" font-family="monospace">FORENSICS</text>${Array.from({length:6}).map((_,i)=>`<line x1="30" y1="${52+i*14}" x2="${120-(i%2)*30}" y2="${52+i*14}" stroke="#334155" stroke-width="3"/>`).join("")}`);
  if (kind==="social") return svg(160,160,`<rect width="160" height="160" rx="10" fill="#fff"/><rect width="160" height="34" fill="#ec4899"/><circle cx="24" cy="17" r="10" fill="#fff"/><rect x="40" y="12" width="70" height="10" rx="3" fill="#fff"/><rect x="16" y="46" width="128" height="70" fill="#0f172a"/><rect x="16" y="124" width="90" height="8" fill="#cbd5e1"/><rect x="16" y="138" width="60" height="8" fill="#cbd5e1"/>`);
  return svg(160,160,`<rect width="160" height="160" rx="6" fill="#1e293b"/>`);
};

/* ---- Misc ------------------------------------------------------------- */
ART.badge = function(){
  return svg(120,140,`<defs>${grad("bg",["#fde68a","#d97706"])}</defs>
    <path d="M60 6 L110 26 V78 Q110 118 60 134 Q10 118 10 78 V26 Z" fill="url(#bg)" stroke="#92400e" stroke-width="3"/>
    <path d="M60 30 l7 15 16 1 -12 11 4 16 -15-9 -15 9 4-16 -12-11 16-1z" fill="#92400e"/>
    <text x="60" y="112" text-anchor="middle" font-size="12" font-weight="800" fill="#7c2d12" font-family="Arial">CYBER UNIT</text>`);
};
