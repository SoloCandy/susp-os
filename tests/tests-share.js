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
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbCtx=') + '\n' +
  slice('const DNA_ARCHETYPES=', 'const Hint=') + '\n' +
  slice('const CODEC_FIELDS=', 'const sanitizeTune=') + '\n' +
  slice('const sanitizeTune=', '\nconst useTwoTap') +
  '\nreturn{DEF_CH,DEF_FE,DEF_DR,DEF_META,CODEC_FIELDS,codecFieldGroup,codecFieldKey,' +
  'SHARE_PARTS,SHARE_PART_IDS,mergeTune,partDiffers,encodeTune,decodeTune,sanitizeTune,' +
  'GAME_LIMITS,arbScaleOf};'
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
  // What App's physMode conversion effect actually writes: clicks × arbScaleOf(ch)·track².
  const ch = M.DEF_CH;
  const f = Math.round(20 * M.arbScaleOf(ch) * ch.trackF * ch.trackF);
  const r = Math.round(20 * M.arbScaleOf(ch) * ch.trackR * ch.trackR);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
