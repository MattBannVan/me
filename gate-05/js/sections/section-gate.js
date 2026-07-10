/**
 * SECTION 1 — Departure Gate.
 *
 * Futuristic airport-style departure gate for Agent Cyber Lines Ltd.
 * The gate interior is an inline SVG illustration (fully editable — no
 * binary assets): window wall onto the launch pad with the VR craft,
 * glowing floor guide lines, gate desk, seating, and overhead signage.
 *
 * "Board VR Craft" advances the sequence (and unlocks the audio context,
 * since it is the first user gesture).
 */

export const id = 'gate';

let ctxRef = null;

export function mount(root, ctx) {
  ctxRef = ctx;
  const { carrier } = ctx.config;

  root.innerHTML = `
    <header class="gate-header">
      <div class="gate-id">${carrier.gate}</div>
      <div class="gate-carrier">
        <p class="carrier-name">${carrier.name}</p>
        <p class="carrier-tag">Flight ${carrier.flight} · ${carrier.craft}</p>
      </div>
    </header>

    <div class="gate-scene" role="img"
         aria-label="Interior of a futuristic departure gate: a glowing boarding corridor leads to a window wall overlooking the VR craft on its launch pad.">
      ${gateSceneSVG()}
    </div>

    <div class="gate-status">
      <span>DEP 05:00 UTC · PAD A-1</span>
      <span class="status-boarding">● NOW BOARDING</span>
      <span>SUIT-UP DECK · LEVEL 2</span>
    </div>

    <button class="acl-btn board-btn" id="board-btn" type="button">Board VR Craft</button>
  `;

  root.querySelector('#board-btn').addEventListener('click', onBoard);
}

async function onBoard() {
  // First user gesture — initialize the layered audio engine here.
  await ctxRef.audio.init();
  ctxRef.audio.play('sfx.uiConfirm');
  ctxRef.next();
}

export function teardown() {
  ctxRef = null;
}

/* -------------------------------------------------------------------- */
/* Gate interior artwork. Edit freely — pure SVG, grouped by element.    */
/* -------------------------------------------------------------------- */

