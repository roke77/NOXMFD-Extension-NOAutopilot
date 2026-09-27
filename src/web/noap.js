// AP page, HUD tapes design (docs/noautopilot-plan.md, Phase 1). Renders the "noap" slice
// NoApBridge publishes into NOXMFD's telemetry frame; units follow the frame's top-level `metric`
// (the game's Metric/Imperial setting), as NOAutopilot's own F8 window does. Controls post to
// /ext/noap/command (NoApCommands.cs); target steps stay pending (amber) until APPLY, like F8.
import { TelemetrySource } from '/assets/services/telemetry-source.js';

const F = window.NoApFormat;
const $ = (id) => document.getElementById(id);
const r1 = (v) => Math.round(v * 10) / 10;

// ── canvas fit ──────────────────────────────────────────────────────────────────────────────
const STAGE = 900;
function fitStage() {
  const s = Math.min(innerWidth, innerHeight) / STAGE;
  $('stage').style.transform =
    `translate(${(innerWidth - STAGE * s) / 2}px, ${(innerHeight - STAGE * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fitStage);
fitStage();

// ── tapes ───────────────────────────────────────────────────────────────────────────────────
// Scales per unit system: speed labels every 20 kt or 40 km/h, altitude every 500 ft or 200 m,
// both 80 px / 40 px apart, matching the mockup's spacing.
const TAPE_HALF = 165;
const SPD = { imp: { px: 4, step: 10, label: 20 }, met: { px: 2, step: 20, label: 40 } };
const ALT = { imp: { px: 0.08, step: 100, label: 500 }, met: { px: 0.2, step: 40, label: 200 } };

// Labels next to the readout box are left out, as in the mockup, so none peeks out behind it.
function speedTape(cur, tgt, box, metric, pend) {
  const k = metric ? SPD.met : SPD.imp;
  let g = '';
  if (cur != null) {
    for (const m of F.tapeMarks(cur, k.px, k.step, TAPE_HALF - 4)) {
      const y = r1(165 + m.y);
      g += `<line class="tk-major" x1="112" y1="${y}" x2="124" y2="${y}" stroke-width="1.5"/>`;
      if (m.v % k.label === 0 && m.v >= 0 && Math.abs(m.y) > 22) g += `<text class="tape-lbl" x="104" y="${y + 6}" font-size="17" text-anchor="end">${m.v}</text>`;
    }
    if (tgt != null) {
      const b = F.tapeBug(tgt, cur, k.px, TAPE_HALF - 12);
      g += b.off === 0
        ? `<path class="bug${pend ? ' pend' : ''}" d="M126 ${r1(157 + b.y)}h10v16h-10l6-8z"/>`
        : `<path class="chev${pend ? ' pend' : ''}" d="${b.off > 0 ? 'M120 14l8-10 8 10' : 'M120 316l8 10 8-10'}"/>`;
    }
  }
  g += `<path class="box" d="M4 147h104l14 18-14 18H4z"/>`;
  g += `<text class="box-txt" x="56" y="174" text-anchor="middle" font-size="${box.length > 4 ? 22 : 26}">${box}</text>`;
  $('spd-g').innerHTML = g;
}

function altTape(cur, tgt, metric, pend) {
  const k = metric ? ALT.met : ALT.imp;
  let g = '';
  if (cur != null) {
    for (const m of F.tapeMarks(cur, k.px, k.step, TAPE_HALF - 2)) {
      const y = r1(165 + m.y);
      const major = m.v % k.label === 0;
      g += `<line class="${major ? 'tk-major' : 'tk-minor'}" x1="16" y1="${y}" x2="${major ? 32 : 28}" y2="${y}" stroke-width="1.5"/>`;
      if (major && Math.abs(m.y) > 24) g += `<text class="tape-lbl" x="38" y="${y + 5}" font-size="15">${m.v.toLocaleString('en-US')}</text>`;
    }
    if (tgt != null) {
      const b = F.tapeBug(tgt, cur, k.px, TAPE_HALF - 12);
      g += b.off === 0
        ? `<path class="bug${pend ? ' pend' : ''}" d="M2 ${r1(157 + b.y)}h10l-6 8 6 8h-10z"/>`
        : `<path class="chev${pend ? ' pend' : ''}" d="${b.off > 0 ? 'M14 12l8-10 8 10' : 'M14 318l8 10 8-10'}"/>`;
    }
  }
  g += `<path class="box" d="M34 165l14-18h98v36H48z"/>`;
  g += `<text class="box-txt" x="97" y="173" text-anchor="middle" font-size="23">${cur != null ? Math.round(cur).toLocaleString('en-US') : F.DASH}</text>`;
  $('alt-g').innerHTML = g;
}

// Heading tape, 6 px per degree around the box at x = 230. The bug shows where the autopilot steers:
// the bearing to the next waypoint in nav mode, else the course target.
function headingTape(hdg, bug, pend) {
  let g = '';
  if (hdg != null) {
    for (const m of F.hdgMarks(hdg, 6, 5, 222)) {
      const x = r1(230 + m.x);
      const major = m.deg % 10 === 0;
      g += `<line class="${major ? 'tk-major' : 'tk-minor'}" x1="${x}" y1="${major ? 48 : 54}" x2="${x}" y2="66" stroke-width="1.5"/>`;
      if (major) g += `<text class="tape-lbl" x="${x}" y="44" font-size="15" text-anchor="middle">${String(m.deg).padStart(3, '0')}</text>`;
    }
    if (bug != null) {
      // Off the tape's ends the bug pins there, drawn hollow.
      const raw = 230 + F.angDiff(hdg, bug) * 6;
      const pinned = Math.max(12, Math.min(448, raw));
      const x = r1(pinned);
      g += `<path class="bug${pinned === raw ? '' : ' hollow'}${pend ? ' pend' : ''}" d="M${x - 8} 76L${x} 67L${x + 8} 76Z"/>`;
    }
  }
  g += `<path class="box" d="M203 2h54v24h-21l-6 7-6-7h-21z"/>`;
  g += `<text class="box-txt" x="230" y="21" text-anchor="middle" font-size="19">${F.deg3(hdg)}</text>`;
  $('hdg-g').innerHTML = g;
}

// Bank scale around (100, 100): limit marks at ±limit and the roll pointer.
// ponytail: assumes NOAutopilot's CurrentRoll (Unity eulerAngles.z) is positive for a left bank, so
// the pointer mirrors it to sit on the side the aircraft banks toward; flip the sign here if the
// live-game check shows it on the wrong side.
const polar = (deg, r) => [100 + r * Math.sin(deg * Math.PI / 180), 100 - r * Math.cos(deg * Math.PI / 180)];
function bankScale(roll, limit, pend) {
  let g = '';
  if (limit != null && limit > 0) {
    for (const s of [1, -1]) {
      const [x1, y1] = polar(s * Math.min(limit, 60), 66), [x2, y2] = polar(s * Math.min(limit, 60), 80);
      g += `<line class="bank-lim${pend ? ' pend' : ''}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
    }
  }
  if (roll != null) {
    const p = Math.max(-60, Math.min(60, -roll));
    const pts = [polar(p, 72), polar(p - 4.5, 61), polar(p + 4.5, 61)].map(([x, y]) => r1(x) + ' ' + r1(y));
    g += `<path class="bank-ptr" d="M${pts.join('L')}Z"/>`;
  }
  $('bank-g').innerHTML = g;
}

