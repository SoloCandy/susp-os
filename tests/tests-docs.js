#!/usr/bin/env node
// SUSP.OS — documentation drift checks
//
// Third suite, alongside tests.js (mirrored physics, cross-checked against index.html) and
// tests-beamng.js (reads index.html directly). This one reads index.html AND docs/*.md and fails when a
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
// suites. Run it by hand:  node tests/tests-docs.js
//
// Scope note: this file deliberately does NOT judge prose. It checks that names,
// ids, keys, enum values and numeric bounds agree across code and docs, and that UI
// text a doc quotes word for word (HINTS.md, TUTORIALS.md's Step text) still matches
// the code exactly — see "hint and tutorial text".

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

// String-aware bracket matching. objectBody's plain brace count is fine for the DEF_*
// tables, but prose-heavy literals (GLOSSARY definitions, hint ternaries) carry their own
// brackets — "[INT] …", "(0.50 = even)" — and template literals nest `${…}`. `s[i]` must be
// an opening quote / bracket; returns the index just past the string / of the closer.
function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; }
    if (q === '`' && c === '$' && s[i + 1] === '{') { i = matchClose(s, i + 1); continue; }
    if (c === q) return i + 1;
  }
  throw new Error(`unterminated ${q} string`);
}
function matchClose(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(s, i); continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) return i; }
    i++;
  }
  throw new Error('unbalanced brackets');
}

