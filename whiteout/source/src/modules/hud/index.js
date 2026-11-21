// HUD / UI state machine over the DOM in template.html: title (live PATH flyover) → playing ⇄ paused, settings,
// end (caught / extracted). HUD (view.js): objective + generator pips, prompt + hold ring, torch / breath meters,
// fear vignette, event toasts.
//   create(G, { input, game, flashlight, quality, path }) → { state, setState(s), set(bind, value), update }
// ?shot=1 or ?autostart=1 skips the title (captures/bots). Settings persist in localStorage (try/catch; ignored under
// ?shot / ?show so captures are repeatable). Sets G.paused while not playing. Listens 'game:end' → end screen,
// 'gen:state' / 'beacon:on' → toasts; restart buttons emit G 'restart'.
// ?show=hud → frozen demo values over the spawn view; ?show=hud&ui=title|pause|settings|won|lost frames each screen.
import { CatmullRomCurve3, Vector3 } from 'three';
import { createHudView } from './view.js';

const KEY = 'whiteout.settings.v1';
const FLY_SECONDS = 48;
const IDS = ['A', 'B', 'C'];
const END = {
  won: { kicker: 'Transmission received', title: 'Extracted', text: 'The beacon holds. A rotor thrum rises out of the white.' },
  lost: { kicker: 'Signal lost', title: 'Taken', text: 'Something found you between the buildings. The station goes quiet again.' },
};
const clock = (t) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; };