// Waypoint pips: the next point filled amber, the rest hollow, "+N" past three when there are
// more than four.
function pips(n) {
  if (!n) { $('pips-g').innerHTML = '<text class="pip-none" x="0" y="20">NO WPTS</text>'; return; }
  const shown = n > 4 ? 3 : n;
  let g = shown > 1 ? `<line class="pip-line" x1="14" y1="15" x2="${14 + (shown - 1) * 36}" y2="15"/>` : '';
  for (let i = 0; i < shown; i++) {
    const x = 14 + i * 36;
    g += i === 0
      ? `<path class="pip next" d="M${x} 5l10 10-10 10-10-10z"/>`
      : `<path class="pip" d="M${x} 8l7 7-7 7-7-7z"/>`;
  }
  if (n > 4) g += `<text class="pip-more" x="${14 + 3 * 36 - 8}" y="20">+${n - 3}</text>`;
  $('pips-g').innerHTML = g;
}

// ── state → page ────────────────────────────────────────────────────────────────────────────
function lit(id, state) {
  const el = $(id);
  el.classList.toggle('on', state === true || state === 'on');
  el.classList.toggle('warn', state === 'warn');
  el.classList.toggle('alert', state === 'alert');
}

function setTgt(id, text, on, pend) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('off', !on && !pend);
  el.classList.toggle('pend', !!pend);
}

