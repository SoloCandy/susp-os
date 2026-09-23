#!/usr/bin/env node
// SUSP.OS — documentation drift checks
//
// Third suite, alongside tests.js (mirrored physics) and tests-beamng.js (reads
// index.html directly). This one reads index.html AND docs/*.md and fails when a
// fact stated in prose no longer matches the code.
//
// WHY THIS EXISTS. A docs audit found ten errors. Eight were mechanical: a literal
// transcribed wrong, a list left incomplete, or a claim about what a function
// returns. Those are the ones a script catches. The two it cannot catch were
// semantic drift in a description, and nothing here pretends otherwise — this
// guards the numbers and the enumerations so review effort can go to the prose.
//
// Worst case found was one wrong claim living in three files, where a fix landed
// in one and the other two kept the error for months. Several checks below are
// completeness checks for exactly that reason: it is not enough that a doc is
// right, every doc that mentions the thing has to be right.
//
// No dependencies, no build step, no CI required — same contract as the other two
// suites. Run it by hand:  node tests-docs.js
//
// Scope note: this file deliberately does NOT check prose. It checks that names,
// ids, keys, enum values and numeric bounds agree across code and docs.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DOCS = path.join(ROOT, 'docs');

let pass = 0, fail = 0;
const failures = [];

function check(name, fn) {
  let result;
  try { result = fn(); }
  catch (e) { result = `threw: ${e.message}`; }
  if (result === true || result === undefined) { pass++; console.log(`  ✓  ${name}`); }
  else { fail++; failures.push([name, result]); console.log(`  ✗  ${name}\n       ${result}`); }
}
const section = t => console.log(`\n── ${t} ──`);

// ── source extraction ───────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcStart = html.indexOf('>', html.indexOf('<script id="app-source"')) + 1;
const SRC = html.slice(srcStart, html.indexOf('</script>', srcStart));

const docFiles = fs.readdirSync(DOCS).filter(f => f.endsWith('.md'));
const doc = {};
for (const f of docFiles) doc[f] = fs.readFileSync(path.join(DOCS, f), 'utf8');
const ALL_DOCS = Object.values(doc).join('\n');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

// Brace-matched object literal following `const NAME={`, so multi-line defaults
// parse without a JS engine. Returns the raw body text.
function objectBody(name) {
  const at = SRC.indexOf(`const ${name}={`);
  if (at < 0) throw new Error(`${name} not found in index.html`);
  let i = SRC.indexOf('{', at), depth = 0, start = i;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) return SRC.slice(start + 1, i); }
  }
  throw new Error(`unbalanced braces reading ${name}`);
}

