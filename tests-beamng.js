// SUSP.OS — physical-unit (BeamNG) game mode tests
// Run with: node tests-beamng.js
// No dependencies required.
//
// UNLIKE tests.js, THIS FILE READS index.html. tests.js is a hand-maintained mirror of the
// physics functions and so cannot catch a change made only in the app; that gap is recorded
// in README and docs/CODE_MAP.md. The BeamNG mode is defined entirely by what it *doesn't*
// do to the solver's output, which a mirror cannot express — a mirror of "return the value
// unchanged" asserts nothing. So this suite lifts the real physics layer out of index.html
// and drives it directly.
//
// What it guards:
//   1. beamng emits exactly the pre-conversion physics (no calibration constant involved).
//   2. horizon/motorsport output is still recoverable from beamng output by applying only
//      the documented conversions — i.e. the branch diverges only where intended.
//   3. Physical mode is free of FORZA's quantisation — no click grid, no 1..lim floor or
//      ceiling. It has its own: BeamNG's sliders snap (500 N/m spring, 1000 N/m anti-roll,
//      100 N/m/s damper), and since the app is a starting-point calculator whose numbers get
//      typed into that menu, the solve reports the physics of the snapped value. What this
//      suite pins is that the two quantisations stay separate and that mr stays out of both.
//   4. CO-SOLVE's ARB_UTIL_REF substitution is neutral (the denominator cancels).
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

// Order matters: the DEF_* literals execute at eval time and the enum block reads them.
const M = new Function(
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbCtx=') +
  '\nreturn{computeTune,feelToPhysics,DEF_CH,DEF_FE,GAME_LIMITS,ARB_RS_SCALE,' +
  'DAMPING_CALIBRATION,LB_IN_TO_NM,NMM_PER_LBIN,KGFMM_PER_LBIN,springUnit,cornerMasses,isPhysical,' +
  'springOut,dampOut,arbOut,warnOver,mrDiv,PHYS_SNAP,arbScaleOf,solveArbScale,solveTune,' +
  'displayRsBalance,displayNatOffsetOf,ARB_SCALE_MAX,tireCorrOf,arbScaleStale};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const near = (got, want, tol, what) => {
  if (Math.abs(got - want) > tol * Math.max(1, Math.abs(want)))
    throw new Error(`${what}: got ${got}, expected ${want}`);
};
const solve = (chOver, feOver, mode) => {
  const ch = { ...M.DEF_CH, ...chOver }, fe = { ...M.DEF_FE, ...feOver };
  return { ch, fe, tune: M.computeTune(ch, M.feelToPhysics(ch, fe), mode) };
};

const CHS = [
  ['default', {}],
  ['light RWD', { weight: 2400, frontBias: 45, layout: 'RWD', trackF: 1.45, trackR: 1.48 }],
  ['heavy FWD', { weight: 4200, frontBias: 60, layout: 'FWD', trackF: 1.62, trackR: 1.58 }],
];

console.log('\n── mode plumbing ──');
t('beamng is a registered game mode with no ceiling', () => {
  const g = M.GAME_LIMITS.beamng;
  if (!g) throw new Error('GAME_LIMITS.beamng missing');
  if (g.arb !== null || g.damping !== null) throw new Error('beamng must have null limits');
  if (!M.isPhysical('beamng')) throw new Error('isPhysical(beamng) should be true');
});
t('the Forza modes are not physical', () => {
  if (M.isPhysical('horizon') || M.isPhysical('motorsport'))
    throw new Error('a click-scale mode must not report physical');
});
t('NMM_PER_LBIN matches Forza "N/mm" (10x true N/mm), KGFMM_PER_LBIN is Forza kgf/mm (also 10x)', () => {
  // Forza's metric spring label is N/mm but its number is N/cm — verified in-game
  // (1903.7 shown vs 190.4 true N/mm). See docs/HISTORY.md before "fixing" this to /1000.
  // Asserted from first principles, not the app's own constants.
  near(M.NMM_PER_LBIN, 10 * 4.4482216152605 / 25.4, 1e-6, 'Forza N/mm per lb/in');
  near(M.KGFMM_PER_LBIN, 10 * 0.45359237 / 25.4, 1e-9, 'kgf/mm per lb/in');
});

