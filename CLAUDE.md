# SUSP.OS — Project Guidance

## After a major change, update the docs in the same commit

New feature, renamed or removed control, changed range or limit, new calibration
constant, new balance mode: the docs are part of the change, not a follow-up.
Most of the drift lives in `docs/`, not the README.

| Changed | Update |
|---|---|
| Slider range / mechanism / tier gating | `docs/SLIDERS.md` |
| Hz / spring / damper solve math, calibration constants | `docs/PHYSICS.md` |
| Balance contributor formulas or signs | `docs/FORMULAS.md` |
| Camber / toe / caster | `docs/ALIGNMENT.md` |
| Share-code fields or ids | `docs/CODEC.md` — ids are permanent, retire, never reuse |
| localStorage keys, persisted shapes, backup format | `docs/PERSISTENCE.md` |
| Factory presets, `PRESET_DESC`, `BUILD_PRESET_MAP` | `docs/PRESETS.md` |
| `zone-*` ids, components, file structure, anything that *looks* dead but isn't | `docs/CODE_MAP.md` |
| Tutorial steps, triggers, gating, `TutorialPanel` | `docs/TUTORIALS.md` |
| VISUALS groups, scales, bands, markers, colours | `docs/VISUALS.md` |
| A limitation found, or a design deliberately rejected | `docs/KNOWN_ISSUES.md` — only what is still true |
| A bug fixed, or a behaviour deliberately changed | `docs/HISTORY.md` |
| Tier feature lists, game limits, architecture summary | `README.md` |

## Verify before you finish

```
node tests/tests-docs.js
```

Reads `index.html` and `docs/` and fails when a stated fact no longer matches the
code. Run it after any docs change, and after touching the codec, `sanitizeTune`,
storage keys, the `open` state, or a slider range. It guards names, ids, keys,
enum indices and numeric bounds — **not prose**, which still needs a reader.

Adding a slider with a `sanitizeTune` clamp? Mark its SLIDERS.md row with
`<!--@range fe.yourField-->` so its range gets checked. Markdown renders the
marker as nothing.

`docs/CODE_MAP.md`'s "Testing reality" section carries the full routine — the
other suites, what each one can and cannot prove, and why the browser is
still the only real verification.

## Habits worth keeping

- **Record *why* something non-obvious stays.** CODE_MAP's
  "intentionally-retained legacy" section exists so the next audit doesn't delete
  load-bearing code.
- **Don't put line numbers in docs, or any count that will drift.** Reference
  identifiers instead. This file described `index.html` as a ~6,600-line file
  until it was nearly a thousand lines past that, which is the whole argument in
  one example.
- **When you correct a fact in one doc, grep the phrase across all of them.**
  Every multi-file error found so far was one claim living in two or three places
  where the fix reached only one. `tests-docs.js` catches the structured cases;
  this habit catches the rest.

## Navigating `index.html`

One file, several thousand lines, with all JS/JSX/styles inline and no build
step — deliberate, for zero-friction static hosting. Prefer `Grep` for a symbol,
constant or string over reading large ranges: function names are unique and the
banner comments (`── section name ──`) exist to be grepped. Start from
`docs/CODE_MAP.md`'s "Region order" and "Pure physics entry points" rather than
searching blind.
