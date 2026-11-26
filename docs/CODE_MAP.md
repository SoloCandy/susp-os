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
runs it through `Babel.transform` (preset `react`, no plugins), and evaluates the result with indirect `eval` — indirect specifically so
errors stay catchable on iOS WebKit.

Two things about that compile are deliberate:

- **No `env` preset.** Every supported browser runs the modern syntax natively
  (`?.`, `??` and `??=` set the floor at Chrome 85 / Firefox 79 / Safari 14), and `env`
  took about 5 s of every load. Only JSX needs compiling.
- **`const`/`let` reach the browser as written.** Nothing turns them into `var`, so
  reading one above its declaration throws "Cannot access 'x' before initialization"
  instead of quietly yielding `undefined`: declare before you read. A module-level read
  blanks the page on load; a read in `App`'s render body, a dependency array or a
  `useMemo` body throws on the first render that reaches it, which the `ErrorBoundary`
  catches. A read inside a callback, effect or handler is fine as long as it runs after
  the declaration. `transform-block-scoping` used to hide these; see HISTORY.md before
  bringing it back.

**The compiled output is cached.** The bootstrap keeps one IndexedDB record
(database `susp-os-boot`, see [PERSISTENCE.md](PERSISTENCE.md)) holding the compiled
code beside the exact source and settings it came from, and runs it without Babel when
both still match. `babel.min.js` (~3 MB) is no longer a `<head>` script: it is injected
only on a miss — the first visit, and the first after a push that changes `#app-source`,
the Babel version or `OPTS`. A miss compiles, runs, and only then writes the record, so
a source that throws is never cached. Any IndexedDB failure is a miss, and a read that
hasn't answered in 1.5 s is treated as one.

**CDN scripts are hash-pinned.** React, ReactDOM and the injected Babel script all
carry an `integrity` hash (SHA-384) with `crossorigin="anonymous"`, so a CDN serving
different bytes is refused rather than run. `BABEL_SRI` is part of the cache key, so
a compile cached before the check existed is redone once. **Bumping a version means
replacing its hash** — hash the new file (`openssl dgst -sha384 -binary f | openssl
base64 -A`), ideally from two CDNs, or the app stops loading.

This is why there is no build step, and it shapes how failures appear:

| Failure | What the user sees |
|---|---|
| Cache miss and the Babel script can't load (offline, CDN blocked, hash mismatch) | `#pre-load` shows "Babel failed to load" |
| React or ReactDOM fails to load (including a hash mismatch) | `#pre-load` shows "Runtime error" (`React is not defined`) |
| Babel can't parse the source (JSX/syntax error) | `#pre-load` shows "Babel compilation failed" + the message |
| Source parses but throws while evaluating | `#pre-load` shows "Runtime error" + the message |
| React renders but a component throws | `ErrorBoundary` renders "SUSP.OS — Failed to load" |
| All good | `#pre-load` is hidden and empty |

Two consequences worth knowing when editing:

- A syntax error blanks the whole page. `#pre-load` is the first thing to
  check when the app won't load.
- You can compile-check the app from the browser console without rendering it:
  `await compileAppSource()` compiles `#app-source` with the bootstrap's own settings,
  loading Babel first when this load was a cache hit, and rejects on a syntax error.
  That is the cheapest gate available, and since CI runs only the Node suites (none of
  which compiles the JSX) and there is no linter, it is worth using after any JSX edit. A cache hit never needs Babel, so `Babel` itself is
  undefined after one.

---

## Region order

The source runs top to bottom in this order:

0. **Colour meanings** — first in `#app-source`, under the `── colour meanings ──` banner:
   `C_OS`, `C_US`, `C_WARN`, `C_ERR`, `C_GOOD`, `C_TAG`, `CAT_RAMP`, `LANE_DIFF`, `T_MUTED`,
   `T_FAINT`, `SLI_FILL`. They come first because module-scope tables below them
   (`HZ_BAND_COLS`, `diffCtx`) read them at load. What each means is in
   [VISUALS.md](VISUALS.md); colour a value by its meaning through these, not a hex.
   The suites that slice `index.html` load this block first (up to `const KG_TO_LB=`), since
   their other slices read it; a new top-level constant that sliced code reads needs the same.
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
3. **Defaults and presets** — `DEF_CH`, `DEF_FE`, `DEF_DR` (alignment included), `migrateLegacyAl`,
   `PRESET_SAVES`, `BUILD_PRESET_MAP`, `DNA_ARCHETYPES`.
