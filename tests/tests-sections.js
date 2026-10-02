// SUSP.OS — section visibility tests
// Run with: node tests/tests-sections.js
// No dependencies required.
//
// LIKE tests-garage.js, THIS FILE READS index.html. SECTION_VIS is the one table that says
// which fields each sidebar section owns; RESET writes them and a hidden section's stub reads
// them. A mirrored copy here would keep passing the day the two drifted apart.
//
// What it guards:
//   1. Coverage: every sidebar section (SECTION_KEYS) is in SECTION_VIS, and every RESET
//      goes through sectionDefaults.
//   2. sectionChanged: defaults read as unchanged; a change reads as changed; BALANCE only
//      counts while something solves toward the target; below PRO, BRAKES counts only the
//      shift; sections with no fields never count.
//   3. repairHidden: junk input, unknown keys and keys from another tier are dropped.
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
  slice('const hasBalTargetSolve=', '// rideStiffness now stores') + '\n' +
  slice('const DEF_CH=', '// ── Section visibility') + '\n' +
  slice('// ── Section visibility', '// Every preset authors damping') +
  '\nreturn{SECTION_VIS,sectionKeysOf,sectionDefaults,sectionChanged,repairHidden,DEF_CH,DEF_FE,DEF_DR,DEF_AL};'
)();
const { SECTION_VIS, sectionKeysOf, sectionDefaults, sectionChanged, repairHidden,
        DEF_CH, DEF_FE, DEF_DR, DEF_AL } = M;

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
const ok = (c, msg) => { if (!c) throw new Error(msg ?? 'expected true'); };
const st = (o = {}) => ({ ch: { ...DEF_CH, ...o.ch }, fe: { ...DEF_FE, ...o.fe },
                          dr: { ...DEF_DR, ...o.dr }, al: { ...DEF_AL, ...o.al } });
const MECH = { arbBalMode: 'mech' };

section('coverage');
t('every SECTION_KEYS section is in SECTION_VIS', () => {
  const keys = JSON.parse(slice('const SECTION_KEYS=', ';').replace('const SECTION_KEYS=', '').replace(/'/g, '"'));
  eq(keys.filter(k => !SECTION_VIS.some(s => s.key === k)), []);
});
t('every listed field exists in its DEF_* object', () => {
  const D = { ch: DEF_CH, fe: DEF_FE, dr: DEF_DR, al: DEF_AL };
  const bad = SECTION_VIS.filter(s => s.fields).flatMap(s =>
    sectionKeysOf(s.key).filter(k => !(k in D[s.fields[0]])).map(k => `${s.key}.${k}`));
  eq(bad, []);
});
t('no field is owned by two sections', () => {
  const seen = {}, dup = [];
  for (const s of SECTION_VIS) if (s.fields) for (const k of sectionKeysOf(s.key)) {
    const id = `${s.fields[0]}.${k}`; if (seen[id]) dup.push(id); seen[id] = 1;
  }
  eq(dup, []);
});
t('every Sec RESET goes through sectionDefaults', () => {
  const resets = src.match(/onReset=\{[^\n]*\}>/g) ?? [];
  ok(resets.length >= 8, `found only ${resets.length} onReset props`);
  eq(resets.filter(r => !/sectionDefaults\('\w+'\)/.test(r)), []);
});
t('sectionDefaults returns DEF values for exactly the owned keys', () => {
  eq(Object.keys(sectionDefaults('brakes')), ['brakeBiasShift', 'brakeCentre', 'brakeDecel', 'brakeEntryTarget']);
  eq(sectionDefaults('alignment'), DEF_AL);
  eq(sectionDefaults('chassis'), DEF_CH);
});

section('sectionChanged');
t('defaults: nothing changed in any section or tier', () => {
  for (const tier of ['intermediate', 'pro'])
    eq(SECTION_VIS.filter(s => sectionChanged(s.key, st(MECH), tier)).map(s => s.key), [], tier);
});
t('a change in each fielded section is seen', () => {
  ok(sectionChanged('chassis', st({ ch: { weight: 1400 } }), 'pro'), 'chassis');
  ok(sectionChanged('build', st({ dr: { buildType: 'race' } }), 'pro'), 'build');
  ok(sectionChanged('alignment', st({ al: { camberF: -3 } }), 'pro'), 'alignment');
  ok(sectionChanged('arb', st({ fe: { arbBias: 5 } }), 'pro'), 'arb');
  ok(sectionChanged('ride', st({ fe: { rideStiffness: 2.5 } }), 'pro'), 'ride');
  ok(sectionChanged('dampers', st({ fe: { dampingBias: 5 } }), 'pro'), 'dampers');
  ok(sectionChanged('drivetrain', st({ dr: { diffType: 'race' } }), 'pro'), 'drivetrain');
});
t('a change in another section does not leak', () => {
  ok(!sectionChanged('ride', st({ fe: { arbBias: 5 } }), 'pro'));
  ok(!sectionChanged('brakes', st({ dr: { diffType: 'race' } }), 'pro'));
});
t('BALANCE counts only while something solves toward the target', () => {
  const fe = { arbBalTargetMode: 'abs', arbBalAbs: 0.55 };
  ok(!sectionChanged('balance', st({ fe }), 'pro'), 'weight mode: target unused');
  ok(sectionChanged('balance', st({ fe: { ...fe, ...MECH } }), 'pro'), 'mech mode');
  ok(!sectionChanged('balance', st({ fe: { ...fe, ...MECH, arbMode: 'man' } }), 'pro'), 'manual ARBs');
  ok(sectionChanged('balance', st({ fe: { ...fe, rearHzMode: 'mech' } }), 'pro'), 'MECH rear Hz');
});
t('below PRO, BRAKES counts only the shift', () => {
  const centre = st({ dr: { brakeCentre: 'entry' } });
  ok(sectionChanged('brakes', centre, 'pro'), 'PRO sees the centre');
  ok(!sectionChanged('brakes', centre, 'intermediate'), 'INT ignores the centre');
  ok(sectionChanged('brakes', st({ dr: { brakeBiasShift: 2 } }), 'intermediate'), 'INT sees the shift');
});
t('sections with no fields never count', () => {
  for (const k of ['visuals', 'tbDna', 'tbCheck']) ok(!sectionChanged(k, st({ ch: { weight: 1 } }), 'pro'), k);
});

section('repairHidden');
t('junk input repairs to empty lists', () => {
  for (const v of [undefined, null, 5, 'x', [], { pro: 'arb' }])
    eq(repairHidden(v), { intermediate: [], pro: [] }, JSON.stringify(v));
});
t('unknown keys are dropped', () => {
  eq(repairHidden({ pro: ['arb', 'ghost'], intermediate: [] }).pro, ['arb']);
});
t('PRO-only sections are dropped from the INT list', () => {
  eq(repairHidden({ intermediate: ['balance', 'alignment', 'ride'], pro: ['balance'] }),
     { intermediate: ['ride'], pro: ['balance'] });
});
t('no beginner list is kept', () => {
  ok(!('beginner' in repairHidden({ beginner: ['arb'] })));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
