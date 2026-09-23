// SUSP.OS — Vehicle DNA core tests
// Run with: node tests-dna.js
// No dependencies required.
//
// LIKE tests-beamng.js, THIS FILE READS index.html. The DNA core is a compiler that drives the
// real solver, so a mirror of either half would prove nothing: the property worth testing is that
// compileDNA, measureDNA and the resolver agree with the feelToPhysics/computeTune that ships.
//
// What it guards:
//   1. resolveFeEffective is the one TARGET/GRIP funnel, and App routes through it.
//   2. The axis table matches DEF_FE and sanitizeTune: a compiled patch is a sanitizeTune fixed
//      point, so nothing downstream can silently rewrite a DNA-produced tune.
//   3. Sign conventions: dampBias, diffExit and diffEntry read as their sliders on every layout.
//   4. Miss detection agrees with the app's OWN flags (shareClamped, mechBalClamped,
//      dampingClamped) — an independent oracle, not DNA checking itself.
//   5. Portability: a protected balanceOffset lands on every synthetic chassis when bars aren't
//      ceiling-limited, including the balanced and rear-biased chassis that broke the rejected
//      gap-fraction axis (docs/DNA.md, "Why not a gap fraction").
//   6. The resolver honours `keep`: it never moves an axis to save a less-protected one, never
//      breaks an axis ranked above the one it moves, and reports every compromise.
//
// Chassis fixtures are synthetic by design: portability is a property of the math. Whether an
// archetype FEELS right is an in-game question this suite does not attempt.
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the markers
// rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