console.log('\n── output units (verified against BeamNG\'s own sliders) ──');
t('springs come out in N/m, not N/mm, snapped to the slider grid', () => {
  // The unit BeamNG's Spring Rate slider uses. Confusing the two is a 1000x error.
  const o = M.springOut(400, 'beamng', false);
  if (o.unit !== 'N/m') throw new Error(`unit is "${o.unit}"`);
  // Snapped to BeamNG's 500 N/m step, not the raw conversion: the printed number has to be
  // one the slider can actually hold. Asserted as "the grid point nearest the true value" so
  // this still fails if the conversion itself regresses, not just if the snap is dropped.
  const raw = 400 * M.LB_IN_TO_NM;
  near(o.value, Math.round(raw / M.PHYS_SNAP.spring) * M.PHYS_SNAP.spring, 1e-9, 'N/m value');
  if (o.value % M.PHYS_SNAP.spring !== 0) throw new Error(`${o.value} is off the 500 N/m grid`);
  if (Math.abs(o.value - raw) > M.PHYS_SNAP.spring / 2) throw new Error('snapped to the wrong grid point');
  if (o.value < 10000) throw new Error(`${o.value} looks like N/mm, not N/m`);
});
t('the Forza spring-unit paths are untouched by the physical branch', () => {
  if (M.springOut(400, 'horizon', M.springUnit('lbin')).unit !== 'lb/in') throw new Error('lb/in changed');
  if (M.springOut(400, 'horizon', M.springUnit('nmm')).unit !== 'N/mm') throw new Error('N/mm changed');
  if (M.springOut(400, 'horizon', M.springUnit('kgfmm')).unit !== 'kgf/mm') throw new Error('kgf/mm changed');
  // Absolute, not `400 * M.NMM_PER_LBIN` — comparing the function against the same
  // constant it uses passes under any value and would pin nothing.
  near(M.springOut(400, 'horizon', M.springUnit('nmm')).value, 700.5, 1e-2, 'Forza N/mm value');
  near(M.springOut(400, 'horizon', M.springUnit('kgfmm')).value, 71.43, 1e-2, 'kgf/mm value');
});
t('damping is labelled N/m/s, BeamNG\'s spelling of N·s/m', () => {
  const o = M.dampOut(5000, M.GAME_LIMITS.beamng);
  if (o.unit !== 'N/m/s') throw new Error(`unit is "${o.unit}"`);
  near(o.value, 5000, 1e-12, 'value passes through unscaled at mr=1');
});
t('ARB comes out as a LINEAR N/m rate, not torsional N·m/rad', () => {
  const track = 1.55, rs = 12000;
  const o = M.arbOut(rs, M.GAME_LIMITS.beamng, track);
  if (o.unit !== 'N/m') throw new Error(`unit is "${o.unit}"`);
  // Same treatment as springs: the linear rate, snapped to the 1000 N/m Anti-Roll grid.
  const raw = 2 * rs / (track * track);
  near(o.value, Math.round(raw / M.PHYS_SNAP.arb) * M.PHYS_SNAP.arb, 1e-9, 'k = 2·rs/track²');
  if (Math.abs(o.value - raw) > M.PHYS_SNAP.arb / 2) throw new Error('snapped to the wrong grid point');
});
t('Forza readouts still show a "/ N" denominator', () => {
  if (M.dampOut(7.8, M.GAME_LIMITS.horizon).unit !== '/ 20') throw new Error('damper suffix');
  if (M.arbOut(21.4, M.GAME_LIMITS.motorsport).unit !== '/ 40') throw new Error('ARB suffix');
});

