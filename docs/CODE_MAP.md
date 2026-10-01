# SUSP.OS — Code Map

How `index.html` is organised, and — just as important — which code looks
dead but must not be removed.

The other docs in this folder describe the *domain* (physics, sliders, codec,
alignment). This one describes the *file*.

> No line numbers anywhere in this doc, deliberately — they go stale within a
> commit or two. Search by identifier instead.

---

## The file is one big `text/plain` script

`index.html` is not a normal script tag. The whole application lives in:

```html
<script id="app-source" type="text/plain"> … </script>
```

A small bootstrap at the end of the file reads that element's `textContent`,
runs it through `Babel.transform` (presets `env` + `react`, plus the
optional-chaining / nullish-coalescing / logical-assignment plugins), and
evaluates the result with indirect `eval` — indirect specifically so errors
stay catchable on iOS WebKit.

This is why there is no build step, and it shapes how failures appear:

| Failure | What the user sees |
|---|---|
| Babel can't parse the source (JSX/syntax error) | `#pre-load` shows "Babel compilation failed" + the message |
| Source parses but throws while evaluating | `#pre-load` shows "Runtime error" + the message |
| React renders but a component throws | `ErrorBoundary` renders "SUSP.OS — Failed to load" |
| All good | `#pre-load` is hidden and empty |

Two consequences worth knowing when editing:

- A syntax error blanks the whole page. `#pre-load` is the first thing to
  check when the app won't load.
- You can compile-check the app from the browser console without rendering it,
  by transforming `#app-source` yourself inside a `try/catch`. That is the
  cheapest gate available, and given there is no linter or CI it is worth
  using after any JSX edit.

---

## Region order

The source runs top to bottom in this order:

1. **Calibration constants and limits** — `DAMPING_CALIBRATION`,
   `TIRE_LOAD_SENS`, `MECH_BAL_GAIN`, `WIDTH_GRIP_EXP`, `TIRE_MECH_SCALE`,
   `MECH_BALANCE_TARGET`, `ARB_RS_SCALE`, `HZ_MIN`/`HZ_MAX`, `GAME_LIMITS`,
   `BRAKE_BIAS_SCALE`, `DIFF_BIAS_SCALE`, plus `PHYS_SNAP` and its helpers
   (`roundTo`, `mrDiv`, `snapPhys`) — the physical-unit slider grid, which lives
   up here rather than beside the output helpers because `computeTune` snaps to
   it before deriving the physics it reports. Changing any of these retunes the
   whole app; [PHYSICS.md](PHYSICS.md) carries the calibration table.
2. **Pure physics** — no React, no state, safe to lift out (see below). It ends
   with the Vehicle DNA core under its own `── Vehicle DNA ──` banner.
3. **Defaults and presets** — `DEF_CH`, `DEF_FE`, `DEF_DR`, `DEF_AL`,
   `PRESET_SAVES`, `BUILD_PRESET_MAP`, `DNA_ARCHETYPES`.
4. **Persistence primitives** — `mergeDefaults`, `usePersist`, then `GITHUB_MARK` and
   `useDeployCheck` under a `── Deploy check ──` banner, then the undo / redo core
   `makeHistory` under its own `── Undo / redo history ──` banner (pure, no React).
