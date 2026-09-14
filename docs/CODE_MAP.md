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
4. **Persistence primitives** — `mergeDefaults`, `usePersist`.
5. **Shared components** — see the table below.
6. **Codec** — `CODEC_FIELDS`, `encodeTune`, `decodeTune`, `sanitizeTune`.
7. **Tutorial content** — the `TUTORIALS` object and `TutorialPanel`.
8. **`App()`** — all remaining state, the derived `useMemo` chain, and the
   entire sidebar + output JSX.
9. **Bootstrap** — the Babel/eval block described above.

### Pure physics entry points

These are pure functions of their arguments, in dependency order:

```
resolveFeEffective(ch, fe)             → resolves the stored TARGET/GRIP balance delta
                                         into the absolute target (App's feEffective)
feelToPhysics(ch, fe)                  → resolves feel settings into physics
                                         (front/rear Hz, ζ per axle, ARB mode…)
computeTune(ch, physics, gameMode)     → springs, dampers, ARBs, balance
computeDiff(ch, fe, dr)                → differential locks (independent)
computeAlignment(ch, tune, layout, …)  → camber/toe/caster, from the tune
```

Supporting: `rsToHz`/`hzToRs`, `flatRideRearHz`, `flatRideSharedHz`,
`solveSpring`, `solveDampRaw`, `settleZetas`/`forceZetas`/`balModeZetas`
(Damping Balance Mode's front/rear split — `balModeZetas` is the by-mode
dispatcher, called twice per solve: once for the rebound anchor and once for
the INDEPENDENT bump anchor), `cornerMasses`,
`rollCenterHeight`, `parseTyre`, `mechBalanceLLT`, `balanceFromRsBal`,
`naturalMechBalanceOf`, `balanceBandDelta` (one edge of the PRO Balance
Guide's recommended band — module-level rather than inline because the RANGE
block and the GRIP GAP sub-widget both call it, and a band they disagreed on
would make "in range" mean two different things in one panel) and
`balanceBandRange` (the delta range a fraction pair covers — not just its two
endpoints, since a negative gap makes the delta V-shaped with its minimum at
grip-neutral),
`resolveArbBalTarget`, `gripNeutralOf` (grip-neutral mech
balance — what GRIP's Balance Offset and DNA's `balanceOffset` measure from),
`computeOscillation`
(damped step response — sample points for the VISUALS DYNAMICS chart; pure,
takes Hz + rebound/bump ζ + a duration; the chart's own `curveSettle` and
`firstCrossing` read the settle time and neutral crossing back off those
points rather than from `tune.settleF`/`settleR`), `resolveCoSolveSpringShare`
(CO-SOLVE's Auto Spring Share search — shared by `feelToPhysics`'s Kcs
pre-inversion and `computeTune`'s `effectiveRHz` solve so both agree on the
same spring share). `computeCheck` backs the TUNE CHECK reverse calculator.

In `App()` the chain is `resolveFeEffective` → `feelToPhysics` → `computeTune` →
everything else, the last three each in its own `useMemo`.

**Vehicle DNA core** (see [DNA.md](DNA.md)): `sanitizeDNA` normalises a DNA;
`compileDNA` turns its axes into an `fe`/`dr` patch; `measureDNA` reads the axes back
off any tune; `dnaTolerances` sizes a hit from the game's quantisation;
`dnaEvaluate` runs one compile through exactly App's chain; `applyDNA` compiles and
resolves conflicts in the DNA's `keep` order. Constants: `DNA_AXES`, `DNA_YIELDABLE`,
`DNA_MAX_MOVES`. Presentation: `DNA_AXIS_UI`, `dnaFmt`, `DNA_MODE_FIELDS`. In `App`,
`dnaStore` (`suspos_dna_v1`), `dnaRef`, `dnaPreview`, `dnaLink`, `dnaApply`, `dnaSave`,
`dnaLoadSaved`, `dnaUnlink`, `dnaDot`, `garageEntries`/`dnaEntries`
and `requestMode` wire it to the GARAGE DNA section, the sidebar DNA line, the
`visDna` card and the tier warning.

---

## Components