console.log('\n── motion ratio (display-only) ──');
t('mrDiv squares the ratio and defends against nonsense input', () => {
  near(M.mrDiv(1), 1, 1e-12, 'unity'); near(M.mrDiv(0.7), 0.49, 1e-12, 'squared');
  for (const bad of [0, -1, null, undefined, NaN, 'x'])
    if (M.mrDiv(bad) !== 1) throw new Error(`mrDiv(${String(bad)}) = ${M.mrDiv(bad)}`);
});
t('a motion ratio below 1 stiffens the displayed spring and damper rate', () => {
  // Both sides snap, so compare against the snapped expectation rather than the exact quotient.
  const snap = (v, step) => Math.round(v / step) * step;
  const raw = 400 * M.LB_IN_TO_NM;
  near(M.springOut(400, 'beamng', false, 0.7).value, snap(raw / 0.49, M.PHYS_SNAP.spring), 1e-9, 'spring at mr 0.7');
  near(M.dampOut(5000, M.GAME_LIMITS.beamng, 0.5).value, snap(5000 / 0.25, M.PHYS_SNAP.damp), 1e-9, 'damper at mr 0.5');
  // The direction is the actual claim: a lower ratio must raise the printed number.
  if (M.springOut(400, 'beamng', false, 0.7).value <= M.springOut(400, 'beamng', false, 1).value)
    throw new Error('mr 0.7 did not stiffen the displayed spring rate');
});
t('motion ratio never reaches the physics — Hz and balance are wheel-rate quantities', () => {
  const a = solve({}, {}, 'beamng').tune;
  const b = solve({ motionRatioF: 0.6, motionRatioR: 0.55 }, {}, 'beamng').tune;
  for (const k of ['springF', 'springR', 'rebF', 'bumpR', 'arbF', 'arbR', 'fHz', 'rHz',
                   'mechBalance', 'bTot', 'arbShare', 'rollDeg'])
    near(a[k], b[k], 1e-12, `${k} moved when a motion ratio was set`);
});
t('ARB motion ratio never reaches the physics either', () => {
  const a = solve({}, {}, 'beamng').tune;
  const b = solve({ arbMotionRatioF: 0.45, arbMotionRatioR: 0.62 }, {}, 'beamng').tune;
  for (const k of ['springF', 'springR', 'rebF', 'bumpR', 'arbF', 'arbR', 'fHz', 'rHz',
                   'mechBalance', 'bTot', 'arbShare', 'rollDeg'])
    near(a[k], b[k], 1e-12, `${k} moved when an ARB motion ratio was set`);
});
t('ARB motion ratio scales the printed N/m by 1/mr², per axle', () => {
  const lim = M.GAME_LIMITS.beamng, rs = 12000, track = 1.55;
  near(M.arbOut(rs, lim, track, 1).value, M.arbOut(rs, lim, track).value, 1e-12,
       'default must match an omitted ratio');
  const plain = M.arbOut(rs, lim, track, 1).value, scaled = M.arbOut(rs, lim, track, 0.45).value;
  near(scaled / plain, 1 / M.mrDiv(0.45), 0.02, 'scaling is 1/mr² up to the 1000 N/m snap');
});
t('ARB display and MAN-mode entry invert each other exactly', () => {
  // The two conversions live apart (arbOut vs the MAN field / TUNE CHECK import). An
  // asymmetry between them made a spring value round-trip to a different tune once.
  const lim = M.GAME_LIMITS.beamng;
  for (const track of [1.40, 1.55, 1.82])
    for (const mr of [1, 0.45, 0.2, 1.5])
      for (const rs of [4000, 12000, 45000, 120000]) {
        const shown = M.arbOut(rs, lim, track, mr).value;
        const stored = shown * track * track * M.mrDiv(mr) / 2;   // what MAN entry stores
        near(M.arbOut(stored, lim, track, mr).value, shown, 1e-9,
             `round-trip drifted at track ${track}, mr ${mr}, rs ${rs}`);
      }
});
t('motion ratio is inert in the Forza modes', () => {
  const o = M.springOut(400, 'horizon', false, 0.5);
  near(o.value, 400, 1e-12, 'lb/in output ignores mr');
});

console.log('\n── springs ──');
for (const [label, over] of CHS) {
  t(`${label}: spring rate is mode-invariant up to BeamNG's slider grid`, () => {
    // No longer bit-identical across modes: BeamNG snaps the spring to its 500 N/m step and
    // re-derives Hz from the snapped rate, so the tune describes what the slider can hold.
    // Forza has no comparable spring grid and is left exact. The solve underneath is still the
    // same one, which is what this pins — the two may differ by at most half a step.
    const b = solve(over, {}, 'beamng').tune.springF, h = solve(over, {}, 'horizon').tune.springF;
    const halfStepLbIn = (M.PHYS_SNAP.spring / 2) / M.LB_IN_TO_NM;
    if (Math.abs(b - h) > halfStepLbIn + 1e-9)
      throw new Error(`springF ${b} vs ${h} differs by more than half a 500 N/m step`);
    if (Math.abs(Math.round(b * M.LB_IN_TO_NM / M.PHYS_SNAP.spring) * M.PHYS_SNAP.spring - b * M.LB_IN_TO_NM) > 1e-6)
      throw new Error(`beamng springF ${b} lb/in is not on the 500 N/m grid`);
  });
  t(`${label}: N/m output equals the wheel rate exactly`, () => {
    const { ch, tune } = solve(over, {}, 'beamng');
    const m = M.cornerMasses(ch);
    const wr = Math.pow(tune.fHz * 2 * Math.PI, 2) * m.front;   // N/m
    near(M.springOut(tune.springF, 'beamng', false, ch.motionRatioF).value, wr, 1e-9, 'springF in N/m');
  });
}

