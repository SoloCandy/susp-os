// SUSP.OS — mech-balance model property tests
// Run with: node tests-balance.js
// No dependencies required.
//
// LIKE tests-beamng.js AND UNLIKE tests.js, THIS FILE READS index.html — it lifts the real
// balance functions out of the app rather than mirroring them, so a change made only in
// index.html cannot pass.
//
// Why property tests rather than expected values: the balance chain has no measured ground
// truth at most of its inputs (see docs/KNOWN_ISSUES.md on the tyre-series model's reach and
// on MECH_BAL_GAIN), so asserting exact numbers would freeze today's calibration and make
// every legitimate recalibration a test failure. What CAN be asserted is the model's SHAPE —
// the properties any correct version of it must have whatever the constants become:
//
//   1. Monotonicity — more rear roll stiffness never moves balance toward understeer.
//   2. Scale invariance — only the Kf/Kr RATIO matters to the LLT model.
//   3. Mirror symmetry — a front/rear-mirrored chassis gives the mirrored balance.
//   4. Continuity / no saturation — no clamp cliff anywhere in the realistic envelope.
//   5. Band direction — an overshoot fraction (>1) always overshoots toward OVERSTEER,
//      under either sign of the natural-to-grip gap, and a band always contains its own
//      interior extreme.
//   6. Crossover behaviour — the gap changes sign just under 50% front bias, and nothing
//      downstream may jump as it does.
//   7. Calibration envelope — balanceEnvelope flags exactly the fitted bounds it should.
//
// Properties 5 and 6 are the ones with history: the drift-band sign inversion and the
// balanceBandRange V-shape miss were both failures of exactly these (docs/HISTORY.md).
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the
// markers rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

const M = new Function(
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbCtx=') +
  '\nreturn{DEF_CH,DEF_FE,cornerMasses,tyreWidths,tireCorrOf,parseTyre,' +
  'axleRollStiffness,rollCenterHeight,latLoadTransfer,mechBalanceLLT,balanceFromRsBal,' +
  'displayRsBalance,natGeomOf,naturalMechBalanceOf,gripNeutralOf,clampBalTarget,' +
  'balanceBandDelta,balanceBandRange,balanceBandFracs,BALANCE_BAND_FRACS,' +
  'balanceEnvelope,cgEstMmOf,FIT_HZ,FIT_CORNER_KG,FIT_TYRE_W,CG_EST_MIN,CG_EST_MAX,' +
  'MECH_BALANCE_TARGET,isPhysical};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (got, want, tol, what) => {
  if (Math.abs(got - want) > tol) throw new Error(`${what}: got ${got}, expected ${want} (+/-${tol})`);
};

// A spread of chassis covering the shapes the app actually sees: front- and rear-biased,
// light and heavy, narrow and wide track, staggered and square tyres, low and tall CG.
// Manual CG throughout so rollCenterHeight is an independent variable rather than a
// function of the ride heights.
const CHASSIS = [
  { name: 'default',         over: {} },
  { name: 'front-biased',    over: { frontBias: 60 } },
  { name: 'rear-biased',     over: { frontBias: 41 } },
  { name: 'near-crossover',  over: { frontBias: 49.5 } },
  { name: 'light',           over: { weight: 1900 } },
  { name: 'heavy',           over: { weight: 5200 } },
  { name: 'narrow track',    over: { trackF: 1.35, trackR: 1.33 } },
  { name: 'wide track',      over: { trackF: 1.72, trackR: 1.70 } },
  { name: 'track stagger',   over: { trackF: 1.62, trackR: 1.48 } },
  { name: 'tyre stagger',    over: { tyreF: '235/35R18', tyreR: '305/30R19' } },
  { name: 'reverse stagger', over: { tyreF: '305/30R19', tyreR: '235/35R18' } },
  { name: 'low CG',          over: { cgHeight: 0.32 } },
  { name: 'tall CG',         over: { cgHeight: 0.68 } },
  { name: 'FWD hatch',       over: { frontBias: 63, weight: 2700, layout: 'FWD' } },
  { name: 'mid-engine',      over: { frontBias: 44, weight: 2500, cgHeight: 0.40 } },
].map(c => ({ name: c.name, ch: { ...M.DEF_CH, useRideHeightCG: false, ...c.over } }));

