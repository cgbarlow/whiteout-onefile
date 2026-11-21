// HUD view: binds the #hud DOM from template.html and writes to it ONLY when a (quantised) value changed.
//   const v = createHudView(G, root); v.frame(snap, dt)  — snap = { objective, prompt, hold, fear, stamina, battery,
//   torchOn, gens: ['off'|'cranking'|'running' ×3], running, look } (a reused object, filled by index.js)
//   v.toast(text, seconds) · v.reset()
// No per-frame allocation: strings are only built inside the change branches.
const PROMPT_HOLD = /^Hold E\s+(.+)$/i, PROMPT_PRESS = /^E\s+(.+)$/i, OBJ_COUNT = /^(.*?)\s{2,}(\d\/\d)\s*$/;
const IDS = ['A', 'B', 'C'];

export function createHudView(G, root) {
  const q = (s) => root.querySelector(s);
  const el = {
    obj: q('[data-bind="objective"]'), gens: q('[data-bind="gens"]'), toast: q('[data-bind="toast"]'),
    ring: q('.hud-hold'), ringFg: q('[data-bind="hold"]'), prompt: q('[data-bind="prompt"]'),
    pk: q('.hud-prompt .pk'), pm: q('.hud-prompt .pm'), pt: q('.hud-prompt .pt'), look: q('[data-bind="look"]'),
    torch: q('[data-bind="torchBox"]'), battery: q('[data-bind="battery"]'), pct: q('[data-bind="batteryPct"]'),
    breath: q('[data-bind="breathBox"]'), stamina: q('[data-bind="stamina"]'), fear: q('[data-bind="fear"]'),
    pips: IDS.map((id) => q(`.pip[data-gen="${id}"]`)),
  };
  // last written values (NaN / null = force the first write)
  const L = { obj: null, prompt: null, hold: NaN, ringOn: null, fear: NaN, pulse: null, bat: NaN, pct: NaN, torchOn: null, low: null,
    sta: NaN, breathOn: null, tired: null, running: NaN, look: null, gens: ['', '', ''], hasPrompt: null };
  let toastT = 0;

  // 'Headline  detail' (double space) → uppercase headline + a sentence-case detail line under it, so
  // 'Beacon live  call extraction from the radio hut' never runs together as one block of capitals
  const sub = document.createElement('span'); sub.className = 'hud-obj-s';
  function setObjective(s) {
    const m = OBJ_COUNT.exec(s || '');
    const t = m ? m[1] : (s || ''), i = t.search(/\s{2,}/);
    el.obj.textContent = i < 0 ? t : t.slice(0, i);
    if (i >= 0) { const d = t.slice(i).trim(); sub.textContent = d.charAt(0).toUpperCase() + d.slice(1); el.obj.appendChild(sub); }
    el.obj.classList.remove('flash'); void el.obj.offsetWidth; el.obj.classList.add('flash');
  }
  function setPrompt(s) {
    let mode = '', text = '';
    if (s) {
      let m = PROMPT_HOLD.exec(s);
      if (m) { mode = 'hold'; text = m[1]; } else if ((m = PROMPT_PRESS.exec(s))) { mode = 'press'; text = m[1]; } else { mode = 'info'; text = s; }
    }
    el.prompt.dataset.mode = mode; el.pt.textContent = text;
    const has = mode === 'hold' || mode === 'press';
    if (has !== L.hasPrompt) { L.hasPrompt = has; root.dataset.prompt = has ? '1' : '0'; }
  }

  const V = {
    frame(s, dt) {
      if (s.objective !== L.obj) { L.obj = s.objective; setObjective(s.objective); }
      if (s.prompt !== L.prompt) { L.prompt = s.prompt; setPrompt(s.prompt); }
      const h = Math.round(Math.max(0, Math.min(1, s.hold || 0)) * 100) / 100;
      if (h !== L.hold) { L.hold = h; el.ringFg.style.strokeDashoffset = String(1 - h); }
      const ringOn = h > 0;
      if (ringOn !== L.ringOn) { L.ringOn = ringOn; el.ring.classList.toggle('on', ringOn); }
      const f = Math.round(Math.max(0, Math.min(1, s.fear || 0)) * 40) / 40;
      if (f !== L.fear) { L.fear = f; el.fear.style.opacity = String(f); }
      const pulse = f > 0.7;
      if (pulse !== L.pulse) { L.pulse = pulse; el.fear.classList.toggle('pulse', pulse); }
      // torch
      const b = Math.round(Math.max(0, Math.min(1, s.battery)) * 200) / 200;
      if (b !== L.bat) { L.bat = b; el.battery.style.transform = `scaleX(${b})`; }
      const pct = Math.ceil(b * 100);
      if (pct !== L.pct) { L.pct = pct; el.pct.textContent = String(pct); }
      if (s.torchOn !== L.torchOn) { L.torchOn = s.torchOn; el.torch.classList.toggle('off', !s.torchOn); }
      const low = b < 0.2;
      if (low !== L.low) { L.low = low; el.torch.classList.toggle('low', low); }
      // breath: only visible while it is being spent / recovering
      const st = Math.round(Math.max(0, Math.min(1, s.stamina)) * 100) / 100;
      if (st !== L.sta) { L.sta = st; el.stamina.style.transform = `scaleX(${st})`; }
      const bOn = st < 0.99;
      if (bOn !== L.breathOn) { L.breathOn = bOn; el.breath.classList.toggle('on', bOn); }
      const tired = st < 0.15;
      if (tired !== L.tired) { L.tired = tired; el.breath.classList.toggle('tired', tired); }
      // generator pips
      for (let i = 0; i < 3; i++) if (s.gens[i] !== L.gens[i]) { L.gens[i] = s.gens[i]; el.pips[i].dataset.s = s.gens[i]; }
      if (s.running !== L.running) { L.running = s.running; el.gens.textContent = `${s.running}/3`; }
      if (s.look !== L.look) { L.look = s.look; el.look.classList.toggle('on', s.look); }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('on'); }
    },
    toast(text, sec = 3.2) { el.toast.textContent = text; el.toast.classList.add('on'); toastT = sec; },
    reset() { toastT = 0; el.toast.classList.remove('on'); },
  };
  return V;
}
