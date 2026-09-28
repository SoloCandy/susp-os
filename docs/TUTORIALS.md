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

The TERMS glossary is a separate, non-sequential reference and is not covered here.

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
tier guides only — `units` / `setUnits` for the units step, `appState` (the
live `fe`) for step tasks, and `notice` for the locked-tier redirect message
(step 0 only; see Tier gating).

- **Header**: `{label} GUIDE · n / total`, the step title, and ✕. For tier guides
  ✕ and DONE ✓ share one handler (`closeTutEnd`), so closing early has the same
  side-effects as finishing.
- **Progress bar**: one segment per step — done, current (indigo), upcoming.
- **Body**: either the step's `body` string, or its `terms` list rendered as bold
  term / definition pairs (the same treatment as the TERMS modal). A step with
  `units:true` appends the `UnitsPicker` — the same control the UNITS modal uses,
  so a choice made here is the real setting.
- **Task**: a step with `task` appends a `TRY IT ·` line with a ○ marker. When the
  step opens, `appState` is snapshotted; whenever it changes, `task.check(appState,
  snapshot)` runs, and once it returns true the marker latches to ✓ (green) for the
  rest of that step. Returning to a step re-snapshots and resets it. A throwing
  check counts as not done. The task never gates NEXT — it is a nudge, and the
  spotlit zone is already clickable (see `dim()`), so the user acts in place. The
  balance guide passes no `appState`, so tasks there would never tick.
- **Buttons**: ← PREV from step 2 on; NEXT → until the last step, then DONE ✓.
  DONE calls `onDone` if given (tier guides: `closeTutEnd`), otherwise `onClose`
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
| `body` | one of `body` / `terms` | Plain-text paragraph. `\n\n` renders as-is inside the body. |
| `terms` | one of `body` / `terms` | `[{term, def}]`, rendered glossary-style. |
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
| 4 | Getting Around | `toolbar` | | ☰ sidebar, ↩ / ↪ and keyboard undo, ⓘ hints. | |
| 5 | Layout & Build Type | `layout-build`, `build-type` | | Drive layout and build type and what they drive. | |
| 6 | Weight & Front Bias | `weight` | | Take them from the car selection screen. | |
| 7 | Ride Stiffness | `ride-stiffness` | | SOFT / ROAD / FIRM / RACE, FIRM as the start. | |
| 8 | Balance | `balance` | | OVERSTEER ↔ UNDERSTEER slider and when to lean each way. | ✓ |
| 9 | Character | `character` | | STABLE ↔ AGILE damping feel. | |
| 10 | Handling Balance Bar | `balance-bar` | close | Colour zones; tap to expand. | |
| 11 | Reading the Results | `output` | | The six result cards; amber = near a game limit. | ✓ |
| 12 | Output Toolbar | `toolbar` | | RESET, DNA, CHECK, SHARE. | |
| 13 | Saving Your Own | `garage` | close | SAVE CHASSIS / BUILD / CAR once the tune is worth keeping; `?` reopens the guide. | |

### Intermediate <!--@tutorial intermediate-->

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome — Intermediate Mode | — | | Collapsible sections, SECTIONS − / +, per-section ↺. |
| 2 | Key Terms — Frequency & Damping | — | | *terms:* Hz, ζ, Settle Time. |
| 3 | Key Terms — ARB & Roll Stiffness | — | | *terms:* Bump Ratio, ARB, Roll Stiffness. |
| 4 | Chassis | `chassis` | | Layout / weight / bias moved here; CG height source. |
| 5 | Diff Type | `drivetrain` | | Race / Sport / Rally / Offroad / Drift lock curves. |
| 6 | Corner Exit & Entry | `drivetrain` | | Per-axle groups; DIFF rows in the balance bar. |
| 7 | AWD Center Diff | `drivetrain` | | Power Split recommendation, Front Exit Push. |
| 8 | Build Type | `build` | | What build type sets. |
| 9 | ARB Stiffness & Balance Mode | `arb` | | Stiffness modes AUTO / BASIC / ROLL ° / SHARE % / MAN; WEIGHT / NEUTRAL split. |
| 10 | ARB Bias & Visuals | `arb`, `visuals` | | ARB Bias; where the roll split and ARB track live in VISUALS. |
| 11 | Ride Ref & Rear Hz | `feel` | | RIDE REF.; MULTIPLIER / FLAT RIDE / INDEPENDENT. |
| 12 | Dampers | `damping` | | Rebound ζ, Bump Ratio, Damping Bias and the DAMP row. |
| 13 | VISUALS Card | `visuals` | | RIDE · ROLL · DAMPING, DYNAMICS, SAG readouts. |
| 14 | Handling Balance Bar | `balance-bar` | close | Per-contributor breakdown incl. DIFF and DAMP. |
| 15 | Reading the Results | `output` | close | The six result cards. |
| 16 | Output Toolbar | `toolbar` | | RESET, DNA, CHECK, SHARE. |
| 17 | Garage | `garage` | close | CHASSIS / BUILD / CAR entries, LOAD CHASSIS / LOAD BUILD. |
| 18 | Organizing & Searching | `garage` | close | Notes, tags, auto-tags, filter / sort, ↺ rewrite. |
| 19 | Sharing & Backup | `garage` | close | COPY CODE / COPY LINK / LOAD CODE and its part picker, BACKUP, RESTORE. |

