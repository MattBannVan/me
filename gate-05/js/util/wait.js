/**
 * Dual-source wait: resolves via setTimeout OR a rAF-driven clock,
 * whichever comes first.
 *
 * Some environments (notably headless/embedded browsers under heavy WebGL
 * load, or pages that haven't seen user input for a while) can defer a
 * one-off timer indefinitely. Every timing-critical wait in the experience
 * goes through this so sequencing never hinges on a single bare timer —
 * requestAnimationFrame keeps ticking as long as the page renders.
 */
export const wait = (ms) => new Promise((resolve) => {
  let done = false;
  const finish = () => { if (!done) { done = true; resolve(); } };
  setTimeout(finish, ms);
  const t0 = performance.now();
  (function tick() {
    if (done) return;
    if (performance.now() - t0 >= ms) { finish(); return; }
    requestAnimationFrame(tick);
  })();
});
