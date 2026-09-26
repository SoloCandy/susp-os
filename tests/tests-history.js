// SUSP.OS — undo / redo history core tests
// Run with: node tests/tests-history.js
// No dependencies required.
//
// THIS FILE READS index.html and tests the makeHistory that ships. It covers the pure core only:
// stacks, bursts, labels, the cap and no-op handling. The wiring — which setters record, when a
// burst ends, which effects stand down during a restore — lives in App and needs the browser
// (docs/CODE_MAP.md, "Testing reality").
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the markers
// rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

const M = new Function(
  slice('const HISTORY_CAP=', '// ── GARAGE entry model') +
  '\nreturn{HISTORY_CAP,sameSnap,makeHistory};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const section = s => console.log(`\n── ${s} ──`);
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (got, want, what) =>
  assert(M.sameSnap(got, want), `${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);

// App rebuilds its snapshot object on every render. `render` mimics that: a fresh object each
// call, so identity means "nothing rendered since", exactly as close() relies on.
const S = v => ({ ch: { w: v }, fe: {}, dr: {}, al: {}, dnaApplied: null });
const render = v => S(v);

section('commit / undo / redo');

t('undo returns the state before a commit, redo returns the state after', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'load');
  eq(h.undo(render(2)), S(1), 'undo');
  eq(h.redo(render(1)), S(2), 'redo');
  assert(h.canUndo && !h.canRedo, 'after redo: undo available, redo empty');
});

t('multi-step round trip lands on every state in order', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'a'); h.commit(render(2), 'b'); h.commit(render(3), 'c');
  eq(h.undo(render(4)), S(3), 'undo 1'); eq(h.undo(render(3)), S(2), 'undo 2'); eq(h.undo(render(2)), S(1), 'undo 3');
  assert(h.undo(render(1)) === null, 'nothing past the first state');
  eq(h.redo(render(1)), S(2), 'redo 1'); eq(h.redo(render(2)), S(3), 'redo 2'); eq(h.redo(render(3)), S(4), 'redo 3');
  assert(h.redo(render(4)) === null, 'nothing past the last state');
});

t('a new change after undo empties redo', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'a'); h.commit(render(2), 'b');
  h.undo(render(3));
  assert(h.canRedo, 'redo available after undo');
  h.record(render(2));
  assert(!h.canRedo, 'record cleared redo');
  h.close(render(9));
  h.undo(render(9)); h.commit(render(2), 'x');
  assert(!h.canRedo, 'commit cleared redo');
});

t('labels follow the step across undo and redo', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'apply DNA GT3');
  assert(h.undoLabel === 'apply DNA GT3', `undoLabel ${h.undoLabel}`);
  h.undo(render(2));
  assert(h.redoLabel === 'apply DNA GT3' && h.undoLabel === null, `redoLabel ${h.redoLabel}`);
});

t('dnaApplied is part of the snapshot, so undoing APPLY restores the link state', () => {
  const h = M.makeHistory();
  const before = { ...S(1), dnaApplied: null };
  h.commit(before, 'apply DNA');
  const after = { ...S(2), dnaApplied: { name: 'GT3' } };
  eq(h.undo(after).dnaApplied, null, 'undo clears the link');
  eq(h.redo({ ...before }).dnaApplied, { name: 'GT3' }, 'redo restores it');
});

section('bursts');

t('every change in one burst is one step', () => {
  const h = M.makeHistory();
  assert(h.record(render(1)) === true, 'first change opens a step');
  assert(h.record(render(2)) === false && h.record(render(3)) === false, 'later changes extend it');
  h.close(render(4));
  eq(h.undo(render(4)), S(1), 'undo goes to before the burst');
  assert(!h.canUndo, 'only one step');
});

t('closing a burst starts a new step on the next change', () => {
  const h = M.makeHistory();
  h.record(render(1)); h.close(render(2));
  h.record(render(2)); h.close(render(3));
  eq(h.undo(render(3)), S(2), 'second step'); eq(h.undo(render(2)), S(1), 'first step');
});

t('a commit mid-burst is still its own step', () => {
  const h = M.makeHistory();
  h.record(render(1));
  h.commit(render(2), 'load');
  eq(h.undo(render(3)), S(2), 'undo the commit'); eq(h.undo(render(2)), S(1), 'then the burst');
});

section('no-op steps');

t('close drops a step that changed nothing once it has rendered', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'a');
  h.record(render(2));
  assert(h.close(render(2)) === true, 'dropped');
  eq(h.undo(render(2)), S(1), 'undo skips straight to the real step');
});

t('close keeps a step when nothing has rendered yet (same snapshot object)', () => {
  const h = M.makeHistory();
  const cur = render(1);
  h.record(cur);
  assert(h.close(cur) === false, 'kept — the change may not have rendered');
  assert(h.canUndo, 'still undoable');
});

t('undo and redo skip leftover no-op entries', () => {
  const h = M.makeHistory();
  h.commit(render(1), 'a');
  h.commit(render(2), 'no-op');
  eq(h.undo(render(2)), S(1), 'undo skipped the no-op');
  assert(h.undo(render(1)) === null && !h.canUndo, 'stack empty');
});

section('cap');

t(`past is capped at HISTORY_CAP (${M.HISTORY_CAP}), dropping the oldest`, () => {
  const h = M.makeHistory();
  for (let i = 0; i < M.HISTORY_CAP + 25; i++) h.commit(render(i), 'c');
  let n = 0, last;
  for (let cur = render(M.HISTORY_CAP + 25); ; n++) {
    const s = h.undo(cur); if (!s) break; last = s; cur = { ...s };
  }
  assert(n === M.HISTORY_CAP, `undo steps ${n}`);
  eq(last, S(25), 'oldest kept');
});

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
