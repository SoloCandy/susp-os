# SUSP.OS — Tutorials

The in-app guided tours: what each one covers, when it opens, how the spotlight
works, and how to add or change a step.

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
  quick path doesn't write `suspos_tutorial_step_v1` — its step index counts the
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
`tutStep`), and it does not dim the page.

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

The card anchors to the bounding box of every zone in `focus` together (the
balance guide always anchors to `zone-balance-bar`), so a step spotlighting two
stacked controls doesn't get its card placed over the second one. The sidebar
scroll below still uses `focus[0]`. Measurements are divided by the app's CSS
zoom, and use `visualViewport` height so the iOS toolbar doesn't push it off-screen.

- **Target in the left half (sidebar), with room beside the sidebar**: the sidebar
  is first scrolled so the target is visible (instant, not smooth — a smooth scroll
  would still be moving when the card measures). The card floats just right of the
  sidebar, vertically centred on the target and clamped on-screen, with a
  left-pointing arrow. "Room" means the full `CARD_W` fits right of the sidebar.
- **Target in the right half (results, balance bar, garage), or a sidebar target
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
   dimmed. The balance guide never dims.
2. **Opens the matching sidebar section and collapses the rest**, via this map:

   | `focus` key | Section opened |
   |---|---|
   | `chassis` | CHASSIS |
   | `build` | BUILD |
   | `balance-target` | BALANCE (PRO) |
   | `drivetrain` | DRIVETRAIN |
   | `arb` | ANTI-ROLL BARS |
   | `feel` | RIDE |
   | `damping` | DAMPERS |
   | `alignment` | ALIGNMENT (PRO) |
   | `visuals` | VISUALS |

   Every step rewrites all nine, so a section left open by the user is closed when
   a step doesn't point at it.
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