function gateSceneSVG() {
  return `
  <svg viewBox="0 0 1200 560" xmlns="http://www.w3.org/2000/svg" font-family="monospace">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0a1230"/>
        <stop offset="0.6" stop-color="#14264d"/>
        <stop offset="1" stop-color="#27436e"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d1526"/>
        <stop offset="1" stop-color="#05070d"/>
      </linearGradient>
      <linearGradient id="ceilGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#05070d"/>
        <stop offset="1" stop-color="#0e1830"/>
      </linearGradient>
      <linearGradient id="portalGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bfeaff"/>
        <stop offset="1" stop-color="#4fd8ff"/>
      </linearGradient>
      <radialGradient id="craftGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#4fd8ff" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/>
      </radialGradient>
      <filter id="softGlow"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>

    <!-- ceiling -->
    <rect x="0" y="0" width="1200" height="120" fill="url(#ceilGrad)"/>
    <g stroke="#4fd8ff" stroke-opacity="0.5" stroke-width="2">
      <line x1="80"  y1="30" x2="360"  y2="118"/>
      <line x1="1120" y1="30" x2="840" y2="118"/>
    </g>
    <g fill="#9fe8ff">
      <rect x="180" y="52" width="150" height="5" rx="2.5" opacity="0.9"/>
      <rect x="870" y="52" width="150" height="5" rx="2.5" opacity="0.9"/>
      <rect x="420" y="24" width="360" height="4" rx="2" opacity="0.7"/>
    </g>

    <!-- window wall onto the pad -->
    <rect x="120" y="118" width="960" height="270" fill="url(#skyGrad)"/>
    <!-- pad skyline + gantry -->
    <g stroke="#3b5a8c" stroke-width="3" fill="none" opacity="0.9">
      <line x1="120" y1="352" x2="1080" y2="352"/>
      <path d="M 780 352 V 210 h 46 V 352 M 780 240 h 46 M 780 275 h 46 M 780 310 h 46"/>
    </g>
    <!-- VR craft on the pad -->
    <g>
      <ellipse cx="480" cy="330" rx="190" ry="60" fill="url(#craftGlow)"/>
      <g stroke="#0a1230" stroke-width="2">
        <path d="M 480 200 C 445 200 420 235 418 285 L 416 322 h 128 L 542 285 C 540 235 515 200 480 200 Z"
              fill="#dfe9f5"/>
        <path d="M 430 322 l -34 26 h 42 Z M 530 322 l 34 26 h -42 Z" fill="#b9c7d8"/>
        <rect x="440" y="322" width="80" height="14" rx="4" fill="#b9c7d8"/>
      </g>
      <circle cx="480" cy="250" r="14" fill="#0f2038" stroke="#4fd8ff" stroke-width="2"/>
      <path d="M 434 300 h 92" stroke="#7f95ad" stroke-width="3"/>
      <ellipse cx="480" cy="348" rx="60" ry="7" fill="#4fd8ff" opacity="0.5" filter="url(#softGlow)"/>
    </g>
    <!-- distant towers -->
    <g fill="#1d3357">
      <rect x="140" y="250" width="36" height="102"/>
      <rect x="196" y="278" width="26" height="74"/>
      <rect x="960" y="262" width="42" height="90"/>
      <rect x="1022" y="288" width="24" height="64"/>
    </g>
    <g fill="#4fd8ff" opacity="0.8">
      <rect x="148" y="262" width="5" height="5"/><rect x="160" y="286" width="5" height="5"/>
      <rect x="968" y="274" width="5" height="5"/><rect x="984" y="300" width="5" height="5"/>
    </g>
    <!-- window mullions -->
    <g stroke="#131f38" stroke-width="10">
      <line x1="120" y1="118" x2="120" y2="388"/>
      <line x1="360" y1="118" x2="360" y2="388"/>
      <line x1="600" y1="118" x2="600" y2="388"/>
      <line x1="840" y1="118" x2="840" y2="388"/>
      <line x1="1080" y1="118" x2="1080" y2="388"/>
      <line x1="114" y1="122" x2="1086" y2="122"/>
      <line x1="114" y1="386" x2="1086" y2="386"/>
    </g>

    <!-- side walls -->
    <path d="M 0 0 L 120 118 V 388 L 0 560 Z" fill="#0a101d"/>
    <path d="M 1200 0 L 1080 118 V 388 L 1200 560 Z" fill="#0a101d"/>
    <g stroke="#4fd8ff" stroke-opacity="0.35" stroke-width="2">
      <line x1="30" y1="150" x2="98" y2="188"/>
      <line x1="30" y1="330" x2="98" y2="308"/>
      <line x1="1170" y1="150" x2="1102" y2="188"/>
      <line x1="1170" y1="330" x2="1102" y2="308"/>
    </g>

    <!-- overhead gate sign -->
    <g>
      <rect x="440" y="58" width="320" height="52" rx="10" fill="#0c1220" stroke="#4fd8ff" stroke-width="2"/>
      <text x="600" y="86" text-anchor="middle" fill="#4fd8ff" font-size="26" font-weight="bold" letter-spacing="6">GATE 05</text>
      <text x="600" y="103" text-anchor="middle" fill="#8ea3c4" font-size="11" letter-spacing="3">AGENT CYBER LINES LTD.</text>
    </g>

    <!-- floor -->
    <rect x="0" y="388" width="1200" height="172" fill="url(#floorGrad)"/>
    <!-- glowing guide lines converging on the boarding portal -->
    <g stroke="#4fd8ff" stroke-width="3" opacity="0.85" filter="url(#softGlow)">
      <line x1="330" y1="560" x2="552" y2="392"/>
      <line x1="870" y1="560" x2="648" y2="392"/>
    </g>
    <g stroke="#1f2c47" stroke-width="2">
      <line x1="0" y1="440" x2="1200" y2="440"/>
      <line x1="0" y1="500" x2="1200" y2="500"/>
    </g>

    <!-- boarding portal at the center of the window wall -->
    <g>
      <rect x="552" y="180" width="96" height="212" rx="8" fill="#dff6ff" opacity="0.95"/>
      <rect x="560" y="188" width="80" height="204" rx="6" fill="url(#portalGrad)" filter="url(#softGlow)"/>
      <rect x="544" y="172" width="112" height="226" rx="10" fill="none" stroke="#4fd8ff" stroke-width="3"/>
      <text x="600" y="166" text-anchor="middle" fill="#9fe8ff" font-size="12" letter-spacing="4">BOARDING</text>
    </g>

    <!-- gate desk -->
    <g>
      <path d="M 150 480 h 210 l 26 -56 h -210 Z" fill="#101a30" stroke="#26385c" stroke-width="2"/>
      <path d="M 176 424 h 210 v -8 h -210 Z" fill="#4fd8ff" opacity="0.55"/>
      <rect x="238" y="368" width="70" height="44" rx="5" fill="#0c1220" stroke="#4fd8ff" stroke-width="2"/>
      <text x="273" y="395" text-anchor="middle" fill="#4fd8ff" font-size="13" letter-spacing="2">ACL-05</text>
    </g>

    <!-- seating row -->
    <g fill="#101a30" stroke="#26385c" stroke-width="2">
      <path d="M 840 470 h 60 v -34 h 8 v 44 h -76 v -44 h 8 Z"/>
      <path d="M 930 470 h 60 v -34 h 8 v 44 h -76 v -44 h 8 Z"/>
      <path d="M 1020 470 h 60 v -34 h 8 v 44 h -76 v -44 h 8 Z"/>
    </g>
    <g stroke="#4fd8ff" stroke-width="2" opacity="0.5">
      <line x1="838" y1="482" x2="1092" y2="482"/>
    </g>

    <!-- holo departure board -->
    <g>
      <rect x="150" y="180" width="176" height="120" rx="8" fill="#081020" opacity="0.92" stroke="#2c4a7c" stroke-width="2"/>
      <text x="164" y="204" fill="#9fe8ff" font-size="12" letter-spacing="2">DEPARTURES</text>
      <g font-size="10" fill="#8ea3c4">
        <text x="164" y="228">ACL-0500  PAD A-1</text>
        <text x="164" y="248">ACL-0512  PAD B-4</text>
        <text x="164" y="268">ACL-0524  PAD C-2</text>
      </g>
      <g font-size="10" fill="#55e6a5">
        <text x="292" y="228">BRD</text>
      </g>
      <g font-size="10" fill="#ffc24b">
        <text x="292" y="248">DLY</text>
        <text x="292" y="268">SKD</text>
      </g>
    </g>
  </svg>`;
}
