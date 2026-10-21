// SUSP.OS — layout visibility tests
// Run with: node tests/tests-sections.js
// No dependencies required.
//
// LIKE tests-garage.js, THIS FILE READS index.html. SECTION_VIS is the one table that says
// which fields each sidebar section owns; RESET writes them and a hidden section's stub reads
// them. HIDE_ITEMS does the same for every single part the layout edit view can hide. A
// mirrored copy here would keep passing the day either drifted from the render.
//
// What it guards:
//   1. Coverage: every sidebar section (SECTION_KEYS) is in SECTION_VIS, and every RESET
//      goes through sectionDefaults.
//   2. sectionChanged: defaults read as unchanged; a change reads as changed; BALANCE only
//      counts while something solves toward the target; below PRO, BRAKES counts only the
//      shift; sections with no fields never count.
//   3. HIDE_ITEMS against the render: ids are unique across both tables, every <Hide id>
//      and hid= in index.html is listed, every listed id is used, and every item's fields
//      exist and belong to its own section (or to none).
//   4. hiddenChangedIn: counts a hidden control that differs from its default, honours the
//      section gates and the item's own live() mode, and ignores shown controls.
//   5. repairHidden: junk input, unknown ids and ids from another tier are dropped; the
//      stored lists from before HIDE_ITEMS (section keys, tbDna, tbCheck) still load.
//   6. Tutorial spots: every step's spot id is a HIDE_ITEMS or SPOT_MARKS id, sits in a zone
//      the step focuses, and renders in the guide's tier; every SPOT_MARKS id is drawn as a
//      data-spot literal and used; spotCss lights each id and dims only focused zones.
//      Whether a spot is on screen at a given step is the browser's to check, not this file's.
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the
// markers rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

const M = new Function(
  slice('const balTargetModeOf=', '\n') + '\n' +
  slice('const BUMP_BAL_MODE_DEC=', '\n') + '\n' +
  slice('const ownBumpBalMode=', '\n') + '\n' +
  slice('const hasBalTargetSolve=', '// rideStiffness now stores') + '\n' +
  slice('const DEF_CH=', '// ── Section visibility') + '\n' +
  slice('// ── Section visibility', '// Every preset authors damping') + '\n' +
  slice('const TUTORIALS={', '\n};') + '\n};\n' +
  '\nreturn{SECTION_VIS,HIDE_ITEMS,sectionKeysOf,sectionDefaults,sectionChanged,hiddenChangedIn,repairHidden,DEF_CH,DEF_FE,DEF_DR,DEF_AL,' +
  'SEC_ZONE,SPOT_MARKS,spotZone,spotCss,TUTORIALS};'
)();
const { SECTION_VIS, HIDE_ITEMS, sectionKeysOf, sectionDefaults, sectionChanged, hiddenChangedIn, repairHidden,
        DEF_CH, DEF_FE, DEF_DR, DEF_AL, SEC_ZONE, SPOT_MARKS, spotZone, spotCss, TUTORIALS } = M;

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
const D = { ch: DEF_CH, fe: DEF_FE, dr: DEF_DR, al: DEF_AL };