// rsBalance grid spanning clampBalTarget's own band, which is the widest range any solver
// can ask the model about.
const RS_GRID = [];
for (let r = 0.20; r <= 0.9001; r += 0.01) RS_GRID.push(Math.round(r * 1000) / 1000);

console.log('\nMECH-BALANCE PROPERTY TESTS\n');

// -- 1. Monotonicity ---------------------------------------------------------
console.log('Monotonicity');

// Does either inside wheel carry zero load at 1 g for this roll-stiffness split? Past that
// point fy's max(0,Fz) floor is load-bearing and the model's monotonicity genuinely ends —
// see the lift tests below and balanceEnvelope's LIFT flag.
const lifts = (ch, rsBal) => {
  const { dWf, dWr, Mf, Mr } = M.latLoadTransfer(ch, 1 - rsBal, rsBal);
  return dWf >= Mf * 9.81 / 2 || dWr >= Mr * 9.81 / 2;
};

t('balanceFromRsBal is non-decreasing in rear roll-stiffness fraction while both wheels load', () => {
  for (const { name, ch } of CHASSIS) {
    let prev = -Infinity, prevR = null;
    for (const r of RS_GRID) {
      if (lifts(ch, r)) break; // beyond the model's valid domain — the next two tests cover it
      const b = M.balanceFromRsBal(ch, r);
      ok(b >= prev - 1e-12,
        `${name}: balance fell from ${prev} at rsBal ${prevR} to ${b} at rsBal ${r} — more rear roll stiffness must never move balance toward understeer`);
      prev = b; prevR = r;
    }
  }
});

t('balance turns around ONLY once an inside wheel has lifted, never while both load', () => {
  // The invariant behind the test above, stated so it cannot be weakened by accident: if
  // balanceFromRsBal ever reverses direction, the cause must be the fy floor and nothing else.
  // Fixing fy to a saturating falloff (no zero floor) removes the lift region entirely and
  // this test still passes — it pins the CAUSE, not today's turning point.
  for (const { name, ch } of CHASSIS) {
    let prev = null, prevR = null;
    for (const r of RS_GRID) {
      const b = M.balanceFromRsBal(ch, r);
      // Either end of the step counts: the reversal shows up on the step LEAVING the lifted
      // region as well as the one entering it. Both ends of the band have one — the front
      // inside wheel lifts at low rsBalance on a rear-biased car, the rear at high rsBalance.
      if (prev != null && b < prev - 1e-12)
        ok(lifts(ch, r) || lifts(ch, prevR),
          `${name}: balance reversed between rsBal ${prevR} and ${r} with both inside wheels still loaded — that is a new non-monotonicity, not the known fy floor`);
      prev = b; prevR = r;
    }
  }
});

t('the lift threshold is reachable inside the tunable band, so the LIFT flag is not decoration', () => {
  // Recorded as a property because it is the argument for flagging it in the UI at all: on a
  // tall-CG chassis the rear inside wheel lifts around rsBalance 0.55, well inside the range
  // a solver will ask for. If this ever stops being true, the flag can be reconsidered.
  const tall = { ...M.DEF_CH, useRideHeightCG: false, cgHeight: 0.68 };
  const first = RS_GRID.find(r => lifts(tall, r));
  ok(first != null && first < 0.70,
    `expected a tall-CG chassis to lift inside the band, first lift at ${first}`);
  ok(!lifts({ ...M.DEF_CH, useRideHeightCG: false, cgHeight: 0.32 }, 0.60),
    'a low-CG chassis must NOT lift at an ordinary target, or the flag would be permanent noise');
});

t('balanceFromRsBal is STRICTLY increasing across the band (model is not flat/saturated)', () => {
  for (const { name, ch } of CHASSIS) {
    const lo = M.balanceFromRsBal(ch, 0.20), hi = M.balanceFromRsBal(ch, 0.90);
    ok(hi - lo > 0.05,
      `${name}: balance moved only ${(hi - lo).toFixed(4)} across rsBal 0.20->0.90 — the model has gone flat, which makes every target solve meaningless`);
  }
});