### Pro <!--@tutorial pro-->

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome — Pro Mode | — | | What PRO adds. |
| 2 | Chassis Geometry | `chassis` | | Tyres, wheelbase, track widths; CHASSIS BAL., GRIP BIAS, STABILITY; GEOMETRY GAP. |
| 3 | Manual Differential | `drivetrain` | | Per-axle accel/decel lock, range hints, MATCH CHASSIS, AWD split breakdown. |
| 4 | Calibrating Natural Balance | `balance-target` | | MEASURE NAT BAL → Tune Check MEASURE's step 1; saved Hz, CLEAR / ✕. |
| 5 | Calibrating ARB Scale | `balance-target` | | Step 2 · ARB SCALE SETUP, per-reading scales, SCALE IN USE toggle. |
| 6 | Mech Balance Target | `balance-target` | | Offset from NAT, 0.05–0.95 clamp, BALANCE GUIDE. |
| 7 | Balance Target Mode | `balance-target` | | NATURAL / RANGE / GRIP / MANUAL, Balance Offset, GEOMETRY GAP. |
| 8 | PRO ARB Balance Modes | `arb` | | CHASSIS, MECH, CO-SOLVE; Spring Share. |
| 9 | Hz MECH & Balance Target Mode | `arb`, `visuals` | | Hz MECH; target mode applies to all three. |
| 10 | Alignment Mode | `alignment` | | BUILD / MECH / GRIP / MANUAL, Nudge Strength. |
| 11 | Handling Balance Expanded | `balance-bar` | | Grip-margin % by phase (ENTRY / MID / EXIT), PITCH shown not added, diff/damp direction-only; tips, RESPONSE, MECH BALANCE strip. |
| 12 | Handling Balance Expanded (2/2) | `balance-bar` | | LOAD TRANSFER: XFER F/R, OUT / IN. |
| 13 | Output Panel & Tune Check | `toolbar` | | CHECK, MEASURE tab, SHARE, RESET. |

### Handling balance <!--@tutorial balance-->

All steps are `focus:null`; the card still anchors to `zone-balance-bar`.

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Handling Balance | — | | Sign convention: + oversteer, − understeer; colour zones. PRO reads grip-margin % by phase (ENTRY / MID / EXIT). |
| 2 | Typical Targets by Build | — | | Rough ranges per build; zero isn't the goal. The ranges are BEG/INT points; PRO's ±1% NEUTRAL is a smaller unit. |
| 3 | Reading Each Row | — | | MECHANICAL (chassis, springs, ARBs) vs DYNAMIC; value and % share. PRO groups by phase instead, diff and damping direction-only. |
| 4 | Using the Correction Tip | — | | Which input to reach for, per tier. |
| 5 | Response Bar | — | | PLANTED ↔ REACTIVE, what it's weighted on. |

---

## Step text