// Top-level `key:` names only — nested object values would otherwise leak their
// own keys in (DEF_* are flat today, but this keeps the check honest if one nests).
function topLevelKeys(body) {
  const keys = [];
  let depth = 0, atStart = true, buf = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{' || c === '[' || c === '(') { depth++; atStart = false; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (depth !== 0) continue;
    if (c === ',') { atStart = true; buf = ''; continue; }
    if (c === ':' && atStart && buf.trim()) { keys.push(buf.trim()); atStart = false; buf = ''; continue; }
    if (atStart) buf += c;
  }
  return keys.filter(k => /^[A-Za-z_$][\w$]*$/.test(k));
}

const stripComments = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
// Comment-free source, computed once. Three checks below want it, and SRC is ~500KB, so
// re-running both passes per check was three identical full scans for one run.
const SRC_NC = stripComments(SRC);

// The spring-frequency band, read off the code. Two things below need it — the doc
// check and the sanitizeTune clamp resolver — and a literal copy in this file would be
// exactly the drift this suite exists to catch, one file further out. Hoisted here
// because check() bodies run as they are declared, before the later top-level statements.
const HZ_BAND = /const HZ_MIN=([\d.]+),HZ_MAX=([\d.]+)/.exec(SRC_NC);
if (!HZ_BAND) throw new Error('cannot parse HZ_MIN/HZ_MAX from index.html');

// ── codec ───────────────────────────────────────────────────────────────────
const codecBlockStart = SRC.indexOf('const CODEC_FIELDS=[');
const codecBlock = SRC.slice(codecBlockStart, SRC.indexOf('\n];', codecBlockStart));
const codecRows = [];
for (const m of stripComments(codecBlock).matchAll(/\{id:(\d+),\s*([^}]*)\}/g)) {
  const id = +m[1], rest = m[2];
  const g = /group:'(\w+)'/.exec(rest), k = /key:'(\w+)'/.exec(rest);
  const tyre = /tyre:'(\w+)'/.exec(rest), part = /part:'(\w+)'/.exec(rest);
  codecRows.push({ id, group: g && g[1], key: k && k[1], tyre: tyre && tyre[1], part: part && part[1] });
}

// Keys that legitimately have no codec id. Each MUST be justified in CODEC.md's
// excluded-fields section — the second assertion below enforces that, so this
// list cannot quietly grow into a dumping ground.
const CODEC_EXCLUDED = ['useRideHeightCG'];

section('share codec');

check('CODEC_FIELDS parsed', () =>
  codecRows.length > 50 || `only parsed ${codecRows.length} rows`);

check('every ch/fe/dr default key has a codec id or a documented exclusion', () => {
  const covered = new Set(codecRows.filter(r => r.key).map(r => `${r.group}.${r.key}`));
  // tyre sub-fields cover the two tyre strings between them
  covered.add('ch.tyreF'); covered.add('ch.tyreR');
  const missing = [];
  for (const [group, name] of [['ch', 'DEF_CH'], ['fe', 'DEF_FE'], ['dr', 'DEF_DR']])
    for (const key of topLevelKeys(stripComments(objectBody(name))))
      if (!covered.has(`${group}.${key}`) && !CODEC_EXCLUDED.includes(key))
        missing.push(`${group}.${key}`);
  return missing.length === 0 ||
    `no codec id and not in CODEC_EXCLUDED: ${missing.join(', ')}`;
});

check('every CODEC_EXCLUDED key is justified in CODEC.md', () => {
  const bad = CODEC_EXCLUDED.filter(k => !doc['CODEC.md'].includes(k));
  return bad.length === 0 || `not mentioned in CODEC.md: ${bad.join(', ')}`;
});

check('DEF_GROUPS covers every group CODEC_FIELDS references', () => {
  const declared = new Set(Object.keys(
    Object.fromEntries((SRC_NC.match(/const DEF_GROUPS=\{([^}]*)\}/)[1])
      .split(',').map(p => [p.split(':')[0].trim(), 1]))));
  const used = new Set(codecRows.filter(r => r.group).map(r => r.group));
  const orphan = [...used].filter(g => !declared.has(g));
  return orphan.length === 0 || `group(s) with no DEF_GROUPS entry: ${orphan.join(', ')}`;
});

// CODEC.md now documents two codecs. Each check reads the section it names, so the DNA table's
// ids are never weighed against CODEC_FIELDS — they are a different, deliberately separate space.
const codecSection = title => {
  const i = doc['CODEC.md'].indexOf(`## ${title}`);
  if (i < 0) throw new Error(`CODEC.md has no "## ${title}" section`);
  const j = doc['CODEC.md'].indexOf('\n## ', i + 1);
  return doc['CODEC.md'].slice(i, j < 0 ? undefined : j);
};

check('CODEC.md id table matches CODEC_FIELDS exactly', () => {
  const table = new Map();
  for (const m of codecSection('Field table').matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm))
    table.set(+m[1], `${m[2].trim()}.${m[3].trim()}`);
  const code = new Map();
  for (const r of codecRows)
    code.set(r.id, r.tyre ? `tyre ${r.tyre}.${r.part}` : `${r.group}.${r.key}`);
  const problems = [];
  for (const [id, sig] of code)
    if (!table.has(id)) problems.push(`id ${id} (${sig}) missing from CODEC.md`);
    else if (table.get(id) !== sig) problems.push(`id ${id}: code has ${sig}, doc has ${table.get(id)}`);
  for (const id of table.keys())
    if (!code.has(id)) problems.push(`id ${id} documented but not in CODEC_FIELDS`);
  return problems.length === 0 || problems.join('; ');
});