t('displayRsBalance rises with rear axle stiffness and falls with front', () => {
  for (const { name, ch } of CHASSIS) {
    const mc = M.cornerMasses(ch);
    const kF = M.axleRollStiffness(2.5, mc.front, ch.trackF);
    const kR = M.axleRollStiffness(2.5, mc.rear, ch.trackR);
    const base = M.displayRsBalance(ch, kF, kR);
    ok(M.displayRsBalance(ch, kF, kR * 1.25) > base, `${name}: stiffer rear did not raise displayed balance`);
    ok(M.displayRsBalance(ch, kF * 1.25, kR) < base, `${name}: stiffer front did not lower displayed balance`);
  }
});

t('mechBalanceLLT FALLS with front roll-stiffness share (the mechanism itself)', () => {
  // Front stiffness share up -> more front load transfer -> front loses capacity -> the front
  // saturates first -> understeer, and the return value is 0.5 + G*(front − rear) capacity, so
  // it falls. This is the direction the whole app's sign convention rests on: a stiffer front
  // bar understeers. Getting it backwards would invert every recommendation in the app.
  for (const { name, ch } of CHASSIS) {
    let prev = Infinity;
    for (let sF = 0.2; sF <= 0.8001; sF += 0.05) {
      if (lifts(ch, 1 - sF)) break; // valid domain only, as above
      const b = M.mechBalanceLLT(ch, sF, 1 - sF);
      ok(b <= prev + 1e-12, `${name}: balance rose as front roll-stiffness share rose to ${sF.toFixed(2)}`);
      prev = b;
    }
  }
});

// -- 2. Scale invariance -----------------------------------------------------
console.log('\nScale invariance');

t('mechBalanceLLT depends only on the Kf/Kr ratio, not on absolute stiffness', () => {
  // Documented at the function ("callers may pass relative stiffnesses") and relied on by
  // balanceFromRsBal, which passes 1 and r/(1-r).
  for (const { name, ch } of CHASSIS) {
    for (const ratio of [0.4, 0.8, 1.0, 1.6, 3.0]) {
      const a = M.mechBalanceLLT(ch, 1, ratio);
      for (const scale of [1e-3, 0.5, 7, 4200]) {
        near(M.mechBalanceLLT(ch, scale, ratio * scale), a, 1e-9,
          `${name}: ratio ${ratio} scaled by ${scale}`);
      }
    }
  }
});

t('balanceFromRsBal agrees with a direct mechBalanceLLT call at the same ratio', () => {
  for (const { name, ch } of CHASSIS)
    for (const r of [0.3, 0.45, 0.5, 0.62, 0.8])
      near(M.balanceFromRsBal(ch, r), M.mechBalanceLLT(ch, 1 - r, r), 1e-9, `${name} at rsBal ${r}`);
});

// -- 3. Mirror symmetry ------------------------------------------------------
console.log('\nMirror symmetry');

const mirror = ch => ({
  ...ch,
  frontBias: 100 - ch.frontBias,
  trackF: ch.trackR, trackR: ch.trackF,
  tyreF: ch.tyreR, tyreR: ch.tyreF,
});

t('a front/rear-mirrored chassis with mirrored stiffness gives the mirrored balance', () => {
  // mechBalanceLLT is 0.5 + G*(front capacity - rear capacity), so swapping every front
  // quantity with its rear counterpart must reflect the result about 0.5. An asymmetry here
  // means one axle is being treated specially somewhere in latLoadTransfer or the grip term.
  for (const { name, ch } of CHASSIS) {
    for (const r of [0.25, 0.4, 0.5, 0.65, 0.85]) {
      const a = M.mechBalanceLLT(ch, 1 - r, r);
      const b = M.mechBalanceLLT(mirror(ch), r, 1 - r);
      if (a <= 1e-9 || a >= 1 - 1e-9) continue; // clamped — property 4 covers that separately
      near(b, 1 - a, 1e-9, `${name} at rsBal ${r}: mirror gave ${b}, expected ${1 - a}`);
    }
  }
});