Every step's text, word for word, as the card shows it. Glossary-style steps give
each term in bold followed by its definition; a step with a task adds the `TRY IT ·`
line below its body. The catalogue above says what each step is *for*; this is
what it *says*. `tests-docs.js` checks both directions, per step: every body, term,
definition and task in `TUTORIALS` must be quoted under its own heading, and every
quote must still be in that step — so a reworded, added, removed or moved step
fails the run until this section is updated.

### Beginner <!--@steptext beginner-->

#### 1. Welcome to SUSP.OS

> SUSP.OS calculates suspension values from your car's stats and a handling target — you say what kind of car it is and how it should feel, and the app solves the numbers. This guide gets you a working tune in a couple of steps, then shows how to refine it.

#### 2. Choose Your Units

> Pick the units your game shows so the numbers here can be typed straight in. Spring rate should match whatever your tuning screen in Forza uses. You can change any of these later with the UNITS button.

#### 3. Load a Preset

> Pick a preset for your car's class and load it. Under FACTORY in the garage are six — STREET, TRACK, RALLY, DRIFT, MOTORSPT, X COUNTRY. The ★ marks the one matching your build type. The results panel now holds a full tune; the next steps refine it for your car.

TRY IT task (ticks when the check passes):

> Load any FACTORY preset.

#### 4. Getting Around

> ☰ opens and closes this sidebar; results update live as you change it. ↩ and ↪ at the top undo and redo — Ctrl+Z / Ctrl+Shift+Z (⌘ on Mac) work too, so a preset or a slider is never a risk. Tap or hover any ⓘ for a plain-language hint.

#### 5. Layout & Build Type

> Drive layout (FWD / RWD / AWD) sets which wheels get power and shapes the differential. Build type (Street / Track / Drift / Rally / Offroad / Drag) shifts alignment, brake balance and diff tuning toward your intended use.

#### 6. Weight & Front Bias

> Enter your car's total weight and front weight bias from the car selection screen, not the tuning menu. These two numbers drive almost every calculation, so the tune you loaded now fits your car.

#### 7. Ride Stiffness

> Overall suspension stiffness. FIRM is the best starting point — sharp response with good body control. SOFT and ROAD suit comfort or rough surfaces; RACE suits smooth circuits only.

TRY IT task (ticks when the check passes):

> Drag Ride Stiffness and watch the category change.

#### 8. Balance

> Right (OVERSTEER) stiffens the rear for more rotation; left (UNDERSTEER) stiffens the front for stability on corner entry. Centre is neutral for your weight distribution. Drift builds want more right, street and GT builds mild left; track builds vary by layout and taste.

TRY IT task (ticks when the check passes):

> Move the Balance slider and watch the Handling Balance bar move with it.

#### 9. Character

> Damping feel — how quickly the suspension settles after a bump or weight transfer. STABLE is more damped: planted and predictable. AGILE is lighter: livelier and more reactive. Match it to your driving style.

#### 10. Handling Balance Bar

> Pinned at the bottom of the results panel, this shows your total oversteer or understeer tendency. The centre band is neutral, the mild zone is typical for intentional bias, the outer zone is aggressive. Tap it for a breakdown of every contributor.

#### 11. Reading the Results

> The results panel shows the values to enter in the tuning menu, as six cards: Alignment, Anti-Roll Bars, Springs, Dampers, Brakes, and Differential. Amber values mean you're near a game limit — soften your inputs slightly if that happens.

#### 12. Output Toolbar

> The red ⟲ RESET clears the tune, the tutorials, or both; garage saves are never touched. DNA (PRO) builds a tune from handling targets. CHECK reads back the frequencies and damping behind an existing tune. SHARE moves tunes between devices with a code or a link, and backs up your garage.

#### 13. Saving Your Own

> Happy with it? Name an entry in the row above the preset list. SAVE CHASSIS keeps the car (weight, bias, layout), SAVE BUILD keeps the tune, SAVE CAR keeps both. Saves appear under FACTORY; loading one is undoable with ↩. Reopen this guide any time with ?.

### Intermediate <!--@steptext intermediate-->

#### 1. Welcome — Intermediate Mode

> Intermediate mode unlocks more of the tuning surface on top of Beginner — individual ride frequency and damping controls, and ARB modes. The sidebar is now a stack of collapsible sections: tap a header to open it, use the SECTIONS − and + buttons at the top to collapse or expand them all at once, and the ↺ on a section header resets just that section. This guide only covers what's new.