section('coverage');
t('every SECTION_KEYS section is in SECTION_VIS', () => {
  const keys = JSON.parse(slice('const SECTION_KEYS=', ';').replace('const SECTION_KEYS=', '').replace(/'/g, '"'));
  eq(keys.filter(k => !SECTION_VIS.some(s => s.key === k)), []);
});
t('every listed field exists in its DEF_* object', () => {
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
t('every Sec passes its own key to secProps', () => {
  const secs = src.match(/<Sec title="[^"]+"[^\n]*/g) ?? [];
  ok(secs.length >= 10, `found only ${secs.length} Secs`);
  const keys = secs.map(l => (l.match(/secProps\('(\w+)'\)/) ?? [])[1]);
  eq(keys.filter(k => !k || !SECTION_VIS.some(s => s.key === k)), []);
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
  ok(!sectionChanged('visuals', st({ ch: { weight: 1 } }), 'pro'), 'visuals');
});

section('HIDE_ITEMS against the render');
// Every id the render hands to Hide (id="…") or to OutRow / Card / Sec (hid="…"), plus the
// dynamic ones, which are written as quoted literals ('out.arbF') next to their call.
const literalIds = new Set([...src.matchAll(/\b(?:id|hid)="([a-zA-Z]+\.[a-zA-Z.]+|tbDna|tbCheck)"/g)].map(m => m[1]));
const tableSrc = slice('const HIDE_ITEMS=[', '\n];');
const renderSrc = src.replace(tableSrc, '');
t('ids are unique across SECTION_VIS and HIDE_ITEMS', () => {
  const all = [...SECTION_VIS.map(s => s.key), ...HIDE_ITEMS.map(i => i.id)];
  eq(all.filter((k, i) => all.indexOf(k) !== i), []);
});
t('every <Hide id> / hid= literal in the render is listed', () => {
  eq([...literalIds].filter(id => !HIDE_ITEMS.some(i => i.id === id)), []);
});
t('every HIDE_ITEMS id is used by the render', () => {
  eq(HIDE_ITEMS.map(i => i.id).filter(id => !renderSrc.includes(`"${id}"`) && !renderSrc.includes(`'${id}'`)), []);
});
t('every item names a real section, or toolbar / output / bar', () => {
  eq(HIDE_ITEMS.filter(i => !['toolbar', 'output', 'bar'].includes(i.sec) && !SECTION_VIS.some(s => s.key === i.sec))
    .map(i => i.id), []);
});
t('an item renders only in tiers its section does', () => {
  eq(HIDE_ITEMS.filter(i => i.tiers && SECTION_VIS.some(s => s.key === i.sec)
    && i.tiers.some(tier => !SECTION_VIS.find(s => s.key === i.sec).tiers.includes(tier))).map(i => i.id), []);
});
t('every item field exists, and is its own section\'s or no section\'s', () => {
  const owner = {};
  for (const s of SECTION_VIS) if (s.fields) for (const k of sectionKeysOf(s.key)) owner[`${s.fields[0]}.${k}`] = s.key;
  const bad = HIDE_ITEMS.filter(i => i.fields).flatMap(i => i.fields[1].filter(k => {
    const id = `${i.fields[0]}.${k}`;
    return !(k in D[i.fields[0]]) || (owner[id] && owner[id] !== i.sec);
  }).map(k => `${i.id}:${k}`));
  eq(bad, []);
});
t('output, bar and toolbar items carry no fields', () => {
  eq(HIDE_ITEMS.filter(i => ['toolbar', 'output', 'bar'].includes(i.sec) && i.fields).map(i => i.id), []);
});

section('hiddenChangedIn');
t('nothing hidden, or everything at its default: nothing counts', () => {
  const all = HIDE_ITEMS.map(i => i.id);
  for (const sec of SECTION_VIS.map(s => s.key)) {
    eq(hiddenChangedIn(sec, [], st({ fe: { arbBias: 9 } }), 'pro'), [], sec);
    eq(hiddenChangedIn(sec, all, st(MECH), 'pro'), [], sec + ' at defaults');
  }
});
t('a hidden control that differs is counted, a shown one is not', () => {
  const s = st({ fe: { arbBias: 9, dampingBias: 4 } });
  eq(hiddenChangedIn('arb', ['arb.bias'], s, 'intermediate'), ['arb.bias']);
  eq(hiddenChangedIn('arb', ['arb.mode'], s, 'intermediate'), []);
  eq(hiddenChangedIn('dampers', ['arb.bias'], s, 'intermediate'), [], 'wrong section');
});
t('live(): a control that only applies in another mode does not count', () => {
  const zeta = st({ fe: { reboundZeta: 90 } });
  eq(hiddenChangedIn('dampers', ['dampers.reboundZeta'], zeta, 'pro'), ['dampers.reboundZeta']);
  eq(hiddenChangedIn('dampers', ['dampers.reboundZeta'], st({ fe: { reboundZeta: 90, dampCharMode: 'settle' } }), 'pro'), []);
  const cg = { ch: { cgHeight: 0.6 } };
  eq(hiddenChangedIn('chassis', ['chassis.cgHeight'], st(cg), 'pro'), [], 'computed from ride height');
  eq(hiddenChangedIn('chassis', ['chassis.cgHeight'], st({ ch: { ...cg.ch, useRideHeightCG: false } }), 'pro'), ['chassis.cgHeight']);
});
t('section gates still apply: BALANCE and below-PRO BRAKES', () => {
  const abs = { arbBalTargetMode: 'abs', arbBalAbs: 0.55 };
  eq(hiddenChangedIn('balance', ['balance.targetAbs'], st({ fe: abs }), 'pro'), [], 'nothing solves toward it');
  eq(hiddenChangedIn('balance', ['balance.targetAbs'], st({ fe: { ...abs, ...MECH } }), 'pro'), ['balance.targetAbs']);
  eq(hiddenChangedIn('brakes', ['brakes.centre'], st({ dr: { brakeCentre: 'grip' } }), 'intermediate'), [], 'PRO-only item');
  eq(hiddenChangedIn('brakes', ['brakes.bias'], st({ dr: { brakeBiasShift: 3 } }), 'intermediate'), ['brakes.bias']);
});

section('repairHidden');
t('junk input repairs to empty lists', () => {
  for (const v of [undefined, null, 5, 'x', [], { pro: 'arb' }])
    eq(repairHidden(v), { intermediate: [], pro: [] }, JSON.stringify(v));
});
t('unknown ids are dropped, duplicates collapse', () => {
  eq(repairHidden({ pro: ['arb', 'ghost', 'arb.ghost', 'arb.bias', 'arb.bias', 7], intermediate: [] }).pro, ['arb', 'arb.bias']);
});
t('PRO-only sections and items are dropped from the INT list', () => {
  eq(repairHidden({ intermediate: ['balance', 'alignment', 'ride', 'chassis.wheelbase', 'bar.phase', 'chassis.weight'],
                    pro: ['balance', 'chassis.wheelbase'] }),
     { intermediate: ['ride', 'chassis.weight'], pro: ['balance', 'chassis.wheelbase'] });
});
t('lists stored before HIDE_ITEMS still load', () => {
  eq(repairHidden({ intermediate: ['tbDna', 'visuals'], pro: ['tbCheck', 'dampers'] }),
     { intermediate: ['tbDna', 'visuals'], pro: ['tbCheck', 'dampers'] });
});
t('no beginner list is kept', () => {
  ok(!('beginner' in repairHidden({ beginner: ['arb'] })));
});

section('tutorial spots');
const TIERS = ['beginner', 'intermediate', 'pro'];
const markIds = SPOT_MARKS.map(m => m.id);
const HIDE_IDS = HIDE_ITEMS.map(i => i.id);
// Where an id renders: an item's own tiers, else its sidebar section's, else (output, bar,
// toolbar, and every spot mark) every tier.
const tiersOf = id => {
  const it = HIDE_ITEMS.find(i => i.id === id);
  return it?.tiers ?? SECTION_VIS.find(s => s.key === it?.sec)?.tiers ?? TIERS;
};
const steps = Object.entries(TUTORIALS).flatMap(([g, list]) => list.map(s => ({ g, ...s })));
const spotted = steps.filter(s => s.spot);
t('spot marks are unique and share no id with HIDE_ITEMS or SECTION_VIS', () => {
  const all = [...SECTION_VIS.map(s => s.key), ...HIDE_IDS, ...markIds];
  eq(all.filter((k, i) => all.indexOf(k) !== i), []);
});
t('every data-spot literal is a mark, and every mark is drawn', () => {
  const drawn = new Set([...src.matchAll(/data-spot="([a-zA-Z]+\.[a-zA-Z.]+)"/g)].map(m => m[1]));
  eq([...drawn].filter(id => !markIds.includes(id)), [], 'drawn, not listed');
  eq(markIds.filter(id => !drawn.has(id)), [], 'listed, not drawn');
});
t('every spot id is a HIDE_ITEMS id or a spot mark', () => {
  eq(spotted.flatMap(s => s.spot.filter(id => !HIDE_IDS.includes(id) && !markIds.includes(id))
    .map(id => `${s.g}/${s.title}: ${id}`)), []);
});
t('every spot mark is used by some step', () => {
  eq(markIds.filter(id => !spotted.some(s => s.spot.includes(id))), []);
});
t('SEC_ZONE covers every item section, and every zone exists', () => {
  eq([...new Set(HIDE_ITEMS.map(i => i.sec))].filter(s => !SEC_ZONE[s]), [], 'unmapped sections');
  const zones = [...Object.values(SEC_ZONE), ...SPOT_MARKS.map(m => m.zone)];
  eq([...new Set(zones)].filter(z => !src.includes(`id="zone-${z}"`)), [], 'no such zone');
});
t('each spot sits in a zone its step focuses (the balance guide: the bar)', () => {
  eq(spotted.flatMap(s => s.spot.filter(id => !(s.g === 'balance' ? ['balance-bar'] : s.focus ?? []).includes(spotZone(id)))
    .map(id => `${s.g}/${s.title}: ${id} in ${spotZone(id)}`)), []);
});
t('a tier guide spots only what renders in its tier', () => {
  eq(spotted.filter(s => s.g !== 'balance').flatMap(s => s.spot.filter(id => !tiersOf(id).includes(s.g))
    .map(id => `${s.g}/${s.title}: ${id}`)), []);
});
t('every balance-guide spot list holds something every tier renders', () => {
  eq(spotted.filter(s => s.g === 'balance' && !s.spot.some(id => tiersOf(id).length === TIERS.length))
    .map(s => s.title), []);
});
t('spotCss: no spot, no stylesheet', () => {
  eq(spotCss(undefined, ['arb']), '');
  eq(spotCss([], ['arb']), '');
});
t('spotCss: lights every id and dims each focused zone, only where a spot is', () => {
  const css = spotCss(['arb.bias', 'visuals.ride'], ['arb', 'visuals']);
  for (const id of ['arb.bias', 'visuals.ride'])
    ok(css.includes(`[data-hid="${id}"]`) && css.includes(`[data-spot="${id}"]`), id);
  const dims = css.split('\n').filter(l => l.includes('opacity'));
  eq(dims.map(l => l.match(/^#zone-([\w-]+):has\(/)?.[1]), ['arb', 'visuals']);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
