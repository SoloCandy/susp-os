// SUSP.OS — Ride Reference tests
// Run with: node tests/tests-ride.js
// No dependencies required.
//
// LIKE tests-beamng.js, THIS FILE READS index.html and drives the real physics — a mirror of
// "switching never changes the actual Hz" would only prove the mirror keeps its own promise.
//
// What it guards:
//   1. CO-SOLVE honours a REAR or SHARED Ride Reference: the Hz the slider sets is the Hz the
//      solve delivers, under Auto Spring Share too (its S moves with the front Hz, and the
//      two-pass fixed point this replaced swung by up to 0.4 Hz under ROLL).
//   2. A RIDE REF. switch (rideRefSwitch) leaves both axles where they were — including when the
//      derived axle sits clamped at the band edge, which re-anchoring alone could not reproduce,
//      and in BeamNG, where the snapped springs are the car.
//   3. BOTTOM G's (bottomGStep) only resolves while its slider is reachable, mirrors instead of
//      resolving when it comes back or the axle switches, and mirrors without rounding.
//   4. The stiffness sliders are bound to the stored setting, so every wheel notch moves it —
//      bound to BeamNG's snapped Hz, the wheel stalled at the soft end.
//   4. The stiffness sliders are bound to the stored setting, so every wheel notch moves it —
//      bound to BeamNG's snapped Hz, the wheel stalled at the soft end.
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the
// markers rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

const M = new Function(
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbRowMeta=') +
  '\nreturn{computeTune,feelToPhysics,coSolveRearOf,rideRefSwitch,bottomGStep,RIDE_REF_HOLD_TOL,' +
  'wheelStepOf,DEF_CH,DEF_FE,hzToRs,rsToHz,clampHz,HZ_MIN,HZ_MAX};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const near = (got, want, tol, what) => {
  if (!(Math.abs(got - want) <= tol)) throw new Error(`${what}: got ${got}, expected ${want} ±${tol}`);
};

const CHS = [
  ['default', {}],
  ['light RWD', { weight: 2400, frontBias: 45, layout: 'RWD', trackF: 1.45, trackR: 1.48 }],
  ['heavy FWD', { weight: 4200, frontBias: 60, layout: 'FWD', trackF: 1.62, trackR: 1.58 }],
];
const solve = (ch, fe) => {
  const physics = M.feelToPhysics(ch, fe);
  return { physics, tune: M.computeTune(ch, physics, fe.gameMode) };
};
const TOL = M.RIDE_REF_HOLD_TOL;

console.log('\n── CO-SOLVE: the REAR / SHARED slider gets the Hz it asks for ──');
// Skips only where the target is out of reach: the front pinned at a band edge, or the rear
// clamped by computeTune. Everywhere else the delivered Hz must be the slider's.
for (const [cn, co] of CHS) for (const ref of ['rear', 'shared']) for (const auto of [true, false]) {
  t(`${cn}, ${ref}, ${auto ? 'Auto' : 'manual'} Spring Share: slider Hz = delivered Hz`, () => {
    let checked = 0;
    for (const arbMode of ['auto', 'share', 'roll', 'basic'])
    for (const tgt of [0.40, 0.45, 0.50, 0.55, 0.60])
    for (let hz = 1.0; hz <= 4.0 + 1e-9; hz += 0.25) {
      const ch = { ...M.DEF_CH, ...co };
      const fe = { ...M.DEF_FE, gameMode: 'horizon', arbBalMode: 'coSolve', arbMode, arbTargetRollMan: 1.5,
        arbBalTarget: tgt, springShareAuto: auto, rideRef: ref, rideStiffness: M.hzToRs(hz) };
      const { tune } = solve(ch, fe);
      if (tune.fHz <= M.HZ_MIN + 1e-3 || tune.fHz >= M.HZ_MAX - 1e-3 || tune.rHz >= M.HZ_MAX - 1e-3 || tune.rHz <= M.HZ_MIN + 1e-3) continue;
      const got = ref === 'rear' ? tune.rHz : (tune.fHz + tune.rHz) / 2;
      near(got, M.hzToRs(hz), 0.002, `${arbMode} target ${tgt} at ${hz} Hz`);
      checked++;
    }
    if (checked < 100) throw new Error(`only ${checked} reachable cases — the sweep no longer tests anything`);
  });
}
t('regression: heavy FWD, ROLL, REAR 2.75 Hz no longer lands on 3.17 Hz', () => {
  const ch = { ...M.DEF_CH, ...CHS[2][1] };
  const fe = { ...M.DEF_FE, gameMode: 'horizon', arbBalMode: 'coSolve', arbMode: 'roll', arbTargetRollMan: 1.5,
    arbBalTarget: 0.60, springShareAuto: true, rideRef: 'rear', rideStiffness: 2.75 };
  near(solve(ch, fe).tune.rHz, 2.75, 0.002, 'rear Hz');
});
t('computeTune and the inversion read the same rear solve (coSolveRearOf)', () => {
  if (!/effectiveRHz=clampHz\(rawHz\)/.test(src)) throw new Error('computeTune no longer takes its rear from coSolveRearOf');
  if (!/coSolveRearOf\(ch,f,csOpts,fe\.gameMode\)/.test(src)) throw new Error('feelToPhysics no longer inverts through coSolveRearOf');
});