// A notice over the faded controls, or none. Every non-flying state says why the page is inert.
function setNotice(lines) {
  document.body.classList.toggle('unlinked', !!lines);
  $('notice').hidden = !lines;
  if (lines) $('notice').textContent = lines.join('\n');
}

function setLink(text, ok) {
  $('link-line').textContent = text;
  $('link-dot').className = 'dot ' + (ok ? 'ok' : 'bad');
  $('link-line').parentElement.classList.toggle('warn', !ok);
}

// The last slice and unit system, for the controls' step bases.
let last = null, lastMetric = false;

function render(s, metric) {
  last = s;
  lastMetric = metric;
  if (s.link !== 'linked') {
    const ver = s.ver ? ' ' + s.ver : '';
    setNotice(s.link === 'missing'
      ? ['NOAUTOPILOT NOT INSTALLED', 'Install NOAutopilot to use this page.']
      : ['NOAUTOPILOT' + ver + ' NOT SUPPORTED', 'See the BepInEx log for details.']);
    setLink('NOAP' + ver + ' · ' + (s.link === 'missing' ? 'NOT INSTALLED' : 'INCOMPATIBLE'), false);
    $('mp-note').hidden = true;
    closeKeypad();
    return;
  }

  setLink('NOAP ' + s.ver + (s.broken ? ' · ERROR, SEE LOG' : ' · LINKED'), !s.broken);
  $('mp-note').hidden = !s.mp;
  $('als-text').textContent = s.alsText || 'ALS —';
  setNotice(s.air ? null : ['NO PLAYER AIRCRAFT']);
  if (!s.air) closeKeypad();

  const t = s.tgt || {}, c = s.cur || {}, q = s.navq || {};
  const athr = F.tgtOn.spd(t.spd);
  // A pending speed typed in the other unit than NOAutopilot now uses (F8 or the keybind switched
  // KT/M) no longer means what it did; drop it rather than show it in the wrong unit.
  if (pending.spd != null && pending.spdMach !== !!s.mach) delete pending.spd;

  // Speed: the tape runs in kt or km/h; in Mach mode the box shows Mach and a Mach target is placed
  // on the tape through the current speed-of-sound ratio (spd / mach).
  const spdCur = c.spd != null ? F.spdVal(c.spd, metric) : null;
  const spdPend = pending.spd != null;
  const spdT = spdPend ? pending.spd : athr ? t.spd : null;
  let spdTgt = null;
  if (spdT != null && spdCur != null) spdTgt = s.mach ? (c.mach > 0.05 ? spdT * spdCur / c.mach : null) : F.spdVal(spdT, metric);
  speedTape(spdCur, spdTgt, s.mach ? F.mach(c.mach) : F.spd(c.spd, metric), metric, spdPend);
  setTgt('spd-tgt', spdT != null ? F.tgtSpd(spdT, s.mach, metric) : 'OFF', athr, spdPend);
  $('unit-a').textContent = F.spdUnit(metric);
  $('unit-a').classList.toggle('on', !s.mach);
  $('unit-m').classList.toggle('on', !!s.mach);

  // Altitude and the V/S limit
  const altOn = F.tgtOn.alt(t.alt), altPend = pending.alt != null;
  const altT = altPend ? pending.alt : altOn ? t.alt : null;
  altTape(c.alt != null ? F.altVal(c.alt, metric) : null, altT != null && c.alt != null ? F.altVal(altT, metric) : null, metric, altPend);
  setTgt('alt-tgt', altT != null ? F.alt(altT, metric) : 'OFF', altOn, altPend);
  const vsT = pending.vs ?? (t.vs > 0 ? t.vs : null);
  $('vs-val').textContent = vsT != null ? F.vs(vsT, metric) : F.DASH;
  $('vs-val').classList.toggle('pend', pending.vs != null);

  // Heading and bank. The bug shows a pending course first, else where the autopilot steers.
  const navBug = s.nav && q.n > 0 && q.brg != null ? q.brg : null;
  headingTape(c.crs ?? null, pending.crs ?? navBug ?? (F.tgtOn.crs(t.crs) ? t.crs : null), pending.crs != null);
  const rollPend = pending.roll != null;
  const rollT = rollPend ? pending.roll : F.tgtOn.roll(t.roll) ? t.roll : null;
  bankScale(c.roll ?? null, rollT != null ? Math.abs(rollT) : null, rollPend);
  $('bank-txt').textContent = rollT != null ? F.roll(rollT) + '°' : F.DASH;
  $('bank-txt').classList.toggle('pend', rollPend);

  // AP ring and APPLY badge
  $('ap-ring').classList.toggle('engaged', !!s.ap);
  $('ap-sub').textContent = s.ap ? 'ENGD' : 'OFF';
  const n = pendingCount();
  $('apply-n').hidden = n === 0;
  $('apply-n').textContent = String(n);

  // Nav strip
  lit('nav', s.nav);
  pips(q.n || 0);
  $('nav-next').textContent = q.next != null ? F.dist(q.next, metric) : F.DASH;
  $('nav-next-eta').textContent = q.next != null ? F.eta(q.next, c.spd) : '';
  $('nav-total').textContent = 'Σ ' + (q.total != null ? F.dist(q.total, metric) : F.DASH);
  $('nav-total-eta').textContent = q.total != null ? F.eta(q.total, c.spd) : '';
  lit('cycle', s.cycle);

  // System toggles
  const g = F.gcasState(s);
  lit('t-gcas', g === 'active' ? 'alert' : g === 'warn' ? 'warn' : g === 'arm');
  $('t-gcas-txt').textContent = g === 'active' ? 'PULL UP' : 'GCAS';
  lit('t-athr', athr);
  lit('t-xthr', s.xthr);
  lit('t-jam', s.jam);
  lit('t-fbw', s.fbw);
  $('t-fbw').disabled = !!s.mp;   // NOAutopilot refuses FBW off in multiplayer
  lit('t-als', s.als);
  $('t-als').classList.toggle('armed', alsArmed && !s.als);
  $('t-als-txt').textContent = alsArmed && !s.als ? 'CONFIRM' : 'ALS';
}

