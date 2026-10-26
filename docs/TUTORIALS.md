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
| `balance` | `HANDLING GUIDE` | The **? GUIDE** button in the expanded Handling Balance panel | The expanded Handling Balance breakdown |

The balance guide is labelled `HANDLING`, not `BALANCE`, on purpose: the PRO
sidebar has its own BALANCE section with an unrelated BALANCE GUIDE widget, and
"BALANCE GUIDE" on the card would collide with it.

Guides never chain: closing one opens nothing else. There is also a one-card
**complexity popup** (the `ONBOARDING POPUP` block), not a `TUTORIALS` guide, which
today shows only for a stored `suspos_onboard_v1` of `false`. See
[Onboarding popup](#onboarding-popup) below.

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
  `closeTut` and end on the same last-card line (below).
- **Every tier ends the same way.** The last card of each tier guide, full or quick,
  carries a green line from `TUT_END_NOTE` (`data-tut-end`): BEG and INT name the tier
  they unlocked and where to switch to it, PRO says the guide is done and how to reopen
  it. DONE ✓ (or ✕) then just closes the card. Nothing opens after it: the complexity
  popup used to open on closing BEG or INT (and not PRO), and highlighted BEG whatever
  the tier, and the balance guide used to open itself on the bar's first expand.

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

Opt-in. Only the **? GUIDE** button in the expanded Handling Balance panel opens it
(`openBalTut()`), on desktop and phones alike (phones: tap the bar, then CONTRIBUTIONS).
Expanding the bar opens nothing: it used to open the guide on the first expand while
`balTutSeen` was false, which chained a third guide onto a tier tour whose last steps
point at the bar. `openBalTut` still marks `balTutSeen`, so the key records that it has
been opened. The BEG guide's Handling Balance Bar step names the ? GUIDE. The header `?`
never opens it. It runs alongside a tier guide's state rather than replacing it
(`balTutOpen` / `balTutStep` are separate from `tutMode` / `tutStep`). It does not dim
the page; its steps' spots dim only the rest of the bar (see
[Spots](#spots-single-controls-cards-and-bar-parts)). A step pointing into the expanded
panel opens it, and nothing closes it again: the user opened the guide from that panel.

### Onboarding popup

Rendered when `!onboardSeen`. `suspos_onboard_v1` defaults to `true`, so it shows
only for a stored `false`; GOT IT or a backdrop click (`closeOnboard`) sets it `true`.
Its preview of the tier buttons highlights the tier you are on. It used to open through
`showComplexity` whenever the BEG or INT guide closed, naming the tier just unlocked;
that line now sits on the guide's last card instead (`TUT_END_NOTE`).

---

## The card (`TutorialPanel`)

Props: `mode`, `step`, `onNext`, `onPrev`, `onClose`, `onDone`, `zoom`, and —
tier guides only — `quick` / `onQuick` for the QUICK START path, `units` /
`setUnits` for the units step, `appState` (the live `fe`) for step tasks and `absent`
notes, `notice` for the locked-tier redirect message (step 0 only; see Tier gating),
`shown` (which steps this car runs) and `endNote` (the last card's `TUT_END_NOTE` line).

- **Header**: `{label} GUIDE · n / total`, the step title, and ✕. For tier guides
  ✕ is `closeTut` and DONE ✓ is `finishTut`, which clears the saved step and then
  calls `closeTut`, so closing early has the same garage side-effect as finishing.
  `n / total` and the progress bar count only the steps this car runs (the `shown`
  prop; see `skip` under [Step schema](#step-schema)).
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
- **Absent note**: a step with `absent` shows its `text` in an amber box when none of
  `absent.ids` is on the page, so a step about a control that only renders in another
  mode says how to reach it. Re-checked as the tune changes, so it clears once the
  reader switches that mode.
- **Buttons**: ← PREV from the first shown step on; NEXT → until the last shown step, then DONE ✓.
  DONE calls `onDone` if given (tier guides: `finishTut`), otherwise `onClose`
  (balance guide).
- **Overflow**: if the body scrolls, a `▼ SCROLL FOR MORE` fade appears; it is
  re-checked twice after layout settles because the first measurement can run
  before the final height is painted.
- **Width**: `CARD_W` scales with the viewport between 264px (phones) and 380px,
  so desktop cards don't wrap a monospace paragraph into a needless scrollbar.

### Positioning

The card anchors to the bounding box of the step's spotted parts that are on screen
(see [Spots](#spots-single-controls-cards-and-bar-parts)), each cut to what its scroller
and the screen show, so a spot running on below the fold doesn't take the room the card
needs. With no `spot`, or none of them rendered, it anchors to every zone in `focus`
together (the balance guide to `zone-balance-bar`). Measurements are divided by the app's
CSS zoom, and use `visualViewport` height so the iOS toolbar doesn't push it off-screen.

Scrolling: the sidebar is scrolled to `focus[0]`'s zone at once; then, when the step's
section has opened, the topmost spotted part is scrolled inside its own scroller (the
sidebar, the results panel, the expanded balance panel or the garage list). Wherever the
card goes above or below the spots (everywhere but the sidebar on a wide screen), the
topmost spot is brought to the top of its scroller, since mid-panel the spotted results
cards left room on neither side. In the sidebar on a wide screen it is only scrolled into
view. Topmost, not first-listed: a spot list names both games' output cards, so list
order is not page order.

A **sidebar target** is one whose right edge is at or before the sidebar's. It used to be
"left of centre", which caught the full-width bar lanes whenever the sidebar was closed and
dropped the card on top of them.

- **Garage target, with room left of the GARAGE overlay**: the card goes just left of
  the overlay, vertically centred on the target and clamped on-screen, with a
  right-pointing arrow. Below the garage rows it covered the list they describe.
- **Sidebar target, with room beside the sidebar**: the card floats just right of the
  sidebar, vertically centred on the target and clamped on-screen, with a left-pointing
  arrow. "Room" means the full `CARD_W` fits right of the sidebar.
- **Any other target (results, balance bar, garage on phones), or a sidebar target
  with no room beside the sidebar (phones)**: the card goes above or below the
  target, whichever has more room, with an up/down arrow. If neither side can fit
  the card's natural height, it docks to the bottom edge with no arrow, or to the top
  edge when that covers less of the step's first spot. Centring, or placing it under the
  first spot alone, covered the spots after it and the expanded balance panel's header.
- **No focus, or a zero-size target** (collapsed sidebar): centred, no arrow.

Placement re-runs on window and visual-viewport resize, when the card's own height
changes (a `ResizeObserver`, plus an explicit re-run when the off-screen line or absent
note appears, since the observer only fires while the page renders frames), and when any
transition ends (the phone drawer's slide, a section opening). Without those it read the
card's height before those lines appeared and ran off the bottom, and a drawer slide
slower than its last timed measure left the card anchored to where the drawer had been.

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
| `skip` | no | `st => boolean`, with `st` = `{ch, fe, dr, al}`. True drops the step for this car: NEXT and PREV step over it, the count and progress bar leave it out, and a guide opened or resumed on it moves to the next shown step. INT's AWD Center Diff skips off AWD. |
| `absent` | no | `{ids, text}`. When none of `ids` renders, the card shows `text` (the absent note) saying how to reach the control. For steps whose controls only render in another mode. |
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
| 10 | Handling Balance Bar | `balance-bar` | `bar.head`, `bar.main` | close | Sign; CAR tick, NET headline; tap to expand; its ? GUIDE. | |
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
| 11 | AWD Center Diff | `drivetrain`, `output` | `drive.powerSplit` / `.frontExit`, `out.diff.recCenter`, `out.card.center` | open | POWER SPLIT, CENTER SPLIT recommendation and → USE, FRONT AXLE EXIT. Skipped unless the layout is AWD; on a Sport diff the absent note says to pick another Diff Type. |
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
| 1 | Welcome — Pro Mode | — | | | What PRO adds, DNA included; alignment stays AUTO unless set to MANUAL. |
| 2 | Chassis Geometry | `chassis` | `chassis.wheelbase` / `.trackF` / `.trackR` / `.tyres` | | LOOK UP ONLINE wheelbase and track widths; how they and tyre width set the Balance Guide's NATURAL and GRIP BIAS. |
| 3 | Calibrating Natural Balance | `chassis` | `chassis.measureNatBal` | | MEASURE NAT BAL → Tune Check MEASURE; the reading replaces the geometry prediction; CLEAR / ✕. |
| 4 | Calibrating ARB Scale | `balance-target` | | | Step 2 · ARB SCALE SETUP, four readings, SCALE IN USE. Its controls are in the MEASURE tab, so no spots. |
| 5 | Mech Balance Target | `balance-target` | `balance.targetNat` / `.guide` | | Offset from NAT, start inside the Balance Guide's range. Absent note while nothing solves toward the target. |
| 6 | Balance Target Mode | `balance-target` | `balance.targetMode` / `.offset` / `.targetAbs` / `.exitLoad` | | NATURAL / RANGE / GRIP / PHASE / MANUAL, Balance Offset. Same absent condition as step 5. |
| 7 | Alignment Mode | `alignment` | `align.mode` / `.nudge` / `.nudgeStrength` | | AUTO / MANUAL; Nudge MECH / GRIP and Nudge Strength. Absent note while Nudge is off. |
| 8 | PRO ARB Balance Modes | `arb` | `arb.balMode` / `.springShare` / `.mechSplit` / `.coSolveSplit` / `.coSolveCorr` | | CHASSIS, MECH, CO-SOLVE; Spring Share; unreachable targets flagged. Absent note until MECH or CO-SOLVE is picked. |
| 9 | Hz MODE MECH | `feel` | `ride.hzMode` | | Hz MECH, and the two modes that ignore it. It spotlit RIDE, BALANCE and VISUALS at once, which ran off the screen. |
| 10 | Brake Bias Centre | `brakes` | `brakes.centre` / `.decel` / `.entryTarget` / `.entryBrk` | | Centre REC / GRIP / ENTRY; ENTRY BRK. |
| 11 | Manual Differential | `drivetrain` | `drive.diffMode` / `.matchChassis` and the seven `drive.man*` | | MANUAL lock % fields (AWD adds front, rear and Center Split); MATCH CHASSIS in AUTO. Absent note until the diff is MANUAL. |
| 12 | Handling Balance Expanded | `balance-bar` | `bal.tip` / `.rows`, `bar.phase` | | Opens the expanded panel. Grip-margin % by phase (ENTRY / MID / EXIT) and what each phase adds; tips. |
| 13 | Mech Balance & Response | `balance-bar` | `bar.mechHead` / `.mechStrip` / `.response` | | The MECH BALANCE strip (NAT, CUR, TGT on the game's scale) and RESPONSE. |
| 14 | Load Transfer | `visuals` | `visuals.load` / `.grip` | | VISUALS' LOAD TRANSFER (FRONT TAKES vs weight at 1 g) and GRIP USE (which axle runs out first, by phase). |
| 15 | Output Panel & Tune Check | `toolbar` | `tbCheck`, `tb.share`, `tb.reset` | | CHECK (DECODE / MEASURE), SHARE's part staging, RESET. |
| 16 | Vehicle DNA | `toolbar` | `tbDna` | | DNA's handling targets, APPLY (once, undoable), MY DNA. Last, so `_v1` saves still convert to the same steps. |

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

> This bar shows your handling tendency: + toward oversteer, − toward understeer. The grey tick is the car on its own; springs and bars carry it to the white NET tick, the headline. Tap it for the breakdown, including brakes and diff; its ? GUIDE explains each part.

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

Absent note (no POWER SPLIT on screen):

> A Sport diff has no center control: pick another Diff Type to see POWER SPLIT and → USE.

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

> PRO adds chassis geometry, a Mech Balance Target and the modes that solve toward it, a brake bias Centre, a manual differential and Vehicle DNA. Alignment stays AUTO unless you switch ALIGNMENT to MANUAL. This guide covers only what's new.

#### 2. Chassis Geometry

> LOOK UP ONLINE in CHASSIS holds wheelbase and track widths, which Forza never shows; the defaults suit most cars. Track widths (and slightly tyre widths) set the Balance Guide's NATURAL; tyre width also sets each axle's grip, which moves GRIP BIAS.

#### 3. Calibrating Natural Balance

> MEASURE NAT BAL, at the end of FROM THE GAME, opens Tune Check's MEASURE tab: set the springs and bars it lists in Forza, then type the Mech Balance the game shows. The reading replaces the geometry prediction; CLEAR, or ✕ beside it, drops it.

#### 4. Calibrating ARB Scale

> ARB clicks are worth a different stiffness on every car. STEP 2 · ARB SCALE SETUP, in the same MEASURE tab, finds yours from four readings; pick MEASURED under SCALE IN USE to use it.

#### 5. Mech Balance Target

> How far to move Forza's Mech Balance from the car's natural balance (NAT): + adds rotation, − adds stability. Start inside the Balance Guide's range.

Absent note (shown while its controls are not on screen):

> Hidden now: the target shows only while something solves toward it. Set Balance Mode to MECH or CO-SOLVE in ANTI-ROLL BARS, or Hz MODE to MECH in RIDE.

#### 6. Balance Target Mode

> What the target is measured from: NATURAL (offset from NAT), RANGE (the middle of the Balance Guide's range), GRIP (grip-neutral), PHASE (neutral across entry, mid-corner and exit) or MANUAL (a raw value). Balance Offset shifts RANGE, GRIP and PHASE.

Absent note (shown while its controls are not on screen):

> Hidden now, like the target: it shows once MECH, CO-SOLVE or Hz MODE MECH is solving.

#### 7. Alignment Mode

> AUTO derives camber, toe and caster from your build and chassis; MANUAL takes exact values. Under AUTO, Nudge MECH tilts camber and toe toward your Mech Balance Target, GRIP against the chassis's own grip tendency; Nudge Strength sets how far.

Absent note (shown while its controls are not on screen):

> Nudge Strength appears once Nudge is MECH or GRIP.

#### 8. PRO ARB Balance Modes

> CHASSIS is WEIGHT anchored on the car's natural balance. MECH solves the bar split alone to hit your Mech Balance Target; CO-SOLVE moves rear spring Hz and the bar split together, mixed by Spring Share. An unreachable target is flagged.

Absent note (shown while its controls are not on screen):

> Pick MECH or CO-SOLVE under Balance Mode to see the split it solves.

#### 9. Hz MODE MECH

> Hz MODE MECH, in RIDE, derives the other axle's Hz from the Mech Balance Target. CO-SOLVE ignores it, since it solves rear Hz itself, and so does NEUTRAL CANCEL, whose bars would undo it.

#### 10. Brake Bias Centre

> Centre sets what Brake Bias shifts from: REC the recommendation, GRIP where both axles hit their braking limit together at your Decel, ENTRY a solve for trail braking. ENTRY BRK shows what the bias does to corner entry.

#### 11. Manual Differential

> MANUAL swaps the diff sliders for lock % fields, with your diff type's typical range under each; AWD adds front, rear and Center Split. In AUTO, MATCH CHASSIS biases the diff to reinforce your Mech Balance Target.

Absent note (shown while its controls are not on screen):

> The lock fields show once the diff is set to MANUAL.

#### 12. Handling Balance Expanded

> Expanded, the Handling Balance bar breaks balance down by corner phase in grip-margin %, + meaning the rear lets go first. ENTRY adds brakes, MID holds chassis, springs and bars, EXIT the drive split; the tips name what to move.

#### 13. Mech Balance & Response

> MECH BALANCE reads balance on the game's 0–1 scale: NAT the car on its own, CUR the current setup, TGT your target while something solves toward it. RESPONSE rates how quickly the car reacts to steering, PLANTED to REACTIVE.

#### 14. Load Transfer

> LOAD TRANSFER in VISUALS shows the loads at 1 g cornering: FRONT TAKES is the front's share of the transfer against the weight split. GRIP USE below it predicts which axle runs out of grip first on entry, mid-corner and exit.

#### 15. Output Panel & Tune Check

> CHECK opens Tune Check: DECODE reads back an existing tune's frequencies and damping, MEASURE holds the NAT BAL and ARB SCALE steps. SHARE stages a loaded code so you tick which parts land. RESET never touches saves.

#### 16. Vehicle DNA

> DNA describes how a car should drive as handling targets: platform, pitch, bar share, balance, damping and diff. APPLY solves the tune that hits them on the loaded chassis, once, and ↩ undoes it. MY DNA saves one to reuse on any car.

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

**Last card of a tier guide** — a green line under the body of the DONE card
(`TUT_END_NOTE`), on the full and quick paths alike:

> 🔓 INT is unlocked: switch with INT in the header for more controls.

> 🔓 PRO is unlocked: switch with PRO in the header for every control.

> That's everything PRO adds. Reopen this guide any time with ? in the header.

**Onboarding popup** — headed COMPLEXITY LEVEL, over a preview of the BEG / INT /
PRO and `?` buttons with the current tier highlighted, dismissed with GOT IT. Shown
only for a stored `suspos_onboard_v1` of `false`:

> Choose how much of the app to show. BEG is the best starting point — fewer controls, guided outputs. Press ? at any time to open a step-by-step tutorial.

---

## Persistence and reset

| Key | Holds |
|---|---|
| `suspos_tutorial_seen_v1` | `{beginner, intermediate, pro}` — tier guides seen (also the tier gate) |
| `suspos_tutorial_step_v2` | `{beginner, intermediate, pro}` — last step reached per tier guide, as `{title, step}` or `null` |
| `suspos_tutorial_step_v1` | the same as bare indices — read-only, converted into `_v2` once |
| `suspos_baltut_seen_v1` | Balance guide opened at least once (nothing reads it to open the guide) |
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
tier. The balance guide only ever opens from its **? GUIDE** button, reset or not.

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