console.log('\n── RIDE REF. switch holds the car ──');
const sweepSwitch = (gm, bal, check) => {
  for (const [cn, co] of CHS)
  for (const mode of ['multiplier', 'flatRide', 'mech', 'independent'])
  for (const from of ['front', 'shared', 'rear']) for (const to of ['front', 'shared', 'rear']) {
    if (from === to || (from === 'shared' && mode === 'independent')) continue;
    for (const hz of [0.9, 1.5, 2.2, 3.0, 4.0, 5.0]) for (const mult of [0.8, 1.1, 1.3, 1.6]) for (const spd of [60, 100, 160]) {
      const ch = { ...M.DEF_CH, ...co };
      const fe = { ...M.DEF_FE, gameMode: gm, arbBalMode: bal, rearHzMode: mode, rideRef: from,
        rideStiffness: M.hzToRs(hz), rearHzMult: mult, rearHzMan: Math.min(M.HZ_MAX, hz * mult), targetSpeed: spd };
      const a = solve(ch, fe);
      const fe2 = M.rideRefSwitch(ch, fe, fe, to, a.physics, a.tune);
      const b = solve(ch, fe2);
      check({ cn, mode, from, to, hz, mult, spd, a, b, fe, fe2 });
    }
  }
};
const where = c => `${c.cn} ${c.mode} ${c.from}→${c.to} @${c.hz} Hz ×${c.mult} ${c.spd} mph`;
const preOf = s => [s.physics.frontHz, s.tune.rHzTarget];
// INDEPENDENT → SHARED is the one switch with no exact form when the car's ratio lies outside
// MULTIPLIER's 0.50–3.00 (SHARED has no INDEPENDENT); docs/KNOWN_ISSUES.md.
const representable = c => {
  const [f, r] = preOf(c.a);
  return !(c.to === 'shared' && (r / f < 0.5 || r / f > 3));
};