// Bracket-matched array literal following `const NAME=[`, objectBody's twin (string-aware,
// for the reason above). Returns the raw body text.
function arrayBody(name) {
  const at = SRC.indexOf(`const ${name}=[`);
  if (at < 0) throw new Error(`${name} not found in index.html`);
  const open = SRC.indexOf('[', at);
  return SRC.slice(open + 1, matchClose(SRC, open));
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
const BAL_BAND = /const BAL_TARGET_MIN=([\d.]+),BAL_TARGET_MAX=([\d.]+)/.exec(SRC_NC);
if (!BAL_BAND) throw new Error('cannot parse BAL_TARGET_MIN/BAL_TARGET_MAX from index.html');

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

// ── share parts ────────────────────────────────────────────────────────────
// tests-share.js proves the parts cover CODEC_FIELDS; this proves the DOC says the same
// thing, so a field quietly moved between parts can't leave the table behind.
const sharePartsBlock = (() => {
  const i = SRC.indexOf('const SHARE_PARTS=[');
  return SRC.slice(i, SRC.indexOf('\n];', i));
})();
const sharePartRows = [...stripComments(sharePartsBlock)
  .matchAll(/\{id:'(\w+)',group:'(\w+)',[^]*?keys:\[([^\]]*)\]/g)]
  .map(m => ({ id: m[1], group: m[2], keys: [...m[3].matchAll(/'([^']+)'/g)].map(x => x[1]) }));

check('SHARE_PARTS parsed', () =>
  sharePartRows.length >= 5 || `only parsed ${sharePartRows.length} parts`);

check('every codec field belongs to exactly one share part', () => {
  const seen = new Map();
  for (const p of sharePartRows) for (const k of p.keys) {
    const sig = `${p.group}.${k}`;
    if (seen.has(sig)) return `${sig} is in both '${seen.get(sig)}' and '${p.id}'`;
    seen.set(sig, p.id);
  }
  const missing = codecRows
    .map(r => r.tyre ? `ch.tyre${r.tyre}` : `${r.group}.${r.key}`)
    .filter(sig => !seen.has(sig));
  return missing.length === 0 || `no share part claims: ${[...new Set(missing)].join(', ')}`;
});

check('CODEC.md Parts table lists every part with its real fields', () => {
  const sec = codecSection('Parts — how a decoded code is applied');
  const problems = [];
  for (const p of sharePartRows) {
    const row = sec.split('\n').find(l => l.startsWith('|') && l.includes(`\`${p.id}\``));
    if (!row) { problems.push(`part '${p.id}' has no row in the Parts table`); continue; }
    for (const k of p.keys)
      if (!new RegExp(String.raw`\b` + k + String.raw`\b`).test(row))
        problems.push(`${p.id}: ${k} missing from its row`);
  }
  return problems.length === 0 || problems.join('; ');
});

check('CODEC.md Parts states the one-part rule', () => {
  const sec = codecSection('Parts — how a decoded code is applied');
  return /exactly one part/.test(sec) || 'the "every codec field belongs to exactly one part" rule is not stated';
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
const CONSTS = { HZ_MIN: HZ_BAND[1], HZ_MAX: HZ_BAND[2], BAL_TARGET_MIN: BAL_BAND[1], BAL_TARGET_MAX: BAL_BAND[2] };
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

// ── visuals ─────────────────────────────────────────────────────────────────
section('VISUALS');

// The DAMPING ζ track's zones are a second copy of the Rebound ζ / Bump ζ sliders' markers,
// and its Hint promises the reader they are the same thresholds. Nothing ties the two in code,
// so a marker moved on the slider would leave the track quietly describing the old scale.
// The slider block is bounded by its label and the next `readout=`, which every FeelSlider has.
const zetaSliderEdges = label => {
  const at = SRC_NC.indexOf(label);
  if (at < 0) throw new Error(`cannot find the ${label} slider`);
  const block = SRC_NC.slice(at, SRC_NC.indexOf('readout=', at));
  const mk = /markers=\{\[([\s\S]*?)\]\}/.exec(block);
  if (!mk) throw new Error(`${label} slider has no markers`);
  const range = /min=\{(\d+)\}\s*max=\{(\d+)\}/.exec(block);
  return { edges: [...mk[1].matchAll(/value:\s*(\d+)/g)].map(m => +m[1]), min: range && +range[1], max: range && +range[2] };
};
const ZETA_ZONES = (() => {
  const m = /const ZETA_ZONES=\[([^;]*)\];/.exec(SRC_NC);
  if (!m) throw new Error('cannot find ZETA_ZONES in index.html');
  return [...m[1].matchAll(/\[(\d+),(\d+),'[^']*','([^']*)'\]/g)].map(z => [+z[1], +z[2], z[3]]);
})();

check('DAMPING ζ track zones match the Rebound ζ and Bump ζ slider markers', () => {
  const inner = ZETA_ZONES.slice(1).map(z => z[0]);
  const problems = [];
  for (let i = 1; i < ZETA_ZONES.length; i++)
    if (ZETA_ZONES[i][0] !== ZETA_ZONES[i - 1][1]) problems.push(`ZETA_ZONES has a gap/overlap at ${ZETA_ZONES[i][0]}`);
  for (const label of ['}Rebound ζ<', '"Bump ζ"']) {
    const s = zetaSliderEdges(label);
    if (s.edges.join() !== inner.join())
      problems.push(`${label} markers [${s.edges}] vs track zone edges [${inner}]`);
  }
  // The track spans the Rebound slider's full range, so every reachable ζ lands on it.
  const reb = zetaSliderEdges('}Rebound ζ<');
  const track = /<VisTrack title="DAMPING ζ" lo=\{(\d+)\} hi=\{(\d+)\}/.exec(SRC_NC);
  if (!track) problems.push('cannot find the DAMPING ζ VisTrack');
  else if (+track[1] !== reb.min || +track[2] !== reb.max)
    problems.push(`track ${track[1]}–${track[2]} vs Rebound ζ slider ${reb.min}–${reb.max}`);
  if (ZETA_ZONES[0][0] !== reb.min || ZETA_ZONES.at(-1)[1] !== reb.max)
    problems.push(`ZETA_ZONES span ${ZETA_ZONES[0][0]}–${ZETA_ZONES.at(-1)[1]} vs slider ${reb.min}–${reb.max}`);
  return problems.length === 0 || problems.join('; ');
});

check('VISUALS.md states the ζ zones, the settle band and the ARB bands the code draws', () => {
  const md = doc['VISUALS.md'];
  if (!md) return 'docs/VISUALS.md missing';
  const problems = [];
  for (const [a, b, lbl] of ZETA_ZONES)
    if (!md.includes(`${a}–${b}`) || !md.includes(lbl)) problems.push(`ζ zone ${lbl} ${a}–${b}`);
  const env = /const SETTLE_ENV=([\d.]+)/.exec(SRC_NC);
  if (!env) problems.push('cannot find SETTLE_ENV');
  else if (!md.includes(`±${Math.round(+env[1] * 100)}%`)) problems.push(`settle band ±${+env[1] * 100}%`);
  const arb = /const ARB_ZONES=physical\?\[\]:\[\[Lim\*([\d.]+),Lim\*([\d.]+),[^\]]*\],\[Lim\*[\d.]+,Lim\*([\d.]+)/.exec(SRC_NC);
  const warn = /warnF=!physical&&arbF>arbLimit\*([\d.]+)/.exec(SRC_NC);
  if (!arb || !warn) problems.push('cannot parse ARB_ZONES / the ARB warn threshold');
  else {
    const pct = v => `${Math.round(+v * 100)}%`;
    for (const v of [arb[1], arb[2], arb[3], warn[1]])
      if (!md.includes(pct(v))) problems.push(`ARB threshold ${pct(v)}`);
  }
  return problems.length === 0 || `not stated in VISUALS.md: ${problems.join(', ')}`;
});

// ── glossary ────────────────────────────────────────────────────────────────
section('glossary');

// Every hint, tutorial chip and "TERMS: … ›" link resolves to a GLOSSARY id at runtime, and an
// unknown id fails soft (glossaryLabel echoes the raw id, the modal opens on nothing), so a
// renamed or deleted entry would ship as a dead link nobody sees in review. The hints were
// also trimmed so depth lives in the glossary; the length guard keeps them that way.
const TIER_RANK = { beginner: 0, intermediate: 1, pro: 2 };
const PARA_LABEL_TIER = { INT: 'intermediate', PRO: 'pro' };

// GLOSSARY is pure data, so evaluating its body is safe and exact. A throw here is itself a
// finding (the literal stopped being plain data), reported by the first check.
let GLOSSARY_ERR = null;
const GLOSSARY_BODY = arrayBody('GLOSSARY');
const GLOSSARY = (() => {
  try { return new Function(`return [${GLOSSARY_BODY}];`)(); }
  catch (e) { GLOSSARY_ERR = e.message; return []; }
})();
const GLOSSARY_ENTRIES = GLOSSARY.flatMap(g => (g.terms || []).map(t => ({ ...t, group: g.group })));
const GLOSSARY_BY_ID = new Map(GLOSSARY_ENTRIES.map(t => [t.id, t]));

check('GLOSSARY entries are well-formed: unique ids, known tiers, SEE targets exist', () => {
  if (GLOSSARY_ERR) return `GLOSSARY does not evaluate as plain data: ${GLOSSARY_ERR}`;
  const problems = [];
  // Counted on the source text, not the evaluated array: an entry that lost its id: (or a
  // duplicated key that the object literal silently collapsed) shows up only here.
  const nTerm = (GLOSSARY_BODY.match(/[{,]\s*term:/g) || []).length;
  const nId = (GLOSSARY_BODY.match(/[{,]\s*id:/g) || []).length;
  if (nTerm !== nId) problems.push(`${nTerm} term: vs ${nId} id: in the source`);
  if (nId !== GLOSSARY_ENTRIES.length) problems.push(`${nId} id: in the source vs ${GLOSSARY_ENTRIES.length} entries evaluated`);
  const seen = new Set();
  for (const g of GLOSSARY) if (!g.group || !Array.isArray(g.terms)) problems.push(`group without group/terms: ${JSON.stringify(g).slice(0, 60)}`);
  for (const t of GLOSSARY_ENTRIES) {
    if (typeof t.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id)) problems.push(`bad id ${JSON.stringify(t.id)}`);
    if (seen.has(t.id)) problems.push(`duplicate id ${t.id}`);
    seen.add(t.id);
    if (typeof t.term !== 'string' || !t.term) problems.push(`${t.id}: no term`);
    if (typeof t.def !== 'string' || !t.def) problems.push(`${t.id}: no def`);
    if (!(t.tier in TIER_RANK)) problems.push(`${t.id}: tier ${JSON.stringify(t.tier)}`);
    for (const s of t.see || []) {
      if (!GLOSSARY_BY_ID.has(s)) problems.push(`${t.id}: SEE ${s} does not exist`);
      if (s === t.id) problems.push(`${t.id}: SEE points at itself`);
    }
  }
  return problems.length === 0 || problems.join('; ');
});

// "[INT] " / "[PRO] " open a paragraph written for a higher tier than the entry's own. A label
// at or below the entry's tier is noise (every reader of that entry already has it), and on the
// first paragraph it would leave the entry with no text for its own tier.
check('GLOSSARY [INT]/[PRO] paragraph labels sit above the entry\'s tier, never first', () => {
  const problems = [];
  for (const t of GLOSSARY_ENTRIES) {
    (t.def || '').split('\n\n').forEach((p, i) => {
      const m = /^\[([A-Z]+)\]/.exec(p);
      if (!m) return;
      const tier = PARA_LABEL_TIER[m[1]];
      if (!tier) problems.push(`${t.id}: unknown label [${m[1]}]`);
      else if (i === 0) problems.push(`${t.id}: [${m[1]}] on the first paragraph`);
      else if (TIER_RANK[tier] <= TIER_RANK[t.tier]) problems.push(`${t.id} (${t.tier}): [${m[1]}] is not above its tier`);
      if (tier && !/^\[[A-Z]+\] \S/.test(p)) problems.push(`${t.id}: [${m[1]}] not followed by one space`);
    });
  }
  return problems.length === 0 || problems.join('; ');
});

// Tier of the reader each guide can reach. beginner / intermediate / pro run as the tutorial for
// that uiMode. balance is the Handling Balance guide: openBalTut fires from the bar's ? GUIDE
// button and on the bar's first expand, with no uiMode gate, so a BEG reader sees it. A new
// guide key fails here until someone decides its tier.
const GUIDE_TIER = { beginner: 'beginner', intermediate: 'intermediate', pro: 'pro', balance: 'beginner' };

check('tutorial TERMS chips name real glossary ids at or below the guide\'s tier', () => {
  if (GLOSSARY_ERR) return 'skipped: GLOSSARY does not evaluate (see the first glossary check)';
  const body = objectBody('TUTORIALS');
  const heads = [...body.matchAll(/^  (\w+):\[/gm)];
  const problems = [];
  let chips = 0;
  heads.forEach((h, i) => {
    const guide = h[1];
    const tier = GUIDE_TIER[guide];
    if (!tier) { problems.push(`guide ${guide} has no GUIDE_TIER entry`); return; }
    const seg = body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.length);
    for (const m of seg.matchAll(/glossary:\[([^\]]*)\]/g))
      for (const k of m[1].matchAll(/'([^']*)'/g)) {
        chips++;
        const t = GLOSSARY_BY_ID.get(k[1]);
        if (!t) problems.push(`${guide}: ${k[1]} is not a glossary id`);
        else if (TIER_RANK[t.tier] > TIER_RANK[tier]) problems.push(`${guide}: ${k[1]} is ${t.tier}`);
      }
  });
  if (chips === 0) problems.push('no glossary:[…] chips found — has the step field been renamed?');
  if (/\bterms:\s*\[/.test(body)) problems.push('a step still uses the retired terms: field');
  return problems.length === 0 || problems.join('; ');
});

// ── glossary references in code ──
// Source with comments and the GLOSSARY literal removed: glossary entries have term: keys of
// their own, and comments quote attribute syntax.
const GLOSSARY_SPAN = (() => {
  const at = SRC_NC.indexOf('const GLOSSARY=[');
  return [at, matchClose(SRC_NC, SRC_NC.indexOf('[', at)) + 1];
})();
const SRC_REFS = SRC_NC.slice(0, GLOSSARY_SPAN[0]) + SRC_NC.slice(GLOSSARY_SPAN[1]);

// The value that starts at s[i]: a quoted literal, a JSX `{…}` expression (braces dropped),
// or a bare object value / default running to the next top-level , ; } ] ).
function valueAt(s, i) {
  while (s[i] === ' ') i++;
  const c = s[i];
  if (c === "'" || c === '"' || c === '`') return { lit: true, text: s.slice(i, skipString(s, i)) };
  if (c === '{') return { lit: false, text: s.slice(i + 1, matchClose(s, i)).trim() };
  let j = i, depth = 0;
  while (j < s.length) {
    const d = s[j];
    if (d === "'" || d === '"' || d === '`') { j = skipString(s, j); continue; }
    if (d === '{' || d === '[' || d === '(') depth++;
    else if (d === '}' || d === ']' || d === ')') { if (depth === 0) break; depth--; }
    else if ((d === ',' || d === ';') && depth === 0) break;
    j++;
  }
  const text = s.slice(i, j).trim();
  return { lit: /^(['"`]).*\1$/s.test(text) && skipString(text, 0) === text.length, text };
}

// Evaluated length of one literal. A `${…}` counts 4 — a number or a short word — unless the
// placeholder carries string literals of its own (`${physMode?'N/m …':'…'}`), in which case it
// counts as its longest one: that branch is text the reader sees.
const unescLen = t => t.replace(/\\(u\{[^}]*\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, 'x').length;
function literalLen(lit) {
  if (lit[0] !== '`') return unescLen(lit.slice(1, -1));
  let n = 0, chunk = '';
  for (let i = 1; i < lit.length - 1; i++) {
    const c = lit[i];
    if (c === '\\') { chunk += lit.slice(i, i + 2); i++; continue; }
    if (c === '$' && lit[i + 1] === '{') {
      const end = matchClose(lit, i + 1);
      const inner = literalsIn(lit.slice(i + 2, end)).map(l => l.len);
      n += Math.max(4, ...inner);
      i = end;
      continue;
    }
    chunk += c;
  }
  return n + unescLen(chunk);
}

// Every string literal in an expression, each with its length and whether it is a comparison
// operand (`mode==='range'`) rather than a value. Adjacent literals joined by + — with at most
// one simple operand between them, counted 4 — are measured as one string.
function literalsIn(expr) {
  const out = [];
  for (let i = 0; i < expr.length;) {
    const c = expr[i];
    if (c !== "'" && c !== '"' && c !== '`') { i++; continue; }
    const end = skipString(expr, i);
    const raw = expr.slice(i, end);
    const before = expr.slice(Math.max(0, i - 4), i), after = expr.slice(end, end + 4);
    const cmp = /[=!]==?\s*$/.test(before) || /^\s*[=!]==?/.test(after);
    const prev = out[out.length - 1];
    const gap = prev ? expr.slice(prev.end, i) : null;
    const join = !prev || prev.cmp || cmp ? null
      : /^\s*\+\s*$/.test(gap) ? 0 : /^\s*\+\s*[\w$.]+(\([^()]*\))?\s*\+\s*$/.test(gap) ? 4 : null;
    const len = literalLen(raw);
    if (join !== null) Object.assign(prev, { raw: prev.raw + ' + ' + raw, len: prev.len + join + len, end });
    else out.push({ raw, len, cmp, end });
    i = end;
  }
  return out;
}
const valueLiterals = expr => literalsIn(expr).filter(l => !l.cmp);
const litText = raw => raw.replace(/\s+/g, ' ').slice(0, 60);

// Expressions that pass a glossary id through from somewhere this check already reads, listed
// one by one so a new non-literal reference has to be looked at before it can pass.
const TERM_PASS_THROUGH = new Set([
  'hintTerm',           // term={hintTerm} / hintTerm={hintTerm}: Field, FeelSlider, VisTrack, Toggle, Card, … forward their own prop
  'term',               // term={term}: Hint forwards its prop; the RESPONSE rows forward row.term (term: keys, checked below)
  'hintTerms[name]',    // HandlingVerdict rows; every hintTerms map value is checked below
  'null',               // hintTerm=null destructured defaults; glossaryBridge.open(null) opens the index
  'id',                 // glossaryBridge.open(id): TermLink and the tutorial chips forward theirs
]);

const HINT_TERMS_MAPS = [...SRC_REFS.matchAll(/const hintTerms=\{/g)].map(m => {
  const open = m.index + m[0].length - 1;
  return new Function(`return {${SRC_REFS.slice(open + 1, matchClose(SRC_REFS, open))}};`)();
});

check('every term / hintTerm / TermLink / glossaryBridge.open id outside GLOSSARY resolves', () => {
  if (GLOSSARY_ERR) return 'skipped: GLOSSARY does not evaluate (see the first glossary check)';
  const problems = [], refs = [];
  const take = (where, v) => {
    if (v.lit) return refs.push([where, v.text.slice(1, -1)]);
    if (TERM_PASS_THROUGH.has(v.text)) return;
    const key = /^hintTerms\.(\w+)$/.exec(v.text);
    if (key) {
      const hit = HINT_TERMS_MAPS.find(mp => key[1] in mp);
      return hit ? refs.push([where, hit[key[1]]]) : problems.push(`${where}={${v.text}}: no hintTerms map has ${key[1]}`);
    }
    // A branch expression: its values are the literals that are not comparison operands.
    const lits = valueLiterals(v.text);
    if (lits.length === 0) return problems.push(`${where}={${v.text}}: not a literal and not a known pass-through`);
    for (const l of lits) refs.push([where, l.raw.slice(1, -1)]);
  };
  for (const m of SRC_REFS.matchAll(/(?<![\w-])(term|hintTerm)=/g)) take(m[1], valueAt(SRC_REFS, m.index + m[0].length));
  for (const m of SRC_REFS.matchAll(/(?<![\w-])term:/g)) take('term:', valueAt(SRC_REFS, m.index + m[0].length));
  for (const m of SRC_REFS.matchAll(/<TermLink\b([^>]*?)\/>/g)) {
    const at = m[1].search(/(?<![\w-])id=/);
    if (at < 0) { problems.push(`<TermLink${m[1]}/> has no id`); continue; }
    take('TermLink id', valueAt(m[1], at + 3));
  }
  for (const m of SRC_REFS.matchAll(/glossaryBridge\.open\(/g)) {
    const arg = valueAt(SRC_REFS, m.index + m[0].length);
    if (arg.text === 'term') continue;   // Hint forwards its own term prop (checked at each <Hint term=…>)
    take('glossaryBridge.open', arg);
  }
  HINT_TERMS_MAPS.forEach(mp => { for (const [k, v] of Object.entries(mp)) refs.push([`hintTerms.${k}`, v]); });
  if (refs.length < 20) problems.push(`only ${refs.length} literal references found — has the prop been renamed?`);
  for (const [where, id] of refs) if (!GLOSSARY_BY_ID.has(id)) problems.push(`${where} '${id}' is not a glossary id`);
  return problems.length === 0 || [...new Set(problems)].join('; ');
});

// ── hint length guard ──
// Hints were trimmed to ≤200 characters with the depth moved to the glossary; 260 leaves room
// for a ${…} that renders long without letting a paragraph creep back in. Titles are tooltips
// on buttons, so shorter.
const HINT_MAX = 260, TITLE_MAX = 160, ENVELOPE_MIN = 20;

// Over-length hints let through, keyed by their opening words. Each entry must still match a
// hint that is over the limit, so trimming one makes this list fail until the entry goes.
// Empty: every hint fits. Add an entry only with a comment saying why it can't be trimmed.
const HINT_LONG_ALLOWED = [];

// Non-literal hint values that are measured where they are written, listed explicitly.
const HINT_REFERENCES = [
  /^hint$/,                  // hint={hint} / <Hint text={hint}>: components forwarding their own prop
  /^hints\[name\]\?\?''$/,   // HandlingVerdict rows: the const hints object is measured below
  /^hints\.\w+$/,            // PhaseVerdict rows: likewise
  /^HINT_[A-Z_]+$/,          // shared hint consts, measured below
  /^[a-z]\w*Hint$/,          // suspHint / beamngAlignHint / destHint consts, measured below
  /^null$/,                  // hint=null destructured defaults
];

// Opening JSX tag enclosing s[pos]: from the last `<Name` before it to its closing `>`.
function tagAround(s, pos) {
  let at = pos;
  while (at > 0 && !(s[at] === '<' && /[A-Za-z]/.test(s[at + 1] || ''))) at--;
  let i = at + 1;
  while (i < s.length && s[i] !== '>') {
    if (s[i] === '{' ) { i = matchClose(s, i) + 1; continue; }
    if (s[i] === '"' || s[i] === "'") { i = skipString(s, i); continue; }
    i++;
  }
  return s.slice(at, i + 1);
}
// Object literal enclosing s[pos].
function objectAround(s, pos) {
  let depth = 0, at = pos;
  for (; at > 0; at--) {
    if (s[at] === '}') depth++;
    else if (s[at] === '{') { if (depth === 0) break; depth--; }
  }
  return s.slice(at, matchClose(s, at) + 1);
}

// Every measurable hint string, with whether it carries a glossary link.
const HINT_ITEMS = (() => {
  const items = [], unmeasured = [];
  const add = (where, v, linked, max = HINT_MAX) => {
    if (!v.lit && HINT_REFERENCES.some(r => r.test(v.text))) return;
    const lits = v.lit ? literalsIn(v.text) : valueLiterals(v.text);
    if (lits.length === 0) return unmeasured.push(`${where}: ${litText(v.text)}`);
    for (const l of lits) items.push({ where, len: l.len, text: litText(l.raw), linked, max });
  };
  for (const m of SRC_REFS.matchAll(/(?<![\w-])hint=/g)) {
    const v = valueAt(SRC_REFS, m.index + m[0].length);
    if (v.text === 'null') continue;
    add('hint=', v, /(?<![\w-])(hintTerm|term)=/.test(tagAround(SRC_REFS, m.index)));
  }
  for (const m of SRC_REFS.matchAll(/<Hint\s+text=/g))
    add('<Hint text>', valueAt(SRC_REFS, m.index + m[0].length), /(?<![\w-])term=/.test(tagAround(SRC_REFS, m.index)));
  for (const m of SRC_REFS.matchAll(/(?<![\w-])hint:/g))
    add('hint:', valueAt(SRC_REFS, m.index + m[0].length), /(?<![\w-])term:/.test(objectAround(SRC_REFS, m.index)));
  // const hints={…} / const tips=… bodies, and tips.push(…) in PhaseVerdict. Their links are the
  // sibling hintTerms maps (checked above) or a trailing <TermLink>, so they count as linked.
  for (const m of SRC_REFS.matchAll(/const (hints|tips)=/g)) {
    const v = valueAt(SRC_REFS, m.index + m[0].length);
    if (v.text === '[]') continue;   // PhaseVerdict's tips=[]: its strings arrive by tips.push, below
    add(`const ${m[1]}`, { lit: false, text: v.text }, true);
  }
  for (const m of SRC_REFS.matchAll(/\btips\.push\(/g)) {
    const open = m.index + m[0].length - 1;
    add('tips.push', { lit: false, text: SRC_REFS.slice(open + 1, matchClose(SRC_REFS, open)) }, true);
  }
  // Lower-case first letter: RangeHint and friends are components, not strings.
  for (const m of SRC_REFS.matchAll(/const (HINT_[A-Z_]+|[a-z]\w*Hint)=/g))
    add(`const ${m[1]}`, valueAt(SRC_REFS, m.index + m[0].length), true);
  for (const m of SRC_REFS.matchAll(/(?<![\w-])title=/g)) {
    const v = valueAt(SRC_REFS, m.index + m[0].length);
    // A title with no literal of its own (title={title}) is a label passed in from a caller
    // whose own title= is measured here; histTitle() builds from short verbs.
    if (!v.lit && valueLiterals(v.text).length === 0) continue;
    add('title=', v, true, TITLE_MAX);
  }
  return { items, unmeasured };
})();

check(`hints, tips and hint consts stay ≤ ${HINT_MAX} characters; titles ≤ ${TITLE_MAX}`, () => {
  const problems = HINT_ITEMS.unmeasured.map(u => `cannot measure ${u}`);
  if (HINT_ITEMS.items.length < 50) problems.push(`only ${HINT_ITEMS.items.length} hint strings found — has the prop been renamed?`);
  const allowedHit = new Set();
  for (const it of HINT_ITEMS.items) {
    if (it.len <= it.max) continue;
    const allow = HINT_LONG_ALLOWED.find(p => it.text.startsWith(p.slice(0, 60)));
    if (allow) { allowedHit.add(allow); continue; }
    problems.push(`${it.where} ${it.len} > ${it.max}: ${it.text}…`);
  }
  for (const p of HINT_LONG_ALLOWED)
    if (!allowedHit.has(p)) problems.push(`HINT_LONG_ALLOWED entry no longer needed: ${p}`);
  return problems.length === 0 || problems.join('; ');
});

// balanceEnvelope's details feed the FIT? badge hint, joined with the tag. Each one alone has to
// fit, and has to say something: an empty or stub detail renders as a bare tag.
check(`balanceEnvelope details are ${ENVELOPE_MIN + 1}–${HINT_MAX} characters`, () => {
  const at = SRC_REFS.indexOf('const balanceEnvelope=');
  if (at < 0) return 'balanceEnvelope not found';
  const open = SRC_REFS.indexOf('{', SRC_REFS.indexOf('=>', at));
  const body = SRC_REFS.slice(open, matchClose(SRC_REFS, open));
  const problems = [];
  let n = 0;
  for (const m of body.matchAll(/(?<![\w-])detail:/g)) {
    const lits = valueLiterals(valueAt(body, m.index + m[0].length).text);
    if (lits.length === 0) problems.push('a detail: with no literal text');
    for (const l of lits) {
      n++;
      if (l.len <= ENVELOPE_MIN || l.len > HINT_MAX) problems.push(`${l.len}: ${litText(l.raw)}`);
    }
  }
  if (n === 0) problems.push('no detail: strings found');
  return problems.length === 0 || problems.join('; ');
});

// Info only: hints that open no glossary entry. Not every hint needs one, but the list is where
// to look when a reader asks "what does this mean" and the tooltip has no TERMS link.
{
  const unlinked = HINT_ITEMS.items.filter(it => !it.linked && it.max === HINT_MAX);
  console.log(`  ·  ${unlinked.length} hint string(s) with no TERMS link (info)`);
  for (const it of unlinked) console.log(`       ${it.where} ${it.text}`);
}

// ── hint and tutorial text ──────────────────────────────────────────────────
section('hint and tutorial text');

// HINTS.md and TUTORIALS.md's Step text quote the UI word for word. These checks are the
// only ones in this file that read prose, and only to compare it character for character:
// they cannot tell whether a hint is *right*, only whether the doc still says what the app
// says. Both directions are checked — every piece of hint text in the code must be quoted
// (catches a new or reworded hint), and every quote must still be in the code (catches a
// removed one, and the JSX-text guidance the code-side scan cannot find structurally).
//
// Doc conventions the checks rely on: UI text lives in `>` blockquotes and nowhere else in
// those sections; a `{…}` placeholder stands for a value filled in live (so the quote splits
// there); `**bold**` marks a label (a glossary term) and also splits the quote.

// Normalise a JS literal body or a doc quote to comparable text: unescape, drop markdown
// bold, collapse whitespace. A `\n\n` paragraph break in a step body becomes one space, the
// same as the blank `>` line between the doc's paragraphs.
const normText = s => s.replace(/\\n/g, ' ').replace(/\\(['"`\\])/g, '$1')
  .replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// String-aware scan of a JS expression from `i`, collecting every string literal and every
// static stretch of a template literal (splitting at `${…}` and recursing into it, so nested
// ternary literals are found). Stops at an unmatched close bracket, or with stop ';' / ','
// at one of those at depth 0. Object keys ('diff front':) are skipped — they are not text.
function scanLiterals(s, i, stop, out) {
  let depth = 0;
  const prevChar = at => { let k = at - 1; while (k >= 0 && /\s/.test(s[k])) k--; return s[k]; };
  const nextChar = at => { let k = at; while (k < s.length && /\s/.test(s[k])) k++; return s[k]; };
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || c === '"') {
      let j = i + 1, b = '';
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') { b += s.slice(j, j + 2); j += 2; } else b += s[j++]; }
      const isKey = /[{,]/.test(prevChar(i) || '') && nextChar(j + 1) === ':';
      if (!isKey) out.push(b);
      i = j + 1; continue;
    }
    if (c === '`') {
      i++; let b = '';
      while (i < s.length && s[i] !== '`') {
        if (s[i] === '\\') { b += s.slice(i, i + 2); i += 2; continue; }
        if (s[i] === '$' && s[i + 1] === '{') { out.push(b); b = ''; i = scanLiterals(s, i + 2, 'close', out); continue; }
        b += s[i++];
      }
      out.push(b); i++; continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') { if (depth === 0) return i + 1; depth--; }
    else if (depth === 0 && c === stop) return i;
    i++;
  }
  return i;
}
// Prose only: at least two words, one of them a real word. Drops enum values ('rear'),
// units and format strings, which are values the doc shows as placeholders.
const proseOf = frags => frags.map(normText).filter(t => /\S\s+\S/.test(t) && /[A-Za-z]{3}/.test(t));

// Blockquote groups in a markdown segment: consecutive `>` lines (a bare `>` keeps the group
// open across a paragraph break). Returns each group's raw text.
const quoteGroups = md => {
  const groups = []; let cur = null;
  for (const line of md.split('\n')) {
    if (/^>/.test(line)) { (cur ??= []).push(line.replace(/^>\s?/, '')); }
    else if (cur) { groups.push(cur.join(' ')); cur = null; }
  }
  if (cur) groups.push(cur.join(' '));
  return groups;
};
// A quote's checkable pieces: split at placeholders and bold labels, edge punctuation
// trimmed (a term's "—" joiner), empties dropped.
const quoteFragments = q => q.split(/\{[^}]*\}|\*\*/).map(normText)
  .map(t => t.replace(/^[\s—–·:,.;-]+|[\s—–·:,;-]+$/g, '')).filter(t => t.length > 1);

// A whole quote as a pattern: its pieces in order, each `{…}` placeholder matching up to 200
// characters of source (the expression it stands for). Stricter than checking fragments one by
// one, which lets a short piece — "typical:" around two placeholders — match anywhere.
const quotePattern = q => new RegExp(q.split(/\{[^}]*\}/).map(normText).filter(Boolean)
  .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{0,200}?'));

// The app's text as one searchable string. Inline <span>s split a JSX sentence in the
// source, so they are dropped here; the doc quotes the sentence as the user reads it.
const SRC_TEXT = normText(SRC_NC.replace(/<\/?span\b[^>]*>/g, ''));

// ── code side: every hint and inline-guidance string in index.html ──
const HINT_SRC = (() => {
  const sites = [];                       // {where, frags}
  const where = at => `index.html "${SRC_NC.slice(at, at + 48).replace(/\s+/g, ' ')}…"`;
  const add = (at, frags) => { const p = proseOf(frags); if (p.length) sites.push({ where: where(at), frags: p }); };
  // hint="…" / hint={…} / <Hint text="…" / text={…}
  for (const m of SRC_NC.matchAll(/\bhint=|<Hint text=/g)) {
    const at = m.index + m[0].length, out = [];
    if (SRC_NC[at] === '"') out.push(SRC_NC.slice(at + 1, SRC_NC.indexOf('"', at + 1)));
    else if (SRC_NC[at] === '{') scanLiterals(SRC_NC, at + 1, 'close', out);
    add(m.index, out);
  }
  // hint:'…' properties (RESPONSE factor rows)
  for (const m of SRC_NC.matchAll(/[{,]\s*hint:/g)) { const out = []; scanLiterals(SRC_NC, m.index + m[0].length, ',', out); add(m.index, out); }
  // const …hint…= definitions: HINT_*, hints maps, suspHint, destHint, the Damping Bias `hint`.
  // Arrow-function components (Hint, RangeHint) are skipped — their text is JSX, checked doc-side.
  for (const m of SRC_NC.matchAll(/const (\w*hint\w*)=(?!\()/gi)) { const out = []; scanLiterals(SRC_NC, m.index + m[0].length, ';', out); add(m.index, out); }
  // Inline guidance that doesn't carry "hint" in its name. A new piece of always-visible help
  // text is not discovered on its own: add its anchor here when you write it into HINTS.md.
  const ANCHORS = [
    ['const domTips=', ';'], ['const begBal=', ';'], ['const begDiff=', ';'],   // BEG/INT balance tip
    ['const tip=', ';'],                                                        // BEG/INT and RESPONSE tip
    ['tips.push(', 'close'], ['{tips.length?', 'close'],                        // PRO phase tips
    ['const tips=uiMode', ';'],                                                 // RESPONSE tips
    ['const arbCaveat=', ';'], ['const alignPrefix=', ';'],                     // BeamNG suspension/alignment
    ['detail:', ','],                                                           // FIT? badge details
  ];
  for (const [a, stop] of ANCHORS) {
    let n = 0;
    for (let at = SRC_NC.indexOf(a); at >= 0; at = SRC_NC.indexOf(a, at + 1)) {
      const out = []; scanLiterals(SRC_NC, at + a.length, stop, out); add(at, out); n++;
    }
    if (!n) sites.push({ where: `anchor ${a}`, missing: true });
  }
  return sites;
})();

const hintsQuotes = () => {
  const md = doc['HINTS.md'];
  if (!md) throw new Error('docs/HINTS.md missing');
  return quoteGroups(md);
};

check('HINTS.md quotes every hint and inline-guidance string in index.html', () => {
  const corpus = hintsQuotes().map(normText).join('\n');
  const miss = [];
  for (const s of HINT_SRC) {
    if (s.missing) { miss.push(`${s.where} no longer matches anything — update ANCHORS`); continue; }
    for (const f of s.frags) if (!corpus.includes(f)) miss.push(`${s.where}: "${f.slice(0, 90)}${f.length > 90 ? '…' : ''}"`);
  }
  return miss.length === 0 || `${miss.length} not quoted:\n       ${miss.join('\n       ')}`;
});

check('every HINTS.md quote is still in index.html', () => {
  const miss = [];
  for (const q of hintsQuotes())
    if (!quotePattern(q).test(SRC_TEXT)) miss.push(`"${normText(q).slice(0, 90)}${q.length > 90 ? '…' : ''}"`);
  return miss.length === 0 || `${miss.length} quoted text not found:\n       ${miss.join('\n       ')}`;
});

// ── tutorials: per-step text, both ways ──
// Each step object in TUTORIALS, brace-matched string-aware, with its title and every
// piece of text it shows: body, glossary terms and definitions, and the task line.
const TUT_STEPS = (() => {
  const body = stripComments(objectBody('TUTORIALS'));
  const heads = [...body.matchAll(/^  (\w+):\[/gm)];
  const out = {};
  heads.forEach((h, gi) => {
    const seg = body.slice(h.index + h[0].length, gi + 1 < heads.length ? heads[gi + 1].index : body.length);
    const steps = [];
    for (let i = 0; i < seg.length; i++) {
      if (seg[i] !== '{') continue;
      const end = scanLiterals(seg, i + 1, 'close', []);
      const obj = seg.slice(i, end);
      const str = k => [...obj.matchAll(new RegExp(`\\b${k}:(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 'g'))].map(m => normText(m[2]));
      steps.push({ title: str('title')[0], texts: [...str('body'), ...str('term'), ...str('def'), ...str('text')] });
      i = end - 1;
    }
    out[h[1]] = steps;
  });
  return out;
})();

check('TUTORIALS.md Step text quotes every step of every guide, both ways', () => {
  const md = doc['TUTORIALS.md'];
  const problems = [];
  for (const [guide, steps] of Object.entries(TUT_STEPS)) {
    const at = md.indexOf(`<!--@steptext ${guide}-->`);
    if (at < 0) { problems.push(`no <!--@steptext ${guide}--> section`); continue; }
    const next = md.slice(at).search(/\n##{1,2} /);
    const seg = md.slice(at, next < 0 ? md.length : at + next);
    const blocks = seg.split(/\n#### /).slice(1).map(b => {
      const nl = b.indexOf('\n');
      return { head: b.slice(0, nl < 0 ? b.length : nl), quotes: quoteGroups(b) };
    });
    const heads = blocks.map(b => b.head.replace(/^\d+\.\s*/, ''));
    const titles = steps.map(s => s.title);
    if (heads.join('\n') !== titles.join('\n')) {
      problems.push(`${guide}: headings [${heads.join(' / ')}] vs code [${titles.join(' / ')}]`);
      continue;
    }
    steps.forEach((s, i) => {
      const docText = blocks[i].quotes.map(normText).join('\n');
      for (const t of s.texts) if (!docText.includes(t)) problems.push(`${guide} ${i + 1} "${s.title}": not quoted — "${t.slice(0, 80)}…"`);
      const codeText = s.texts.join('\n');
      for (const q of blocks[i].quotes) for (const f of quoteFragments(q))
        if (!codeText.includes(f)) problems.push(`${guide} ${i + 1} "${s.title}": quote not in this step — "${f.slice(0, 80)}"`);
    });
  }
  return problems.length === 0 || problems.join('\n       ');
});

check('TUTORIALS.md tier-gating and onboarding quotes are still in index.html', () => {
  const md = doc['TUTORIALS.md'];
  const at = md.indexOf('<!--@steptext flow-->');
  if (at < 0) return 'no <!--@steptext flow--> section';
  const next = md.slice(at).search(/\n##{1,2} /);
  const seg = md.slice(at, next < 0 ? md.length : at + next);
  const miss = [];
  for (const q of quoteGroups(seg)) if (!quotePattern(q).test(SRC_TEXT)) miss.push(`"${normText(q).slice(0, 90)}"`);
  // and the other way for the two strings the gate builds in code
  const corpus = quoteGroups(seg).map(normText).join('\n');
  for (const a of ['const lockTitle=', 'setTutNotice(`']) {
    const i = SRC_NC.indexOf(a);
    if (i < 0) { miss.push(`cannot find ${a}`); continue; }
    const out = []; scanLiterals(SRC_NC, a.endsWith('`') ? i + a.length - 1 : i + a.length, a.endsWith('`') ? 'close' : ';', out);
    for (const f of proseOf(out)) if (!corpus.includes(f)) miss.push(`${a} "${f}" not quoted`);
  }
  return miss.length === 0 || miss.join('\n       ');
});

// ── report ──────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  for (const [name, why] of failures) console.log(`  ✗ ${name}\n      ${why}`);
  process.exit(1);
}
