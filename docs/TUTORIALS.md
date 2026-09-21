# SUSP.OS — Tutorials

The in-app guided tours: what each one covers, when it opens, how the spotlight
works, and how to add or change a step.

All tutorial content lives in the `TUTORIALS` object in `index.html` (banner
`── Tutorial content ──`), and every guide renders through one component,
`TutorialPanel`. The step bodies themselves are the source of truth for wording —
this file catalogues them and explains the machinery around them, rather than
copying text that would drift.

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
tier guides only — `units` / `setUnits` for the units step and `notice` for the
locked-tier redirect message (step 0 only; see Tier gating).

- **Header**: `{label} GUIDE · n / total`, the step title, and ✕. For tier guides
  ✕ and DONE ✓ share one handler (`closeTutEnd`), so closing early has the same
  side-effects as finishing.
- **Progress bar**: one segment per step — done, current (indigo), upcoming.
- **Body**: either the step's `body` string, or its `terms` list rendered as bold
  term / definition pairs (the same treatment as the TERMS modal). A step with
  `units:true` appends the `UnitsPicker` — the same control the UNITS modal uses,
  so a choice made here is the real setting.
- **Buttons**: ← PREV from step 2 on; NEXT → until the last step, then DONE ✓.
  DONE calls `onDone` if given (tier guides: `closeTutEnd`), otherwise `onClose`
  (balance guide).
- **Overflow**: if the body scrolls, a `▼ SCROLL FOR MORE` fade appears; it is
  re-checked twice after layout settles because the first measurement can run
  before the final height is painted.
- **Width**: `CARD_W` scales with the viewport between 264px (phones) and 380px,
  so desktop cards don't wrap a monospace paragraph into a needless scrollbar.

### Positioning

The card anchors to the element `zone-{focus[0]}` (the balance guide always
anchors to `zone-balance-bar`). Measurements are divided by the app's CSS zoom,
and use `visualViewport` height so the iOS toolbar doesn't push it off-screen.

- **Target in the left half (sidebar)**: the sidebar is first scrolled so the
  target is visible (instant, not smooth — a smooth scroll would still be moving
  when the card measures). The card floats just right of the sidebar, vertically
  centred on the target and clamped on-screen, with a left-pointing arrow.
- **Target in the right half (results, balance bar, garage)**: the card goes above
  or below the target, whichever has more room, with an up/down arrow. If neither
  side can fit the card's natural height (e.g. `zone-output`, which fills the
  panel), it falls back to centred.
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
   doesn't hide the results for later steps.
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

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome to SUSP.OS | — | close | What the app does; ☰ opens the sidebar. |
| 2 | Choose Your Units | — | | Embedded units picker; match Forza's spring units. |
| 3 | Getting Around | — | | Header buttons desktop vs phone, undo/redo, number boxes, ⓘ hints. |
| 4 | Layout & Build Type | `layout-build`, `build-type` | | Drive layout and build type and what they drive. |
| 5 | Weight & Front Bias | `weight` | | Take them from the car selection screen. |
| 6 | Factory Presets | `garage` | close | GARAGE → FACTORY presets, ★ match, loads are undoable. |
| 7 | Saving Your Own | `garage` | close | SAVE CHASSIS / BUILD / CAR. |
| 8 | Ride Stiffness | `ride-stiffness` | | SOFT / ROAD / FIRM / RACE, FIRM as the start. |
| 9 | Balance | `balance` | | OVERSTEER ↔ UNDERSTEER slider and when to lean each way. |
| 10 | Character | `character` | | STABLE ↔ AGILE damping feel. |
| 11 | Handling Balance Bar | `balance-bar` | close | Colour zones; tap to expand. |
| 12 | Reading the Results | `output` | | The six result cards; amber = near a game limit. |
| 13 | Output Toolbar | `toolbar` | | RESET, ↩ / ↪, DNA, CHECK, SHARE. |

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
| 10 | ARB Bias & Visuals | `arb`, `visuals` | | ARB Bias; where the ARB dial lives. |
| 11 | Ride Ref & Rear Hz | `feel` | | RIDE REF.; MULTIPLIER / FLAT RIDE / INDEPENDENT. |
| 12 | Dampers | `damping` | | Rebound ζ, Bump Ratio, Damping Bias and the DAMP row. |
| 13 | VISUALS Card | `visuals` | | ARB, RIDE/DAMPERS, DYNAMICS, SAG readouts. |
| 14 | Handling Balance Bar | `balance-bar` | close | Per-contributor breakdown incl. DIFF and DAMP. |
| 15 | Reading the Results | `output` | close | The six result cards. |
| 16 | Output Toolbar | `toolbar` | | RESET, DNA, CHECK, SHARE. |
| 17 | Garage | `garage` | close | CHASSIS / BUILD / CAR entries, LOAD CHASSIS / LOAD BUILD. |
| 18 | Organizing & Searching | `garage` | close | Notes, tags, auto-tags, filter / sort, ↺ rewrite. |
| 19 | Sharing & Backup | `garage` | close | COPY / LOAD CODE, BACKUP, RESTORE. |

