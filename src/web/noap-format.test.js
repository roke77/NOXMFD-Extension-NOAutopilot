// node src/web/noap-format.test.js — self-check for the AP page's unit and sentinel handling.
const assert = require('assert');
const F = require('./noap-format.js');

// Units follow NOAutopilot's ModUtils factors.
assert.strictEqual(F.alt(1000, false), '3,281');
assert.strictEqual(F.alt(1000, true), '1,000');
assert.strictEqual(F.spd(100, false), '194');
assert.strictEqual(F.spd(100, true), '360');
assert.strictEqual(F.vs(10, false), '1,969');
assert.strictEqual(F.vs(10, true), '10');
assert.strictEqual(F.dist(1852, false), '1.0 NM');
assert.strictEqual(F.dist(1500, true), '1.5 KM');
assert.strictEqual(F.mach(0.853), 'M0.85');

// Headings wrap into 000-359 with a zero-padded three-digit form.
assert.strictEqual(F.deg3(47), '047');
assert.strictEqual(F.deg3(359.6), '000');
assert.strictEqual(F.deg3(-10), '350');

// Missing data (null from NaN in the slice) renders as a dash, never "NaN".
assert.strictEqual(F.alt(null, false), F.DASH);
assert.strictEqual(F.deg3(undefined), F.DASH);

// NOAutopilot's off sentinels.
assert.strictEqual(F.tgtOn.alt(-1), false);
assert.strictEqual(F.tgtOn.alt(0), true);
assert.strictEqual(F.tgtOn.roll(-999), false);
assert.strictEqual(F.tgtOn.roll(-25), true);
assert.strictEqual(F.tgtSpd(-1, false, false), F.DASH);
assert.strictEqual(F.tgtSpd(0.9, true, false), 'M0.90');
assert.strictEqual(F.tgtSpd(100, false, true), '360');

// ETA: m:ss under an hour, h:mm:ss above, nothing when not moving.
assert.strictEqual(F.eta(6000, 100), '1:00');
assert.strictEqual(F.eta(400000, 100), '1:06:40');
assert.strictEqual(F.eta(6000, 0.5), F.DASH);

// GCAS priority.
assert.strictEqual(F.gcasState({ gcas: true, gcasWarn: true, gcasActive: true }), 'active');
assert.strictEqual(F.gcasState({ gcas: true, gcasWarn: true }), 'warn');
assert.strictEqual(F.gcasState({ gcas: true }), 'arm');
assert.strictEqual(F.gcasState({}), 'off');

// Vertical tape: labels every 20 around 412 at 4 px/unit within ±165 px; higher values sit higher.
const marks = F.tapeMarks(412, 4, 20, 165);
assert.deepStrictEqual(marks.map((m) => m.v), [380, 400, 420, 440]);
assert.strictEqual(marks.find((m) => m.v === 420).y, -32);
assert.deepStrictEqual(F.tapeBug(420, 412, 4, 165), { y: -32, off: 0 });
assert.deepStrictEqual(F.tapeBug(22000, 18240, 0.08, 165), { y: -165, off: 1 });   // above the tape
assert.deepStrictEqual(F.tapeBug(100, 412, 4, 165), { y: 165, off: -1 });          // below it

// Heading wraps through north both for turn direction and for tape labels.
assert.strictEqual(F.angDiff(350, 10), 20);
assert.strictEqual(F.angDiff(10, 350), -20);
assert.strictEqual(F.angDiff(0, 180), 180);
const h = F.hdgMarks(5, 6, 10, 38 * 6);
assert.deepStrictEqual(h.map((m) => m.deg), [330, 340, 350, 0, 10, 20, 30, 40]);
assert.strictEqual(h.find((m) => m.deg === 350).x, -90);

console.log('noap-format: all assertions passed');