t('natGeomOf mirrors, and is 0.5 on a symmetric chassis', () => {
  for (const { name, ch } of CHASSIS)
    near(M.natGeomOf(mirror(ch)), 1 - M.natGeomOf(ch), 1e-12, `${name}`);
  const sym = { ...M.DEF_CH, useRideHeightCG: false, frontBias: 50, trackF: 1.55, trackR: 1.55 };
  near(M.natGeomOf(sym), 0.5, 1e-12, 'symmetric chassis natural balance');
});

t('tireCorrOf is zero on square tyres and mirrors on staggered ones', () => {
  near(M.tireCorrOf({ ...M.DEF_CH, tyreF: '265/35R18', tyreR: '265/35R18' }), 0, 1e-12, 'square');
  const st = { ...M.DEF_CH, tyreF: '235/35R18', tyreR: '305/30R19' };
  ok(M.tireCorrOf(st) > 0, 'a wider rear tyre must push the displayed balance rearward');
  near(M.tireCorrOf(mirror(st)), -M.tireCorrOf(st), 1e-12, 'mirrored stagger');
});

// -- 4. Continuity and no saturation -----------------------------------------
console.log('\nContinuity / saturation');

t('balanceFromRsBal never hits its 0/1 clamp inside the realistic envelope', () => {
  // The clamp is a safety net, not physics — inside it the output carries information, at it
  // the model has stopped answering. KNOWN_ISSUES records the CG cap existing partly to keep
  // this from happening; this test is what would catch a recalibration that undoes that.
  for (const { name, ch } of CHASSIS)
    for (const r of RS_GRID) {
      const b = M.balanceFromRsBal(ch, r);
      ok(b > 1e-6 && b < 1 - 1e-6,
        `${name}: balance saturated at ${b} (rsBal ${r}) — the clamp is doing the model's work`);
    }
});

t('balanceFromRsBal is continuous — no step larger than a 0.01 rsBal move can justify', () => {
  for (const { name, ch } of CHASSIS) {
    let prev = null, prevR = null;
    for (const r of RS_GRID) {
      const b = M.balanceFromRsBal(ch, r);
      if (prev != null) ok(Math.abs(b - prev) < 0.05,
        `${name}: balance jumped ${(b - prev).toFixed(4)} between rsBal ${prevR} and ${r} — a discontinuity means a branch or clamp boundary, not physics`);
      prev = b; prevR = r;
    }
  }
});

t('latLoadTransfer conserves the roll couple across the front/rear split', () => {
  // Total roll moment resisted (elastic + geometric) must not depend on how the elastic part
  // is shared between the axles; only its distribution may.
  for (const { name, ch } of CHASSIS) {
    const total = sF => {
      const { dWf, dWr } = M.latLoadTransfer(ch, sF, 1 - sF);
      return dWf * ch.trackF + dWr * ch.trackR;
    };
    const ref = total(0.5);
    for (const sF of [0.2, 0.35, 0.65, 0.8])
      near(total(sF), ref, Math.abs(ref) * 1e-9 + 1e-6,
        `${name}: total roll couple moved when only the split changed (sF ${sF})`);
  }
});

t('latLoadTransfer shifts load transfer toward the stiffer axle', () => {
  for (const { name, ch } of CHASSIS) {
    let prev = -Infinity;
    for (const sF of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const { dWf } = M.latLoadTransfer(ch, sF, 1 - sF);
      ok(dWf > prev, `${name}: front load transfer did not rise with front roll-stiffness share at ${sF}`);
      prev = dWf;
    }
  }
});

// -- 5. Balance band direction -----------------------------------------------
console.log('\nBalance band');

const GAPS = [-0.18, -0.09, -0.03, -0.004, 0, 0.004, 0.03, 0.09, 0.18];

t('balanceBandDelta is monotone in frac on a positive gap, V-shaped on a negative one', () => {
  for (const gap of GAPS) {
    let prev = null, prevF = null;
    for (let f = 0; f <= 1.6001; f += 0.02) {
      const d = M.balanceBandDelta(f, gap);
      if (gap >= 0) {
        if (prev != null) ok(d >= prev - 1e-12,
          `gap ${gap}: delta fell from ${prev} (frac ${prevF}) to ${d} (frac ${f})`);
      } else if (f <= 1) {
        if (prev != null) ok(d <= prev + 1e-12, `gap ${gap}: delta rose before grip-neutral (frac ${f})`);
      } else {
        ok(d >= M.balanceBandDelta(1, gap) - 1e-12,
          `gap ${gap}: overshoot at frac ${f} landed short of grip-neutral`);
      }
      prev = d; prevF = f;
    }
  }
});

