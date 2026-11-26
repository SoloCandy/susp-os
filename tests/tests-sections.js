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
//   7. Tutorial resume points: titles are unique within a guide, old index saves
//      (suspos_tutorial_step_v1) convert to the same step by title, and a save whose step
//      has gone falls back to its index, clamped.
//   8. Layouts: every HIDE_ITEMS row has a panel label and valid games; repairLayouts mends
//      junk, duplicate ids and missing assignments; the first load builds INT and PRO from the
//      old per-tier lists, PERSIST on becoming held lists; HOLD's holdable ids, HOLD_DEPS and
//      holdWarnings; importLayouts adds, renames and caps; a part of
//      another game doesn't apply here; section order, start-open and chip lists repair to known
//      sections, with a missing section put back near its default place.
//   9. Hidden choices: HIDE_OPTS against the render (every data-opt sits in its control's Hide and
//      is listed, every listed control tags its buttons), choice ids' tier and game gates, and
//      VISUALS parts (VisPart) against HIDE_ITEMS.
//  10. Output order: Forza's order keys are its card ids, the render draws each from outEl once,
//      BeamNG's three rows are all drawn, and stored orders repair per family.
//  11. Output figures: OUT_FIGS keys are unique, every figure key the render writes is listed and
//      every listed one is written; AUTO drops set figures, shows solved ones and info ones unless
//      def:false; ON / OFF override it; figs repair to known keys and modes; tiers and Forza-only
//      figures gate the panel list; every Forza card draws its CardFigs line.
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
  slice('const DIFF_TYPE_DEC=', '// Community-estimated scale factors') + '\n' + // diffTypesOf, diffTypeOf
  slice('const DEF_CH=', '// ── Section visibility') + '\n' +
  slice('// ── Section visibility', '// Every preset authors damping') + '\n' +
  slice('const TUTORIALS={', '// Standalone reference') +
  '\nreturn{SECTION_VIS,HIDE_ITEMS,sectionKeysOf,sectionDefaults,sectionChanged,hiddenChangedIn,repairHidden,DEF_CH,DEF_FE,DEF_DR,' +
  'SEC_ZONE,SPOT_MARKS,spotZone,spotCss,TUTORIALS,DEF_TUT_PROGRESS,repairTutProgress,TUT_V1_TITLES,tutProgressFromV1,tutResumeStep,heldFields,holdWarnings,HOLD_DEPS,holdable,HIDE_BY_ID,' +
  'LAYOUT_GAMES,LAYOUT_MAX,LAYOUT_NAME_MAX,LAYOUT_FILE_KIND,LAYOUT_SECS,repairLayouts,legacyLayouts,importLayouts,hideIdApplies,' +
  'HIDE_OPTS,optOf,hideIdValid,OUT_ORDER_DEF,outFamily,OUT_FIGS,outFigShown,outFigApplies,repairFigs};'
)();
const { SECTION_VIS, HIDE_ITEMS, sectionKeysOf, sectionDefaults, sectionChanged, hiddenChangedIn, repairHidden,
        DEF_CH, DEF_FE, DEF_DR, SEC_ZONE, SPOT_MARKS, spotZone, spotCss, TUTORIALS,
        DEF_TUT_PROGRESS, repairTutProgress, TUT_V1_TITLES, tutProgressFromV1, tutResumeStep, heldFields, holdWarnings, HOLD_DEPS, holdable, HIDE_BY_ID,
        LAYOUT_GAMES, LAYOUT_MAX, LAYOUT_NAME_MAX, LAYOUT_FILE_KIND, LAYOUT_SECS, repairLayouts, legacyLayouts, importLayouts, hideIdApplies,
        HIDE_OPTS, optOf, hideIdValid, OUT_ORDER_DEF, outFamily, OUT_FIGS, outFigShown, outFigApplies, repairFigs } = M;

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
                          dr: { ...DEF_DR, ...o.dr } });