t('HORIZON: every switch keeps both axles within the hold tolerance, clamped or not', () => {
  sweepSwitch('horizon', 'weight', c => {
    if (!representable(c)) return;
    const [f0, r0] = preOf(c.a), [f1, r1] = preOf(c.b);
    near(f1, f0, TOL, `front, ${where(c)}`);
    near(r1, r0, TOL, `rear, ${where(c)}`);
  });
});
t('BeamNG: every switch keeps both axles\' pre-snap Hz within the hold tolerance', () => {
  sweepSwitch('beamng', 'weight', c => {
    if (!representable(c)) return;
    const [f0, r0] = preOf(c.a), [f1, r1] = preOf(c.b);
    near(f1, f0, TOL, `front, ${where(c)}`);
    near(r1, r0, TOL, `rear, ${where(c)}`);
  });
});
t('CO-SOLVE: every switch whose rear is not clamped holds both axles', () => {
  for (const gm of ['horizon', 'beamng']) sweepSwitch(gm, 'coSolve', c => {
    if (c.a.tune.rHz >= M.HZ_MAX - 1e-3 || c.a.physics.frontHz <= M.HZ_MIN + 1e-3) return;
    const [f0, r0] = preOf(c.a), [f1, r1] = preOf(c.b);
    near(f1, f0, TOL, `front, ${gm} ${where(c)}`);
    near(r1, r0, TOL, `rear, ${gm} ${where(c)}`);
  });
});
t('a switch that already holds keeps the user\'s Hz mode (FLAT RIDE and MECH stay put)', () => {
  sweepSwitch('horizon', 'weight', c => {
    if (c.a.physics.rearHzClamped || !['flatRide', 'mech'].includes(c.mode)) return;
    if (c.fe2.rearHzMode !== c.mode) throw new Error(`Hz mode became ${c.fe2.rearHzMode}, ${where(c)}`);
  });
});
t('regression: FRONT 5.00 ×1.60 (rear clamped at 5.50) → REAR keeps the front at 5.00', () => {
  const ch = { ...M.DEF_CH };
  const fe = { ...M.DEF_FE, gameMode: 'horizon', arbBalMode: 'weight', rearHzMode: 'multiplier', rideRef: 'front',
    rideStiffness: 5.0, rearHzMult: 1.6 };
  const a = solve(ch, fe);
  if (!a.physics.rearHzClamped) throw new Error('fixture no longer clamps the rear');
  const fe2 = M.rideRefSwitch(ch, fe, fe, 'rear', a.physics, a.tune);
  const b = solve(ch, fe2);
  near(b.tune.fHz, 5.0, TOL, 'front Hz');
  near(b.tune.rHz, M.HZ_MAX, TOL, 'rear Hz');
  near(fe2.rearHzMult, M.HZ_MAX / 5.0, 1e-4, 'multiplier re-seeded to the ratio the car runs');
});
t('regression: FLAT RIDE with a clamped rear rehomes to MULTIPLIER instead of moving the front', () => {
  const ch = { ...M.DEF_CH };
  const fe = { ...M.DEF_FE, gameMode: 'horizon', arbBalMode: 'weight', rearHzMode: 'flatRide', rideRef: 'front',
    rideStiffness: 5.0, targetSpeed: 60 };
  const a = solve(ch, fe);
  if (!a.physics.rearHzClamped) throw new Error('fixture no longer clamps the rear');
  const fe2 = M.rideRefSwitch(ch, fe, fe, 'rear', a.physics, a.tune);
  if (fe2.rearHzMode !== 'multiplier') throw new Error(`expected MULTIPLIER, got ${fe2.rearHzMode}`);
  near(solve(ch, fe2).tune.fHz, 5.0, TOL, 'front Hz');
});
t('INDEPENDENT → SHARED holds the ratio on its 0.0001 grid, not 0.01', () => {
  const ch = { ...M.DEF_CH };
  const fe = { ...M.DEF_FE, gameMode: 'horizon', arbBalMode: 'weight', rearHzMode: 'independent', rideRef: 'front',
    rideStiffness: 4.8, rearHzMan: 3.0 };
  const a = solve(ch, fe);
  const fe2 = M.rideRefSwitch(ch, fe, fe, 'shared', a.physics, a.tune);
  const b = solve(ch, fe2);
  near(b.tune.fHz, 4.8, TOL, 'front Hz');
  near(b.tune.rHz, 3.0, TOL, 'rear Hz');
});
t('BeamNG: a REAR switch reads the pre-snap rear, so the snapped springs do not step', () => {
  const ch = { ...M.DEF_CH };
  const fe = { ...M.DEF_FE, gameMode: 'beamng', arbBalMode: 'weight', rearHzMode: 'flatRide', rideRef: 'rear',
    rideStiffness: 3.0, targetSpeed: 60 };
  const a = solve(ch, fe);
  const fe2 = M.rideRefSwitch(ch, fe, fe, 'front', a.physics, a.tune);
  const b = solve(ch, fe2);
  near(b.tune.fHz, a.tune.fHz, 1e-9, 'snapped front Hz');
  near(b.tune.rHz, a.tune.rHz, 1e-9, 'snapped rear Hz');
});
t('the RIDE REF. buttons go through rideRefSwitch', () => {
  const n = (src.match(/onClick=\{\(\)=>switchRef\('(front|shared|rear)'\)\}/g) || []).length;
  if (n !== 3) throw new Error(`expected 3 RIDE REF. buttons calling switchRef, found ${n}`);
  if (!/switchRef=to=>setFe\(p=>rideRefSwitch\(ch,feEffective,p,to,physics,tune\)\)/.test(src))
    throw new Error('switchRef no longer hands rideRefSwitch the solved physics and tune');
});