### Pro <!--@tutorial pro-->

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Welcome — Pro Mode | — | | What PRO adds. |
| 2 | Chassis Geometry | `chassis` | | Tyres, wheelbase, track widths; CHASSIS BAL., GRIP BIAS, STABILITY; GEOMETRY GAP. |
| 3 | Manual Differential | `drivetrain` | | Per-axle accel/decel lock, range hints, MATCH CHASSIS, AWD split breakdown. |
| 4 | Calibrating Natural Balance | `balance-target` | | MEASURE NAT BAL → Tune Check MEASURE; ✕ clears. |
| 5 | Calibrating ARB Scale | `balance-target` | | ARB SCALE SETUP, APPLY / RESET. |
| 6 | Mech Balance Target | `balance-target` | | Offset from NAT, 0.20–0.90 clamp, BALANCE GUIDE. |
| 7 | Balance Target Mode | `balance-target` | | TARGET vs GRIP, Balance Offset, GEOMETRY GAP. |
| 8 | PRO ARB Balance Modes | `arb` | | CHASSIS, MECH, CO-SOLVE; Spring Share. |
| 9 | Hz MECH & Balance Target Mode | `arb`, `visuals` | | Hz MECH; target mode applies to all three. |
| 10 | Alignment Mode | `alignment` | | BUILD / MECH / GRIP / MANUAL, Nudge Strength. |
| 11 | Handling Balance Expanded | `balance-bar` | | MECHANICAL / DYNAMIC groups, tip, RESPONSE, MECH BALANCE strip. |
| 12 | Handling Balance Expanded (2/2) | `balance-bar` | | LOAD TRANSFER: XFER F/R, OUT / IN. |
| 13 | Output Panel & Tune Check | `toolbar` | | CHECK, MEASURE tab, SHARE, RESET. |

### Handling balance <!--@tutorial balance-->

All steps are `focus:null`; the card still anchors to `zone-balance-bar`.

| # | Title | Spotlight | Sidebar | Covers |
|---|---|---|---|---|
| 1 | Handling Balance | — | | Sign convention: + oversteer, − understeer; colour zones. |
| 2 | Typical Targets by Build | — | | Rough ranges per build; zero isn't the goal. |
| 3 | Reading Each Row | — | | MECHANICAL vs DYNAMIC; value and % share. |
| 4 | Using the Correction Tip | — | | Which input to reach for, per tier. |
| 5 | Response Bar | — | | PLANTED ↔ REACTIVE, what it's weighted on. |

---

## Persistence and reset

| Key | Holds |
|---|---|
| `suspos_tutorial_seen_v1` | `{beginner, intermediate, pro}` — tier guides seen (also the tier gate) |
| `suspos_baltut_seen_v1` | Balance guide seen |
| `suspos_onboard_v1` | Onboarding popup dismissed (defaults `true`) |

Full shapes are in [PERSISTENCE.md](PERSISTENCE.md). Current step and open guide
are session state and are not persisted — a reload closes any open guide.

RESET (⟲) with **Tutorials** ticked sets all three tier flags and
`suspos_baltut_seen_v1` back to `false`, which re-locks INT and PRO until their
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
4. Update the catalogue table above (titles are checked by `tests-docs.js`).
5. Walk the whole guide in a browser at phone and desktop widths. Positioning,
   scroll-for-more and dimming are layout behaviour nothing but a browser proves.

When a control is renamed or a behaviour changes, grep `TUTORIALS` for the old
wording as well as the docs — tutorial bodies have lagged behind the code before
(see HISTORY.md, "four in-app hint/tutorial strings lagged behind").