t('an overshoot fraction always overshoots toward OVERSTEER, whatever the gap sign', () => {
  // This is the drift-band inversion, as a property. frac>1 is a direction ("past
  // grip-neutral, into rotation"), so its delta must sit on the oversteer side of the
  // grip-neutral delta for a negative gap just as it does for a positive one.
  for (const gap of GAPS) {
    const atNeutral = M.balanceBandDelta(1, gap);
    for (const f of [1.05, 1.3, 1.55]) {
      const d = M.balanceBandDelta(f, gap);
      ok(d >= atNeutral - 1e-12,
        `gap ${gap}, frac ${f}: overshoot delta ${d} is on the understeer side of grip-neutral ${atNeutral}`);
      near(d - atNeutral, (f - 1) * Math.abs(gap), 1e-12,
        `gap ${gap}, frac ${f}: overshoot magnitude must scale with |gap|`);
    }
  }
});

t('balanceBandRange contains both endpoints AND every interior fraction', () => {
  // Endpoint min/max was the bug: on a negative gap the low extreme lies BETWEEN the
  // endpoints, at frac=1. Sampling the whole interval is the property that catches it.
  for (const gap of GAPS) {
    for (const [lo, hi] of [[0.15, 0.35], [0.35, 0.65], [0.55, 0.95], [0.6, 1.05], [0.9, 1.55], [0.75, 1.3]]) {
      const [dlo, dhi] = M.balanceBandRange(lo, hi, gap);
      ok(dlo <= dhi + 1e-12, `gap ${gap}, fracs ${lo}-${hi}: range is inverted`);
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const f = lo + (hi - lo) * i / steps;
        const d = M.balanceBandDelta(f, gap);
        ok(d >= dlo - 1e-9 && d <= dhi + 1e-9,
          `gap ${gap}, fracs ${lo}-${hi}: frac ${f.toFixed(3)} gives delta ${d}, outside the reported band [${dlo}, ${dhi}]`);
      }
    }
  }
});

t('every shipped BALANCE_BAND_FRACS pair produces a usable band on every chassis', () => {
  for (const { name, ch } of CHASSIS) {
    const gap = (1 - M.gripNeutralOf(ch)) - M.naturalMechBalanceOf(ch);
    for (const layout of Object.keys(M.BALANCE_BAND_FRACS))
      for (const build of Object.keys(M.BALANCE_BAND_FRACS[layout])) {
        const [lo, hi] = M.balanceBandFracs(layout, build);
        const [dlo, dhi] = M.balanceBandRange(lo, hi, gap);
        ok(Number.isFinite(dlo) && Number.isFinite(dhi), `${name} ${layout}/${build}: non-finite band`);
        ok(dlo <= dhi + 1e-12, `${name} ${layout}/${build}: inverted band`);
        const c = v => M.clampBalTarget(M.naturalMechBalanceOf(ch) + v);
        ok(c(dlo) >= 0.20 && c(dhi) <= 0.90, `${name} ${layout}/${build}: band escapes clampBalTarget`);
      }
  }
});

t('balanceBandFracs falls back to RWD for an unknown layout and to a default for a build', () => {
  const rwd = M.BALANCE_BAND_FRACS.RWD.track;
  ok(JSON.stringify(M.balanceBandFracs('6WD', 'track')) === JSON.stringify(rwd), 'unknown layout fallback');
  const fb = M.balanceBandFracs('RWD', 'hovercraft');
  ok(Array.isArray(fb) && fb.length === 2 && fb[0] < fb[1], 'unknown build fallback is a usable pair');
});

// -- 6. The gap's sign crossover ---------------------------------------------
console.log('\nGap crossover');

const gapAt = bias => {
  const ch = { ...M.DEF_CH, useRideHeightCG: false, frontBias: bias };
  return (1 - M.gripNeutralOf(ch)) - M.naturalMechBalanceOf(ch);
};