console.log('\n── dampers ──');
for (const [label, over] of CHS) {
  t(`${label}: beamng damping is the raw coefficient, uncalibrated`, () => {
    const { ch, tune } = solve(over, {}, 'beamng');
    const m = M.cornerMasses(ch);
    const wr = Math.pow(tune.fHz * 2 * Math.PI, 2) * m.front;
    const cc = 2 * Math.sqrt(wr * m.front);                     // N.s/m
    near(tune.rebF, cc * (tune.zetaF / 100), 1e-9, 'rebF');
  });
  t(`${label}: horizon damping == beamng damping x DAMPING_CALIBRATION`, () => {
    const b = solve(over, {}, 'beamng').tune, h = solve(over, {}, 'horizon').tune;
    near(h.rebF, Math.round(b.rebF * M.DAMPING_CALIBRATION * 10) / 10, 1e-9, 'rebF');
    near(h.bumpR, Math.round(b.bumpR * M.DAMPING_CALIBRATION * 10) / 10, 1e-9, 'bumpR');
  });
  t(`${label}: damping lands inside BeamNG's documented 500-20000 N/m/s band`, () => {
    const b = solve(over, {}, 'beamng').tune;
    for (const k of ['rebF', 'rebR', 'bumpF', 'bumpR'])
      if (!(b[k] > 200 && b[k] < 30000)) throw new Error(`${k} = ${b[k].toFixed(1)} N.s/m`);
  });
}

t('an extreme setup that pins horizon is left unclamped in beamng', () => {
  const over = { weight: 5200, trackF: 1.7, trackR: 1.7 };
  const fe = { rearHzMode: 'independent', rearHzInd: 3.4, reboundZeta: 110 };
  if (!solve(over, fe, 'horizon').tune.dampingClamped)
    throw new Error('fixture no longer pins horizon — pick a harsher one');
  if (solve(over, fe, 'beamng').tune.dampingClamped)
    throw new Error('beamng reported dampingClamped despite having no ceiling');
});

t("physical damping snaps to BeamNG's grid, not to Forza's 0.1 clicks", () => {
  const b = solve({}, {}, 'beamng').tune;
  // The claim this test has always made is that Forza's click quantisation does not leak into
  // the physical modes. That still holds — but "full precision" no longer does, because these
  // modes now snap to BeamNG's own 100 N/m/s damper step and report the zeta that value gives.
  for (const k of ['rebF', 'rebR', 'bumpF', 'bumpR'])
    if (b[k] % M.PHYS_SNAP.damp !== 0) throw new Error(`${k} = ${b[k]} is off the 100 N/m/s grid`);
  // A value on the 100 grid is trivially also on a 0.1 grid, so the old check cannot tell the
  // two apart. What actually distinguishes them: Forza's clicks are bounded by lim.damping and
  // these are not, and a click value would be orders of magnitude smaller.
  if (b.rebF < 100) throw new Error(`rebF ${b.rebF} looks like a click value, not N/m/s`);
});

console.log('\n── anti-roll bars ──');
for (const [label, over] of CHS) {
  t(`${label}: beamng ARB output IS the roll stiffness`, () => {
    const b = solve(over, {}, 'beamng').tune;
    near(b.rsAbF, b.arbF, 1e-12, 'rsAbF vs arbF');
    near(b.rsAbR, b.arbR, 1e-12, 'rsAbR vs arbR');
  });
  t(`${label}: horizon clicks == beamng N.m/rad / (ARB_RS_SCALE x track^2)`, () => {
    const { ch } = solve(over, {}, 'beamng');
    const b = solve(over, {}, 'beamng').tune, h = solve(over, {}, 'horizon').tune;
    // Both modes quantise, on different grids — Forza to 0.1 clicks, BeamNG to 1000 N/m of
    // linear anti-roll rate — so this can no longer be an exact identity. It pins the thing
    // that matters: the same roll-stiffness budget underneath, agreeing once both snaps are
    // allowed for. One Forza click is ARB_RS_SCALE*track^2 of roll stiffness, so half a
    // BeamNG step is half of (1000*track^2/2) expressed in clicks.
    const tol = (t2) => (M.PHYS_SNAP.arb * t2 / 2) / 2 / (M.ARB_RS_SCALE * t2) + 0.05 + 1e-9;
    const cF = b.arbF / (M.ARB_RS_SCALE * ch.trackF * ch.trackF);
    const cR = b.arbR / (M.ARB_RS_SCALE * ch.trackR * ch.trackR);
    if (Math.abs(h.arbF - cF) > tol(ch.trackF * ch.trackF)) throw new Error(`arbF ${h.arbF} vs ${cF}`);
    if (Math.abs(h.arbR - cR) > tol(ch.trackR * ch.trackR)) throw new Error(`arbR ${h.arbR} vs ${cR}`);
  });
}