| Component | Rendered in |
|---|---|
| `Hint` | everywhere — the ⓘ affordance |
| `Field` | numeric inputs across all sections |
| `FeelSlider` | BEG feel sliders and most INT/PRO sliders |
| `Toggle` | mode switches |
| `Sec` | the nine collapsible sidebar sections (`div.stog` header) |
| `Card` | section wrapper in the output panel (title, ⓘ hint, `headerRight`) |
| `OutRow`, `RowGroup` | the output panel's value rows and their bordered groups — full-width single column for Forza (`horizon`/`motorsport`); assembled into the BeamNG two-column layout's cards below when `physMode` |
| `SuspensionCard`, `AlignCard`, `DiffCard` | BeamNG-only (`physMode`) output cards — per-axle shells built from `OutRow`/`RowGroup`/`Card`. `SuspensionCard` merges the Forza ARB+SPRINGS+DAMPERS cards into one card per axle; `AlignCard` omits Caster on the rear side (no rear caster slider in BeamNG); `DiffCard` is a generic per-axle differential card. The BeamNG layout itself (summary strip, CENTER SPLIT card, the fixed 2-column `.beamng-grid`) is inline JSX in `App`, not a separate component — see the `physMode` branch in the output panel |
| `Readout`, `Stat` | Tune Check and sidebar readouts — **not** the output panel any more (it moved to `OutRow` so each value is one scannable line to transcribe into a tuning menu) |
| `BiasSeg` | balance-bar segments |
| `SpringDial`, `ArbDial`, `DampingDial` | the pinned VISUALS card — its ARB and RIDE/DAMPERS groups. The card's other two groups, **DYNAMICS** (the `computeOscillation` step-response chart) and **SAG** (sag vs load, shown only when CG Height Source is RIDE HEIGHT), are inline SVG in `App` rather than components — same as the BeamNG layout above. Grep `visDynamics` / `visSag` for their `open` keys. DYNAMICS integrates its trace twice — see `fitDur`/`probeDur`: the window is sized from the analytic estimate, the curve is measured, then the window is re-fitted and re-integrated, because `computeOscillation`'s `nPts` is fixed and its step size (hence the trace) depends on the window length |
| `HandlingVerdict` | expanded handling-balance panel only |
| `EntryCard` | one garage entry inside the GARAGE drawer |
| `CheckerModal` | TUNE CHECK (DECODE / MEASURE) |
| `GlossaryModal` | glossary lookup |
| the data modal | SHARE / LOAD CODE / BACKUP / RESTORE (inline in `App`, not a component) |
| `TutorialPanel` | the guided tours |
| `OverwriteBtn` | *(no current call site — `useTwoTap`, the hook behind it, is what the garage reuses)* |
| `ErrorBoundary` | wraps the app |

The GARAGE drawer itself is inline JSX in `App` (it needs a dozen handlers off
`App` state); only the per-entry card is factored out. `Sec`'s count above is
hardcoded prose — verify it rather than trusting it after any section change.

Note `HandlingVerdict` and the RESPONSE factor breakdown render **only** when
the handling-balance panel is expanded, the dials render **only** inside
VISUALS (hidden entirely in BEG), and the GARAGE drawer renders behind a toolbar
toggle. None of them are reachable from a cold page load, which matters when
testing.

---

## Sidebar zones and tier gating

Every spotlightable region carries an `id="zone-…"`, used by the tutorial
system for focus/dimming. There are 19 in the source; which exist in the DOM
depends on the tier.

- **All tiers**: `zone-garage` — the right-side GARAGE drawer. It is *not* part
  of the sidebar, so it sits outside the per-tier lists below and is the only
  zone present at every tier regardless of panel.
- **All tiers, inside the sidebar**: `zone-toolbar` — the RESET/CHECK/SHARE row,
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

`zone-presets` no longer exists. It was duplicated across the BEG panel and the
INT/PRO BUILD section (safe only because the two were mutually exclusive on
`uiMode`); both copies went when the factory presets moved into the GARAGE panel.

Sections are collapsed on load — `open` is plain `useState`, not persisted.

`open` holds two unrelated kinds of flag. The collapsible **sidebar sections** —
exactly one per `Sec`, all nine including `visuals` — are listed in `SECTION_KEYS`
beside the initialiser. The rest are not sections: `balanceExpanded` (the balance
detail overlay), `factoryOpen`, `dnaOpen` and `dnaSavedOpen` (the GARAGE factory list, DNA editor and MY DNA drawer) and the `vis*` cards
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

