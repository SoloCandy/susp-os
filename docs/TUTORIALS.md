# SUSP.OS — Tutorials

The in-app guided tours: what each one covers, when it opens, how the spotlight
works (down to single controls, cards and bar parts), and how to add or change a step.

All tutorial content lives in the `TUTORIALS` object in `index.html` (banner
`── Tutorial content ──`), and every guide renders through one component,
`TutorialPanel`. The code is the source of truth for wording; this file catalogues
the steps, quotes their text word for word in [Step text](#step-text), and explains
the machinery around them. The quotes are kept honest by `tests-docs.js`, which fails
when a step's text in the code and here stop matching.

---

## The four guides

| Guide key | Label on the card | Opens | Scope |
|---|---|---|---|
| `beginner` | `BEG GUIDE` | First visit to BEG, or `?` while in BEG | The whole app, from zero |
| `intermediate` | `INT GUIDE` | First visit to INT, or `?` while in INT | Only what INT adds over BEG |
| `pro` | `PRO GUIDE` | First visit to PRO, or `?` while in PRO | Only what PRO adds over INT |
| `balance` | `HANDLING GUIDE` | First time the Handling Balance bar is expanded | The expanded Handling Balance breakdown |

The balance guide is labelled `HANDLING`, not `BALANCE`, on purpose: the PRO
sidebar has its own BALANCE section with an unrelated BALANCE GUIDE widget, and
"BALANCE GUIDE" on the card would collide with it.

There is also a one-card **complexity popup** (the `ONBOARDING POPUP` block) —
not a `TUTORIALS` guide, but part of the same flow. It points at the header's
BEG / INT / PRO and `?` buttons and is dismissed with GOT IT or a backdrop click.
See [Onboarding popup](#onboarding-popup) below.

The TERMS glossary (`GlossaryModal`) is a separate, non-sequential reference with its
own doc coverage in CODE_MAP; tutorials link into it rather than repeating it. A step's
`glossary` ids render as TERMS chips on the card (see [The card](#the-card-tutorialpanel)),
so the step body stays short and the depth lives in one place.

---

## When a guide opens

### Tier guides (`beginner`, `intermediate`, `pro`)

- **Automatically, once per tier.** An effect on `uiMode` checks `tutSeen[uiMode]`;
  if unseen, it marks it seen and calls `openTut(uiMode)`. A fresh install lands in
  BEG, so the beginner guide opens on first load.
- **On demand** with the header `?` button, which always opens the guide for the
  *current* tier from step 1.
- **Seen is marked on open, not on finish.** Closing with ✕ on step 1 still counts,
  which is what unlocks the next tier (below).
- **Quick start or full tour.** The beginner guide's first card (`pathChoice`) offers
  QUICK START and FULL TOUR. FULL TOUR is plain NEXT. QUICK START sets `tutQuick`
  and restarts at step 1 of the `quick:true` steps; the progress bar and `n / total`
  count that path, and its DONE card adds that `?` replays the full tour. `openTut`
  always resets `tutQuick`, so `?` opens the full tour (or offers RESUME for it). The
  quick path doesn't write `suspos_tutorial_step_v2` — its step index counts the
  filtered path, so saving it would resume the full tour at the wrong step. Both paths close through
  `closeTutEnd`, so the complexity popup and `tutSeen` behave the same.

### Tier gating

`canAccessMode` / `tryAccessMode` gate the tier buttons on tutorial progress:

| Requested | Allowed when | Otherwise |
|---|---|---|
| BEG | always | — |
| INT | `tutSeen.beginner` | switches to BEG and opens the beginner guide |
| PRO | `tutSeen.intermediate` | switches to INT and opens the intermediate guide |

The gate is explained, not silent. A locked tier button is dimmed with a 🔒 before
its label, in both the desktop header and the phone (`headerCompact`) row, and its
`title` (from `lockTitle`) reads "Unlocks after you open the BEG guide" (or INT
guide for PRO). A locked click sets `tutNotice` — e.g. "INT unlocks once you've
seen the BEG guide." — which `TutorialPanel` shows via its `notice` prop above the
body of the first card only; `closeTut` clears it. The prerequisite is *opening*
the guide, not finishing it: `tutSeen` is marked by the `uiMode` effect as the
guide opens.

Leaving PRO while a Vehicle DNA is applied first asks for confirmation
(`requestMode` → `dnaTierWarn`); that check runs before the gate.

### Balance guide

Opened automatically by `openBalTut()` from the Handling Balance bar's header tap
— only on the tap that *expands* it, and only while `balTutSeen` is false. On
desktop that is expanding the detail panel; on phones it is the tap that reveals
the full bar stack. It can be replayed at any time from the **? GUIDE** button in
the expanded panel. The header `?` never opens it. It runs alongside a tier guide's state rather
than replacing it (`balTutOpen` / `balTutStep` are separate from `tutMode` /
`tutStep`). It does not dim the page; its steps' spots dim only the rest of the bar (see
[Spots](#spots-single-controls-cards-and-bar-parts)). A step pointing into the expanded
panel opens it, and nothing closes it again: the user opened the guide from that panel or
the bar.

### Onboarding popup

Rendered when `!onboardSeen || showComplexity`. `suspos_onboard_v1` defaults to
`true`, so in practice it appears through `showComplexity`: `closeTutEnd` sets it
whenever the **beginner or intermediate** guide is closed — DONE ✓ on the last step
or ✕ on any step. Not after PRO (there is no next tier) and not after the balance
guide. The point is to send the user to the tier buttons as they leave a tour.
`showComplexity` holds the tier the closed guide unlocks (`'intermediate'` after
BEG, `'pro'` after INT), and the popup opens with a green "🔓 INT unlocked" / "🔓 PRO
unlocked" line naming it. `closeOnboard` resets it to `false`.

---

## The card (`TutorialPanel`)

Props: `mode`, `step`, `onNext`, `onPrev`, `onClose`, `onDone`, `zoom`, and —
tier guides only — `quick` / `onQuick` for the QUICK START path, `units` /
`setUnits` for the units step, `appState` (the live `fe`) for step tasks, and `notice` for the locked-tier redirect message
(step 0 only; see Tier gating).

- **Header**: `{label} GUIDE · n / total`, the step title, and ✕. For tier guides
  ✕ is `closeTutEnd` and DONE ✓ is `finishTut`, which clears the saved step and then
  calls `closeTutEnd`, so closing early has the same popup and garage side-effects as
  finishing.
- **Progress bar**: one segment per step — done, current (indigo), upcoming.
- **Body**: the step's `body` string, in a `data-tut-body` element styled
  `white-space: pre-line`, so a `\n\n` in the string renders as a paragraph break.
  A step with `units:true` appends the `UnitsPicker` — the same control the UNITS
  modal uses, so a choice made here is the real setting.
- **Task**: a step with `task` appends a `TRY IT ·` line with a ○ marker. When the
  step opens, `appState` is snapshotted; whenever it changes, `task.check(appState,
  snapshot)` runs, and once it returns true the marker latches to ✓ (green) for the
  rest of that step. Returning to a step re-snapshots and resets it. A throwing
  check counts as not done. The task never gates NEXT — it is a nudge, and the
  spotlit zone is already clickable (see `dim()`), so the user acts in place. The
  balance guide passes no `appState`, so tasks there would never tick.
- **TERMS chips**: a step with `glossary` ends with a `TERMS` row (`data-tut-terms`),
  one chip per id labelled by `glossaryLabel`. A chip calls `glossaryBridge.open(id)`,
  which opens `GlossaryModal` scrolled to and flashing that entry. The glossary sits
  above the card (z-index 1100 vs 700), so the tour is still there when it closes,
  and focus returns to the chip when it was opened from the keyboard.
- **Buttons**: ← PREV from step 2 on; NEXT → until the last step, then DONE ✓.
  DONE calls `onDone` if given (tier guides: `finishTut`), otherwise `onClose`
  (balance guide).
- **Overflow**: if the body scrolls, a `▼ SCROLL FOR MORE` fade appears; it is
  re-checked twice after layout settles because the first measurement can run
  before the final height is painted.
- **Width**: `CARD_W` scales with the viewport between 264px (phones) and 380px,
  so desktop cards don't wrap a monospace paragraph into a needless scrollbar.

### Positioning

The card anchors to the bounding box of the step's spotted parts that are on screen
(see [Spots](#spots-single-controls-cards-and-bar-parts)). With no `spot`, or none of them
rendered, it anchors to every zone in `focus` together (the balance guide to
`zone-balance-bar`), so a step spotlighting two stacked controls doesn't get its card
placed over the second one. When the spotted parts leave no room above or below (the
expanded balance panel fills the screen), it tries the step's first spot alone before
centring, so a step lists its most important part first. Measurements are divided by
the app's CSS zoom, and use `visualViewport` height so the iOS toolbar doesn't push it
off-screen.

Scrolling: the sidebar is scrolled to `focus[0]`'s zone at once, then, when the step's
section has opened, the topmost spotted part is scrolled into view inside its own
scroller (the sidebar, the results panel, the expanded balance panel or the garage list).
Topmost, not first-listed: a spot list names both games' output cards, so list order is
not page order.

A **sidebar target** is one whose right edge is at or before the sidebar's. It used to be
"left of centre", which caught the full-width bar lanes whenever the sidebar was closed and
dropped the card on top of them.

- **Sidebar target, with room beside the sidebar**: the sidebar
  is first scrolled so the target is visible (instant, not smooth — a smooth scroll
  would still be moving when the card measures). The card floats just right of the
  sidebar, vertically centred on the target and clamped on-screen, with a
  left-pointing arrow. "Room" means the full `CARD_W` fits right of the sidebar.
- **Any other target (results, balance bar, garage), or a sidebar target
  with no room beside the sidebar (phones)**: the card goes above or below the
  target, whichever has more room, with an up/down arrow. If neither side can fit
  the card's natural height, a right-half target (e.g. `zone-output`, which fills
  the panel) falls back to centred; a sidebar target (a section taller than the
  screen) is pinned to the bottom edge with no arrow, so the section header and
  first controls stay visible.
- **No focus, or a zero-size target** (collapsed sidebar): centred, no arrow.

Positioning re-runs on window and visual-viewport resize.

---

## Step schema

Each step is an object in its guide's array:

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Card heading. |
| `body` | yes | Plain text, kept short (about 320 characters at most); depth goes in the glossary. `\n\n` renders as a paragraph break (the body is `pre-line`). |
| `glossary` | no | Array of `GLOSSARY` ids, rendered as TERMS chips that open the glossary at that entry. Keep it to three at most, and only entries whose `tier` is at or below the guide's tier, so a chip never opens a term the reader can't see yet. |
| `focus` | yes (may be `null`) | Array of zone keys to spotlight. `null` = info step, nothing spotlit. |
| `spot` | no | Array of part ids to light inside the focused zones: `HIDE_ITEMS` ids (`arb.bias`, `out.card.springs`, `bar.response`) or `SPOT_MARKS` ids (`tb.share`, `bal.tip`, `garage.save`). Each must sit in a zone the step focuses (the balance guide: `balance-bar`) and render in the guide's tier; ids that don't render right now (another mode, layout or game) are skipped. List the most important first. See [Spots](#spots-single-controls-cards-and-bar-parts). |
| `sidebar` | no | `'open'` or `'close'` forces the sidebar. |
| `units` | no | `true` embeds the units picker. |
| `quick` | no | `true` puts the step on the QUICK START path. `tutSteps(mode, quick)` filters on it — the quick path is a view over the same array, never a copy. |
| `pathChoice` | no | `true` swaps NEXT for QUICK START / FULL TOUR on this card. |
| `task` | no | `{text, check}`. `check(fe, snap)` → boolean, where `snap` is `fe` as it was when the step opened. Shows `text` with ○, ✓ once it passes. Never blocks NEXT. Beginner: Load a Preset, Ride Stiffness, Balance. |

### What a step does to the page

When a tier guide's step changes, an effect on `[tutMode, tutStep]`:

1. **Dims everything not in `focus`.** Each zone's wrapper calls `dim(...zones)`;
   while a tier guide is open, any zone not named in the current `focus` drops to
   12% opacity and stops taking clicks. On a `focus:null` step *every* zone is
   dimmed. The balance guide never dims zones. Inside the focused zones, a step's
   `spot` list lights its parts and fades the rest (below).
2. **Opens the matching sidebar section and collapses the rest.** Every `SECTION_VIS`
   key is also an `open` key, and `SEC_ZONE` names the zone that focuses it, so the
   effect reads one table:

   | `focus` key | Section opened |
   |---|---|
   | `chassis` | CHASSIS |
   | `build` | BUILD |
   | `balance-target` | BALANCE (PRO) |
   | `drivetrain` | DRIVETRAIN |
   | `arb` | ANTI-ROLL BARS |
   | `feel` | RIDE |
   | `damping` | DAMPERS |
   | `brakes` | BRAKES |
   | `alignment` | ALIGNMENT (PRO) |
   | `visuals` | VISUALS |

   Every step rewrites all ten (BRAKES opens for `brakes`), so a section left open by
   the user is closed when a step doesn't point at it. The expanded balance panel
   (`open.balanceExpanded`) is assigned the same way: open on a step with a `bal.*` spot,
   closed otherwise, for the garage's reason below.
3. **Opens the GARAGE overlay if `focus` includes `garage`, and closes it
   otherwise** — an assignment, not a conditional, so the full-height overlay
   doesn't hide the results for later steps. Closing a guide on a garage step
   (✕ or DONE, via `closeTut`) closes the overlay too — the beginner tour ends on
   one.
4. **Sets the sidebar**: an explicit `sidebar` wins; otherwise a step with a focus
   opens it, unless the focus includes `output` or `balance-bar`, which close it so
   the results panel is unobstructed. `focus:null` steps without `sidebar` leave it
   as the user had it.

`openTut` also opens the sidebar for step 1 unless that step sets `sidebar` itself.

On phones, a step (from either guide) with a spot in `balance-bar` also sets `footerOpen`,
since there the bar's stack folds behind its summary line.

### Spots: single controls, cards and bar parts

A step's `spot` list points at parts of a zone rather than the whole zone, using the ids
the layout edit view already gives every control, output card, row and bar part
(`HIDE_ITEMS`), plus `SPOT_MARKS` for things it can't hide: the toolbar's ⟲, ↩ ↪ and
SHARE, the bar's headline row, main bar and lanes, the expanded panel's tip and rows, and
the garage's save row, search row, FACTORY list and entry list. Both kinds of id are
permanent, like the codec's: retire one, never reuse it.

- **Finding them.** While either guide runs, `LayoutCtx.guide` is set and every `Hide`
  renders the same two-level wrapper the edit view uses (without its button or `inert`),
  carrying `data-hid`; `Card` always carries `data-hid`. Marks are a plain
  `data-spot="…"` attribute on an existing element. Outside guides `Hide` stays unwrapped.
- **Lighting them.** `spotCss(spot, zones)` returns a stylesheet `App` renders in a
  `<style>` element: an indigo outline and a faint tint on each spotted part, and inside
  each focused zone that holds one, the outermost other parts at 30% and unclickable. A
  part that contains a spot, or sits inside one, stays lit, so a card holding a spotted
  row isn't dimmed and an unspotted card dims once rather than once per row. Section
  headers, labels and warnings are not parts and stay as they are. A zone where none of
  the spots rendered is left alone, as before spots.
- **Fallback.** Spots are tried, not required: a control that only appears in another
  mode (MANUAL diff, a Sport diff's missing ENTRY, a measured NAT BAL hiding the track
  widths) or another game (BeamNG's per-axle cards against Forza's per-subsystem ones) is
  absent, and the step falls back to its zone for anchoring and dimming.
- **Out of view.** Spots that are present can lie beyond what their scroller shows: BeamNG
  puts BRAKES and the diffs above the suspension cards and ALIGNMENT below them. The card
  counts the spot ids wholly outside their scroller (and the screen), above and below, and
  adds a line under its body (`data-tut-offscreen`); it recounts on any scroll, once a
  frame, so the line follows the reader. Counting rather than scrolling, because scrolling
  to one part would push another out.
- **Dimming needs `:has()`.** A browser without it ignores the dim rule, keeping the
  outline but not the fade.

Zone keys valid in `focus` are the `zone-*` ids listed in
[CODE_MAP.md](CODE_MAP.md#sidebar-zones-and-tier-gating). A key whose zone
doesn't exist at the current tier (e.g. `balance-target` outside PRO) centres the
card and dims everything.

**Hidden parts reappear while either guide runs.** The layout edit view can hide a section, a
single control, a toolbar button or an output part, which would leave a step's `focus`,
`spot` or text pointing at nothing. `App`'s `secVis` returns `show` for every key and
`LayoutCtx` gets an empty hidden list while `guideOn` (`tutMode` or `balTutOpen`) is set, and
the user's hidden lists come back untouched when the guide closes. Starting either guide
also leaves the edit view, and EDIT is disabled until it ends. Before spots only `tutMode`
did this, so the balance guide explained a bar the user might have hidden. See
[CODE_MAP.md](CODE_MAP.md#layout-edit-view-hiding-sections-controls-and-output-parts).

---

## Step catalogue

Columns: **Spotlight** is `focus`; **Spots** is `spot` (ids with a shared prefix are
shortened, `arb.mode` / `.roll` …); **Sidebar** is an explicit `sidebar` override
(blank = the default rule above). `tests-docs.js` checks that each table lists
every step title of its guide, in order; `tests-sections.js` checks every spot id.

### Beginner <!--@tutorial beginner-->

| # | Title | Spotlight | Spots | Sidebar | Covers | Quick |
|---|---|---|---|---|---|---|
| 1 | Welcome to SUSP.OS | — | | close | What the app does; a working tune comes first, refinement after. | |
| 2 | Choose Your Units | — | | | Embedded units picker; match Forza's spring units. | ✓ |
| 3 | Load a Preset | `garage` | `garage.factory` | close | Load the FACTORY preset for the car's class (★ = build type) so every later step has results to show. | ✓ |
| 4 | Getting Around | `toolbar` | `tb.undo` | | ☰ sidebar, ↩ / ↪ undo / redo, ⓘ hints and TERMS. | |
| 5 | Layout & Build Type | `layout-build`, `build-type` | | | Drive layout and build type and what they drive. | |
| 6 | Weight & Front Bias | `weight` | | | Take them from the car selection screen. | |
| 7 | Ride Stiffness | `ride-stiffness` | | | SOFT / ROAD / FIRM / RACE, FIRM as the start. | |
| 8 | Balance | `balance` | | | OVERSTEER ↔ UNDERSTEER slider and when to lean each way. | ✓ |
| 9 | Character | `character` | | | STABLE ↔ AGILE damping feel. | |
| 10 | Handling Balance Bar | `balance-bar` | `bar.head`, `bar.main` | close | Sign; CAR tick, NET headline; tap to expand. | |
| 11 | Reading the Results | `output` | `out.card.arb` / `.springs` / `.dampers` / `.suspF` / `.suspR` | | The suspension cards first; amber = near a game limit. | ✓ |
| 12 | Alignment, Brakes & Diff | `output` | `out.card.align` / `.brakes` / `.diff` / `.alignF` / `.alignR` / `.diffF` / `.diffR` / `.center` | | The other cards follow layout and build type; starting points to tune by feel. | |
| 13 | Output Toolbar | `toolbar` | `tb.reset`, `tbDna`, `tbCheck`, `tb.share` | | RESET, DNA, CHECK, SHARE. | |
| 14 | Saving Your Own | `garage` | `garage.save` | close | SAVE CHASSIS / BUILD / CAR once the tune is worth keeping; `?` reopens the guide. | |

### Intermediate <!--@tutorial intermediate-->

There are no Key Terms cards any more: Hz, ζ and roll stiffness are TERMS chips on
the Welcome card and live in the glossary.

| # | Title | Spotlight | Spots | Sidebar | Covers |
|---|---|---|---|---|---|
| 1 | Welcome — Intermediate Mode | — | | | Collapsible sections, SECTIONS − / +, per-section ↺; TERMS chips for Hz, ζ and roll stiffness. |
| 2 | Chassis | `chassis` | `chassis.layout` / `.weight` / `.frontBias` / `.tyres` / `.cgSource` | | Layout / weight / bias moved here; CG height source. |
| 3 | Build Type | `build` | | | What build type steers: auto diff locks, recommended diff type, brake balance, alignment. |
| 4 | ARB Stiffness & Balance Mode | `arb` | `arb.mode` / `.basic` / `.roll` / `.share` / `.manF` / `.manR` / `.balMode` / `.neutralMethod` | | Stiffness modes AUTO / BASIC / ROLL ° / SHARE % / MAN; WEIGHT / NEUTRAL split. |
| 5 | ARB Bias & Visuals | `arb`, `visuals` | `arb.bias`, `visuals.ride` | | ARB Bias; where the roll split and ARB track live in VISUALS. |
| 6 | Ride Ref & Rear Hz | `feel` | `ride.ref` / `.hzMode` / `.targetSpeed` / `.hzMult` / `.hzMan` | | RIDE REF.; Hz MODE MULTIPLIER / FLAT RIDE / INDEPENDENT / SHARED. |
| 7 | Dampers | `damping` | `dampers.reboundZeta` / `.bumpRatio` / `.bias` | | Rebound ζ, Bump Ratio, Damping Bias and DAMP in the ENTRY lane. |
| 8 | Brakes | `brakes` | `brakes.stock` / `.bias` | | Brake Bias: a STABLE ↔ ROTATE shift from the recommendation; STOCK for a car without race brakes. |
| 9 | Diff Type | `drivetrain` | `drive.diffType` | | Race / Sport / Rally / Offroad / Drift lock curves; Sport is accel-only. |
| 10 | Corner Exit & Entry | `drivetrain` | `drive.exit` / `.entry` | | EXIT (GRIP ↔ ROTATE) and ENTRY (STABLE ↔ LOOSE, hidden on Sport); right = more rotation; DIFF in the ENTRY / EXIT lanes follows. |
| 11 | AWD Center Diff | `drivetrain`, `output` | `drive.powerSplit` / `.frontExit`, `out.diff.recCenter`, `out.card.center` | open | POWER SPLIT, CENTER SPLIT recommendation and → USE, FRONT AXLE EXIT. On FWD / RWD nothing here renders and the zones are lit instead. |
| 12 | VISUALS Card | `visuals` | `visuals.ride` / `.dynamics` / `.sag` | | RIDE · ROLL · DAMPING, DYNAMICS (±10% settle band), SAG vs LOAD. |
| 13 | Handling Balance Bar | `balance-bar` | `bar.head` / `.main` / `.legend` | close | NET: the CAR tick, SPR and ARB, the NET tick; tap for the rows. |
| 14 | Entry & Exit Lanes | `balance-bar` | `bar.lanes` | close | The ENTRY / EXIT lanes INT adds, off NET, outside the headline. |
| 15 | Reading the Results | `output` | as BEG step 11 | close | The suspension cards first; amber = near a game limit. |
| 16 | Alignment, Brakes & Diff | `output` | as BEG step 12 | close | The other cards and the settings they follow. |
| 17 | Output Toolbar | `toolbar` | `tb.reset`, `tbDna`, `tbCheck`, `tb.share` | | RESET, DNA, CHECK, SHARE. |
| 18 | Garage | `garage` | `garage.save` / `.list` | close | CHASSIS / BUILD / CAR entries, LOAD CHASSIS / LOAD BUILD. |
| 19 | Organizing & Searching | `garage` | `garage.search` | close | Notes, tags, auto-tags, filter / sort, ↺ rewrite. |
| 20 | Sharing & Backup | `toolbar` | `tb.share` | open | COPY CODE / COPY LINK / LOAD CODE and its part picker, BACKUP, RESTORE. It spotlit the garage until spots; SHARE is a toolbar button. |

### Pro <!--@tutorial pro-->

| # | Title | Spotlight | Spots | Sidebar | Covers |
|---|---|---|---|---|---|
| 1 | Welcome — Pro Mode | — | | | What PRO adds; alignment stays AUTO unless set to MANUAL. |
| 2 | Chassis Geometry | `chassis` | `chassis.wheelbase` / `.trackF` / `.trackR` / `.tyres` | | FROM THE GAME vs LOOK UP ONLINE; wheelbase, track widths, and what tyre width does; how they set the Balance Guide's NATURAL and GRIP BIAS. |
| 3 | Calibrating Natural Balance | `chassis` | `chassis.measureNatBal` | | MEASURE NAT BAL → Tune Check MEASURE; the reading replaces the geometry prediction; CLEAR / ✕. |
| 4 | Calibrating ARB Scale | `balance-target` | | | Step 2 · ARB SCALE SETUP, per-reading scales, SCALE IN USE toggle. Its controls are in the MEASURE tab, so no spots. |
| 5 | Mech Balance Target | `balance-target` | `balance.targetNat` / `.guide` | | Offset from NAT, start from the Balance Guide's range; shown only when MECH, CO-SOLVE or Hz MECH uses it. |
| 6 | Balance Target Mode | `balance-target` | `balance.targetMode` / `.offset` / `.targetAbs` / `.exitLoad` | | NATURAL / RANGE / GRIP / PHASE / MANUAL, Balance Offset. |
| 7 | Alignment Mode | `alignment` | `align.mode` / `.nudge` / `.nudgeStrength` | | AUTO / MANUAL; Nudge MECH / GRIP and Nudge Strength under AUTO. |
| 8 | PRO ARB Balance Modes | `arb` | `arb.balMode` / `.springShare` / `.mechSplit` / `.coSolveSplit` / `.coSolveCorr` | | CHASSIS, MECH, CO-SOLVE; Spring Share; unreachable targets flagged. |
| 9 | Hz MECH & Balance Target Mode | `feel`, `balance-target`, `visuals` | `ride.hzMode`, `balance.targetMode`, `visuals.ride` | | Hz MECH (ignored under CO-SOLVE); target mode applies to all three. |
| 10 | Brake Bias Centre | `brakes` | `brakes.centre` / `.decel` / `.entryTarget` / `.entryBrk` | | Centre REC / GRIP / ENTRY: Decel, Entry vs MID (trail braking), ENTRY BRK. |
| 11 | Manual Differential | `drivetrain` | `drive.diffMode` / `.matchChassis` and the seven `drive.man*` | | MANUAL lock % fields (AWD adds Center Split) with typical-range hints; MATCH CHASSIS in AUTO. |
| 12 | Handling Balance Expanded | `balance-bar` | `bal.tip` / `.rows`, `bar.phase` | | Opens the expanded panel. Grip-margin % by phase (ENTRY / MID / EXIT) and what each phase adds; tips. |
| 13 | Mech Balance & Response | `balance-bar` | `bar.mechHead` / `.mechStrip` / `.response` | | The MECH BALANCE strip (NAT, CUR, TGT on the game's scale) and RESPONSE. |
| 14 | Load Transfer | `visuals` | `visuals.load` / `.grip` | | VISUALS' LOAD TRANSFER (FRONT TAKES vs weight at 1 g) and GRIP USE (which axle runs out first, by phase). |
| 15 | Output Panel & Tune Check | `toolbar` | `tbCheck`, `tb.share`, `tb.reset` | | CHECK (DECODE / MEASURE), SHARE's part staging, RESET. |

### Handling balance <!--@tutorial balance-->

All steps are `focus:null`; the card still anchors to `zone-balance-bar`, or to the
step's spots, which dim the rest of the bar only.

| # | Title | Spotlight | Spots | Sidebar | Covers |
|---|---|---|---|---|---|
| 1 | Handling Balance | — | `bar.head` | | NET headline; sign convention: + oversteer, − understeer; colour zones. PRO reads grip-margin % by phase (ENTRY / MID / EXIT). |
| 2 | Reading the Bar | — | `bar.main` / `.lanes` / `.legend` | | CAR tick → SPR / ARB → NET tick; from INT, ENTRY / EXIT lanes off NET; PRO's arrows and TOTAL line. |
| 3 | Typical Targets by Build | — | | | Rough ranges per build; zero isn't the goal. The ranges are BEG/INT points; PRO's ±1% NEUTRAL is a smaller unit. |
| 4 | Reading Each Row | — | `bal.rows` | | CAR STARTS, then springs and ARBs (make NET) vs diff, brakes, damping (entry / exit); value and % share. PRO groups by phase instead. Opens the expanded panel. |
| 5 | Using the Correction Tip | — | `bal.tip` | | Move the largest contributor first; the main balance control for big shifts. |
| 6 | Response Bar | — | `bar.response` | | PLANTED ↔ REACTIVE, separate from understeer / oversteer. |

---

## Step text

Every step's text, word for word, as the card shows it. A step with a task adds the
`TRY IT ·` line below its body. A step's TERMS chips are not quoted: their labels are
glossary labels (the step's `glossary` ids), not step text. The catalogue above
says what each step is *for*; this is what it *says*. `tests-docs.js` checks both
directions, per step: every body, term, definition and task in `TUTORIALS` must
be quoted under its own heading, and every quote must still be in that step — so a
reworded, added, removed or moved step fails the run until this section is updated.

### Beginner <!--@steptext beginner-->

#### 1. Welcome to SUSP.OS

> SUSP.OS works out suspension values from your car's stats and the handling you want. This guide gets you a working tune in a few steps, then shows how to refine it.

#### 2. Choose Your Units

> Pick the units your game shows, especially for spring rate, so values here can be typed straight in. You can change them later with UNITS.

#### 3. Load a Preset

> Pick a preset for your car's class under FACTORY in the garage and load it; ★ marks the ones matching your build type. The results panel then holds a full tune, and the next steps fit it to your car.

TRY IT task (ticks when the check passes):

> Load any FACTORY preset.

#### 4. Getting Around

> ☰ opens and closes this sidebar; results update live as you change it. ↩ and ↪ at the top undo and redo tune changes. Tap or hover an ⓘ for a short hint, and TERMS (in the header or a hint) for the full explanation.

#### 5. Layout & Build Type

> Layout (FWD / RWD / AWD) is which wheels get power. Build type (Street / Track / Drift / Rally / Offroad / Drag) is the car's intended use, and shifts the alignment, brake balance and diff toward it.

#### 6. Weight & Front Bias

> Enter the car's total weight and front weight bias from the car selection screen, not the tuning menu. Almost every calculation starts from these two numbers.

#### 7. Ride Stiffness

> Overall suspension stiffness. FIRM is the best starting point; SOFT and ROAD suit comfort or rough surfaces, RACE smooth circuits only.

TRY IT task (ticks when the check passes):

> Drag Ride Stiffness and watch the category change.

#### 8. Balance

> Right (OVERSTEER) stiffens the rear for more rotation; left (UNDERSTEER) stiffens the front for stability on corner entry. Centre is neutral for your weight distribution and suits most builds.

TRY IT task (ticks when the check passes):

> Move the Balance slider and watch the Handling Balance bar move with it.

#### 9. Character

> Damping feel: how quickly the car settles after a bump or weight shift. STABLE is more damped, planted and predictable; AGILE is lighter, livelier and more reactive. Match it to your driving style.

#### 10. Handling Balance Bar

> This bar shows your handling tendency: + toward oversteer, − toward understeer. The grey tick is the car on its own; springs and bars carry it to the white NET tick, the headline. Tap it for the breakdown, including brakes and diff.

#### 11. Reading the Results

> The results panel holds the values to type into the game's tuning menu. Start with the suspension: anti-roll bars, springs and dampers come from your ride, balance and character settings. Amber means a value is near the game's limit: soften your inputs slightly.

#### 12. Alignment, Brakes & Diff

> ALIGNMENT, BRAKES and DIFFERENTIAL follow your layout and build type. Type them in as shown: like every card, they are starting points to fine-tune by feel once you've driven the car.

#### 13. Output Toolbar

> ⟲ RESET clears the tune, the tutorials or both, never garage saves. DNA (PRO) builds a tune from handling targets, CHECK reads back the frequencies and damping behind an existing tune, and SHARE moves tunes by code or link and backs up your garage.

#### 14. Saving Your Own

> Name the setup in the row above the preset list, then SAVE CHASSIS (the car: weight, bias, layout), SAVE BUILD (the tune) or SAVE CAR (both). Saves list under FACTORY; loading one is undoable with ↩. Reopen this guide any time with ?.

### Intermediate <!--@steptext intermediate-->

#### 1. Welcome — Intermediate Mode

> Intermediate adds separate ride frequency, damping and ARB controls. The sidebar is now collapsible sections: tap a header to open one, SECTIONS − / + to collapse or expand them all, and a header's ↺ to reset just that section. This guide covers only what's new.

#### 2. Chassis

> Layout, Weight and Front Weight Bias now sit in the CHASSIS section; take weight and bias from the car selection screen, not the tuning menu. Tyre sizes and CG Height Source (RIDE HEIGHT or MANUAL) are here too.

#### 3. Build Type

> Build Type in the BUILD section (STREET / TRACK / DRIFT / RALLY / OFFROAD / DRAG) sets the car's intended use. It steers the diff's automatic locks, the recommended diff type, brake balance and alignment.

#### 4. ARB Stiffness & Balance Mode

> Stiffness Mode sets the total bar stiffness: AUTO, BASIC, ROLL °, SHARE % or MAN (front and rear typed directly, which hides Balance Mode and ARB Bias). Balance Mode splits it front to rear: WEIGHT follows the weight split; NEUTRAL works from the springs, by CANCEL or EQUAL ROLL.

#### 5. ARB Bias & Visuals

> ARB Bias nudges that split: toward FRONT HEAVY for more understeer and stability, toward REAR HEAVY for more rotation. VISUALS, pinned at the bottom of the sidebar, shows the resulting roll split, body roll and bar stiffness under RIDE · ROLL · DAMPING.

#### 6. Ride Ref & Rear Hz

> RIDE REF. picks the axle the stiffness slider sets: FRONT, SHARED (the average) or REAR. Hz MODE derives the other: MULTIPLIER (fixed ratio, default), FLAT RIDE (less pitch bounce at Target Speed), INDEPENDENT (set by hand; not with SHARED) or SHARED (needs RIDE REF. SHARED and BOTTOM G's).

#### 7. Dampers

> Rebound ζ starts at 70% (Butterworth); Bump Ratio sets bump as a share of rebound, 40–65% typical. Damping Bias toward FRONT leaves the front relatively firmer (planted entry), toward REAR the rear (easier direction changes); DAMP in the Handling Balance ENTRY lane shows it.

#### 8. Brakes

> BRAKES holds Brake Bias, a shift of up to 10 points from the recommended brake bias. ROTATE moves it rearward for more rotation on the brakes, STABLE forward for a steadier entry; the BRAKES card shows the result. Set it by feel in the game. No race brakes fitted? Set Brakes to STOCK and the brakes drop out of the calculations.

#### 9. Diff Type

> DIFF TYPE picks the differential fitted to the car: Race, Sport, Rally, Offroad or Drift. Each has its own lock curve, so the same % gives a different effective lock; Sport is accel-only, with no decel control.

#### 10. Corner Exit & Entry

> EXIT sets on-throttle behaviour (GRIP ↔ ROTATE), ENTRY lift-off and trail-braking rotation (STABLE ↔ LOOSE; hidden on a Sport diff). Right means more rotation on both; the DIFF in the Handling Balance ENTRY and EXIT lanes follows.

#### 11. AWD Center Diff

> AWD adds POWER SPLIT under CENTER (not with a Sport diff): default 65% rear, and more rear means more oversteer. The DIFFERENTIAL card's CENTER SPLIT box recommends a value and → USE applies it. AWD also gets a FRONT AXLE EXIT slider; toward PUSH adds exit understeer.

#### 12. VISUALS Card

> VISUALS, pinned at the bottom of the sidebar, holds three collapsible readouts: RIDE · ROLL · DAMPING (roll split, ride Hz, bars and damping), DYNAMICS (step response with its ±10% settle band) and SAG vs LOAD (travel against load; needs the RIDE HEIGHT CG source). Tap a header to collapse it.

#### 13. Handling Balance Bar

> The Handling Balance bar at the bottom of the results shows NET, the car plus springs and bars: + toward oversteer, − toward understeer. The grey tick is the car on its own; SPR and ARB stack from it to the white NET tick. Tap it for the rows behind each.

#### 14. Entry & Exit Lanes

> Below the bar, the ENTRY and EXIT lanes start from NET and stack what acts only at each end of a corner: brakes and damping on entry, the diff on both. They show how the car changes through the corner without moving the headline.

#### 15. Reading the Results

> The results panel holds the exact values to type into the game's tuning menu. Start with the suspension: anti-roll bars, springs and dampers, from the ANTI-ROLL BARS, RIDE and DAMPERS sections. Amber means a value is near the game's limit: soften your inputs slightly.

#### 16. Alignment, Brakes & Diff

> ALIGNMENT follows your build type, BRAKES applies your Brake Bias shift and DIFFERENTIAL the locks your DRIVETRAIN settings solve for. Type them in as shown, then fine-tune by feel.

#### 17. Output Toolbar

> At the top of the sidebar: ⟲ RESET returns the tune to defaults (saves untouched), DNA (PRO) builds a tune from handling targets, CHECK reads back a tune you already have, and SHARE handles codes and garage backups.

#### 18. Garage

> GARAGE (top right) holds everything you save: a CHASSIS (weight, bias, layout), a BUILD (feel settings and diff) or a CAR (both). A car's LOAD CHASSIS and LOAD BUILD let you pair one car's chassis with another's tune, and every load is undoable with ↩.

#### 19. Organizing & Searching

> Entries take notes and your own tags, plus automatic ones, all searchable from the row under the save buttons, with filter and sort. ↺ rewrites an entry from your current setup as CHASSIS, BUILD or BOTH; BOTH turns a chassis entry into a full car.

#### 20. Sharing & Backup

> SHARE copies a code or link (COPY CODE / COPY LINK), loads one (LOAD CODE), and backs up or restores the garage as JSON (BACKUP / RESTORE). A loaded code is staged: tick the parts you want and APPLY SELECTED takes only those.

### Pro <!--@steptext pro-->

#### 1. Welcome — Pro Mode

> PRO adds a Mech Balance Target, the CHASSIS, MECH and CO-SOLVE balance modes, Hz MODE MECH, chassis geometry (wheelbase, track widths), a brake bias Centre and a manual differential. Alignment stays AUTO unless you switch ALIGNMENT to MANUAL. This guide covers only what's new.

#### 2. Chassis Geometry

> CHASSIS now splits by source. FROM THE GAME adds MEASURE NAT BAL; LOOK UP ONLINE holds wheelbase and track widths, which Forza never shows. The defaults suit most cars, so enter exact values if you have them. Track widths (and slightly tyre widths) set the Balance Guide's NATURAL; tyre width also sets each axle's grip, moving GRIP BIAS and its AGILE–PLANTED tag.

#### 3. Calibrating Natural Balance

> MEASURE NAT BAL, at the end of the FROM THE GAME group in CHASSIS, opens Tune Check's MEASURE tab: set the springs and bars it lists in Forza, then type the Mech Balance the game shows. The reading replaces the geometry prediction everywhere and hides the track-width fields; CLEAR, or ✕ beside the reading, drops it.

#### 4. Calibrating ARB Scale

> ARB clicks are worth a different stiffness on every car. STEP 2 · ARB SCALE SETUP, in the same MEASURE tab, finds yours: set the bars each reading lists, type the Mech Balance Forza shows, then pick MEASURED under SCALE IN USE.

#### 5. Mech Balance Target

> How far to move Forza's Mech Balance from the car's natural balance (NAT): 0 stays natural, + adds rotation, − adds stability; start from the Balance Guide's range. It shows only while ARB Balance Mode MECH or CO-SOLVE, or Hz MODE MECH, solves toward it; CHASSIS anchors on natural balance instead.

#### 6. Balance Target Mode

> Balance Target mode sets what the target is measured from: NATURAL (offset from natural balance), RANGE (the middle of the Balance Guide's RANGE), GRIP (GRIP TARGET, the grip-neutral point), PHASE (PHASE TARGET, neutral across entry, mid-corner and exit) or MANUAL (a raw value, e.g. 0.60). In RANGE, GRIP and PHASE, Balance Offset shifts it toward oversteer (+) or understeer (−).

#### 7. Alignment Mode

> AUTO (default) derives camber, toe and caster from your build and chassis; MANUAL takes exact values instead. Under AUTO, Nudge MECH tilts camber and toe toward your Mech Balance Target's intent and GRIP against the chassis's own grip tendency; Nudge Strength sets how far, 0% giving pure AUTO values.

#### 8. PRO ARB Balance Modes

> CHASSIS is WEIGHT anchored on the car's natural balance instead of raw weight %. MECH solves the bar split alone to hit your Mech Balance Target; CO-SOLVE moves rear spring Hz and the bar split together, mixed by Spring Share. A target the car can't reach within game limits is flagged.

#### 9. Hz MECH & Balance Target Mode

> Hz MODE MECH, in RIDE, derives the other axle's Hz from the Mech Balance Target under any ARB balance mode but CO-SOLVE, which solves rear Hz itself, and NEUTRAL CANCEL, whose bars would undo it. The target mode applies alike to MECH, CO-SOLVE and Hz MECH. VISUALS at the bottom of the sidebar shows the resulting roll split and bar tracks.

#### 10. Brake Bias Centre

> BRAKES adds Centre. REC shifts Brake Bias from the recommendation; GRIP from the bias where both axles hit their braking limit together at your Decel; ENTRY solves it for trail braking, from Entry vs MID. ENTRY BRK, under the toggle, shows what the bias does to corner entry.

#### 11. Manual Differential

> MANUAL swaps the diff sliders for lock % fields: Accel and Decel Lock, or on AWD Front/Rear Accel and Decel plus Center Split, with your diff type's typical range under each lock. In AUTO, MATCH CHASSIS (above the EXIT and ENTRY sliders) biases the diff to reinforce your Mech Balance Target.

#### 12. Handling Balance Expanded

> Expand the Handling Balance bar (on phones, tap it, then CONTRIBUTIONS) for a breakdown by corner phase in grip-margin percent, + meaning the rear lets go first. ENTRY adds brake bias, MID holds chassis, springs and ARBs, EXIT adds the drive split, and the tips at the top name what to move.

#### 13. Mech Balance & Response

> The MECH BALANCE strip reads balance on the game's 0–1 scale: NAT is the car on its own, CUR the current setup, TGT your target while something solves toward it. RESPONSE rates how quickly the car reacts to steering, PLANTED to REACTIVE, apart from understeer and oversteer.

#### 14. Load Transfer

> LOAD TRANSFER in VISUALS shows the loads at 1 g cornering. FRONT TAKES is the front's share of the transfer against the weight split; springs and bars move it. GRIP USE below it predicts which axle runs out of grip first, mid-corner, on entry and on exit.

#### 15. Output Panel & Tune Check

> The results cards work as in the lower tiers. CHECK opens Tune Check: DECODE reads back an existing tune's frequencies and damping, and MEASURE holds the NAT BAL and ARB SCALE steps. SHARE stages a loaded code so you tick which parts land; RESET never touches saves, and a tune RESET is one ↩ from undone.

### Handling balance <!--@steptext balance-->

#### 1. Handling Balance

> The headline is NET: the car's own lean plus springs and bars. + leans oversteer, − understeer. The zones run neutral, mild and aggressive, but the right number depends on your goal. In PRO the total is a grip margin in percent, read by corner phase.

#### 2. Reading the Bar

> The grey CAR tick is where the car sits before tuning. SPR and ARB stack from it to the white NET tick. From INT, ENTRY and EXIT lanes below stack brakes, diff and damping off NET; PRO arrows diff and damping, adds the drive split, and draws a pink TOTAL line above.

#### 3. Typical Targets by Build

> Drift and rotation-heavy builds typically run +15 to +35, track builds +5 to +20, street and GT builds mild understeer. Read the bar for where balance comes from, not as a number to zero. These are BEG/INT points; PRO's grip-margin percent is a smaller unit, NEUTRAL within ±1%.

#### 4. Reading Each Row

> CAR STARTS is the car's own lean before tuning. The rows below move it: springs and anti-roll bars make NET, then diff, brakes and damping act on entry and exit. Each shows its value and share, so the dominant one stands out. PRO groups the rows by corner phase.

#### 5. Using the Correction Tip

> The tip at the top of the expanded panel names the largest contributor and which way to move. Reach for that input first; for big shifts, your main balance control has the most leverage.

#### 6. Response Bar

> RESPONSE rates how quickly the car reacts to steering, separately from understeer and oversteer: a neutral car can still be very planted or very reactive. PLANTED (left) is settled and predictable but slower to change direction; REACTIVE (right) turns in sharply but can feel nervous.

### Around the guides <!--@steptext flow-->

The text the tutorial flow shows outside the `TUTORIALS` steps. `{…}` stands for a
value filled in at the time.

**Locked tier button** — its `title` (hover text) while the tier is locked
(`lockTitle`); `{tier}` is BEG for INT and INT for PRO:

> Unlocks after you open the {tier} guide

**Locked tier notice** — above the body of the first card, after a locked tier is
clicked (`tutNotice`, set in `tryAccessMode`), shown after a 🔒:

> {INT / PRO} unlocks once you've seen the {BEG / INT} guide.

**Quick start, last card** — added under the body of the DONE card on the QUICK
START path:

> That's the quick start. Tap ? in the header any time to replay the full tour.

The first beginner card (`pathChoice`) swaps NEXT for two buttons, QUICK START and
FULL TOUR →.

**Spots out of view** — under the body of a card whose step has spotted parts outside
what their scroller shows (`spotOff`), one line per direction, `{n}` counting spot ids:

> ▲ {n} more highlighted above — scroll to see

> ▼ {n} more highlighted below — scroll to see

**Resume choice** — the header `?` with a saved step for this tier; buttons
START OVER and RESUME AT STEP {n}:

> {BEGINNER / INTERMEDIATE / PRO} GUIDE

> You left this guide at step {n} of {total}.

**Onboarding popup** — headed COMPLEXITY LEVEL, over a preview of the BEG / INT /
PRO and `?` buttons, dismissed with GOT IT. When a guide has just unlocked a tier
it opens with:

> 🔓 {tier} unlocked — {change}.

where `{tier}` is INT after the BEG guide, with `{change}`:

> more controls are now available

and PRO after the INT guide, with:

> every control is now available

Then, always:

> Choose how much of the app to show. BEG is the best starting point — fewer controls, guided outputs. Press ? at any time to open a step-by-step tutorial.

---

## Persistence and reset

| Key | Holds |
|---|---|
| `suspos_tutorial_seen_v1` | `{beginner, intermediate, pro}` — tier guides seen (also the tier gate) |
| `suspos_tutorial_step_v2` | `{beginner, intermediate, pro}` — last step reached per tier guide, as `{title, step}` or `null` |
| `suspos_tutorial_step_v1` | the same as bare indices — read-only, converted into `_v2` once |
| `suspos_baltut_seen_v1` | Balance guide seen |
| `suspos_onboard_v1` | Onboarding popup dismissed (defaults `true`) |

Full shapes are in [PERSISTENCE.md](PERSISTENCE.md). Which guide is open is session
state — a reload closes it — but every step change in a tier guide writes that step
to `suspos_tutorial_step_v2` as `{title, step}` (step 1 writes `null`). Pressing the
header `?` with a saved step shows a small choice, **RESUME AT STEP n** or **START
OVER**; with nothing saved it opens at step 1 as before. `tutResumeStep` finds the saved
title wherever the step has moved, so adding, removing or reordering steps no longer shifts
anyone's place; only a removed step falls back to the saved index, clamped. Step titles must
therefore be unique within a guide (`tests-sections.js` checks).

`_v1` saved bare indices, and paid for it twice: dropping the INT Key Terms cards moved INT
saves on by two, and the spot splits would have moved later saves back by one or two. `_v1`
is now read once, through `tutProgressFromV1`, which counts each guide without the steps in
`TUT_ADDED_SINCE_V1` (the spot splits) to find the title it meant. Resuming goes through `openTut(mode, step)`, so
the `[tutMode, tutStep]` effect applies that step's sidebar, garage and section
state exactly as stepping there would. DONE ✓ clears the tier's entry; ✕ keeps it.
The balance guide is not tracked — it's six steps.

RESET (⟲) with **Tutorials** ticked sets all three tier flags and
`suspos_baltut_seen_v1` back to `false` and clears `suspos_tutorial_step_v2`, which re-locks INT and PRO until their
prerequisite guides are opened again. It does not open a guide by itself, and
does not move you out of the tier you're in: the auto-open effect runs on a
*tier change*, so each tier guide reappears the next time you switch into its
tier, and the balance guide the next time the Handling Balance bar is expanded
(its **? GUIDE** button replays it without a reset).

---

## Adding or changing a step

1. Edit the step in `TUTORIALS`. Keep it about the tier it's in — INT and PRO
   guides only cover what that tier adds. Keep the body short and point at the
   glossary for depth: add or reuse a `GLOSSARY` entry and list its id in `glossary`
   rather than growing the body. Definitions belong in the glossary, not in a
   tutorial step.
2. If it spotlights something new, give that element a `zone-*` id wrapper with
   `style={dim('your-key')}`, and update CODE_MAP's zone list and count.
3. If the spotlit control lives in a new collapsible section, give the section a
   `SECTION_VIS` row and a `SEC_ZONE` entry: the `[tutMode, tutStep]` effect opens
   sections from those, or the card will point at a closed accordion.
4. To point at single parts, list their ids in `spot`, most important first. A control,
   card, row or bar part the edit view can hide already has an id (`HIDE_ITEMS`); for
   anything else, add a `SPOT_MARKS` row and a `data-spot="…"` attribute on the element.
   `tests-sections.js` checks each id exists, sits in a focused zone and renders in the
   guide's tier.
5. Update the catalogue table and the step's [Step text](#step-text) entry above —
   `tests-docs.js` checks the titles, and the text word for word both ways.
6. Walk the whole guide in a browser at phone and desktop widths, in Forza and BeamNG.
   Positioning, scroll-for-more, dimming and whether a spot is on screen at all are
   layout behaviour nothing but a browser proves.

When a control is renamed or a behaviour changes, grep `TUTORIALS` for the old
wording as well as the docs — tutorial bodies have lagged behind the code before
(see HISTORY.md, "four in-app hint/tutorial strings lagged behind").