t('MAN ARB values are taken verbatim in physical mode', () => {
  const b = solve({}, { arbMode: 'man', arbManF: 14000, arbManR: 9000 }, 'beamng').tune;
  near(b.arbF, 14000, 1e-12, 'arbF'); near(b.arbR, 9000, 1e-12, 'arbR');
});

t('NEUTRAL never reports "ARB maxed" without a ceiling', () => {
  for (const [, over] of CHS)
    if (solve(over, { arbBalMode: 'neutral', arbBias: 45 }, 'beamng').tune.neutralClamped)
      throw new Error('neutralClamped fired in a mode with no maximum');
});

t('roll angle stays physical across chassis', () => {
  for (const [label, over] of CHS) {
    const d = solve(over, {}, 'beamng').tune.rollDeg;
    if (!(d > 0 && d < 15)) throw new Error(`${label}: rollDeg ${d}`);
  }
});

console.log('\n── CO-SOLVE ──');
t('ARB_UTIL_REF substitution is neutral across a target sweep', () => {
  // lim.arb divides BOTH sides of the spUtil/abUtil comparison, so it cancels. Any
  // divergence here means the saturation clamp is biting differently between modes.
  const bad = [];
  for (let x = 40; x <= 80; x += 2) {
    const fe = { arbBalMode: 'coSolve', arbBalTarget: x / 100, springShareAuto: true };
    const h = solve({}, fe, 'horizon').tune.coSolveAutoS;
    const b = solve({}, fe, 'beamng').tune.coSolveAutoS;
    if (h !== b) bad.push(`${x / 100}: horizon ${h} vs beamng ${b}`);
  }
  if (bad.length) throw new Error(bad.join('; '));
});
t('CO-SOLVE still converges in physical mode (not pinned across the range)', () => {
  const seen = new Set();
  for (let x = 54; x <= 80; x += 2)
    seen.add(solve({}, { arbBalMode: 'coSolve', arbBalTarget: x / 100, springShareAuto: true }, 'beamng').tune.coSolveAutoS);
  if (seen.size < 5) throw new Error(`only ${seen.size} distinct S values — search looks stuck`);
});

console.log('\n── Forza regression guard ──');
t('every Forza mode/ARB-mode combination still solves identically to its own math', () => {
  // Not a stored snapshot: each Forza value is re-derived from the beamng value through the
  // documented conversion, so this stays meaningful if the underlying physics legitimately
  // changes. It only fails if the beamng branch leaks into the Forza path.
  const FES = [
    {}, { arbBalMode: 'neutral', arbBias: 20 }, { arbBalMode: 'mech', arbBalTarget: 0.58 },
    { arbMode: 'roll', arbTargetRollMan: 1.2 }, { arbMode: 'share', arbShareMan: 28 },
  ];
  for (const mode of ['horizon', 'motorsport']) {
    const lim = M.GAME_LIMITS[mode];
    for (const [label, over] of CHS)
      for (const fe of FES) {
        const r = solve(over, fe, mode).tune;
        for (const k of ['rebF', 'rebR', 'bumpF', 'bumpR'])
          if (r[k] < 1 || r[k] > lim.damping)
            throw new Error(`${mode}/${label}: ${k}=${r[k]} outside 1..${lim.damping}`);
        for (const k of ['arbF', 'arbR'])
          if (r[k] < 1 || r[k] > lim.arb)
            throw new Error(`${mode}/${label}: ${k}=${r[k]} outside 1..${lim.arb}`);
      }
  }
});

console.log('\n── MEASURE NAT BAL ──');
t('a measured natural balance is not double-counted with the tyre-width correction', () => {
  // Ultima Evo, 245/335 tyres, Forza reads 0.65 at equal Hz and 1/1 bars. The measured value is
  // taken off Forza's display, which already contains the tyre-width effect, so the app must read
  // back exactly that value at the same setup — it used to show 0.674 (tireCorr added twice).
  const ch = { weight: 2102, frontBias: 38, trackF: 1.605, trackR: 1.515, cgHeight: 0.425,
    tyreF: '245/30/18', tyreR: '335/25/18', useMeasuredNatBal: true, measuredNatBal: 0.65 };
  const fe = { rideStiffness: 2.5, rearHzMode: 'multiplier', rearHzMult: 1.0, rideRef: 'shared',
    arbMode: 'man', arbManF: 1, arbManR: 1 };
  for (const mode of ['horizon', 'motorsport'])
    near(solve(ch, fe, mode).tune.mechBalance, 0.65, 0.003, `${mode} anchor`);
  // Square tyres: no tyre term, so the same measurement must also read back unchanged.
  near(solve({ ...ch, tyreF: '355/20/18', tyreR: '355/25/18' }, fe, 'horizon').tune.mechBalance,
    0.65, 0.003, 'square-tyre anchor');
});

