// SUSP.OS — garage auto-tag tests
// Run with: node tests/tests-garage.js
// No dependencies required.
//
// LIKE tests-share.js, THIS FILE READS index.html. autoTagsOf is a promise about how App
// applies stored fields — mostly BRAKES' tier gating — and a mirrored copy would keep
// passing the day the app's gating moved.
//
// What it guards:
//   1. Payload gating: each tag appears only when the entry carries what it reads.
//   2. Diff: the type chip is suffixed DIFF (never a duplicate of the build chip), and
//      MANUAL DIFF is ungated by tier.
//   3. BRAKES: BEG shows none, INT shows the shift but never a centre, PRO's ENTRY
//      replaces the shift, and a pre-tier entry shows what it stores.
//   4. Provenance: DNA only on a stamped build, then TIER last.
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

const M = new Function(
  slice('const rsToHz=', '\n') + '\n' +
  slice('const HZ_BANDS=', '// Slider ticks') + '\n' +
  slice('const DEF_DR=', 'const BRAKE_CENTRE_DEC=') + '\n' +
  slice('const TIER_DEC=', '// meta is a codec group') + '\n' +
  slice('const NOTES_MAX=', '// ── units ──') +
  '\nreturn{autoTagsOf,DEF_DR};'
)();
const { autoTagsOf, DEF_DR } = M;

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const section = s => console.log(`\n── ${s} ──`);
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg ?? ''}\n       got      ${A}\n       expected ${B}`);
};
const labels = e => autoTagsOf(e).map(x => x.label);
const brakes = e => labels(e).filter(l => /BRAKES/.test(l));
const build = (dr, extra = {}) => ({ fe: { rideStiffness: 2.0 }, dr: { ...DEF_DR, ...dr }, ...extra });

section('payload gating');
t('chassis-only entry gets no build, diff or brake tags', () => {
  eq(labels({ ch: { layout: 'AWD', frontBias: 50 } }), ['AWD', 'BALANCED']);
});
t('build entry gets no layout/balance tag', () => {
  const l = labels(build({}));
  if (l.includes('RWD') || l.includes('BALANCED')) throw new Error(l.join(', '));
});
t('empty entry gets nothing', () => eq(labels({}), []));

section('diff');
t('diff type chip is suffixed, so RALLY build + RALLY diff are distinct', () => {
  const l = labels(build({ buildType: 'rally', diffType: 'rally' }));
  if (!l.includes('RALLY') || !l.includes('RALLY DIFF')) throw new Error(l.join(', '));
});
t('missing diffType falls back to DEF_DR, as a garage load does', () => {
  const { diffType: _, ...dr } = DEF_DR;
  if (!labels({ dr }).includes(DEF_DR.diffType.toUpperCase() + ' DIFF')) throw new Error(labels({ dr }).join(', '));
});
t('MANUAL DIFF shows at every tier', () => {
  for (const tier of [undefined, 'beginner', 'intermediate', 'pro'])
    if (!labels(build({ diffManual: true }, { tier })).includes('MANUAL DIFF')) throw new Error(String(tier));
});
t('no MANUAL DIFF on an AUTO diff', () => {
  if (labels(build({})).includes('MANUAL DIFF')) throw new Error('present');
});

section('brakes');
t('default brakes (shift 0, rec) tag nothing', () => eq(brakes(build({}, { tier: 'pro' })), []));
t('+ shift is ROTATE, − shift is STABLE', () => {
  eq(brakes(build({ brakeBiasShift: 3 }, { tier: 'intermediate' })), ['BRAKES ROTATE']);
  eq(brakes(build({ brakeBiasShift: -2 }, { tier: 'intermediate' })), ['BRAKES STABLE']);
});
t('BEG ignores the shift and the centre', () => {
  eq(brakes(build({ brakeBiasShift: 5, brakeCentre: 'grip' }, { tier: 'beginner' })), []);
  eq(brakes(build({ brakeCentre: 'entry' }, { tier: 'beginner' })), []);
});
t('INT shows the shift but never a centre', () => {
  eq(brakes(build({ brakeBiasShift: 5, brakeCentre: 'grip' }, { tier: 'intermediate' })), ['BRAKES ROTATE']);
  eq(brakes(build({ brakeBiasShift: -5, brakeCentre: 'entry' }, { tier: 'intermediate' })), ['BRAKES STABLE']);
});
t('PRO GRIP keeps the shift on top', () => {
  eq(brakes(build({ brakeBiasShift: 4, brakeCentre: 'grip' }, { tier: 'pro' })), ['GRIP BRAKES', 'BRAKES ROTATE']);
});
t('PRO ENTRY replaces the shift', () => {
  eq(brakes(build({ brakeBiasShift: 4, brakeCentre: 'entry' }, { tier: 'pro' })), ['ENTRY BRAKES']);
});
t('pre-tier entry shows what it stores', () => {
  eq(brakes(build({ brakeBiasShift: -1, brakeCentre: 'grip' })), ['GRIP BRAKES', 'BRAKES STABLE']);
});

section('provenance');
t('DNA chip on a stamped build, before TIER, and TIER last', () => {
  const l = labels(build({}, { dna: { axes: {} }, tier: 'pro' }));
  eq(l.slice(-2), ['DNA', 'PRO TIER']);
});
t('no DNA chip on an unstamped build', () => {
  if (labels(build({}, { tier: 'pro' })).includes('DNA')) throw new Error('present');
});
t('a saved DNA alone (kind dna) gets no DNA chip', () => {
  eq(labels({ dna: { axes: {} } }), []);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
