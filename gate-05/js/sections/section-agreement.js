/**
 * SECTION 2 — User Liability / User Agreement / Safety Warning.
 *
 * Shown after "Board VR Craft". The passenger must confirm they have read
 * and agree before boarding continues. Declining returns to the gate.
 */

import { wait } from '../util/wait.js';

export const id = 'agreement';

let ctxRef = null;

export function mount(root, ctx) {
  ctxRef = ctx;
  const { carrier } = ctx.config;

  root.innerHTML = `
    <div class="agreement-card" role="dialog" aria-labelledby="agreement-title" aria-modal="true">
      <div class="agreement-head">
        <h1 id="agreement-title">Passenger Liability & Safety Agreement</h1>
        <span class="warn-strip">⚠ SAFETY WARNING — READ BEFORE BOARDING · ${carrier.flight}</span>
      </div>

      <div class="agreement-body" id="agreement-body">
        <h2>1. Assumption of Risk</h2>
        <p>
          Boarding the ${carrier.craft} operated by ${carrier.name} is a fully
          immersive virtual-reality experience. By boarding you acknowledge that
          simulated launch, acceleration, zero-gravity, and re-entry sequences may
          be intense, and you voluntarily assume all risks associated with
          participation.
        </p>

        <h2>2. Health & Safety Warning</h2>
        <ul>
          <li>Do not participate if you are pregnant, have a heart condition, epilepsy, or are prone to seizures, motion sickness, or vertigo.</li>
          <li>Some passengers may experience dizziness, disorientation, eye strain, or nausea. Stop immediately if you feel unwell.</li>
          <li>Remain within the designated play area. The experience includes standing, turning, and walking movements.</li>
          <li>Follow all instructions given by onboarding specialists at all times.</li>
          <li>Take at least a 10–15 minute break every 30 minutes of continuous use.</li>
        </ul>

        <h2>3. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, ${carrier.name}, its officers,
          crew, and onboarding specialists shall not be liable for any injury,
          loss, or damage — direct or indirect — arising from participation in
          this experience, except where caused by proven gross negligence.
        </p>

        <h2>4. Passenger Conduct</h2>
        <p>
          You agree not to interfere with flight systems, other passengers, or
          crew. The flight director may terminate the experience at any time for
          safety reasons without refund of fare.
        </p>

        <h2>5. Data & Telemetry</h2>
        <p>
          Motion, orientation, and interaction telemetry is processed on-craft
          solely to render the experience and provide haptic feedback. No
          biometric data leaves the craft.
        </p>

        <h2>6. Acknowledgement</h2>
        <p>
          By selecting <strong>“I Have Read &amp; Agree”</strong> you confirm that you
          have read, understood, and accepted this agreement and the safety
          warnings above, and that you are medically fit to participate.
        </p>
      </div>

      <div class="agreement-actions">
        <p class="decline-note" id="decline-note">Agreement declined — returning to gate.</p>
        <button class="acl-btn acl-btn--danger" id="decline-btn" type="button">Decline</button>
        <button class="acl-btn" id="accept-btn" type="button">I Have Read &amp; Agree — Accept</button>
      </div>
    </div>
  `;

  root.querySelector('#accept-btn').addEventListener('click', onAccept);
  root.querySelector('#decline-btn').addEventListener('click', onDecline);
}

async function onAccept() {
  ctxRef.audio.play('sfx.uiConfirm');
  // Enter the immersive VR session here — requestSession must be called
  // from a user gesture. From this point the experience runs in-headset;
  // if WebXR is unavailable the flat 2D fallback continues instead.
  if (ctxRef.config.vr.enabled) await ctxRef.stage.tryEnter();
  ctxRef.next();
}

async function onDecline() {
  const note = document.getElementById('decline-note');
  note.classList.add('is-visible');
  // Give the passenger a beat to read the notice, then back to the gate.
  await wait(1600);
  if (ctxRef) ctxRef.goTo('gate');
}

export function teardown() {
  ctxRef = null;
}