check('CODEC.md documents the DNA codec ids as the code assigns them', () => {
  const block = /const DNA_CODEC_IDS=\{([^}]*)\}/.exec(SRC);
  if (!block) return 'cannot find DNA_CODEC_IDS in index.html';
  const code = new Map();
  for (const m of block[1].matchAll(/(\w+):(\d+)/g)) code.set(+m[2], `axes.${m[1]}`);
  const sec = codecSection('The DNA codec — a second, separate code');
  const table = new Map();
  for (const m of sec.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`/gm)) table.set(+m[1], m[2]);
  const problems = [];
  for (const [id, sig] of code)
    if (table.get(id) !== sig) problems.push(`DNA id ${id}: code has ${sig}, doc has ${table.get(id) ?? 'nothing'}`);
  const num = (re, what) => {
    const m = re.exec(SRC);
    if (!m) problems.push(`cannot find ${what} in index.html`);
    return m && m[1];
  };
  const slack = num(/const DNA_CODEC_SLACK=(\d+)/, 'DNA_CODEC_SLACK');
  if (slack && !sec.includes(`(${slack})`)) problems.push(`doc does not state the slack offset ${slack}`);
  const prefix = /const DNA_CODE_PREFIX='([^']+)'/.exec(SRC);
  if (prefix && !sec.includes(`\`${prefix[1]}\``)) problems.push(`doc does not state the prefix ${prefix[1]}`);
  return problems.length === 0 || problems.join('; ');
});

check('CODEC.md "next available id" is max+1', () => {
  const stated = /Next available id:\s*(\d+)/.exec(doc['CODEC.md']);
  if (!stated) return 'no "Next available id" line in CODEC.md';
  const expected = Math.max(...codecRows.map(r => r.id)) + 1;
  return +stated[1] === expected || `doc says ${stated[1]}, highest id is ${expected - 1}`;
});

// ── enums ───────────────────────────────────────────────────────────────────
section('enum values');

const enums = [];
for (const m of SRC_NC.matchAll(/const (\w+_DEC)=\[([^\]]*)\]/g)) {
  const values = [...m[2].matchAll(/'([^']*)'/g)].map(v => v[1]);
  enums.push({ name: m[1], values });
}

check('at least the known decoder tables were found', () =>
  enums.length >= 8 || `only found ${enums.length} *_DEC arrays`);

check('every encoder index round-trips through its decoder array', () => {
  // THE codec invariant. CODEC.md: "Renumbering GAME_MODE_DEC would silently
  // reinterpret every code already in circulation. Append only." Nothing enforced
  // that until now — a reordered DEC array breaks every share code ever issued and
  // fails silently, because both halves still parse and both still look sane.
  //
  // Direction matters: every ENC key must sit at its own index in DEC, but NOT the
  // reverse. ARB_MODE_DEC deliberately carries 'auto' twice, at 0 and at 3, so a
  // retired 'balance' value decodes to 'auto' instead of throwing. That asymmetry
  // is the design, so the check only walks ENC → DEC.
  const problems = [];
  for (const m of SRC_NC.matchAll(/const (\w+)_ENC=\{([^}]*)\}/g)) {
    const base = m[1];
    const dec = enums.find(e => e.name === `${base}_DEC`);
    if (!dec) { problems.push(`${base}_ENC has no matching ${base}_DEC`); continue; }
    for (const pair of m[2].matchAll(/'?([\w]+)'?\s*:\s*(\d+)/g)) {
      const [, key, idx] = pair;
      if (dec.values[+idx] !== key)
        problems.push(`${base}: ENC ${key}=${idx} but DEC[${idx}] is '${dec.values[+idx]}'`);
    }
  }
  return problems.length === 0 || problems.join('; ');
});