console.log('\n── BOTTOM G\'s: resolve, mirror, dormant ──');
const FRESH = { rh: null, rRef: null, dormant: false };
const base = { wantsG: true, live: true, rRef: 'front', rh_mm: 130, hzNow: 2.0, target: 3.0, rs: 2.0, restoring: false };
const gOf = (rh, hz) => rh * Math.pow(2 * Math.PI * hz, 2) / 9810;
t('live, on mount: resolves the stored target to Hz', () => {
  const r = M.bottomGStep(FRESH, base);
  const want = M.hzToRs(Math.sqrt(9810 * 3.0 / 130) / (2 * Math.PI));
  if (!r.patch || r.patch.rideBottomG !== undefined) throw new Error(`expected a rideStiffness patch, got ${JSON.stringify(r.patch)}`);
  near(r.patch.rideStiffness, want, 1e-9, 'resolved rideStiffness');
});
t('out of reach (BEG, or RIDE HEIGHT → CG off): writes nothing however far the Hz is from the target', () => {
  const r = M.bottomGStep(FRESH, { ...base, live: false, rs: 4.5 });
  if (r.patch) throw new Error(`dormant step wrote ${JSON.stringify(r.patch)}`);
  if (!r.prev.dormant) throw new Error('dormant state not remembered');
});
t('back in reach: mirrors the springs into the target instead of resolving the stale one', () => {
  const dormant = M.bottomGStep(FRESH, { ...base, live: false }).prev;
  const r = M.bottomGStep(dormant, { ...base, hzNow: 1.7, rs: 1.7 });
  if (!r.patch || r.patch.rideStiffness !== undefined) throw new Error(`expected a rideBottomG patch, got ${JSON.stringify(r.patch)}`);
  near(r.patch.rideBottomG, gOf(130, 1.7), 1e-12, 'mirrored g');
  const settle = M.bottomGStep(r.prev, { ...base, hzNow: 1.7, rs: 1.7, target: r.patch.rideBottomG });
  if (settle.patch) throw new Error(`the resolve after the mirror moved the springs: ${JSON.stringify(settle.patch)}`);
});
t('axle switch: mirrors unrounded, so the following resolve lands on the same stiffness', () => {
  const prev = M.bottomGStep(FRESH, { ...base, target: gOf(130, 2.0) }).prev;
  const hz = 2.137;
  const r = M.bottomGStep(prev, { ...base, rRef: 'rear', rh_mm: 120, hzNow: hz, rs: hz });
  near(r.patch.rideBottomG, gOf(120, hz), 1e-12, 'mirrored g');
  const settle = M.bottomGStep(r.prev, { ...base, rRef: 'rear', rh_mm: 120, hzNow: hz, rs: hz, target: r.patch.rideBottomG });
  if (settle.patch) throw new Error(`the resolve after the switch moved the springs: ${JSON.stringify(settle.patch)}`);
});
t('a restore writes nothing but still tracks the axle', () => {
  const prev = M.bottomGStep(FRESH, base).prev;
  const r = M.bottomGStep(prev, { ...base, rRef: 'shared', restoring: true });
  if (r.patch) throw new Error(`restore wrote ${JSON.stringify(r.patch)}`);
  if (r.prev.rRef !== 'shared') throw new Error('restore did not record the new axle');
});
t('HZ stiffness mode: writes nothing and forgets the axle', () => {
  const r = M.bottomGStep({ rh: 130, rRef: 'rear', dormant: false }, { ...base, wantsG: false });
  if (r.patch || r.prev.rRef !== null || r.prev.dormant) throw new Error(JSON.stringify(r));
});
t('App gates the effect on what the slider can reach', () => {
  if (!/live:!!ch\.useRideHeightCG&&uiMode!=='beginner'/.test(src))
    throw new Error('the BOTTOM G\'s effect no longer passes RIDE HEIGHT → CG and the tier as `live`');
});