console.log('\n── MEASURE ARB ──');
const ARB_CAL = { weight: 2950, frontBias: 65, trackF: 1.553, trackR: 1.561, tyreF: '235/35R19',
  tyreR: '235/35R19', useMeasuredNatBal: true, measuredNatBal: 0.38 };
const ARB_CAL_FE = { rideStiffness: 2.5, rearHzMode: 'multiplier', rearHzMult: 1.0, rideRef: 'shared', arbMode: 'man' };
t('a measured scale is flagged stale when MEAS. NAT BAL or its Hz changes, never when unknown', () => {
  const ok = { ...ARB_CAL, measuredNatBalHz: 2.5, useMeasuredArbClick: true, measuredArbClick: 600, measuredArbNat: 0.38, measuredArbNatHz: 2.5 };
  if (M.arbScaleStale(ok)) throw new Error('fresh flagged');
  if (!M.arbScaleStale({ ...ok, measuredNatBal: 0.40 })) throw new Error('NAT change missed');
  if (!M.arbScaleStale({ ...ok, measuredNatBalHz: 3.0 })) throw new Error('Hz change missed');
  if (!M.arbScaleStale({ ...ok, useMeasuredNatBal: false })) throw new Error('cleared NAT missed');
  if (M.arbScaleStale({ ...ok, measuredNatBalHz: null })) throw new Error('null Hz is 2.5');
  if (M.arbScaleStale({ ...ok, measuredArbNat: null })) throw new Error('older scale flagged');
  if (M.arbScaleStale({ ...ok, useMeasuredArbClick: false, measuredNatBal: 0.40 })) throw new Error('default scale flagged');
});
t('no measured scale falls back to ARB_RS_SCALE; a measured one is used and clamped', () => {
  if (M.arbScaleOf(M.DEF_CH) !== M.ARB_RS_SCALE) throw new Error('default scale');
  if (M.arbScaleOf({ useMeasuredArbClick: true, measuredArbClick: 600 }) !== 600) throw new Error('measured');
  if (M.arbScaleOf({ useMeasuredArbClick: false, measuredArbClick: 600 }) !== M.ARB_RS_SCALE) throw new Error('flag off');
  if (M.arbScaleOf({ useMeasuredArbClick: true, measuredArbClick: 50000 }) !== M.ARB_SCALE_MAX) throw new Error('clamp');
  // The retired pre-tyre-model fields must not be read as the new scale (they'd halve the bars).
  if (M.arbScaleOf({ useMeasuredArbScale: true, measuredArbScale: 305 }) !== M.ARB_RS_SCALE) throw new Error('retired field read');
});
t('solveArbScale recovers the scale the model used, from either bar direction', () => {
  // Round trip through computeTune: solve the balance a known scale produces, then ask the
  // solver which scale gives that balance. Catches a wrong formula or a missed offset term.
  for (const scale of [300, 540, 900])
    for (const [f, r] of [[1, 46], [46, 1], [14, 51]]) {
      const ch = { ...ARB_CAL, useMeasuredArbClick: true, measuredArbClick: scale };
      const bal = solve(ch, { ...ARB_CAL_FE, arbManF: f, arbManR: r }, 'horizon').tune.mechBalance;
      near(M.solveArbScale(ch, 2.5, f, r, bal), scale, 1e-6, `scale ${scale} bars ${f}/${r}`);
    }
});
t('solveArbScale matches the in-game Scirocco R readings (all-row fit ~626)', () => {
  // Two readings carry Forza's 2dp rounding, so they land within several percent of the fit.
  const a = M.solveArbScale(ARB_CAL, 2.5, 14, 51, 0.47), b = M.solveArbScale(ARB_CAL, 2.5, 62, 3, 0.31);
  near((a + b) / 2, 670, 0.03, 'averaged rear/front-biased scale');
});
t('solveArbScale rejects a reading on the wrong side of natural', () => {
  // Rear bars can only move balance rearward; a reading below natural has no solution.
  if (M.solveArbScale(ARB_CAL, 2.5, 1, 46, 0.30) !== null) throw new Error('expected null');
});
t('a measured scale changes AUTO clicks inversely and leaves roll stiffness alone', () => {
  const r1 = solve(ARB_CAL, { rideStiffness: 2.5 }, 'horizon').tune;
  const r2 = solve({ ...ARB_CAL, useMeasuredArbClick: true, measuredArbClick: 2 * M.ARB_RS_SCALE }, { rideStiffness: 2.5 }, 'horizon').tune;
  near(r2.arbR, r1.arbR / 2, 0.05, 'rear clicks halve');
  near(r2.rsAbR, r1.rsAbR, 0.02, 'rear roll stiffness');
});