check("every decoder value is listed at its own index in CODEC.md's registry", () => {
  // Catches a newly appended enum value that no doc enumerates — the failure that
  // let the invisible 'manual' balance mode go undocumented in the one file whose
  // stated job is that no enum position is ever lost.
  //
  // Checked against that array's OWN registry row, index and value together. Two
  // weaker versions were tried and rejected. A bare \b word match over all of docs/
  // was green either way: 12 of these values are ordinary English (drift, ratio,
  // roll, share, drag, independent) or saturate prose (front, rear, manual), so
  // they matched any doc merely discussing the subject — including 'manual', the
  // case the paragraph above cites, which means the check could never have caught
  // the bug it was written for. Searching all of docs/ for a quoted literal was
  // better but still not per-array: appending 'manual' to DAMP_BAL_MODE_DEC passed
  // on ALIGN_MODE_DEC's documentation of its own, unrelated 'manual'.
  //
  // Pinning the index too means this now also guards against a REORDERED array,
  // which is the codec's cardinal sin — every share code in circulation stores the
  // index, never the string.
  const esc = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = new Map();
  for (const m of doc['CODEC.md'].matchAll(/^\|\s*`(\w+_DEC)`\s*\|([^|]*)\|/gm))
    rows.set(m[1], m[2]);
  const problems = [];
  for (const { name, values } of enums) {
    const row = rows.get(name);
    if (row === undefined) { problems.push(`${name}: no row in CODEC.md's index registry`); continue; }
    values.forEach((v, i) => {
      if (!v) return;
      if (!new RegExp(`(^|[^\\d])${i}\\s+\`${esc(v)}\``).test(row))
        problems.push(`${name}[${i}] '${v}' not listed at that index`);
    });
  }
  return problems.length === 0 || problems.join('; ');
});

// ── localStorage ────────────────────────────────────────────────────────────
section('localStorage keys');

// Collect every `suspos_*` string literal rather than matching call shapes. The
// first draft looked for usePersist(...) and localStorage.getItem(...) and duly
// reported suspos_garage_v1 as documented-but-gone — it is read through a local
// `rd(k)` helper, so no literal ever sits next to a getItem. That key is the most
// load-bearing legacy read in the file, and a checker whose first finding is a
// false positive on it teaches people to ignore the checker.
const storageKeys = new Set([...SRC.matchAll(/'(suspos_[\w]+)'/g)].map(m => m[1]));

check('every storage key in the code is listed in PERSISTENCE.md', () => {
  const missing = [...storageKeys].filter(k => !doc['PERSISTENCE.md'].includes(k));
  return missing.length === 0 || `undocumented: ${missing.join(', ')}`;
});

check('every suspos_ key in PERSISTENCE.md still exists in the code', () => {
  const documented = new Set([...doc['PERSISTENCE.md'].matchAll(/`(suspos_[\w]+)`/g)].map(m => m[1]));
  const stale = [...documented].filter(k => !storageKeys.has(k));
  return stale.length === 0 || `documented but gone from index.html: ${stale.join(', ')}`;
});

// ── sidebar sections ────────────────────────────────────────────────────────
section('sidebar sections and zones');

check('every open.* key used is initialised in the open useState', () => {
  // The exact shape of a real bug: ALIGNMENT rendered and toggled fine, but the
  // SECTIONS +/- buttons iterate Object.keys(open), so a key absent from the
  // initial object was skipped by expand-all until something else wrote it.
  const init = /const\[open,setOpen\]=useState\(\{([^}]*)\}\)/.exec(SRC);
  if (!init) return 'could not find the open useState initialiser';
  const declared = new Set(topLevelKeys(init[1]));
  const used = new Set();
  for (const m of SRC.matchAll(/\bopen\.(\w+)/g)) used.add(m[1]);
  for (const m of SRC.matchAll(/\btog\('(\w+)'\)/g)) used.add(m[1]);
  const missing = [...used].filter(k => !declared.has(k));
  return missing.length === 0 ||
    `used but not initialised (expand-all will skip these): ${missing.join(', ')}`;
});

check('CODE_MAP.md zone count matches the number of zone- ids', () => {
  const actual = new Set([...SRC.matchAll(/id="zone-([\w-]+)"/g)].map(m => m[1])).size;
  const stated = /There are (\d+) in the source/.exec(doc['CODE_MAP.md']);
  if (!stated) return 'CODE_MAP.md no longer states a zone count';
  return +stated[1] === actual || `doc says ${stated[1]}, source has ${actual}`;
});