The full header row — brand, IMP/MET, the game-mode dropdown, BEG/INT/PRO, then
undo / `?` / TERMS / GARAGE — needs roughly 975px once the four divider margins
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

---

## localStorage

All keys are namespaced `suspos_`. Versions are per-key; see
[PERSISTENCE.md](PERSISTENCE.md) for when to bump one (removing a field never
requires it — the stale key is simply ignored).

`suspos_ch_v8`, `suspos_fe_v8`, `suspos_dr_v8`, `suspos_al_v2`,
`suspos_units_v1`, `suspos_uimode_v1`, `suspos_zoom_v1` (read-only now),
`suspos_tutorial_seen_v1`, `suspos_baltut_seen_v1`, `suspos_onboard_v1`,
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
back to their default.

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
back to it (`al.mode ?? (al.alignManual ? 'manual' : 'build')`) for state
saved before `al.mode` existed. The *other* former use of it — the ALIGNMENT
card's hint prefix — was a genuine bug and has been fixed to read `alignMode`;
that does not make the fallback removable.

**`al.camberF` / `toeF` / `toeR` / `caster` / `camberR`** — these were dead
state once, and are live now (PRO Alignment Mode MANUAL). See
[ALIGNMENT.md](ALIGNMENT.md).

**`arbBalTargetMode` / `arbBalDelta`** — fully live; they drive GRIP balance
mode. Easy to mistake for orphans because the names suggest a superseded
target system.

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

There is **no CI, no linter, no type checker, no build step, and no git
hooks.** `tests.js` is a hand-maintained duplicate of the physics functions
and does not read `index.html` at all — it passes whether or not the app
works. See the Test coverage section of [PHYSICS.md](PHYSICS.md).

**`tests-docs.js` is the docs equivalent**: it reads `index.html` and `docs/*.md`
and fails when a fact stated in prose no longer matches the code — a drifted codec
id table, an enum value no doc mentions, an encoder index that no longer
round-trips through its decoder array, a storage key that vanished, a slider range
contradicting `sanitizeTune`, a section missing from the `open` state, a broken
doc link. It exists because a docs audit found ten errors and eight of them were
mechanical. It checks names, ids, keys and numbers only, never prose.

**`tests-beamng.js` is the exception**: it lifts the real physics layer out of
`index.html` with string slices and drives it directly, so it *does* fail when
the app breaks. It exists because the physical-unit mode is defined by what it
declines to do to the solver's output, which a mirror cannot express — a mirror
of "return the value unchanged" asserts nothing. If its `slice()` markers stop
matching after a reorganisation, fix the markers; don't delete the suite.

**`tests-dna.js` reads `index.html` the same way**, for the same reason: the DNA
compiler drives the real solver, so only the real solver can test it. Where it can, it
checks DNA against the app's own flags (`rollClamped`, `mechBalClamped`,
`dampingClamped`) rather than against itself.

So the only real verification is the browser. A reasonable routine after a
non-trivial edit:

1. Compile-check `#app-source` through Babel (catches the page-blanking case).
2. Load the app; confirm `#pre-load` is empty and the console is clean.
3. Exercise the tiers the change touches — BEG, INT and PRO gate different
   code, and VISUALS, the expanded balance panel, and the modals are not
   reachable from a cold load.
4. Round-trip a share code (SHARE → LOAD CODE) if anything near the codec,
   defaults, or `sanitizeTune` moved.
5. `node tests.js` if any mirrored physics function changed — and update the
   mirror by hand, since nothing will tell you it drifted.
6. `node tests-beamng.js` if anything in `computeTune`, `GAME_LIMITS`, or the
   unit constants moved. This one reads `index.html`, so it needs no mirroring.
7. `node tests-docs.js` after any docs edit, and after touching the codec,
   `sanitizeTune`, storage keys, the `open` state, or a slider range. Also reads
   `index.html`, so it needs no mirroring either.
8. `node tests-dna.js` after touching `feelToPhysics`, `computeTune`,
   `resolveFeEffective`, `sanitizeTune`, `DEF_FE`/`DEF_DR`, the Damping Bias / EXIT /
   ENTRY slider expressions, or anything under the `── Vehicle DNA ──` banner. Reads
   `index.html` too.