console.log('\n── tyre-series display ──');
// MX-5 Cup far-offset sweep: springs split front/rear, ARB 1/1, readings off Forza's display.
const MX5 = { weight: 2374, frontBias: 50, trackF: 1.495, trackR: 1.505, cgHeight: 0.429,
  tyreF: '215/40R17', tyreR: '215/40R17', useMeasuredNatBal: true, measuredNatBal: 0.52 };
const MX5_ROWS = [ // lb/in front, rear, Forza's reading
  [379, 379, .52], [342, 418, .56], [306, 460, .59], [272, 505, .63], [418, 342, .49], [460, 307, .46],
  [504, 272, .42], [532, 990, .62], [989, 533, .44], [465, 1087, .65], [1085, 466, .40], [341, 799, .66], [797, 342, .39]];
const displayFor = (ch, kF, kR) => {
  const rs = (k, tr) => k * M.LB_IN_TO_NM * tr * tr / 2 + M.ARB_RS_SCALE * tr * tr; // springs + a 1-click bar
  return M.displayRsBalance(ch, rs(kF, ch.trackF), rs(kR, ch.trackR)) + M.displayNatOffsetOf(ch);
};
t('the tyre-series display reproduces the MX-5 spring sweep within Forza\'s rounding', () => {
  // Without the tyre term these rows miss by up to 0.075 (rms 0.05). With it, rms is ~0.007: the
  // model is anchored on the 2dp 0.52 reading, whose true value the full fit put at 0.524, so every
  // row carries ~0.005 of that rounding on top of its own.
  const ch = { ...M.DEF_CH, ...MX5 };
  let ss = 0;
  for (const [kF, kR, g] of MX5_ROWS) {
    const d = displayFor(ch, kF, kR) - g; ss += d * d;
    if (Math.abs(d) > 0.015) throw new Error(`${kF}/${kR}: off by ${d.toFixed(3)}`);
  }
  const rms = Math.sqrt(ss / MX5_ROWS.length);
  if (rms > 0.009) throw new Error(`rms ${rms.toFixed(4)}`);
});
// Scirocco R (65% front) and Ultima Evo (38% front, 245/335 tyres) sweeps, springs split at 2.5 and
// 3.5 Hz. The uneven cars are what pin how tyre stiffness scales with load: sqrt(load) fits both;
// stiffness proportional to load misses the Scirocco's rows by ~0.01 more.
const SWEEPS = [
  [{ weight: 2950, frontBias: 65, trackF: 1.553, trackR: 1.561, tyreF: '235/35R19', tyreR: '235/35R19',
     useMeasuredNatBal: true, measuredNatBal: 0.38, measuredNatBalHz: 2.5 },
   [[613.1, 330.2, .38], [492.1, 402.2, .44], [439.1, 439.2, .47], [1201.2, 647.2, .39], [964.2, 788.1, .44],
    [1503.2, 502.1, .33], [861.2, 860.1, .47]]],
  [{ weight: 2102, frontBias: 38, trackF: 1.605, trackR: 1.515, tyreF: '245/30R18', tyreR: '335/25R18',
     useMeasuredNatBal: true, measuredNatBal: 0.65, measuredNatBalHz: 2.5 },
   [[255.3, 416.2, .65], [309.3, 337.2, .58], [338.3, 301.2, .55], [500.3, 816.2, .64], [397.3, 1004.2, .70],
    [606.3, 660.2, .58], [662.3, 589.4, .55]]]];
