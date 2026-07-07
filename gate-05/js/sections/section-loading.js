/**
 * SECTION 3 — Loading / Flight Setup In Progress.
 *
 * Dedicated slot (#flight-setup-graphic) for an animated graphic that
 * represents the flight setup. A built-in animated SVG (orbiting craft
 * over a spinning diagnostic ring) plays by default; provide
 * config.loading.graphicUrl — or replace the slot's contents — to swap
 * in a custom animation without touching the rest of the section.
 *
 * When the setup phases complete, the sequencer fades (to white) into
 * the SpaceX onboarding deck.
 */

export const id = 'loading';

let ctxRef = null;
let timers = [];

export function mount(root, ctx) {
  ctxRef = ctx;

  root.innerHTML = `
    <div class="loading-stack">
      <div id="flight-setup-graphic" aria-label="Flight setup in progress"></div>
      <h1 class="loading-title">Flight Setup In Progress</h1>
      <p class="loading-phase" id="loading-phase">Initializing …</p>
      <div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loading-bar">
        <div class="bar-fill" id="bar-fill"></div>
      </div>
    </div>
  `;

  const slot = root.querySelector('#flight-setup-graphic');
  const { graphicUrl } = ctx.config.loading;
  if (graphicUrl) {
    const img = document.createElement('img');
    img.src = graphicUrl;
    img.alt = 'Flight setup animation';
    slot.appendChild(img);
  } else {
    slot.innerHTML = defaultFlightSetupSVG();
  }
}

export function start(ctx) {
  const { phases, durationMs } = ctx.config.loading;
  const phaseEl = document.getElementById('loading-phase');
  const fill = document.getElementById('bar-fill');
  const bar = document.getElementById('loading-bar');
  const step = durationMs / phases.length;

  phases.forEach((label, i) => {
    timers.push(setTimeout(() => {
      phaseEl.textContent = label;
      const pct = Math.round(((i + 1) / phases.length) * 100);
      fill.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', String(pct));
      ctx.audio.play('sfx.uiConfirm');
    }, step * i));
  });

  // All phases complete → fade into the onboarding deck.
  timers.push(setTimeout(() => ctx.next(), durationMs + 700));
}

export function teardown() {
  timers.forEach(clearTimeout);
  timers = [];
  ctxRef = null;
}

/* -------------------------------------------------------------------- */
/* Default flight-setup animation: capsule orbiting a spinning           */
/* diagnostic ring with sweeping radar arc. Pure SMIL/CSS SVG.           */
/* -------------------------------------------------------------------- */

function defaultFlightSetupSVG() {
  return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated flight setup diagnostic">
    <defs>
      <radialGradient id="ringGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.55" stop-color="#4fd8ff" stop-opacity="0"/>
        <stop offset="0.85" stop-color="#4fd8ff" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#4fd8ff" stop-opacity="0"/>
        <stop offset="1" stop-color="#4fd8ff" stop-opacity="0.6"/>
      </linearGradient>
    </defs>

    <circle cx="100" cy="100" r="96" fill="url(#ringGlow)"/>

    <!-- outer dashed diagnostic ring (slow spin) -->
    <g>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#1f2c47" stroke-width="2"/>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#4fd8ff" stroke-width="2"
              stroke-dasharray="10 14" stroke-linecap="round" opacity="0.8">
        <animateTransform attributeName="transform" type="rotate"
                          from="0 100 100" to="360 100 100" dur="14s" repeatCount="indefinite"/>
      </circle>
    </g>

    <!-- radar sweep -->
    <g>
      <path d="M 100 100 L 100 30 A 70 70 0 0 1 148 49 Z" fill="url(#sweep)">
        <animateTransform attributeName="transform" type="rotate"
                          from="0 100 100" to="360 100 100" dur="3.2s" repeatCount="indefinite"/>
      </path>
      <circle cx="100" cy="100" r="70" fill="none" stroke="#26385c" stroke-width="1.5"/>
      <circle cx="100" cy="100" r="46" fill="none" stroke="#26385c" stroke-width="1"/>
      <line x1="30" y1="100" x2="170" y2="100" stroke="#1a2742" stroke-width="1"/>
      <line x1="100" y1="30" x2="100" y2="170" stroke="#1a2742" stroke-width="1"/>
    </g>

    <!-- planet / pad marker -->
    <circle cx="100" cy="100" r="14" fill="#0c1220" stroke="#4fd8ff" stroke-width="2">
      <animate attributeName="stroke-opacity" values="1;0.35;1" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="100" cy="100" r="4" fill="#4fd8ff"/>

    <!-- capsule on orbit -->
    <g>
      <animateTransform attributeName="transform" type="rotate"
                        from="0 100 100" to="360 100 100" dur="5.5s" repeatCount="indefinite"/>
      <g transform="translate(100 30)">
        <path d="M -6 4 C -6 -3 -3 -7 0 -7 C 3 -7 6 -3 6 4 Z" fill="#dfe9f5"/>
        <rect x="-6" y="4" width="12" height="3" rx="1.5" fill="#8fa5bd"/>
        <circle cx="0" cy="-1" r="2" fill="#0f2038"/>
      </g>
    </g>

    <!-- telemetry ticks -->
    <g fill="#4fd8ff" font-family="monospace" font-size="7" opacity="0.85" text-anchor="middle">
      <text x="100" y="14">ACL-0500</text>
      <text x="100" y="192">FLIGHT SETUP</text>
    </g>
  </svg>`;
}