console.log('\n── stiffness sliders: bound to the stored setting, every wheel notch moves ──');
// A light car in BeamNG at the soft end is where a 500 N/m spring step is widest in Hz — more
// than a whole 0.01 slider step — which is what stalled the wheel when the slider read tune.fHz.
const wheelRun = (bindTo, dir) => {
  const ch = { ...M.DEF_CH, weight: 2200, frontBias: 50 };
  let fe = { ...M.DEF_FE, gameMode: 'beamng', arbBalMode: 'weight', rideRef: 'front',
    rideStiffness: dir > 0 ? M.HZ_MIN : M.HZ_MAX };
  const dead = [];
  for (let i = 0; i < 480; i++) {
    const { tune } = solve(ch, fe);
    const shown = bindTo === 'stored' ? M.rsToHz(fe.rideStiffness) : tune.fHz;
    // FeelSlider's wheel, then the Ride Stiffness slider's onChange: pFe('rideStiffness')(hzToRs(v))
    const next = M.hzToRs(M.wheelStepOf(shown, dir, 0.01, M.HZ_MIN, M.HZ_MAX));
    if (next === fe.rideStiffness) {
      if (fe.rideStiffness > M.HZ_MIN && fe.rideStiffness < M.HZ_MAX) dead.push(fe.rideStiffness);
      else break;
    }
    fe = { ...fe, rideStiffness: next };
  }
  return { dead, end: fe.rideStiffness };
};
t('fixture: bound to the snapped Hz, the wheel stalls (the bug this section guards)', () => {
  if (!wheelRun('snapped', 1).dead.length) throw new Error('the fixture no longer stalls the old binding — pick a softer or lighter car');
});
t('bound to the stored setting, every notch up moves, all the way to HZ_MAX', () => {
  const r = wheelRun('stored', 1);
  if (r.dead.length) throw new Error(`dead notches at ${r.dead.slice(0, 5).join(', ')} Hz`);
  near(r.end, M.HZ_MAX, 1e-9, 'end of the run');
});
t('bound to the stored setting, every notch down moves, all the way to HZ_MIN', () => {
  const r = wheelRun('stored', -1);
  if (r.dead.length) throw new Error(`dead notches at ${r.dead.slice(0, 5).join(', ')} Hz`);
  near(r.end, M.HZ_MIN, 1e-9, 'end of the run');
});
const STORED = 'rsToHz(fe.rideStiffness??DEF_FE.rideStiffness)';
t('the INT/PRO and BEG Ride Stiffness sliders read the stored setting', () => {
  if (!src.includes(`const primaryHz=${STORED};`)) throw new Error('the INT/PRO slider (primaryHz) is no longer the stored setting');
  if (!src.includes(`const ridePrimaryHz=${STORED};`)) throw new Error('the BEG slider (ridePrimaryHz) is no longer the stored setting');
});
t('Bottom-Out reads its stored target, and its box prints it to 0.001', () => {
  if (!src.includes('value={shownBottomG}')) throw new Error('Bottom-Out is no longer bound to shownBottomG');
  if (!/const shownBottomG=[^;]*fe\.rideBottomG/.test(src)) throw new Error('shownBottomG no longer reads fe.rideBottomG');
  if (!src.includes("box={{unit:'g',value:Math.round(shownBottomG*1000)/1000}}"))
    throw new Error('the Bottom-Out box no longer rounds its display to 0.001');
});
t('FeelSlider steps through wheelStepOf, and the BOTTOM G\'s mirror reads the stored setting', () => {
  if (!src.includes('onChangeRef.current(wheelStepOf(valRef.current,')) throw new Error('FeelSlider no longer uses wheelStepOf');
  if (!src.includes(`hzNow:${STORED},`)) throw new Error('the BOTTOM G\'s effect no longer mirrors from the stored setting');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