const MECH = { arbBalMode: 'mech' };
const D = { ch: DEF_CH, fe: DEF_FE, dr: DEF_DR };

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
  eq(Object.keys(sectionDefaults('brakes')), ['brakeStock', 'brakeBiasShift', 'brakeCentre', 'brakeDecel', 'brakeEntryTarget']);
  eq(Object.keys(sectionDefaults('alignment')).filter(k => !k.startsWith('align')), []);
  eq(sectionDefaults('alignment').alignManual, false);
  eq(sectionDefaults('chassis'), DEF_CH);
});
t('every Sec passes its own key to secProps', () => {
  const secs = src.match(/<Sec title="[^"]+"[^\n]*/g) ?? [];
  // Nine: VISUALS left the sidebar for its own column / view, so it is no longer a <Sec>.
  ok(secs.length >= 9, `found only ${secs.length} Secs`);
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
  ok(sectionChanged('alignment', st({ dr: { alignOfsToeF: -0.2 } }), 'intermediate'), 'alignment offset');
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
t('ALIGNMENT counts the MANUAL values or the offsets, whichever is in use', () => {
  ok(!sectionChanged('alignment', st({ dr: { alignManCamberF: -3 } }), 'pro'), 'MANUAL value while AUTO');
  ok(sectionChanged('alignment', st({ dr: { alignManual: true } }), 'pro'), 'MANUAL itself');
  ok(sectionChanged('alignment', st({ dr: { alignManual: true, alignManToeF: 0.5 } }), 'pro'), 'MANUAL value while MANUAL');
  ok(!sectionChanged('alignment', st({ dr: { alignManCaster: 6 } }), 'intermediate'), 'MANUAL value, AUTO in use');
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
     { intermediate: ['alignment', 'ride', 'chassis.weight'], pro: ['balance', 'chassis.wheelbase'] });
});
t('lists stored before HIDE_ITEMS still load', () => {
  eq(repairHidden({ intermediate: ['tbDna', 'visuals'], pro: ['tbCheck', 'dampers'] }),
     { intermediate: ['tbDna', 'visuals'], pro: ['tbCheck', 'dampers'] });
});
t('no beginner list is kept', () => {
  ok(!('beginner' in repairHidden({ beginner: ['arb'] })));
});

section('heldFields (HOLD)');
const NONE = { ch: [], fe: [], dr: [] };
t('nothing hidden holds nothing', () => {
  eq(heldFields([], 'pro'), NONE);
  eq(heldFields(undefined, 'pro'), NONE);
});
t('a hidden ARB section holds its own fields and its items\', MAN values included', () => {
  const h = heldFields(['arb'], 'pro');
  for (const k of ['arbMode', 'arbBias', 'arbManF', 'arbManR', 'springShareAuto']) ok(h.fe.includes(k), k);
  eq([h.ch, h.dr], [[], []]);
});
t('a hidden item holds exactly its fields', () => {
  eq(heldFields(['brakes.bias'], 'intermediate'), { ...NONE, dr: ['brakeBiasShift'] });
  eq(heldFields(['chassis.tyres'], 'pro'), { ...NONE, ch: ['tyreF', 'tyreR'] });
});
t('output, bar, toolbar and VISUALS parts hold nothing', () => {
  eq(heldFields(['out.card.arb', 'out.arbF', 'bar.stack', 'tbDna', 'visuals', 'visuals.ride'], 'pro'), NONE);
});
t('a hidden section holds its PRO-only items\' extra fields only in PRO', () => {
  // springShareAuto belongs to no section's RESET, only to PRO's arb.springShare item.
  ok(heldFields(['arb'], 'pro').fe.includes('springShareAuto'), 'PRO');
  ok(!heldFields(['arb'], 'intermediate').fe.includes('springShareAuto'), 'INT');
});
t('keys are listed once', () => {
  eq(heldFields(['align.mode', 'align.ofsToeF', 'alignment'], 'pro').dr.filter(k => k === 'alignManual' || k === 'alignOfsToeF').length, 2);
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
  // data-spot="…" on an element, or spot="…" on a MenuItem / MenuButton, which draws it as data-spot.
  const drawn = new Set([...src.matchAll(/(?:data-spot|\bspot)="([a-zA-Z]+\.[a-zA-Z.]+)"/g)].map(m => m[1]));
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
// The Layouts guide opens from the LAYOUT panel, which INT and PRO have.
t('a tier guide spots only what renders in its tier', () => {
  const tierOf = g => g === 'layout' ? 'intermediate' : g;
  eq(spotted.filter(s => s.g !== 'balance').flatMap(s => s.spot.filter(id => !tiersOf(id).includes(tierOf(s.g)))
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

section('tutorial resume points');
const titleAt = (m, i) => TUTORIALS[m][i]?.title;
t('step titles are unique within each guide', () => {
  for (const [g, list] of Object.entries(TUTORIALS)) {
    const ts = list.map(s => s.title);
    eq(ts.filter((x, i) => ts.indexOf(x) !== i), [], g);
  }
});
// The guide revamp merged or retired these _v1 steps (PRO's Alignment Mode had moved to INT before).
t('the _v1 titles no longer in their guide are the retired ones', () => {
  eq(Object.entries(TUT_V1_TITLES).flatMap(([m, ts]) => ts.filter(x => !TUTORIALS[m].some(s => s.title === x))
    .map(x => `${m}: ${x}`)), ['beginner: Output Toolbar', 'intermediate: Chassis', 'intermediate: Build Type',
    'intermediate: Diff Type', 'intermediate: Corner Exit & Entry', 'intermediate: VISUALS Card',
    'intermediate: Reading the Results', 'intermediate: Output Toolbar', 'intermediate: Garage',
    'intermediate: Organizing & Searching', 'intermediate: Sharing & Backup', 'pro: Calibrating Natural Balance',
    'pro: Calibrating ARB Scale', 'pro: Alignment Mode', 'pro: Output Panel & Tune Check']);
});
t('_v1 indices convert to the same step by title, or the next _v1 step still there', () => {
  // _v1 counted BEG Output Toolbar as 11, INT Ride Ref & Rear Hz as 5 and Reading the Results as
  // 13, PRO Calibrating ARB Scale as 3 and Load Transfer as 12.
  const v2 = tutProgressFromV1({ beginner: 11, intermediate: 5, pro: 12 });
  const at = (m, t) => ({ title: t, step: TUTORIALS[m].findIndex(s => s.title === t) });
  eq(v2.beginner, at('beginner', 'Saving Your Own'));
  eq(v2.intermediate, at('intermediate', 'Ride Ref & Rear Hz'));
  eq(v2.pro, at('pro', 'Load Transfer'));
  eq(tutProgressFromV1({ pro: 3 }).pro, at('pro', 'Mech Balance Target'));
  // Every INT step from Reading the Results on has gone: the last step.
  eq(tutProgressFromV1({ intermediate: 13 }).intermediate, at('intermediate', TUTORIALS.intermediate.at(-1).title));
  // PRO's Alignment Mode (6) moved to INT: resume at the next PRO step that _v1 had.
  eq(tutProgressFromV1({ pro: 6 }).pro, at('pro', 'PRO ARB Balance Modes'));
});
t('_v1 junk, zero or nothing converts to nothing to resume; too far clamps', () => {
  for (const v of [null, undefined, 'x', { beginner: 0 }, { beginner: -3, pro: 'a' }])
    eq(tutProgressFromV1(v), DEF_TUT_PROGRESS, JSON.stringify(v));
  eq(tutProgressFromV1({ pro: 999 }).pro.title, titleAt('pro', TUTORIALS.pro.length - 1));
});
t('resume finds the title wherever it moved, else the clamped index', () => {
  eq(tutResumeStep('intermediate', { title: 'Dampers', step: 3 }), TUTORIALS.intermediate.findIndex(s => s.title === 'Dampers'));
  eq(tutResumeStep('pro', { title: 'A step since removed', step: 7 }), 7);
  eq(tutResumeStep('pro', { title: 'A step since removed', step: 99 }), TUTORIALS.pro.length - 1);
  eq(tutResumeStep('beginner', null), 0);
});
t('repairTutProgress keeps well-formed saves only', () => {
  eq(repairTutProgress({ beginner: { title: 'Balance', step: 7 }, intermediate: 5, pro: { title: 3, step: 2 } }),
     { beginner: { title: 'Balance', step: 7 }, intermediate: null, pro: null });
  eq(repairTutProgress(null), DEF_TUT_PROGRESS);
});

section('layouts');
t('every HIDE_ITEMS row has a label and valid games', () => {
  eq(HIDE_ITEMS.filter(i => typeof i.label !== 'string' || !i.label.trim()).map(i => i.id), [], 'no label');
  eq(HIDE_ITEMS.filter(i => i.games && (!i.games.length || i.games.some(g => !LAYOUT_GAMES.includes(g)))).map(i => i.id), [], 'bad games');
});
t('labels are unique within a section', () => {
  const seen = new Set(), dup = [];
  for (const i of HIDE_ITEMS) { const k = i.sec + '|' + i.label + '|' + (i.tiers ?? []).join() + '|' + (i.games ?? []).join(); if (seen.has(k)) dup.push(i.id); seen.add(k); }
  eq(dup, []);
});
t('a part of another game does not apply here', () => {
  ok(hideIdApplies('out.card.springs', 'pro', 'horizon'));
  ok(!hideIdApplies('out.card.springs', 'pro', 'beamng'));
  ok(hideIdApplies('out.card.suspF', 'intermediate', 'beamng'));
  ok(!hideIdApplies('balance', 'intermediate', 'horizon'), 'PRO-only section');
  ok(hideIdApplies('arb.bias', 'intermediate', 'beamng'), 'every game');
});
t('junk repairs to an INT and a PRO layout, each tier on its own', () => {
  for (const v of [undefined, null, 5, 'x', [], { layouts: 'no' }, { layouts: [null, 3] }]) {
    const r = repairLayouts(v);
    eq(r.layouts.map(l => [l.id, l.name, l.hidden, l.held]), [['int', 'INT', [], []], ['pro', 'PRO', [], []]], JSON.stringify(v));
    eq(r.assign, { intermediate: { horizon: 'int', motorsport: 'int', beamng: 'int' }, pro: { horizon: 'pro', motorsport: 'pro', beamng: 'pro' } });
  }
});
t('repair drops unknown ids, fixes ids and names, keeps valid assignments', () => {
  const r = repairLayouts({ layouts: [
    { id: 'a', name: '  Track   day ', hidden: ['arb', 'ghost', 'arb', 7, 'out.card.suspF'], persist: true },
    { id: 'a', name: '', hidden: 'x' },
    { id: 'bad id!', name: 'x'.repeat(40) } ],
    assign: { intermediate: { horizon: 'a', beamng: 'gone' }, pro: { motorsport: 'a' } } });
  const { order, startOpen, noChip, pins, outOrder, figs, ...rest } = r.layouts[0];
  eq(rest, { id: 'a', name: 'Track day', hidden: ['arb', 'out.card.suspF'], held: ['arb'] }, 'PERSIST on: what it hid that can be held is held');
  ok(r.layouts[1].id !== 'a' && r.layouts[1].name === 'LAYOUT 2' && r.layouts[1].hidden.length === 0, 'duplicate id renewed, blank name filled');
  ok(/^[\w-]+$/.test(r.layouts[2].id) && r.layouts[2].name.length === LAYOUT_NAME_MAX, 'bad id renewed, long name cut');
  eq(r.assign.intermediate, { horizon: 'a', motorsport: 'a', beamng: 'a' }, 'no int/pro layout: falls back to the first');
  eq(r.assign.pro.motorsport, 'a');
});
t('section order, start-open and chips repair to known sections', () => {
  eq(LAYOUT_SECS, SECTION_VIS.map(s => s.key).filter(k => k !== 'visuals'), 'every sidebar section, in SECTION_VIS order');
  const r = repairLayouts({ layouts: [{ id: 'a', name: 'A', order: ['ride', 'ghost', 'chassis', 'ride', 'visuals', 7],
    startOpen: ['ride', 'ride', 'visuals', 'nope'], noChip: 'x' }] }).layouts[0];
  ok(r.order.indexOf('ride') < r.order.indexOf('chassis'), 'kept keys keep their order');
  eq(r.order.slice(0, 2), ['mine', 'ride'], 'MY CONTROLS, which has no default predecessor, goes first');
  eq([...r.order].sort(), [...LAYOUT_SECS].sort(), 'every section exactly once');
  eq(r.startOpen, ['ride']); eq(r.noChip, []);
});
t('a section missing from a stored order goes back after its default predecessor', () => {
  const without = LAYOUT_SECS.filter(k => k !== 'dampers').reverse();
  const r = repairLayouts({ layouts: [{ id: 'a', name: 'A', order: without }] }).layouts[0].order;
  eq(r.indexOf('dampers'), r.indexOf('ride') + 1);
  eq(repairLayouts({ layouts: [{ id: 'a', name: 'A', order: ['brakes'] }] }).layouts[0].order.slice(0, 2), ['mine', 'chassis'], 'no predecessor: first');
});
t('the render draws every orderable section from secEl, once', () => {
  const map = slice('{(()=>{const secEl={', 'return sidebarOrder.map(');
  const keys = [...map.matchAll(/^ {10}(\w+):<>$/gm)].map(m => m[1]);
  eq(keys, LAYOUT_SECS, 'secEl keys, in default order');
  for (const k of LAYOUT_SECS) {
    const z = SEC_ZONE[k], i = map.indexOf(`\n          ${k}:<>`), j = map.indexOf('\n          </>,', i);
    ok(map.slice(i, j).includes(`id="zone-${z}"`), `${k}'s block holds zone-${z}`);
  }
});
t('junk order repairs to the default', () => {
  for (const o of [undefined, null, 'x', [], [1, 2]])
    eq(repairLayouts({ layouts: [{ id: 'a', name: 'A', order: o }] }).layouts[0].order, LAYOUT_SECS, JSON.stringify(o));
});
t('pins keep sidebar controls only, once each, in order', () => {
  const r = repairLayouts({ layouts: [{ id: 'a', name: 'A',
    pins: ['arb.bias', 'out.card.springs', 'tbDna', 'visuals.ride', 'bar.stack', 'arb', 'ghost', 'ride.ref', 'arb.bias', 3] }] }).layouts[0];
  eq(r.pins, ['arb.bias', 'ride.ref']);
  eq(repairLayouts({ layouts: [{ id: 'a', name: 'A', pins: 'x' }] }).layouts[0].pins, []);
});
t('a PERSIST-on layout migrates to held, less its pins; a stored held list wins', () => {
  const r = repairLayouts({ layouts: [
    { id: 'a', name: 'A', persist: true, hidden: ['arb', 'arb.bias', 'out.card.arb', 'visuals', 'tbDna', 'arb.mode:man', 'mine'], pins: ['arb.bias'] },
    { id: 'b', name: 'B', persist: false, hidden: ['arb'] },
    { id: 'c', name: 'C', persist: true, hidden: ['arb'], held: ['brakes.bias', 'ghost', 'out.arbF', 'brakes.bias', 'mine', 'dampers.table'] }] }).layouts;
  eq(r[0].held, ['arb'], 'pins, output, VISUALS, ⋯ items, choices and MY CONTROLS are not held');
  eq(r[1].held, []);
  eq(r[2].held, ['brakes.bias'], 'read-outs with no setting are not holdable');
  ok(r.every(l => !('persist' in l)), 'the switch is dropped');
});
t('holdWarnings names a held, kept control whose mode the commit changed', () => {
  const kept = new Set(['fe.dampingBias']);
  const changed = new Map([['fe.dampBalMode', ['sync', 'standard']], ['fe.arbMode', ['auto', 'man']]]);
  eq(holdWarnings(['dampers.bias'], 'pro', kept, changed), [{ id: 'dampers.bias', dep: 'dampers.balMode', from: 'TIME SYNC', to: 'STANDARD' }]);
  eq(holdWarnings(['dampers'], 'pro', kept, changed).map(w => w.id), ['dampers.bias'], 'held with its section');
  eq(holdWarnings(['dampers.bias'], 'pro', new Set(), changed), [], 'not kept (the load agreed): no warning');
  eq(holdWarnings(['dampers.bias'], 'pro', kept, new Map()), [], 'mode unchanged');
  eq(holdWarnings(['align.ofsToeF'], 'pro', new Set(['dr.alignOfsToeF']), new Map([['dr.alignManual', [false, true]]]))[0],
     { id: 'align.ofsToeF', dep: 'align.mode', from: 'AUTO', to: 'MANUAL' }, 'an on/off mode in words');
});
t('every HOLD_DEPS entry joins holdable controls to a mode with fields', () => {
  for (const [id, deps] of Object.entries(HOLD_DEPS)) {
    ok(holdable(id), id + ' holdable');
    for (const d of deps) ok(HIDE_BY_ID[d]?.fields && HIDE_BY_ID[d].sec === HIDE_BY_ID[id].sec, `${id} → ${d}`);
  }
  ok(!holdable('mine') && holdable('dampers') && !holdable('dampers.table') && !holdable('out.arbF'));
});
t('a hidden section whose only change is a pinned control leaves no stub', () => {
  const s = st({ fe: { arbBias: 9 } });
  ok(sectionChanged('arb', s, 'pro'));
  ok(!sectionChanged('arb', s, 'pro', ['arb.bias']));
  ok(sectionChanged('arb', st({ fe: { arbBias: 9, arbMode: 'man' } }), 'pro', ['arb.bias']), 'another change still counts');
});
t('MY CONTROLS is an empty section: no fields, no parts, never changed', () => {
  const m = SECTION_VIS.find(s => s.key === 'mine');
  ok(m && m.fields === null && LAYOUT_SECS[0] === 'mine');
  eq(HIDE_ITEMS.filter(i => i.sec === 'mine'), []);
  ok(!sectionChanged('mine', st({ fe: { arbBias: 9 } }), 'pro'));
});
t('repair caps the number of layouts', () => {
  const many = Array.from({ length: LAYOUT_MAX + 5 }, (_, i) => ({ id: 'l' + i, name: 'L' + i }));
  eq(repairLayouts({ layouts: many }).layouts.length, LAYOUT_MAX);
});
t('first load: the old per-tier lists and PERSIST become INT and PRO', () => {
  const store = { suspos_hidden_v1: JSON.stringify({ intermediate: ['brakes', 'balance'], pro: ['arb.mode'] }), suspos_persist_v1: 'true' };
  global.localStorage = { getItem: k => store[k] ?? null };
  try {
    const r = legacyLayouts();
    eq(r.layouts.map(({ id, name, hidden, held }) => ({ id, name, hidden, held })),
       [{ id: 'int', name: 'INT', hidden: ['brakes'], held: ['brakes'] }, { id: 'pro', name: 'PRO', hidden: ['arb.mode'], held: ['arb.mode'] }]);
    eq(r.layouts[0].order, LAYOUT_SECS, 'default order'); eq([r.layouts[0].startOpen, r.layouts[0].noChip], [[], []]);
    eq(r.assign.intermediate.beamng, 'int'); eq(r.assign.pro.horizon, 'pro');
    global.localStorage = { getItem: () => null };
    eq(legacyLayouts().layouts.map(l => l.hidden.length + ':' + l.held.length), ['0:0', '0:0'], 'nothing stored');
    global.localStorage = { getItem: () => '{not json' };
    eq(legacyLayouts().layouts.length, 2, 'unreadable storage');
  } finally { delete global.localStorage; }
});
t('import adds layouts under new ids, renames clashes, rejects other files', () => {
  const base = repairLayouts(undefined);
  eq(importLayouts(base, { foo: 1 }).err, 'Not a SUSP.OS layouts file.');
  eq(importLayouts(base, null).err, 'Not a SUSP.OS layouts file.');
  eq(typeof importLayouts(base, { kind: LAYOUT_FILE_KIND, layouts: [] }).err, 'string', 'empty file');
  const r = importLayouts(base, { kind: LAYOUT_FILE_KIND, version: 1, layouts: [{ id: 'int', name: 'INT', hidden: ['arb', 'ghost'] }, { name: 'Rally' }] });
  eq(r.n, 2);
  eq(r.store.layouts.map(l => l.name), ['INT', 'PRO', 'INT (2)', 'Rally']);
  ok(r.store.layouts[2].id !== 'int', 'new id');
  eq(r.store.layouts[2].hidden, ['arb']);
  eq(r.store.assign, base.assign, 'assigns nothing');
});
t('import stops at the cap', () => {
  const full = repairLayouts({ layouts: Array.from({ length: LAYOUT_MAX }, (_, i) => ({ id: 'l' + i, name: 'L' + i })) });
  ok(/already have/.test(importLayouts(full, { kind: LAYOUT_FILE_KIND, layouts: [{ name: 'X' }] }).err));
  const one = repairLayouts({ layouts: Array.from({ length: LAYOUT_MAX - 1 }, (_, i) => ({ id: 'l' + i, name: 'L' + i })) });
  const r = importLayouts(one, { kind: LAYOUT_FILE_KIND, layouts: [{ name: 'X' }, { name: 'Y' }] });
  eq([r.n, r.skipped, r.store.layouts.length], [1, 1, LAYOUT_MAX]);
});

section('hidden choices and VISUALS parts');
t('HIDE_OPTS: every control is a HIDE_ITEMS row; values unique; gates valid', () => {
  for (const [id, os] of Object.entries(HIDE_OPTS)) {
    ok(HIDE_ITEMS.some(i => i.id === id), id + ' is not a HIDE_ITEMS id');
    eq(new Set(os.map(o => o[0])).size, os.length, id + ' duplicate value');
    for (const o of os) {
      ok(typeof o[1] === 'string' && o[1].trim(), `${id}:${o[0]} label`);
      ok(!String(o[0]).includes(':'), `${id}:${o[0]} value holds a colon`);
      for (const t of o[2]?.tiers ?? []) ok(['intermediate', 'pro'].includes(t), `${id}:${o[0]} tier ${t}`);
      for (const g of o[2]?.games ?? []) ok(LAYOUT_GAMES.includes(g), `${id}:${o[0]} game ${g}`);
    }
  }
});
t('every data-opt in the render sits in a listed control, with a listed value', () => {
  const bad = [];
  for (const m of src.matchAll(/<Hide id="([^"]+)"/g)) {
    const end = src.indexOf('</Hide>', m.index), blk = src.slice(m.index, end);
    const lits = [...blk.matchAll(/data-opt="([^"]+)"/g)].map(x => x[1]);
    const dyn = /data-opt=\{/.test(blk) || /<Toggle\b/.test(blk);
    if (!lits.length && !dyn) continue;
    if (!HIDE_OPTS[m[1]]) { bad.push(m[1] + ' tags choices but has no HIDE_OPTS row'); continue; }
    for (const v of lits) if (!HIDE_OPTS[m[1]].some(o => o[0] === v)) bad.push(`${m[1]}:${v} not listed`);
  }
  for (const id of Object.keys(HIDE_OPTS)) {
    const i = src.indexOf(`<Hide id="${id}"`), blk = src.slice(i, src.indexOf('</Hide>', i));
    if (i < 0 || !/data-opt[={]|<Toggle\b/.test(blk)) bad.push(id + ' lists choices but tags none');
  }
  eq(bad, []);
});
t('choice ids follow their control and their own gates', () => {
  eq(optOf('arb.balMode:mech'), { ctrl: 'arb.balMode', value: 'mech', label: 'MECH', tiers: ['pro'], games: undefined });
  eq(optOf('arb.balMode:nope'), null); eq(optOf('arb.bias'), null);
  ok(hideIdValid('arb.balMode:mech', 'pro') && !hideIdValid('arb.balMode:mech', 'intermediate'), 'PRO-only choice');
  ok(hideIdValid('arb.balMode:weight', 'intermediate'));
  ok(!hideIdValid('brakes.centre:grip', 'intermediate'), 'its control is PRO-only');
  ok(hideIdApplies('arb.mode:basic', 'pro', 'horizon') && !hideIdApplies('arb.mode:basic', 'pro', 'beamng'), 'Forza-only choice');
  ok(!hideIdApplies('drive.diffType:sport', 'pro', 'motorsport'), 'its control is Horizon-only');
});
t('layouts keep choice ids and drop unknown ones', () => {
  eq(repairLayouts({ layouts: [{ id: 'a', name: 'A', hidden: ['arb.balMode:mech', 'arb.balMode:ghost', 'ghost:mech'] }] }).layouts[0].hidden,
     ['arb.balMode:mech']);
});
t('every VisPart id is a three-part visuals row, and every such row is drawn', () => {
  const drawn = new Set([...src.matchAll(/<VisPart id="([^"]+)"/g)].map(m => m[1]));
  const rows = HIDE_ITEMS.filter(i => i.sec === 'visuals' && i.id.split('.').length === 3).map(i => i.id);
  eq([...drawn].filter(id => !rows.includes(id)), [], 'drawn but not listed');
  eq(rows.filter(id => !drawn.has(id)), [], 'listed but not drawn');
  for (const id of rows) ok(HIDE_ITEMS.some(i => i.id === id.split('.').slice(0, 2).join('.')), id + ' has no group row');
});

section('output order');
t('Forza order keys are Forza card ids; the render draws each from outEl once', () => {
  for (const k of OUT_ORDER_DEF.forza) ok(HIDE_ITEMS.some(i => i.id === k && i.sec === 'output'), k);
  const map = slice('{(()=>{const outEl={', 'return outOrder.forza.map(');
  eq([...map.matchAll(/^ {10}'([\w.]+)':<>$/gm)].map(m => m[1]), OUT_ORDER_DEF.forza);
  for (const k of OUT_ORDER_DEF.forza) {
    const i = map.indexOf(`\n          '${k}':<>`), j = map.indexOf('\n          </>,', i);
    ok(map.slice(i, j).includes(`<Card hid="${k}"`), `${k}'s block holds its card`);
  }
});
t('BeamNG rows: every key is drawn by the grid', () => {
  const grid = slice('{outOrder.beamng.map(', '</BeamngGrid>');
  const drawn = [...grid.matchAll(/k==='(bng\.\w+)'/g)].map(m => m[1]);
  eq(OUT_ORDER_DEF.beamng.filter(k => !drawn.includes(k)).length, 1, 'all but the last are named; the last is the else');
  ok(grid.includes('frontAlign') && grid.includes('rearAlign'), 'the else is the alignment row');
});
t('stored output orders repair per family', () => {
  const r = repairLayouts({ layouts: [{ id: 'a', name: 'A', outOrder: { forza: ['out.card.diff', 'ghost', 'out.card.align', 'out.card.diff'], beamng: 'x' } }] }).layouts[0];
  eq(r.outOrder.forza[0], 'out.card.diff'); eq([...r.outOrder.forza].sort(), [...OUT_ORDER_DEF.forza].sort());
  eq(r.outOrder.beamng, OUT_ORDER_DEF.beamng);
  eq(repairLayouts(undefined).layouts[0].outOrder, OUT_ORDER_DEF);
  eq([outFamily('horizon'), outFamily('motorsport'), outFamily('beamng')], ['forza', 'forza', 'beamng']);
});

section('output figures');
t('every figure key the render writes is in OUT_FIGS, and every listed key is written', () => {
  const keys = OUT_FIGS.map(f => f.k);
  eq(keys.length, new Set(keys).size, 'keys are unique');
  const reg = slice('const OUT_FIGS=[', '];');
  const rest = src.replace(reg, '');
  const used = new Set([...rest.matchAll(/\{k:'([a-z]+\.[a-z]+)'/g)].map(m => m[1]));
  // bal() and the ARB_FIG table pass keys as arguments: count those literals too.
  for (const m of rest.matchAll(/bal\('([a-z]+\.[a-z]+)'/g)) used.add(m[1]);
  for (const m of slice('const ARB_FIG=[', '];').matchAll(/'([a-z]+\.[a-z]+)'/g)) used.add(m[1]);
  eq([...used].filter(k => !keys.includes(k)), [], 'written but not listed');
  eq(keys.filter(k => !used.has(k)), [], 'listed but never written');
});
t('AUTO drops set figures, shows solved ones and info ones unless def:false; ON / OFF override', () => {
  eq(outFigShown(undefined, 'spr.hz', 'set'), false);
  eq(outFigShown(undefined, 'spr.hz', 'solved'), true);
  eq(outFigShown(undefined, 'spr.roll', 'info'), true);
  eq(outFigShown(undefined, 'spr.sag', 'info'), false, 'def:false');
  eq(outFigShown('always', 'spr.hz', 'set'), true);
  eq(outFigShown('never', 'spr.hz', 'solved'), false);
});
t('figs repair to known keys and modes; a layout without them gets {}', () => {
  eq(repairFigs({ 'spr.hz': 'always', 'spr.sag': 'never', ghost: 'always', 'dmp.zeta': 'auto', 'arb.roll': 1 }), { 'spr.hz': 'always', 'spr.sag': 'never' });
  eq(repairFigs(['spr.hz']), {}); eq(repairFigs(null), {});
  const r = repairLayouts({ layouts: [{ id: 'a', name: 'A', figs: { 'spr.ratio': 'never', x: 'always' } }, { id: 'b', name: 'B' }] }).layouts;
  eq(r[0].figs, { 'spr.ratio': 'never' }); eq(r[1].figs, {});
});
t('the panel lists a figure only in its tiers, and Forza-only ones not for BeamNG', () => {
  ok(!outFigApplies('brk.grip', 'intermediate', 'horizon') && outFigApplies('brk.grip', 'pro', 'horizon'), 'GRIP is PRO');
  ok(outFigApplies('spr.bal', 'pro', 'motorsport') && !outFigApplies('spr.bal', 'pro', 'beamng'), 'card lines are Forza');
  ok(outFigApplies('spr.hz', 'intermediate', 'beamng'), 'row figures reach BeamNG');
  ok(!outFigApplies('ghost', 'pro', 'horizon'));
  for (const f of OUT_FIGS) ok(['springs', 'arb', 'dampers', 'align', 'brakes', 'diff'].includes(f.card), f.k + ' card');
});
t('every Forza card draws its CardFigs line from cardFigs', () => {
  const map = slice('{(()=>{const outEl={', 'return outOrder.forza.map(');
  const names = { 'out.card.align': 'align', 'out.card.arb': 'arb', 'out.card.springs': 'springs', 'out.card.dampers': 'dampers', 'out.card.brakes': 'brakes', 'out.card.diff': 'diff' };
  for (const [k, c] of Object.entries(names)) {
    const i = map.indexOf(`\n          '${k}':<>`), j = map.indexOf('\n          </>,', i);
    ok(map.slice(i, j).includes(`<CardFigs figs={cardFigs.${c}}/>`), k);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