// Re-render right after a local change (a step, APPLY, the keypad) instead of waiting for the next
// 10 Hz frame.
function rerender() {
  if (last) render(last, lastMetric);
}

// ── controls ────────────────────────────────────────────────────────────────────────────────
function post(payload) {
  // NOXMFD's command endpoint requires an exact application/json Content-Type; a bare string body
  // would go out as text/plain and be rejected with 415. A failure is logged, not thrown: the next
  // frame shows what NOAutopilot actually holds.
  fetch('/ext/noap/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => {
    if (!r.ok) console.warn('[NOAP] command rejected:', payload.cmd, r.status);
  }, (err) => console.warn('[NOAP] command failed:', payload.cmd, err && err.message));
}

// Pending targets, in NOAutopilot's units: alt m, spd m/s or Mach (spdMach says which), crs and
// roll deg, vs m/s. Sent together by APPLY.
const pending = {};
const PENDING_KEYS = ['alt', 'spd', 'crs', 'roll', 'vs'];
const pendingCount = () => PENDING_KEYS.filter((k) => pending[k] != null).length;

const cur = () => (last && last.cur) || {};
const tgt = () => (last && last.tgt) || {};

function stepAlt(dir) {
  const t = tgt(), base = pending.alt ?? (F.tgtOn.alt(t.alt) ? t.alt : cur().alt);
  if (base == null) return;
  const next = F.stepTo(F.altVal(base, lastMetric), dir, F.STEP.alt(lastMetric));
  pending.alt = F.clamp(F.altFromDisp(next, lastMetric), 0, 30000);
  rerender();
}

