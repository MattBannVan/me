/* =========================================================================
   CYBER CRIME FIGHTER — Game Engine / UI orchestration
   ========================================================================= */
(() => {
  const TIERS = ["rookie","detective","cyber","blackout"];
  const SUSPECTS = [
    { name:"“Silk” Moreau",  role:"The Fixer",       take:"opened the vault timer" },
    { name:"“Tonio” Vasquez",role:"The Wheelman",    take:"drove the getaway van" },
    { name:"“Delphine” Kade",role:"The Ringleader",  take:"moved the whole four million" },
  ];
  const TOTAL_CASES = 3;

  let root;
  const G = {
    floor: "rookie", caseIndex: 0, reputation: 0,
    cfg: {}, cur: null, idAttempts: 0, identified: false,
    timerId: null, timeLeft: 0, soundReady: false,
  };

  /* ---------- utilities ---------- */
  const $ = sel => root.querySelector(sel);
  const $$ = sel => Array.from(root.querySelectorAll(sel));
  function set(html){ root.innerHTML = html; }
  function tierForCase(floor, idx){
    const base = TIERS.indexOf(floor);
    return TIERS[Math.min(base + idx, TIERS.length - 1)];
  }
  function fadeIn(node){ node.classList.add("fade-in"); }

  /* ---------- typewriter cinematic ---------- */
  function cinematic(panels, onDone){
    let i = 0;
    function show(){
      const p = panels[i];
      const portrait = p.portrait === "badge" ? ART.badge()
        : p.portrait ? ART[p.portrait]() : "";
      set(`
        <div class="cine">
          <div class="cine-scene">${ART.scene(p.scene)}</div>
          <div class="cine-lower fade-in">
            ${portrait ? `<div class="cine-portrait">${portrait}</div>` : ""}
            <div class="cine-textwrap">
              ${p.speaker ? `<div class="cine-speaker">${p.speaker}</div>` : ""}
              <div class="cine-text" id="cineText"></div>
              <div class="cine-controls">
                <button class="btn ghost" id="cineSkip">Skip ⏭</button>
                <button class="btn" id="cineNext">${i === panels.length-1 ? "Continue ▶" : "Next ▶"}</button>
              </div>
            </div>
          </div>
        </div>`);
      typewrite($("#cineText"), p.text, ()=>{});
      $("#cineNext").onclick = () => { SFX.click(); i++; (i < panels.length) ? show() : onDone(); };
      $("#cineSkip").onclick = () => { SFX.click(); onDone(); };
    }
    show();
  }
  function typewrite(node, text, done){
    node.textContent = ""; let i = 0;
    const id = setInterval(() => {
      node.textContent += text[i] || "";
      if (i % 2 === 0) SFX.type();
      i++;
      if (i >= text.length){ clearInterval(id); done && done(); }
    }, 16);
    node.dataset.tid = id;
  }

  /* ---------- HUD ---------- */
  function hud(){
    return `<div class="hud">
      <div class="hud-badge">${ART.badge()}</div>
      <div class="hud-info">
        <div class="hud-title">CYBER CRIME FIGHTER</div>
        <div class="hud-sub">Case ${G.caseIndex+1} of ${TOTAL_CASES} · ${DIFFICULTY[tierForCase(G.floor,G.caseIndex)].label}</div>
      </div>
      <div class="hud-rep">
        <div class="hud-rep-label">REPUTATION</div>
        <div class="hud-rep-bar"><b style="width:${Math.max(0,Math.min(100,G.reputation))}%"></b></div>
      </div>
      <button class="btn ghost sm" id="sndBtn">${SFX.isOn()?"🔊":"🔇"}</button>
    </div>`;
  }
  function bindHud(){
    const b = $("#sndBtn");
    if (b) b.onclick = () => { SFX.toggle(!SFX.isOn()); b.textContent = SFX.isOn()?"🔊":"🔇"; };
  }

  /* ======================= TITLE ======================= */
  function screenTitle(){
    set(`
      <div class="title-screen fade-in">
        <div class="title-art">${ART.scene("interrogation")}</div>
        <div class="title-overlay">
          <div class="title-badge">${ART.badge()}</div>
          <h1 class="title-name">CYBER<span>CRIME</span>FIGHTER</h1>
          <p class="title-tag">A bank heist. A wiped phone. Four million missing.<br/>One broke tech grad is the city's last shot.</p>
          <div class="title-btns">
            <button class="btn big" id="startBtn">▶ Start the Story</button>
            <button class="btn ghost" id="skipStoryBtn">Skip to Difficulty</button>
          </div>
          <div class="title-foot">Deduction &amp; device-rebuild puzzle · a work of fiction · no real device is unlocked</div>
        </div>
      </div>`);
    $("#startBtn").onclick = () => { unlockSound(); SFX.ring(); cinematic(STORY.intro, screenDifficulty); };
    $("#skipStoryBtn").onclick = () => { unlockSound(); screenDifficulty(); };
  }
  function unlockSound(){ if(!G.soundReady){ SFX.resume(); G.soundReady = true; } }

  /* ======================= DIFFICULTY ======================= */
  function screenDifficulty(){
    set(`
      <div class="panel fade-in center-panel">
        <h2>Choose Your Clearance Level</h2>
        <p class="muted">Cases escalate each round. Higher clearance = fewer clues, more decoys, tighter margins, and a timer.</p>
        <div class="diff-grid">
          ${TIERS.map(t=>{const d=DIFFICULTY[t];return `
            <button class="diff-card" data-tier="${t}">
              <div class="diff-name">${d.label}</div>
              <ul class="diff-specs">
                <li>${d.idOptions} models in line-up</li>
                <li>${d.attrs} attributes to rebuild</li>
                <li>${Math.round(d.clueCoverage*100)}% clue coverage</li>
                <li>${d.threshold}% believability to crack them</li>
                <li>${d.timer?`⏱ ${d.timer}s timer`:"No timer"} · ${d.redHerrings} red herring${d.redHerrings===1?"":"s"}</li>
              </ul>
            </button>`}).join("")}
        </div>
      </div>`);
    $$(".diff-card").forEach(c => c.onclick = () => {
      SFX.select(); G.floor = c.dataset.tier; G.caseIndex = 0; G.reputation = 40;
      cinematic([{scene:"precinct",speaker:"DET. REYES",portrait:"detective",text:STORY.briefingIntro}], startCase);
    });
  }

  /* ======================= CASE START ======================= */
  function startCase(){
    const tier = tierForCase(G.floor, G.caseIndex);
    const suspect = SUSPECTS[G.caseIndex] || SUSPECTS[0];
    G.cur = generateCase(tier, G.caseIndex, suspect.name);
    G.cfg = {}; G.idAttempts = 0; G.identified = false;
    screenEvidence();
  }

  /* ======================= PHASE 1: EVIDENCE ======================= */
  function screenEvidence(){
    const c = G.cur;
    const suspect = SUSPECTS[G.caseIndex];
    const clues = c.attributes.filter(a=>a.clueGiven).map(a=>a.clue);
    const cards = shuffle(clues.concat(c.herrings));
    set(`${hud()}
      <div class="stage fade-in">
        <div class="stage-head">
          <h2>Evidence Board — ${suspect.name}</h2>
          <p class="muted">${suspect.role} · allegedly ${suspect.take}. Study the evidence, then identify the device. <b>${c.difficulty.redHerrings?"Watch for junk evidence.":""}</b></p>
        </div>
        <div class="evidence-grid">
          ${cards.map((cl,i)=>`
            <div class="evi-card ${cl.herring?'herring':''}" style="animation-delay:${i*70}ms">
              <div class="evi-art">${ART.evidence(cl.kind)}</div>
              <div class="evi-body">
                <div class="evi-title">${cl.title}</div>
                <div class="evi-text">${cl.text}</div>
              </div>
            </div>`).join("")}
        </div>
        <div class="stage-actions">
          <button class="btn big" id="toIdentify">Identify the Device ▶</button>
        </div>
      </div>`);
    bindHud();
    $("#toIdentify").onclick = () => { SFX.click(); screenIdentify(); };
  }

  /* ======================= PHASE 2: IDENTIFY ======================= */
  function screenIdentify(){
    const c = G.cur;
    set(`${hud()}
      <div class="stage fade-in">
        <div class="stage-head">
          <h2>Identify the Model</h2>
          <p class="muted">Physical evidence describes the handset. Match it to the exact model in the line-up.</p>
        </div>
        <div class="id-clue">
          <div><span>Form factor</span>${c.identifyClue.form}</div>
          <div><span>Rear camera</span>${c.identifyClue.camera}</div>
          <div><span>Size</span>${c.identifyClue.size}</div>
        </div>
        <div class="lineup">
          ${c.lineup.map(d=>`
            <button class="line-card" data-id="${d.id}">
              <div class="line-phone">${miniPhone(d)}</div>
              <div class="line-name">${d.brand} ${d.model}</div>
              <div class="line-os">${d.osName} · ${d.year}</div>
            </button>`).join("")}
        </div>
        <div class="id-feedback" id="idFeed"></div>
      </div>`);
    bindHud();
    $$(".line-card").forEach(card => card.onclick = () => {
      const picked = card.dataset.id;
      if (picked === c.device.id){
        SFX.correct(); card.classList.add("correct"); G.identified = true;
        $("#idFeed").innerHTML = `<div class="ok">✔ Match confirmed: <b>${c.device.brand} ${c.device.model}</b>. Now rebuild it.</div>`;
        $$(".line-card").forEach(x=>x.disabled=true);
        setTimeout(screenRebuild, 900);
      } else {
        SFX.wrong(); card.classList.add("wrong"); card.disabled = true;
        G.idAttempts++; G.reputation -= 4;
        $("#idFeed").innerHTML = `<div class="bad">✘ Not a match — that camera/notch doesn't fit the evidence. (−reputation)</div>`;
      }
    });
  }
  function miniPhone(d){
    const notch = d.form==="dynamic-island"?`<rect x="26" y="6" width="28" height="8" rx="4" fill="#000"/>`
      : d.form==="notch"?`<rect x="24" y="4" width="32" height="7" rx="3" fill="#000"/>`
      : d.form==="home-button"?`<circle cx="40" cy="128" r="8" fill="none" stroke="#000" stroke-width="2"/>`
      : `<circle cx="40" cy="10" r="3.5" fill="#000"/>`;
    const cam = {
      "square-triple":`<rect x="12" y="12" width="26" height="26" rx="8" fill="#111"/><circle cx="19" cy="19" r="4" fill="#333"/><circle cx="31" cy="19" r="4" fill="#333"/><circle cx="19" cy="31" r="4" fill="#333"/>`,
      "vertical-dual":`<rect x="14" y="12" width="14" height="30" rx="7" fill="#111"/><circle cx="21" cy="20" r="4" fill="#333"/><circle cx="21" cy="34" r="4" fill="#333"/>`,
      "horizontal-dual":`<rect x="12" y="14" width="30" height="14" rx="7" fill="#111"/><circle cx="20" cy="21" r="4" fill="#333"/><circle cx="34" cy="21" r="4" fill="#333"/>`,
      "horizontal-bar":`<rect x="8" y="12" width="48" height="12" rx="6" fill="#111"/><circle cx="18" cy="18" r="4" fill="#333"/><circle cx="30" cy="18" r="4" fill="#333"/>`,
      "pill-vertical":`<circle cx="18" cy="14" r="5" fill="#111"/><circle cx="18" cy="28" r="5" fill="#111"/><circle cx="18" cy="42" r="5" fill="#111"/>`,
      "single":`<circle cx="20" cy="18" r="7" fill="#111"/>`,
    }[d.camera] || "";
    const col = d.bodyColors ? d.bodyColors[0] : "#444";
    return `<svg viewBox="0 0 80 150" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="72" height="146" rx="16" fill="${col}"/>
      <rect x="9" y="7" width="62" height="136" rx="11" fill="#0b1220"/>
      ${notch}
      <g transform="translate(0,0)">${cam}</g>
    </svg>`;
  }

  /* ======================= PHASE 3: REBUILD ======================= */
  function screenRebuild(){
    const c = G.cur;
    // seed default config
    G.cfg = { device:c.device.id };
    c.attributes.forEach(a=>{
      if (a.type==="apps") G.cfg.apps = [];
      else G.cfg[a.key] = null;
    });
    // ensure preview has something for time/nav defaults
    G.cfg.timeFormat = G.cfg.timeFormat || "12h";

    set(`${hud()}
      <div class="rebuild fade-in">
        <div class="rebuild-left">
          <div class="rebuild-head">
            <h2>Rebuild the Decoy</h2>
            <p class="muted">Match every setting to the evidence. The suspect must believe this is <b>their</b> phone.</p>
          </div>
          ${c.difficulty.timer?`<div class="timer" id="timer">⏱ ${c.difficulty.timer}s</div>`:""}
          <div class="attr-list" id="attrList"></div>
          <div class="rebuild-actions">
            <div class="believe-preview" id="believePrev"></div>
            <button class="btn big" id="revealBtn">Show the Suspect ▶</button>
          </div>
        </div>
        <div class="rebuild-right">
          <div class="phone-mode-tabs">
            <button class="tab active" data-mode="lock">Lock</button>
            <button class="tab" data-mode="home">Home</button>
          </div>
          <div class="phone-stage" id="phoneStage"></div>
        </div>
      </div>`);
    bindHud();

    renderAttrs();
    let mode = "lock";
    const draw = () => PHONE.render($("#phoneStage"), c.device, G.cfg, mode);
    draw();
    $$(".phone-mode-tabs .tab").forEach(t=>t.onclick=()=>{
      $$(".phone-mode-tabs .tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active"); mode=t.dataset.mode; draw();
    });

    // expose redraw to attr handlers
    G._draw = draw;

    $("#revealBtn").onclick = () => { stopTimer(); computeAndReveal(); };

    if (c.difficulty.timer) startTimer(c.difficulty.timer);
  }

  function renderAttrs(){
    const c = G.cur;
    const host = $("#attrList");
    host.innerHTML = c.attributes.map((a,ai)=>{
      const clue = a.clueGiven ? `<span class="attr-clue" title="${a.clue.text.replace(/"/g,'&quot;')}">🔎 clue</span>`
                                : `<span class="attr-noclue" title="No evidence — you'll have to deduce this.">❔ no clue</span>`;
      let body = "";
      if (a.type==="apps"){
        const pool = shuffle(a.correct.concat(
          shuffle(APPS.filter(x=>!a.correct.includes(x.id)).map(x=>x.id)).slice(0, a.appExtra)
        ));
        body = `<div class="app-pick" data-attr="${a.key}">
          ${pool.map(id=>`<button class="app-opt" data-id="${id}">${ART.appIcon(id)}<span>${(getApp(id)||{}).name||id}</span></button>`).join("")}
        </div>`;
      } else if (a.type==="swatch"){
        body = `<div class="swatch-row" data-attr="${a.key}">
          ${a.options.map(o=>`<button class="swatch" data-val="${o.id}" style="background:${o.swatch}" title="${o.label}"></button>`).join("")}
        </div>`;
      } else {
        body = `<div class="opt-row" data-attr="${a.key}">
          ${a.options.map(o=>`<button class="opt" data-val="${o.id}">${o.wp?`<span class="wp-chip">${ART.wallpaper(getWallpaper(o.id),40,40)}</span>`:""}${o.label}</button>`).join("")}
        </div>`;
      }
      return `<div class="attr">
        <div class="attr-head"><span class="attr-n">${ai+1}</span><span class="attr-label">${a.label}</span>${clue}</div>
        ${body}
      </div>`;
    }).join("");

    // single-choice / swatch
    $$(".opt-row, .swatch-row").forEach(row=>{
      const key = row.dataset.attr;
      row.querySelectorAll("button").forEach(btn=>btn.onclick=()=>{
        SFX.select();
        row.querySelectorAll("button").forEach(b=>b.classList.remove("sel"));
        btn.classList.add("sel");
        G.cfg[key] = btn.dataset.val;
        G._draw && G._draw();
      });
    });
    // apps multi-select
    $$(".app-pick").forEach(row=>{
      row.querySelectorAll(".app-opt").forEach(btn=>btn.onclick=()=>{
        SFX.select();
        const id = btn.dataset.id;
        btn.classList.toggle("sel");
        const set = new Set(G.cfg.apps||[]);
        set.has(id) ? set.delete(id) : set.add(id);
        G.cfg.apps = [...set];
        G._draw && G._draw();
      });
    });
  }

  /* ---------- timer ---------- */
  function startTimer(seconds){
    G.timeLeft = seconds;
    const t = $("#timer");
    G.timerId = setInterval(()=>{
      G.timeLeft--;
      if (t) { t.textContent = `⏱ ${G.timeLeft}s`; t.classList.toggle("danger", G.timeLeft<=20); }
      if (G.timeLeft<=0){ stopTimer(); SFX.alarm(); computeAndReveal(true); }
    },1000);
  }
  function stopTimer(){ if (G.timerId){ clearInterval(G.timerId); G.timerId=null; } }

  /* ======================= SCORING ======================= */
  function score(){
    const c = G.cur; let total = 0; const breakdown = [];
    c.attributes.forEach(a=>{
      let got = 0;
      if (a.type==="apps"){
        const truth = new Set(a.correct);
        const chosen = new Set(G.cfg.apps||[]);
        let right=0, wrong=0;
        chosen.forEach(id=> truth.has(id)?right++:wrong++);
        const frac = Math.max(0, (right - wrong) / truth.size);
        got = Math.round(a.weight * frac);
      } else {
        got = (G.cfg[a.key] === a.correct) ? a.weight : 0;
      }
      total += got;
      breakdown.push({ label:a.label, got, weight:a.weight, ok: got>=a.weight });
    });
    // identify attempts penalty
    total = Math.max(0, total - G.idAttempts*3);
    return { total: Math.min(100, total), breakdown, threshold: c.difficulty.threshold };
  }

  function computeAndReveal(timeout=false){
    const s = score();
    const win = s.total >= s.threshold;
    if (win){ G.reputation = Math.min(100, G.reputation + 14); SFX.win(); }
    else { G.reputation = Math.max(0, G.reputation - 10); SFX.lose(); }
    screenReveal(s, win, timeout);
  }

  /* ======================= PHASE 4: REVEAL ======================= */
  function screenReveal(s, win, timeout){
    const c = G.cur;
    set(`${hud()}
      <div class="reveal fade-in">
        <div class="reveal-scene">${ART.scene("interrogation")}
          <div class="reveal-suspect">${ART.suspect()}</div>
          <div class="reveal-hand"><div class="reveal-phone" id="revPhone"></div></div>
        </div>
        <div class="reveal-panel">
          <h2>${win?"The Suspect Cracks":"The Suspect Smells a Fake"}</h2>
          <div class="meter">
            <div class="meter-row"><span>Believability</span><span>${s.total}% / ${s.threshold}% needed</span></div>
            <div class="meter-bar"><b class="${win?'good':'bad'}" style="width:${s.total}%"></b>
              <i class="meter-thresh" style="left:${s.threshold}%"></i></div>
          </div>
          <div class="breakdown">
            ${s.breakdown.map(b=>`<div class="bd-row ${b.ok?'ok':'no'}"><span>${b.ok?'✔':'✘'} ${b.label}</span><span>${b.got}/${b.weight}</span></div>`).join("")}
            ${G.idAttempts?`<div class="bd-row no"><span>✘ Mis-identified model ×${G.idAttempts}</span><span>−${G.idAttempts*3}</span></div>`:""}
          </div>
          ${timeout?`<div class="bad small">⏱ Time ran out — you presented an unfinished phone.</div>`:""}
          <button class="btn big" id="revContinue">Continue ▶</button>
        </div>
      </div>`);
    bindHud();
    PHONE.render($("#revPhone"), c.device, G.cfg, "home");

    $("#revContinue").onclick = () => {
      SFX.click();
      const story = win ? STORY.caseWin : STORY.caseLose;
      const panels = story.map(t => ({ scene:"interrogation", speaker:"", portrait:null, text:t }));
      cinematic(panels, () => {
        if (win){
          G.caseIndex++;
          if (G.caseIndex >= TOTAL_CASES) cinematic(STORY.finale, screenEndCard);
          else cinematic([{scene:"precinct",speaker:"DET. REYES",portrait:"detective",
            text:`“One down. Next suspect: ${SUSPECTS[G.caseIndex].name}, ${SUSPECTS[G.caseIndex].role}. Tougher nut. Let's move.”`}], startCase);
        } else {
          startCase(); // retry same slot with a fresh device — "we go again"
        }
      });
    };
  }

  /* ======================= END CARD ======================= */
  function screenEndCard(){
    set(`
      <div class="title-screen fade-in">
        <div class="title-art">${ART.scene("victory")}</div>
        <div class="title-overlay">
          <div class="title-badge">${ART.badge()}</div>
          <h1 class="title-name">CASE<span>CLOSED</span></h1>
          <p class="title-tag">Every dollar recovered. The Cyber Crime Unit just hired its newest recruit.<br/>Final reputation: <b>${Math.round(G.reputation)}%</b></p>
          <div class="title-btns">
            <button class="btn big" id="againBtn">▶ New Investigation</button>
          </div>
          <div class="title-foot">Thanks for playing · every round pulls a different device from the intel database</div>
        </div>
      </div>`);
    $("#againBtn").onclick = () => { SFX.click(); screenDifficulty(); };
  }

  /* ======================= BOOT ======================= */
  async function boot(){
    root = document.getElementById("app");
    await loadExternalDevices();
    screenTitle();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