4. **Persistence primitives** — `mergeDefaults`, `usePersist`, then `GITHUB_MARK`, `LIVE_URL`,
   `DOWNLOAD_URL`, `appSourceOf` and `useDeployCheck` under a `── Deploy check ──`
   banner, then the undo / redo core
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
9. **Bootstrap** — the compile-cache/Babel/eval block described above. It sits outside
   `#app-source`, so the deploy check never sees a change to it (see
   [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

### Pure physics entry points

These are pure functions of their arguments, in dependency order:

```
resolveFeEffective(ch, fe, build, ph)  → resolves the stored Balance Target (NATURAL /
                                         RANGE / GRIP / PHASE / MANUAL) into the absolute
                                         target (App's feEffective)
feelToPhysics(ch, fe)                  → resolves feel settings into physics
                                         (front/rear Hz, ζ per axle, ARB mode…)
computeTune(ch, physics, gameMode)     → springs, dampers, ARBs, balance
solveTune(ch, feEffective, gameMode, build, ph)
                                       → feelToPhysics + computeTune, repeated in the
                                         target modes until the DISPLAYED balance
                                         meets the target; every caller goes through it.
                                         Returns the target it aimed at as `target`
                                         (RANGE's, GRIP's and PHASE's move with stiffness in Forza)
computeDiff(ch, fe, dr)                → differential locks (independent)
computeAlignment(ch, tune, layout, …)  → camber/toe/caster, from the tune
                                         (each through alignRec: 0.1° rounding, then
                                         the ALIGN_REC band; ALIGN_GAME is the game's span).
                                         Also returns limit (alignAtLimit, per value) and
                                         why (the terms each value sums, for the card hint)
```

Balance Target helpers: `balTargetModeOf` (normalises the mode, legacy `'manual'` → NATURAL),
`balanceBandOf` (the Balance Guide RANGE band: the build's grip-margin band from
`BALANCE_BAND_MARGINS` carried to mech balance at a given K — the RANGE row, the target sliders'
zones, GRIP GAP and RANGE mode all read it; App holds one `balanceBand` at the tune's K), `balTargetAnchorOf` (the unclamped RANGE/GRIP/PHASE anchor at a given K — Balance Offset is
measured from it),
`balTargetAnchoredOf` (RANGE/GRIP/PHASE target at a given K: anchor + offset, clamped).
PHASE: `phaseInOf` (normalises the brake bias or ENTRY BRK target, drive split and EXIT Load
App hands in as `ph`; without `ph`, BRK 0 and the layout's own drive split), `idealDriveFOf` (the
traction-neutral drive split, which the recommended AWD split also starts from), `phaseRsOf` (the
roll-stiffness fraction the margins read from a tune), `exitSplitOf` (POWER SPLIT's SOLVE EXIT:
the whole split whose DRIVE is nearest a target, solved in App and handed to `computeDiff` in
place of the stored split, PRO only and idle under PHASE), `phaseTermsAt` (BRK and
DRIVE at a split — `phaseMargins` reads it too, so the target balances the figures the panel
shows), `phaseMidOf`, `gripMarginSplitOf` (the split at a given grip margin), `phaseSplitOf`
(PHASE's split, a short fixed point with a one-entry memo) and `phaseNeutralOf`, which carries it
into display space through `splitDisplayOf` exactly as `gripNeutralOf` does. `awdCenterOf` is
the AWD centre split `computeDiff` applies, shared so App's PHASE inputs can read it before the
diff exists; on a Sport diff it is `SPORT_AWD_CENTER`, a stand-in, whatever split is stored. `recommendedCenterOf` is the recommended split and its parts, pure so App's
`setBuildType` can carry the split from one build's recommendation to the next. `diffTypeOf` is
the diff type the game applies (`DIFF_TYPES_BY_GAME`); `computeDiff`, `diffView`, the DRIVETRAIN
controls, the garage chips, `measureDNA` and the hide-item gates read it, never `dr.diffType`
directly, so a Motorsport or BeamNG tune never acts on a stored Horizon type. App builds `phaseIn` ahead of the solve from nothing the tune decides, and passes it
to `resolveFeEffective`/`solveTune` only while PHASE is the mode (`phaseInLive`).

Supporting: `rsToHz`/`hzToRs`, `flatRideRearHz`, `flatRideSharedHz`,
`solveSpring`, `solveDampRaw`, `settleZetas`/`forceZetas`/`balModeZetas`
(Damping Balance Mode's front/rear split — `balModeZetas` is the by-mode
dispatcher; `splitDampZetas` wraps it with STANDARD's percentage swing and the clamp,
`floorDampPair`, which lifts both axles together off the 10% floor so the split survives,
and is called once per stroke: the rebound anchor, then the bump anchor unless RATIO
bump on SAME just scales the rebound pair. `ownBumpBalMode` resolves BUMP BALANCE,
null for SAME and for EQUAL CATCH outside LANDING; `catchZetas` is EQUAL CATCH's per-axle
landing solve, used in place of `splitDampZetas` for bump, with the floor kept in drops), `damperMetrics`
(the DAMPERS table's per-axle readings off a tune's final ζ and Hz: rebound/bump ζ, settle, force share,
bump settle and bump force, roll ζ, catch — one source, so any other readout of what a balance mode
equalises quotes the table's figures) with `damperTargets` (which of those keys Damping Balance Mode and
an own BUMP BALANCE equalise — the table's highlighted rows), `peakCompressionFactor`/`landingTravel`/
`landingCatchDrop`/`landingBumpZeta`/`landingRef`/`clampLandingPct` (BUMP MODE → LANDING: the drop-height
solve and the per-axle Catch figure; `BUMP_STOP_ZONE` is the travel kept clear, shared with the SAG
chart's shading — see PHYSICS.md "LANDING bump mode"), `cornerMasses`,
`rollCenterHeight`, `axleRollStiffness` (one axle's spring roll stiffness from
its Hz — unrelated to `hzToRs`, the legacy Ride Stiffness slider mapping),
`rollMomentOf`, `clampBalTarget` (the Balance Target's stored `BAL_TARGET_MIN..BAL_TARGET_MAX` band, 0.05..0.95, which the Balance Guide strip spans under SHOW FULL — by default it zooms to its markers, see `guideFull`; its controls step and round by `BAL_TARGET_STEP`, 0.005, through `roundBalStep`;
`sanitizeTune` clamps the stored DELTA instead), `clampHz` (the HZ_MIN..HZ_MAX band — callers that also
REPORT a clamp still test their own raw value), `wheelStepOf` (one FeelSlider wheel
notch — it steps from the slider's bound value, which is why every slider binds the value
it stores), `hasBalTargetSolve` (is anything
solving toward the Balance Target — ARB balance mode MECH/CO-SOLVE, or Rear Hz
Mode MECH even under MAN ARB), `mechSpringSplit` (Rear Hz Mode MECH outside CO-SOLVE: the target
conversion, WEIGHT/CHASSIS bar dilution and the bisected spring Hz ratio both Ride Reference paths of
`feelToPhysics` share; MAN ARB's closed-form solves stay per path, and read the bars through
`manArbRsOf`), `neutralCancelOf` (NEUTRAL CANCEL as the bars run it, MAN excluded; App hides Hz MODE MECH under it and its `dropHzMech` carries a stored MECH to MULTIPLIER), `autoReachBudget` (AUTO's bar budget grown to reach a MECH/CO-SOLVE target; `computeTune` and
`resolveCoSolveSpringShare` both call it, so Auto Spring Share judges the budget the tune gets),
`manArbIn` / `manArbRsOf` (MAN's typed bars clamped as `computeTune` reads them,
and as roll stiffness), `crossArbUnits` (carries MAN bars across a click/physical game-mode
change; the game-mode selector and `mergeTune`'s SPRINGS-without-ARB case call it), `tyreWidths` / `tireCorrOf` (section widths with the 265 mm
fallback, and the tyre-width mech-balance correction), `arbScaleOf(ch, axle)` (one axle's ARB click scale: MEASURE ARB's value — the rear's own when
`measuredArbClickR` is set — or `ARB_RS_SCALE`), `arbClickRsOf(ch, axle)` (that scale times the axle's
track²: every click↔roll-stiffness conversion goes through it), `arbScaleSplit` / `fmtArbScale` (whether
the stored scale is a front/rear pair, and how the card prints it), `arbScaleStale` (true when a measured scale's recorded MEAS. NAT BAL or Hz no longer matches the chassis — drives the ARB SCALE SETUP card's and sidebar's RE-MEASURE flags), `arbProbesOf` (step 2's four bar setups),
`arbProbeBalOf` (the display model a step 2 reading is compared against, as a function of front
and rear scale), `fitArbScales` (step 2's fit: one shared scale when one explains every reading
within rounding, else a front/rear pair, with per-reading residuals and a misfit flag),
`arbReadReachable` (whether any pair could produce a reading — the CHECK marker), `solveArbScale`
(the one-reading, one-scale bisection on the same model), `natGeomOf` (the track-width/corner-mass estimate on its own — the solvers' model
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
`resolveCoSolveSpringShare` and `computeTune`), `parseTyre` (memoised by string over
`parseTyreRaw` — it sits on the grip model's hot path; see [DNA.md](DNA.md)), `axleLatG` (each axle's lateral
capacity per unit of its own weight, optionally under braking or drive — the grip model's core),
`mechBalanceLLT`, `balanceFromRsBal`, `gripMargin` / `phaseMargins` / `ENTRY_G` / `EXIT_G` (PRO's
Handling Balance in grip-margin percent, by phase; see [FORMULAS.md](FORMULAS.md) "Phase margins"),
`loadTransferOf` (PRO's LOAD TRANSFER readout, from `latLoadTransfer`; see [FORMULAS.md](FORMULAS.md)),
`axleGrip` (`axleLatG`'s raw axle forces before the friction circle), `gripUseOf` (PRO's GRIP USE
prediction, by phase), `gripBrakeBiasOf` (BRAKES' GRIP Centre: the straight-line brake bias at which
both axles reach their limit together), `entryBrakeBiasFor` (BRAKES' ENTRY Centre: the bias that
puts ENTRY's BRK on a target) and `driveFrontOf` (the front axle's share of drive, shared with `phaseMargins`),
`gripNeutralSplitOf` (the roll-stiffness split at which the grip model reads neutral — the
reference `computeTune`'s `bChassis` measures from; see [FORMULAS.md](FORMULAS.md)),
`gripMarginSplitOf` (the split at which the grip margin reads a given value — PHASE's target
and the RANGE band's edges), `balanceBandMargins` / `BALANCE_BAND_MARGINS` (the RANGE band per
layout and build, in grip-margin percent) and `bandSplitOf` (`gripMarginSplitOf` for a band edge,
remembered per chassis object in a `WeakMap`, since RANGE mode reaches it on every solve),
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
(CO-SOLVE's Auto Spring Share search) and `coSolveRearOf` (the rear Hz CO-SOLVE
solves for a front Hz, unclamped, from that search — `computeTune` clamps it into
`effectiveRHz`, and `feelToPhysics` bisects on it to honour a REAR or SHARED Ride
Reference, so the slider and the solve answer to one function), `rideRefSwitch`
(the RIDE REF. buttons' fe: re-anchors on the pre-snap Hz, solves the candidate,
and rehomes the Hz mode when re-anchoring alone would move the car; `holdHzMult`
is the ratio grid it, `holdHzRatio` and the MULTIPLIER button seed) and
`bottomGStep` (BOTTOM G's one decision per fire — resolve, mirror or stay dormant
— which App's effect only feeds and applies; pure so `tests-ride.js` can drive
it). `computeCheck` backs the TUNE CHECK reverse calculator.

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
| `Hint` | everywhere — the ⓘ affordance. Portaled `role="tooltip"`; mouse hover opens it and a mouse click never closes it, a tap or pen tap toggles it, keyboard focus opens it; a press outside, scroll, resize, blur or Escape closes it. It opens below its ⓘ unless `above` is set (from `Card`'s `hintAbove`, used by `SuspensionCard` so the tooltip does not cover the Anti-Roll row) and there is room, in which case it anchors by its bottom edge above the ⓘ. An optional `term` (a `GLOSSARY` id) adds a "TERMS: … ›" link that opens the glossary at that entry through `glossaryBridge.open` — the tooltip then takes pointer events, so the mouse can cross onto the link, and Enter on an open ⓘ follows it. Every component that takes a `hint` prop (`Field`, `FeelSlider`, `VisTrack`, `Toggle`, `Card`, `SuspensionCard`, `AlignCard`, `DiffCard`, `BiasSeg`, `DirSeg`) also takes `hintTerm` and passes it on as that `term`; `HandlingVerdict` and `PhaseVerdict` key theirs in a `hintTerms` object beside `hints`, and a RESPONSE factor row takes an optional `term`. `BiasSeg` and `DirSeg` draw no ⓘ when `hint` is empty. Inside an ancestor marked `data-hint-bound` (only `zone-output`) the tooltip is clamped to that element and starts at the ⓘ instead of centring on it, so an output-panel hint cannot spill over the sidebar or cover the row labels to its left; every hint's text is quoted in [HINTS.md](HINTS.md). An ⓘ inside `.sidebar-scroll` opens its tooltip beside the sidebar, level with the ⓘ, whenever the window has room for it, so it covers the output panel rather than the inputs round the ⓘ; otherwise it opens below (or above) as everywhere else. `pad` gives an ⓘ that directly follows label text (`Field`, `FeelSlider`, Hz Mode) the same 4px lead a flex row's `gap` gives the rest |
| `TermLink` | the same "TERMS: … ›" link inline, for footers and notes that have no ⓘ; `label` overrides `glossaryLabel(id)` |
| `Field` | numeric inputs across all sections. Its box is a `NumBox` and its slider a `SliderTrack`, as `FeelSlider`'s are; `logScale` (the weight sliders) passes `SliderTrack` a `scale`. Its wheel stepping is its own `stepBy`, not `wheelStepOf`: the log-scale step grows past 6000, the lb midpoint, which never applies in kg. A `Field` with a slider prints its `min` / `max` under the track (`fieldEnd`). `stacked` (paired F/R fields sharing a row) gives the label line a fixed 18px height, so an `onCopyFront` field's `= F` button (`CopyFrontBtn`, which the tyre size boxes show as `= FRONT`; the full word truncates a stacked rear label) doesn't push its box below its partner's |
| `NumBox` | Field's always-visible number box on its own: shows the value, commits an edited draft on Enter/blur clamped to `min`/`max`, Escape cancels, never commits an unedited draft. An empty value (non-finite) shows `placeholder`. A `seed` (MEASURE's readings: the value the app expects) replaces that placeholder, greyed, and fills the box on focus; a seeded box — or one with `commitOnEdit` — commits only once it has been **edited** (`editedRef`), not when its draft differs, so tabbing through leaves the reading unset and typing the expected value itself still commits. "Edited" comes from `onInput`, not `onChange`: React drops an `onChange` whose value equals the last one it saw, so pasting a box's own text over itself wouldn't count. `onEnter` runs after Enter commits; every `.num` box keeps a visible border, so an empty one still shows where it is. Rendered by every `Field` and `FeelSlider`, and by Tune Check's MEAS. NAT BAL. The unit beside every `.num` box (`NUM_UNIT_STYLE`) keeps a two-character slot even when empty, so boxes with `lb`, `%` or no unit end at one right edge; `.sidebar-scroll` reserves its scrollbar gutter (`scrollbar-gutter: stable`) so that edge, and every selector's column count, doesn't jump when a section opens |
| `FeelSlider` | BEG feel sliders, every INT/PRO slider that isn't a `Field`, and the DNA editor. Always renders a `NumBox` beside the label, CHASSIS-style; `readout` is secondary text to its left; the track is a `SliderTrack`, given its `bands` / `refs`. `box` sets the unit and can override `value`/`onCommit`/`min`/`max`/`dp` where the stored field isn't the slider's (Target Speed, POWER SPLIT, INDEPENDENT's effective Hz) |
| `OptionSeg` | every option selector in the sidebar: a `role="group"` of `.tog` buttons in equal columns. One row while the longest label fits a column, otherwise the fewest balanced rows (6 → 3 + 3, 5 → 3 + 2), never a 5 + 1 wrap. It measures its own width (`ResizeObserver`) and estimates label width from character count (`SEG_CH`, `.tog`'s 11px mono plus tracking), so a new label needs no tuning. Inside a `Hide` it also drops the layout's hidden choices (`HIDE_OPTS`, by each button's `data-opt`) before counting columns, keeping the selected one (`.opt-kept`, dashed) and, in the edit view, fading them all (`.opt-off`). Distinct from PhaseVerdict's local `Seg`, a `BiasSeg` preset |
| `Toggle` | a labelled `OptionSeg`: the label and ⓘ on their own line, the buttons under it. Hand-built selectors (Stiffness Mode, Balance Mode, Hz Mode, Diff Type, …) follow the same label-above layout around their own `OptionSeg` |
| `SliderTrack` | the track under every `Field` and `FeelSlider`: the range input, its fill, the markers, their label row and the end labels; the label row and box above stay with each caller. Markers are of two kinds. `bands` are zone rows (see the Zone tables below), with a tick at each inner edge, each label centred in its region, and the active region underlined, its label bright. `refs` (`{value, label?, prio?}`) are fixed points, always drawn, a labelled one a button that sets the slider to it and bright while the value sits on it. They replaced a single `markers` prop whose ticks lit once the value passed them, which read backwards wherever a label named the region below its tick (Settle Target). After layout, labels that collide are hidden by priority (a ref the value sits on, the active region, refs by their `prio`, the other regions) and pulled inside the track's ends, re-run only when the active region, the labels or the track width change. `aria-valuetext` is the caller's `valueText` plus the active region's or reference point's label |
| Zone tables (`HZ_ZONES`, `ZETA_ZONES` with `ZETA_REFS`, `SETTLE_ZONES` with `settleGrade`, `BUMP_RATIO_ZONES`, `WEIGHT_BIAS_TYPICAL`, `BIAS_CENTRE_LABEL`, and the builders `zoneAround` / `typicalMarks`) | module-level `[lo, hi, colour, label]` rows. `zoneAround(lo, hi, label)` makes a one-region table for a single band (TYPICAL, RANGE); `typicalMarks(r)` turns a `DIFF_TYPE_RANGES` pair into SliderTrack props, a point where the pair is one value — the shape `VisTrack`'s and `SliderTrack`'s `bands` both take — so a slider and the readout or VISUALS track grading the same quantity read one table. `tests-docs.js` fails if a graded slider stops passing its table by name, or any slider passes a literal bands array. `SliderTrack` ignores the colour column: it shows the active region by brightness |
| `SliderEnds`, `sliderPosOf`, `withUnit` | the end labels under every slider (`FeelSlider`'s `leftLabel` / `rightLabel`, `Field`'s range), the CSS `left` that lines a tick or label up with the thumb's centre at a value, and a number with its unit, spaced as the end labels are (none before `%`, `°`, `×`, `÷`) |
| `Sec` | the ten collapsible sidebar sections (`div.stog` header), MY CONTROLS included. Every call spreads `{...secProps(key)}` from `App`: `hid` (its `SECTION_VIS` key), `vis` (`show` / `stub` / `none`, from `secVis`) with `onShow`, and `hiddenChanged` / `onShowHidden` for the line about changed controls hidden inside it, and `pinned` / `onPinJump`: how many of its controls show in MY CONTROLS. With any, its body stays mounted out of sight while it is shut or hidden (the pinned controls are built there), and when open it starts with "★ n in MY CONTROLS" and GO. RESET is a two-click button at least 64×26 px: the first click turns it into a filled amber SURE? for 5 seconds. In the layout edit view (`LayoutCtx.edit`) the header still collapses and expands it, and RESET's place holds a HIDE / SHOW button of the same size for the whole section; a hidden section stays shut and faded until it is shown again. Hooks run before the early returns, so a section's hook order never changes with its visibility |
| `HiddenStub` | the one-line notice for hidden settings that still apply: amber dot, optional title, `text`, SHOW. Used for a whole hidden section that `sectionChanged` says differs from its defaults ("hidden · changed settings still apply"), and for changed controls hidden inside a shown one (`hiddenChangedIn`) |
| `LayoutCtx`, `Hide` | the layout edit view. `LayoutCtx` (beside `HideIdCtx`, which tells an `OptionSeg` which `Hide` it is in) is `{edit, guide, isHidden(id), toggle(id), isPinned(id), pinOn, togglePin(id)}`, provided by `App` (an empty hidden list while a guide runs, and `guide` set). `Hide id` wraps one hideable part: in the regular view it renders its children unwrapped, or nothing when hidden; in the edit view the children sit `inert` under a full-cover `.hz-btn` that toggles the id, inside a dashed indigo outline (faded and grey-dashed when hidden). The edit view also frames the sidebar and `zone-output` (`.layout-editing`) and pins the sidebar's ✎ EDITING LAYOUT bar (`data-layout-edit-bar`), so it reads as a different mode without hover — touch has none. While a guide runs it renders the edit view's two levels without the button or `inert`, carrying `data-hid`, so a step's spots can find the part (see [TUTORIALS.md](TUTORIALS.md#spots-single-controls-cards-and-bar-parts)). `inline`, `style` and `bodyStyle` only shape those wrappers. A pinned id (`isPinned`, while `pinOn`) renders through a portal into its MY CONTROLS slot instead; in the edit view a pinnable part gets a ☆ / ★ button (`togglePin`). See "MY CONTROLS" under Layouts. **Never nest one `Hide` in another**: the inner one would be inert. That is why `Card` and `Sec` carry their own header toggles |
| `LayoutPanel` | the layout panel (── LayoutPanel ──, before `MenuButton`). Rendered by `App` while `layoutPanel` holds a tab, absolute over the tune pane beside the garage drawer's slot (full width on a phone, above the views, under the header). It is not modal and owns only view state (open section rows, a two-tap delete, a status line): every change goes straight to `layoutStore` through props, so the sidebar and output update live. The SIDEBAR / TUNE / VISUALS tabs list `HIDE_ITEMS` by `sec` and `label`, filtered by `hideIdApplies(id, tier, game)`, as checkboxes (ticked = shown); the SIDEBAR tab also reorders sections and sets START OPEN and JUMP CHIP per section (`editLayout` is `App`'s `editActiveLayout`); LAYOUTS holds the tier × game assignment, rename, DUPLICATE, DELETE, NEW, EXPORT ALL and IMPORT (`importLayouts`). Escape or DONE closes it; so do a guide starting, BEG, opening the garage, and on a phone any tab |
| `hid` on `OutRow` / `Card` | the output panel's hideable parts. `OutRow hid` goes through `Hide`; `RowGroup` drops hidden `OutRow` children (by their `hid` prop) in the regular view and renders nothing once none are left. `Card hid` puts the toggle on the header only, so the rows stay clickable, and a `<Keep>` child (the card's warnings) still renders on its own when the card is hidden. `Card` always puts `data-hid` on its root, for guide spots. `SuspensionCard` / `AlignCard` / `DiffCard` take `hid` and give their rows theirs |
| `SrcHead` | `group` (`HIDE_ITEMS` ids) drops the header in the regular view once everything under it is hidden |
| `SrcHead` | a group header inside a `Sec` naming where its inputs come from. PRO's CHASSIS uses three: FROM THE GAME, LOOK UP ONLINE and ESTIMATES (the last only when MANUAL CG or `physMode` puts something in it). Below PRO CHASSIS has none |
| `Card` | section wrapper in the output panel (title, ⓘ hint, `headerRight`) |
| `OutRow`, `RowGroup` | the output panel's value rows and their bordered groups — single column for Forza (`horizon`/`motorsport`), capped at 680 px and centred (`.forza-out`), and from 960 px of panel width its cards flow into two CSS columns (`.forza-cols`); assembled into the BeamNG two-column layout's cards below when `physMode`. A `meta` entry is a string or `{text, on}` (always shown; `on` brighter, as BeamNG's `≈` and NEEDS <0 tags use), or an output figure `{k, kind, text}` that `useFigs` shows by the layout's `figs` (see Output figures under Layouts). The meta figures share one wrapping box, so on a phone they fold under the label rather than push the value off the card. `OutRowBody` also marks a changed value: it reads `OutGenCtx`, a counter App bumps whenever `ch`, `fe`, `dr` or `al` changes identity (`outGen`), and keeps its last printed value in a ref, so a row whose text moved in the latest generation gets a blue left edge and a "was …" title until the next one. A units toggle changes no generation, so it never marks rows. The ref is written during render on purpose: it is idempotent for one generation, so a re-render never moves the mark |
| `dampView` (App, not a component) | the DAMPERS output built once for both layouts: the header (balance mode and bump source, never an intermediate solve value), each damper row's `note` and `meta` from `damperMetrics`/`damperTargets`, the per-axle landing warning and the direction-aware clamp warning. The Forza DAMPERS card, the BeamNG `SuspensionCard` rows, the suspension mode line and the warnings list all read it |
| `arbView`, `springView` (App, not components) | the ANTI-ROLL BARS and SPRINGS output built once for both layouts, like `dampView`. `arbView`: header = stiffness mode · balance mode · achieved roll, read from `physics` (so MAN's CO-SOLVE-to-WEIGHT override shows as MAN); rows' `% roll` (`arb.roll`) and `% ARB` (`arb.share`) are info figures, `set` while the balance mode sets one (EQUAL ROLL the first, WEIGHT and CHASSIS the second), note FLOOR/CEILING from its `pin`, which the roll warning reuses. `arbView` and `springView` also return `head`, the same header in words for the Forza cards, and each row a `metaF` that spells out `% roll` / `% ARB` ("of axle roll", "of both bars"; `arbRowMeta`'s `long` flag); BeamNG's cards and suspension mode line keep `header` and `meta`, whose narrow per-axle rows the long form would wrap. `springView`: header = Hz mode with its setting (CO-SOLVE's Spring Share in its place) · ride reference; SHARED quotes the g the solve ran on, from Ride Stiffness, not the stored `rideBottomG`. Rows carry `% roll`, Hz, bottom-out g (with ride heights known), the rear's R/F ratio and static sag, each with its kind, and flag CLAMPED (an axle at the Hz band edge while `rearHzClamped`) over LIFT RISK over the Hz band. The Forza cards, the BeamNG `SuspensionCard` rows and the suspension mode line read them |
| `alignView`, `brakeView`, `diffView` (App) | ALIGNMENT, BRAKES and DIFFERENTIAL output for both layouts. `alignView`: header (AUTO · build, `· ADJUSTED` while an intent offset is set, or MANUAL), camber rows' `dyn` (from `camberGainOf`, the gain `computeAlignment` uses), toe IN / OUT, caster's steer camber, an `AUTO x°` tag on any row moved off `autoAlign`, LIMIT notes and the `why` terms for the card hint. The alignment itself is `align = alignOut(autoAlign, dr, uiMode)`. `brakeView`: header (the Centre, or STOCK), the row's centre and shift, PRO's GRIP bias beside REC or ENTRY (`gripBrakeBias`), and LIMIT when the 40–68% clamp moved a REC/GRIP bias. `diffView`: header (AUTO/MANUAL · type · MATCH CHASSIS) and `meta(v)`, the effective lock on non-Race types (`metaF(v)` on the Forza card: "acts like N% RACE"). Each of these, and `dampView`, also returns `head`, the header in words that the Forza cards show; `header` stays for BeamNG. BeamNG's per-axle alignment and diff cards each carry the short `header`, as does its single BRAKES card. `HINT_BRAKES_OUT` is the BRAKES hint both layouts share |
| `outWarns` (App), `OutWarn` | every output-panel warning, written once: `outWarns` is `{arb, springs, dampers}`, each a list of `{key, color, text}` (roll target, mech balance, Hz clamp, wheel lift, then `dampView`'s two). Each Forza card renders its own list in a `<Keep>`; BeamNG renders all three, in that order, in one box above its cards (every tier). `OutWarn` is the box both draw. The text used to live in both layouts, so a fix had to be made twice |
| `SuspensionCard`, `AlignCard`, `DiffCard` | BeamNG-only (`physMode`) output cards — per-axle shells built from `OutRow`/`RowGroup`/`Card`. `SuspensionCard` merges the Forza ARB+SPRINGS+DAMPERS cards into one card per axle; `AlignCard` shows Caster on the front side only (no rear caster slider in BeamNG), and the rear card takes `fit` so it ends after Toe; `DiffCard` is a per-axle differential card with the Forza card's hint and `diffView` header. Each card's sections are `Pair` blocks (`data-pair`), which `BeamngGrid` (the 2-column `.beamng-grid`) holds level with the same section in the other column after every render and on resize, so a row that wraps on one side does not push the rows below it out of line; in one column it clears them. Grid order: FWD diff · Brakes, Brakes · RWD diff, or Brakes · Center / Front · Rear diff, then suspension and alignment pairs; no placeholder cells. BRAKES is one row, so its `Card` takes `fit` too (`align-self: start`) and sizes to itself rather than stretching to the diff or CENTRE SPLIT card beside it. Anti-Roll and Spring share one bordered box and the two dampers the next; each row is still its own `Pair` (a `Pair` passes its row's `hid` up so `RowGroup` still drops a hidden row). The rows themselves come from `beamngSuspRows` (with `arbReadsSoft` and `belowTag`), a plain helper beside `BeamngGrid`. The rest of the layout (warnings box, suspension mode line, soft-ARB note, CENTRE SPLIT card) is inline JSX in `App` — see the `physMode` branch in the output panel. The suspension mode line (`out.summary`, INT+) is a full-width grid row right above the suspension cards carrying the ARB, SPRINGS and DAMPERS headers, which a per-axle card would repeat front and rear; the other headers sit on their own cards |
| `CenterSplitRec`, `CENTER_REASON` | the recommended CENTRE SPLIT box, written once for both layouts: Horizon's DIFFERENTIAL card shows it (titled CENTRE SPLIT) only while the split differs, BeamNG's CENTRE SPLIT card always (titled RECOMMENDED); both inside `Hide id="out.diff.recCenter"`. `BUILD_LABEL` / `buildLabelOf` is the build-type name every recommendation line and `alignView` print |
| `DiffTypeRec`, `DIFF_REC_REASON` | the RECOMMENDED diff-type box, on Horizon's DIFFERENTIAL card only (`diffTypePick`): Motorsport and BeamNG have one diff, so their cards, BeamNG's per-axle ones included, leave it out; both wrap it in `Hide id="out.diff.rec"` |
| `Readout`, `Stat` | Tune Check and sidebar readouts — **not** the output panel any more (it moved to `OutRow` so each value is one scannable line to transcribe into a tuning menu) |
| `BiasSeg` | one contributor row in the expanded Handling Balance panel. `scale` is the value that fills a half and `dead` the band read as nothing — the defaults are BEG/INT points; `PhaseVerdict` passes grip-margin percent figures. `muted` greys a row that is context, not a setting (PRO's PITCH). `digits` sets the value's decimals (1; PRO's `Seg` passes 2). `tick` draws a position instead of a fill and drops the share column — the CAR STARTS row, the chassis lean the tuning rows move from |
| `DirSeg` | a contributor with a direction but no calibrated size — PRO's diff lock and damping rows. Shows toward OS / toward US / —, with a blank where a sized row has its figure (it used to say NO SIZE), so the arrows line up with the bars. PRO's PITCH rows pass `scale={40}` to `Seg`, a quarter of the others' scale, so a ±15–20% pitch figure does not fill the row |
| `VisRollSplit`, `VisSuspTracks` (over `VisTrack` and the `visGhost` helper) | the VISUALS column — its RIDE · ROLL · DAMPING group (`open.visRide`). `VisRollSplit` draws the split divide at `tune.mechBalance`, the display-space value the MECH BALANCE strip plots, so its NAT/TGT ticks match that strip; the springs/ARBs shading within each end uses model-space stiffnesses and is a share of that end only. `VisSuspTracks` renders ride Hz, ARB and damping ζ as F/R rows on shared tracks; the Hz and ARB ghost rings (NAT grey, target green) sit on the derived axle, the one Ride Reference does not fix. These replaced the `SpringDial` / `ArbDial` / `DampingDial` arc dials. What each group draws, marker by marker, is in [VISUALS.md](VISUALS.md). The card's other two groups, **DYNAMICS** (the `computeOscillation` step-response chart) and **SAG** (sag vs load, shown only when CG Height Source is RIDE HEIGHT), are inline SVG in `App` rather than components — same as the BeamNG layout above. Grep `visDynamics` / `visSag` for their `open` keys. The **ALIGNMENT** group (`visAlign`, Forza modes) is two components, `VisCamberRoll` and `VisAlignStrips` (with `ALIGN_STRIP_SPAN`). DYNAMICS integrates its trace twice — see `fitDur`/`probeDur`: the window is sized from the analytic estimate, the curve is measured, then the window is re-fitted and re-integrated, because `computeOscillation`'s `nPts` is fixed and its step size (hence the trace) depends on the window length |
| `HandlingVerdict` | expanded handling-balance panel, **BEG and INT**. In INT it takes `alignBal` (`alignBalanceOf`: CAMBER, TOE F, TOE R rows, sized like DAMP) and `phases` (`intPhase`, the three figures at its top); its `total` is INT's MID, BEG's `bNet`. Its dominant-contributor tips name only controls the tier can see: BEG gets the Balance slider (and, for diff, where the lock comes from), INT gets ARB Bias, Damping Bias, the RIDE multiplier and EXIT/ENTRY. It has no brakes row when BRAKES is on STOCK (a null `bBrakeEntry`). The brakes tip explains the BRAKES card's computed bias, which every tier shows, and deliberately does not tell the user to move it — the bar and the card use different neutral points ([KNOWN_ISSUES.md](KNOWN_ISSUES.md)). `GroupSection` is called as a function, not rendered as `<GroupSection/>`: a component defined in the body remounts its rows (and their ⓘ) on every `App` render ([HISTORY.md](HISTORY.md)) |
| `mechReachNote` | a plain helper, not a component: the cause-and-fix sentence the `mechBalClamped` warning in `outWarns` ends with (Forza ARB card and BeamNG warnings list). It works out which bar is at its ceiling or floor from `tune.arbF`/`arbR` against `lim.arb`, and names the fix for the active stiffness mode and CO-SOLVE's Spring Share |
| `PhaseVerdict` | expanded handling-balance panel, **PRO**: tips, then ENTRY / MID / EXIT / TRANSIENT rows from `phaseMargins`, with alignment's TOE F / TOE R / CAMBER as direction-only `DirSeg` rows. `PhaseHeadline` (with `balWord`, `PHASE_STRONG`, `PTS_NEUTRAL`, `PTS_STRONG`) is the INT/PRO bar header: the three phases in words. `PHASE_NEUTRAL` (±1%), `signOf` and `fmtPct` sit beside it. `App` computes `phase` only when `uiMode==='pro'`, and the headline, stacked bar and ENTRY/MID/EXIT strip all switch on it being non-null. Its `Seg` (a `BiasSeg` at the phase scale) is module-level, just above it, for the same reason as `HandlingVerdict`'s `GroupSection` |
| `EntryCard` | one garage entry inside the GARAGE drawer |
| `CheckerModal` | TUNE CHECK (DECODE / MEASURE). **The overlay has no backdrop-click close, unlike every other modal — that is deliberate, not a missing handler:** MEASURE's two ARB readings are component state taken one at a time with a trip into the game between them, and a stray click on the dim margin used to discard them silently. ✕ is the only way out. They stay component state rather than lifting to `App` because `probeHz` re-seeds per car from `ch.measuredNatBalHz` on open and `App` has no car identity to re-seed against; instead the work in progress — DECODE's typed tune, step 2's readings, and a Measure Hz moved before step 1 is saved — is mirrored to sessionStorage through `ckSessGet`/`ckSessSet`, each keyed so it only comes back where it still applies (keys in [PERSISTENCE.md](PERSISTENCE.md)). Because closing the window no longer resets DECODE, step 1 carries a **START OVER** button (`decodeStartOver`) once anything is entered: without it an alignment typed for one tune stayed `ckAlEntered` and rode along on the next tune's IMPORT TUNE until the browser tab closed. MEASURE is one column of two numbered steps — `STEP 1 · NAT BAL SETUP`, then `STEP 2 · ARB SCALE SETUP`, which is locked until step 1 has a reading because `solveArbScale` needs it. Each step is laid out as the trip into the game: a table of what to set (step 1: front and rear down the side, springs and bars across; step 2: one row per reading with bars, box and a status — NOT SET / SET / FITS / OFF ±n / CHECK), then the box for what the game shows. Every unset box opens on a NumBox `seed`: step 1's is `natEst` (the model's display-space natural at the live Measure Hz), step 2's is `arbExpect` (`arbProbeBalOf` at `arbSolveHz`, with `arbPartialScaleOf`'s one-scale fit of the readings typed so far once there are any, else the scale in use). Step 1 has no slider: a reading is typed, into a `commitOnEdit` box so retaking it at a new Measure Hz commits even when the number is the same. Enter in step 1's box or a reading's hands focus to the next reading (`focusRead`, through `ckReadsRef`). Step 2's note prints step 1's springs at `arbSolveHz`, and **both** steps warn on `arbHzMismatch` — step 1 because its table then shows springs the reading in use wasn't taken on. `arbReads` is mirrored to sessionStorage (`suspos_ck_arb_reads_v1`, see [PERSISTENCE.md](PERSISTENCE.md)), keyed to the step-1 reading, so closing the window mid-set no longer loses it. Each step's `Card` `headerRight` carries its own state chip (NOT SET / SET n / DEFAULT n / RE-MEASURE n) — step 1's goes amber on `natBalStale` and step 2's on `arbScaleStale`, so both steps flag a reading the chassis has moved out from under, and step 1's amber block also says the ARB scale below rests on it, and the module-scope `CkPhase` / `CkChip` / `CkNote` / `CkWarn` / `CkIntro` helpers exist so both steps — and both **tabs** — share one rhythm: what to set, then what to type back. (They were local to this block until DECODE became numbered steps too.) Step 2 ends in a **SCALE IN USE** toggle (`DEFAULT 540` / `MEASURED n`) rather than APPLY/RESET buttons — `DEFAULT` nulls the stored reading to hold `sanitizeTune`'s flag-off-means-null invariant, and `MEASURED` is disabled until `arbCanMeasure` (a fresh pair of readings, or a scale already applied). `arbSolveHz` anchors both solves to `ch.measuredNatBalHz`, never the live `probeHz`, and `arbHzMismatch` surfaces the difference. A stale scale whose NAT BAL was cleared renders a `USE DEFAULT` button inside the locked branch — without it that state has no way back to the default, since every other route to the toggle needs step 1. DECODE is the same two-numbered-step column: `STEP 1 · TUNE INPUTS` (mass, then alignment, bars, springs, damping, each under its own `CkPhase`; the owner's order) then `STEP 2 · DECODED TUNE`. Step 2 renders **nothing** — no readouts, no buttons — until `ckEntered`, which the `pS`/`pD`/`pA` setters flip on the first spring/damper/ARB edit; the mass fields do not flip it, since they write to `ch` and are shared with the sidebar. Without that gate the seeded stock figures (`ckSpr` 400/300 lb/in and friends, needed because `Field` requires a number) decoded on open and read as a real tune. Step 1's optional ALIGNMENT block, right after the mass, (`alignOk`: INT+ and a Forza mode) with its own gate, `ckAlEntered`: IMPORT TUNE calls `onImportTune(feFn, drFn)` with `decodedFe` only if the suspension was entered and `decodedDr` (MANUAL alignment) only if the alignment was, and App applies both in one `commit`, so an alignment never drags the seed springs in or the reverse. Step 2 renders once either gate is open, in the same order: alignment, then bars, Hz and damping ratios under a SUSPENSION phase when both are present. DECODE's two buttons share one `decodedFe` patch and stack under a **WHERE IT GOES** phase, each with its own line of what it keeps and what it touches: IMPORT TUNE writes the patch to the tune, IMPORT AS DNA (PRO, `onImportDna`) reads it back into the DNA editor without touching this car. `decodedFe` anchors ζ and bump on the **front** axle because it writes `rideRef:'front'` and STANDARD's exact-anchor axle follows Ride Reference — the two have to move together, and once didn't ([HISTORY.md](HISTORY.md)) |
| `GlossaryModal` | glossary lookup (GLOSSARY under the header's ?, or ⋯ on a phone). zIndex 1100, above every other modal, the ⓘ tooltip and the tutorial card. Opens on ALL. Each group is split by `TierRule`s into BEGINNER, INTERMEDIATE and PRO sections, entries in `GLOSSARY` order inside each. A BEG / INT / PRO chip filters with one of two scopes: ONLY (the default) shows that tier's own entries, then an "ADDED AT …" section holding just the paragraphs that tier adds to lower-tier entries (`data-glossary-add`, title links to the whole entry); UP TO shows every entry at or below the tier and hides `[INT] `/`[PRO] ` paragraphs above it. Filter and scope are session state, not persisted, and search runs inside them. `focus` (a `GLOSSARY` id) scrolls to and flashes that entry on open; SEE buttons jump the same way, widening the filter or clearing the search when either hides the target. Scrolls by `offsetTop` inside its own scroller, never `scrollIntoView` (it can move the page behind on mobile). Escape closes it from a capture-phase document listener, so nothing underneath sees the key. `App` owns the wiring: `glossaryBridge.open(id,{from,keyboard})` sets `glossaryFocus` and re-keys the modal per focus, and on close focus returns to `from` only when the link was used from the keyboard. The box has a fixed height so the search field never moves. Group headers (`data-glossary-group-hdr`) are sticky and a section strip (`data-glossary-goto`) jumps between them; a search replaces the groups with one ranked list (name hits, then text hits) with a hit count and `<mark>` highlights. SEE chips and ADDED-AT titles push onto a Back stack (`data-glossary-back`, Backspace or Alt+←); with the stack empty, BACK on a modal opened at an entry closes it. ONLY / UP TO pressed under ALL apply to the reader's own tier |
| the data modal | SHARE (COPY CODE / COPY LINK) / LOAD CODE / BACKUP / RESTORE (inline in `App`, not a component). LOAD CODE stages into `pending` and applies through `mergeTune` — see the share-parts suite below. RESTORE stages too, in its own way: one `chosen(kind)` predicate drives both the per-row counts it prints (`3 restored, replacing your 1 entry`, amber where something of yours drops) and the entries actually dropped, so the summary can never describe a different restore than the one that runs. It is the only action that replaces entries the garage cannot undo, hence the net-effect box and the two-tap `ConfirmBtn` |
| `TutorialPanel` | the guided tours. The body (`data-tut-body`) is `white-space: pre-line`, so a `\n` in a step's `body` is a line break. A step's optional `glossary` ids render a TERMS row of links (`data-tut-terms`) under the body that open the glossary at that entry; this replaced the old per-step `terms:` field and the INT guide's two "Key Terms" steps |
| `OverwriteBtn` | *(no current call site — `useTwoTap`, the hook behind it, is what the garage reuses)* |
| `MenuButton`, `MenuItem`, `MenuHead` | The desktop header's menus (the game · level chip, ⋯, ?). `MenuButton` is a `tbtn` that opens a `role="menu"` panel under it: a click toggles, Escape (focus back to the button) or a press outside closes, an item's `onClick` gets `close` through the render-prop. Opened from the keyboard it focuses the first item and the arrow keys walk them. `force` holds it open and ignores outside presses — a guide step spotlighting an item. `MenuItem` is one row (label, optional note and tag, `tone` for RESET's red); `MenuHead` a group caption |
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
Geometry & Weight, Balance Target, Alignment, Roll & Anti-Roll Bars, ARB Modes,
Ride & Springs, Ride Setup, Damping, Brakes, Differential, Handling Balance, Readouts &
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

`GLOSSARY_SUM` (beside `GLOSSARY`, keyed by id) holds each entry's one-line summary, shown first
and searched. It is kept apart so def edits and summary edits never touch the same line, and
like an untagged paragraph it must hold for the entry's own tier. Titles read as the app prints
the name, then an optional `(…)` qualifier in Title Case, rendered small and grey.

`GLOSSARY_BY_ID` resolves an id; `glossaryLabel(id)` is the text of a "TERMS: … ›" link;
`glossaryBridge.open` is a module-level slot `App` fills so a `Hint` or `TermLink` deep in
the tree can open the modal without prop drilling. Beside `GlossaryModal`: `TIER_RANK`
(the filter's ordering), `TIER_NAME`, `TIER_COLOR`, `TierBadge` and `TierRule` (the only
place tiers are coloured — the BEG/INT/PRO buttons are plain `.tbtn` / `.tog`) and
`glossParas`. `TierBadge` has two looks that must stay distinct: solid for an entry's own
`tier`, outlined `INT+` / `PRO` on a ruled block (`para`) for a tagged paragraph. Group names
carry no tier — the tags do. The modal's filter
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
the hint expression stay (the ARB
Balance Mode hint's PRO-only modes, `HandlingVerdict`'s BEG/INT tips); do not collapse them into one string. The glossary does the reverse: its
untagged paragraphs must hold for the entry's own tier, and anything higher goes in an
`[INT] `/`[PRO] ` paragraph.

---

## Sidebar zones and tier gating

Every spotlightable region carries an `id="zone-…"`, used by the tutorial
system for focus/dimming. There are 21 in the source; which exist in the DOM
depends on the tier.

- **All tiers**: `zone-garage` — the right-side GARAGE drawer (on a phone, the GARAGE view). It is *not* part
  of the sidebar, so it sits outside the per-tier lists below and is the only
  zone present at every tier regardless of panel.
- **All tiers**: `zone-toolbar` — the tune's actions. On desktop it is the header's action
  group (↩ ↪ SHARE ⋯, with DNA, CHECK and RESET inside ⋯); on a phone it is the phone header's
  ↩ ↪ ⋯, with SHARE inside ⋯ too. Exactly one of the two renders (`isMobile`), so the id and the
  `tb.*` spot ids serve both, and every guide step that focuses `toolbar` works at either width.
  `actMenuForced` opens ⋯ for a step that spotlights something inside it.
- **BEG** renders its own flat panel: `zone-layout-build`, `zone-build-type`,
  `zone-weight`, `zone-ride-stiffness`, `zone-balance`, `zone-character`, plus
  `zone-output` and `zone-balance-bar`. No `Sec` sections at all, and no VISUALS.
- **INT** switches to the sectioned sidebar: `zone-mine` (MY CONTROLS, only while the layout pins
  something; never during a guide), `zone-chassis`, `zone-build`,
  `zone-brakes`, `zone-alignment`, `zone-drivetrain`, `zone-arb`, `zone-feel`, `zone-damping`,
  plus output and balance bar, and `zone-visuals` — not in the sidebar but its own column
  or view (`visualsPanel`), present only while VISUALS is shown.
- **PRO** adds `zone-balance-target`, and unlocks extra
  controls inside the shared sections (CHASSIS geometry, ARB MECH/CO-SOLVE,
  Hz MECH mode). PRO's CHASSIS is grouped by data source with
  `SrcHead` headers, and holds the MEASURE NAT BAL entry point under FROM THE
  GAME; `zone-balance-target` keeps only the ARB SCALE RE-MEASURE flag.

### Leaving PRO: what the tier effects reset

Two effects in `App` run on `uiMode` and `restoreTick` below PRO:

- **Geometry scaling** writes wheelbase and both track widths from Weight. Those are PRO-only
  inputs, so below PRO they are a function of Weight, and leaving PRO rescales them. CG Height is
  deliberately not in it: it is an input at INT (MANUAL CG) or follows ride height, and scaling it
  overwrote a typed value on every weight edit and every load.
- **The tier fallback** is one effect with one write per store: `fe` (BEG's simple-mode lock, then
  ARB Balance Mode MECH / CO-SOLVE / CHASSIS → WEIGHT and Hz MODE MECH → MULTIPLIER), `dr`
  (`diffManual` off; POWER SPLIT's SOLVE EXIT needs no reset, since below PRO it is not applied). Alignment has no entry: INT has the whole section, and
  `alignOut` reads pure AUTO at BEG without touching what is stored. **Keep it one write per store**, so the lock and
  the fallback land together. The BEG lock was once a separate effect, and back when `usePersist`'s
  `set` applied updaters to the render-time value it was erased on every switch to BEG. Same-tick
  updaters compose now (see [PERSISTENCE.md](PERSISTENCE.md)).

Nothing is restored on returning to PRO. A PRO-only setting that arrives *below* PRO by a share
code or garage load (neither changes `uiMode`) stays until the next tier change, so the loaded
tune computes as its author made it. The screen says so instead of hiding it: a
MANUAL diff below PRO, which has neither the AUTO sliders nor the PRO-only lock fields, gets a
note in DRIVETRAIN listing the locks in use instead of a blank diff section.

### Tier differences that look like gaps but aren't

- **FRONT AXLE EXIT shows for a SPORT diff** (AWD, INT+) while ENTRY and CENTRE POWER SPLIT hide.
  EXIT drives front *accel* lock, which a Sport diff has (the card shows a live Front Accel);
  ENTRY drives decel lock and POWER SPLIT the centre lock, which Sport lacks (N/A on the card).
  Hiding FRONT EXIT would leave `diffFrontExitBias` moving an output with no control.
- **The DIFFERENTIAL card's RECOMMENDED and CENTRE SPLIT boxes return null at BEG.** BEG has no
  DIFF TYPE row and no POWER SPLIT slider, so it could not see what `→ USE` changed or change it
  back. The glossary tags both boxes `[INT]`.
- **A matched RECOMMENDED or CENTRE SPLIT box still renders, as one ✓ line.** Hiding it once the
  diff matched would leave the INT guide's spotlight on `out.diff.recCenter` with nothing to land
  on. The full box (reason, → USE) shows only while the setting differs.
- **The Forza output's warning summary (`outWarnSummary`) duplicates `outWarns` on purpose.** The
  full text stays at the foot of each card; the summary is titles only (`OUT_WARN_TITLE`, keyed by
  warning `key`), and a new warning key without a title shows as "Warning". BeamNG has no
  summary: it already lists every warning in full at the top.

`zone-presets` no longer exists. It was duplicated across the BEG panel and the
INT/PRO BUILD section (safe only because the two were mutually exclusive on
`uiMode`); both copies went when the factory presets moved into the GARAGE panel.

Sections are collapsed on load, except those the active layout starts open (its `startOpen`, read by
`open`'s initialiser, so only a load applies it) — `open` is plain `useState`, not persisted.

`open` holds two unrelated kinds of flag. The collapsible **sidebar sections** —
exactly one per `Sec`, ten — are listed in `SECTION_KEYS`
beside the initialiser. The rest are not sections: `balanceExpanded` (the balance
detail overlay), `factoryOpen` and `dnaSavedOpen` (the GARAGE factory list and the DNA modal's MY DNA drawer), the `vis*` groups
inside VISUALS, and `visuals` itself. **`visuals` stays in the initialiser though nothing reads it:**
VISUALS left the sidebar for its own column or view and left `SECTION_KEYS` with it (so collapse /
expand all don't open or close it), but it keeps its `SECTION_VIS` row, because stored hidden lists name
it, and the guide effect writes an `open` key for every `SECTION_VIS` row.

**Collapse / expand all walk `SECTION_KEYS`, not `Object.keys(open)`.** They are COLLAPSE and
EXPAND under SECTIONS in the header's ⋯ (`moreItems`), once the sidebar's SECTIONS `−`/`+`.
They used to blanket-toggle every key, which reached every one of those: `+` popped the
balance overlay and every visualisation card open, `−` closed the factory list.
Neither is a section, and the blast radius grew
with every flag added to the object.

**Adding a `Sec` means adding its key to `SECTION_KEYS` *and* to the initialiser.**
A section missing from either is skipped by expand-all while still collapsing and
toggling normally, so nothing looks broken. `alignment` was missing from the
initialiser and behaved exactly that way: it read as falsy, its own header worked,
and the only symptom was `+` not opening that one section, in PRO only — with a
tutorial step that writes the key papering over even that. `tests-docs.js` checks
the initialiser against every `open.*` and `tog('...')` use in the source.

### Section jump bar

INT and PRO draw a row of chips at the top of `.sidebar-scroll`, sticky, one per section this
tier renders and `secVis` shows, in `sidebarOrder`, except those the active layout leaves off
(`noChip`; a hidden section, or its stub, gets none either, and `visuals` never does). Chip text is the row's `label`, or `JUMP_LABEL` where that is too long. A chip runs
`jumpTo`: it makes the section the active one (so VISUALS follows, as `tog` does), opens it if it
is shut, and after that render scrolls the section's `zone-*` (`SEC_ZONE`) to just under the bar.
The scroll divides out `uiZoom`, since `getBoundingClientRect` is zoomed and `scrollTop` is not,
and waits on a timeout rather than an animation frame, which was skipped outright in testing.
It never closes anything; lit chips are the open sections. A last chip, ✎, opens the layout panel. The row wraps (two lines at the
sidebar's usual width) instead of scrolling sideways, so no chip is out of sight with a mouse.
It is not drawn in the edit view, whose pinned bar takes the same place, or while a guide runs,
since the guide scrolls and spotlights sections itself and a sticky row would sit over the
section it scrolls to the top.

### Layouts: the layout panel and the on-page edit view

What is hidden, and what is held, lives in **layouts** (── Layouts ──): named sets of a hidden
list and a held list, `suspos_layouts_v1`. Each tier with the edit view (INT, PRO) picks one per game in
`assign`, so FH, FM and BeamNG can differ. `App` resolves the **active layout** from `uiMode` and
`fe.gameMode` (`layoutGame`); BEG has none. `hiddenHere` is its hidden list filtered to ids this
tier renders (`hideIdValid`), and is what `LayoutCtx`, `secVis` and the stubs read; `heldHere`
is the held list filtered the same way, which HOLD reads;
`hiddenCount` counts only what this game can show (`hideIdApplies`, which also reads a row's
`games`). A layout may hold ids of every tier, so one layout can serve INT and PRO. Every edit
goes through `editActiveLayout` (`setManyHidden`, `setSecHidden`, `showAllHere`, `toggleHold`,
`holdAllHidden`, `releaseHolds`).

Two ways to edit it:
- **The layout panel** (`LayoutPanel`, `layoutPanel` = its open tab): LAYOUT… under SECTIONS in
  ⋯, the ✎ chip at the end of the jump bar, or LAYOUT on the output panel's "N output parts
  hidden" note (TUNE tab). It lists every part by its `HIDE_ITEMS` `label`, other modes' parts
  included, so a control can be hidden without first selecting its mode, and marks a hidden part
  that still applies (`layoutChangedIds`, from `sectionChanged` / `hiddenChangedIn`).
- **The on-page edit view** (`layoutEdit`, EDIT ON PAGE in the panel): it opens the sidebar
  (`goView('inputs')` on a phone), and while it is on ⋯'s item reads ✓ DONE EDITING. The top of
  the sidebar becomes a pinned bar (✎ EDITING LAYOUT, the layout's name, SHOW ALL, DONE) over a
  banner; a strip with a second DONE sits at the top of `zone-output`. Every hideable part is
  drawn, and a click toggles it in the active layout. Sections stay collapsible there (VISUALS
  included); a whole section hides through the small HIDE button in its header. It exits on DONE,
  Escape, a tier change, or a guide starting. It replaced the SECTIONS modal, which could hide
  whole sections only.

Neither runs during a guide or in BEG, and each ends the other.

**Section order, start-open and chips.** Besides `hidden` and `held`, a layout holds `order`
(every `LAYOUT_SECS` key once), `startOpen` and `noChip` (subsets). The sidebar's section blocks
are written in their default order, each wrapped as it stands in a keyed fragment of one map,
`secEl`, which the render draws in `sidebarOrder`: the active layout's `order`, or `LAYOUT_SECS`
in BEG and while a guide runs (steps place their cards by where a section sits as well as by its
id). The page order is the drawn order, so Tab follows it. `startOpen` is read once, by `open`'s
initialiser. In the panel's SIDEBAR tab each section has a ⠿ handle (pointer events, so mouse,
pen and touch alike, with `touch-action: none`; the list redraws in the landing order while it
moves and scrolls at its edges), ↑ ↓, START OPEN and JUMP CHIP; RESET ORDER restores
`LAYOUT_SECS`. A tier moves only the sections it renders: BALANCE keeps its slot while INT
reorders around it, so one layout serves both tiers.

**Output order (`outOrder`).** A layout orders the output panel per family of games
(`outFamily`): Forza (Horizon and Motorsport) moves its six cards, keyed by their `HIDE_ITEMS`
ids, and BeamNG moves its front | rear grid's three rows (`bng.drive`: brakes and diffs,
`bng.susp`: the mode summary, both suspension cards and the ARB caveat, `bng.align`) whole, so a
front card always sits beside its rear one and `BeamngGrid`'s pairing still lines up. The Forza
cards are wrapped like the sidebar's sections, each as written in a keyed fragment of `outEl`;
the BeamNG rows are fragments inside the grid, which add no grid items. `outOrder` is the
layout's, or `OUT_ORDER_DEF` in BEG and during a guide. The panel's TUNE tab has CARD ORDER ·
FORZA or ROW ORDER · BEAMNG (↑ ↓, RESET ORDER) for the current game.

**Output figures (`OUT_FIGS`, `figs`).** The smaller numbers beside an output value, and the line
under each Forza card, are output figures: `OUT_FIGS` lists each by a permanent key (`spr.hz`,
`dmp.bratio`, `brk.grip`…) with its card, panel label and gates (`tiers`; `forza` for the card
lines; `def:false` for the ones off under AUTO). The view builders (`springView`, `arbView`,
`dampView`, `alignView`, `brakeView`, `diffView`) write each row's figures as `{k, kind, text}`,
and `kind` is worked out from the modes the solve ran: `set` when the figure only repeats a
sidebar setting (the Ride Ref axle's Hz while Ride Stiffness is in Hz, the multiplier under
MULTIPLIER, the reference axle's ζ under CHARACTER, a figure a balance mode evens exactly on the
other axle), `solved` when the solver worked it out from other settings, `info` when no setting
reaches it. `outFigShown` is the rule: AUTO drops `set`, shows `solved`, and shows `info` unless
`def:false`; a layout's `figs` map (`{key: 'always' | 'never'}`, an absent key = AUTO) overrides
it, front and rear together. App passes the active layout's `figs` through `OutFigCtx`, or
`OUT_FIGS_AUTO` in BEG and during a guide; `useFigs` filters, and `FigSpan` draws a solved figure
bright, an info one muted and a set one (shown only by ON) faint. `cardFigs` (App) builds the
Forza cards' `CardFigs` line: each card's balance effect, the Handling Balance bar's own term for
it by phase (INT points from `tune.bSp`, `tune.bAb`, `bDampBias`, `bBrakeEntry`, the diff's
`bDiffDecel` / `bDiffAccel` and `alignBal`; PRO grip-margin % from `phaseMargins`, with a
direction only for damping, diff lock and alignment, as `DirSeg` gives), and the ARB card's front
share of all roll stiffness. BEG draws no card lines. BeamNG's rows read the same builders, so
they follow the rule, but it has no card lines yet. The panel's TUNE tab lists FIGURES per card
with AUTO / ON / OFF (`.lp-seg`) and ALL AUTO. `tests-sections.js` checks every key the render
writes against the table, the rule, `repairFigs`, the gates, and each card's line.

**Hidden choices (`HIDE_OPTS`).** A selector's single choices can be hidden too. `HIDE_OPTS` maps
a control's `HIDE_ITEMS` id to its choices, `[value, label, {tiers, games}?]`, and a choice's id
is `control:value` (`arb.balMode:mech`), stored in `hidden` like any other id and as permanent:
retire one, never reuse it. `optOf` reads one back; `hideIdValid` / `hideIdApplies` take a
choice where its control applies and its own gates allow (CHASSIS / MECH / CO-SOLVE are PRO,
BASIC is Forza's). Each choice button carries `data-opt="value"`; `Hide` provides its id through
`HideIdCtx`, and `OptionSeg` drops the hidden ones before working out its columns, so the rest
close up. The choice selected now always stays, dashed and titled, so a selector never reads as
having nothing picked; switching away hides it. The panel shows a control's choices as chips under
its row (lit = shown). A choice never holds anything for PERSIST. `tests-sections.js` checks every
`data-opt` against the table and every listed control for tagged buttons.

**VISUALS parts.** Inside a VISUALS group, `VisPart id` hides one piece (a `HIDE_ITEMS` row
`visuals.<group>.<part>`: RIDE · ROLL · DAMPING's roll split and each track, ALIGNMENT's two
charts, LOAD TRANSFER's diagram and tables, GRIP USE's notes). It is not a `Hide`, because the
group is one and Hides don't nest, so it has no edit-view toggle; the panel's VISUALS tab lists it
under its group. ALIGNMENT is a hideable group now too (`visuals.align`, Forza only, in
`VIS_HIDE_ID`). Lift and ⚠ lines stay outside every `VisPart`.

**MY CONTROLS (`mine`).** A `SECTION_VIS` row with no fields, first in `LAYOUT_SECS`, and a
`Sec` of its own in `secEl`, drawn only while the active layout pins something this tier and
game can show (`minePins`, `mineShown`) and never during a guide. A layout's `pins` are
`HIDE_ITEMS` ids of sidebar controls (`pinnable`: not ⋯, output, bar or VISUALS parts). **A
pinned control is still built by its home section**: `Hide` finds its slot
(`[data-pin-slot="id"]`, one per pin in MY CONTROLS' body) after each commit and portals its
children there, wrapped in `data-pin-home` so `noteActiveSec` credits the home section, not
MY CONTROLS. So every prop, closure and handler stays as written, and nothing about a control
has to be duplicated. The price is that the home section must render its body: `secProps`
passes `pinned` (how many of its controls are on show in MY CONTROLS), and `Sec` keeps the body
mounted with `display:none` while it is shut, a stub or hidden outright. That is also what lets
a layout hide ANTI-ROLL BARS and keep ARB Bias. An open home section starts with "★ n in MY
CONTROLS" and GO (`jumpTo('mine')`).

`pinOn` (MY CONTROLS shown, not the edit view, not hidden) gates the portals; otherwise pinned
controls stay at home. In the on-page edit view every pinnable part carries ☆ / ★ (`.hz-pin`)
and MY CONTROLS shows only a note. A pin applies only where its control renders, so one whose
mode isn't selected leaves an empty slot (`:empty`, no room). Pinning shows the control if it
was hidden, and a layout's first pin adds `mine` to `startOpen` and opens it. A pinned control is
in sight, so a hidden home section whose only changes are pinned leaves no stub
(`sectionChanged`'s `pinned`). Pinning and holding are separate: a pinned control can be held. MY CONTROLS is
never the active section (`tog`, `jumpTo`), and the guide effect leaves its open state alone.

Two tables under `── Section visibility ──` say what can be hidden:

- **`SECTION_VIS`**: every sidebar section, which tiers render it, and the fields it owns.
  It drives each `Sec`'s RESET (`sectionDefaults`), whether a whole hidden section leaves a
  stub (`sectionChanged`), and which stored keys survive a reload (`repairLayouts`). A new
  `Sec` needs a row here as well as in `SECTION_KEYS`, and its block an entry in the render's
  `secEl` map (see "Section order" below), or it never renders — `tests-sections.js` checks the
  map against `LAYOUT_SECS`. Its row also puts it in `LAYOUT_SECS`, so stored
  layouts take it in next to its default neighbour (`repairSecOrder`).
- **`HIDE_ITEMS`**: every single part, one row per `<Hide id>` / `hid=` in the render. `sec`
  is its `SECTION_VIS` key, or `toolbar` / `output` / `bar`. `label` is its name in the layout
  panel; `games` (`GAMES_FORZA`, `GAMES_BNG`, or Horizon alone for the diff type) lists the games
  it renders in where that is not all three, so the panel doesn't offer a part this game can't
  show. Both are display only and may change; `tests-sections.js` requires a label on every row. `fields` (`[state, keys]`) are
  the settings the control writes. They belong to its own section or to no section's RESET
  (`arbManF`/`R` and `springShareAuto` are in none). `live(st, tier)`, where given, says the
  fields apply right now: CG Height is computed while its source is RIDE HEIGHT, and Rebound ζ
  does nothing under SETTLE TIME. `tiers` defaults to the section's. **Ids are stored, so they
  are permanent: retire one, never reuse it.** `tbDna` and `tbCheck` were `SECTION_VIS` rows
  before this table existed and keep their spelling. A control that renders in two branches
  (INT and PRO variants, or Forza and BeamNG output rows for the same quantity) shares one id.
  Its two targets in different Balance Target modes are separate ids, because each applies
  only in its own mode.

A new control needs a `<Hide id>` and a `HIDE_ITEMS` row; `tests-sections.js` fails on an
id in either place without the other.

`sectionChanged` and `hiddenChangedIn` share their gates (`liveKeys`): BALANCE counts only
while `hasBalTargetSolve`, below PRO BRAKES counts only `brakeStock` and `brakeBiasShift`, and
on STOCK only `brakeStock`.
`hiddenChangedIn` is what a shown section's "N hidden settings changed" line counts, and its
SHOW brings back exactly those ids. A hidden setting that still changes the tune is never
silent.

**Never hideable, on purpose:** the warnings and clamp notes (amber or orange text in the
sidebar and the output cards, inside `<Keep>` in a card, and the BeamNG warnings box above its
cards, which shows in every tier and has nothing hideable), the balance bar's headline
(it opens the breakdown) and its FIT? badge (a validity flag), and the DNA link line.
Read-outs that are only information (`balance.guide`, `ride.hzStrip`, `dampers.table`) are
hideable. The ones that carry their own clamp or ⚠ state (RIDE's MECH and SHARED solved
read-outs, the ARB NEUTRAL read-outs) are not.

`App`'s `secVis(key)` and `LayoutCtx` both treat everything as shown while `guideOn` (a tier
guide or the balance guide) is set, so a guide's spotlight always finds its zone and its
spots. LAYOUT… is disabled during either guide, a guide starting closes the panel and the edit
view, and BEG never hides anything.

**HOLD: chosen settings keep their values.** Each layout's `held` list names input sections and
controls (`holdable`: a `LAYOUT_SECS` section other than MY CONTROLS, or a control in one with
`fields`), independent of `hidden`: a setting can be hidden, held, both or neither. Everything in
the active layout's list valid in this tier (`heldHere`) keeps its value through every
`commit()`: apply DNA, a FACTORY preset, LOAD BUILD / CHASSIS, LOAD CODE, CHECK's import and ⟲
RESET all go through it. `heldItems(held, tier)` expands a held section to its controls with
fields in this tier, and `heldFields(held, tier)` turns the list into `{ch, fe, dr}` keys: a held
section's own fields plus every item's, which is how a held ANTI-ROLL BARS holds `arbManF` /
`arbManR` (outside its RESET). `live` is not consulted. The toggles are HOLD in the panel's rows
(beside hide and ☆), `.hz-hold` beside ☆ in the on-page edit view, and HOLD beside HIDE on an edit
view section header; `LayoutCtx.heldBy(id)` says `self`, `sec` or nothing. In the regular view a
control held on its own wears `.held` (a 2px bar outside its left edge, drawn by `Hide`'s
wrapper as the guide branch draws its own), and `Sec`'s header a HELD / n HELD tag. HOLD ALL
HIDDEN adds every holdable hidden id, PERSIST's old effect in one step. A layout stored before
HOLD, or built by `legacyLayouts`, with PERSIST on gets its hidden ids that can be held, less its
pins (`repairHeld`); the `persist` flag is then dropped.

The hold is applied in the recording setters (`setCh` / `setFe` / `setDr` / `setAl` →
`holdWrite`). While `inCommitRef` is set, a write keeps each held key at its pre-commit value
(`snapRef.current`) and records it in `keptRef` (each kept key → the value the load wanted), and
every other key the commit changed in `changedRef` (→ [before, after]). `commit` then sets
`holdNote` (the sidebar's "HOLD kept n…" line, naming the layout that held), or clears it.
`holdWarnings` adds one line per held control the commit kept whose mode (`HOLD_DEPS`, each held
value's mode control in its own section) the same commit changed, named in words by
`holdModeLabel`. LOAD ALL (`loadAllHeld`) applies `keptRef`'s values as a commit of its own with
`bypassHoldRef` set, so one ↩ returns to the held result. A load that switches game
is held by the layout active before it. It is applied per write, not as a second update after the
load, because each write is compared with the pre-commit snapshot: a second update could not tell
the load's changes from the held keys'.
`holdWrite` returns an updater, so `usePersist` applies it to the latest value and several
setters in one commit compose; each one's held keys still go back to the pre-commit snapshot.

What it does not cover, on purpose:
- a section's own ↺ RESET (an explicit request for that section, not a `commit`);
- tier, game-mode and validity effects (they keep the tune valid);
- undo / redo (the history step was taken before the load, with the held values in it).

**Guide spots reuse these ids.** A tutorial step's `spot` list names `HIDE_ITEMS` ids, plus
`SPOT_MARKS` (under `── Tutorial spotlights ──`, after `repairHidden`) for parts the edit
view can't hide, drawn as `data-spot="…"`. `SEC_ZONE` maps an item's `sec` to its `zone-*`
key, and the `[tutMode, tutStep]` effect opens sections from it. `spotCss(spot, zones)` is
the stylesheet `App` renders while a step has spots. So a `HIDE_ITEMS` id is also a
tutorial target: retiring one means checking `TUTORIALS` too, which `tests-sections.js`
does. See [TUTORIALS.md](TUTORIALS.md#spots-single-controls-cards-and-bar-parts). The stored layouts are `suspos_layouts_v1`; see
[PERSISTENCE.md](PERSISTENCE.md).

---

## Header layout

**Desktop (`!isMobile`, 768 px and up)** is one row, `desktopHeader()`, grouped by job:

```
SUSP.OS │ INPUTS VISUALS TUNE │ ··· │ HORIZON · PRO ▾ │ ↩ ↪ SHARE ⋯ │ ? GARAGE
```

- **Panel switch.** INPUTS toggles `sidebarOpen`. VISUALS is `toggleVis` (the column's
  `visUI.dock` at `VIS_COL_MIN` and up, the swap view's `visView` below). TUNE is always on at
  `VIS_COL_MIN` and up (disabled, its tooltip says why); below it TUNE and VISUALS share the
  right pane, so TUNE clears `visView`.
- **Game · level chip** (`MenuButton`): GAME and LEVEL as `OptionSeg` rows (`switchGameMode`;
  `requestMode`, keeping the 🔒 gating and `lockTitle`), then UNITS…, which opens the units
  modal and shows the current units under it.
- **Actions**, `zone-toolbar`: ↩ ↪ (`tb.undo`), SHARE (`tb.share`, `openShare`) and ⋯, which holds
  DNA (`tbDna`), CHECK (`tbCheck`), then in INT / PRO a SECTIONS group (LAYOUT…, COLLAPSE,
  EXPAND), then ⟲ RESET (`tb.reset`) — RESET away from undo. `actMenuForced`
  holds ⋯ open while a guide step spotlights one of those three. In the edit view, hidden
  `tbDna` / `tbCheck` show inside ⋯ with the usual HIDE / SHOW treatment.
- **? menu:** GUIDE (`askTut`), GLOSSARY (`glossaryBridge.open`, focus returning to ?), then
  SOURCE — or ↻ RELOAD / ↓ DOWNLOAD while `useDeployCheck` reports a newer version, when ?
  also carries a green dot.
- **GARAGE** stays a button of its own at the right.

The header wrapper has `position:relative; zIndex:300` so the menus overhang the body (above the
garage drawer's 200, below the tutorial card's 700 and the modals).

**Widths.** The desktop runs at 1.1× zoom (`uiZoom`), so 768 px is 698 px of layout. Below
1000 px (`hdrTight`) the chip shortens the game to FH / FM / BNG and the wordmark and gaps
shrink; below 900 px the wordmark goes. Measured spare width (the flex spacer) with an empty
garage: 91 px at 768, 138 at 900, 140 at 1000 — room for a three-digit GARAGE count and the
MOTORSPORT label. **Re-measure the spacer at 768 and 900 before adding anything to the row.**

**Phones (`isMobile`)** get one 48 px row, `phoneHeader()`: SUSP.OS, the same game · level chip
(short game name), and `zone-toolbar` with ↩, ↪ (from 360 px; below it REDO moves into ⋯) and
⋯. On a phone ⋯ holds SHARE, then the same `moreItems` as desktop, then the help items, and carries the
update dot, since ? has no room of its own. Both menus open as a `sheet`: fixed 10 px in from
the screen edges, because a panel hung off a button near the edge of a 320 px screen would
run off it. ☰, VIS, GARAGE, TERMS and the GitHub button left the phone header for the bottom
tab bar and ⋯; see "Phone views" below. Measured with no overflow at 320 px.

This replaced `headerCompact`, a width flag (finally `< 1040`) that moved the units, game and
tier controls between header row 1, header row 2 and the top of the sidebar, three gate sites
that had to stay in sync. Placement is `isMobile` alone now.

A container-shaped decision elsewhere follows the same precedent rather than
reusing a viewport flag: the BeamNG output grid collapses to one column on a
`@container (max-width:580px)` query against the output panel's own width,
because that width depends on sidebar state rather than window size. `auto-fit`
was tried and rejected there — on wide monitors `minmax(280px,1fr)` grows to
three or four columns, which breaks the front/rear pairing the layout exists
for. A fixed two-column template plus the container query is the only way to cap
it at exactly two without an unwanted `maxWidth` margin cap.
Forza's output uses the same query in the other direction: `.forza-out` caps its
single column at 680 px so a value stays near its label, and `@container (min-width:960px)`
lifts the cap and flows the cards into two CSS columns (`.forza-cols`) instead. CSS
columns, not a grid, because the six cards differ in height and a grid row would leave a
gap under the shorter one; Forza has no front/rear pairing to keep in line. The container
is the plain `containerType` div around the output; `.forza-out` sits inside it, since an
element cannot query its own width.

The update state lives inside a menu at every width (? on desktop, ⋯ on a phone), so it never
changes the row's width.

### Phone views

Below 768 px the body shows one full-screen view at a time, picked by the bottom tab bar
(`phoneTabs()`): **INPUTS · VISUALS · TUNE · GARAGE**. VISUALS is there only where VISUALS is
(INT / PRO, not hidden in the edit view); GARAGE carries its entry count.

- **No view state of its own.** `mobileView` is read off the three flags the rest of the app —
  the guide effect above all — already sets: `garagePanelOpen`, then `sidebarOpen`, then the
  VISUALS swap (`visShown` below `VIS_COL_MIN`), else the tune. `goView` writes them together.
  So guide steps' `sidebar:'open'` / `'close'`, a `garage` focus and a `visuals` focus pick the
  INPUTS, TUNE, GARAGE and VISUALS views with no guide change.
- **Panes are stacked and stay mounted.** INPUTS is the sidebar as a full-width absolute pane,
  GARAGE `zone-garage` the same, both hidden by `visibility` (no slide); VISUALS and TUNE share
  the output panel as on a tablet. Each keeps its scroll position across tabs.
- **The balance bar stays under INPUTS.** The inputs pane stops `barH` above the bottom (a
  ResizeObserver on `zone-balance-bar`), and the bar shows only its summary there; tapping it
  opens TUNE with the stack open. GARAGE covers it. The bar's safe-area padding moved to the
  tab bar.
- **Keyboard.** While a text-like field has focus (`kbOpen`, from `focusin` / `focusout`) the
  tab bar steps aside, as the VISUALS footer once did through `sbTyping`.

It replaced an 88%-wide sidebar drawer with a backdrop and swipe-to-close, a full-width garage
overlay with its own backdrop, and VISUALS' ‹ INPUTS / TUNE › buttons.

---

## Deploy check: `useDeployCheck`

The GitHub source link changes once a newer SUSP.OS is live, so an open tab learns of a push.
On a phone it is the header's GitHub button, as below. On desktop it is the last item of the ?
menu (SOURCE becomes ↻ RELOAD or ↓ DOWNLOAD), and ? carries a green dot so the change is seen
with the menu shut. It returns `null`, `'reload'` or `'download'`:

- **`'reload'`** — the page is served over http(s), i.e. GitHub Pages. The link
  becomes a button that keeps the GitHub mark, adds ↻, turns green (`.tbtn.update`),
  and calls `location.reload()`.
- **`'download'`** — the page is a downloaded copy opened as `file://`. Reloading
  would reread the same old file, so the link stays a link, turns green, adds ↓, and
  points at `DOWNLOAD_URL` (GitHub's view of `index.html`, which has a download
  button). Its tooltip says to save the new file over the old one, because a file://
  copy's localStorage belongs to that file's origin, not to the Pages site; SHARE →
  BACKUP is the safe route.

It never reloads or downloads on its own.

How it decides:

- **It compares the app, not a date.** `#app-source` is a `text/plain` script that
  Babel compiles a *copy* of, so its `textContent` is still the exact source this tab
  loaded. `appSourceOf` pulls the same element out of the fetched file with
  `DOMParser`. Any difference lights it, a comment-only edit included. A push that
  leaves `#app-source` alone — docs only, or CSS in `<head>` — does not.
- **The date only gates the download.** A `HEAD` with `cache: 'no-store'` reads
  `Last-Modified`, and only a date strictly newer than `seen` costs the full `GET`.
  `seen` starts at `document.lastModified` when served — the copy *this tab* loaded,
  cache included, which is why a HEAD fetched after load was rejected as the
  baseline — and at "none" off file://, so a downloaded copy's first check always
  GETs. A newer date with identical source (a docs-only deploy) moves `seen` to the
  GET's own date, not the HEAD's, so a GET that hit a stale edge can't skip the new
  copy. A CDN edge still serving an older copy reads equal or older and is ignored.
- **Target**: `location.pathname` when served; `LIVE_URL` (the Pages site) off
  file://. That cross-origin read from origin `null` works because Pages sends
  `Access-Control-Allow-Origin: *` and `Last-Modified` is a CORS-safelisted header.
- **When**: every `DEPLOY_CHECK_MS` (5 min) while the tab is visible, on
  `visibilitychange` / `focus`, and once at open off file://, throttled to once a
  minute. It stops once lit.
- **It is inert** on any other protocol, on a server that sends no `Last-Modified`
  (`document.lastModified` reads "now", the HEAD's date parses as `NaN`), and when
  offline or blocked (the fetch throws; it tries again next tick).
- **Reloading loses nothing.** All state lives in `usePersist` keys (see
  [PERSISTENCE.md](PERSISTENCE.md)), which is what lets the button reload without
  asking first.

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for what it misses.

---

## Undo / redo

`makeHistory` (module level, `── Undo / redo history ──`) holds two stacks of
whole-state snapshots `{ch, fe, dr, al, dnaApplied}`. App drives it from the
`── Undo / redo wiring ──` block. The ↩ / ↪ buttons live in `zone-toolbar` (the desktop
header's action group, or the phone header's); Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z and Ctrl+Y redo, except while a text field
has focus (the browser's own text undo wins there).

**Two kinds of setter, and which one to use matters.** `setCh`/`setFe`/`setDr`/
`setAl` record: every user-facing call site uses them, including `pCh`/`pFe`/…
and props passed to components. `setChRaw`/`setFeRaw`/`setDrRaw`/`setAlRaw` bypass
history and are for effects that *derive* state — the mount migrations, RIDE HEIGHT
→ CG, BEG/INT geometry scaling and mode fallbacks, BOTTOM G, the ARB ceiling reclamp — and
for the restore itself. The ARB unit conversion across a click/physical game-mode change is
not an effect: the game-mode selector does it (`switchGameMode` → `crossArbUnits`) in the
same recorded update, because an effect on `physMode` cannot tell a switch from a load. An effect that
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

- sets `restoringRef`, which BOTTOM G's RIDE REF. mirror (`bottomGStep`'s `restoring`) checks and skips. The
  snapshot already holds its output; running it again applies it twice. The ARB
  unit conversion was once such an effect and had exactly that bug on undo (see
  HISTORY.md); it now runs only from the game-mode selector, which a restore never
  goes through.
  The last effect in App clears the flag — **keep it last**.
- bumps `restoreTick`, a dependency of the BEG/INT geometry scaling and tier
  fallback effects, so a snapshot taken in PRO and restored in BEG or INT
  is brought back inside that tier. It is declared right after the persisted
  state because those effects' dependency arrays read it further down, and a
  read above its declaration throws.

The UI tier, section open state, units, the DNA editor draft and every garage
entry are deliberately outside history — see KNOWN_ISSUES.md.

---

## localStorage

All keys are namespaced `suspos_`. The one store outside localStorage is the
bootstrap's compiled-code cache in IndexedDB, which sits outside the app and holds no
user data — see [PERSISTENCE.md](PERSISTENCE.md). Versions are per-key; see
[PERSISTENCE.md](PERSISTENCE.md) for when to bump one (removing a field never
requires it — the stale key is simply ignored).

`suspos_ch_v8`, `suspos_fe_v8`, `suspos_dr_v8` (+ `suspos_al_v2`, read-only, `migrateLegacyAl`),
`suspos_units_v2` (+ `suspos_units_v1`, read-only), `suspos_uimode_v1`, `suspos_zoom_v1` (read-only now),
`suspos_tutorial_seen_v1`, `suspos_tutorial_step_v2` (+ `suspos_tutorial_step_v1`, read-only), `suspos_baltut_seen_v1`, `suspos_onboard_v1`,
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
before the first render; `fe` passes `repairFe` (`gameMode` only) and the
layouts pass `repairLayouts`, among others. See
[PERSISTENCE.md](PERSISTENCE.md).

`storageFull` is a module-level store beside `usePersist`, not React state: every
`usePersist` instance writes to it (`noteStorageWrite`) and the App reads it through
`useStorageFull`, which subscribes and re-renders on change. It drives the
`data-storage-full` banner, the first child of the App's main column; `gen` counts
refusals so ✕ (`storageDismissed`) hides the banner only until the next one.

---

## Intentionally-retained legacy — do not remove

Everything in this section **looks** dead to a search-based audit and is not.
Each entry is load-bearing for users with existing saved state or shared
codes. If you are cleaning up dead code, this is the list to check first.

**`suspos_hidden_v1`, `suspos_persist_v1`, `repairHidden`, `DEF_HIDDEN`** — the per-tier hidden
lists and the single PERSIST switch from before layouts (PERSIST on becomes held lists,
`repairHeld`). Nothing writes them, and only
`legacyLayouts` reads them, to build the INT and PRO layouts the first time. `suspos_layouts_v1`
is not written until a layout changes, so until then every load rebuilds from these keys; deleting
them, or the read, silently empties a user's layout. They also let an older copy of the app keep
its own lists.

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

**`TUT_V1_TITLES` and `tutProgressFromV1`** — read the retired
`suspos_tutorial_step_v1`, whose bare indices count each guide as it stood then, to seed
`suspos_tutorial_step_v2` by title. `TUT_V1_TITLES` is that frozen list of titles: a `_v1`
index names a title, found wherever it sits now; one whose step has since gone (PRO's Alignment
Mode, moved to INT) resumes at the next `_v1` step that remains. It replaced
`TUT_ADDED_SINCE_V1`, a list of steps added since, which could not express a step leaving a
guide. Removing them resets the RESUME point of anyone who last saved under `_v1`.

**`migrateToeSign` and `dr.alignToeV2`** — the one-time fix for MANUAL toe saved before Forza's sign was checked (Forza's + is toe-out). The flag looks like dead state, but it is what stops the negation running twice: removing it, or defaulting it to anything but `true`, flips every Forza MANUAL toe on each load. See [ALIGNMENT.md](ALIGNMENT.md) "Toe sign".

**`migrateLegacyAl` and the `suspos_al_v2` key** — alignment moved from its own `al` state into
`dr`. `migrateLegacyAl`, `suspos_dr_v8`'s repair, reads the old key while the stored `dr` lacks
`alignManual`, so a saved MANUAL alignment survives the move. It still honours the legacy
`alignManual` boolean of `al` for state saved before `al.mode` existed. It looks dead once
everyone has written a new `dr`, but nothing proves that, so it stays. See
[ALIGNMENT.md](ALIGNMENT.md).

**`arbBalTargetMode` / `arbBalDelta` / `arbBalAbs`** — fully live; they drive the
PRO Balance Target modes (RANGE, GRIP and PHASE share `arbBalDelta`; MANUAL reads
`arbBalAbs`; PHASE also reads `phaseExitG`). Easy to mistake for orphans because the names suggest a superseded
target system.

**The `'manual'` value of `arbBalTargetMode`** — no button writes it any more, and
it is *not* the MANUAL mode (that is `'abs'`). It is how NATURAL was stored before
RANGE and MANUAL existed. `balTargetModeOf` reads it (and anything unknown) as
NATURAL, and codec id 53 keeps `manual:0` in its encoder, because persisted state
reaches the solver without passing `sanitizeTune`. Deleting either strands every
saved NATURAL tune.

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
TUNE CHECK import that converts a pasted N/m back to roll stiffness (`checkArbRs`). Separate from
`motionRatioF`/`motionRatioR` on purpose — spring mount and drop link are
independent geometry.

**`ch.damperMotionRatioF` / `damperMotionRatioR` default to 0, not 1.0** — 0 is
SAME (`dampMr` falls back to `motionRatioF/R`), so a tune that never set it prints the
damping it always did. It looks like a bug and is not: a default of 1.0 would
silently change the damping of every tune with a spring Motion Ratio other than 1.
`sanitizeTune` clamps it to 0.2–1.5 and then restores 0, so the clamp stays readable
by `tests-docs.js`.

**JBEAM ADJUST (`jbScale…` / `jbOffset…`)** — display-only, like the motion ratios.
Applied in `springOut`/`dampOut`/`arbOut` through `jbMenu`, and inverted in exactly two
places that take menu values: `checkToWheel`/`checkArbRs` (Tune Check) and the ARB MAN
entry. `DEF_CH` spells the 16 keys out instead of building them from `JB_KEYS` because
the test suites evaluate `DEF_CH` before the block that defines `JB_KEYS`;
`tests-beamng.js` checks the two lists agree.

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
assumed. Every garage step now spots a part of the drawer (`garage.save` and the like),
so the card points at that part instead; a garage step without spots would still
centre. The fallback stays as a cheap defensive branch.

**The phone's INPUTS and GARAGE panes stay mounted when not shown** — below 768px they keep
`display:flex` and hide by `visibility:hidden`. A `display:none` toggle looks like a tidy
simplification, but it would drop each view's scroll position on every tab switch, which the
tab bar exists to keep. `TutorialPanel.measure()`'s drop of rects with `right<=0` and its
second measure at 260ms date from the old sliding drawer; they are harmless without it and
still cover the desktop sidebar's width transition.

---

## Intentionally absent — do not add back

The mirror of the section above: things whose *absence* is a decision, where
the git history makes the removal look accidental.

**Brake pressure, and a typed brake bias.** Brake bias was computed only for a while: `7932982`
added an AUTO/MANUAL BRAKES section with brake pressure, `1c66ba2` removed the UI (its message is
about tutorial positioning, so the log reads like an accident) and `082d51e` pruned the state.
That was deliberate, on the reasoning that users finalise brakes by feel in-game. BRAKES came
back at INT as a **shift** from the recommendation (`dr.brakeBiasShift`, ±10 points since widened from ±5), not a typed
value, so the bias still follows the chassis and build; see [HISTORY.md](HISTORY.md). A typed
bias and brake pressure remain absent. Retired codec ids are never reused — see
[CODEC.md](CODEC.md).

---

## Testing reality

The suites live in `tests/` and resolve `index.html` and `docs/` from the repo
root, so they run from any working directory.

**CI runs every suite** (`.github/workflows/tests.yml`) on each push to `main` and each
pull request: it runs every `tests/*.js` file, so a new suite is picked up without editing
the workflow, and it runs them all before failing, so one red run names every broken
suite. The suites need only Node's own `fs` and `path`, so there is no install step. CI
proves exactly what the suites prove and no more: it never loads the page, so a JSX error
the suites' string slices skip, or a component that throws on render, still passes.
There is **no linter, no type checker, no build step, and no git hooks.** `tests.js` tests a hand-maintained duplicate of the physics functions,
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
commit/undo/redo round trips, burst coalescing, no-op steps, labels and the cap. It also
runs the shipped `usePersist` against a stand-in for React's hooks: same-tick function
updates compose, localStorage is written before `set` returns, and rehydration merges and
repairs.

**`tests-ride.js` reads `index.html` the same way** and drives the real `feelToPhysics`
and `computeTune` through every Hz mode and Ride Reference: the CO-SOLVE REAR/SHARED
inversion delivering the slider's Hz, `rideRefSwitch` holding both axles (clamped,
BeamNG-snapped and CO-SOLVE cases included), and `bottomGStep`'s resolve / mirror /
dormant decisions, and the stiffness sliders' wheel across the whole band (`wheelStepOf`
from the stored setting moves on every notch; from the snapped Hz it must still stall). The
effect, the buttons and the slider bindings around those are checked only as source text; dragging the Hz slider in BEG and under CHASSIS → MANUAL still needs the
browser.

**`tests-share.js` reads `index.html` the same way** and covers the share parts:
`SHARE_PARTS` coverage and disjointness against `CODEC_FIELDS`, each part merging in
isolation, an empty parts map changing nothing, no mutation of the current tune, and a
decode/encode round trip merging identically. A codec field added without a part fails
here — that is the check the split exists to keep honest.

**`tests-balance.js` reads `index.html` the same way**, and is the only suite that
tests a model rather than a mechanism. It asserts the mech-balance chain's *shape* —
monotonicity, Kf/Kr scale invariance, front/rear mirror symmetry, continuity and
non-saturation, the RANGE band's build order on every chassis, and continuity across the
gap's sign crossover just under 50% front bias — rather than expected values, because
most of that chain has no measured ground truth and pinning today's numbers would make
every legitimate recalibration a failure. The band properties have history: the old
gap-fraction band's DRIFT sign inversion, its V-shape miss and its backwards build
ordering on rear-biased cars; the band that replaced it is held to the ordering as a
property rather than an anecdote. It also covers `balanceEnvelope`. Writing it found
a live bug on its first run — `mechBalanceLLT` reversing direction past inside-wheel
lift, since fixed with a transfer cap; see [HISTORY.md](HISTORY.md). Its monotonicity
test carries **no** exemption for the lifted region, and must not be given one again.

**`tests-garage.js` reads `index.html` the same way** and covers `autoTagsOf`: which
chip each payload produces, and the BRAKES chips' tier gating (STOCK BRAKES replaces the
rest from INT). That gating is a promise about App's `brakeBias`, which only the browser
exercises end to end.

**`tests-sections.js` reads `index.html` the same way** and covers `SECTION_VIS` and
`HIDE_ITEMS`: every `SECTION_KEYS` section has a row, every RESET goes through
`sectionDefaults`, no field has two owners, `sectionChanged`'s gating, every `<Hide id>` /
`hid=` in the render is listed and every listed id is used, `hiddenChangedIn`'s gates and
`live` modes, and `repairHidden` (old stored lists included). It also checks the tutorial
spots: every step's spot id is a `HIDE_ITEMS` or `SPOT_MARKS` id in a zone the step
focuses and renders in the guide's tier, every mark is drawn and used, and `spotCss`'s
rules. Whether the edit view, the lines and the footer render, the tutorial override, and
whether a spot is actually on screen at its step, still needs the browser.

**`tests-dna.js` reads `index.html` the same way**, for the same reason: the DNA
compiler drives the real solver, so only the real solver can test it. Where it can, it
checks DNA against the app's own flags (`shareClamped`, `mechBalClamped`,
`dampingClamped`) rather than against itself.

So the only real verification is the browser. A reasonable routine after a
non-trivial edit:

1. Compile-check `#app-source` with `await compileAppSource()` in the console (catches the
   page-blanking case).
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
10. `node tests/tests-garage.js` after touching `autoTagsOf`, or how `brakeBias` treats
   `brakeCentre` / `brakeBiasShift` by tier. Keep the two in step.
11. `node tests/tests-history.js` after touching `makeHistory` or `usePersist`. It covers the stacks only;
   the wiring (which setters record, when bursts end, the restore guards) needs
   the browser: drag a slider, load a preset, APPLY a DNA, then undo and redo
   through all three, and cross a game mode with MAN ARBs.
12. `node tests/tests-sections.js` after adding a `Sec` or a control, changing what a RESET
   resets, or touching `SECTION_VIS`, `HIDE_ITEMS`, `sectionChanged`, `hiddenChangedIn` or
   `repairHidden`.
13. `node tests/tests-ride.js` after touching `feelToPhysics`'s Ride Reference or CO-SOLVE
   paths, `coSolveRearOf` / `resolveCoSolveSpringShare`, the RIDE REF. buttons
   (`rideRefSwitch`), the BOTTOM G's effect (`bottomGStep`), the stiffness sliders' bindings,
   or FeelSlider's wheel (`wheelStepOf`). Reads `index.html`.