5. **Shared components** — see the table below.
6. **Codec** — `CODEC_FIELDS`, `encodeTune`, `decodeTune`, `sanitizeTune`.
7. **Tutorial and glossary content** — the `TUTORIALS` object, then `GLOSSARY` and its
   helpers (`GLOSSARY_BY_ID`, `glossaryLabel`, `glossaryBridge`), the shared hint strings
   `HINT_LAYOUT` / `HINT_BUILD_TYPE`, then `TutorialPanel`. Tutorials are documented in
   [TUTORIALS.md](TUTORIALS.md); the glossary under [Glossary and hints](#glossary-and-hints).
   `GlossaryModal` and its tier helpers sit earlier, with the shared components.
8. **`App()`** — all remaining state, the derived `useMemo` chain, and the
   entire sidebar + output JSX.
9. **Bootstrap** — the Babel/eval block described above.

### Pure physics entry points

These are pure functions of their arguments, in dependency order:

```
resolveFeEffective(ch, fe, build)      → resolves the stored Balance Target (NATURAL /
                                         RANGE / GRIP / MANUAL) into the absolute
                                         target (App's feEffective)
feelToPhysics(ch, fe)                  → resolves feel settings into physics
                                         (front/rear Hz, ζ per axle, ARB mode…)
computeTune(ch, physics, gameMode)     → springs, dampers, ARBs, balance
solveTune(ch, feEffective, gameMode, build)
                                       → feelToPhysics + computeTune, repeated in the
                                         target modes until the DISPLAYED balance
                                         meets the target; every caller goes through it.
                                         Returns the target it aimed at as `target`
                                         (RANGE's and GRIP's move with stiffness in Forza)
computeDiff(ch, fe, dr)                → differential locks (independent)
computeAlignment(ch, tune, layout, …)  → camber/toe/caster, from the tune
```

Balance Target helpers: `balTargetModeOf` (normalises the mode, legacy `'manual'` → NATURAL),
`balanceBandOf` (the Balance Guide RANGE band — the RANGE row, GRIP GAP and RANGE mode all
read it), `balTargetAnchorOf` (the unclamped RANGE/GRIP anchor at a given K — Balance Offset is
measured from it, and the BALANCE card's mode switch subtracts it to seed that offset),
`balTargetAnchoredOf` (RANGE/GRIP target at a given K: anchor + offset, clamped).

Supporting: `rsToHz`/`hzToRs`, `flatRideRearHz`, `flatRideSharedHz`,
`solveSpring`, `solveDampRaw`, `settleZetas`/`forceZetas`/`balModeZetas`
(Damping Balance Mode's front/rear split — `balModeZetas` is the by-mode
dispatcher, called twice per solve: once for the rebound anchor and once for
the INDEPENDENT bump anchor), `cornerMasses`,
`rollCenterHeight`, `axleRollStiffness` (one axle's spring roll stiffness from
its Hz — unrelated to `hzToRs`, the legacy Ride Stiffness slider mapping),
`rollMomentOf`, `clampBalTarget` (the Balance Target's stored `BAL_TARGET_MIN..BAL_TARGET_MAX` band, 0.05..0.95, which the Balance Guide strip also spans; its controls step and round by `BAL_TARGET_STEP`, 0.005, through `roundBalStep`;
`sanitizeTune` clamps the stored DELTA instead), `clampHz` (the HZ_MIN..HZ_MAX band — callers that also
REPORT a clamp still test their own raw value), `hasBalTargetSolve` (is anything
solving toward the Balance Target — ARB balance mode MECH/CO-SOLVE, or Rear Hz
Mode MECH even under MAN ARB), `mechSpringSplit` (Rear Hz Mode MECH outside CO-SOLVE: the target
conversion, ARB-share dilution and spring Hz ratio both Ride Reference paths of
`feelToPhysics` share; MAN ARB's closed-form solves stay per path), `tyreWidths` / `tireCorrOf` (section widths with the 265 mm
fallback, and the tyre-width mech-balance correction), `arbScaleOf` (the ARB click scale: MEASURE ARB's value or `ARB_RS_SCALE` — every click↔roll-stiffness
conversion goes through it), `arbScaleStale` (true when a measured scale's recorded MEAS. NAT BAL or Hz no longer matches the chassis — drives the ARB SCALE SETUP card's and sidebar's RE-MEASURE flags), `solveArbScale` (MEASURE ARB's closed-form solve from one in-game
reading), `natGeomOf` (the track-width/corner-mass estimate on its own — the solvers' model
roll-stiffness natural, and the shared term in the two below), `natRsOf` / `natDisplayOf` /
`natDisplayModelOf` / `measuredNatBalOf` (natural balance in roll-stiffness space and in display
space, the model's display prediction, and the clamped reading — there is deliberately no
unqualified "natural" function; see [PHYSICS.md](PHYSICS.md)), `natOffsetOf` (MEASURE NAT BAL's gap from the
geometric estimate with the tyre term taken out — 0 when not measuring; the one
definition all four solve sites use), `natBalRefOf` / `natBalStale` (the model's own prediction
at the moment a reading was taken, and whether it has since moved by at least `NAT_BAL_STALE_TOL`
— the step-1 counterpart to `arbScaleStale`; note `natDisplayOf` returns a reading
*verbatim* and never consults the chassis, which is exactly why the guard is needed), `tyreRollStiffness` / `inSeries` / `displayRsBalance` (the
tyre-series balance Forza displays — `computeTune`'s `mechBalance` and MEASURE ARB), `displayNatOffsetOf`
(MEASURE NAT BAL's offset for that display, anchored at the stored `measuredNatBalHz`), `autoArbShare` (ARB Stiffness Mode AUTO's bar share of
total roll stiffness — one definition shared by `feelToPhysics`,
`resolveCoSolveSpringShare` and `computeTune`), `parseTyre`, `axleLatG` (each axle's lateral
capacity per unit of its own weight, optionally under braking or drive — the grip model's core),
`mechBalanceLLT`, `balanceFromRsBal`, `gripMargin` / `phaseMargins` / `ENTRY_G` / `EXIT_G` (PRO's
Handling Balance in grip-margin percent, by phase; see [FORMULAS.md](FORMULAS.md) "Phase margins"),
`gripNeutralSplitOf` (the roll-stiffness split at which the grip model reads neutral — the
reference `computeTune`'s `bChassis` measures from; see [FORMULAS.md](FORMULAS.md)),
`balanceBandDelta` (one edge of the PRO Balance
Guide's recommended band — module-level rather than inline because the RANGE
block and the GRIP GAP sub-widget both call it, and a band they disagreed on
would make "in range" mean two different things in one panel) and
`balanceBandRange` (the delta range a fraction pair covers — not just its two
endpoints, since a negative gap makes the delta V-shaped with its minimum at
grip-neutral),
`resolveArbBalTarget`, `gripNeutralOf` (grip-neutral mech
balance — what GRIP's Balance Offset and DNA's `balanceOffset` measure from; in a Forza mode it
depends on total roll stiffness, passed as `rollKOf(tune)`, and falls back to the MEASURE NAT BAL
probe springs without one), `rollKOf` (a tune's total roll stiffness, springs plus bars —
independent of the F/R split, which is why `solveTune` can aim GRIP at the neutral at each run's
own stiffness and return it as `target` without chasing itself),
`balanceEnvelope` (which fitted bounds the current tune sits outside, each flag
carrying a `hard` severity — feeds the PRO-only FIT? badge in the Handling Balance header,
the only place the app says a figure is extrapolated; `hard:false` is an
unverified extrapolation of a fit, `hard:true` means the model has stopped
answering correctly, and only the second turns the badge amber) and `cgEstMmOf`
(the unclamped RIDE HEIGHT → CG estimate, shared by App's sync effect and the
envelope's saturation check so the clamp and the flag for hitting it cannot
disagree),
`computeOscillation`
(damped step response — sample points for the VISUALS DYNAMICS chart; pure,
takes Hz + rebound/bump ζ + a duration), `measureSettle` (the ±10%-band
settle time measured off `computeOscillation`'s trace via `curveSettle`,
with the two-pass window fit — shared by the DYNAMICS chart's dashed markers
and the DAMPERS table's Settle-row MEAS hover so both quote the same number; the chart's
own `firstCrossing` reads the neutral crossing off the same points),
`resolveCoSolveSpringShare`
(CO-SOLVE's Auto Spring Share search — shared by `feelToPhysics`'s Kcs
pre-inversion and `computeTune`'s `effectiveRHz` solve so both agree on the
same spring share). `computeCheck` backs the TUNE CHECK reverse calculator.

In `App()` the chain is `resolveFeEffective` → `solveTune` (`feelToPhysics` →
`computeTune`, repeated for the Forza target modes) → everything else, each in its
own `useMemo`. The funnel's output is `feResolved`; `feEffective` is that with
`solveTune`'s `target` written back as `arbBalTarget`, so every marker shows the
target the tune actually aimed at. Vehicle DNA's resolver (`dnaEvaluate`) and `dnaApply` call `solveTune`
too, so DNA and the live tune agree.

**Vehicle DNA core** (see [DNA.md](DNA.md)): `sanitizeDNA` normalises a DNA;
`compileDNA` turns its axes into an `fe`/`dr` patch; `measureDNA` reads the axes back
off any tune and `dnaReadBack` turns that reading into a DNA you can edit (it converts
the damper split instead of dropping it, and falls back for an axis the tune cannot
express); `dnaTolerances` sizes a hit from the game's quantisation;
`dnaEvaluate` runs one compile through exactly App's chain; `applyDNA` compiles and
resolves conflicts in the DNA's `keep` order. Constants: `DNA_AXES`, `DNA_YIELDABLE`,
`DNA_MAX_MOVES`. Presentation: `DNA_AXIS_UI`, `dnaFmt`, `DNA_MODE_FIELDS`. In `App`,
`dnaStore` (`suspos_dna_v1`), `dnaRef`, `dnaPreview`, `dnaLink`, `dnaApply`, `dnaSave`,
`dnaLoadSaved`, `dnaUnlink`, `dnaFromDecoded`, `dnaDot`, `garageEntries`/`dnaEntries`
and `requestMode` wire it to the DNA modal (`showDnaModal`), the sidebar DNA line, the
`visDna` card, the tier warning and TUNE CHECK's IMPORT AS DNA button.

---

## Components

| Component | Rendered in |
|---|---|
| `Hint` | everywhere — the ⓘ affordance. Portaled `role="tooltip"`; mouse hover opens it and a mouse click never closes it, a tap or pen tap toggles it, keyboard focus opens it; a press outside, scroll, resize, blur or Escape closes it. An optional `term` (a `GLOSSARY` id) adds a "TERMS: … ›" link that opens the glossary at that entry through `glossaryBridge.open` — the tooltip then takes pointer events, so the mouse can cross onto the link, and Enter on an open ⓘ follows it. Every component that takes a `hint` prop (`Field`, `FeelSlider`, `VisTrack`, `Toggle`, `Card`, `SuspensionCard`, `AlignCard`, `BiasSeg`, `DirSeg`) also takes `hintTerm` and passes it on as that `term`; `HandlingVerdict` and `PhaseVerdict` key theirs in a `hintTerms` object beside `hints`, and a RESPONSE factor row takes an optional `term`. `BiasSeg` and `DirSeg` draw no ⓘ when `hint` is empty; every hint's text is quoted in [HINTS.md](HINTS.md) |
| `TermLink` | the same "TERMS: … ›" link inline, for footers and notes that have no ⓘ; `label` overrides `glossaryLabel(id)` |
| `Field` | numeric inputs across all sections |
| `NumBox` | Field's always-visible number box on its own: shows the value, commits an edited draft on Enter/blur clamped to `min`/`max`, Escape cancels, never commits an unedited draft. An empty value (non-finite, e.g. MEASURE ARB before a reading) shows `placeholder`; every `.num` box keeps a visible border, so an empty one still shows where it is. Rendered by every `FeelSlider`, and by Tune Check's MEAS. NAT BAL |
| `FeelSlider` | BEG feel sliders, every INT/PRO slider that isn't a `Field`, and the DNA editor. Always renders a `NumBox` beside the label, CHASSIS-style; `readout` is secondary text to its left. `box` sets the unit and can override `value`/`onCommit`/`min`/`max`/`dp` where the stored field isn't the slider's (Target Speed, POWER SPLIT, INDEPENDENT's effective Hz) |
| `Toggle` | mode switches |
| `Sec` | the nine collapsible sidebar sections (`div.stog` header) |
| `Card` | section wrapper in the output panel (title, ⓘ hint, `headerRight`) |
| `OutRow`, `RowGroup` | the output panel's value rows and their bordered groups — full-width single column for Forza (`horizon`/`motorsport`); assembled into the BeamNG two-column layout's cards below when `physMode` |
| `SuspensionCard`, `AlignCard`, `DiffCard` | BeamNG-only (`physMode`) output cards — per-axle shells built from `OutRow`/`RowGroup`/`Card`. `SuspensionCard` merges the Forza ARB+SPRINGS+DAMPERS cards into one card per axle; `AlignCard` omits Caster on the rear side (no rear caster slider in BeamNG); `DiffCard` is a generic per-axle differential card. The BeamNG layout itself (summary strip, CENTER SPLIT card, the fixed 2-column `.beamng-grid`) is inline JSX in `App`, not a separate component — see the `physMode` branch in the output panel |
| `Readout`, `Stat` | Tune Check and sidebar readouts — **not** the output panel any more (it moved to `OutRow` so each value is one scannable line to transcribe into a tuning menu) |
| `BiasSeg` | one contributor row in the expanded Handling Balance panel. `scale` is the value that fills a half and `dead` the band read as nothing — the defaults are BEG/INT points; `PhaseVerdict` passes grip-margin percent figures. `muted` greys a row that is context, not a setting (PRO's PITCH) |
| `DirSeg` | a contributor with a direction but no calibrated size — PRO's diff lock and damping rows. Shows toward OS / toward US / — and a NO SIZE label |
| `VisRollSplit`, `VisSuspTracks` (over `VisTrack` and the `visGhost` helper) | the pinned VISUALS card — its RIDE · ROLL · DAMPING group (`open.visRide`). `VisRollSplit` draws the split divide at `tune.mechBalance`, the display-space value the MECH BALANCE strip plots, so its NAT/TGT ticks match that strip; the springs/ARBs shading within each end uses model-space stiffnesses and is a share of that end only. `VisSuspTracks` renders ride Hz, ARB and damping ζ as F/R rows on shared tracks; the Hz and ARB ghost rings (NAT grey, target green) sit on the derived axle, the one Ride Reference does not fix. These replaced the `SpringDial` / `ArbDial` / `DampingDial` arc dials. What each group draws, marker by marker, is in [VISUALS.md](VISUALS.md). The card's other two groups, **DYNAMICS** (the `computeOscillation` step-response chart) and **SAG** (sag vs load, shown only when CG Height Source is RIDE HEIGHT), are inline SVG in `App` rather than components — same as the BeamNG layout above. Grep `visDynamics` / `visSag` for their `open` keys. DYNAMICS integrates its trace twice — see `fitDur`/`probeDur`: the window is sized from the analytic estimate, the curve is measured, then the window is re-fitted and re-integrated, because `computeOscillation`'s `nPts` is fixed and its step size (hence the trace) depends on the window length |
| `HandlingVerdict` | expanded handling-balance panel, **BEG and INT**. Its dominant-contributor tips name only controls the tier can see: BEG gets the Balance slider (and, for diff, where the lock comes from), INT gets ARB Bias, Damping Bias, the RIDE multiplier and EXIT/ENTRY. The brakes tip explains the BRAKES card's computed bias, which every tier shows, and deliberately does not tell the user to move it — the bar and the card use different neutral points ([KNOWN_ISSUES.md](KNOWN_ISSUES.md)). `GroupSection` is called as a function, not rendered as `<GroupSection/>`: a component defined in the body remounts its rows (and their ⓘ) on every `App` render ([HISTORY.md](HISTORY.md)) |
| `mechReachNote` | a plain helper, not a component: the cause-and-fix sentence both `mechBalClamped` warnings (ARB card and the warnings strip) end with. It works out which bar is at its ceiling or floor from `tune.arbF`/`arbR` against `lim.arb`, and names the fix for the active stiffness mode and CO-SOLVE's Spring Share |
| `PhaseVerdict` | expanded handling-balance panel, **PRO**: tips, then ENTRY / MID / EXIT / TRANSIENT rows from `phaseMargins`. `PHASE_NEUTRAL` (±1%), `signOf` and `fmtPct` sit beside it. `App` computes `phase` only when `uiMode==='pro'`, and the headline, stacked bar and ENTRY/MID/EXIT strip all switch on it being non-null. Its `Seg` (a `BiasSeg` at the phase scale) is module-level, just above it, for the same reason as `HandlingVerdict`'s `GroupSection` |
| `EntryCard` | one garage entry inside the GARAGE drawer |
| `CheckerModal` | TUNE CHECK (DECODE / MEASURE). **The overlay has no backdrop-click close, unlike every other modal — that is deliberate, not a missing handler:** MEASURE's two ARB readings are component state taken one at a time with a trip into the game between them, and a stray click on the dim margin used to discard them silently. ✕ is the only way out. They stay component state rather than lifting to `App` because `probeHz` re-seeds per car from `ch.measuredNatBalHz` on open and `App` has no car identity to re-seed against. MEASURE is one column of two numbered steps — `STEP 1 · NAT BAL SETUP`, then `STEP 2 · ARB SCALE SETUP`, which is locked until step 1 has a reading because `solveArbScale` needs it. Each step's `Card` `headerRight` carries its own state chip (NOT SET / SET n / DEFAULT n / RE-MEASURE n) — step 1's goes amber on `natBalStale` and step 2's on `arbScaleStale`, so both steps flag a reading the chassis has moved out from under, and step 1's amber block also says the ARB scale below rests on it, and the module-scope `CkPhase` / `CkChip` / `CkNote` / `CkWarn` / `CkIntro` helpers exist so both steps — and both **tabs** — share one rhythm: what to set, then what to type back. (They were local to this block until DECODE became numbered steps too.) Step 2 ends in a **SCALE IN USE** toggle (`DEFAULT 540` / `MEASURED n`) rather than APPLY/RESET buttons — `DEFAULT` nulls the stored reading to hold `sanitizeTune`'s flag-off-means-null invariant, and `MEASURED` is disabled until `arbCanMeasure` (a fresh pair of readings, or a scale already applied). `arbSolveHz` anchors both solves to `ch.measuredNatBalHz`, never the live `probeHz`, and `arbHzMismatch` surfaces the difference. A stale scale whose NAT BAL was cleared renders a `USE DEFAULT` button inside the locked branch — without it that state has no way back to the default, since every other route to the toggle needs step 1. DECODE is the same two-numbered-step column: `STEP 1 · TUNE INPUTS` (mass, springs, damping, bars, each under its own `CkPhase`) then `STEP 2 · DECODED TUNE`. Step 2 renders **nothing** — no readouts, no buttons — until `ckEntered`, which the `pS`/`pD`/`pA` setters flip on the first spring/damper/ARB edit; the mass fields do not flip it, since they write to `ch` and are shared with the sidebar. Without that gate the seeded stock figures (`ckSpr` 400/300 lb/in and friends, needed because `Field` requires a number) decoded on open and read as a real tune. DECODE's two buttons share one `decodedFe` patch and stack under a **WHERE IT GOES** phase, each with its own line of what it keeps and what it touches: IMPORT TUNE writes the patch to the tune, IMPORT AS DNA (PRO, `onImportDna`) reads it back into the DNA editor without touching this car. `decodedFe` anchors ζ and bump on the **front** axle because it writes `rideRef:'front'` and STANDARD's exact-anchor axle follows Ride Reference — the two have to move together, and once didn't ([HISTORY.md](HISTORY.md)) |
| `GlossaryModal` | glossary lookup (TERMS in the header). zIndex 1100, above every other modal, the ⓘ tooltip and the tutorial card. Opens on ALL; the BEG / INT / PRO chips show entries at or below that tier and hide `[INT] `/`[PRO] ` paragraphs above it (session state, not persisted), and search runs inside the filter. `focus` (a `GLOSSARY` id) scrolls to and flashes that entry on open; SEE buttons jump the same way, widening the filter or clearing the search when either hides the target. Scrolls by `offsetTop` inside its own scroller, never `scrollIntoView` (it can move the page behind on mobile). Escape closes it from a capture-phase document listener, so nothing underneath sees the key. `App` owns the wiring: `glossaryBridge.open(id,{from,keyboard})` sets `glossaryFocus` and re-keys the modal per focus, and on close focus returns to `from` only when the link was used from the keyboard |
| the data modal | SHARE (COPY CODE / COPY LINK) / LOAD CODE / BACKUP / RESTORE (inline in `App`, not a component). LOAD CODE stages into `pending` and applies through `mergeTune` — see the share-parts suite below. RESTORE stages too, in its own way: one `chosen(kind)` predicate drives both the per-row counts it prints (`3 restored, replacing your 1 entry`, amber where something of yours drops) and the entries actually dropped, so the summary can never describe a different restore than the one that runs. It is the only action that replaces entries the garage cannot undo, hence the net-effect box and the two-tap `ConfirmBtn` |
| `TutorialPanel` | the guided tours. The body (`data-tut-body`) is `white-space: pre-line`, so a `\n` in a step's `body` is a line break. A step's optional `glossary` ids render a TERMS row of links (`data-tut-terms`) under the body that open the glossary at that entry; this replaced the old per-step `terms:` field and the INT guide's two "Key Terms" steps |
| `OverwriteBtn` | *(no current call site — `useTwoTap`, the hook behind it, is what the garage reuses)* |
| `ConfirmBtn` | A labelled full-width two-tap button (`RESTORE` → `SURE?`), the same idea as `OverwriteBtn`'s glyph. It exists as a component because `useTwoTap` is a hook and its caller — the RESTORE panel — is an IIFE inside `App`'s render |
| `ErrorBoundary` | wraps the app |

The GARAGE drawer itself is inline JSX in `App` (it needs a dozen handlers off
`App` state); only the per-entry card is factored out. `Sec`'s count above is
hardcoded prose — verify it rather than trusting it after any section change.

Note `HandlingVerdict` / `PhaseVerdict` and the RESPONSE factor breakdown render **only** when
the handling-balance panel is expanded, the RIDE · ROLL · DAMPING tracks render **only** inside
VISUALS (hidden entirely in BEG), and the GARAGE drawer renders behind a toolbar
toggle. None of them are reachable from a cold page load, which matters when
testing.

### Glossary and hints

**`GLOSSARY`** is an array of groups (`{group, terms}`) in the app's own section order —
Geometry & Weight, Differential, Balance Target (PRO), Roll & Anti-Roll Bars, ARB Modes,
Ride & Springs, Ride Setup, Damping, Alignment, Brakes, Handling Balance, Readouts &
Visuals, Tools — not alphabetical. Each entry is `{id, term, tier, short?, def, see?}`:

- `id` — kebab-case, the handle every link uses (`hintTerm`, `term`, a tutorial step's
  `glossary`, a `see` list). Renaming one breaks every link to it silently: an unknown id
  labels its link with the raw id and the jump does nothing.
- `tier` — the **lowest** tier that can see the thing the entry describes, not who it is
  written for.
- `short` — optional link label; `glossaryLabel` uses it, else `term` minus a trailing
  parenthetical.
- `def` — paragraphs split on a blank line (`\n\n`). A paragraph opening `[INT] `
  or `[PRO] ` applies only from that tier up; `glossParas` turns the label into a badge and
  the brackets are never shown.
- `see` — related ids, rendered as SEE buttons that jump within the modal.

`GLOSSARY_BY_ID` resolves an id; `glossaryLabel(id)` is the text of a "TERMS: … ›" link;
`glossaryBridge.open` is a module-level slot `App` fills so a `Hint` or `TermLink` deep in
the tree can open the modal without prop drilling. Beside `GlossaryModal`: `TIER_RANK`
(the filter's ordering), `TIER_COLOR` and `TierBadge` (the only place tiers are coloured —
the header BEG/INT/PRO buttons are plain `.tbtn`) and `glossParas`. The modal's filter
chips and search are session state; nothing about the glossary is persisted.

**Where depth lives.** A hint (`Hint` text, a verdict tip, a `title`, a tutorial body) is
the one-line version: what the control does and which way it moves things, kept to about
200 characters (tips 160, `title` tooltips 120, tutorial bodies 320). Mechanism, formulas,
edge cases and the "why" go in the glossary entry the hint links to. When a hint grows past
that, move the detail into the entry rather than widening the tooltip. `tests-docs.js`
enforces looser ceilings (hints and tips 260, `title` 160) so a template hint whose
interpolated value runs long doesn't fail the suite; the targets above are the habit.

**The tier-context rule.** A hint names only controls and readouts that every tier
rendering it can see — a control shown at INT and PRO must not tell an INT user to use a
PRO-only setting. Where a hint genuinely differs by tier, the existing `uiMode` branches in
the hint expression stay (the EXIT and ENTRY sliders' MATCH CHASSIS clauses, the ARB
Balance Mode hint's PRO-only modes, `HandlingVerdict`'s BEG/INT tips); do not collapse them into one string. The glossary does the reverse: its
untagged paragraphs must hold for the entry's own tier, and anything higher goes in an
`[INT] `/`[PRO] ` paragraph.

---

## Sidebar zones and tier gating

Every spotlightable region carries an `id="zone-…"`, used by the tutorial
system for focus/dimming. There are 19 in the source; which exist in the DOM
depends on the tier.

- **All tiers**: `zone-garage` — the right-side GARAGE drawer. It is *not* part
  of the sidebar, so it sits outside the per-tier lists below and is the only
  zone present at every tier regardless of panel.
- **All tiers, inside the sidebar**: `zone-toolbar` — the RESET (⟲)/DNA/CHECK/SHARE row,
  pinned at the top of the sidebar's outer wrapper (a sibling of the scrollable
  content and the pinned VISUALS footer), outside the `uiMode` branching that
  splits BEG from INT/PRO below it.
- **BEG** renders its own flat panel: `zone-layout-build`, `zone-build-type`,
  `zone-weight`, `zone-ride-stiffness`, `zone-balance`, `zone-character`, plus
  `zone-output` and `zone-balance-bar`. No `Sec` sections at all, and no VISUALS.
- **INT** switches to the sectioned sidebar: `zone-chassis`, `zone-build`,
  `zone-drivetrain`, `zone-arb`, `zone-feel`, `zone-damping`,
  `zone-visuals`, plus output and balance bar.
- **PRO** adds `zone-balance-target` and `zone-alignment`, and unlocks extra
  controls inside the shared sections (CHASSIS geometry, ARB MECH/CO-SOLVE,
  Hz MECH mode, Alignment Mode).

### Leaving PRO: what the tier effects reset

Two effects in `App` run on `uiMode` and `restoreTick` below PRO:

- **Geometry scaling** writes wheelbase and both track widths from Weight. Those are PRO-only
  inputs, so below PRO they are a function of Weight, and leaving PRO rescales them. CG Height is
  deliberately not in it: it is an input at INT (MANUAL CG) or follows ride height, and scaling it
  overwrote a typed value on every weight edit and every load.
- **The tier fallback** is one effect with one write per store: `fe` (BEG's simple-mode lock, then
  ARB Balance Mode MECH / CO-SOLVE / CHASSIS → WEIGHT and Hz MODE MECH → MULTIPLIER), `dr`
  (`diffManual` and `diffComplement` off) and `al` (Alignment Mode back to AUTO, Nudge OFF; the
  MANUAL angles and Nudge Strength stay stored). **Keep it one write per store.** `usePersist`'s
  `set` applies an updater to the render-time value, so a second same-tick `setFeRaw` starts from
  the stale value and erases the first. The BEG lock was once a separate effect and was erased
  that way on every switch to BEG.

Nothing is restored on returning to PRO. A PRO-only setting that arrives *below* PRO by a share
code or garage load (neither changes `uiMode`) stays until the next tier change, so the loaded
tune computes as its author made it. The screen says so instead of hiding it: the EXIT/ENTRY
hints keep their "A PRO-only diff setting is also biasing this" branch for MATCH CHASSIS, and a
MANUAL diff below PRO, which has neither the AUTO sliders nor the PRO-only lock fields, gets a
note in DRIVETRAIN listing the locks in use instead of a blank diff section.

### Tier differences that look like gaps but aren't

- **FRONT AXLE EXIT shows for a SPORT diff** (AWD, INT+) while ENTRY and CENTER POWER SPLIT hide.
  EXIT drives front *accel* lock, which a Sport diff has (the card shows a live Front Accel);
  ENTRY drives decel lock and POWER SPLIT the centre lock, which Sport lacks (N/A on the card).
  Hiding FRONT EXIT would leave `diffFrontExitBias` moving an output with no control.
- **The DIFFERENTIAL card's RECOMMENDED and CENTER SPLIT boxes return null at BEG.** BEG has no
  DIFF TYPE row and no POWER SPLIT slider, so it could not see what `→ USE` changed or change it
  back. The glossary tags both boxes `[INT]`.

`zone-presets` no longer exists. It was duplicated across the BEG panel and the
INT/PRO BUILD section (safe only because the two were mutually exclusive on
`uiMode`); both copies went when the factory presets moved into the GARAGE panel.

Sections are collapsed on load — `open` is plain `useState`, not persisted.

`open` holds two unrelated kinds of flag. The collapsible **sidebar sections** —
exactly one per `Sec`, all nine including `visuals` — are listed in `SECTION_KEYS`
beside the initialiser. The rest are not sections: `balanceExpanded` (the balance
detail overlay), `factoryOpen` and `dnaSavedOpen` (the GARAGE factory list and the DNA modal's MY DNA drawer) and the `vis*` cards
nested *inside* the VISUALS section.

**The SECTIONS `−`/`+` buttons walk `SECTION_KEYS`, not `Object.keys(open)`.**
They used to blanket-toggle every key, which reached every one of those: `+` popped the
balance overlay and every visualisation card open, `−` closed the factory list.
Neither is what a control labelled SECTIONS should move, and the blast radius grew
with every flag added to the object.

**Adding a `Sec` means adding its key to `SECTION_KEYS` *and* to the initialiser.**
A section missing from either is skipped by expand-all while still collapsing and
toggling normally, so nothing looks broken. `alignment` was missing from the
initialiser and behaved exactly that way: it read as falsy, its own header worked,
and the only symptom was `+` not opening that one section, in PRO only — with a
tutorial step that writes the key papering over even that. `tests-docs.js` checks
the initialiser against every `open.*` and `tog('...')` use in the source.

---

## Header layout: `headerCompact`

The full header row — brand, UNITS, the game-mode dropdown, BEG/INT/PRO, then
`?` / TERMS / the GitHub source link / GARAGE — needed roughly 975px once the four divider margins
and a two-digit GARAGE count are counted. That is well above `isMobile`'s 768px
cutoff, so between those widths the desktop header used to render and push
GARAGE and its neighbours off-screen: that row has no wrap and no horizontal
scroll. Adding the third game mode is what pushed it over; two fitted inside
768px.

`headerCompact` is `windowWidth < 1000`. Measured flush at exactly 960, so the
extra headroom covers a three-digit count and font metrics differing from the
machine it was measured on. **Do not lower it without re-measuring the GARAGE
button's right edge against the viewport.**

Two things to know before touching it:

- **It is deliberately not folded into `isMobile`.** That flag also drives the
  sidebar overlay, the backdrop, `sidebarWidth` and the brand sizing, so turning
  every ~900px laptop into the overlay-sidebar layout would be a far larger
  behaviour change than the bug warrants. `headerCompact` decides only *where*
  the units / game-mode / tier groups live.
- **Three gate sites move those groups and must stay in sync**: header row 1
  (units + game mode + tiers, shown when *not* compact), header row 2 (the tier
  row, shown when compact), and the top of the sidebar scroll area (units + game
  mode, shown when compact). Gating only some of them leaves those controls
  unreachable in the gap.

A container-shaped decision elsewhere follows the same precedent rather than
reusing a viewport flag: the BeamNG output grid collapses to one column on a
`@container (max-width:580px)` query against the output panel's own width,
because that width depends on sidebar state rather than window size. `auto-fit`
was tried and rejected there — on wide monitors `minmax(280px,1fr)` grows to
three or four columns, which breaks the front/rear pairing the layout exists
for. A fixed two-column template plus the container query is the only way to cap
it at exactly two without an unwanted `maxWidth` margin cap.

The ↩ undo button used to sit in that row too; it moved to the sidebar toolbar with
redo, so the row is one button narrower than when 975 was measured. The threshold
was left at 1000 rather than re-measured — lowering it is safe only after the
GARAGE edge check above.

The GitHub slot is one glyph wider while it shows the reload state (below). That was
measured: with it lit, GARAGE's right edge sits at the header's padding at 1000px,
820px, 480px and 375px, so neither layout overflows.

---

## Deploy check: `useDeployCheck`

The header's GitHub source link turns into a reload button once a newer
`index.html` is live — for a tab left open across a push to GitHub Pages. Lit, it
keeps the GitHub mark, adds ↻, turns green (`.tbtn.update`), and clicking it calls
`location.reload()` instead of opening the repo. Nothing else changes, and it never
reloads on its own.

How it decides:

- **Baseline is `document.lastModified`** — the `Last-Modified` header of the copy
  *this tab* loaded. A HEAD fetched after load was rejected as the baseline: a page
  served from the browser cache would compare against a newer server copy and
  never light.
- **The check is a `HEAD` with `cache: 'no-store'`** on `location.pathname`, lit
  only when the server's `Last-Modified` is strictly newer. A CDN edge still
  serving the old copy reads equal or older and is ignored.
- **When**: every `DEPLOY_CHECK_MS` (5 min) while the tab is visible, and on
  `visibilitychange` / `focus`, throttled to once a minute. It stops once lit.
- **It is inert off http(s)** (`file://`) and on any server that sends no
  `Last-Modified`: `document.lastModified` then reads as "now" and the HEAD's date
  parses as `NaN`, so the comparison is never true.
- **Reloading loses nothing.** All state lives in `usePersist` keys (see
  [PERSISTENCE.md](PERSISTENCE.md)), which is what lets the button reload without
  asking first.

It fires on any Pages redeploy, not only one that changed `index.html` — see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## Undo / redo

`makeHistory` (module level, `── Undo / redo history ──`) holds two stacks of
whole-state snapshots `{ch, fe, dr, al, dnaApplied}`. App drives it from the
`── Undo / redo wiring ──` block. The ↩ / ↪ buttons live in `zone-toolbar` beside
RESET; Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z and Ctrl+Y redo, except while a text field
has focus (the browser's own text undo wins there).

**Two kinds of setter, and which one to use matters.** `setCh`/`setFe`/`setDr`/
`setAl` record: every user-facing call site uses them, including `pCh`/`pFe`/…
and props passed to components. `setChRaw`/`setFeRaw`/`setDrRaw`/`setAlRaw` bypass
history and are for effects that *derive* state — the mount migrations, RIDE HEIGHT
→ CG, BEG/INT geometry scaling and mode fallbacks, BOTTOM G, ARB unit conversion on
`physMode`, the ARB ceiling reclamp — and for the restore itself. An effect that
used a recording setter would open a step of its own whenever it fires, and would
empty the redo stack right after an undo.

**Steps.** A discrete action — factory preset LOAD, LOAD CHASSIS/BUILD, share-code
OVERWRITE, CHECK's import, DNA APPLY, removing the DNA link, RESET of the tune —
calls `commit(label, fn)` and is exactly one labelled step. Anything else is a
*burst*: the first recorded change saves the state before it, and the burst ends
on a window-level `pointerdown`, `pointerup`, `focusout`, or 600 ms without a
change (not while a pointer is still held). One slider drag is one step, and so
is a mouse-wheel run on a focused control.

**Restores and effects.** A restore writes through the raw setters, then:

- sets `restoringRef`, which the ARB unit-conversion effect and BOTTOM G's RIDE
  REF. mirror check and skip. The snapshot already holds their output; running
  them again converts twice. The old undo had exactly that bug (see HISTORY.md).
  The last effect in App clears the flag — **keep it last**.
- bumps `restoreTick`, a dependency of the BEG/INT geometry scaling and tier
  fallback effects, so a snapshot taken in PRO and restored in BEG or INT
  is brought back inside that tier. It is declared right after the persisted
  state because Babel's const→var would read it as `undefined` in those
  effects' dependency arrays further down.

The UI tier, section open state, units, the DNA editor draft and every garage
entry are deliberately outside history — see KNOWN_ISSUES.md.

---

## localStorage

All keys are namespaced `suspos_`. Versions are per-key; see
[PERSISTENCE.md](PERSISTENCE.md) for when to bump one (removing a field never
requires it — the stale key is simply ignored).

`suspos_ch_v8`, `suspos_fe_v8`, `suspos_dr_v8`, `suspos_al_v2`,
`suspos_units_v2` (+ `suspos_units_v1`, read-only), `suspos_uimode_v1`, `suspos_zoom_v1` (read-only now),
`suspos_tutorial_seen_v1`, `suspos_tutorial_step_v1`, `suspos_baltut_seen_v1`, `suspos_onboard_v1`,
`suspos_garage_v2`, `suspos_garage_ui_v1`.

Special ones — a three-deep migration chain plus its two sentinels:

- **`suspos_saves_v9`** — read-only legacy preset slots. Never written.
- **`suspos_builds_v1`** and **`suspos_garage_v1`** — read-only legacy save
  lists. No UI, no React binding; the unified migration's two `getItem` calls
  are their only readers.
- **`suspos_builds_migrated_v1`**, **`suspos_garage_unified_v2`** — sentinels,
  not data. Presence means that link of the chain already ran.

`usePersist` merges a stored object over the defaults (`{...initial,
...parsed}`), so a partial object in storage is valid and missing keys fall
back to their default. A key that is *present but invalid* is not checked —
`usePersist`'s optional third argument `repair` is the opt-in for that, run once
before the first render; only `fe` passes one (`repairFe`, `gameMode` only). See
[PERSISTENCE.md](PERSISTENCE.md).

---

## Intentionally-retained legacy — do not remove

Everything in this section **looks** dead to a search-based audit and is not.
Each entry is load-bearing for users with existing saved state or shared
codes. If you are cleaning up dead code, this is the list to check first.

**`arbBalMode: 'man'`** — a retired enum value. It stays at its original index
in `ARB_BAL_MODE_DEC` so old share codes still decode to the right string;
`sanitizeTune` then rewrites it to `'manual'`. There is a second, separate
migration for persisted state in `App()`. Removing either breaks old codes and
old saves respectively.

**`arbBalMode: 'manual'`** — deliberately invisible. It behaves exactly like
`'weight'` but is not one of the Balance Mode buttons, so nothing lights up
while Stiffness Mode is MAN. TUNE CHECK's import is its live producer. A
value that no UI control sets is the intended design here, not an oversight.

**`ARB_MODE_DEC` index 3** — decodes a retired `'balance'` value to `'auto'`.
Index 4 is `'man'`, relocated from `ARB_BAL_MODE`. Both positions are frozen.

**`al.alignManual`** — `DEF_AL` still defines it and `alignMode` still falls
back to it (`ALIGN_MODE_DEC.includes(al.mode) ? al.mode : (al.alignManual ? 'manual' : 'build')`) for state
saved before `al.mode` existed. The *other* former use of it — the ALIGNMENT
card's hint prefix — was a genuine bug and has been fixed to read `alignMode`;
that does not make the fallback removable.

**`al.camberF` / `toeF` / `toeR` / `caster` / `camberR`** — these were dead
state once, and are live now (PRO Alignment Mode MANUAL). See
[ALIGNMENT.md](ALIGNMENT.md).

**`arbBalTargetMode` / `arbBalDelta` / `arbBalAbs`** — fully live; they drive the
PRO Balance Target modes (RANGE and GRIP share `arbBalDelta`; MANUAL reads
`arbBalAbs`). Easy to mistake for orphans because the names suggest a superseded
target system.

**The `'manual'` value of `arbBalTargetMode`** — no button writes it any more, and
it is *not* the MANUAL mode (that is `'abs'`). It is how NATURAL was stored before
RANGE and MANUAL existed. `balTargetModeOf` reads it (and anything unknown) as
NATURAL, and codec id 53 keeps `manual:0` in its encoder, because persisted state
reaches the solver without passing `sanitizeTune`. Deleting either strands every
saved NATURAL tune.

**The `arbBalModeEarly === 'man'` branches in `feelToPhysics`** — reachable
only on the first render after loading pre-migration state, before the
migration effect fires. Not reproducible in a browser test, and exactly the
path that would break a real user's saved tune.

**`CODEC_VERSION`** — do not bump casually. `decodeTune` throws on any
mismatch, which invalidates every share code in existence.

**Codec ids** — permanent. If a field is ever removed, retire its id in
[CODEC.md](CODEC.md) and in the "Retired ids" comment rather than reusing it.
No id has been retired so far.

**The `rsToHz` 0–100 → Hz conversion** — migrates saves from before Ride
Stiffness stored Hz directly. Also called by `autoTagsOf` before `hzCtx`: without
it a legacy `rideStiffness: 50` classifies as RACE instead of ROAD. That failure
only shows on old entries, so it survives testing on fresh data.

**`suspos_garage_v1` and `suspos_builds_v1`** — the pre-unification save lists.
They have no UI and no React binding any more; the unified migration effect's two
`getItem` calls are their **only** readers, which is exactly what makes them look
like dead keys. Deleting them, or that effect, silently loses every saved chassis
and build for anyone who hasn't opened the app since the unification. Same for
the two sentinels — clearing one causes its migration to run a second time.

**`suspos_saves_v9`** — first link of the same chain
(`suspos_saves_v9` → `suspos_builds_v1` → `suspos_garage_v2`). Removing the middle
link breaks the tail for users who skipped a version.

**`ch.motionRatioF` / `motionRatioR`** — read by nothing in the physics layer, only
by `springOut`/`dampOut` at the display boundary. That is intentional, not an
oversight: Hz, roll stiffness and the balance model are wheel-rate quantities and
must not move when a motion ratio is entered. A grep for these keys inside
`computeTune` will correctly find nothing.

**`ch.arbMotionRatioF` / `arbMotionRatioR`** — the same arrangement for the ARB
drop link, and equally absent from `computeTune`. Read at exactly three places,
which must stay in agreement or a value will not round-trip: `arbOut` (the N/m the
ARB rows and the VISUALS ARB track print), the MAN-mode entry field that inverts it, and the
TUNE CHECK import that converts a pasted N/m back to roll stiffness. Separate from
`motionRatioF`/`motionRatioR` on purpose — spring mount and drop link are
independent geometry.

**`ARB_UTIL_REF`** — looks like a fourth game limit but is not a ceiling and
nothing clamps to it. It is only CO-SOLVE's utilisation denominator when the game
mode has none, and it cancels between the two sides of that comparison except at
the saturation clamp. Deleting it or replacing it with `1` changes CO-SOLVE's
answer at extreme balance targets.

**`_basicBudget`'s `?? ARB_UTIL_REF` guards** (two sites) — BASIC mode's button is
hidden in physical modes, so these look unreachable. They cover a persisted
`arbMode:'basic'` surviving a game-mode switch before the migration effect runs.

**`TutorialPanel`'s `right` positioning fallback** — still unreachable (every
`setPos` sets `left`). The GARAGE drawer is the first right-side, full-height
tutorial target, and it does *not* reach that branch: a full-height element leaves
no room above or below, so `measure()` falls through to `setPos(null)` and centres
the card, which then draws over the drawer (card z700, drawer z200). Verified, not
assumed. The fallback stays as a cheap defensive branch.

**The mobile sidebar stays mounted when closed** — below 768px the drawer keeps
`display:flex` and hides at `translateX(-100%)` + `visibility:hidden` (visibility is
delayed on close). Switching it back to a `display:none` toggle looks like a tidy
simplification, but a transform can't animate out of `display:none`, so the slide
would stop working. Two things depend on it: `TutorialPanel.measure()` drops rects
with `right<=0` (otherwise it would anchor the card to the parked drawer), and it
measures a second time at 260ms, after the .2s slide.

---

## Intentionally absent — do not add back

The mirror of the section above: things whose *absence* is a decision, where
the git history makes the removal look accidental.

**Manual brake bias / brake pressure.** `brakeBias` is computed only
(`const brakeBias=recBrakeBias`), with no AUTO/MANUAL toggle. There used to be
one — `7932982` added it, `1c66ba2` removed the UI, and `082d51e` pruned the
now-dead `brakeManual`/`brakeBias`/`brakePressure` state and their codec ids.
`1c66ba2`'s commit message is about tutorial card positioning and never
mentions brakes, so this reads like collateral damage in the log. **It was
deliberate.** SUSP.OS produces a starting point to enter into the game; users
finalise by feel in-game, like other tuning calculators. A manual brake field
is only reachable after the user has finished with the calculator, so it earns
nothing. Same reasoning covers alignment being auto-only outside PRO's
Alignment Mode. Retired codec ids are never reused — see
[CODEC.md](CODEC.md).

---

## Testing reality

The suites live in `tests/` and resolve `index.html` and `docs/` from the repo
root, so they run from any working directory.

There is **no CI, no linter, no type checker, no build step, and no git
hooks.** `tests.js` tests a hand-maintained duplicate of the physics functions,
and its final section — mirror vs app — lifts the real definitions out of
`index.html` and fails if any mirror disagrees with its app counterpart. A tripwire
fails the run if a mirror is added without a comparison, including one hidden inside
a test block (detected by sharing a name with an app definition). What it still
cannot prove is how `computeTune` composes those functions. See the Test coverage
section of [PHYSICS.md](PHYSICS.md).

**`tests-docs.js` is the docs equivalent**: it reads `index.html` and `docs/*.md`
and fails when a fact stated in prose no longer matches the code — a drifted codec
id table, an enum value no doc mentions, an encoder index that no longer
round-trips through its decoder array, a storage key that vanished, a slider range
contradicting `sanitizeTune`, a section missing from the `open` state, a broken
doc link. It exists because a docs audit found ten errors and eight of them were
mechanical. It checks names, ids, keys and numbers, and prose only where a doc
quotes the UI word for word — [HINTS.md](HINTS.md) and TUTORIALS.md's Step text —
comparing the quote with the code in both directions. It never judges whether
prose is right.

**`tests-beamng.js` is the exception**: it lifts the real physics layer out of
`index.html` with string slices and drives it directly, so it *does* fail when
the app breaks. It exists because the physical-unit mode is defined by what it
declines to do to the solver's output, which a mirror cannot express — a mirror
of "return the value unchanged" asserts nothing. If its `slice()` markers stop
matching after a reorganisation, fix the markers; don't delete the suite.

**`tests-history.js` reads `index.html` too** and tests the shipped `makeHistory`:
commit/undo/redo round trips, burst coalescing, no-op steps, labels and the cap.

**`tests-share.js` reads `index.html` the same way** and covers the share parts:
`SHARE_PARTS` coverage and disjointness against `CODEC_FIELDS`, each part merging in
isolation, an empty parts map changing nothing, no mutation of the current tune, and a
decode/encode round trip merging identically. A codec field added without a part fails
here — that is the check the split exists to keep honest.

**`tests-balance.js` reads `index.html` the same way**, and is the only suite that
tests a model rather than a mechanism. It asserts the mech-balance chain's *shape* —
monotonicity, Kf/Kr scale invariance, front/rear mirror symmetry, continuity and
non-saturation, the balance band's overshoot direction, and continuity across the
gap's sign crossover just under 50% front bias — rather than expected values, because
most of that chain has no measured ground truth and pinning today's numbers would make
every legitimate recalibration a failure. The two properties with history are the
DRIFT band's sign inversion and `balanceBandRange`'s V-shape miss; both are now
properties rather than anecdotes. It also covers `balanceEnvelope`. Writing it found
a live bug on its first run — `mechBalanceLLT` reversing direction past inside-wheel
lift, since fixed with a transfer cap; see [HISTORY.md](HISTORY.md). Its monotonicity
test carries **no** exemption for the lifted region, and must not be given one again.

**`tests-dna.js` reads `index.html` the same way**, for the same reason: the DNA
compiler drives the real solver, so only the real solver can test it. Where it can, it
checks DNA against the app's own flags (`shareClamped`, `mechBalClamped`,
`dampingClamped`) rather than against itself.

So the only real verification is the browser. A reasonable routine after a
non-trivial edit:

1. Compile-check `#app-source` through Babel (catches the page-blanking case).
2. Load the app; confirm `#pre-load` is empty and the console is clean.
3. Exercise the tiers the change touches — BEG, INT and PRO gate different
   code, and VISUALS, the expanded balance panel, and the modals are not
   reachable from a cold load.
4. Round-trip a share code (SHARE → LOAD CODE) if anything near the codec,
   defaults, or `sanitizeTune` moved. Read the code, tick one part, APPLY SELECTED,
   and confirm the unticked parts did not move; then COPY LINK and open the `#t=`
   URL, which must stage rather than apply.
5. `node tests/tests.js` if any mirrored physics function changed. Its mirror-vs-app
   section now reports drift by name and input; update the mirror to match the
   app — the app is the truth, the mirror is the copy.
6. `node tests/tests-beamng.js` if anything in `computeTune`, `GAME_LIMITS`, or the
   unit constants moved. This one reads `index.html`, so it needs no mirroring.
7. `node tests/tests-docs.js` after any docs edit, and after touching the codec,
   `sanitizeTune`, storage keys, the `open` state, or a slider range. Also reads
   `index.html`, so it needs no mirroring either.
8. `node tests/tests-dna.js` after touching `feelToPhysics`, `computeTune`,
   `resolveFeEffective`, `sanitizeTune`, `DEF_FE`/`DEF_DR`, the Damping Bias / EXIT /
   ENTRY slider expressions, `settleZetas`/`dampRate` (which `dnaReadBack` inverts), or
   anything under the `── Vehicle DNA ──` banner. Reads `index.html` too.
9. `node tests/tests-share.js` after touching `CODEC_FIELDS`, `SHARE_PARTS`, `mergeTune`,
   or `sanitizeTune`. Reads `index.html`; the picker UI itself still needs the browser.
10. `node tests/tests-history.js` after touching `makeHistory`. It covers the stacks only;
   the wiring (which setters record, when bursts end, the restore guards) needs
   the browser: drag a slider, load a preset, APPLY a DNA, then undo and redo
   through all three, and cross a game mode with MAN ARBs.
