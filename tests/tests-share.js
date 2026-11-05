// SUSP.OS — share parts tests (loading a code in pieces)
// Run with: node tests/tests-share.js
// No dependencies required.
//
// LIKE tests-dna.js AND tests-beamng.js, THIS FILE READS index.html. SHARE_PARTS is a
// promise about CODEC_FIELDS — every field belongs to exactly one part — and a mirrored
// copy of either table would prove nothing the moment one of them changed.
//
// What it guards:
//   1. Coverage and disjointness: every codec field lands on exactly one part, and no part
//      names a key the codec does not carry. Adding a field without giving it a part fails
//      here, which is the whole point.
//   2. Each part merges in isolation: it takes its own keys and leaves every other key alone.
//   3. An empty or missing parts map changes nothing, and merging never mutates the current
//      tune.
//   4. decode(encode(x)) merges identically to x — the part split survives the wire format.
//   5. meta.tier is listed but never applied (applies:false).
//   6. carries (id 85): a part the sender left out under INCLUDE is never offered or applied.
//   7. The `~` checksum: a code cut short or edited is refused; a legacy code still decodes.
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the
// markers rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

// Order matters: the DEF_* literals execute at eval time and the enum block reads them.
const M = new Function(
  slice('// ── colour meanings ──', 'const KG_TO_LB=') + '\n' + // C_*, CAT_RAMP: read by the slices below
  slice('const DEF_CH=', 'const BRAKE_BIAS_SCALE=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbRowMeta=') + '\n' +
  slice('const DNA_ARCHETYPES=', 'const Hint=') + '\n' +
  slice('const CODEC_FIELDS=', 'const sanitizeTune=') + '\n' +
  slice('const sanitizeTune=', '\nconst useTwoTap') + '\n' +
  slice('const PHASE_NEUTRAL=', 'const PhaseHeadline=') +
  '\nreturn{DEF_CH,DEF_FE,DEF_DR,DEF_META,CODEC_FIELDS,codecFieldGroup,codecFieldKey,' +
  'SHARE_PARTS,SHARE_PART_IDS,mergeTune,partDiffers,encodeTune,decodeTune,sanitizeTune,' +
  'GAME_LIMITS,arbScaleOf,arbClickRsOf,CARRY_BIT,CARRY_ALL,partCarried,carriedSel,codecSum,crossArbUnits,ARB_MAN_LIN_MAX,' +
  'computeAlignment,alignOut,alignOfsFrom,alignDrOut,ALIGN_KEYS,ALIGN_GAME,ALIGN_OFS_RANGE,' +
  'migrateLegacyAl,alignBeyondReach,alignFieldsOf,alignReachText,alignInGame,migrateToeSign,' +
  'alignBalanceOf,ALIGN_BAL_TOE,ALIGN_BAL_CAMBER,balWord,PHASE_NEUTRAL,PHASE_STRONG,PTS_NEUTRAL,PTS_STRONG};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const section = s => console.log(`\n── ${s} ──`);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const DEFAULTS = { ch: M.DEF_CH, fe: M.DEF_FE, dr: M.DEF_DR };
const mine = () => ({ ch: { ...M.DEF_CH }, fe: { ...M.DEF_FE }, dr: { ...M.DEF_DR } });

// A tune that differs from the defaults in every part, so "took my keys / left yours" is
// observable for each one.
const theirs = () => ({
  ch: { ...M.DEF_CH, weight: 3100, frontBias: 58, trackF: 1.62, tyreF: '245/40R18', motionRatioF: 0.85 },
  fe: { ...M.DEF_FE, rideStiffness: 2.35, rearHzMode: 'multiplier', rearHzMult: 1.08, targetSpeed: 120,
        reboundZeta: 0.55, bumpRatio: 62, dampingBias: 7, dampBalMode: 'sync',
        arbBias: 12, arbMode: 'share', arbShareMan: 40, springShare: 65, springShareAuto: false },
  dr: { ...M.DEF_DR, buildType: 'track', diffType: 'sport', diffAccel: 55, diffCenter: 70 },
});

section('coverage: every codec field belongs to exactly one part');
t('every codec field lands on a part', () => {
  const missing = M.CODEC_FIELDS.filter(f => !M.SHARE_PARTS.some(p =>
    p.group === M.codecFieldGroup(f) && p.keys.includes(M.codecFieldKey(f))));
  assert(missing.length === 0,
    `no part claims: ${missing.map(f => `${f.id} ${M.codecFieldGroup(f)}.${M.codecFieldKey(f)}`).join(', ')}`);
});
t('no group.key in two parts', () => {
  const seen = new Set();
  for (const p of M.SHARE_PARTS) for (const k of p.keys) {
    const id = `${p.group}.${k}`;
    assert(!seen.has(id), `${id} appears in more than one part`);
    seen.add(id);
  }
});
t('no part names a key the codec does not carry', () => {
  const codec = new Set(M.CODEC_FIELDS.map(f => `${M.codecFieldGroup(f)}.${M.codecFieldKey(f)}`));
  for (const p of M.SHARE_PARTS) for (const k of p.keys)
    assert(codec.has(`${p.group}.${k}`), `${p.group}.${k} is in part '${p.id}' but has no codec id`);
});
// settleBias/settleMode (ids 48/49) are decode-only: old codes still carry them and
// sanitizeTune migrates them into dampBalMode/dampingBias, so they have no DEF_FE entry.
// They still belong to a part — the `damp` one — so the migration can never be split
// across a partial apply. Any OTHER key without a default is a typo.
const NO_DEFAULT = new Set(['fe.settleBias', 'fe.settleMode']);
t('every applied part key exists in its group defaults', () => {
  for (const p of M.SHARE_PARTS) {
    if (p.applies === false) continue;
    for (const k of p.keys) assert(k in DEFAULTS[p.group] || NO_DEFAULT.has(`${p.group}.${k}`),
      `${p.group}.${k} is not a DEF_${p.group.toUpperCase()} key`);
  }
});
t('the retired settle fields ride with the dampers', () => {
  const damp = M.SHARE_PARTS.find(p => p.id === 'damp');
  for (const k of ['settleBias', 'settleMode', 'dampBalMode', 'dampingBias'])
    assert(damp.keys.includes(k), `${k} must be in the damp part so its migration cannot split`);
});
t('meta.tier is listed but never applied', () => {
  const tier = M.SHARE_PARTS.find(p => p.group === 'meta');
  assert(tier && tier.applies === false, 'the meta part must exist with applies:false');
  assert(!M.SHARE_PART_IDS.includes(tier.id), 'SHARE_PART_IDS must exclude a non-applying part');
});

section('mergeTune: each part in isolation');
for (const p of M.SHARE_PARTS.filter(x => x.applies !== false)) {
  t(`'${p.id}' takes its own keys and leaves the rest`, () => {
    const cur = mine(), inc = theirs();
    const out = M.mergeTune(cur, inc, { [p.id]: true });
    for (const k of p.keys) assert(out[p.group][k] === inc[p.group][k],
      `${p.group}.${k} should have come from the code`);
    for (const q of M.SHARE_PARTS) {
      if (q.id === p.id || q.group === 'meta') continue;
      for (const k of q.keys) assert(out[q.group][k] === cur[q.group][k],
        `${q.group}.${k} moved, but only part '${p.id}' was ticked`);
    }
  });
}
t('all parts ticked = the whole code', () => {
  const cur = mine(), inc = theirs();
  const all = Object.fromEntries(M.SHARE_PART_IDS.map(id => [id, true]));
  const out = M.mergeTune(cur, inc, all);
  for (const f of M.CODEC_FIELDS) {
    if (f.group === 'meta') continue;
    const g = M.codecFieldGroup(f), k = M.codecFieldKey(f);
    assert(out[g][k] === inc[g][k], `${g}.${k} did not take the code's value`);
  }
});
t('a tier tick is ignored even if one is passed', () => {
  const out = M.mergeTune(mine(), { ...theirs(), meta: { tier: 'pro' } }, { tier: true });
  assert(out.meta === undefined, 'mergeTune must not produce a meta group');
});

section('mergeTune: nothing ticked, nothing touched');
t('empty parts map changes nothing', () => {
  const cur = mine(), out = M.mergeTune(cur, theirs(), {});
  for (const g of ['ch', 'fe', 'dr']) for (const k of Object.keys(cur[g]))
    assert(out[g][k] === cur[g][k], `${g}.${k} changed with no part ticked`);
});
t('missing parts map changes nothing', () => {
  assert(M.mergeTune(mine(), theirs()).fe.rideStiffness === M.DEF_FE.rideStiffness,
    'undefined parts map applied something');
});
t('does not mutate the current tune', () => {
  const cur = mine();
  M.mergeTune(cur, theirs(), Object.fromEntries(M.SHARE_PART_IDS.map(id => [id, true])));
  assert(cur.ch.weight === M.DEF_CH.weight && cur.fe.rideStiffness === M.DEF_FE.rideStiffness
    && cur.dr.buildType === M.DEF_DR.buildType, 'the current tune was written to');
});
t('keys the code does not carry are left alone', () => {
  const cur = mine();
  cur.ch.useRideHeightCG = true; // local-only, deliberately outside the codec
  const out = M.mergeTune(cur, { ch: { weight: 4000 } }, { ch: true });
  assert(out.ch.useRideHeightCG === true, 'a non-codec field was wiped by a partial incoming object');
  assert(out.ch.weight === 4000 && out.ch.frontBias === M.DEF_CH.frontBias, 'partial incoming ch merged wrong');
});

section('partDiffers');
t('a changed part differs', () => assert(M.partDiffers(mine(), theirs(), 'arb'), 'arb should differ'));
t('an identical part does not', () => assert(!M.partDiffers(mine(), mine(), 'arb'), 'identical arb reported as different'));
t('an unknown part id is false', () => assert(!M.partDiffers(mine(), theirs(), 'nope'), 'unknown id should be false'));
t('the tier part never differs', () => assert(!M.partDiffers(mine(), theirs(), 'tier'), 'tier is never applied, so never differs'));

section('round trip: decode(encode(x)) merges identically');
t('a decoded code merges to the same tune', () => {
  const inc = theirs();
  const dec = M.sanitizeTune(M.decodeTune(M.encodeTune(inc.ch, inc.fe, inc.dr, 'pro')));
  const all = Object.fromEntries(M.SHARE_PART_IDS.map(id => [id, true]));
  const viaCode = M.mergeTune(mine(), dec, all);
  const direct = M.mergeTune(mine(), M.sanitizeTune(inc), all);
  for (const f of M.CODEC_FIELDS) {
    if (f.group === 'meta') continue;
    const g = M.codecFieldGroup(f), k = M.codecFieldKey(f);
    assert(viaCode[g][k] === direct[g][k], `${g}.${k}: round trip gave ${viaCode[g][k]}, direct gave ${direct[g][k]}`);
  }
});
t('one part of a decoded code leaves the others alone', () => {
  const inc = theirs();
  const dec = M.sanitizeTune(M.decodeTune(M.encodeTune(inc.ch, inc.fe, inc.dr, 'pro')));
  const cur = mine();
  const out = M.mergeTune(cur, dec, { damp: true });
  assert(out.fe.reboundZeta === dec.fe.reboundZeta, 'dampers did not load');
  assert(out.fe.arbBias === cur.fe.arbBias && out.fe.rideStiffness === cur.fe.rideStiffness,
    'ARB or springs moved on a dampers-only load');
  assert(out.ch.weight === cur.ch.weight && out.dr.buildType === cur.dr.buildType,
    'chassis or drivetrain moved on a dampers-only load');
});

// arbManF/arbManR are the only fe fields whose UNITS depend on gameMode, so sanitizeTune's
// clamp has to read it. A hardcoded 1..65 crushed every shared BeamNG MAN tune to 65 and
// applied Horizon's ceiling to MOTORSPORT; see docs/HISTORY.md. Nothing crashed, which is
// why the round-trip tests above passed throughout — they compare two sanitized tunes, and
// both were wrong in the same way.
section('gameMode-dependent ARB MAN bounds');
const manTune = (gameMode, arbManF, arbManR) => ({
  ch: { ...M.DEF_CH },
  fe: { ...M.DEF_FE, gameMode, arbMode: 'man', arbManF, arbManR },
  dr: { ...M.DEF_DR },
});
const roundTrip = tune => M.sanitizeTune(M.decodeTune(M.encodeTune(tune.ch, tune.fe, tune.dr, 'pro')));

t('a physical-mode MAN tune survives a share code exactly', () => {
  // What the game-mode selector actually writes (crossArbUnits): clicks × arbClickRsOf(ch,axle).
  const ch = M.DEF_CH;
  const f = Math.round(20 * M.arbClickRsOf(ch, 'F'));
  const r = Math.round(20 * M.arbClickRsOf(ch, 'R'));
  assert(f > 1000 && r > 1000, `fixture is not in physical units: ${f}/${r}`);
  const out = roundTrip(manTune('beamng', f, r));
  assert(out.fe.arbManF === f && out.fe.arbManR === r,
    `roll stiffness was clamped away: sent ${f}/${r}, got ${out.fe.arbManF}/${out.fe.arbManR}`);
  assert(out.fe.gameMode === 'beamng' && out.fe.arbMode === 'man', 'mode did not survive');
});

t('each click mode clamps MAN to its own ceiling, not the Horizon ceiling', () => {
  for (const gm of ['horizon', 'motorsport']) {
    const ceiling = M.GAME_LIMITS[gm].arb;
    const out = roundTrip(manTune(gm, 65, 65));
    assert(out.fe.arbManF === ceiling && out.fe.arbManR === ceiling,
      `${gm}: 65 clicks should clamp to ${ceiling}, got ${out.fe.arbManF}/${out.fe.arbManR}`);
  }
});

t('a legal click value in each mode is untouched', () => {
  for (const gm of ['horizon', 'motorsport']) {
    const out = roundTrip(manTune(gm, 31, 28));
    assert(out.fe.arbManF === 31 && out.fe.arbManR === 28,
      `${gm}: legal clicks were moved to ${out.fe.arbManF}/${out.fe.arbManR}`);
  }
});

t('the click floor stays 1 and the physical floor stays 0', () => {
  const clicks = M.sanitizeTune(manTune('horizon', 0, -5));
  assert(clicks.fe.arbManF === 1 && clicks.fe.arbManR === 1,
    `clicks should floor at 1, got ${clicks.fe.arbManF}/${clicks.fe.arbManR}`);
  const phys = M.sanitizeTune(manTune('beamng', 0, -5));
  assert(phys.fe.arbManF === 0 && phys.fe.arbManR === 0,
    `physical should floor at 0 (computeTune reads Math.max(0, …)), got ${phys.fe.arbManF}/${phys.fe.arbManR}`);
});

t('a junk gameMode falls back to the default mode bounds, not a crash', () => {
  const out = M.sanitizeTune(manTune('', 65, 65));
  assert(out.fe.gameMode === M.DEF_FE.gameMode, `gameMode should fall back, got ${JSON.stringify(out.fe.gameMode)}`);
  const ceiling = M.GAME_LIMITS[M.DEF_FE.gameMode].arb;
  assert(out.fe.arbManF === Math.min(65, ceiling), `bounds should follow the fallback mode, got ${out.fe.arbManF}`);
});

t('the field\'s N/m ceiling survives a share code at the widest track and ARB motion ratio', () => {
  // The MAN Field is in N/m, storage in N·m/rad = k·track²·amr²/2. A 0..200000 clamp on the
  // STORED value cut what the Field let through on any track over 1.41 m.
  const rs = M.ARB_MAN_LIN_MAX * 2.6 * 2.6 * 1.5 * 1.5 / 2;
  const out = M.sanitizeTune(manTune('beamng', rs, 240000));
  assert(out.fe.arbManF === rs && out.fe.arbManR === 240000,
    `typed ceiling was cut: sent ${rs}/240000, got ${out.fe.arbManF}/${out.fe.arbManR}`);
});

// The bars' units follow gameMode, and gameMode rides with `ride`. A load that takes `ride` but
// not `arb` keeps the reader's bars, so they cross the boundary the way the game-mode selector
// would carry them. Every other combination brings the bars in the units they arrive with: the
// App effect this replaced converted on EVERY mode change, so a Horizon MAN code's 20 clicks
// loaded in BeamNG became 20 / 26000 → 0 N·m/rad.
section('MAN ARB units across a game-mode change');
const kOf = (ch, axle) => M.arbClickRsOf(ch, axle);

t('crossArbUnits converts clicks ↔ roll stiffness losslessly and clamps to the new ceiling', () => {
  const ch = M.DEF_CH;
  const fe = { ...M.DEF_FE, arbMode: 'man', arbManF: 21.4, arbManR: 9.7 };
  const phys = M.crossArbUnits({ ...fe, gameMode: 'beamng' }, ch, 'horizon');
  assert(phys.arbManF === Math.round(21.4 * kOf(ch, 'F')), `F to N·m/rad: ${phys.arbManF}`);
  const back = M.crossArbUnits({ ...phys, gameMode: 'horizon' }, ch, 'beamng');
  assert(back.arbManF === 21.4 && back.arbManR === 9.7, `round trip moved the bars: ${back.arbManF}/${back.arbManR}`);
  const big = M.crossArbUnits({ ...fe, gameMode: 'motorsport', arbManF: 60 * kOf(ch, 'F') }, ch, 'beamng');
  assert(big.arbManF === 40, `a bar past MOTORSPORT's ceiling should land on 40, got ${big.arbManF}`);
  const same = { ...fe, gameMode: 'motorsport' };
  assert(M.crossArbUnits(same, ch, 'horizon') === same, 'a click → click switch must be a no-op');
});

t('crossArbUnits drops BASIC to AUTO in a physical mode and leaves non-MAN bars alone', () => {
  const fe = { ...M.DEF_FE, arbMode: 'basic', arbManF: 20, arbManR: 20, gameMode: 'beamng' };
  const out = M.crossArbUnits(fe, M.DEF_CH, 'horizon');
  assert(out.arbMode === 'auto', `BASIC should become AUTO, got ${out.arbMode}`);
  assert(out.arbManF === 20 && out.arbManR === 20, 'inert bars were converted');
});

const horizonMan = () => ({ ch: { ...M.DEF_CH }, fe: { ...M.DEF_FE, gameMode: 'horizon', arbMode: 'man', arbManF: 20, arbManR: 12 }, dr: { ...M.DEF_DR } });
const beamngMan = () => ({ ch: { ...M.DEF_CH }, fe: { ...M.DEF_FE, gameMode: 'beamng', arbMode: 'man', arbManF: 48000, arbManR: 30000 }, dr: { ...M.DEF_DR } });

t('a whole code from the other game keeps its bars as sent', () => {
  const all = { ch: true, ride: true, damp: true, arb: true, dr: true };
  const a = M.mergeTune(beamngMan(), horizonMan(), all);
  assert(a.fe.gameMode === 'horizon' && a.fe.arbManF === 20 && a.fe.arbManR === 12,
    `Horizon code into BeamNG: ${a.fe.gameMode} ${a.fe.arbManF}/${a.fe.arbManR}`);
  const b = M.mergeTune(horizonMan(), beamngMan(), all);
  assert(b.fe.gameMode === 'beamng' && b.fe.arbManF === 48000 && b.fe.arbManR === 30000,
    `BeamNG code into Horizon: ${b.fe.gameMode} ${b.fe.arbManF}/${b.fe.arbManR}`);
  const c = M.mergeTune(beamngMan(), horizonMan(), { ride: true, arb: true });
  assert(c.fe.arbManF === 20 && c.fe.arbManR === 12, `SPRINGS + ARB: ${c.fe.arbManF}/${c.fe.arbManR}`);
});

t('SPRINGS without ARB carries the reader\'s own bars into the new mode', () => {
  const cur = horizonMan();
  const out = M.mergeTune(cur, beamngMan(), { ride: true });
  assert(out.fe.gameMode === 'beamng', 'gameMode did not come across');
  assert(out.fe.arbManF === Math.round(20 * kOf(cur.ch, 'F'))
    && out.fe.arbManR === Math.round(12 * kOf(cur.ch, 'R')),
    `the reader's 20/12 clicks should become N·m/rad, got ${out.fe.arbManF}/${out.fe.arbManR}`);
});

t('ARB without SPRINGS is left as sent (the arbUnitClash warning\'s case)', () => {
  const out = M.mergeTune(horizonMan(), beamngMan(), { arb: true });
  assert(out.fe.gameMode === 'horizon' && out.fe.arbManF === 48000,
    `expected the sender's bars unconverted under the reader's mode, got ${out.fe.gameMode} ${out.fe.arbManF}`);
});

section('per-axle ARB click scale (id 90)');
const scaled = over => ({ ch: { ...M.DEF_CH, useMeasuredArbClick: true, measuredArbClick: 680,
  measuredArbNat: 0.55, measuredArbNatHz: 2.2, ...over }, fe: { ...M.DEF_FE }, dr: { ...M.DEF_DR } });

t('a split scale survives a share code, and crossArbUnits converts each axle on its own scale', () => {
  const out = roundTrip(scaled({ measuredArbClickR: 540 }));
  assert(out.ch.measuredArbClick === 680 && out.ch.measuredArbClickR === 540,
    `pair did not survive: ${out.ch.measuredArbClick}/${out.ch.measuredArbClickR}`);
  const ch = out.ch, fe = { ...M.DEF_FE, arbMode: 'man', arbManF: 20, arbManR: 20 };
  const phys = M.crossArbUnits({ ...fe, gameMode: 'beamng' }, ch, 'horizon');
  assert(phys.arbManF === Math.round(20 * 680 * ch.trackF * ch.trackF)
    && phys.arbManR === Math.round(20 * 540 * ch.trackR * ch.trackR), `per-axle conversion: ${phys.arbManF}/${phys.arbManR}`);
});
t('a single scale omits id 90 and decodes with no rear scale', () => {
  // Base64 over "v|~sum|id:val|…"; a single scale must not emit a 90: pair, a split must.
  const ids = c => atob(c).split('|').slice(2).map(p => p.split(':')[0]);
  assert(!ids(M.encodeTune(scaled({}).ch, M.DEF_FE, M.DEF_DR, 'pro')).includes('90'), 'single scale emitted id 90');
  assert(ids(M.encodeTune(scaled({ measuredArbClickR: 540 }).ch, M.DEF_FE, M.DEF_DR, 'pro')).includes('90'), 'split omitted id 90');
  const out = roundTrip(scaled({}));
  assert(out.ch.measuredArbClick === 680 && out.ch.measuredArbClickR === null, `got ${out.ch.measuredArbClickR}`);
});
t('sanitizeTune nulls a rear scale with the flag off or no front, and clamps it', () => {
  const off = M.sanitizeTune(scaled({ useMeasuredArbClick: false, measuredArbClickR: 540 }));
  assert(off.ch.measuredArbClickR === null, 'flag off kept a rear scale');
  const alone = M.sanitizeTune(scaled({ measuredArbClick: null, measuredArbClickR: 540 }));
  assert(alone.ch.measuredArbClickR === null, 'rear kept with no front');
  const big = M.sanitizeTune(scaled({ measuredArbClickR: 99999 }));
  assert(big.ch.measuredArbClickR === 1500, `rear not clamped: ${big.ch.measuredArbClickR}`);
});

section('BUMP MODE → LANDING');

t('a LANDING tune and its drop % survive the wire format', () => {
  const tune = mine();
  tune.fe = { ...tune.fe, dampingMode: 'landing', landingPct: 237 };
  const out = roundTrip(tune);
  assert(out.fe.dampingMode === 'landing', `dampingMode came back ${JSON.stringify(out.fe.dampingMode)}`);
  assert(out.fe.landingPct === 237, `landingPct came back ${out.fe.landingPct}`);
});

t('an out-of-range drop % clamps to 10-600', () => {
  const lo = M.sanitizeTune({ ...mine(), fe: { ...M.DEF_FE, landingPct: 0 } });
  const hi = M.sanitizeTune({ ...mine(), fe: { ...M.DEF_FE, landingPct: 9999 } });
  assert(lo.fe.landingPct === 10 && hi.fe.landingPct === 600, `got ${lo.fe.landingPct} / ${hi.fe.landingPct}`);
});

t('an unknown bump mode (an older client\'s view of a newer one) falls back to RATIO', () => {
  const out = M.sanitizeTune({ ...mine(), fe: { ...M.DEF_FE, dampingMode: 'bogus' } });
  assert(out.fe.dampingMode === 'ratio', `got ${out.fe.dampingMode}`);
});

section('carries (id 85): parts the sender left out');

const codeOf = (tune, carries) => M.encodeTune(tune.ch, tune.fe, tune.dr, 'pro', carries);
const carriesIn = code => M.decodeTune(code).meta.carries;

t('a whole-tune code omits id 85, so it reads exactly as it always did', () => {
  const plain = atob(codeOf(theirs(), M.CARRY_ALL));
  assert(!/\|85:/.test(plain), `id 85 should be omitted, got ${plain}`);
  assert(carriesIn(codeOf(theirs())) === null, 'carries should decode to null (= everything)');
});

t('a DRIVETRAIN-only code carries only dr\'s parts (DRIVETRAIN, ALIGNMENT); every other part is unofferable', () => {
  const code = M.encodeTune(M.DEF_CH, M.DEF_FE, theirs().dr, 'pro', M.CARRY_BIT.dr);
  const c = carriesIn(code);
  assert(c === M.CARRY_BIT.dr, `carries decoded as ${c}`);
  for (const id of M.SHARE_PART_IDS)
    assert(M.partCarried(c, id) === (id === 'dr' || id === 'align'), `${id}: partCarried ${M.partCarried(c, id)}`);
});

t('ALIGNMENT travels as offsets and puts the reader in AUTO; MANUAL values never travel', () => {
  const dr = { ...M.DEF_DR, alignOfsToeF: -0.2, alignOfsCaster: 1.2, alignManual: true, alignManCamberF: -3.3 };
  const dec = M.decodeTune(M.encodeTune(M.DEF_CH, M.DEF_FE, dr, 'intermediate'));
  assert(Math.abs(dec.dr.alignOfsToeF + 0.2) < 1e-9 && Math.abs(dec.dr.alignOfsCaster - 1.2) < 1e-9, JSON.stringify(dec.dr));
  assert(!('alignManual' in dec.dr) && !('alignManCamberF' in dec.dr), 'MANUAL state decoded');
  const me = { ch: M.DEF_CH, fe: M.DEF_FE, dr: { ...M.DEF_DR, alignManual: true, alignManCamberF: -2.0 } };
  const out = M.mergeTune(me, M.sanitizeTune(dec), { align: true });
  assert(out.dr.alignManual === false, 'reader left in MANUAL');
  assert(out.dr.alignManCamberF === -2.0, 'reader\'s own MANUAL values kept');
  assert(Math.abs(out.dr.alignOfsToeF + 0.2) < 1e-9, 'offset applied');
  const keep = M.mergeTune(me, M.sanitizeTune(dec), { dr: true });
  assert(keep.dr.alignManual === true && keep.dr.alignOfsToeF === 0, 'DRIVETRAIN alone touched the alignment');
});

// ── alignment: AUTO + intent, MANUAL, and the translation between them ──
{
  const ch = { ...M.DEF_CH }, tune = { fHz: 1.8, rHz: 1.8, rollDeg: 2 };
  const auto = M.computeAlignment(ch, tune, 'RWD', 'track');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  t('alignOut: no offsets is AUTO exactly; an offset adds, rounded to 0.1°', () => {
    const plain = M.alignOut(auto, M.DEF_DR, 'intermediate');
    for (const k of M.ALIGN_KEYS) assert(near(plain['rec' + k[0].toUpperCase() + k.slice(1)], auto['rec' + k[0].toUpperCase() + k.slice(1)]), k);
    const o = M.alignOut(auto, { ...M.DEF_DR, alignOfsToeF: -0.2, alignOfsCaster: 0.30000000000000004 }, 'intermediate');
    assert(near(o.recToeF, auto.recToeF - 0.2) && near(o.recCaster, auto.recCaster + 0.3), JSON.stringify(o));
  });
  t('alignOut: BEG reads pure AUTO, ignoring both offsets and MANUAL', () => {
    const o = M.alignOut(auto, { ...M.DEF_DR, alignManual: true, alignOfsToeF: -0.2 }, 'beginner');
    assert(!o.manual && near(o.recToeF, auto.recToeF), JSON.stringify(o));
  });
  t('alignOut: an offset may pass ALIGN_REC to the game limit, and LIMIT marks the game edge', () => {
    // caster 6.4 + 1.5 would be 7.9: the game stops at 7.0
    const hi = M.computeAlignment({ ...ch, frontBias: 60 }, { fHz: 3.0, rHz: 1.8, rollDeg: 2 }, 'RWD', 'track');
    const o = M.alignOut(hi, { ...M.DEF_DR, alignOfsCaster: 1.5 }, 'pro');
    assert(o.recCaster === M.ALIGN_GAME.caster[1] && o.limit.caster, JSON.stringify({ base: hi.recCaster, o }));
    // rear toe AUTO 0.1 + 0.3 = 0.4, past ALIGN_REC's 0.3 and not a LIMIT: the game allows it
    const t2 = M.alignOut(auto, { ...M.DEF_DR, alignOfsToeR: 0.3 }, 'pro');
    assert(near(auto.recToeR, 0.1) && near(t2.recToeR, 0.4) && !t2.limit.toeR, JSON.stringify({ base: auto.recToeR, t2 }));
  });
  t('MANUAL → offsets → AUTO lands on the MANUAL values when they are within the slider ranges', () => {
    const man = { camberF: auto.recCamberF - 0.7, camberR: auto.recCamberR + 0.4, toeF: auto.recToeF + 0.1,
                  toeR: auto.recToeR - 0.2, caster: auto.recCaster + 1.1 };
    const dr = { ...M.DEF_DR, ...M.alignOfsFrom(auto, man) };
    const o = M.alignOut(auto, dr, 'intermediate');
    for (const k of M.ALIGN_KEYS) assert(near(o['rec' + k[0].toUpperCase() + k.slice(1)], Math.round(man[k] * 10) / 10), `${k}: ${JSON.stringify(o)}`);
  });
  t('MANUAL beyond a slider range translates to that range\'s end', () => {
    const ofs = M.alignOfsFrom(auto, { camberF: -5, camberR: auto.recCamberR, toeF: 3, toeR: auto.recToeR, caster: 1 });
    assert(ofs.alignOfsCamberF === -2 && ofs.alignOfsToeF === 0.3 && ofs.alignOfsCaster === -1.5 && ofs.alignOfsToeR === 0, JSON.stringify(ofs));
  });
  t('alignDrOut: AUTO leaves dr alone; MANUAL writes the translated offsets beside the MANUAL values', () => {
    const dr = { ...M.DEF_DR, alignOfsToeF: 0.1 };
    assert(M.alignDrOut(auto, dr) === dr, 'AUTO copied');
    const m = { ...M.DEF_DR, alignManual: true, alignManToeF: auto.recToeF - 0.3 };
    const out = M.alignDrOut(auto, m);
    assert(out.alignManual === true && out.alignManToeF === m.alignManToeF && near(out.alignOfsToeF, -0.3), JSON.stringify(out));
  });
  t('alignBeyondReach: nothing under AUTO or within reach; lists what the sliders cannot reach', () => {
    assert(M.alignBeyondReach(auto, { ...M.DEF_DR, alignManCamberF: -9 }).length === 0, 'AUTO listed');
    const within = { ...M.DEF_DR, alignManual: true, ...Object.fromEntries(M.ALIGN_KEYS.map(k =>
      ['alignMan' + k[0].toUpperCase() + k.slice(1), auto['rec' + k[0].toUpperCase() + k.slice(1)]])) };
    assert(M.alignBeyondReach(auto, within).length === 0, 'MANUAL equal to AUTO listed');
    const far = M.alignBeyondReach(auto, { ...within, alignManCamberF: auto.recCamberF - 2.4 });
    assert(far.length === 1 && far[0].k === 'camberF' && near(far[0].reach, auto.recCamberF - 2), JSON.stringify(far));
    assert(/camber F .* → /.test(M.alignReachText(far)), M.alignReachText(far));
  });
  t('alignFieldsOf: exactly the alignment fields, only those present', () => {
    const f = M.alignFieldsOf({ ...M.DEF_DR, alignManual: true, alignOfsToeF: 0.2 });
    assert(f.alignManual === true && f.alignOfsToeF === 0.2 && !('buildType' in f) && Object.keys(f).length === 11, JSON.stringify(f));
    assert(Object.keys(M.alignFieldsOf({ buildType: 'track' })).length === 0, 'invented fields');
  });
}

// ── migrateLegacyAl: alignment's move from suspos_al_v2 into dr ──
{
  const store = {};
  globalThis.localStorage = { getItem: k => (k in store ? store[k] : null) };
  const set = (dr, al) => { for (const k in store) delete store[k];
    if (dr !== undefined) store.suspos_dr_v8 = JSON.stringify(dr); if (al !== undefined) store.suspos_al_v2 = JSON.stringify(al); };
  const legacyManual = { mode: 'manual', camberF: -2.7, camberR: -1.9, toeF: -0.2, toeR: 0.2, caster: 6.1, nudgeStrength: 50 };
  t('a stored dr from before the move takes MANUAL and its angles from the old key', () => {
    set({ buildType: 'track' }, legacyManual);
    const out = M.migrateLegacyAl({ ...M.DEF_DR, buildType: 'track' });
    assert(out.alignManual === true && out.alignManCamberF === -2.7 && out.alignManCaster === 6.1 && out.alignManToeR === 0.2, JSON.stringify(out));
  });
  t('MECH and GRIP come across as AUTO; the legacy alignManual boolean still counts', () => {
    set({}, { ...legacyManual, mode: 'mech' });
    assert(M.migrateLegacyAl({ ...M.DEF_DR }).alignManual === false, 'mech');
    set({}, { camberF: -3, alignManual: true });
    const o = M.migrateLegacyAl({ ...M.DEF_DR });
    assert(o.alignManual === true && o.alignManCamberF === -3, JSON.stringify(o));
  });
  t('a dr written since the move, no stored dr, or no old key: nothing changes', () => {
    const dr = { ...M.DEF_DR };
    set({ alignManual: false }, legacyManual); assert(M.migrateLegacyAl(dr) === dr, 'new dr migrated again');
    set(undefined, legacyManual);             assert(M.migrateLegacyAl(dr) === dr, 'fresh install migrated');
    set({ buildType: 'track' }, undefined);   assert(M.migrateLegacyAl(dr) === dr, 'no old key');
  });
  t('junk in the old key falls back to the defaults', () => {
    set({}, { mode: 'manual', camberF: 'x', toeF: null });
    const o = M.migrateLegacyAl({ ...M.DEF_DR });
    assert(o.alignManual === true && o.alignManCamberF === M.DEF_DR.alignManCamberF && o.alignManToeF === M.DEF_DR.alignManToeF, JSON.stringify(o));
    store.suspos_al_v2 = '{not json'; assert(M.migrateLegacyAl(M.DEF_DR) === M.DEF_DR, 'parse error');
  });
  // ── migrateToeSign: Forza MANUAL toe was read with the wrong sign until checked on the car ──
  const setFe = fe => { store.suspos_fe_v8 = JSON.stringify(fe); };
  const manual = { ...M.DEF_DR, alignManual: true, alignManToeF: 0.2, alignManToeR: -0.1 };
  t('a Forza MANUAL toe saved before the fix is negated once, and flagged', () => {
    set({ alignManual: true }); setFe({ gameMode: 'horizon' });
    const o = M.migrateToeSign(manual);
    assert(o.alignManToeF === -0.2 && o.alignManToeR === 0.1 && o.alignToeV2 === true, JSON.stringify(o));
    assert(o.alignManCamberF === manual.alignManCamberF, 'camber touched');
  });
  t('migrateToeSign leaves alone: a flagged dr, AUTO, BeamNG, a fresh install', () => {
    set({ alignManual: true, alignToeV2: true }); setFe({ gameMode: 'horizon' });
    assert(M.migrateToeSign(manual) === manual, 'flagged dr negated again');
    set({ alignManual: false }); setFe({ gameMode: 'horizon' });
    const auto0 = { ...manual, alignManual: false };
    assert(M.migrateToeSign(auto0) === auto0, 'AUTO negated');
    set({ alignManual: true }); setFe({ gameMode: 'beamng' });
    assert(M.migrateToeSign(manual) === manual, 'BeamNG negated');
    set(undefined);
    assert(M.migrateToeSign(manual) === manual, 'fresh install negated');
  });
  delete globalThis.localStorage;
}

t('alignInGame: Forza toe is the model negated, BeamNG toe and every camber/caster unchanged, and it is its own inverse', () => {
  for (const gm of ['horizon', 'motorsport']) {
    assert(M.alignInGame('toeF', 0.1, gm) === -0.1 && M.alignInGame('toeR', -0.2, gm) === 0.2, gm);
    assert(M.alignInGame('toeF', M.alignInGame('toeF', 0.3, gm), gm) === 0.3, 'not self-inverse');
    assert(Object.is(M.alignInGame('toeF', 0, gm), 0), 'returned -0');
  }
  assert(M.alignInGame('toeF', 0.1, 'beamng') === 0.1, 'BeamNG flipped');
  for (const k of ['camberF', 'camberR', 'caster']) assert(M.alignInGame(k, -1.5, 'horizon') === -1.5, k);
});
// ── alignment in the Handling Balance (alignBalanceOf) and the three-phase words (balWord) ──
{
  const tgt = { camberF: -1.5, camberR: -1.5 }, roll = 2, gain = 0.69, rear = 0.75;
  const onTarget = { recCamberF: -1.5 - roll * gain, recCamberR: -1.5 - roll * gain * rear, recToeF: 0, recToeR: 0 };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  t('alignBalanceOf: zero toe and camber on target lean nowhere', () => {
    const b = M.alignBalanceOf(onTarget, tgt, roll, gain, rear);
    assert(near(b.toeF, 0) && near(b.toeR, 0) && near(b.camber, 0), JSON.stringify(b));
  });
  t('alignBalanceOf: toe-in leans understeer, toe-out oversteer, front and rear (model sign)', () => {
    const inn = M.alignBalanceOf({ ...onTarget, recToeF: 0.1, recToeR: 0.2 }, tgt, roll, gain, rear);
    assert(near(inn.toeF, -0.1 * M.ALIGN_BAL_TOE) && near(inn.toeR, -0.2 * M.ALIGN_BAL_TOE), JSON.stringify(inn));
    const out = M.alignBalanceOf({ ...onTarget, recToeF: -0.1 }, tgt, roll, gain, rear);
    assert(out.toeF > 0, 'front toe-out not toward oversteer');
  });
  t('alignBalanceOf: camber off target either way — front toward understeer, rear toward oversteer', () => {
    for (const d of [-0.8, 0.8]) {
      const f = M.alignBalanceOf({ ...onTarget, recCamberF: onTarget.recCamberF + d }, tgt, roll, gain, rear);
      assert(near(f.camber, -0.8 * M.ALIGN_BAL_CAMBER), `front ${d}: ${f.camber}`);
      const r = M.alignBalanceOf({ ...onTarget, recCamberR: onTarget.recCamberR + d }, tgt, roll, gain, rear);
      assert(near(r.camber, 0.8 * M.ALIGN_BAL_CAMBER), `rear ${d}: ${r.camber}`);
    }
  });
  t('alignment stays small: the intent sliders at full reach stay inside a few points', () => {
    const b = M.alignBalanceOf({ ...onTarget, recToeF: 0.3, recToeR: 0.3, recCamberF: onTarget.recCamberF - 2 }, tgt, roll, gain, rear);
    assert(Math.abs(b.toeF) <= 1.5 + 1e-9 && Math.abs(b.toeR) <= 1.5 + 1e-9 && Math.abs(b.camber) <= 2 + 1e-9, JSON.stringify(b));
  });
  t('balWord: NEUTRAL inside the band, PUSH / LOOSE past it, STRONG past the strong edge', () => {
    const w = v => M.balWord(v, M.PTS_NEUTRAL, M.PTS_STRONG);
    assert(w(0) === 'NEUTRAL' && w(2.9) === 'NEUTRAL' && w(-2.9) === 'NEUTRAL', 'band');
    assert(w(3) === 'LOOSE' && w(-3) === 'PUSH', 'edge');
    assert(w(M.PTS_STRONG) === 'STRONG LOOSE' && w(-M.PTS_STRONG) === 'STRONG PUSH', 'strong');
    assert(M.balWord(0.5, M.PHASE_NEUTRAL, M.PHASE_STRONG) === 'NEUTRAL' && M.balWord(-6, M.PHASE_NEUTRAL, M.PHASE_STRONG) === 'STRONG PUSH', 'PRO');
  });
}

t('alignReachText prints toe in the game\'s sign', () => {
  const txt = M.alignReachText([{ k: 'toeR', man: 0.5, reach: 0.4 }], 'horizon');
  assert(txt === 'toe R -0.5 → -0.4°', txt);
});

t('sanitizeTune holds the offsets to their slider ranges', () => {
  const t = M.sanitizeTune({ ch: M.DEF_CH, fe: M.DEF_FE, dr: { ...M.DEF_DR, alignOfsToeF: 9, alignOfsCaster: -9, alignOfsCamberR: 'x' } });
  assert(t.dr.alignOfsToeF === 0.3 && t.dr.alignOfsCaster === -1.5 && t.dr.alignOfsCamberR === 0, JSON.stringify(t.dr));
});

t('APPLY with every tick on leaves the parts a code does not carry alone', () => {
  const tn = theirs();
  const me = { ...mine(), ch: { ...M.DEF_CH, weight: 4100 }, fe: { ...M.DEF_FE, rideStiffness: 3.2 } };
  const code = M.encodeTune(M.DEF_CH, M.DEF_FE, tn.dr, 'pro', M.CARRY_BIT.dr);
  const all = Object.fromEntries(M.SHARE_PART_IDS.map(id => [id, true]));
  const out = M.mergeTune(me, M.sanitizeTune(M.decodeTune(code)), M.carriedSel(all, carriesIn(code)));
  assert(out.ch.weight === 4100 && out.fe.rideStiffness === 3.2,
    `own ch/fe were overwritten: ${out.ch.weight} / ${out.fe.rideStiffness}`);
  assert(out.dr.diffAccel === tn.dr.diffAccel, `dr not taken: ${out.dr.diffAccel}`);
});

t('carriedSel never turns a tick ON, and a junk mask reads as everything', () => {
  const none = Object.fromEntries(M.SHARE_PART_IDS.map(id => [id, false]));
  assert(M.SHARE_PART_IDS.every(id => !M.carriedSel(none, M.CARRY_ALL)[id]), 'an unticked part came back ticked');
  for (const junk of [null, undefined, NaN, -1, 8, 2.5, 'x'])
    assert(M.SHARE_PART_IDS.every(id => M.partCarried(junk, id)), `mask ${String(junk)} should mean every part`);
});

section('integrity: a damaged code is refused, not half-loaded');

t('every new code carries a checksum as its second pair', () => {
  const parts = atob(codeOf(theirs())).split('|');
  assert(parts[1].startsWith('~'), `second pair is ${parts[1]}`);
  assert(M.codecSum(parts.slice(2).join('|')) === parts[1].slice(1), 'checksum does not match its body');
});

t('a code cut short at any length is refused with the codec\'s own message', () => {
  const code = codeOf(theirs());
  for (let cut = 1; cut < code.length; cut++) {
    const short = code.slice(0, code.length - cut);
    // Dropping only base64 '=' padding decodes to the identical text — not damage.
    let same = false;
    try { same = atob(short) === atob(code); } catch {}
    if (same) continue;
    let threw = null;
    try { M.decodeTune(short); } catch (e) { threw = e; }
    assert(threw, `cut ${cut} decoded without an error`);
    assert(threw.codec === true, `cut ${cut}: a non-codec error leaked out: ${threw.message}`);
  }
});

t('an edited value is refused', () => {
  const plain = atob(codeOf(theirs()));
  assert(plain.includes('|1:3100'), `fixture changed: ${plain}`);
  let threw = false;
  try { M.decodeTune(btoa(plain.replace('|1:3100', '|1:3900'))); } catch (e) { threw = /damaged/.test(e.message); }
  assert(threw, 'an edited code was accepted');
});

t('a legacy code (no checksum) still decodes', () => {
  const out = M.decodeTune(btoa('1|1:3100|7:2.35|77:2'));
  assert(out.ch.weight === 3100 && out.fe.rideStiffness === 2.35, `got ${out.ch.weight} / ${out.fe.rideStiffness}`);
});

t('an outdated version keeps its own message', () => {
  let msg = '';
  try { M.decodeTune(btoa('9|1:3100')); } catch (e) { msg = e.codec ? e.message : ''; }
  assert(/Outdated/.test(msg), `got ${JSON.stringify(msg)}`);
});

section('small guards');

t('partDiffers ignores float noise on the live side', () => {
  const tn = M.sanitizeTune(theirs());
  const me = { ...tn, fe: { ...tn.fe, rideStiffness: tn.fe.rideStiffness + 1e-12 } };
  assert(!M.partDiffers(me, tn, 'ride'), 'a 1e-12 difference read as "from the code"');
});

t('rideBottomG is clamped to the envelope of every legal ride height and Hz', () => {
  const g = v => M.sanitizeTune({ ...mine(), fe: { ...M.DEF_FE, rideBottomG: v } }).fe.rideBottomG;
  const hi = g(1e300), lo = g(1e-9);
  assert(hi > 100 && hi < 200, `upper clamp ${hi}`);
  assert(lo > 0.01 && lo < 0.05, `lower clamp ${lo}`);
  assert(g(1.4) === 1.4, `an ordinary target moved: ${g(1.4)}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
