// AP page, HUD tapes design (docs/noautopilot-plan.md, Phase 1). Renders the "noap" slice
// NoApBridge publishes into NOXMFD's telemetry frame; units follow the frame's top-level `metric`
// (the game's Metric/Imperial setting), as NOAutopilot's own F8 window does. Read-only for now:
// the controls show state, and clicking them is wired in the controls step.
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
function speedTape(cur, tgt, box, metric) {
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
        ? `<path class="bug" d="M126 ${r1(157 + b.y)}h10v16h-10l6-8z"/>`
        : `<path class="chev" d="${b.off > 0 ? 'M120 14l8-10 8 10' : 'M120 316l8 10 8-10'}"/>`;
    }
  }
  g += `<path class="box" d="M4 147h104l14 18-14 18H4z"/>`;
  g += `<text class="box-txt" x="56" y="174" text-anchor="middle" font-size="${box.length > 4 ? 22 : 26}">${box}</text>`;
  $('spd-g').innerHTML = g;
}

function altTape(cur, tgt, metric) {
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
        ? `<path class="bug" d="M2 ${r1(157 + b.y)}h10l-6 8 6 8h-10z"/>`
        : `<path class="chev" d="${b.off > 0 ? 'M14 12l8-10 8 10' : 'M14 318l8 10 8-10'}"/>`;
    }
  }
  g += `<path class="box" d="M34 165l14-18h98v36H48z"/>`;
  g += `<text class="box-txt" x="97" y="173" text-anchor="middle" font-size="23">${cur != null ? Math.round(cur).toLocaleString('en-US') : F.DASH}</text>`;
  $('alt-g').innerHTML = g;
}

// Heading tape, 6 px per degree around the box at x = 230. The bug shows where the autopilot steers:
// the bearing to the next waypoint in nav mode, else the course target.
function headingTape(hdg, bug) {
  let g = '';
  if (hdg != null) {
    for (const m of F.hdgMarks(hdg, 6, 5, 222)) {
      const x = r1(230 + m.x);
      const major = m.deg % 10 === 0;
      g += `<line class="${major ? 'tk-major' : 'tk-minor'}" x1="${x}" y1="${major ? 48 : 54}" x2="${x}" y2="66" stroke-width="1.5"/>`;
      if (major) g += `<text class="tape-lbl" x="${x}" y="44" font-size="15" text-anchor="middle">${String(m.deg).padStart(3, '0')}</text>`;
    }
    if (bug != null) {
      const raw = 230 + F.angDiff(hdg, bug) * 6;
      const x = r1(Math.max(12, Math.min(448, raw)));
      g += `<path class="bug${raw === x ? '' : ' hollow'}" d="M${x - 8} 76L${x} 67L${x + 8} 76Z"/>`;
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
function bankScale(roll, limit) {
  let g = '';
  if (limit != null && limit > 0) {
    for (const s of [1, -1]) {
      const [x1, y1] = polar(s * Math.min(limit, 60), 66), [x2, y2] = polar(s * Math.min(limit, 60), 80);
      g += `<line class="bank-lim" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
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

function setTgt(id, text, on) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('off', !on);
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

function render(s, metric) {
  if (s.link !== 'linked') {
    const ver = s.ver ? ' ' + s.ver : '';
    setNotice(s.link === 'missing'
      ? ['NOAUTOPILOT NOT INSTALLED', 'Install NOAutopilot to use this page.']
      : ['NOAUTOPILOT' + ver + ' NOT SUPPORTED', 'See the BepInEx log for details.']);
    setLink('NOAP' + ver + ' · ' + (s.link === 'missing' ? 'NOT INSTALLED' : 'INCOMPATIBLE'), false);
    $('mp-note').hidden = true;
    return;
  }

  setLink('NOAP ' + s.ver + (s.broken ? ' · ERROR, SEE LOG' : ' · LINKED'), !s.broken);
  $('mp-note').hidden = !s.mp;
  $('als-text').textContent = s.alsText || 'ALS —';
  setNotice(s.air ? null : ['NO PLAYER AIRCRAFT']);

  const t = s.tgt || {}, c = s.cur || {}, q = s.navq || {};
  const athr = F.tgtOn.spd(t.spd);

  // Speed: the tape runs in kt or km/h; in Mach mode the box shows Mach and a Mach target is placed
  // on the tape through the current speed-of-sound ratio (spd / mach).
  const spdCur = c.spd != null ? F.spdVal(c.spd, metric) : null;
  let spdTgt = null;
  if (athr && spdCur != null) spdTgt = s.mach ? (c.mach > 0.05 ? t.spd * spdCur / c.mach : null) : F.spdVal(t.spd, metric);
  speedTape(spdCur, spdTgt, s.mach ? F.mach(c.mach) : F.spd(c.spd, metric), metric);
  setTgt('spd-tgt', athr ? F.tgtSpd(t.spd, s.mach, metric) : 'OFF', athr);
  $('unit-a').textContent = F.spdUnit(metric);
  $('unit-a').classList.toggle('on', !s.mach);
  $('unit-m').classList.toggle('on', !!s.mach);

  // Altitude
  const altOn = F.tgtOn.alt(t.alt);
  altTape(c.alt != null ? F.altVal(c.alt, metric) : null, altOn && c.alt != null ? F.altVal(t.alt, metric) : null, metric);
  setTgt('alt-tgt', altOn ? F.alt(t.alt, metric) : 'OFF', altOn);
  $('vs-val').textContent = t.vs > 0 ? F.vs(t.vs, metric) : F.DASH;

  // Heading and bank
  const navBug = s.nav && q.n > 0 && q.brg != null ? q.brg : null;
  headingTape(c.crs ?? null, navBug ?? (F.tgtOn.crs(t.crs) ? t.crs : null));
  const rollOn = F.tgtOn.roll(t.roll);
  bankScale(c.roll ?? null, rollOn ? Math.abs(t.roll) : null);
  $('bank-txt').textContent = rollOn ? F.roll(t.roll) + '°' : F.DASH;

  // AP ring
  $('ap-ring').classList.toggle('engaged', !!s.ap);
  $('ap-sub').textContent = s.ap ? 'ENGD' : 'OFF';

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
}

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