t('the natural-to-grip gap changes sign exactly once, just under 50% front bias', () => {
  // Documented at balanceBandDelta: 49.51% on DEF_CH. The property is that it happens once
  // and in that neighbourhood — not the exact figure, which is calibration.
  let flips = 0, at = null, prev = gapAt(35);
  for (let b = 35.5; b <= 65.001; b += 0.5) {
    const g = gapAt(b);
    if (Math.sign(g) !== Math.sign(prev) && prev !== 0) { flips++; at = b; }
    prev = g;
  }
  ok(flips === 1, `gap changed sign ${flips} times across 35-65% front bias, expected exactly 1`);
  ok(at > 45 && at < 55, `sign change landed at ${at}% front bias, expected between 45 and 55`);
});

t('nothing downstream of the gap jumps as it crosses zero', () => {
  // The crossover is where balanceBandDelta switches branch. A discontinuity in the resulting
  // target band there would mean a 0.01% weight-bias edit could move a recommendation visibly.
  for (const [lo, hi] of [[0.35, 0.65], [0.55, 0.95], [0.9, 1.55], [0.6, 1.05]]) {
    let prev = null, prevB = null;
    for (let b = 48.0; b <= 51.001; b += 0.01) {
      const ch = { ...M.DEF_CH, useRideHeightCG: false, frontBias: b };
      const nat = M.naturalMechBalanceOf(ch);
      const gap = (1 - M.gripNeutralOf(ch)) - nat;
      const [dlo, dhi] = M.balanceBandRange(lo, hi, gap);
      const cur = [nat + dlo, nat + dhi];
      if (prev) for (const i of [0, 1]) ok(Math.abs(cur[i] - prev[i]) < 0.005,
        `fracs ${lo}-${hi}: band edge ${i} jumped ${(cur[i] - prev[i]).toFixed(5)} between ${prevB.toFixed(2)}% and ${b.toFixed(2)}% front bias`);
      prev = cur; prevB = b;
    }
  }
});

t('gripNeutralOf and naturalMechBalanceOf both stay inside the 0-1 scale', () => {
  for (const { name, ch } of CHASSIS) {
    for (const v of [M.gripNeutralOf(ch), M.naturalMechBalanceOf(ch), M.natGeomOf(ch)])
      ok(v > 0 && v < 1, `${name}: ${v} is outside the 0-1 balance scale`);
  }
});

t('clampBalTarget is idempotent and covers the documented 0.20-0.90 band', () => {
  for (const v of [-5, 0, 0.1, 0.2, 0.5, 0.9, 1.4, 99]) {
    const c = M.clampBalTarget(v);
    ok(c >= 0.20 && c <= 0.90, `${v} clamped to ${c}, outside 0.20-0.90`);
    near(M.clampBalTarget(c), c, 0, `clamp of clamped ${v}`);
  }
  near(M.clampBalTarget(M.MECH_BALANCE_TARGET), M.MECH_BALANCE_TARGET, 0,
    'the default target must itself be inside the band');
});

// -- 7. Calibration envelope -------------------------------------------------
console.log('\nCalibration envelope');

const tuneAt = (fHz, rHz) => ({ fHz, rHz });
const tags = (ch, tune, gm = 'horizon') => M.balanceEnvelope(ch, tune, gm).map(e => e.tag);

t('a default chassis at fitted Hz is inside the envelope (no badge in the common case)', () => {
  const ch = { ...M.DEF_CH, useRideHeightCG: false };
  ok(tags(ch, tuneAt(3.0, 3.0)).length === 0,
    `expected no flags, got ${JSON.stringify(tags(ch, tuneAt(3.0, 3.0)))}`);
});

t('Hz outside the fitted band flags HZ, on either side and either axle', () => {
  const ch = { ...M.DEF_CH, useRideHeightCG: false };
  const [lo, hi] = M.FIT_HZ;
  ok(tags(ch, tuneAt(lo - 0.3, 3.0)).includes('HZ'), 'front below the band');
  ok(tags(ch, tuneAt(3.0, hi + 0.3)).includes('HZ'), 'rear above the band');
  ok(!tags(ch, tuneAt(lo, hi)).includes('HZ'), 'the band edges themselves are inside');
});