#### 2. Key Terms — Frequency & Damping

> **Hz (Hertz)** — How many times per second a corner bounces after a bump. Higher = stiffer. Street: 1.0–1.8 Hz. Track: 1.8–2.6 Hz.
>
> **ζ (Zeta)** — How quickly the bounce dies out. Below 40% feels bouncy; above 100% feels sluggish.
>
> **Settle Time** — Seconds until the car stops moving after a bump. Short = planted; long = compliant.

#### 3. Key Terms — ARB & Roll Stiffness

> **Bump Ratio** — Compression damping as a fraction of rebound. Typically 40–65%. Softer bump absorbs hits; rebound controls how fast the wheel extends back out.
>
> **ARB (Anti-Roll Bar)** — Links left and right wheels to resist body lean in corners. Stiffer ARBs = less roll but less compliance over bumps. The F/R split is the primary control over mechanical handling balance.
>
> **Roll Stiffness** — Total resistance to body lean, contributed by springs and ARBs together. How it's split front vs rear determines whether the car understeers or oversteers.

#### 4. Chassis

> Layout, Weight, and Front Weight Bias have moved out of the Beginner panel into the CHASSIS section at the top of the sidebar — same three inputs, same meaning, just somewhere you can collapse them once they're set. CG Height Source (with a RIDE HEIGHT → CG toggle) lives here too. Take Weight and Front Weight Bias from the car selection screen, not the tuning menu. PRO adds tyre sizes, wheelbase, and track widths to this section.

#### 5. Diff Type

> DIFF TYPE selects the differential installed on the car — Race, Sport, Rally, Offroad, or Drift. Each type has a different lock curve, so the same slider % produces different effective lock. Sport is accel-only (no decel control).

#### 6. Corner Exit & Entry

> Corner Exit sets on-throttle aggression; Corner Entry sets trail-braking rotation. AWD groups them under FRONT AXLE / REAR AXLE. The DIFF rows in the Handling Balance bar update live as you move them.

#### 7. AWD Center Diff

> AWD adds a Power Split (center diff) slider — the recommended split is calculated from your build type, weight distribution, natural mechanical balance, and front/rear tyre diameter ratio. A Front Exit Push slider is also unlocked for AWD.

#### 8. Build Type

> The BUILD section shows Build Type (STREET / TRACK / DRIFT / RALLY / OFFROAD / DRAG) — this sets your intended use and determines the recommended balance range, diff AUTO behaviour, diff type recommendation, and alignment targets.

#### 9. ARB Stiffness & Balance Mode

> Stiffness Mode sets total ARB: AUTO from the car's roll tendency, BASIC as a direct level, ROLL ° for a target roll angle, SHARE % as a fraction of roll stiffness, MAN for direct front/rear values. Balance Mode splits it front to rear: WEIGHT follows weight distribution; NEUTRAL cancels the springs' effect on the balance bar.

#### 10. ARB Bias & Visuals

> The ARB Bias slider fine-tunes the split either way — push toward front for more understeer resistance, toward rear for more rotation. PRO adds CHASSIS, MECH and CO-SOLVE balance modes. The live F/R roll split (with NAT and target ticks), body roll, springs/ARBs share and the front/rear ARB track live in the RIDE · ROLL · DAMPING group of the pinned VISUALS card at the bottom of the sidebar.

#### 11. Ride Ref & Rear Hz

> RIDE REF. sets which axle the stiffness slider anchors — FRONT, SHARED, or REAR. The secondary axle frequency is derived by the Hz mode: MULTIPLIER (a fixed ratio of the anchored axle, the default), FLAT RIDE (the mathematically ideal pitch-cancelling ratio for a target speed), or INDEPENDENT (set manually, free of the other axle).

#### 12. Dampers

> REBOUND MODE and BUMP MODE toggles sit above their sliders. Rebound ζ defaults to 70% — Butterworth, the ratio with no resonant peak (see TERMS): about 4% overshoot and no wallow. Below 40% is bouncy, above 100% is sluggish. Bump Ratio sets compression as a fraction of rebound (40–65% typical). Damping Bias splits front/rear: FRONT keeps the front firm while the rear softens (planted entry); REAR softens the front (easier direction changes) — shown in the DAMP row of Handling Balance.