check('CODE_MAP.md collapsible-section count matches the Sec call sites', () => {
  const actual = (SRC.match(/<Sec\s+title=/g) || []).length;
  const words = { six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const stated = /the (\w+) collapsible sidebar sections/.exec(doc['CODE_MAP.md']);
  if (!stated) return 'CODE_MAP.md no longer states a section count';
  const n = words[stated[1]] ?? +stated[1];
  return n === actual || `doc says ${stated[1]} (${n}), source has ${actual} <Sec> call sites`;
});

// ── game limits ─────────────────────────────────────────────────────────────
section('game limits and snap grid');

check('GAME_LIMITS ceilings appear in README and PHYSICS.md', () => {
  const block = /const GAME_LIMITS=\{([\s\S]*?)\};/.exec(SRC)[1];
  const problems = [];
  for (const m of block.matchAll(/(\w+):\{damping:(\w+),arb:(\w+)/g)) {
    const [, mode, damping, arb] = m;
    if (damping === 'null') continue; // physical mode has no ceiling to document
    for (const [label, text] of [['README.md', README], ['PHYSICS.md', doc['PHYSICS.md']]])
      if (!text.includes(arb) || !text.includes(damping))
        problems.push(`${mode} (${arb}/${damping}) not fully stated in ${label}`);
  }
  return problems.length === 0 || problems.join('; ');
});

check('PHYS_SNAP increments appear in PHYSICS.md', () => {
  const block = /const PHYS_SNAP=\{([^}]*)\}/.exec(SRC)[1];
  const missing = [...block.matchAll(/(\w+):(\d+)/g)]
    .filter(m => !doc['PHYSICS.md'].includes(m[2]))
    .map(m => `${m[1]}=${m[2]}`);
  return missing.length === 0 || `not in PHYSICS.md: ${missing.join(', ')}`;
});

check('the Hz band constants appear in SLIDERS.md and PHYSICS.md', () => {
  const m = HZ_BAND;
  const band = `${m[1]}–${m[2]}`;
  const problems = [];
  for (const [label, text] of [['SLIDERS.md', doc['SLIDERS.md']], ['PHYSICS.md', doc['PHYSICS.md']]])
    if (!text.includes(m[1]) || !text.includes(m[2])) problems.push(label);
  return problems.length === 0 || `HZ_MIN/HZ_MAX (${band}) missing from: ${problems.join(', ')}`;
});

// ── slider ranges ───────────────────────────────────────────────────────────
section('slider ranges vs sanitizeTune clamps');

// sanitizeTune's clamps are the authoritative range for a persisted field: they
// are what a decoded share code is forced into, and they are NOT always the
// slider's own min/max. Target Speed is the cautionary case — its control is
// rendered inverted, so the slider's 40-180 domain is 200-60 mph, and SLIDERS.md
// quoted the raw domain as if it were the unit for a long time.
//
// SLIDERS.md rows opt in with an invisible marker: <!--@range fe.targetSpeed-->
// Markdown renders HTML comments as nothing, so the table reads identically.
// Both ends are asserted rather than passed straight to slice(). indexOf returns -1
// when an anchor moves, and slice() reads -1 as "one before the end" instead of
// erroring — so a renamed useTwoTap would silently widen this to the whole file and
// pull in cl(...) calls from elsewhere, while the size smoke-check below still passed.
// Failing loudly here is the difference between a broken check and a lying one.
const sanStart = SRC.indexOf('const sanitizeTune=');
const sanEnd = SRC.indexOf('\nconst useTwoTap', sanStart);
if (sanStart < 0 || sanEnd < 0)
  throw new Error('cannot bound sanitizeTune in index.html: its declaration or the ' +
                  'following `const useTwoTap` anchor moved — re-anchor this slice');
const sanitize = SRC.slice(sanStart, sanEnd);
const CONSTS = { HZ_MIN: HZ_BAND[1], HZ_MAX: HZ_BAND[2] };
const clamps = new Map();
for (const m of sanitize.matchAll(/(\w+):\s*cl\((ch|fe|dr)\?\.(\w+),\s*([^,]+?),\s*([^,]+?),/g)) {
  const resolve = v => (CONSTS[v.trim()] ?? v.trim());
  clamps.set(`${m[2]}.${m[3]}`, [resolve(m[4]), resolve(m[5])]);
}

check('sanitizeTune clamps parsed', () =>
  clamps.size > 15 || `only parsed ${clamps.size} clamps`);

check('every @range-marked SLIDERS.md row states its real clamp bounds', () => {
  // Checks the RANGE CELL ONLY, not the whole row. The first draft scanned the
  // whole row and a mutation test walked straight past it: reverting the range
  // cell to the old wrong value still passed, because the row's own explanatory
  // prose mentioned the correct bounds further along. A check that reads the
  // commentary instead of the claim is worse than no check, because it reports
  // green either way.
  const norm = s => s.replace(/[−–—]/g, '-');
  const problems = [];
  for (const m of doc['SLIDERS.md'].matchAll(/<!--@range ([\w.]+)-->(.*)$/gm)) {
    const [, field, rest] = m;
    if (!clamps.has(field)) { problems.push(`${field}: marked in SLIDERS.md but no sanitizeTune clamp`); continue; }
    // Split on pipes that are not backslash-escaped: several rows carry a literal | in code spans.
    const cells = rest.split(/(?<!\\)\|/).map(c => c.trim());
    const rangeCell = norm(cells[1] ?? '');
    const [lo, hi] = clamps.get(field);
    for (const bound of [lo, hi])
      if (!rangeCell.includes(norm(bound)))
        problems.push(`${field}: Range column reads "${cells[1]}", clamp is ${lo}..${hi}`);
  }
  return problems.length === 0 || problems.join('; ');
});

check('the fe fields most prone to range drift are all marked', () => {
  // Not every clamp needs a marker, but these are the ones a user reads off a
  // slider and a doc reader is most likely to quote. Keeping the list explicit
  // means adding a slider does not silently opt out of the check.
  const required = ['fe.targetSpeed', 'fe.reboundZeta', 'fe.bumpRatio', 'fe.bumpZeta',
    'fe.settleTarget', 'fe.arbShareMan', 'fe.arbBasicMan', 'fe.arbTargetRollMan',
    'fe.rearHzMult', 'fe.springShare', 'fe.arbBias'];
  const marked = new Set([...doc['SLIDERS.md'].matchAll(/<!--@range ([\w.]+)-->/g)].map(m => m[1]));
  const missing = required.filter(f => !marked.has(f));
  return missing.length === 0 || `unmarked in SLIDERS.md: ${missing.join(', ')}`;
});

// ── cross-doc consistency ───────────────────────────────────────────────────
section('cross-doc consistency');

// GitHub's heading-slug rules: lowercase, drop everything that is not word/space/
// hyphen, then each remaining space becomes a hyphen. Runs of spaces are NOT
// collapsed, so "RESPONSE / transient character" slugs with a double hyphen.
const slugsOf = text => new Set(
  [...text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)]
    .map(m => m[1].toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/ /g, '-')));
