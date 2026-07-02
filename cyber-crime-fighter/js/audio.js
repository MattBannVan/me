/* =========================================================================
   CYBER CRIME FIGHTER — Sound (procedural WebAudio, no asset files)
   ========================================================================= */
const SFX = (() => {
  let ctx = null, enabled = true;
  function ac(){ if(!ctx){ try { ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(_){} } return ctx; }
  function tone(freq, dur, type="sine", vol=0.15, when=0){
    if(!enabled) return; const c = ac(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    toggle(v){ enabled = v; },
    isOn(){ return enabled; },
    resume(){ const c = ac(); if(c && c.state === "suspended") c.resume(); },
    click(){ tone(420, 0.06, "square", 0.08); },
    type(){ tone(1200 + Math.random()*300, 0.02, "square", 0.02); },
    select(){ tone(660, 0.08, "triangle", 0.1); },
    correct(){ tone(660,0.09,"sine",0.12,0); tone(880,0.12,"sine",0.12,0.08); },
    wrong(){ tone(200,0.18,"sawtooth",0.1); },
    boot(){ tone(300,0.15,"sine",0.1,0); tone(500,0.15,"sine",0.1,0.14); tone(760,0.3,"sine",0.12,0.28); },
    alarm(){ for(let i=0;i<4;i++){ tone(880,0.12,"square",0.12,i*0.18); tone(660,0.12,"square",0.12,i*0.18+0.09);} },
    win(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.35,"triangle",0.14,i*0.12)); },
    lose(){ [440,392,330,262].forEach((f,i)=>tone(f,0.3,"sine",0.12,i*0.14)); },
    ring(){ for(let i=0;i<2;i++){ tone(480,0.3,"sine",0.12,i*0.5); tone(620,0.3,"sine",0.12,i*0.5);} },
  };
})();