#### 13. VISUALS Card

> VISUALS is pinned to the bottom of the sidebar so it never scrolls away, and holds three collapsible readouts: RIDE · ROLL · DAMPING (the front/rear roll-stiffness split, then front and rear ride Hz, ARB and bump/rebound damping on shared tracks), DYNAMICS (step response — settle speed, overshoot, ride/damping interaction, with the ±10% settle band drawn), and SAG (suspension travel vs. load). Tap any header to collapse it and give the others more room.

#### 14. Handling Balance Bar

> The Handling Balance bar is pinned at the bottom of the results panel. It shows your total oversteer or understeer tendency as a number and a bar, colour-zoned neutral / mild / aggressive. Tap it to expand a full per-contributor breakdown — every input you've touched in the sidebar shows up here as a row, including the DIFF rows from the drivetrain sliders and the DAMP row from Damping Bias, so you can see which change actually moved the balance.

#### 15. Reading the Results

> The results panel shows exact values to enter in the tuning menu, as six cards: Alignment, Anti-Roll Bars, Springs, Dampers, Brakes, and Differential. Amber values mean you're near a game limit — soften your inputs slightly if that happens.

#### 16. Output Toolbar

> Pinned at the top of the sidebar: the red ⟲ (RESET) clears the tune back to defaults (saves untouched), DNA (PRO) builds a tune from handling targets and holds your saved DNAs, CHECK opens Tune Check to reverse a tune you already have, and SHARE handles codes and garage backups.

#### 17. Garage

> GARAGE (top right) is one place for everything you save. Each entry is a CHASSIS (weight, bias, layout), a BUILD (feel settings and diff tune), or a CAR holding both — save whichever you want with the three buttons at the top. A car gives you separate LOAD CHASSIS and LOAD BUILD buttons, so you can mix one car's chassis with another's tune. Every load is undoable with ↩ and redoable with ↪.

#### 18. Organizing & Searching

> Entries carry notes and your own tags, plus automatic ones (drivetrain, weight balance, stiffness band, build type) that you can search on directly. Filter by kind, sort, and search from the row under the save buttons. ↺ rewrites an entry from your current setup — pick CHASSIS, BUILD, or BOTH, and BOTH is how you turn a chassis entry into a full car.

#### 19. Sharing & Backup

> The SHARE button handles codes and links between devices (COPY CODE / COPY LINK / LOAD CODE), a JSON backup of your garage (BACKUP), and restoring one (RESTORE) — including backups made before the garage was unified. A code you load is staged, not applied: tick the parts you want — chassis, springs, dampers, ARB, drivetrain — and APPLY SELECTED takes only those.

### Pro <!--@steptext pro-->

#### 1. Welcome — Pro Mode

> Pro mode adds the full physics surface on top of Intermediate: a Mech Balance Target with CHASSIS, MECH and CO-SOLVE ARB balance modes, Hz MECH mode, chassis geometry (wheelbase, track widths), and manual differential control. Alignment and brakes are always computed automatically. This guide only covers what's new.

#### 2. Chassis Geometry

> Tyre sizes, wheelbase, and track widths are all now available in the CHASSIS section. Tyre width sets each axle's grip capacity at the limit and drives the CHASSIS BAL. (natural mechanical balance), GRIP BIAS (at-limit handling tendency), and STABILITY readouts below. Chassis geometry defaults suit most cars — enter exact values if you have them. The GEOMETRY GAP panel in the BALANCE section shows whether track or tyre width changes could help close the gap between your chassis natural balance and your target.

#### 3. Manual Differential

> MANUAL diff exposes individual accel and decel lock percentages per axle, grouped under FRONT AXLE / REAR AXLE / CENTER headers on AWD. Range hints below each field show typical values for your selected diff type — Rally and Offroad diffs need higher % than Race to achieve equivalent lock because their curves are less aggressive. MATCH CHASSIS (AUTO mode only, sits directly above the EXIT/ENTRY sliders it affects) biases the diff solver toward your Mech Balance Target so the differential reinforces the balance set by your springs and ARBs. The AWD center split recommendation factors in build type, weight distribution, natural mechanical balance, and front/rear tyre diameter — PRO mode shows a factor breakdown below the recommended value.