function stepSpd(dir) {
  const t = tgt(), c = cur(), mach = !!last.mach;
  if (mach) {
    const base = pending.spd ?? (F.tgtOn.spd(t.spd) ? t.spd : c.mach);
    if (base == null) return;
    pending.spd = F.clamp(F.stepTo(base, dir, F.STEP.spd(true)), 0, 5);
  } else {
    const base = pending.spd ?? (F.tgtOn.spd(t.spd) ? t.spd : c.spd);
    if (base == null) return;
    const next = F.stepTo(F.spdVal(base, lastMetric), dir, F.STEP.spd(false));
    pending.spd = F.clamp(F.spdFromDisp(next, lastMetric), 0, 1500);
  }
  pending.spdMach = mach;
  rerender();
}

function stepCrs(dir) {
  const t = tgt(), base = pending.crs ?? (F.tgtOn.crs(t.crs) ? t.crs : cur().crs);
  if (base == null) return;
  pending.crs = ((F.stepTo(base, dir, F.STEP.crs) % 360) + 360) % 360;
  rerender();
}

function stepRoll(dir) {
  const t = tgt(), base = pending.roll ?? (F.tgtOn.roll(t.roll) ? t.roll : 0);
  pending.roll = F.clamp(F.stepTo(base, dir, F.STEP.roll), -60, 60);
  rerender();
}

function stepVs(dir) {
  const base = pending.vs ?? (tgt().vs > 0 ? tgt().vs : null);
  if (base == null) return;
  const next = F.stepTo(F.vsVal(base, lastMetric), dir, F.STEP.vs(lastMetric));
  pending.vs = F.clamp(F.vsFromDisp(next, lastMetric), 0.5, 300);
  rerender();
}

function apply() {
  const cmd = { cmd: 'apply' };
  for (const k of PENDING_KEYS) if (pending[k] != null) cmd[k] = pending[k];
  if (cmd.spd != null) cmd.spdMach = !!pending.spdMach;
  post(cmd);
  for (const k of [...PENDING_KEYS, 'spdMach']) delete pending[k];
  rerender();
}

// SYNC loads the current altitude, speed and course into the pending targets.
function sync() {
  const c = cur();
  if (c.alt != null) pending.alt = F.clamp(c.alt, 0, 30000);
  const spd = last.mach ? c.mach : c.spd;
  if (spd != null) { pending.spd = spd; pending.spdMach = !!last.mach; }
  if (c.crs != null) pending.crs = c.crs;
  rerender();
}

// ALS sits under a guard: the first tap arms it for ALS_ARM_MS and the second starts autoland. A
// running autoland cancels on a single tap, like NOAutopilot's key.
const ALS_ARM_MS = 3000;
let alsArmed = false, alsTimer = 0;
function als() {
  if (last.als || alsArmed) {
    post({ cmd: 'als' });
    alsArmed = false;
    clearTimeout(alsTimer);
  } else {
    alsArmed = true;
    alsTimer = setTimeout(() => { alsArmed = false; rerender(); }, ALS_ARM_MS);
  }
  rerender();
}

const on = (id, fn) => $(id).addEventListener('click', () => { if (last && last.link === 'linked') fn(); });
const toggle = (what) => () => post({ cmd: 'toggle', what });