Zone keys valid in `focus` are the `zone-*` ids listed in
[CODE_MAP.md](CODE_MAP.md#sidebar-zones-and-tier-gating). A key whose zone
doesn't exist at the current tier (e.g. `balance-target` outside PRO) centres the
card and dims everything.

---

## Step catalogue

Columns: **Spotlight** is `focus`; **Sidebar** is an explicit `sidebar` override
(blank = the default rule above). `tests-docs.js` checks that each table lists
every step title of its guide, in order.

### Beginner <!--@tutorial beginner-->

| # | Title | Spotlight | Sidebar | Covers | Quick |
|---|---|---|---|---|---|
| 1 | Welcome to SUSP.OS | — | close | What the app does; a working tune comes first, refinement after. | |
| 2 | Choose Your Units | — | | Embedded units picker; match Forza's spring units. | ✓ |
| 3 | Load a Preset | `garage` | close | Load the FACTORY preset for the car's class (★ = build type) so every later step has results to show. | ✓ |
| 4 | Getting Around | `toolbar` | | ☰ sidebar, ↩ / ↪ undo / redo, ⓘ hints and TERMS. | |
| 5 | Layout & Build Type | `layout-build`, `build-type` | | Drive layout and build type and what they drive. | |
| 6 | Weight & Front Bias | `weight` | | Take them from the car selection screen. | |
| 7 | Ride Stiffness | `ride-stiffness` | | SOFT / ROAD / FIRM / RACE, FIRM as the start. | |
| 8 | Balance | `balance` | | OVERSTEER ↔ UNDERSTEER slider and when to lean each way. | ✓ |
| 9 | Character | `character` | | STABLE ↔ AGILE damping feel. | |
| 10 | Handling Balance Bar | `balance-bar` | close | Sign; CAR tick, NET headline, TOTAL line; tap to expand. | |
| 11 | Reading the Results | `output` | | Values to type in, card by card; amber = near a game limit. | ✓ |
| 12 | Output Toolbar | `toolbar` | | RESET, DNA, CHECK, SHARE. | |
| 13 | Saving Your Own | `garage` | close | SAVE CHASSIS / BUILD / CAR once the tune is worth keeping; `?` reopens the guide. | |

### Intermediate <!--@tutorial intermediate-->

There are no Key Terms cards any more: Hz, ζ and roll stiffness are TERMS chips on
the Welcome card and live in the glossary.

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome — Intermediate Mode | — | | Collapsible sections, SECTIONS − / +, per-section ↺; TERMS chips for Hz, ζ and roll stiffness. |
| 2 | Chassis | `chassis` | | Layout / weight / bias moved here; CG height source. |
| 3 | Diff Type | `drivetrain` | | Race / Sport / Rally / Offroad / Drift lock curves; Sport is accel-only. |
| 4 | Corner Exit & Entry | `drivetrain` | | EXIT (GRIP ↔ ROTATE) and ENTRY (STABLE ↔ LOOSE, hidden on Sport); right = more rotation; DIFF in the ENTRY / EXIT lanes follows. |
| 5 | AWD Center Diff | `drivetrain` | | POWER SPLIT, CENTER SPLIT recommendation and → USE, FRONT AXLE EXIT. |
| 6 | Build Type | `build` | | What build type steers: auto diff locks, recommended diff type, brake balance, alignment. |
| 7 | ARB Stiffness & Balance Mode | `arb` | | Stiffness modes AUTO / BASIC / ROLL ° / SHARE % / MAN; WEIGHT / NEUTRAL split. |
| 8 | ARB Bias & Visuals | `arb`, `visuals` | | ARB Bias; where the roll split and ARB track live in VISUALS. |
| 9 | Ride Ref & Rear Hz | `feel` | | RIDE REF.; Hz MODE MULTIPLIER / FLAT RIDE / INDEPENDENT / SHARED. |
| 10 | Dampers | `damping` | | Rebound ζ, Bump Ratio, Damping Bias and DAMP in the ENTRY lane. |
| 11 | VISUALS Card | `visuals` | | RIDE · ROLL · DAMPING, DYNAMICS (±10% settle band), SAG vs LOAD. |
| 12 | Handling Balance Bar | `balance-bar` | close | NET vs the ENTRY / EXIT lanes and TOTAL; tap for the rows. |
| 13 | Reading the Results | `output` | close | Values to type in, card by card; amber = near a game limit. |
| 14 | Output Toolbar | `toolbar` | | RESET, DNA, CHECK, SHARE. |
| 15 | Garage | `garage` | close | CHASSIS / BUILD / CAR entries, LOAD CHASSIS / LOAD BUILD. |
| 16 | Organizing & Searching | `garage` | close | Notes, tags, auto-tags, filter / sort, ↺ rewrite. |
| 17 | Sharing & Backup | `garage` | close | COPY CODE / COPY LINK / LOAD CODE and its part picker, BACKUP, RESTORE. |

### Pro <!--@tutorial pro-->

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome — Pro Mode | — | | What PRO adds; alignment stays AUTO unless set to MANUAL, brakes always computed. |
| 2 | Chassis Geometry | `chassis` | | FROM THE GAME vs LOOK UP ONLINE; wheelbase, track widths, and what tyre width does; how they set the Balance Guide's NATURAL and GRIP BIAS. |
| 3 | Manual Differential | `drivetrain` | | MANUAL lock % fields (AWD adds Center Split) with typical-range hints; MATCH CHASSIS in AUTO. |
| 4 | Calibrating Natural Balance | `chassis` | | MEASURE NAT BAL → Tune Check MEASURE; the reading replaces the geometry prediction; CLEAR / ✕. |
| 5 | Calibrating ARB Scale | `balance-target` | | Step 2 · ARB SCALE SETUP, per-reading scales, SCALE IN USE toggle. |
| 6 | Mech Balance Target | `balance-target` | | Offset from NAT, start from the Balance Guide's range; shown only when MECH, CO-SOLVE or Hz MECH uses it. |
| 7 | Balance Target Mode | `balance-target` | | NATURAL / RANGE / GRIP / MANUAL, Balance Offset. |
| 8 | PRO ARB Balance Modes | `arb` | | CHASSIS, MECH, CO-SOLVE; Spring Share; unreachable targets flagged. |
| 9 | Hz MECH & Balance Target Mode | `feel`, `balance-target`, `visuals` | | Hz MECH (ignored under CO-SOLVE); target mode applies to all three. |
| 10 | Alignment Mode | `alignment` | | AUTO / MANUAL; Nudge MECH / GRIP and Nudge Strength under AUTO. |
| 11 | Handling Balance Expanded | `balance-bar` | | Grip-margin % by phase (ENTRY / MID / EXIT) and what each phase adds; tips. MECH BALANCE strip and RESPONSE via TERMS chips. |
| 12 | Handling Balance Expanded (2/2) | `balance-bar` | | LOAD TRANSFER at 1 g: CORNER, XFER, OUT / IN. |
| 13 | Output Panel & Tune Check | `toolbar` | | CHECK (DECODE / MEASURE), SHARE's part staging, RESET. |

### Handling balance <!--@tutorial balance-->

All steps are `focus:null`; the card still anchors to `zone-balance-bar`.

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Handling Balance | — | | NET headline; sign convention: + oversteer, − understeer; colour zones. PRO reads grip-margin % by phase (ENTRY / MID / EXIT). |
| 2 | Reading the Bar | — | | CAR tick → SPR / ARB → NET tick; ENTRY / EXIT lanes off NET and the TOTAL line. PRO arrows diff and damping. |
| 3 | Typical Targets by Build | — | | Rough ranges per build; zero isn't the goal. The ranges are BEG/INT points; PRO's ±1% NEUTRAL is a smaller unit. |
| 4 | Reading Each Row | — | | CAR STARTS, then springs and ARBs (make NET) vs diff, brakes, damping (entry / exit); value and % share. PRO groups by phase instead. |
| 5 | Using the Correction Tip | — | | Move the largest contributor first; the main balance control for big shifts. |
| 6 | Response Bar | — | | PLANTED ↔ REACTIVE, separate from understeer / oversteer. |

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

> This bar shows your handling tendency: + toward oversteer, − toward understeer. The grey tick is the car on its own; springs and bars carry it to the white NET tick, the headline. The pink TOTAL line above adds brakes and diff. Tap it for the breakdown.

#### 11. Reading the Results

> The results panel shows the values to enter in the game's tuning menu, card by card. Amber means a value is near the game's limit: soften your inputs slightly.

#### 12. Output Toolbar

> ⟲ RESET clears the tune, the tutorials or both, never garage saves. DNA (PRO) builds a tune from handling targets, CHECK reads back the frequencies and damping behind an existing tune, and SHARE moves tunes by code or link and backs up your garage.

#### 13. Saving Your Own

> Name the setup in the row above the preset list, then SAVE CHASSIS (the car: weight, bias, layout), SAVE BUILD (the tune) or SAVE CAR (both). Saves list under FACTORY; loading one is undoable with ↩. Reopen this guide any time with ?.

### Intermediate <!--@steptext intermediate-->

#### 1. Welcome — Intermediate Mode

> Intermediate adds separate ride frequency, damping and ARB controls. The sidebar is now collapsible sections: tap a header to open one, SECTIONS − / + to collapse or expand them all, and a header's ↺ to reset just that section. This guide covers only what's new.

#### 2. Chassis

> Layout, Weight and Front Weight Bias now sit in the CHASSIS section; take weight and bias from the car selection screen, not the tuning menu. Tyre sizes and CG Height Source (RIDE HEIGHT or MANUAL) are here too.

#### 3. Diff Type

> DIFF TYPE picks the differential fitted to the car: Race, Sport, Rally, Offroad or Drift. Each has its own lock curve, so the same % gives a different effective lock; Sport is accel-only, with no decel control.

#### 4. Corner Exit & Entry

> EXIT sets on-throttle behaviour (GRIP ↔ ROTATE), ENTRY lift-off and trail-braking rotation (STABLE ↔ LOOSE; hidden on a Sport diff). Right means more rotation on both; the DIFF in the Handling Balance ENTRY and EXIT lanes follows.

#### 5. AWD Center Diff

> AWD adds POWER SPLIT under CENTER (not with a Sport diff): default 65% rear, and more rear means more oversteer. The DIFFERENTIAL card's CENTER SPLIT box recommends a value and → USE applies it. AWD also gets a FRONT AXLE EXIT slider; toward PUSH adds exit understeer.

#### 6. Build Type

> Build Type in the BUILD section (STREET / TRACK / DRIFT / RALLY / OFFROAD / DRAG) sets the car's intended use. It steers the diff's automatic locks, the recommended diff type, brake balance and alignment.

#### 7. ARB Stiffness & Balance Mode

> Stiffness Mode sets the total bar stiffness: AUTO, BASIC, ROLL °, SHARE % or MAN (front and rear typed directly, which hides Balance Mode and ARB Bias). Balance Mode splits it front to rear: WEIGHT follows the weight split; NEUTRAL works from the springs, by CANCEL or EQUAL ROLL.

#### 8. ARB Bias & Visuals

> ARB Bias nudges that split: toward FRONT HEAVY for more understeer and stability, toward REAR HEAVY for more rotation. VISUALS, pinned at the bottom of the sidebar, shows the resulting roll split, body roll and bar stiffness under RIDE · ROLL · DAMPING.

#### 9. Ride Ref & Rear Hz

> RIDE REF. picks the axle the stiffness slider sets: FRONT, SHARED (the average) or REAR. Hz MODE derives the other: MULTIPLIER (fixed ratio, default), FLAT RIDE (less pitch bounce at Target Speed), INDEPENDENT (set by hand; not with SHARED) or SHARED (needs RIDE REF. SHARED and BOTTOM G's).

#### 10. Dampers

> Rebound ζ starts at 70% (Butterworth); Bump Ratio sets bump as a share of rebound, 40–65% typical. Damping Bias toward FRONT leaves the front relatively firmer (planted entry), toward REAR the rear (easier direction changes); DAMP in the Handling Balance ENTRY lane shows it.

#### 11. VISUALS Card

> VISUALS, pinned at the bottom of the sidebar, holds three collapsible readouts: RIDE · ROLL · DAMPING (roll split, ride Hz, bars and damping), DYNAMICS (step response with its ±10% settle band) and SAG vs LOAD (travel against load; needs the RIDE HEIGHT CG source). Tap a header to collapse it.

#### 12. Handling Balance Bar

> The Handling Balance bar at the bottom of the results shows NET, the car plus springs and bars: + toward oversteer, − toward understeer. Diff, brakes and damping sit in ENTRY and EXIT lanes off NET, and TOTAL above adds them in. Tap it for the rows behind each.

#### 13. Reading the Results

> The results panel shows exact values to enter in the game's tuning menu, card by card. Amber means a value is near the game's limit: soften your inputs slightly.

#### 14. Output Toolbar

> At the top of the sidebar: ⟲ RESET returns the tune to defaults (saves untouched), DNA (PRO) builds a tune from handling targets, CHECK reads back a tune you already have, and SHARE handles codes and garage backups.

#### 15. Garage

> GARAGE (top right) holds everything you save: a CHASSIS (weight, bias, layout), a BUILD (feel settings and diff) or a CAR (both). A car's LOAD CHASSIS and LOAD BUILD let you pair one car's chassis with another's tune, and every load is undoable with ↩.

#### 16. Organizing & Searching

> Entries take notes and your own tags, plus automatic ones, all searchable from the row under the save buttons, with filter and sort. ↺ rewrites an entry from your current setup as CHASSIS, BUILD or BOTH; BOTH turns a chassis entry into a full car.

#### 17. Sharing & Backup

> SHARE copies a code or link (COPY CODE / COPY LINK), loads one (LOAD CODE), and backs up or restores the garage as JSON (BACKUP / RESTORE). A loaded code is staged: tick the parts you want and APPLY SELECTED takes only those.

### Pro <!--@steptext pro-->

#### 1. Welcome — Pro Mode

> PRO adds a Mech Balance Target, the CHASSIS, MECH and CO-SOLVE balance modes, Hz MODE MECH, chassis geometry (wheelbase, track widths) and a manual differential. Alignment stays AUTO unless you switch ALIGNMENT to MANUAL; brakes are always computed. This guide covers only what's new.

#### 2. Chassis Geometry

> CHASSIS now splits by source. FROM THE GAME adds MEASURE NAT BAL; LOOK UP ONLINE holds wheelbase and track widths, which Forza never shows. The defaults suit most cars, so enter exact values if you have them. Track widths (and slightly tyre widths) set the Balance Guide's NATURAL; tyre width also sets each axle's grip, moving GRIP BIAS and its AGILE–PLANTED tag.

#### 3. Manual Differential

> MANUAL swaps the diff sliders for lock % fields: Accel and Decel Lock, or on AWD Front/Rear Accel and Decel plus Center Split, with your diff type's typical range under each lock. In AUTO, MATCH CHASSIS (above the EXIT and ENTRY sliders) biases the diff to reinforce your Mech Balance Target.

#### 4. Calibrating Natural Balance

> MEASURE NAT BAL, at the end of the FROM THE GAME group in CHASSIS, opens Tune Check's MEASURE tab: set the springs and bars it lists in Forza, then type the Mech Balance the game shows. The reading replaces the geometry prediction everywhere and hides the track-width fields; CLEAR, or ✕ beside the reading, drops it.

#### 5. Calibrating ARB Scale

> ARB clicks are worth a different stiffness on every car. STEP 2 · ARB SCALE SETUP, in the same MEASURE tab, finds yours: set the bars each reading lists, type the Mech Balance Forza shows, then pick MEASURED under SCALE IN USE.

#### 6. Mech Balance Target

> How far to move Forza's Mech Balance from the car's natural balance (NAT): 0 stays natural, + adds rotation, − adds stability; start from the Balance Guide's range. It shows only while ARB Balance Mode MECH or CO-SOLVE, or Hz MODE MECH, solves toward it; CHASSIS anchors on natural balance instead.

#### 7. Balance Target Mode

> Balance Target mode sets what the target is measured from: NATURAL (offset from natural balance), RANGE (the middle of the Balance Guide's RANGE), GRIP (GRIP TARGET, the grip-neutral point) or MANUAL (a raw value, e.g. 0.60). In RANGE and GRIP, Balance Offset shifts it toward oversteer (+) or understeer (−).

#### 8. PRO ARB Balance Modes

> CHASSIS is WEIGHT anchored on the car's natural balance instead of raw weight %. MECH solves the bar split alone to hit your Mech Balance Target; CO-SOLVE moves rear spring Hz and the bar split together, mixed by Spring Share. A target the car can't reach within game limits is flagged.

#### 9. Hz MECH & Balance Target Mode

> Hz MODE MECH, in RIDE, derives the other axle's Hz from the Mech Balance Target under any ARB balance mode but CO-SOLVE, which solves rear Hz itself. The target mode applies alike to MECH, CO-SOLVE and Hz MECH. VISUALS at the bottom of the sidebar shows the resulting roll split and bar tracks.

#### 10. Alignment Mode

> AUTO (default) derives camber, toe and caster from your build and chassis; MANUAL takes exact values instead. Under AUTO, Nudge MECH tilts camber and toe toward your Mech Balance Target's intent and GRIP against the chassis's own grip tendency; Nudge Strength sets how far, 0% giving pure AUTO values.

#### 11. Handling Balance Expanded

> Expand the Handling Balance bar (on phones, tap it, then CONTRIBUTIONS) for a breakdown by corner phase in grip-margin percent, + meaning the rear lets go first. ENTRY adds brake bias, MID holds chassis, springs and ARBs, EXIT adds the drive split, and the tips at the top name what to move.

#### 12. Handling Balance Expanded (2/2)

> Scroll down in the expanded panel for LOAD TRANSFER at 1 g cornering: CORNER is each corner's static mass, XFER the load each axle shifts to its outer wheel per g, OUT / IN the outer and inner wheel loads. A wider track or lower CG reduces transfer.

#### 13. Output Panel & Tune Check

> The results cards work as in the lower tiers. CHECK opens Tune Check: DECODE reads back an existing tune's frequencies and damping, and MEASURE holds the NAT BAL and ARB SCALE steps. SHARE stages a loaded code so you tick which parts land; RESET never touches saves, and a tune RESET is one ↩ from undone.

### Handling balance <!--@steptext balance-->

#### 1. Handling Balance

> The headline is NET: the car's own lean plus springs and bars. + leans oversteer, − understeer. The zones run neutral, mild and aggressive, but the right number depends on your goal. In PRO the total is a grip margin in percent, read by corner phase.

#### 2. Reading the Bar

> The grey CAR tick is where the car sits before tuning. SPR and ARB stack from it to the white NET tick. The ENTRY and EXIT lanes below stack brakes, diff and damping off NET (PRO arrows diff and damping, and adds the drive split), and the pink TOTAL line above marks where everything lands.

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
| `suspos_tutorial_step_v1` | `{beginner, intermediate, pro}` — last step reached per tier guide |
| `suspos_baltut_seen_v1` | Balance guide seen |
| `suspos_onboard_v1` | Onboarding popup dismissed (defaults `true`) |

Full shapes are in [PERSISTENCE.md](PERSISTENCE.md). Which guide is open is session
state — a reload closes it — but every step change in a tier guide writes that step
to `suspos_tutorial_step_v1`. Pressing the header `?` with a saved step above 0
shows a small choice, **RESUME AT STEP n** or **START OVER**; with nothing saved it
opens at step 1 as before. The saved step is clamped to the guide's current length,
since steps get added and removed. It is an index, not a title, so removing a step
shifts every later saved position: when the intermediate guide's two Key Terms cards
were dropped (their terms now live in the glossary, reached from the Welcome card's
TERMS chips), an INT save resumes two steps further on than where it was left.
That was accepted rather than migrated. Resuming goes through `openTut(mode, step)`, so
the `[tutMode, tutStep]` effect applies that step's sidebar, garage and section
state exactly as stepping there would. DONE ✓ clears the tier's entry; ✕ keeps it.
The balance guide is not tracked — it's six steps.

RESET (⟲) with **Tutorials** ticked sets all three tier flags and
`suspos_baltut_seen_v1` back to `false` and zeroes `suspos_tutorial_step_v1`, which re-locks INT and PRO until their
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
3. If the spotlit control lives in a collapsible section, add the key to the
   section-opening map in the `[tutMode, tutStep]` effect, or the card will point
   at a closed accordion.
4. Update the catalogue table and the step's [Step text](#step-text) entry above —
   `tests-docs.js` checks the titles, and the text word for word both ways.
5. Walk the whole guide in a browser at phone and desktop widths. Positioning,
   scroll-for-more and dimming are layout behaviour nothing but a browser proves.

When a control is renamed or a behaviour changes, grep `TUTORIALS` for the old
wording as well as the docs — tutorial bodies have lagged behind the code before
(see HISTORY.md, "four in-app hint/tutorial strings lagged behind").