#### 4. Calibrating Natural Balance

> MEASURE NAT BAL (below the Balance Guide) opens Tune Check's MEASURE tab — it walks you through applying specific spring/ARB values in Forza, then you dial in the Mech Balance the game reports. Once set, the calculator uses your reading everywhere — Balance Guide, GRIP BIAS, natural balance — instead of the geometry prediction. The MEASURE tab lays this out as two numbered steps — natural balance first, then the ARB scale that is solved against it. The spring Hz you measured at is saved with the reading (default 2.20 Hz; softer readings are sharper), and CLEAR in the step, or ✕ in the sidebar, drops it. Track width fields hide while active since they're no longer needed; wheelbase stays visible for flat-ride Hz and brake balance.

#### 5. Calibrating ARB Scale

> ARB clicks don't map to the same stiffness on every car. STEP 2 · ARB SCALE SETUP, in Tune Check's MEASURE tab, finds your car's value: set the bars each reading lists (1 front / full rear, then the reverse), type the Mech Balance Forza shows for each, then pick MEASURED on the SCALE IN USE toggle. Each reading solves for a scale of its own and both are shown, so you can see whether they agree before taking their average. DEFAULT on that toggle goes back to the shared default. Worth doing on any car where bar-driven balance needs to be exact. Scales saved before the tyre-model update were cleared on purpose, so re-measure those cars.

#### 6. Mech Balance Target

> How far to move Forza's Mech Balance from your car's natural balance (NAT). 0 = stay natural; positive = more rotation; negative = more stable. The result is kept inside 0.05–0.95.
>
> Start from the BALANCE GUIDE below — its range is built from this car's geometry and build type. Set this before picking an ARB mode: all three solve toward it.

#### 7. Balance Target Mode