// Order matters: the DEF_* literals execute at eval time and the enum block reads them.
const M = new Function(
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbCtx=') + '\n' +
  slice('const DNA_ARCHETYPES=', 'const Hint=') + '\n' +
  slice('const sanitizeTune=', '\nconst useTwoTap') +
  '\nreturn{DEF_CH,DEF_FE,DEF_DR,HZ_MIN,HZ_MAX,DNA_AXES,DNA_YIELDABLE,DNA_MAX_MOVES,DNA_ARCHETYPES,' +
  'sanitizeDNA,compileDNA,measureDNA,dnaReadBack,dnaTolerances,dnaEvaluate,applyDNA,resolveFeEffective,' +
  'resolveArbBalTarget,gripNeutralOf,naturalMechBalanceOf,balanceFromRsBal,sanitizeTune,' +
  'computeTune,feelToPhysics,PHYS_SNAP,DAMP_BAL_MODE_ENC,DAMP_BAL_MODE_DEC};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const section = s => console.log(`\n── ${s} ──`);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const near = (got, want, tol, what) => assert(Math.abs(got - want) <= tol, `${what}: got ${got}, expected ${want} ±${tol}`);

const MODES = ['horizon', 'motorsport', 'beamng'];
const LAYOUTS = ['FWD', 'RWD', 'AWD'];
// docs/DNA.md "Synthetic chassis set". Gaps quoted there are measured on DEF_CH with only the
// named field changed.
const FIXTURES = {
  Default:    {},
  Balanced:   { frontBias: 50 },
  RearBiased: { frontBias: 45 },
  FrontHeavy: { frontBias: 60 },
  WideRear:   { tyreF: '225/40R18', tyreR: '325/30R20' },
  WideFront:  { tyreF: '325/30R20', tyreR: '225/40R18' },
};
// Damper-limit fixtures. The weights were found by search when this suite was written; the guard
// tests below fail if a calibration change stops them exercising the limit they exist for.
const HEAVY = { weight: 12000 };
const LIGHT = { weight: 500 };

const chOf = over => ({ ...M.DEF_CH, ...over });
const feOf = (mode, over = {}) => ({ ...M.DEF_FE, gameMode: mode, ...over });
const drOf = (over = {}) => ({ ...M.DEF_DR, ...over });
const OUTCOME = ['platformHz', 'pitchRatio', 'arbShare', 'balanceOffset', 'reboundZeta', 'bumpRatio'];
const SETTING = ['dampBias', 'diffExit', 'diffEntry'];
const rankIn = (dna, k) => dna.keep.indexOf(k === 'bumpRatio' ? 'reboundZeta' : k);

// Deterministic PRNG so the fuzz section is reproducible.
let seed = 0x5eed;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rndIn = (lo, hi) => lo + (hi - lo) * rnd();
const shuffled = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const randomDNA = () => ({
  name: 'fuzz',
  axes: Object.fromEntries(Object.entries(M.DNA_AXES).map(([k, { min, max }]) => [k, rndIn(min, max)])),
  keep: shuffled(M.DNA_YIELDABLE),
});

// ─────────────────────────────────────────────────────────────────────────────
section('resolveFeEffective — the single TARGET/GRIP funnel');

t('TARGET mode resolves through resolveArbBalTarget', () => {
  for (const over of Object.values(FIXTURES)) {
    const ch = chOf(over);
    for (const arbBalTarget of [null, -0.1, 0, 0.08, 0.9]) {
      const fe = feOf('horizon', { arbBalTargetMode: 'manual', arbBalTarget });
      assert(M.resolveFeEffective(ch, fe).arbBalTarget === M.resolveArbBalTarget(ch, fe),
        `arbBalTarget ${arbBalTarget}`);
    }
  }
});

t('GRIP mode resolves to grip-neutral + Balance Offset, clamped 0.20..0.90', () => {
  for (const over of Object.values(FIXTURES)) {
    const ch = chOf(over);
    for (const arbBalDelta of [-0.2, -0.05, 0, 0.07, 0.2]) {
      const got = M.resolveFeEffective(ch, feOf('horizon', { arbBalTargetMode: 'grip', arbBalDelta })).arbBalTarget;
      const want = Math.max(0.20, Math.min(0.90, 1 - M.balanceFromRsBal(ch, M.naturalMechBalanceOf(ch)) + arbBalDelta));
      assert(got === want, `delta ${arbBalDelta}: got ${got}, want ${want}`);
    }
  }
});

t('gripNeutralOf is 1 − balanceFromRsBal at the natural mech balance', () => {
  const ch = chOf({ frontBias: 57 });
  assert(M.gripNeutralOf(ch) === 1 - M.balanceFromRsBal(ch, M.naturalMechBalanceOf(ch)), 'mismatch');
});

t('App routes feEffective through resolveFeEffective (no second inline copy)', () => {
  assert(src.includes('const feEffective=resolveFeEffective(ch,fe);'), 'App no longer calls resolveFeEffective');
  assert(!/arbBalTarget:gripBalTarget/.test(src), 'an inline GRIP resolution has reappeared');
});

// ─────────────────────────────────────────────────────────────────────────────
section('axis table vs DEF_FE and sanitizeTune');

t('axis defaults match DEF_FE / DEF_DR', () => {
  const A = M.DNA_AXES, F = M.DEF_FE, D = M.DEF_DR;
  const pairs = [['platformHz', F.rideStiffness], ['pitchRatio', F.rearHzMult], ['arbShare', F.arbShareMan],
    ['balanceOffset', F.arbBalDelta], ['reboundZeta', F.reboundZeta], ['bumpRatio', F.bumpRatio],
    ['dampBias', F.dampingBias], ['diffExit', D.diffBiasExit], ['diffEntry', D.diffBiasEntry]];
  for (const [k, want] of pairs) assert(A[k].def === want, `${k}.def ${A[k].def} vs ${want}`);
});

t('DNA_YIELDABLE is five distinct outcome axes', () => {
  assert(M.DNA_YIELDABLE.length === 5 && new Set(M.DNA_YIELDABLE).size === 5, 'not five distinct');
  for (const k of M.DNA_YIELDABLE) assert(OUTCOME.includes(k), `${k} is not an outcome axis`);
});

t('every axis range survives sanitizeTune at both ends (ranges = clamps)', () => {
  const def = M.sanitizeDNA({}).axes;
  const field = { platformHz: ['fe', 'rideStiffness'], pitchRatio: ['fe', 'rearHzMult'], arbShare: ['fe', 'arbShareMan'],
    balanceOffset: ['fe', 'arbBalDelta'], reboundZeta: ['fe', 'reboundZeta'], bumpRatio: ['fe', 'bumpRatio'],
    dampBias: ['fe', 'dampingBias'], diffExit: ['dr', 'diffBiasExit'], diffEntry: ['dr', 'diffBiasEntry'] };
  for (const [k, { min, max }] of Object.entries(M.DNA_AXES)) {
    for (const v of [min, max]) {
      const c = M.compileDNA(M.DEF_CH, M.DEF_FE, M.DEF_DR, { ...def, [k]: v });
      const s = M.sanitizeTune({ ch: M.DEF_CH, fe: c.fe, dr: c.dr });
      const [g, f] = field[k];
      assert(Object.is(s[g][f], c[g][f]), `${k}=${v}: sanitizeTune rewrote ${g}.${f} ${c[g][f]} → ${s[g][f]}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
section('sanitizeDNA — the single choke point');

t('garbage in → a complete default DNA', () => {
  for (const raw of [null, undefined, {}, 'dna', 42, { axes: 'x', keep: 'y' }]) {
    const d = M.sanitizeDNA(raw);
    assert(d.v === 2 && d.name === 'Untitled', `header for ${JSON.stringify(raw)}`);
    for (const [k, { def }] of Object.entries(M.DNA_AXES)) assert(d.axes[k] === def, `${k} default`);
    assert(JSON.stringify(d.keep) === JSON.stringify(M.DNA_YIELDABLE), 'keep default');
  }
});

t('out-of-range axes clamp; non-finite and non-numeric fall back to default', () => {
  const d = M.sanitizeDNA({ axes: { platformHz: 99, pitchRatio: -3, arbShare: NaN, reboundZeta: Infinity, bumpRatio: '60' } });
  assert(d.axes.platformHz === M.HZ_MAX, 'platform high clamp');
  assert(d.axes.pitchRatio === 0.5, 'pitch low clamp');
  assert(d.axes.arbShare === M.DNA_AXES.arbShare.def, 'NaN → default');
  assert(d.axes.reboundZeta === M.DNA_AXES.reboundZeta.def, 'Infinity → default');
  assert(d.axes.bumpRatio === M.DNA_AXES.bumpRatio.def, 'string → default');
});

t('keep is repaired into a permutation of DNA_YIELDABLE', () => {
  const d = M.sanitizeDNA({ keep: ['arbShare', 'bogus', 'arbShare', 'dampBias', 'reboundZeta'] });
  const want = ['arbShare', 'reboundZeta', ...M.DNA_YIELDABLE.filter(k => k !== 'arbShare' && k !== 'reboundZeta')];
  assert(JSON.stringify(d.keep) === JSON.stringify(want), `got ${d.keep}`);
});

t('a v1 DNA migrates: roll is dropped for the share default, its keep rank carries over', () => {
  const d = M.sanitizeDNA({ v: 1, axes: { platformHz: 2.5, rollDegPerG: 0.9 }, keep: ['rollDegPerG', 'platformHz'] });
  assert(d.v === 2 && !('rollDegPerG' in d.axes), 'roll axis survived');
  assert(d.axes.arbShare === M.DNA_AXES.arbShare.def, 'arbShare not defaulted');
  assert(d.axes.platformHz === 2.5, 'other axes lost');
  assert(d.keep[0] === 'arbShare' && d.keep[1] === 'platformHz', `keep not carried: ${d.keep}`);
});

t('factory archetypes are already clean (sanitizeDNA is a no-op on them)', () => {
  for (const a of M.DNA_ARCHETYPES) {
    assert(JSON.stringify(M.sanitizeDNA(a)) === JSON.stringify(a), `${a.name} changed under sanitizeDNA`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
section('compileDNA — a patch in PRO target modes');

t('sets exactly the documented modes', () => {
  const { fe, dr } = M.compileDNA(chOf({}), M.DEF_FE, M.DEF_DR, M.sanitizeDNA({}).axes);
  const want = { rideRef: 'front', rideStiffMode: 'hz', rearHzMode: 'multiplier', arbMode: 'share', arbBalMode: 'mech',
    arbBalTargetMode: 'grip', dampCharMode: 'zeta', dampingMode: 'ratio', dampBalMode: 'sync' };
  for (const [k, v] of Object.entries(want)) assert(fe[k] === v, `fe.${k} = ${fe[k]}`);
  assert(dr.diffManual === false, 'dr.diffManual');
});

t('is a patch: introduces no unknown keys and leaves untouched fields alone', () => {
  const fe0 = feOf('beamng', { targetSpeed: 123, arbManF: 33, springShare: 71 });
  const dr0 = drOf({ buildType: 'rally', diffType: 'rally', diffAccel: 44, diffCenter: 30 });
  const ch = chOf({ layout: 'AWD' });
  const { fe, dr } = M.compileDNA(ch, fe0, dr0, M.DNA_ARCHETYPES[1].axes);
  for (const k of Object.keys(fe)) assert(k in M.DEF_FE, `unknown fe key ${k}`);
  for (const k of Object.keys(dr)) assert(k in M.DEF_DR, `unknown dr key ${k}`);
  for (const [k, v] of Object.entries({ gameMode: 'beamng', targetSpeed: 123, arbManF: 33, springShare: 71 }))
    assert(fe[k] === v, `fe.${k} was changed`);
  for (const [k, v] of Object.entries({ buildType: 'rally', diffType: 'rally', diffAccel: 44, diffCenter: 30 }))
    assert(dr[k] === v, `dr.${k} was changed`);
});

t('compiled tunes are sanitizeTune fixed points (archetypes × layouts × game modes)', () => {
  for (const a of M.DNA_ARCHETYPES) for (const layout of LAYOUTS) for (const mode of MODES) {
    const ch = chOf({ layout });
    const c = M.compileDNA(ch, feOf(mode), M.DEF_DR, a.axes);
    const s = M.sanitizeTune({ ch, fe: c.fe, dr: c.dr });
    for (const g of ['fe', 'dr']) for (const [k, v] of Object.entries(s[g]))
      assert(Object.is(v, c[g][k]), `${a.name}/${layout}/${mode}: sanitizeTune rewrote ${g}.${k} ${c[g][k]} → ${v}`);
  }
});

t("platformHz is rounded to compileDNA's own 0.01 Hz step at compile time", () => {
  const { fe } = M.compileDNA(chOf({}), M.DEF_FE, M.DEF_DR, { ...M.sanitizeDNA({}).axes, platformHz: 2.3456 });
  assert(fe.rideStiffness === 2.35, `got ${fe.rideStiffness}`);
});

// ─────────────────────────────────────────────────────────────────────────────
section('sign conventions — setting axes read as their sliders');

t('stored fields carry the documented negations on every layout, and measure back', () => {
  for (const layout of LAYOUTS) {
    const ch = chOf({ layout });
    const axes = { ...M.sanitizeDNA({}).axes, dampBias: 20, diffExit: 30, diffEntry: -25 };
    // A Race diff: DEF_DR's Sport has no decel lock, so ENTRY would rightly read as inexpressible.
    const { fe, dr } = M.compileDNA(ch, feOf('horizon'), drOf({ diffType: 'race' }), axes);
    assert(fe.dampingBias === -20, `${layout}: dampingBias ${fe.dampingBias}`);
    assert(dr.diffBiasExit === (layout === 'FWD' ? -30 : 30), `${layout}: diffBiasExit ${dr.diffBiasExit}`);
    assert(dr.diffBiasEntry === 25, `${layout}: diffBiasEntry ${dr.diffBiasEntry}`);
    const tune = M.computeTune(ch, M.feelToPhysics(ch, M.resolveFeEffective(ch, fe)), 'horizon');
    const m = M.measureDNA(ch, tune, fe, dr);
    assert(m.dampBias === 20 && m.diffExit === 30 && m.diffEntry === -25, `${layout}: measured ${m.dampBias}/${m.diffExit}/${m.diffEntry}`);
  }
});

t('the sliders agree: their displayed value equals the axis', () => {
  // The sliders render value={-(fe.dampingBias??0)}, value={ch.layout==='FWD'?-(exit):(exit)} and
  // value={-(dr.diffBiasEntry??0)}. Pin those expressions so a UI change cannot desync the axes.
  assert(src.includes('value={-(fe.dampingBias??0)}'), 'Damping Bias slider expression changed');
  assert(src.includes("value={ch.layout==='FWD'?-(dr.diffBiasExit??0):(dr.diffBiasExit??0)}"), 'EXIT slider expression changed');
  assert(src.includes('value={-(dr.diffBiasEntry??0)}'), 'ENTRY slider expression changed');
});

t('zero never compiles to -0', () => {
  for (const layout of LAYOUTS) {
    const { fe, dr } = M.compileDNA(chOf({ layout }), M.DEF_FE, M.DEF_DR, M.sanitizeDNA({}).axes);
    assert(!Object.is(fe.dampingBias, -0) && !Object.is(dr.diffBiasExit, -0) && !Object.is(dr.diffBiasEntry, -0), `${layout}: -0 stored`);
  }
});

t('setting axes read null outside the compiled modes ("mode differs" / inexpressible)', () => {
  const ch = chOf({});
  const tune = M.computeTune(ch, M.feelToPhysics(ch, M.resolveFeEffective(ch, M.DEF_FE)), 'horizon');
  const std = M.measureDNA(ch, tune, feOf('horizon', { dampBalMode: 'standard' }), drOf({ diffManual: true }));
  assert(std.dampBias === null && std.diffExit === null && std.diffEntry === null, 'expected nulls');
  const sport = M.measureDNA(ch, tune, feOf('horizon', { dampBalMode: 'sync' }), drOf({ diffManual: false, diffType: 'sport' }));
  assert(sport.diffEntry === null && sport.diffExit !== null && sport.dampBias !== null, 'sport: only ENTRY is inexpressible');
  for (const k of OUTCOME) assert(typeof std[k] === 'number' && isFinite(std[k]), `outcome ${k} must read on any tune`);
});

t('a Sport diff reports diffEntry as inexpressible, not as a miss', () => {
  const res = M.applyDNA(chOf({}), feOf('horizon'), drOf({ diffType: 'sport' }), M.DNA_ARCHETYPES[0]);
  assert(res.inexpressible.includes('diffEntry'), 'diffEntry not listed as inexpressible');
  assert(!res.misses.some(m => m.axis === 'diffEntry'), 'diffEntry reported as a miss');
});

// ─────────────────────────────────────────────────────────────────────────────
section('measureDNA — agrees with the app\'s own flags');

t('Forza: platform and pitch read back exactly (no spring grid)', () => {
  for (const mode of ['horizon', 'motorsport']) for (const over of Object.values(FIXTURES)) for (const a of M.DNA_ARCHETYPES) {
    const ch = chOf(over);
    const e = M.dnaEvaluate(ch, feOf(mode), M.DEF_DR, a.axes);
    near(e.measured.platformHz, Math.round(a.axes.platformHz * 100) / 100, 1e-12, `${a.name} platform`);
    near(e.measured.pitchRatio, a.axes.pitchRatio, 1e-12, `${a.name} pitch`);
  }
});

t('BeamNG: platform and pitch sit inside the spring-grid tolerance', () => {
  for (const over of Object.values(FIXTURES)) for (const a of M.DNA_ARCHETYPES) {
    const e = M.dnaEvaluate(chOf(over), feOf('beamng'), M.DEF_DR, a.axes);
    near(e.measured.platformHz, a.axes.platformHz, e.tol.platformHz, `${a.name} platform`);
    near(e.measured.pitchRatio, a.axes.pitchRatio, e.tol.pitchRatio, `${a.name} pitch`);
  }
});

t('share hit ⇔ !shareClamped, balance hit ⇔ !mechBalClamped, !dampingClamped ⇒ damping hit', () => {
  let n = 0;
  for (const mode of MODES) for (const over of Object.values(FIXTURES)) for (const a of M.DNA_ARCHETYPES)
  for (const share of [3, 8, 15, 30]) for (const off of [-0.1, -0.02, 0, 0.04, 0.15]) {
    const ch = chOf(over), axes = { ...a.axes, arbShare: share, balanceOffset: off };
    const e = M.dnaEvaluate(ch, feOf(mode), M.DEF_DR, axes);
    const shareHit = Math.abs(e.measured.arbShare - share) <= e.tol.arbShare;
    assert(shareHit === !e.tune.shareClamped, `${mode}/${a.name} share ${share}: DNA hit=${shareHit}, shareClamped=${e.tune.shareClamped}`);
    const tgt = M.gripNeutralOf(ch) + off;
    if (tgt >= 0.20 && tgt <= 0.90 && e.tune.rsAbF + e.tune.rsAbR > 0) {
      const balHit = Math.abs(e.measured.balanceOffset - off) <= e.tol.balanceOffset;
      // mechBalClamped compares against the clamped target with a strict > 0.01; allow the exact
      // boundary to fall either way rather than asserting floating-point equality at 0.01.
      const err = Math.abs(e.measured.balanceOffset - off);
      if (Math.abs(err - 0.01) > 1e-9)
        assert(balHit === !e.tune.mechBalClamped, `${mode}/${a.name} off ${off}: DNA hit=${balHit}, mechBalClamped=${e.tune.mechBalClamped}`);
    }
    if (!e.tune.dampingClamped) {
      near(e.measured.reboundZeta, axes.reboundZeta, e.tol.reboundZeta, `${mode}/${a.name} reboundZeta`);
      near(e.measured.bumpRatio, axes.bumpRatio, e.tol.bumpRatio, `${mode}/${a.name} bumpRatio`);
    }
    n++;
  }
  assert(n > 1000, `only ${n} cases ran`);
});

// ─────────────────────────────────────────────────────────────────────────────
section('dnaReadBack — a tune turned back into a DNA');

t('a compiled tune reads back as the DNA that produced it', () => {
  let n = 0;
  for (const mode of MODES) for (const over of Object.values(FIXTURES)) for (const layout of LAYOUTS)
  for (const a of M.DNA_ARCHETYPES) {
    // A race diff, so both diff axes are expressible — the sport-diff case is its own test below.
    const ch = chOf({ ...over, layout }), dr = drOf({ diffType: 'race' });
    const e = M.dnaEvaluate(ch, feOf(mode), dr, a.axes);
    const back = M.dnaReadBack(ch, e.fe, e.dr, e.tune, null);
    // The outcome axes may legitimately miss on a limited chassis — what must hold is that the
    // read-back is measureDNA's reading clamped into the axis range, which the section above
    // already ties to the app's own flags. (A tune can sit outside a range no target can name:
    // a chassis whose grip-neutral is far off can read a balanceOffset past ±0.20.)
    for (const k of OUTCOME) {
      const { min, max } = M.DNA_AXES[k];
      near(back[k], Math.max(min, Math.min(max, e.measured[k])), 1e-9, `${mode}/${layout}/${a.name} ${k}`);
    }
    // The diff axes come straight off dr and must be exact.
    for (const k of ['diffExit', 'diffEntry']) near(back[k], a.axes[k], 1e-12, `${mode}/${layout}/${a.name} ${k}`);
    // dampBias is the one that has to survive a trip out through the zetas and back. It reads ζ
    // off the ROUNDED damper values, so it carries the game's damper quantisation: the same half
    // step dnaTolerances allows reboundZeta, propagated through 50·log2(rateR·rHz / rateF·fHz).
    const dHalf = mode === 'beamng' ? M.PHYS_SNAP.damp / 2 : 0.05;
    const tolBias = 50 / Math.LN2 * (dHalf / e.tune.rebF + dHalf / e.tune.rebR) + 1e-6;
    near(back.dampBias, a.axes.dampBias, tolBias, `${mode}/${layout}/${a.name} dampBias`);
    n++;
  }
  assert(n > 200, `only ${n} cases ran`);
});

t('dampBias inverts the ζ split whatever damper-balance mode set it', () => {
  // STANDARD holds the same front ζ as SYNC under a FRONT reference but swings the rear its own
  // way, so the read-back has to derive the bias from the zetas, not copy the stored field.
  for (const mode of MODES) for (const bias of [-40, -15, 0, 15, 40]) {
    const ch = chOf({}), dr = drOf();
    const fe = feOf(mode, { rideRef: 'front', rideStiffMode: 'hz', rideStiffness: 2.2,
      rearHzMode: 'multiplier', rearHzMult: 1.1, dampCharMode: 'zeta', reboundZeta: 70,
      dampingMode: 'ratio', bumpRatio: 56, dampBalMode: 'standard', dampingBias: bias });
    const tune = M.computeTune(ch, M.feelToPhysics(ch, M.resolveFeEffective(ch, fe)), mode);
    assert(M.measureDNA(ch, tune, fe, dr).dampBias === null, 'STANDARD should read null');
    const back = M.dnaReadBack(ch, fe, dr, tune, null);
    // Re-compile the read-back: under SYNC it must reproduce this tune's own front/rear ζ split.
    const e = M.dnaEvaluate(ch, fe, dr, back);
    near(e.tune.zetaR / e.tune.zetaF, tune.zetaR / tune.zetaF, 0.01, `${mode} bias ${bias} split`);
  }
});

// The one that actually bit: dnaReadBack behaved correctly, and IMPORT AS DNA handed it the
// wrong drivetrain. A share code patches fe only, so the live dr describes the car on screen,
// not the tune being imported — and because those are real numbers, the from-fallback below
// never fired. Pinned in the source, since the call site is in App. See docs/HISTORY.md.
t('IMPORT AS DNA reads back with the diff marked inexpressible', () => {
  assert(src.includes('axes:dnaReadBack(ch,nfe,{...dr,diffManual:true},t,dnaDraft.axes)'),
    "dnaFromDecoded no longer blinds the diff axes — it would import the live car’s diff");
});

t('an axis the tune cannot express keeps the value it was given', () => {
  const ch = chOf({}), fe = feOf('horizon');
  // diffManual makes both diff axes inexpressible; sport makes ENTRY alone inexpressible.
  for (const [dr, blind] of [[drOf({ diffManual: true }), ['diffExit', 'diffEntry']],
                             [drOf({ diffType: 'sport' }), ['diffEntry']]]) {
    const tune = M.computeTune(ch, M.feelToPhysics(ch, M.resolveFeEffective(ch, fe)), 'horizon');
    const from = { ...M.DNA_ARCHETYPES[3].axes, diffExit: 33, diffEntry: -21 };
    const back = M.dnaReadBack(ch, fe, dr, tune, from);
    for (const k of blind) assert(back[k] === from[k], `${k} should have kept ${from[k]}, got ${back[k]}`);
    for (const k of ['diffExit', 'diffEntry'].filter(x => !blind.includes(x)))
      assert(back[k] === M.measureDNA(ch, tune, fe, dr)[k], `${k} should have been read, not carried`);
    // dampBias is never carried: it is derived from the zetas, so it has a value even here,
    // where measureDNA reads null because this tune is not in SYNC.
    assert(M.measureDNA(ch, tune, fe, dr).dampBias === null && back.dampBias !== from.dampBias,
      `dampBias should have been derived, got ${back.dampBias}`);
  }
});

t('the result is always a sanitizeDNA fixed point', () => {
  for (const mode of MODES) for (const over of Object.values(FIXTURES)) {
    const ch = chOf(over), dr = drOf();
    const e = M.dnaEvaluate(ch, feOf(mode), dr, randomDNA().axes);
    const back = M.dnaReadBack(ch, e.fe, e.dr, e.tune, null);
    const s = M.sanitizeDNA({ v: 2, name: 'x', axes: back, keep: M.DNA_YIELDABLE }).axes;
    for (const k of Object.keys(M.DNA_AXES)) assert(s[k] === back[k], `${mode} ${k}: ${back[k]} → ${s[k]}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
section('portability — the same DNA on every chassis');

t('fixture gaps still cover both signs and the near-zero case', () => {
  const gap = over => { const ch = chOf(over); return M.gripNeutralOf(ch) - M.naturalMechBalanceOf(ch); };
  assert(gap(FIXTURES.RearBiased) < -0.05, 'RearBiased no longer has a clearly negative gap');
  assert(Math.abs(gap(FIXTURES.Balanced)) < 0.03, 'Balanced no longer sits near zero gap');
  assert(gap(FIXTURES.FrontHeavy) > 0.15, 'FrontHeavy no longer has a large positive gap');
  assert(gap(FIXTURES.WideFront) < 0 && gap(FIXTURES.WideRear) > 0, 'tyre-stagger fixtures lost their signs');
});

t('BeamNG: an archetype that protects balance lands it on every fixture', () => {
  // No bar ceiling in a physical mode, so a miss here would be the model's fault, not the game's.
  for (const a of M.DNA_ARCHETYPES.filter(x => x.keep.indexOf('balanceOffset') <= 1))
    for (const [fn, over] of Object.entries(FIXTURES)) {
      const res = M.applyDNA(chOf(over), feOf('beamng'), M.DEF_DR, a);
      assert(!res.misses.some(m => m.axis === 'balanceOffset'), `${a.name} on ${fn}: balance missed`);
      near(res.measured.balanceOffset, a.axes.balanceOffset, 0.01, `${a.name} on ${fn} balanceOffset`);
    }
});

t('the same offset means the same distance from grip-neutral on balanced and rear-biased cars', () => {
  // The rejected gap fraction gave these two chassis near-zero authority (docs/DNA.md).
  for (const fn of ['Balanced', 'RearBiased']) for (const off of [-0.06, 0.06]) {
    const dna = { axes: { ...M.DNA_ARCHETYPES[2].axes, balanceOffset: off }, keep: ['balanceOffset', 'arbShare', 'pitchRatio', 'platformHz', 'reboundZeta'] };
    const res = M.applyDNA(chOf(FIXTURES[fn]), feOf('beamng'), M.DEF_DR, dna);
    near(res.measured.balanceOffset, off, 0.01, `${fn} offset ${off}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
section('resolver — conflicts give way in `keep` order');

const moved = (res, axis) => res.moves.some(m => m.axis === axis);
const missed = (res, axis) => res.misses.find(m => m.axis === axis);

t('damper-limit fixtures still reach their limits', () => {
  const base = M.sanitizeDNA({}).axes;
  assert(M.dnaEvaluate(chOf(HEAVY), feOf('horizon'), M.DEF_DR, { ...base, reboundZeta: 90 }).tune.dampingClamped, 'HEAVY no longer hits the damper ceiling');
  assert(M.dnaEvaluate(chOf(LIGHT), feOf('horizon'), M.DEF_DR, base).tune.dampingClamped, 'LIGHT no longer hits the 1-click floor');
});

t('pitch band: platform gives way when pitch is protected, and not otherwise', () => {
  const axes = { ...M.sanitizeDNA({}).axes, platformHz: 4.0, pitchRatio: 2.0 };
  const keepPitch = M.applyDNA(chOf({}), feOf('horizon'), M.DEF_DR, { axes, keep: ['pitchRatio', 'platformHz'] });
  assert(moved(keepPitch, 'platformHz') && !missed(keepPitch, 'pitchRatio'), 'platform should move and pitch land');
  assert(keepPitch.work.platformHz * 2.0 <= M.HZ_MAX + 0.02, `rear still out of band at ${keepPitch.work.platformHz}`);
  const keepPlat = M.applyDNA(chOf({}), feOf('horizon'), M.DEF_DR, { axes, keep: ['platformHz', 'pitchRatio'] });
  assert(!moved(keepPlat, 'platformHz'), 'platform moved although it is more protected');
  assert(missed(keepPlat, 'pitchRatio')?.cause === 'rear axle outside the Hz band', 'pitch miss or its cause missing');
});

t('share: bars at their ceiling — platform drops only if share outranks it', () => {
  // Bars add a fixed stiffness per click; stiff springs leave them a small fraction of the total.
  const axes = { ...M.sanitizeDNA({}).axes, platformHz: 3.5, arbShare: 30 };
  const keepShare = M.applyDNA(chOf({}), feOf('horizon'), M.DEF_DR, { axes, keep: ['arbShare', 'platformHz'] });
  assert(moved(keepShare, 'platformHz') && !missed(keepShare, 'arbShare'), 'platform should drop and share land');
  assert(keepShare.work.platformHz < 3.5, 'platform did not drop');
  const keepPlat = M.applyDNA(chOf({}), feOf('horizon'), M.DEF_DR, { axes, keep: ['platformHz', 'arbShare'] });
  assert(!moved(keepPlat, 'platformHz'), 'platform moved although it is more protected');
  assert(missed(keepPlat, 'arbShare')?.cause === 'anti-roll bars at their limit', 'share miss or its cause missing');
});

t('damping ceiling (HEAVY): platform drops only if ζ outranks it', () => {
  const axes = { ...M.sanitizeDNA({}).axes, reboundZeta: 90 };
  const keepZ = M.applyDNA(chOf(HEAVY), feOf('horizon'), M.DEF_DR, { axes, keep: ['reboundZeta', 'platformHz'] });
  assert(moved(keepZ, 'platformHz') && keepZ.work.platformHz < axes.platformHz, 'platform should drop');
  assert(!missed(keepZ, 'reboundZeta'), 'rebound ζ should land');
  const keepPlat = M.applyDNA(chOf(HEAVY), feOf('horizon'), M.DEF_DR, { axes, keep: ['platformHz', 'reboundZeta'] });
  assert(!moved(keepPlat, 'platformHz'), 'platform moved although it is more protected');
  assert(missed(keepPlat, 'reboundZeta')?.cause === 'damper click range', 'ζ miss or its cause missing');
});

t('damping floor (LIGHT): platform rises only if ζ outranks it', () => {
  const axes = M.sanitizeDNA({}).axes;
  const keepZ = M.applyDNA(chOf(LIGHT), feOf('horizon'), M.DEF_DR, { axes, keep: ['reboundZeta', 'platformHz'] });
  assert(moved(keepZ, 'platformHz') && keepZ.work.platformHz > axes.platformHz, 'platform should rise off the floor');
  assert(!missed(keepZ, 'reboundZeta') && !missed(keepZ, 'bumpRatio'), 'damping should land');
  const keepPlat = M.applyDNA(chOf(LIGHT), feOf('horizon'), M.DEF_DR, { axes, keep: ['platformHz', 'reboundZeta'] });
  assert(!moved(keepPlat, 'platformHz'), 'platform moved although it is more protected');
  assert(keepPlat.misses.some(m => m.axis === 'reboundZeta' || m.axis === 'bumpRatio'), 'floor miss not reported');
});

t('balance (FrontHeavy, Forza): pitch carries the correction only if balance outranks it', () => {
  // balanceOffset -0.10, not 0: since the Forza display counts the tyres in series, springs move the
  // balance about 0.7x as far, and a 0 offset here is out of reach at any pitch. -0.10 needs the same
  // kind of rescue (pitch ~1.5) the test was written around.
  const axes = { ...M.sanitizeDNA({}).axes, platformHz: 2.8, pitchRatio: 1.125, arbShare: 7.5, balanceOffset: -0.10 };
  const keepBal = M.applyDNA(chOf(FIXTURES.FrontHeavy), feOf('horizon'), M.DEF_DR,
    { axes, keep: ['platformHz', 'balanceOffset', 'pitchRatio', 'arbShare', 'reboundZeta'] });
  assert(moved(keepBal, 'pitchRatio') && !missed(keepBal, 'balanceOffset'), 'pitch should move and balance land');
  const keepPitch = M.applyDNA(chOf(FIXTURES.FrontHeavy), feOf('horizon'), M.DEF_DR,
    { axes, keep: ['platformHz', 'pitchRatio', 'arbShare', 'reboundZeta', 'balanceOffset'] });
  assert(keepPitch.moves.length === 0, `moved ${keepPitch.moves.map(m => m.axis)} although balance is least protected`);
  assert(missed(keepPitch, 'balanceOffset')?.cause === 'anti-roll bars cannot reach the split', 'balance miss or its cause missing');
});

t('a balance target outside 0.20..0.90 is accepted, never chased', () => {
  const ch = chOf(FIXTURES.WideFront);                       // grip-neutral sits low here
  const off = 0.20 - M.gripNeutralOf(ch) - 0.05;             // below the 0.20 floor
  if (off < -0.20) return;                                   // not constructible on this fixture
  const res = M.applyDNA(ch, feOf('beamng'), M.DEF_DR, { axes: { ...M.sanitizeDNA({}).axes, balanceOffset: off }, keep: ['balanceOffset'] });
  assert(!res.moves.some(m => m.protects === 'balanceOffset'), 'moved an axis to chase an unreachable target');
});

// ─────────────────────────────────────────────────────────────────────────────
section('resolver invariants — archetypes and fuzz across every fixture and game mode');

const RUNS = [];
for (const mode of MODES) for (const [fn, over] of Object.entries({ ...FIXTURES, Heavy: HEAVY, Light: LIGHT })) {
  for (const a of M.DNA_ARCHETYPES) RUNS.push({ label: `${mode}/${fn}/${a.name}`, ch: chOf(over), fe: feOf(mode), dna: a });
  for (let i = 0; i < 6; i++) RUNS.push({ label: `${mode}/${fn}/fuzz${i}`, ch: chOf({ ...over, layout: LAYOUTS[i % 3] }), fe: feOf(mode), dna: randomDNA() });
}
const RESULTS = RUNS.map(r => ({ ...r, res: M.applyDNA(r.ch, r.fe, M.DEF_DR, r.dna) }));

t(`${RESULTS.length} runs completed`, () => assert(RESULTS.length >= 150, 'too few runs'));

t('moves never exceed DNA_MAX_MOVES and stay inside each axis range', () => {
  for (const { label, res } of RESULTS) {
    assert(res.moves.length <= M.DNA_MAX_MOVES, `${label}: ${res.moves.length} moves`);
    for (const m of res.moves) {
      const { min, max } = M.DNA_AXES[m.axis];
      assert(m.to >= min - 1e-9 && m.to <= max + 1e-9 && m.to !== m.from, `${label}: bad move ${JSON.stringify(m)}`);
    }
  }
});

t('never moves an axis to save a less-protected one', () => {
  for (const { label, res } of RESULTS) for (const m of res.moves)
    assert(rankIn(res.dna, m.axis) > rankIn(res.dna, m.protects), `${label}: moved ${m.axis} to protect ${m.protects}`);
});

t('never breaks an axis ranked above every axis it moved', () => {
  for (const { label, ch, fe, res } of RESULTS) {
    if (!res.moves.length) continue;
    const top = Math.min(...res.moves.map(m => rankIn(res.dna, m.axis)));
    const start = M.dnaEvaluate(ch, fe, M.DEF_DR, res.dna.axes);
    for (const k of OUTCOME) {
      const r = rankIn(res.dna, k);
      if (r < 0 || r >= top) continue;
      const hitAtStart = Math.abs(start.measured[k] - res.dna.axes[k]) <= start.tol[k];
      if (hitAtStart) assert(!missed(res, k), `${label}: ${k} (rank ${r}) hit at start but misses after moving rank ${top}`);
    }
  }
});

t('honest reporting: every axis off its original target was moved or is listed as a miss', () => {
  for (const { label, res } of RESULTS) for (const k of [...OUTCOME, ...SETTING]) {
    if (res.measured[k] == null) { assert(res.inexpressible.includes(k), `${label}: ${k} null but not inexpressible`); continue; }
    const off = Math.abs(res.measured[k] - res.dna.axes[k]) > res.tol[k];
    if (off) assert(moved(res, k) || missed(res, k), `${label}: ${k} off target (${res.measured[k]} vs ${res.dna.axes[k]}) and unreported`);
  }
});

t('every outcome miss carries a cause; setting axes never miss', () => {
  for (const { label, res } of RESULTS) for (const m of res.misses) {
    assert(!SETTING.includes(m.axis), `${label}: setting axis ${m.axis} missed`);
    assert(typeof m.cause === 'string' && m.cause.length > 0, `${label}: ${m.axis} miss without a cause`);
  }
});

t('resolved tunes are sanitizeTune fixed points', () => {
  for (const { label, ch, res } of RESULTS) {
    const s = M.sanitizeTune({ ch, fe: res.fe, dr: res.dr });
    for (const g of ['fe', 'dr']) for (const [k, v] of Object.entries(s[g]))
      assert(Object.is(v, res[g][k]), `${label}: sanitizeTune rewrote ${g}.${k}`);
  }
});

t('re-applying a resolved DNA moves nothing (the resolution is a fixed point)', () => {
  for (const { label, ch, fe, res } of RESULTS) {
    if (res.moves.length >= M.DNA_MAX_MOVES) continue;       // capped runs may legitimately continue
    const again = M.applyDNA(ch, fe, M.DEF_DR, { ...res.dna, axes: res.work });
    assert(again.moves.length === 0, `${label}: second apply moved ${again.moves.map(m => m.axis)}`);
  }
});

t('applyDNA stays interactive (worst case under 50 ms)', () => {
  let worst = 0;
  for (const { ch, fe, dna } of RUNS.slice(0, 60)) {
    const t0 = process.hrtime.bigint();
    M.applyDNA(ch, fe, M.DEF_DR, dna);
    worst = Math.max(worst, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  assert(worst < 50, `worst ${worst.toFixed(1)} ms`);
});

section('Damping Balance Mode — HYBRID (SYNC sub-mode)');
// Lives here because this suite runs the app's real feelToPhysics/sanitizeTune, not a mirror.
{
  const ch = { ...M.DEF_CH, frontBias: 58 };               // unequal corner mass → SYNC ≠ NEUTRAL
  const z = (mode, over = {}) => M.feelToPhysics(ch, M.resolveFeEffective(ch,
    feOf('horizon', { dampBalMode: mode, rearHzMode: 'multiplier', rearHzMult: 1.1, ...over })));
  for (const [bias, bump] of [[0, 'ratio'], [20, 'ratio'], [-30, 'independent']]) {
    const o = { dampingBias: bias, dampingMode: bump };
    const s = z('sync', o), n = z('neutral', o), h = z('hybrid', o);
    t(`HYBRID is the per-axle mean of TIME SYNC and EQUAL FORCE (bias ${bias}, ${bump})`, () => {
      assert(Math.abs(s.zetaR - n.zetaR) > 0.5, 'fixture no longer separates SYNC from NEUTRAL');
      for (const k of ['zetaF', 'zetaR', 'bumpZetaF', 'bumpZetaR'])
        near(h[k], (s[k] + n[k]) / 2, 1e-9, k);
    });
  }
  t('HYBRID holds the ride-reference axle at the anchor ζ', () => {
    const h = z('hybrid', { rideRef: 'front', reboundZeta: 70 });
    near(h.zetaF, h.baseZeta, 1e-9, 'zetaF');
  });
  t('HYBRID survives the share-code enum and sanitizeTune', () => {
    assert(M.DAMP_BAL_MODE_DEC[M.DAMP_BAL_MODE_ENC.hybrid] === 'hybrid', 'enum round-trip');
    for (const [k, i] of [['standard', 0], ['sync', 1], ['neutral', 2]])
      assert(M.DAMP_BAL_MODE_ENC[k] === i, `${k} index moved — ids are permanent`);
    const out = M.sanitizeTune({ ch, fe: feOf('horizon', { dampBalMode: 'hybrid' }), dr: M.DEF_DR });
    assert(out.fe.dampBalMode === 'hybrid', `sanitizeTune rewrote it to ${out.fe.dampBalMode}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