const DOC_SLUGS = Object.fromEntries(Object.entries(doc).map(([f, t]) => [f, slugsOf(t)]));

check('no doc link points at a file or heading that does not exist', () => {
  // The fragment is checked, not discarded. Splitting a doc is exactly when anchors
  // rot: this suite landed alongside a split that moved ~1,660 lines out of
  // KNOWN_ISSUES.md into HISTORY.md, and a filename-only check calls every pointer
  // into the moved half green, because the file it names still exists.
  const problems = [];
  const resolve = (from, file, frag) => {
    if (!doc[file]) { problems.push(`${from} → ${file} (no such file)`); return; }
    const a = frag && frag.slice(1);
    if (a && !DOC_SLUGS[file].has(a)) problems.push(`${from} → ${file}#${a} (no such heading)`);
  };
  for (const [file, text] of Object.entries(doc)) {
    for (const m of text.matchAll(/\]\(([A-Z_]+\.md)(#[\w-]*)?\)/g)) resolve(file, m[1], m[2]);
    // Same-file links carry no filename, and rot the same way.
    for (const m of text.matchAll(/\]\((#[\w-]+)\)/g)) resolve(file, file, m[1]);
  }
  for (const m of README.matchAll(/\]\(docs\/([A-Z_]+\.md)(#[\w-]*)?\)/g))
    resolve('README.md', m[1], m[2]);
  return problems.length === 0 || `broken link(s): ${problems.join(', ')}`;
});

check('every docs/*.md file is linked from the README', () => {
  const missing = docFiles.filter(f => !README.includes(`docs/${f}`));
  return missing.length === 0 || `not listed in README Documentation section: ${missing.join(', ')}`;
});

check('no doc states a hardcoded line count for index.html', () => {
  // CLAUDE.md called index.html a "~6,600-line file" while it was over 7,500 —
  // a stale number sitting in the very file that tells you not to leave stale
  // numbers around. Sizes drift every commit, so the rule is simply not to quote
  // one. CODE_MAP.md already bans line numbers for the same reason; this extends
  // it to counts, which look harmless and rot just as fast.
  const problems = [];
  const sources = { 'CLAUDE.md': fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'), 'README.md': README, ...doc };
  for (const [file, text] of Object.entries(sources))
    for (const m of text.matchAll(/([\d][\d,]{2,})[- ]line\b/g)) {
      // Allow it only when THIS CLAUSE is explicitly about the past. A ±120-char
      // window was too coarse to mean anything: any unrelated "was" nearby exempted
      // the live claim beside it, so "index.html is a 7,500-line file; the previous
      // layout was three files" passed on the strength of the second clause alone.
      // Bounded by . ! ? and ; — the semicolon matters, it is what separates those
      // two clauses — but NOT by newline, since markdown wraps mid-sentence and the
      // past-tense cue often lands on the following line.
      const before = text.slice(0, m.index), after = text.slice(m.index + m[0].length);
      const end = after.search(/[.!?;]/);
      const clause = before.slice(before.search(/[.!?;][^.!?;]*$/) + 1)
                   + m[0] + (end < 0 ? after : after.slice(0, end));
      if (/\buntil\b|\bused to\b|\bwas\b|\bwere\b|\bran to\b|\bhistor/i.test(clause)) continue;
      problems.push(`${file}: "${m[0]}"`);
    }
  return problems.length === 0 ||
    `line-count claim(s) that will go stale: ${problems.join(', ')}`;
});

check('index.html doc pointers resolve to real files', () => {
  const problems = [];
  for (const m of SRC.matchAll(/docs\/([A-Z_]+\.md)/g))
    if (!doc[m[1]]) problems.push(m[1]);
  return problems.length === 0 || `index.html points at missing doc(s): ${[...new Set(problems)].join(', ')}`;
});

// ── tutorials ───────────────────────────────────────────────────────────────
section('tutorials');

// Step titles per guide, read off the TUTORIALS object. Guide headers sit at two-space
// indent (`  beginner:[`); each title is the first quoted string after `title:`.
const TUT_GUIDES = (() => {
  const body = objectBody('TUTORIALS');
  const heads = [...body.matchAll(/^  (\w+):\[/gm)];
  const out = {};
  heads.forEach((h, i) => {
    const seg = body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.length);
    out[h[1]] = [...seg.matchAll(/title:'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'"));
  });
  return out;
})();

check('TUTORIALS.md catalogues every guide, step titles in order', () => {
  const md = doc['TUTORIALS.md'];
  if (!md) return 'docs/TUTORIALS.md missing';
  const problems = [];
  for (const [guide, titles] of Object.entries(TUT_GUIDES)) {
    const at = md.indexOf(`<!--@tutorial ${guide}-->`);
    if (at < 0) { problems.push(`no <!--@tutorial ${guide}--> table`); continue; }
    const next = md.indexOf('\n#', at);
    const seg = md.slice(at, next < 0 ? md.length : next);
    const rows = [...seg.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|/gm)].map(m => m[1]);
    if (rows.join('\n') !== titles.join('\n'))
      problems.push(`${guide}: doc [${rows.join(' / ')}] vs code [${titles.join(' / ')}]`);
  }
  return problems.length === 0 || problems.join('; ');
});

check('every tutorial focus key names a real zone- id', () => {
  const zones = new Set([...SRC.matchAll(/id="zone-([\w-]+)"/g)].map(m => m[1]));
  const bad = new Set();
  for (const m of objectBody('TUTORIALS').matchAll(/focus:\[([^\]]*)\]/g))
    for (const k of m[1].matchAll(/'([\w-]+)'/g)) if (!zones.has(k[1])) bad.add(k[1]);
  return bad.size === 0 || `focus keys with no zone: ${[...bad].join(', ')}`;
});

// ── report ──────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  for (const [name, why] of failures) console.log(`  ✗ ${name}\n      ${why}`);
  process.exit(1);
}