> Balance Target mode controls what the Mech Balance Target is measured from.
>
> NATURAL: an offset from the chassis natural balance — use the Balance Guide range as a start.
>
> RANGE: the middle of the Balance Guide's RANGE for your layout and build.
>
> GRIP: the mech balance at which the grip model reads exactly neutral for this chassis (the Balance Guide's GRIP TARGET).
>
> In RANGE and GRIP, Balance Offset shifts the target toward oversteer (+) or understeer (−).
>
> MANUAL: the raw mech balance itself, e.g. 0.60 — not an offset.
>
> GEOMETRY GAP shows whether track/tyre width changes could close the gap with softer ARBs.

#### 8. PRO ARB Balance Modes

> PRO unlocks CHASSIS, MECH, and CO-SOLVE balance modes. CHASSIS is WEIGHT's formula anchored to your real natural balance instead of raw weight %. MECH solves the ARB split alone to hit your Mech Balance Target exactly — as Forza displays it. CO-SOLVE adjusts rear spring Hz and ARB split together — Spring Share controls the mix. A target the car can't reach within game limits is flagged.

#### 9. Hz MECH & Balance Target Mode

> Hz MECH mode derives rear Hz from the target directly. Balance Target mode (NATURAL, RANGE, GRIP or MANUAL) applies to all three solving modes above. The resulting F/R split and the ARB tracks live in the pinned VISUALS card at the bottom of the sidebar.

#### 10. Alignment Mode

> BUILD (default) computes camber, toe, and caster from build type, layout, weight bias, and roll angle only. MECH nudges camber and toe toward your Mech Balance Target's gap from natural — reinforcing whatever oversteer/understeer intent you've dialed in. GRIP nudges to counteract the chassis's own natural grip tendency instead, independent of ARB mode. Nudge Strength (shown for MECH/GRIP) scales how far the nudge goes — 0% matches BUILD exactly. MANUAL lets you type exact camber, toe, and caster values, bypassing the solver entirely.

#### 11. Handling Balance Expanded

> Expand the Handling Balance bar (on phones, tap it then CONTRIBUTIONS) for the breakdown by corner phase. In PRO the figure is grip margin: how much more lateral grip the front has left than the rear, in percent. ENTRY adds brake bias at a stated braking load, MID splits into chassis, springs and ARBs, and EXIT adds the drive split; PITCH is shown under each but left out, and diff and damping show a direction only. Tips at the top name what to move, phase by phase, a RESPONSE breakdown rates transient character, and the MECH BALANCE strip marks your natural, current, and target roll-stiffness balance.

#### 12. Handling Balance Expanded (2/2)

> Scroll down in the expanded panel for LOAD TRANSFER — corner weights and lateral load transfer at 1g cornering. XFER F/R shows how much weight shifts to the outer tyre per axle per g of cornering. OUT/IN show outer and inner wheel loads at 1g. Wider track and lower CG both reduce transfer. These inform ARB aggressiveness and how much camber the outer tyre needs under load.

#### 13. Output Panel & Tune Check

> The results panel is unchanged from the lower tiers — six cards of exact values, amber where you're close to a game limit — but PRO leans on the toolbar pinned above the sidebar more. CHECK opens Tune Check, a reverse calculator: enter existing in-game spring and damper values to read back their natural frequency and damping ratios, useful for analysing a shared tune or verifying a manual setup. Its MEASURE tab is also where MEASURE NAT BAL sends you, and where ARB SCALE SETUP calibrates your car's bars. SHARE moves tunes between devices as a code or a link — and a loaded code is staged, so you tick which parts of it (chassis, springs, dampers, ARB, drivetrain) actually land — and backs up or restores your garage as JSON, and RESET returns the tune or the tutorials to defaults without touching your saves — a tune reset is one ↩ away from being undone.

### Handling balance <!--@steptext balance-->

#### 1. Handling Balance

> This breakdown shows how every tuning force combines into a single US/OS total. Positive (+) means oversteer tendency, negative (−) means understeer tendency. Each row is one contributor. The colour zones show neutral, mild, and aggressive ranges — but the right number depends entirely on your goal. In PRO the figure is different: the mid-corner grip margin in percent, read by corner phase — ENTRY, MID and EXIT.

#### 2. Typical Targets by Build

> Rotation-heavy and drift builds typically run +15 to +35. Track builds often sit +5 to +20 for feel under power. Street and GT builds may prefer mild understeer for stability. Use the bar to understand where your balance is coming from, not as a target to hit zero. These ranges are in BEG/INT points; the PRO grip-margin percent is a smaller unit, where ±1% already reads NEUTRAL.

#### 3. Reading Each Row

> Contributors are split into two groups. MECHANICAL is the car's own lean (CHASSIS — tyre sizes, track widths, CG and weight split) plus the springs and ARBs you set against it. DYNAMIC (diff, brakes, damping) are phase and behaviour contributors. Each row shows its value and percentage of the total so you can see at a glance which is dominant. On the compact bar, each contributor appears as a colour-coded segment stacking outward from neutral. PRO groups the rows by phase instead: brakes under ENTRY, chassis, springs and ARBs under MID, drive under EXIT, with diff and damping shown as a direction only.

#### 4. Using the Correction Tip

> The tip appears at the top of the expanded panel — above the contributor rows — and names the dominant contributor with a concrete adjustment suggestion. If your balance is further from your intended target than you want, the tip tells you which input to reach for first. For large shifts, your primary balance control has the most leverage — the Balance slider in BEG, or ARB Bias and balance settings in INT and PRO. For small residual adjustments, ARB Bias or Damping Bias give finer control.

#### 5. Response Bar

> The RESPONSE bar rates transient character — how quickly and freely the car reacts to steering inputs. PLANTED (left) means settled and damped: predictable but slow to change direction. REACTIVE (right) means quick to respond: sharp turn-in but can feel nervous. It's weighted mostly by front and rear Hz, with smaller contributions from damping, toe, and caster — see the RESPONSE entry in TERMS for the exact breakdown. Independent of the US/OS balance — a car can be neutral and still feel very planted or very reactive.

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
since steps get added and removed. Resuming goes through `openTut(mode, step)`, so
the `[tutMode, tutStep]` effect applies that step's sidebar, garage and section
state exactly as stepping there would. DONE ✓ clears the tier's entry; ✕ keeps it.
The balance guide is not tracked — it's five steps.

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
   guides only cover what that tier adds.
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
