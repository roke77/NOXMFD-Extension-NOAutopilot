// Pure display helpers for the AP page: unit conversion and NOAutopilot's "off" sentinels. A classic
// script (not a module) so noap-format.test.js can require() it in plain node; the page reads it as
// window.NoApFormat. Units match NOAutopilot's own ModUtils conversions, so the page and the F8
// window always show the same numbers: imperial = ft / kt / fpm / nm, metric = m / km/h / m/s / km.
(function (root) {
  const FT_PER_M = 3.28084, KT_PER_MS = 1.94384, KMH_PER_MS = 3.6, FPM_PER_MS = 196.850394;
  const NM_PER_M = 1 / 1852;
  const DASH = '—';

  const fin = (v) => typeof v === 'number' && isFinite(v);
  const grp = (v) => Math.round(v).toLocaleString('en-US');

  // Numeric conversions, shared by the text readouts below and the page's tapes.
  const altVal = (m, metric) => metric ? m : m * FT_PER_M;
  const spdVal = (ms, metric) => ms * (metric ? KMH_PER_MS : KT_PER_MS);

  const alt = (m, metric) => fin(m) ? grp(altVal(m, metric)) : DASH;
  const altUnit = (metric) => metric ? 'M' : 'FT';
  const spd = (ms, metric) => fin(ms) ? grp(spdVal(ms, metric)) : DASH;
  const spdUnit = (metric) => metric ? 'KM/H' : 'KT';
  const vs = (ms, metric) => fin(ms) ? grp(metric ? ms : ms * FPM_PER_MS) : DASH;
  const vsUnit = (metric) => metric ? 'M/S' : 'FPM';
  const mach = (m) => fin(m) ? 'M' + m.toFixed(2) : DASH;
  const deg3 = (d) => fin(d) ? String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0') : DASH;
  const roll = (d) => fin(d) ? String(Math.round(d)) : DASH;
  const dist = (m, metric) => fin(m) ? (metric ? (m / 1000).toFixed(1) + ' KM' : (m * NM_PER_M).toFixed(1) + ' NM') : DASH;

  // Flight time to cover distM at speedMs, as m:ss or h:mm:ss; none below 1 m/s (parked, hovering).
  function eta(distM, speedMs) {
    if (!fin(distM) || !fin(speedMs) || speedMs < 1) return DASH;
    const s = Math.round(distM / speedMs);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;
  }

  // NOAutopilot's "no target" sentinels (APData): alt/spd/crs -1, roll -999. Anything negative
  // counts as off for alt/spd/crs, which also covers float noise around -1.
  const tgtOn = {
    alt: (v) => fin(v) && v >= 0,
    spd: (v) => fin(v) && v >= 0,
    crs: (v) => fin(v) && v >= 0,
    roll: (v) => fin(v) && v !== -999,
  };

  // Target speed is Mach when the slice's "mach" flag is set, else m/s.
  const tgtSpd = (v, isMach, metric) => !tgtOn.spd(v) ? DASH : isMach ? mach(v) : spd(v, metric);

  // GCAS light: pulling up beats warning beats armed.
  const gcasState = (s) => s.gcasActive ? 'active' : s.gcasWarn ? 'warn' : s.gcas ? 'arm' : 'off';

  // ── tape geometry (HUD tapes design) ──────────────────────────────────────────────────────
  // Marks every `step` units within ±halfPx of `center` on a vertical tape, as offsets from the
  // tape's middle; larger values sit higher (negative y). Index-based so float steps don't drift.
  function tapeMarks(center, pxPerUnit, step, halfPx) {
    const span = halfPx / pxPerUnit, first = Math.ceil((center - span) / step), out = [];
    for (let i = first; i * step <= center + span; i++) out.push({ v: i * step, y: -(i * step - center) * pxPerUnit });
    return out;
  }

  // A target's place on a vertical tape; beyond the ends it pins there with off = 1 (above) or -1 (below).
  function tapeBug(target, center, pxPerUnit, halfPx) {
    const y = -(target - center) * pxPerUnit;
    return y < -halfPx ? { y: -halfPx, off: 1 } : y > halfPx ? { y: halfPx, off: -1 } : { y, off: 0 };
  }

  // Signed shortest turn from heading a to heading b, in (-180, 180].
  function angDiff(a, b) {
    const d = (((b - a) % 360) + 540) % 360 - 180;
    return d === -180 ? 180 : d;
  }

  // Heading tape marks every `step` degrees within ±halfPx of hdg, labels wrapped into 0-359.
  function hdgMarks(hdg, pxPerDeg, step, halfPx) {
    const span = halfPx / pxPerDeg, first = Math.ceil((hdg - span) / step), out = [];
    for (let i = first; i * step <= hdg + span; i++) {
      out.push({ deg: (((i * step) % 360) + 360) % 360, x: (i * step - hdg) * pxPerDeg });
    }
    return out;
  }

  const api = { altVal, spdVal, alt, altUnit, spd, spdUnit, vs, vsUnit, mach, deg3, roll, dist, eta, tgtOn, tgtSpd, gcasState,
    tapeMarks, tapeBug, angDiff, hdgMarks, DASH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NoApFormat = api;
})(this);
