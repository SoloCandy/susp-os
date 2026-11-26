# VISUALS — the readout column

VISUALS is a peer of the inputs and the tune output: a docked column between them on a
wide screen, or a view that swaps with the tune cards on a narrower one. It holds the app's
graphs in one place and opens the ones that fit whichever input section is being edited.
This file documents what each group draws: its scale, its bands, what every marker
and colour means, and which `tune` / `physics` fields it reads. It is the reference
for anyone changing a chart, and for anyone answering "what is that ring?".

The math the charts plot lives in [PHYSICS.md](PHYSICS.md); this file links to it
rather than restating it. Where a chart makes a presentation choice the physics does
not force — a band edge, a colour, an axis limit — the reason is given here.

`tests-docs.js` checks the numbers this file states that the code also holds: the ζ
zones, the settle band, and the ARB bands. The prose is not checked.

## The container

- **Where:** `visualsPanel` in `App`, one `<div id="zone-visuals">` with a header row and a
  scrolling body (`data-vis-box`) that renders `visualsBody()`. The header's **VISUALS**
  button opens and closes it: in the desktop header's INPUTS · VISUALS · TUNE switch, and on a
  phone as the bottom tab bar's **VISUALS** tab. Where it goes depends on the window width against `VIS_COL_MIN`:
  - **At or above `VIS_COL_MIN`** (1200 px): a docked column between the sidebar and the
    output panel, 360–420 px wide (`visColW`). It is a flex sibling, so the output gets
    narrower rather than being covered. Open or closed is remembered (`visUI.dock`).
  - **Below it**: the column would leave the output about 300 px, so VISUALS swaps with the
    tune cards inside the output panel instead (`visView`, session-only, so a reload always
    lands on the tune). The balance bar stays under it. Its header has **TUNE ›** to swap
    back, except on a phone, where it is one of four tab-bar views (INPUTS · VISUALS · TUNE ·
    GARAGE) and every switch is one tap; see [CODE_MAP.md](CODE_MAP.md#phone-views).
  Neither home changes the sidebar's size, so the inputs keep their scroll position.
- **Hidden** in BEG (`uiMode==='beginner'`), and while the active layout hides the whole
  `visuals` section (the layout panel's VISUALS tab, or the header's HIDE / SHOW in the edit
  view). Single groups hide the same way, ALIGNMENT included (`visuals.align`), and so do pieces
  inside a group (`VisPart`: the roll split and each track, ALIGNMENT's two charts, LOAD TRANSFER's
  diagram and tables, GRIP USE's notes), from the panel only. A guide step that focuses
  `visuals` shows it whatever VIS says (`visTut`); on a phone only when no sidebar section
  shares the step, since the INPUTS view would cover it.
- **Which groups are open** mirrors the sidebar. Opening a section opens its groups
  (`VIS_FOR_SEC`, filtered by `visAvail`: the gates in the table below, and not hidden in the
  edit view); collapsing it closes them again, unless another open section or a pin still
  wants them. Groups a section doesn't name are left alone, so one opened by its own header
  stays until that header closes it; a header click toggles only its own group. When VISUALS
  appears (a load, or VIS pressed) it matches the sections already open. Opening BRAKES also
  turns GRIP USE to ENTRY, DRIVETRAIN to EXIT. Nothing moves during a guide.

  | Section | Groups |
  |---|---|
  | ANTI-ROLL BARS | RIDE · ROLL · DAMPING, LOAD TRANSFER |
  | RIDE (springs) | RIDE · ROLL · DAMPING, SAG vs LOAD |
  | DAMPERS | DYNAMICS |
  | CHASSIS | SAG vs LOAD, LOAD TRANSFER |
  | BUILD | RIDE · ROLL · DAMPING |
  | BALANCE | RIDE · ROLL · DAMPING, GRIP USE |
  | BRAKES, DRIVETRAIN | GRIP USE |
  | ALIGNMENT | ALIGNMENT |

- **PIN**, on every group header, keeps that group open whatever section is edited, and
  is never closed by a section collapsing (a pinned GRIP USE keeps its phase too). Pins are
  remembered (`visUI.pins`, [PERSISTENCE.md](PERSISTENCE.md)).
- The section label beside the title names the section last opened or touched (`activeSec`). A
  control pinned to MY CONTROLS counts for its home section; MY CONTROLS itself never does.
- **Groups**, in order, each with its own collapse key on `open`:

| Group | `open` key | Shown when |
|---|---|---|
| [DNA MATCH](#dna-match) | `visDna` | a Vehicle DNA link is active (`dnaLink`) |
| [RIDE · ROLL · DAMPING](#ride--roll--damping) | `visRide` | always |
| [DYNAMICS](#dynamics) | `visDynamics` | always |
| [SAG vs LOAD](#sag-vs-load) | `visSag` | CHASSIS → CG Height Source is RIDE HEIGHT (`ch.useRideHeightCG`) and both tyre sizes parse to a radius |
| [ALIGNMENT](#alignment) | `visAlign` | a Forza game mode (`!physMode`) |
| [LOAD TRANSFER](#load-transfer) | `visLoad` | PRO (`uiMode==='pro'`) |
| [GRIP USE](#grip-use) | `visGrip` | PRO (`uiMode==='pro'`) |

Every group header is a `collapsible-hdr` row. A collapsed header shows a one-line
summary where one is useful (RIDE · ROLL · DAMPING, SAG's risk badges), so the card is
still informative folded.

**Colours.** Front is blue and rear is orange throughout. The RIDE · ROLL · DAMPING
tracks and SAG vs LOAD use `#60a5fa` / `#fb923c` (`VIS_COL_F`/`VIS_COL_R`, and SAG's
local `COL_F`/`COL_R`); DYNAMICS uses a lighter sky blue, `#38bdf8`, for the front
trace. Grey `#94a3b8` means the chassis's **natural** balance and green `#4ade80` the
**Balance Target**, in every group that shows either. Amber `#f59e0b` is a warning.

These and the app's other meaning-colours are named once, under the `── colour meanings ──`
banner in `index.html`, and used everywhere rather than retyped:

| Constant | Colour | Means |
|---|---|---|
| `C_OS` | orange `#f97316` | oversteer, a + balance figure (the MECH Δ colour) |
| `C_US` | blue `#60a5fa` | understeer, a − balance figure |
| `C_WARN` | amber `#f59e0b` | a warning: near or past a limit, clamped, drifted |
| `C_ERR` | light red `#f87171` | an error or hard failure (bottomed out, bad input) |
| `C_GOOD` | green `#4ade80` | in range, matched, target met |
| `C_TAG` | grey `#94a3b8` | a neutral category tag (ROAD, MED…) |
| `CAT_RAMP` | greys `#64748b` → `#e2e8f0` | an ordered scale with no good/bad meaning: soft → stiff, low → high |
| `T_MUTED` / `T_FAINT` | `#7c8aa0` / `#64748b` | secondary text (hints, units, sub-headers) / the dimmest text allowed |

Red is no longer a balance colour, so a large oversteer number doesn't read as a fault.
Character axes that are neither balance nor good/bad — RESPONSE, the Balance Guide's
FOOTPRINT tag, spring and damper categories, diff lock amount — use `C_TAG` and
`CAT_RAMP`. Front blue (`VIS_COL_F`) is the same hex as `C_US` but means *front axle*; the
two never share a chart element. No text anywhere is smaller than 10 px on screen: SVG
labels are sized in viewBox units so they reach 10 px at the narrowest sidebar (about
1:1 on a 375 px phone).

## DNA MATCH

A table, not a chart. Shown only while a Vehicle DNA is linked to the current tune;
see [DNA.md](DNA.md) for what a link is and when it drops.

| Column | Meaning |
|---|---|
| AXIS | the DNA axis's label (`DNA_AXIS_UI`) |
| TARGET | the value the DNA compiled for that axis at APPLY |
| NOW | the tune's current value for it, amber when it has drifted |
| ✓ / ≠ | green ✓ = unchanged since APPLY; amber ≠ = changed since |

NOW reads **MODE** when the control that axis drove is no longer in the mode the DNA
set (for example the ARB stiffness mode was switched), so there is no comparable
value. The footnote under the table says both of these in one line.

## RIDE · ROLL · DAMPING

The card's main group: the whole car's roll split, then front and rear ride Hz, ARB
and damping as rows on one shared scale per quantity. Front and rear are compared by
position on the same track, and every value is printed. It replaced three arc dials
(`SpringDial`, `ArbDial`, `DampingDial`) whose values showed only on hover; see
[HISTORY.md](HISTORY.md#changed--visuals-dials-replaced-by-the-ride--roll--damping-tracks).

The render IIFE computes `mechBal = tune.mechBalance`, falling back to the raw
roll-stiffness rear fraction `(rsSpR+rsAbR)/total` when that is null, so the card
still draws. The collapsed summary is `R {mechBal%} · ×{rHz/fHz} · {rollDeg}°`.

Components (module scope, under the `── VISUALS: ride · roll · damping tracks ──`
banner): `VisRollSplit`, `VisSuspTracks`, the shared `VisTrack` row renderer, and the
`visGhost` helper.

### ROLL SPLIT (`VisRollSplit`)

One horizontal bar, front on the left and rear on the right.

- **Divide:** at `1 − mechBal`, the display-space rear fraction that the MECH BALANCE
  strip plots, so the divide sits exactly where that strip's CUR does. Header prints
  `F nn · R nn`.
- **Shading within each end:** solid (opacity 0.85) = springs, light (0.35) = ARBs,
  each as a share *of that end* (`rsSpF/(rsSpF+rsAbF)` and the rear equivalent).
  Springs sit at the outer ends and ARBs toward the divide, so the ARB part reads as
  the part that moves the divide. These shares are model-space stiffnesses; they are
  a split of one end, never a second balance, so the display-space divide and the
  model-space shading are never compared with each other.
- **Ticks:** grey = NAT (`natMechBalance`, from `natDisplayOf`); green = the Balance
  Target (`feEffective.arbBalTarget`), drawn only when it differs from NAT by at
  least 0.005 so the two don't sit on top of each other. An untouched target is NAT
  itself, so it draws nothing. It is not tier-gated, so INT, which has no control that
  sets a target, still sees one set earlier in PRO — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **Footer**, two lines so each label fits at 10 px. The first line has `roll` on the
  left and `spr … arb` on the right; the second has `nat … tgt …` centred.
  - `roll X.XX°`: body roll at 1 g (`tune.rollDeg`, two decimals), amber when `tune.rollClamped`. In
    ROLL ARB mode it adds `/ rollTarget`.
  - `nat … tgt …`: the two tick values printed. `tgt` is omitted when its tick is.
  - `spr N · arb M%`: springs vs ARBs as a share of total roll stiffness
    (`tune.arbShare`).

Reading it: a divide to the right of the green tick means more front roll stiffness
than targeted (toward understeer); to the left, toward oversteer.

### The three tracks (`VisSuspTracks` over `VisTrack`)

Each track has two rows, F then R, on one shared scale. The zone bands are drawn at
opacity 0.28, and a band's label is printed under the track when the band is at
wide enough for the label (six units a character, plus four). The filled dot is the value; the printed number at the right
edge is the same value in the unit the output card uses.

| Track | Scale | Bands | Header summary |
|---|---|---|---|
| RIDE Hz | `HZ_MIN`–`HZ_MAX` | SOFT / ROAD / FIRM / RACE, from `HZ_BANDS` and `HZ_BAND_COLS` (`CAT_RAMP`, darkest grey to lightest), the same edges as the Ride Stiffness readout | `R/F ×ratio`, amber when `physics.rearHzClamped` |
| ARB | 0 to the game's click ceiling (`lim.arb`) | 50%, 75% and 90% of the ceiling: grey, lighter grey, then amber for the last 10% | `of {ceiling}`, amber when either bar is past 88% |
| DAMPING ζ | 10–200 %, the Rebound ζ slider's range | see below | `B/R f% · r%`, amber when bump crosses above rebound |

**RIDE Hz.** `tune.fHz` / `tune.rHz`. The rear dot goes amber with the summary when
`physics.rearHzClamped` is set — which flags the *derived* axle, so under a REAR ride
reference the amber lands on the wrong row ([KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

**ARB.** `tune.arbF` / `tune.arbR`. A dot goes amber past 88% of the ceiling. In a
physical-unit game mode (`physMode`) there is no ceiling, so the caller passes a
dynamic full scale, the stiffer bar plus 25% headroom, and sets `physical`. The bands
and the amber warning are then suppressed, because they would imply a limit that
doesn't exist, and the printed values are the N/m that `arbOut` gives the ARB card, so
the track can never contradict the number you type into the game.

**DAMPING ζ.** `physics.zetaF`/`zetaR` (rebound) and `physics.bumpZetaF`/`bumpZetaR`
(bump). The filled dot is rebound; the **hollow** dot is bump, joined to it by a bar.
The bar and hollow dot turn amber when bump exceeds rebound, which is unusual enough
to flag. The row prints `bump/rebound`.

The zones are `ZETA_ZONES`, the same table the Rebound ζ and Bump ζ sliders draw their zones from, 40, 70 and 100:

| Zone | Range | Label | Colour |
|---|---|---|---|
| under-damped, bouncy | 10–40 | BOUNCY | `CAT_RAMP[0]` |
| below Butterworth | 40–70 | SOFT | `CAT_RAMP[1]` |
| at or past Butterworth | 70–100 | FIRM | `CAT_RAMP[2]` |
| past critical, sluggish | 100–200 | OVERDAMPED | `CAT_RAMP[3]` |

A grey ramp, light for more damping: none of these zones is an error, and the old
blue/green/amber/red read as understeer, good, warning and danger. The words match the
text beside the Rebound ζ slider (FIRM, OVERDAMPED); they replaced UNDER / →BW / BWORTH+ /
OVER, whose UNDER read as understeer. BOUNCY's band is too narrow for its label at the
10-unit size, so only SOFT, FIRM and OVERDAMPED print.

The sliders show all four, and mark Butterworth itself (ζ≈70.7%, a point rather than a
region) as a BUTTERWORTH point at the 70% edge (`ZETA_REFS`).
`tests-docs.js` fails if either slider stops passing `ZETA_ZONES`, or the Rebound slider's
range stops matching the track's.

### Ghost rings

The hollow rings on the RIDE Hz and ARB tracks show where the **derived** axle, the
one Ride Reference doesn't fix, would have to sit for that component alone to carry
a given balance: grey for natural balance, green for the Balance Target. They sit on
the rear row unless Ride Reference is REAR, in which case they sit on the front row.

A ring is omitted when its value is off the track's scale, and the green ring is
omitted when it is within 0.03 Hz (RIDE) or 2% of full scale (ARB) of the grey one.
The formula is `visGhost`, documented in
[PHYSICS.md](PHYSICS.md#visuals-ghost-rings-visghost), including what it
approximates.

## DYNAMICS

A damped step response per axle: the trace starts displaced and settles back to ride
height, as after one bump or one corner. It shows how fast each axle settles, whether
it overshoots, and how ride Hz and damping interact.

- **Inputs:** `tune.fHz`/`rHz`, and rebound and bump ζ per axle from
  `tune.zetaF`/`bumpZetaF`/`zetaR`/`bumpZetaR`. The fallbacks are the anchor
  `physics.reboundZeta` / `physics.bumpZeta`, then 70 / 39.
- **Trace:** `computeOscillation`, which switches between rebound and bump ζ by the
  sign of the velocity, so bump is fully represented here.
- **RIDE / ROLL toggle** (full width at the top of the open group, session-only `dynView`, not persisted): ROLL
  scales each axle's ζ by `s = √(rsSp/(rsSp+rsAb))` and its Hz by `1/s` — the bar
  adds roll stiffness without damping. Same band, markers and readouts. A
  comparison view: roll centres and chassis coupling are ignored.
- **Window and measurement:** `measureSettle`, shared with the DAMPERS table's
  Settle-row MEAS figure so the two quote the same number. The window is sized from the settle
  time, between 1.5 s and a 4 s cap.
- **Axes:** a 280 × 80 frame. The centre line is ride height; displacement is
  vertical. There is no numeric axis because the readouts below carry the numbers.

| Mark | Meaning |
|---|---|
| shaded strip, labelled ±10% | the settle band (`SETTLE_ENV`), which the settle time is measured against |
| blue / orange trace | front / rear displacement |
| dashed vertical line | settle time: the **last** time the trace leaves the ±10% band, interpolated |
| small ring on the centre line | the first neutral (ride-height) crossing, interpolated: a rise-speed marker, not a settle marker |

Readouts per axle: `settle Xs` (or `>durSec` when the trace is still outside the band
at the window edge, with the dashed line pinned to that edge), and `neutral ≈Xs` (or
`no neutral cross` for an overdamped trace that never crosses).

Three things about the dashed line surprise people. All three follow from the
last-band-exit definition, not from the integration:

- Past ζ ≈ 60% it can land **before** the neutral ring, because the trace enters the
  band on the way down and never leaves.
- It moves in **steps**, not smoothly, as ζ rises.
- The quickest settle is **not** at critical damping.

The band is drawn precisely so the first of these reads as what it is. The
derivation and the figures are in
[PHYSICS.md](PHYSICS.md#critical-damping-is-the-fastest-settle-is-true-of-the-envelope-only).

This settle figure deliberately differs from the analytic one the DAMPERS card
quotes. The analytic figure sees rebound ζ only, and SETTLE TIME mode back-solves
against it, so changing it would break that round trip. The chart's ⓘ links to its
`dynamics-chart` glossary entry, which says so; the hint itself is too short to.

## SAG vs LOAD

Suspension compression against load, per axle, with the ride height as the
bottom-out line. It appears only when ride height drives the CG estimate
(`ch.useRideHeightCG`) and both tyre sizes parse; the model is in
[PHYSICS.md](PHYSICS.md#natural-sag-and-bottoming-risk-ride-height-chassis-toggle).

- **Inputs:** `tune.fHz`/`rHz`, `ch.rideHeightF`/`R`, `cornerMasses(ch)`, the roll
  stiffnesses `rsSp*`/`rsAb*`, and `latLoadTransfer`.
- **Header:** when open, `● FRONT {risk} ● REAR {risk}`. Risk is `sag_1g / rideHeight`:
  LOW below 0.5, MED from 0.5, HIGH from 0.8, BOTTOMED from 1.0.
- **X axis:** load in g, from 0 to `gMax`. `gMax` is the largest bottom-out g on the
  chart plus 25%, at least 1 and at most 6, so a bottom-out point is always on
  screen when there is one within 6 g. Integer ticks.
- **Y axis:** compression, from 0 to 8% above the tallest thing drawn. The top
  label is in cm or in, following the length unit.

| Mark | Meaning |
|---|---|
| dashed horizontal line | the axle's ride height: compression past it is bottoming |
| lightly shaded strip under it | the top 12% of travel (`BUMP_STOP_ZONE`), a bump-stop reminder: real springs go progressive here, and the lines are linear. BUMP MODE → LANDING catches drops below it |
| solid diagonal from the origin | compression under uniform vertical load, `n × sag_1g` |
| hollow ring on it at 1 g | the static operating point |
| filled dot on the ride-height line | vertical bottom-out, `rideHeight / sag_1g` |
| short-dashed diagonal from `sag_1g` | the **outside** wheel in a corner: static sag plus lateral load transfer per g |
| hollow ring on the ride-height line | where that outside-wheel line bottoms |

The left edge carries only `0` and the length unit. Each axle's ride height and 1 g sag print
under the chart instead (`F ride … · sag … in`), as text that wraps: four values in the margin
collided, front beside rear (`5.124.72`) and the tallest ride height under the axis label.

Readouts per axle: `bottoms ≈Xg` (or `no bottom ≤gMax g`) for the vertical line, and
`outside ≈Xg lat` (or `outside: no bottom`) for the cornering line. The outside
line usually bottoms first, because it starts from static sag rather than zero.

Braking load transfer and bump loads are not modelled by either line. Treat HIGH,
BOTTOMED and every bottom-out figure as a prompt to check, not a certainty.

## ALIGNMENT

Two panels, `VisCamberRoll` and `VisAlignStrips`, reading the alignment the output prints
(`align`, from `alignOut`) and AUTO's own (`autoAlign`). Forza modes only: `ALIGN_GAME` and
`ALIGN_REC` are Forza's ranges. Like every VISUALS group it starts below BEG, so in practice
INT and PRO. The maths is in [ALIGNMENT.md](ALIGNMENT.md).

**CAMBER vs ROLL.** The outside tyre's camber as the body rolls, per axle.

- **X axis:** body roll in degrees, 0 to `max(3, ceil(rollDeg × 1.6))`, so the tune's roll sits a
  little past the middle. Integer ticks.
- **Y axis:** camber in degrees, the drawn values ±0.3° rounded out to the next 0.5°, labelled at
  both ends. A solid line marks 0° when it is in range, labelled when there is room.
- **Header:** `dyn F … · R …`, the dynamic camber at the tune's roll, the same figure as the
  output card's `dyn` tag. On a narrow phone it drops below the title as a whole rather than
  breaking either one.

| Mark | Meaning |
|---|---|
| solid line | static camber + roll × gain: front gain `camberGain`, rear `camberGain × rearGainMult` (`camberGainOf`) |
| dashed horizontal | the build's dynamic target (`computeAlignment`'s `target`: `optimalCamber`, plus `fwdReduction` on a FWD front) |
| dot | the camber at `tune.rollDeg`; on its dashed line when AUTO reaches its target with no camber offset |
| `F` / `R` | direct labels at the lines' right ends, nudged apart when close |

Front draws over rear, so on a RWD or AWD car at AUTO both dots and both targets coincide and the
front's hide the rear's; the header still prints both.

**RANGES.** One strip per value: camber F, camber R, toe F, toe R, caster.

| Mark | Meaning |
|---|---|
| track | the span: camber −5..+5° and caster 1..7° (`ALIGN_GAME`); toe ±1° (`ALIGN_STRIP_SPAN`). Every mark and figure is in the game's sign (`alignInGame`), so a Forza toe-in sits left of 0 |
| grey shading | that value's `ALIGN_REC` band, where AUTO keeps its recommendation |
| short tick | 0°, on the camber and toe strips |
| hollow ring | AUTO's value (`autoAlign`) |
| filled dot | the value in use, amber when `align.limit` holds it at a band or the game's limit |
| right-hand figure | the value in use, amber at LIMIT |

Toe is drawn across ±1° rather than the game's ±5° because on ±5° the band and every intent offset
would fit in a few pixels. A toe beyond ±1° pins to the strip's end, and its figure gives the real
value. `MANUAL` shows in the header while MANUAL is on.

## LOAD TRANSFER

PRO only. The grip model's own lateral load transfer at 1 g cornering, from
`loadTransferOf` (see [FORMULAS.md](FORMULAS.md) "Load transfer readout"), so the springs and
bars move it. Collapsed, the header reads `F {share}% · WT {weight}%`, plus `· LIFT` in amber
when an inside wheel lifts.

| Part | Meaning |
|---|---|
| FRONT TAKES · WEIGHT | the front axle's share of the total transfer beside the weight split; `C_US` blue when the front takes more than its weight share (leans understeer), `C_OS` orange when less, white within 1 point |
| top-down sketch | the four wheels in a left turn, load moving to the right-hand (outer) side; front blue, rear orange. Each wheel is an outline with a bar growing outward from it, its **length** the wheel's load against the heaviest wheel's, and the load printed under it; the caption names the mass unit. A lifted wheel is an amber dashed outline reading LIFT, with no bar. Length, not shading, so it reads apart from GRIP USE's meters at a glance: one is pounds per wheel, the other % of grip per axle |
| CORNER | static corner mass |
| XFER | each axle's transfer per g, then split into SPR+ARB (through the springs and bars: the part the tune moves) and GEOMETRY (through the roll centre: fixed) |
| OUT / IN | outer and inner wheel loads; IN reads LIFTS in amber once the inner wheel unloads, and OUT is then the whole axle |
| FORE-AFT · AXLE LOADS | front and rear axle loads, and % front, under `ENTRY_G` braking and `EXIT_G` drive, with no cornering |

It sat at the bottom of the expanded Handling Balance panel until it was rebuilt; it moved
here because it pictures the car's loads, as the other groups do, rather than the balance.

## GRIP USE

PRO only. A prediction, before the car is driven, of how much of each axle's grip is in use
when the car reaches its limit, from `gripUseOf` (see [FORMULAS.md](FORMULAS.md) "Grip use").
A full-width MID / ENTRY / EXIT toggle at the top of the open group picks the phase (`gripPhase`, session-only;
in the header it clipped at sidebar width); collapsed,
the header reads `F LIMIT · {spare}% SPARE`, `R LIMIT · …` or `EVEN`.

| Part | Meaning |
|---|---|
| FRONT / REAR meters | one per axle, front blue and rear orange: the fill runs 0–100% to the share in use, into an amber band (`C_WARN`, not red, which is for errors) over the last 5% before the limit. On ENTRY / EXIT the fill's hatched start is the part the braking or drive takes. The line above each meter prints the share, on ENTRY / EXIT the braking or drive share, `INNER LIFTS` in amber when the inner wheel unloads, then LIMIT for the axle that runs out first (its meter outlined white) or the other's share to spare |
| caption | `% OF GRIP IN USE AT THE LIMIT · {phase}`, so the unit is never in doubt beside LOAD TRANSFER's pounds |
| verdict | which axle runs out first and what that means at the limit: front → understeer, rear → oversteer, within 2% → balanced |
| ENTRY / EXIT note | the figures include pitch, the car's own weight transfer, so they predict the car; the bar's ENTRY / EXIT leave it out (that line says `excl. pitch`) to show what the settings change. Use the bar's to decide brake bias, centre split or diff; use these to know which end lets go first |

Both tyres on an axle use the same share: they run one slip angle, so the model splits the
axle's force in proportion to their capacity. That is why it draws a meter per axle: it replaced
a four-wheel sketch whose left and right wheels always printed the same figure. The model has no friction coefficient, so the
limit itself has no g figure, only the shares.

## Changing a chart

- A new group needs an `open` key initialised in the `open` `useState`
  (`tests-docs.js` checks this) and listed in `VIS_KEYS`, its gate in `visAvail` and its
  hide id in `VIS_HIDE_ID` (and a `HIDE_ITEMS` row; pieces inside it that can be hidden are
  `VisPart`s with rows of their own), a place in the `VIS_FOR_SEC` rows it suits, `{visPin(key)}` in its
  header, a row in the container table above, and a section here.
- Keep front blue and rear orange, NAT grey and target green. The card is read by
  colour at a glance, and a group that disagrees costs every other group its meaning.
- Components that render only inside VISUALS are listed in
  [CODE_MAP.md](CODE_MAP.md); the tutorial steps that point at the card are in
  [TUTORIALS.md](TUTORIALS.md).