t('corner masses and tyre widths outside the fit flag MASS and TYRE', () => {
  const base = { ...M.DEF_CH, useRideHeightCG: false };
  ok(tags({ ...base, weight: 1500 }, tuneAt(3, 3)).includes('MASS'), 'very light car');
  ok(tags({ ...base, weight: 6000 }, tuneAt(3, 3)).includes('MASS'), 'very heavy car');
  ok(tags({ ...base, tyreF: '185/60R15', tyreR: '185/60R15' }, tuneAt(3, 3)).includes('TYRE'), 'narrow tyres');
  ok(tags({ ...base, tyreF: '355/25R21', tyreR: '355/25R21' }, tuneAt(3, 3)).includes('TYRE'), 'very wide tyres');
  const [wlo, whi] = M.FIT_TYRE_W;
  ok(!tags({ ...base, tyreF: `${wlo}/40R18`, tyreR: `${whi}/30R19` }, tuneAt(3, 3)).includes('TYRE'),
    'the sampled width edges are inside');
});

t('the tyre-series checks are skipped for a physical game mode, and CG is not', () => {
  // Physical modes stay suspension-only, so the tyre-series fit's bounds do not apply to them.
  // The LLT model behind GRIP and the Balance Guide runs in every mode, so the CG check must.
  const ch = { ...M.DEF_CH, useRideHeightCG: false, weight: 6000, tyreF: '355/25R21', tyreR: '355/25R21' };
  ok(M.isPhysical('beamng'), 'beamng must be a physical mode for this test to mean anything');
  ok(tags(ch, tuneAt(1.2, 5.0), 'beamng').length === 0,
    `expected no tyre-series flags in a physical mode, got ${JSON.stringify(tags(ch, tuneAt(1.2, 5.0), 'beamng'))}`);
  const tall = { ...M.DEF_CH, useRideHeightCG: true, tyreF: '315/70R17', tyreR: '315/70R17',
                 rideHeightF: 1.15, rideHeightR: 1.15 };
  ok(tags(tall, tuneAt(3, 3), 'beamng').includes('CG'), 'CG saturation must flag in a physical mode too');
});

t('CG flags only when the ride-height estimate actually leaves the CG Height range', () => {
  const on = { ...M.DEF_CH, useRideHeightCG: true };
  ok(!tags(on, tuneAt(3, 3)).includes('CG'), 'the default ride heights are well inside the range');
  const tall = { ...on, tyreF: '315/70R17', tyreR: '315/70R17', rideHeightF: 1.15, rideHeightR: 1.15 };
  ok(M.cgEstMmOf(tall) > M.CG_EST_MAX, 'this chassis must actually saturate for the test to mean anything');
  ok(tags(tall, tuneAt(3, 3)).includes('CG'), 'a saturated estimate must flag');
  ok(!tags({ ...tall, useRideHeightCG: false }, tuneAt(3, 3)).includes('CG'),
    "MANUAL CG entry is the user's own number — nothing to flag");
});

t('cgEstMmOf matches the documented estimate and returns null on a partial tyre size', () => {
  const ch = { ...M.DEF_CH, useRideHeightCG: true, tyreF: '265/35R18', tyreR: '265/35R18',
               rideHeightF: 0.13, rideHeightR: 0.12, frontBias: 52 };
  const r = M.parseTyre('265/35R18').radius;
  near(M.cgEstMmOf(ch), r + 130 * 0.52 + 120 * 0.48, 1e-9, 'tyre radius + weighted ride height');
  ok(M.cgEstMmOf({ ...ch, tyreR: '265' }) === null, 'a width-only tyre size gives no radius');
});