on('crs-left', () => stepCrs(-1));
on('crs-right', () => stepCrs(1));
on('crs-hold', () => { delete pending.crs; post({ cmd: 'crs-hold' }); rerender(); });
on('crs-clr', () => { delete pending.crs; post({ cmd: 'crs-clear' }); rerender(); });
on('spd-up', () => stepSpd(1));
on('spd-dn', () => stepSpd(-1));
on('alt-up', () => stepAlt(1));
on('alt-dn', () => stepAlt(-1));
on('bank-up', () => stepRoll(1));
on('bank-dn', () => stepRoll(-1));
on('vs-up', () => stepVs(1));
on('vs-dn', () => stepVs(-1));
on('unit-a', () => { if (last.mach) { delete pending.spd; post({ cmd: 'toggle', what: 'mach' }); } });
on('unit-m', () => { if (!last.mach) { delete pending.spd; post({ cmd: 'toggle', what: 'mach' }); } });
on('ap-ring', () => post({ cmd: last.ap ? 'disengage' : 'engage' }));
on('apply', apply);
on('sync', sync);
on('nav', toggle('nav'));
on('cycle', toggle('cycle'));
on('skip', () => post({ cmd: 'nav-skip' }));
on('undo', () => post({ cmd: 'nav-undo' }));
on('clear', () => post({ cmd: 'nav-clear' }));
on('t-gcas', toggle('gcas'));
on('t-athr', toggle('athr'));
on('t-xthr', toggle('abbrk'));
on('t-jam', toggle('jam'));
on('t-fbw', toggle('fbw'));
on('t-als', als);

// ── keypad ──────────────────────────────────────────────────────────────────────────────────
// Tapping the speed or altitude target types it directly, in the units the page shows; ENTER makes
// it pending like a step.
let kpField = null, kpText = '';

function kpLimits(field) {
  if (field === 'alt') return { title: 'ALT ' + F.altUnit(lastMetric), max: F.altVal(30000, lastMetric) };
  return last.mach ? { title: 'SPD M', max: 5 } : { title: 'SPD ' + F.spdUnit(lastMetric), max: F.spdVal(1500, lastMetric) };
}

function kpShow(error) {
  $('kp-display').textContent = kpText;
  $('kp-display').classList.toggle('bad', !!error);
  $('kp-error').textContent = error || '';
}

function openKeypad(field) {
  if (!last || last.link !== 'linked' || !last.air) return;
  kpField = field;
  kpText = '';
  $('kp-title').textContent = kpLimits(field).title;
  kpShow('');
  $('keypad').hidden = false;
}

function closeKeypad() {
  kpField = null;
  $('keypad').hidden = true;
}

function kpEnter() {
  const v = F.parseEntry(kpText), lim = kpLimits(kpField);
  if (v == null) return kpShow('ENTER A NUMBER');
  if (v > lim.max) return kpShow('MAX ' + Math.round(lim.max * 100) / 100);
  if (kpField === 'alt') pending.alt = F.altFromDisp(v, lastMetric);
  else {
    pending.spd = last.mach ? v : F.spdFromDisp(v, lastMetric);
    pending.spdMach = !!last.mach;
  }
  closeKeypad();
  rerender();
}

$('spd-tgt').addEventListener('click', () => openKeypad('spd'));
$('alt-tgt').addEventListener('click', () => openKeypad('alt'));
$('kp-grid').addEventListener('click', (e) => {
  const k = e.target.closest('[data-k]')?.dataset.k;
  if (!k) return;
  if (k === 'back') kpText = kpText.slice(0, -1);
  else if (kpText.length < 7) kpText += k;
  kpShow('');
});
$('kp-cancel').addEventListener('click', closeKeypad);
$('kp-enter').addEventListener('click', kpEnter);

function onFrame(d) {
  document.body.classList.remove('no-mission');
  const s = d.ext && d.ext.noap;
  if (s) render(s, !!d.metric);
}

function onNoMission() {
  document.body.classList.add('no-mission');
}

const source = new TelemetrySource({ onFrame, onNoMission });
source.connect();
addEventListener('pagehide', () => source.disconnect());