export function create(G, { input, game, flashlight, quality, path }) {
  const $ = (s) => document.querySelector(s);
  const el = { ui: $('#ui'), title: $('#title'), pause: $('#pause'), settings: $('#settings'), hud: $('#hud'), end: $('#end') };
  const binds = {}; document.querySelectorAll('[data-bind]').forEach((n) => { binds[n.dataset.bind] = n; });
  const view = createHudView(G, el.hud);
  const cutEl = el.ui.querySelector('.cut');
  const cut = () => { if (!cutEl) return; cutEl.classList.remove('go'); void cutEl.offsetWidth; cutEl.classList.add('go'); };
  const P = G.params;
  const demo = P.get('show') === 'hud';
  const repeatable = !!(P.get('shot') || P.get('show'));
  const baseExposure = G.post?.params?.exposure ?? 1;
  const settings = { quality: 'auto', sens: 1, fov: G.camera.fov, volume: 0.8, invertY: false, brightness: 1 };
  if (!repeatable) try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked storage */ }
  const U = { state: 'boot', settings, demo };
  let back = 'title';

  // ---------- settings ----------
  const form = el.settings?.querySelector('form');
  const outs = {}; form?.querySelectorAll('output[data-out]').forEach((o) => { outs[o.dataset.out] = o; });
  const fmt = { sens: (v) => (+v).toFixed(2), fov: (v) => `${v}°`, volume: (v) => `${Math.round(v * 100)}%`, brightness: (v) => (+v).toFixed(2), invertY: (v) => (v ? 'On' : 'Off') };
  function showValues() {
    if (!form) return;
    for (const k in fmt) {
      const f = form.elements[k]; if (!f) continue;
      if (outs[k]) outs[k].textContent = fmt[k](f.type === 'checkbox' ? f.checked : f.value);
      if (f.type === 'range') f.style.setProperty('--v', ((f.value - f.min) / (f.max - f.min)) * 100 + '%');
    }
  }
  function apply(save) {
    input.sens = 0.0022 * settings.sens; input.invertY = !!settings.invertY;
    if (G.camera.fov !== +settings.fov) { G.camera.fov = +settings.fov; G.camera.updateProjectionMatrix(); }
    if (!P.get('shot') && !P.get('q')) {
      if (settings.quality !== 'auto' && quality && settings.quality !== G.quality.tier) { G.quality.pinned = true; quality.setTier(settings.quality, 'settings'); }
      if (settings.quality === 'auto' && G.quality.pinned) G.quality.pinned = false;
    }
    G.mods?.audio?.setVolume?.(+settings.volume);
    if (G.post?.params && 'exposure' in G.post.params) G.post.params.exposure = baseExposure * +settings.brightness;
    if (save) try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  if (form) {
    for (const k in settings) { const f = form.elements[k]; if (!f) continue; if (f.type === 'checkbox') f.checked = !!settings[k]; else f.value = settings[k]; }
    form.addEventListener('input', () => {
      for (const k in settings) { const f = form.elements[k]; if (!f) continue; settings[k] = f.type === 'checkbox' ? f.checked : f.type === 'range' ? +f.value : f.value; }
      showValues(); apply(true);
    });
    showValues();
  }
  apply(false);

  // ---------- state machine ----------
  const sections = ['title', 'pause', 'settings', 'hud', 'end'];
  const shown = { title: 'title', paused: 'pause', settings: 'settings', playing: 'hud', end: 'end' };
  U.setState = (s) => {
    if (s === U.state) return;
    const prev = U.state; U.state = s; el.ui.dataset.state = s;
    for (const k of sections) if (el[k]) el[k].hidden = shown[s] !== k;
    G.paused = s !== 'playing';
    input.enabled = s === 'playing' && !demo;
    if (game?.player) game.player.enabled = s === 'playing' && !demo;
    if (s === 'playing' && (prev === 'title' || prev === 'end')) { G.camLocked = demo; cut(); }
    if (s === 'paused') { U.set('pauseTime', clock(game?.time || 0)); U.set('pauseGens', `${snap.running}/3`); }
    if (s !== 'playing' && document.pointerLockElement) document.exitPointerLock();
    const first = el[shown[s]]?.querySelector('.btn-primary');
    if (first && s !== 'playing' && !repeatable) first.focus({ preventScroll: true });
    G.emit('ui:state', s, prev);
  };
  const last = {};
  U.set = (k, v) => {
    const n = binds[k]; if (!n || last[k] === v) return;
    last[k] = v; n.textContent = v ?? '';
  };
  // pointer lock needs a user gesture: request it inside the click handler, never from the frame loop
  const lock = () => { if (!repeatable && input.mode === 'lock' && !input.locked) input.requestLock(); };
  el.ui.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'start' || act === 'resume') { lock(); U.setState('playing'); }
    else if (act === 'settings') { back = U.state; U.setState('settings'); }
    else if (act === 'back') U.setState(back);
    else if (act === 'restart') { G.emit('restart'); lock(); U.setState('playing'); }
    else if (act === 'title') { G.emit('restart'); U.setState('title'); }
  });
  G.on('input:unlock', () => { if (U.state === 'playing' && input.mode === 'lock' && !demo) U.setState('paused'); });
  function showEnd(res, time) {
    const e = END[res === 'won' ? 'won' : 'lost'];
    el.end.dataset.res = res === 'won' ? 'won' : 'lost';
    U.set('endKicker', e.kicker); U.set('endTitle', e.title); U.set('endText', e.text);
    U.set('endTime', clock(time || 0)); U.set('endGens', `${snap.running}/3`);
    const h = binds.endTitle; if (h) h.dataset.text = e.title;
    U.setState('end');
  }
  G.on('game:end', (res, time) => { if (!demo) showEnd(res, time); });
  G.on('gen:state', (id, st) => { if (st === 'running' && !demo) view.toast(`Generator ${id} · online`); });
  G.on('beacon:on', () => { if (!demo) view.toast('Beacon live · call from the radio hut', 4.5); });
  G.on('game:start', () => view.reset());

  // ---------- HUD snapshot (reused object; filled from the game, or frozen demo values) ----------
  const snap = { objective: '', prompt: '', hold: 0, fear: 0, stamina: 1, battery: 1, torchOn: true, gens: ['off', 'off', 'off'], running: 0, look: false };
  let unlockedT = 0;
  function fill(dt) {
    if (demo) return;
    if (game) { snap.objective = game.objective; snap.prompt = game.prompt; snap.hold = game.hold || 0; snap.fear = game.fear || 0; snap.stamina = game.player?.stamina ?? 1; }
    if (flashlight) { snap.battery = flashlight.battery ?? 1; snap.torchOn = !!flashlight.on; }
    const list = G.mods?.generators?.list;
    let n = 0;
    for (let i = 0; i < 3; i++) {
      let st = 'off';
      if (list) for (let j = 0; j < list.length; j++) if (list[j].id === IDS[i]) { st = list[j].state; break; }
      snap.gens[i] = st; if (st === 'running') n++;
    }
    snap.running = list ? n : (game?.gens ?? 0);
    unlockedT = input.mode === 'lock' && !input.locked && !repeatable ? unlockedT + dt : 0;
    snap.look = unlockedT > 0.9;
  }
  if (demo) Object.assign(snap, { objective: 'Restart the generators  1/3', prompt: 'Hold E  crank GEN B', hold: 0.62, fear: 0.42,
    stamina: 0.46, battery: 0.68, torchOn: true, gens: ['running', 'cranking', 'off'], running: 1 });

  // ---------- title flyover along PATH (closed loop, constant speed); bench/captures that lock the camera win ----------
  const K = path && path.length > 1 ? path : null;
  const cp = K && new CatmullRomCurve3(K.map((k) => new Vector3(k[0], k[1], k[2])), true, 'centripetal');
  const ct = K && new CatmullRomCurve3(K.map((k) => new Vector3(k[3], k[4], k[5])), true, 'centripetal');
  const a = new Vector3(), b = new Vector3();
  let flyT = 0, readT = 0;

  U.update = (dt) => {
    if (input.pressed('pause')) {
      if (U.state === 'playing' && !demo) U.setState('paused');
      else if (U.state === 'paused') U.setState('playing');
      else if (U.state === 'settings') U.setState(back);
    }
    if (U.state === 'title') {
      if (cp && !G.camLocked) {
        flyT = (flyT + dt / FLY_SECONDS) % 1;
        cp.getPointAt(flyT, a); ct.getPointAt(flyT, b);
        G.camera.position.copy(a); G.camera.lookAt(b);
      }
      // live weather readout (2 Hz, written only on change)
      if ((readT -= dt) <= 0) {
        readT = 0.5;
        const at = G.mods?.atmosphere;
        if (at && !at.isStub) {
          U.set('wind', `${Math.round(18 + (at.gust || 0) * 24)} kt`);
          U.set('vis', `${Math.round(Math.min(400, at.visibility || 0) / 5) * 5} m`);
        }
      }
    }
    if (U.state === 'playing') { fill(dt); view.frame(snap, dt); }
  };

  // demo screens for ?show=hud&ui=…
  function boot() {
    if (!demo) return U.setState(P.get('shot') || P.get('autostart') ? 'playing' : 'title');
    const ui = P.get('ui') || 'hud';
    if (ui === 'won' || ui === 'lost') { snap.running = ui === 'won' ? 3 : 2; showEnd(ui, ui === 'won' ? 412 : 287); return; }
    if (ui === 'title') return U.setState('title');
    if (ui === 'settings') { back = 'paused'; return U.setState('settings'); }
    if (ui === 'pause') return U.setState('paused');
    U.setState('playing'); view.frame(snap, 0); view.toast('Generator A · online', 1e9);
  }
  G.on('ready', boot);
  return U;
}

// ?show=hud frames the spawn like pose 2 with the HUD showing frozen demo values (no ?shot, so the UI is visible)
export function showcase() { return { cam: [44, 1.68, 12], target: [0, 2.6, 2] }; }