t('the tyre-series display reproduces the Scirocco and Ultima spring sweeps', () => {
  let ss = 0, n = 0;
  for (const [over, rows] of SWEEPS) {
    const ch = { ...M.DEF_CH, ...over };
    for (const [kF, kR, g] of rows) {
      const d = displayFor(ch, kF, kR) + M.tireCorrOf(ch) - g; ss += d * d; n++;
      if (Math.abs(d) > 0.02) throw new Error(`${over.frontBias}% front, ${kF}/${kR}: off by ${d.toFixed(3)}`);
    }
  }
  const rms = Math.sqrt(ss / n);
  // sqrt(load) gives ~0.006; load-proportional ~0.009 and fixed stiffness ~0.011.
  if (rms > 0.0075) throw new Error(`rms ${rms.toFixed(4)}`);
});
t('the display equals MEASURE NAT BAL at equal springs of the Hz it was read at', () => {
  // Ultima-like: nat moves with Hz on an uneven car, so the stored Hz must be the anchor.
  const base = { weight: 2102, frontBias: 38, trackF: 1.605, trackR: 1.515, tyreF: '245/30R18', tyreR: '335/25R18',
    useMeasuredNatBal: true, measuredNatBal: 0.64 };
  for (const hz of [2.5, 3.5]) {
    const ch = { ...M.DEF_CH, ...base, measuredNatBalHz: hz };
    const tune = solve(ch, { rideStiffness: hz, rearHzMode: 'multiplier', rearHzMult: 1.0, rideRef: 'shared',
      arbMode: 'man', arbManF: 1, arbManR: 1 }, 'horizon').tune;
    near(tune.mechBalance, 0.64, 0.004, `anchor at ${hz} Hz`);
  }
});

console.log('\n── solveTune ──');
const TARGET_FES = [
  ['MECH', { arbBalMode: 'mech' }], ['CO-SOLVE', { arbBalMode: 'coSolve' }],
  ['Rear Hz MECH', { rearHzMode: 'mech', rideRef: 'shared', arbMode: 'man', arbManF: 1, arbManR: 1 }]];
t('the displayed balance lands on the target in every target-seeking mode', () => {
  for (const [label, over] of TARGET_FES)
    for (const tgt of [0.45, 0.55, 0.62]) {
      const fe = { ...M.DEF_FE, rideStiffness: 2.5, ...over, arbBalTarget: tgt };
      const { tune } = M.solveTune({ ...M.DEF_CH }, fe, 'horizon');
      if (tune.mechBalClamped) continue;
      near(tune.mechBalance, tgt, 0.002, `${label} ${tgt}`);
    }
});
t('without the outer loop the same solves land short (so the loop is doing the work)', () => {
  const fe = { ...M.DEF_FE, rideStiffness: 3.0, rearHzMode: 'mech', rideRef: 'shared', arbMode: 'man',
    arbManF: 1, arbManR: 1, arbBalTarget: 0.62 };
  const direct = solve({}, fe, 'horizon').tune.mechBalance, looped = M.solveTune({ ...M.DEF_CH }, fe, 'horizon').tune.mechBalance;
  if (Math.abs(direct - 0.62) < 0.02) throw new Error(`direct solve already hits the target (${direct})`);
  near(looped, 0.62, 0.002, 'looped');
});
t('an unreachable target is reported against the target asked for, not the internal one', () => {
  const fe = { ...M.DEF_FE, arbBalMode: 'mech', arbMode: 'share', arbShareMan: 5, arbBalTarget: 0.85 };
  const { tune } = M.solveTune({ ...M.DEF_CH }, fe, 'horizon');
  if (!tune.mechBalClamped) throw new Error(`not flagged at ${tune.mechBalance}`);
});
t('physical modes and non-target modes pass straight through', () => {
  for (const [mode, fe] of [['beamng', { arbBalMode: 'mech', arbBalTarget: 0.6 }], ['horizon', {}]]) {
    const f = { ...M.DEF_FE, ...fe };
    const a = JSON.stringify(M.solveTune({ ...M.DEF_CH }, f, mode).tune), b = JSON.stringify(solve({}, fe, mode).tune);
    if (a !== b) throw new Error(`${mode} changed`);
  }
});

console.log('\n── bars at a click limit ──');
t('a bar pinned at a click limit holds the roll balance the unclamped split asked for', () => {
  // WEIGHT, SHARE 30%, stiff springs on a rear-weighted car: the front bar wants past 65 clicks.
  // BeamNG has no ceiling, so its roll balance is the unclamped one (to spring-snap noise).
  const fe = { arbBalMode: 'weight', arbMode: 'share', arbBias: -50, arbShareMan: 30, rideStiffness: 3 };
  const rb = x => (x.rsSpR + x.rsAbR) / (x.rsSpF + x.rsSpR + x.rsAbF + x.rsAbR);
  const h = solve({ frontBias: 40 }, fe, 'horizon').tune, b = solve({ frontBias: 40 }, fe, 'beamng').tune;
  if (h.arbF < 65) throw new Error(`front bar no longer pinned (${h.arbF})`);
  near(rb(h), rb(b), 0.005, 'roll balance vs unclamped');
});

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