t('LIFT flags a roll-stiffness split that unloads an inside wheel, and only then', () => {
  // The flag reads the solved roll stiffnesses off the tune, so a tune without them (the
  // Hz-only stubs above) must not flag — that is what keeps the other envelope tests honest.
  const rs = (ch, rsBal) => {
    const mc = M.cornerMasses(ch);
    const total = M.axleRollStiffness(3.0, mc.front, ch.trackF) + M.axleRollStiffness(3.0, mc.rear, ch.trackR);
    return { fHz: 3, rHz: 3, rsSpF: total * (1 - rsBal), rsSpR: total * rsBal, rsAbF: 0, rsAbR: 0 };
  };
  const tall = { ...M.DEF_CH, useRideHeightCG: false, cgHeight: 0.68 };
  const low = { ...M.DEF_CH, useRideHeightCG: false, cgHeight: 0.32 };
  ok(tags(tall, rs(tall, 0.85)).includes('LIFT'), 'a tall-CG car at a high rear split must flag');
  ok(tags(tall, rs(tall, 0.85), 'beamng').includes('LIFT'), 'the LLT model is not Forza-specific');
  ok(!tags(low, rs(low, 0.60)).includes('LIFT'), 'an ordinary low-CG tune must not flag');
  ok(!tags(low, tuneAt(3, 3)).includes('LIFT'), 'no roll stiffnesses on the tune means no verdict');
  const rearBiased = { ...M.DEF_CH, useRideHeightCG: false, frontBias: 41 };
  ok(tags(rearBiased, rs(rearBiased, 0.20)).includes('LIFT'),
    'the front inside wheel lifts at a low rear split on a rear-biased car — both axles are checked');
});

t('balanceEnvelope tolerates a missing tune (first render, before a solve)', () => {
  const ch = { ...M.DEF_CH, useRideHeightCG: false, weight: 6000 };
  const got = M.balanceEnvelope(ch, null, 'horizon');
  ok(Array.isArray(got), 'must still return an array');
  ok(got.map(e => e.tag).includes('MASS'), 'chassis-only checks still run without a tune');
});

t('severity is assigned by kind: the fit bounds are soft, a broken model is hard', () => {
  // The badge is amber only when something hard is present, so this split is what keeps amber
  // meaningful. An ordinary 2.2 Hz street tune is outside the fitted Hz band and must NOT be
  // amber; a lifted inside wheel or a saturated CG must be.
  const base = { ...M.DEF_CH, useRideHeightCG: false };
  const kind = (ch, tune) => Object.fromEntries(M.balanceEnvelope(ch, tune, 'horizon').map(e => [e.tag, e.hard]));
  const soft = kind({ ...base, weight: 6000, tyreF: '185/60R15', tyreR: '185/60R15' }, tuneAt(2.2, 2.2));
  for (const tag of ['HZ', 'MASS', 'TYRE'])
    ok(soft[tag] === false, `${tag} must be soft (extrapolation), got ${soft[tag]}`);
  const tall = { ...M.DEF_CH, useRideHeightCG: true, tyreF: '315/70R17', tyreR: '315/70R17',
                 rideHeightF: 1.15, rideHeightR: 1.15 };
  ok(kind(tall, tuneAt(3, 3)).CG === true, 'CG saturation must be hard');
  const mc = M.cornerMasses(base);
  const total = M.axleRollStiffness(3, mc.front, base.trackF) + M.axleRollStiffness(3, mc.rear, base.trackR);
  const lifted = { ...base, cgHeight: 0.68 };
  ok(kind(lifted, { fHz: 3, rHz: 3, rsSpF: total * 0.15, rsSpR: total * 0.85, rsAbF: 0, rsAbR: 0 }).LIFT === true,
    'inside-wheel lift must be hard');
});

t('every flag carries a tag and a non-empty detail for the tooltip', () => {
  const ch = { ...M.DEF_CH, useRideHeightCG: true, weight: 6000, tyreF: '355/25R21', tyreR: '355/25R21',
               rideHeightF: 1.2, rideHeightR: 1.2 };
  const env = M.balanceEnvelope(ch, tuneAt(1.0, 5.2), 'horizon');
  ok(env.length >= 3, `expected several flags on a deliberately out-of-envelope build, got ${env.length}`);
  for (const e of env) {
    ok(typeof e.tag === 'string' && /^[A-Z]+$/.test(e.tag), `bad tag: ${JSON.stringify(e.tag)}`);
    ok(typeof e.detail === 'string' && e.detail.length > 20, `bad detail for ${e.tag}: ${JSON.stringify(e.detail)}`);
    ok(typeof e.hard === 'boolean', `${e.tag} must declare a severity, got ${JSON.stringify(e.hard)}`);
  }
  ok(new Set(env.map(e => e.tag)).size === env.length, 'tags must not repeat');
});

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
