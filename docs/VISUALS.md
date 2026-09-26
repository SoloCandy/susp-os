# VISUALS — the pinned readout card

The VISUALS card sits at the bottom of the sidebar, below every input section, and
holds the app's graphs in one place so they stay visible whichever section is open.
This file documents what each group draws: its scale, its bands, what every marker
and colour means, and which `tune` / `physics` fields it reads. It is the reference
for anyone changing a chart, and for anyone answering "what is that ring?".

The math the charts plot lives in [PHYSICS.md](PHYSICS.md); this file links to it
rather than restating it. Where a chart makes a presentation choice the physics does
not force — a band edge, a colour, an axis limit — the reason is given here.

`tests-docs.js` checks the numbers this file states that the code also holds: the ζ
zones, the settle band, and the ARB bands. The prose is not checked.

## The container

- **Where:** `<div id="zone-visuals">` wrapping `<Sec title="VISUALS">` (`open.visuals`),
  after the last input section and outside the sidebar's scroll area, so it stays put
  while the sections above it scroll.
- **Hidden** in BEG (`uiMode==='beginner'`), and on a phone while a sidebar field has
  focus (`isPhone&&sbTyping`). With the keyboard up, the pinned card would take
  most of what's left of the screen, so hiding it lets the scrolling controls keep
  their height.
- **Height:** the body scrolls inside a box capped at `32vh` on a phone and `50vh`
  otherwise, so an expanded card can't push the input sections off screen.
- **Groups**, in order, each with its own collapse key on `open`:

| Group | `open` key | Shown when |
|---|---|---|
| [DNA MATCH](#dna-match) | `visDna` | a Vehicle DNA link is active (`dnaLink`) |
| [RIDE · ROLL · DAMPING](#ride--roll--damping) | `visRide` | always |
| [DYNAMICS](#dynamics) | `visDynamics` | always |
| [SAG vs LOAD](#sag-vs-load) | `visSag` | CHASSIS → CG Height Source is RIDE HEIGHT (`ch.useRideHeightCG`) and both tyre sizes parse to a radius |

Every group header is a `collapsible-hdr` row. A collapsed header shows a one-line
summary where one is useful (RIDE · ROLL · DAMPING, SAG's risk badges), so the card is
still informative folded.

**Colours.** Front is blue and rear is orange throughout. The RIDE · ROLL · DAMPING
tracks and SAG vs LOAD use `#60a5fa` / `#fb923c` (`VIS_COL_F`/`VIS_COL_R`, and SAG's
local `COL_F`/`COL_R`); DYNAMICS uses a lighter sky blue, `#38bdf8`, for the front
trace. Grey `#94a3b8` means the chassis's **natural** balance and green `#4ade80` the
**Balance Target**, in every group that shows either. Amber `#f59e0b` is a warning.

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
  least 0.005 so the two don't sit on top of each other.
- **Footer**, left to right:
  - `roll X°`: body roll at 1 g (`tune.rollDeg`), amber when `tune.rollClamped`. In
    ROLL ARB mode it adds `/ rollTarget`.
  - `nat … tgt …`: the two tick values printed. `tgt` is omitted when its tick is.
  - `spr N · arb M%`: springs vs ARBs as a share of total roll stiffness
    (`tune.arbShare`).

Reading it: a divide to the right of the green tick means more front roll stiffness
than targeted (toward understeer); to the left, toward oversteer.

### The three tracks (`VisSuspTracks` over `VisTrack`)

Each track has two rows, F then R, on one shared scale. The zone bands are drawn at
opacity 0.28, and a band's label is printed under the track when the band is at
least 24 units wide. The filled dot is the value; the printed number at the right
edge is the same value in the unit the output card uses.

| Track | Scale | Bands | Header summary |
|---|---|---|---|
| RIDE Hz | `HZ_MIN`–`HZ_MAX` | SOFT / ROAD / FIRM / RACE, from `HZ_BANDS` and `HZ_BAND_COLS`, the same edges as the Ride Stiffness readout | `R/F ×ratio`, amber when `physics.rearHzClamped` |
| ARB | 0 to the game's click ceiling (`lim.arb`) | 50%, 75% and 90% of the ceiling | `of {ceiling}`, amber when either bar is past 88% |
| DAMPING ζ | 10–200 %, the Rebound ζ slider's range | see below | `B/R f% · r%`, amber when bump crosses above rebound |

**RIDE Hz.** `tune.fHz` / `tune.rHz`. The rear dot goes amber with the summary when
the rear Hz was clamped at the band.

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

The zones are the Rebound ζ and Bump ζ sliders' marker thresholds, 40, 70 and 100:

| Zone | Range | Label | Colour |
|---|---|---|---|
| under-damped, bouncy | 10–40 | UNDER | blue |
| approaching Butterworth | 40–70 | →BW | green |
| at or past Butterworth | 70–100 | BWORTH+ | amber |
| overdamped, sluggish | 100–200 | OVER | red |

`tests-docs.js` fails if either slider's markers, or the Rebound slider's range, stop
matching these. Change them together.

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
- **Window and measurement:** `measureSettle`, shared with the DAMPERS summary's
  MEASURED row so the two quote the same number. The window is sized from the settle
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
against it, so changing it would break that round trip. The chart's Hint says so.

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
| lightly shaded strip under it | the top 12% of travel, a bump-stop reminder: real springs go progressive here, and the lines are linear |
| solid diagonal from the origin | compression under uniform vertical load, `n × sag_1g` |
| hollow ring on it at 1 g | the static operating point |
| filled dot on the ride-height line | vertical bottom-out, `rideHeight / sag_1g` |
| short-dashed diagonal from `sag_1g` | the **outside** wheel in a corner: static sag plus lateral load transfer per g |
| hollow ring on the ride-height line | where that outside-wheel line bottoms |

Left-edge labels give each axle's ride height and 1 g sag, front in the first column
and rear in the second so they never overlap.

Readouts per axle: `bottoms ≈Xg` (or `no bottom ≤gMax g`) for the vertical line, and
`outside ≈Xg lat` (or `outside: no bottom`) for the cornering line. The outside
line usually bottoms first, because it starts from static sag rather than zero.

Braking load transfer and bump loads are not modelled by either line. Treat HIGH,
BOTTOMED and every bottom-out figure as a prompt to check, not a certainty.

## Changing a chart

- A new group needs an `open` key initialised in the `open` `useState`
  (`tests-docs.js` checks this), a row in the container table above, and a section
  here.
- Keep front blue and rear orange, NAT grey and target green. The card is read by
  colour at a glance, and a group that disagrees costs every other group its meaning.
- Components that render only inside VISUALS are listed in
  [CODE_MAP.md](CODE_MAP.md); the tutorial steps that point at the card are in
  [TUTORIALS.md](TUTORIALS.md).
