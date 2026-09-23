# SUSP.OS — Hz, Spring, and Damping Formulas

The core physics engine: how a ride-stiffness slider position becomes a
spring rate in lb/in, how a damping ratio becomes a damper click count, and
how the various rear-Hz modes (FLAT RIDE / MULTIPLIER / MECH / CO-SOLVE /
INDEPENDENT / SHARED) derive the secondary axle's frequency. Scope note: this file
covers the *solve* math (Hz → physical output). For the separate *balance
direction* math (which axle being stiffer means oversteer vs understeer),
see [FORMULAS.md](FORMULAS.md). For camber/toe/caster, see
[ALIGNMENT.md](ALIGNMENT.md).

---

## Calibration constants

Key empirical constants calibrated from real Forza data:

| Constant | Value | Description |
|---|---|---|
| `ARB_RS_SCALE` | 540 | Default ARB click → roll stiffness per m² of track (N·m/rad), at the suspension, before the tyre. Per-car override via MEASURE ARB — see [ARB click scale](#arb-click-scale-measure-arb) |
| `TYRE_HZ` / `TYRE_REF_MASS` | 3.94 Hz / 269 kg | The tyre as a spring in series with each axle in Forza's displayed balance: a 3.94 Hz spring on a 269 kg corner, stiffening with √(corner mass). See [Tyres in series](#tyres-in-series-with-the-suspension-displayrsbalance) |
| `DAMPING_CALIBRATION` | 0.00135 | Maps damper click → critical damping coefficient. Empirically validated via SimHub telemetry: Forza uses lbf/ft/s internally, not N/mm/s — the ×1.35 correction factor confirmed by comparing suspension settling behaviour under baseline vs corrected damper values |
| `TIRE_LOAD_SENS` | 0.15 | Grip falloff per unit Fz/Fz_ref — the tyre load sensitivity that lets roll stiffness shift balance |
| `TIRE_MECH_SCALE` | 0.08 | Tyre width rear/front ratio → mech balance offset via `0.08 × ln(twR/twF)`. Forza's displayed mech balance incorporates tyre width asymmetry; this correction ensures the calculator's output matches Forza's reading. Calibrated from Stage 2 testing (same suspension, tyre widths swapped) across MX-5, Ultima, and Scirocco |
| `MECH_BAL_GAIN` | 1.8 | Axle grip-capacity delta → balance offset (calibrated to the 0.5-neutral scale) |
| `WIDTH_GRIP_EXP` | 0.4 | Tyre width → grip capacity, sub-linear exponent |
| `MECH_BALANCE_TARGET` | 0.60 | Default absolute Mech Balance Target when the user hasn't set one. Not a physics constant — a default *goal*. Set from the Forza community's published road/circuit window of 0.55–0.65, whose neutral baseline is ~0.60 (0.62–0.65 is a rotation-biased touge setting). Was 0.65 until it was checked against that window — see [HISTORY.md](HISTORY.md) |
| `DIFF_BIAS_SCALE` | 0.14 | Diff lock % → handling bias contribution |
| `DIFF_TYPE_SCALE` | race 1.00 / sport 0.88 / rally 0.76 / offroad 0.52 / drift 1.10 | AUTO solver multipliers per diff type. Community-estimated: same slider % produces less effective lock on Rally/Offroad than Race, more on Drift. Sport is accel-only (no decel slider in-game) |
| `BRAKE_BIAS_SCALE` | 0.20 | Brake balance deviation → handling bias contribution |

Constants validated through a structured test protocol across three cars —
2017 Mazda MX-5 Cup, 2015 Ultima Evolution Coupe 1020, and 2011 Volkswagen
Scirocco R — covering balanced, understeer, and oversteer tyre configurations
and ARB ±10 click sensitivity sweeps.

**These constants only apply to the two Forza modes.** `ARB_RS_SCALE` and
`DAMPING_CALIBRATION` exist to bridge real physics onto Forza's abstract 1–N
"click" scales, which are needed because Forza hides its internal units. The
**BEAMNG** mode skips that step entirely and emits the pre-conversion values
the solver already works in — see [Physical-unit output](#physical-unit-output-beamng-game-mode)
below — so it introduces no new calibration constant and needs no validation
protocol.

**Ride-height-derived CG height** (INT/PRO CHASSIS section, CG Height Source
toggle, defaults to RIDE HEIGHT) is a plain geometric heuristic, not a
measured/validated constant — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the
full caveat.

**Game limits:** Horizon — ARB 65 clicks, damper 20 clicks. Motorsport — ARB
40 clicks, damper 40 clicks. BeamNG — none (see Physical-unit output below).

**Mechanical balance accuracy.** Mechanical balance (the **MECH BALANCE**
readout) is the rear fraction of roll stiffness *as Forza displays it*: each
axle's suspension (springs + bars) in series with its tyres (see below), plus
the tyre-width correction `TIRE_MECH_SCALE` and the MEASURE NAT BAL offset.
Against 33 in-game readings on three cars — springs split front/rear by up to
±0.15 at 2.5–3.5 Hz — the display model's rms error is about 0.006, inside
Forza's 2-decimal readout. The geometric natural balance (no measurement)
reads 0.017–0.028 below Forza on those cars; MEASURE NAT BAL removes that per
car.

### Tyres in series with the suspension (`displayRsBalance`)

Forza's displayed balance treats each tyre as a spring in series with its
axle: an axle shows `K·Kt/(K+Kt)`, where `K` is its suspension roll
stiffness and `Kt = tyreRollStiffness(cornerMass, track)`. That compresses
front/rear differences, and compresses them more the stiffer the suspension:
the stiffer spring stops being the soft link.

The evidence, from a far-offset sweep with the springs doing all the work
(Rear Hz MECH, ARB 1/1): on the MX-5 Cup the game moved only **0.70** of the
predicted shift at 2.5 Hz, **0.675** at 3.0 Hz and **~0.61** at 3.5 Hz — a
straight line at each Hz, flattening with stiffness. A constant ratio and a
fixed extra stiffness (which would make the ratio *rise* with Hz) were both
ruled out. The series tyre fits all 13 MX-5 rows at once. Fitting the MX-5,
Scirocco R (65% front) and Ultima Evo (38% front, 245/335 tyres) together —
33 readings, including the equal-Hz natural readings each car was measured at
— gave:

- **Tyre frequency 3.94 Hz on a 269 kg corner** (`TYRE_HZ`, `TYRE_REF_MASS`),
  stable from the MX-5 alone (3.96) to all three cars.
- **Stiffness growing with √(corner mass).** Best fit 0.35 power; √ is within
  noise. A load-independent tyre would make natural balance drift with Hz on
  uneven cars, which none of the three did; stiffness proportional to load
  misses the Scirocco's rows. `tyreRollStiffness` expresses this as the tyre
  spring on a corner of mass `√(m·TYRE_REF_MASS)`.
- **No width term.** The Ultima's rows were predicted before measurement both
  with and without a width-proportional tyre; the width-free model won every row
  where they differed.

The Ultima rows were a genuine out-of-sample check: the model was fixed from
the other two cars first.

**Where it applies.** Only the displayed `mechBalance` in the Forza modes, and
MEASURE ARB's solve. The solvers (`mechSpringSplit`, CO-SOLVE, the ARB split)
still work in suspension space; `solveTune` re-runs them with an adjusted
internal target until the *displayed* balance meets the target (secant, at most
8 extra passes), then judges `mechBalClamped` against the target asked for.
The physical (BeamNG) modes run the same loop against the suspension balance —
nothing is displayed there, but spring snapping still moves the result off the
target the solvers aimed at, and the loop takes that back out. So a
target-seeking mode asks for bigger spring or bar splits than before, and runs
into Forza's spring and bar limits sooner — targets that were never reachable in
the game now say so. Roll angle, the GRIP BIAS model, the contribution bars and
the physical (BeamNG) balance itself are unchanged: the calibration is of Forza's balance
readout, and nothing here measured the rest.

**MEASURE NAT BAL with the tyre term.** At equal ride Hz the display model's
natural balance moves slightly with Hz on an uneven car (about 0.01 per Hz on
the Ultima), so the Hz a reading was taken at is stored with it
(`ch.measuredNatBalHz`, set from NAT BAL SETUP's Measure Hz) and
`displayNatOffsetOf` anchors the display to the reading at that Hz. Readings
saved before the field existed use `NAT_BAL_REF_HZ` (2.5, the card's default).

### ARB click scale (MEASURE ARB)

One Forza ARB click adds `arbScaleOf(ch)·track²` of suspension roll stiffness
per axle, before the tyre. `arbScaleOf` returns `ch.measuredArbClick` when
MEASURE ARB is set, else `ARB_RS_SCALE`. APPLY also records the MEAS. NAT BAL
and Hz it was measured against (`measuredArbNat`/`measuredArbNatHz`), and
`arbScaleStale` flags RE-MEASURE once those stop matching. The scale is still
used while flagged; the flag only says it was solved against a different anchor.

The constant was 240, then 285, both fitted without the tyre term, which folded
the tyre's softness into the click. Refitting the same in-game MAN bar sweep
(three cars at 2.50 Hz, equal springs, bars swept front- and rear-biased) under
the tyre-series model gives about **579 (MX-5 Cup), 438 (Ultima Evo) and 626
(Scirocco R)**, each within Forza's rounding. The spread is the same as before:
Forza normalises the 1–N slider per car, so no single constant fits every car.
540 is the compromise default. Fitting front and rear scales separately (before
the tyre refit) gave ratios within noise of 1, so the front/rear split and the
`track²` weighting hold; only the magnitude varies by car. The bar data alone,
with each car's scale free, prefers a tyre frequency of 3.5 Hz or more and is
flat from there, so it agrees with the springs' 3.94 without pinning it.

MEASURE ARB (TUNE CHECK's measure mode, beside NAT BAL SETUP) finds the
per-car value. On the NAT BAL springs, the user sets the bars to `1 / H`
then `H / 1` (`H` = 70% of the ARB ceiling) and types Forza's mech balance
for each. `solveArbScale` bisects for the scale at which the display model
(tyres, `tireCorr` and the MEASURE NAT BAL offset, which is why that must be
set first) reads what Forza showed. The two results are averaged: one
2-decimal reading moves the answer by several percent, and swapping the bars
cancels any front/rear bias. A reading no scale between 150 and 1500 can
produce is rejected. Scales measured before the tyre term (codec ids 70/71)
are dropped, not converted.

Changing the scale moves clicks, not stiffness: AUTO, SHARE, ROLL and the
balance solves ask for the same roll stiffness and print fewer or more clicks.
MAN clicks are taken as typed, so their stiffness, roll angle and balance
change instead.

The physical at-limit tendency (**GRIP BIAS**) is derived separately from a
lateral-load-transfer model — see [Mech balance grip model](#mech-balance-grip-model-mechbalancelltbalancefromrsbal)
below. The two are reconciled by bisection so a balance target round-trips to
the spring/ARB split that achieves it.

---

## Ride Stiffness slider ↔ Hz

```js
HZ_MIN = 0.8, HZ_MAX = 5.5                          // the whole app's spring-frequency band
rsToHz = rs => rs > 6 ? 0.8 + (rs/100)*2.7 : rs      // migrates old 0-100 integer saves to Hz
hzToRs = hz => round(clamp(HZ_MIN, HZ_MAX, hz), 0.001) // snaps a raw Hz value to the grid, in range
```

`fe.rideStiffness` stores Hz directly today; the `rs>6` branch in `rsToHz`
exists only to auto-migrate pre-Hz saves/share-codes that stored an
integer 0-100 slider position instead.

### The 0.001 Hz grid

`hzToRs` and `sanitizeTune` both round `fe.rideStiffness` to **0.001 Hz**. This
is the floor under every stiffness input, not any slider's step — the Hz sliders
themselves still step by 0.01, which is what arrow keys and the wheel move by.

The grid is finer than the sliders because BOTTOM G's does not write Hz directly:
it solves `Hz = √(9810·g / rideHeight_mm) / 2π` from a g target whose slider steps
by 0.01 g. That map is `Hz ∝ √g`, so `dHz/dg = Hz/2g` and one g step is worth less
and less Hz as the target rises — roughly 0.007 Hz at 1 g and 0.002 Hz at the stiff
end of the range. On the old 0.01 Hz grid most of those steps rounded to the value
they started from, so several consecutive g steps changed nothing. 0.001 Hz is
finer than any step that slider can take at any ride height.

The secondary axle is unaffected either way: `rearHzMan` and `rearHzMult` are
clamp-only in `sanitizeTune`, so a derived secondary Hz carries full precision. In
BeamNG both axles are re-derived from the snapped spring rate anyway
(`PHYS_SNAP.spring`), which is coarser than either grid.

## Spring rate (`solveSpring`)

```js
solveSpring(hz, mass, mr) = (hz*2π)² * mass / mr² / LB_IN_TO_NM
```

Standard `k = m·ωₙ²` spring-rate-from-natural-frequency relationship
(`ωₙ = hz*2π`), divided by motion ratio squared (`mr` — always `1` in this
app's calls, since Forza's displayed spring rate is wheel-rate, not
suspension-lever-rate) and converted from N/m to lb/in via
`LB_IN_TO_NM = 175.126790921` (the constant is N/m per lb/in, despite the name).

Springs are the one output that was never click-based, which is why the
physical-unit game mode below needs no change to this solve at all — only the
display conversion differs.

## Damper clicks (`solveDampRaw` + `computeTune`'s `clampDamp`)

```js
criticalDamping(hz, mass) = 2 * sqrt((hz*2π)² * mass * mass)   // cc, the ζ=100% reference
solveDampRaw(hz, mass, z) = criticalDamping(hz, mass) * (z/100) * DAMPING_CALIBRATION
```

`z` is the damping ratio (ζ) as a percentage (>100% = overdamped, allowed
because some Forza dampers support it) — 10-200% for Rebound ζ, 10-115% for
Bump ζ. `DAMPING_CALIBRATION = 0.00135` is
the empirically-validated N/mm/s → lbf/ft/s conversion (see the Calibration
constants table above).

`solveDampRaw` is deliberately unclamped. `computeTune` solves all four
values from it, then scales front and rear together (`dampScale`) so the
pair fits the game's click limit without losing their ratio, and only then
applies the `1..lim` bound per value (`clampDamp`). Clamping before scaling
would distort the front/rear relationship, which is why there is no
clamping single-value helper — a `solveDamp` that did its own clamp existed
once but had no callers left and was removed. `tests.js` still mirrors that
older shape; see the note above its copy there.

### `impliedZeta` — back-calculating ζ from the final click value

```js
impliedZeta(v, hz, mass, calib) = v * 100 / criticalDamping(hz, mass) / calib
```

The exact inverse of `solveDampRaw`. Once `rebF`/`rebR`/`bumpF`/`bumpR` are
solved (scaled and clamped to `1..lim.damping`, then 0.1-click rounded),
`computeTune` reassigns `zetaF`/`zetaR`/`bumpZetaF`/`bumpZetaR` by running
each final click value back through `impliedZeta` — so everything
downstream of that point (`settleF`/`settleR`, the output cards' ζ%
sub-labels, `bDampBias`) describes the damping the *displayed* click value
actually produces, not the pre-clamp target that was originally solved
for. Same treatment `rsAbF`/`rsAbR` already get for ARB (recomputed from
the clamped click values rather than the pre-clamp roll-stiffness target,
"so the balance bar shows what the game will really do").

Because `solveDampRaw` is linear in `z`, a uniform proportional scale-down
(`dampScale`) applied to the raw value is mathematically identical to
scaling ζ itself by the same factor — so front and rear converge on the
*same* implied ζ when they were clamped from the same target, even though
their Hz/mass differ and their final click values differ. A car requesting
115% ζ on both axles but hitting the 1–20 click ceiling might show 18.1/20.0
clicks and **17%** ζ on both — a large, meaningful gap from the nominal
115% target, not rounding noise. In the unclamped case this is a no-op
beyond ~0.1-click rounding.

## Physical-unit output (`beamng` game mode)

Both Forza modes express springs, dampers and ARBs as abstract "clicks" on a
fixed `1..N` scale, because Forza hides its real internal units — that is what
`DAMPING_CALIBRATION` and `ARB_RS_SCALE` exist to bridge. BeamNG builds its
tuning sliders per-vehicle from the car's Jbeam `variables` block, so there is
no universal scale to calibrate against and inventing a third click range would
mean inventing a constant with nothing to validate it.

Instead `GAME_LIMITS.beamng = {damping:null, arb:null, physical:true}` marks a
mode that **skips the click-compression step** and emits what the solver already
works in. `computeTune` branches on `isPhysical(gameMode)`, never on the mode
name, so a future physical-unit game costs one `GAME_LIMITS` entry.

**Units are taken from BeamNG's own tuning sliders**, verified against a screenshot
of a stock vehicle's defaults. They are not the most conventional SI spellings and
must not be "tidied":

| Output | Forza | BeamNG slider | Bridge |
|---|---|---|---|
| Spring Rate | lb/in | **N/m** (*not* N/mm — a 1000× error) | the solve is identical; `LB_IN_TO_NM` is already N/m per lb/in |
| Bump/Rebound Damping | 1..`lim.damping` clicks | **N/m/s** (≡ N·s/m) | `solveDampRaw`'s `calib` argument: `DAMPING_CALIBRATION` or `1` |
| Anti-Roll Spring Rate | 1..`lim.arb` clicks | **N/m**, a *linear* rate | `clk()` skipped, then `k = 2·rs/track²` at the display layer |

`cc = 2·√(wr·mass)` has units kg/s ≡ N·s/m, so `cc·(ζ/100)` is a genuine damping
coefficient — the same quantity BeamNG's damping variables hold. No new empirical
constant is introduced anywhere in this path.

Note the ARB conversion changes *kind*, not just scale: the solver's currency is
torsional roll stiffness (N·m/rad) while BeamNG asks for a linear rate. The
inversion of `rs = k·track²/2` is the same relationship the spring side already
uses. `fe.arbMan{F,R}` is always **stored** as roll stiffness; the N/m a user sees
and types in a physical mode is converted at the field boundary only, so the
game-mode migration effect and `computeTune` both stay in one unit.

**The ARB conversion uses the wrong lever arm — known, unfixed.** BeamNG's linear
anti-roll rate is specified at the *bar's own lever*, not at the wheel, and reaches
roll stiffness through that lever squared: the BeamNG forum gives it as *"the
stiffness you get would equal the beamSpring you put in multiplied by length of the
arm to the power of 2,"* alongside a warning that the motion ratio means real-life
values don't transfer. `k = 2·rs/track²` implicitly assumes the arm **is** the full
track — i.e. that the bar acts at the wheels. A real bar attaches inboard, so its
arm is shorter and the required N/m is higher by `(track/arm)²`. This is why the
output measures 4–6× soft against a stock vehicle; the intended fix is an ARB motion
ratio input mirroring the spring one, `k = 2·rs/(track²·mr²)`. Two things remain
unknown and are not guessed at: the exact coefficient (`k·arm²` vs `2·k·arm²`) and
any given vehicle's arm length. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the full
derivation, the eliminated hypotheses, and the deferred fix.

**Snapping to BeamNG's slider increments.** Confirmed in-game (not guessed):
Spring Rate snaps to the nearest 500 N/m, Anti-Roll Spring Rate to the nearest
1000 N/m, Bump/Rebound Damping to the nearest 100 N/m/s. These live in
`PHYS_SNAP` beside the calibration constants.

This is BeamNG's counterpart to Forza's click grid, and `computeTune` treats it
the same way. **The snap happens at the output boundary, and the physics the app
reports is then derived from the snapped value** — not from the pre-snap target:

| Snapped | Re-derived from it |
|---|---|
| spring rate (500 N/m) | `fHz`/`rHz`, and through them `rsSpF`/`rsSpR`, the ARB budget, `rollDeg`, settle times |
| rebound/bump (100 N/m/s) | `zetaF`/`zetaR`/`bumpZetaF`/`bumpZetaR` via `impliedZeta`, and `settleF`/`settleR` |
| anti-roll rate (1000 N/m) | `rsAbF`/`rsAbR`, and through them `mechBalance`, `bAb`, `bTot`, `arbShare` |

The reason is the same one that made Forza back-calculate ζ from its clamped
click values: this app is a starting-point calculator whose numbers get typed
into a tuning menu, so the figure printed next to an output row has to describe
the tune the user can actually dial in. A front spring printed as `45500 N/m`
beside `1.75 Hz` was previously a small lie — 45500 N/m gives 1.7476 Hz on the
default chassis, and 1.75 Hz needs 45627 N/m, a rate the slider cannot hold.

Springs are the one place BeamNG snaps where Forza does not: Forza's spring
input is fine-grained enough that the pre-snap Hz *is* the Hz you get, so
`solveSpring`'s result flows through untouched there. Ordering matters — the
spring snap runs before the damper solve and before `rsSpF`/`rsSpR`, so a single
forward pass leaves everything downstream consistent with no second solve.

Two things deliberately do **not** snap:

- **ARB `MAN`.** It is a value the user typed rather than one the solver chose,
  and Forza's `MAN` likewise bypasses `clk()`'s own 0.1-click rounding.
- **`warnOver`/`arbCtx`.** Both are still called with the raw pre-conversion `v`
  at every call site, not `o.value`, so ceiling warnings and the
  LOW/MED/HIGH/MAX badge key off the unrounded number.

The rounding in `springOut`/`dampOut`/`arbOut` remains in place and is now
normally a no-op re-application of a snap already performed upstream. It is kept
because it is the last thing between a raw coefficient and the UI, and the paths
that do not run through `computeTune` — TUNE CHECK, the ARB `MAN` field's own
round-trip — still land there.

### Motion ratio

Forza's tuning screen displays **wheel rate**, which is what `solveSpring` produces
(`mr` is always 1 at its call sites). BeamNG's sliders act at the **spring and
damper**, so an inboard spring must be stiffer by `1/mr²` to give the same wheel
rate. `ch.motionRatioF`/`motionRatioR` (PRO CHASSIS, physical modes only, default
1.0) apply that correction.

`ch.arbMotionRatioF`/`arbMotionRatioR` (same range, same default) do the same job
for the anti-roll bar, whose arm is the drop link rather than the spring mount:
`k = 2·rs / (track · mr)²`. At the default 1.0 the bar is assumed to act at the
wheels, which is why the untouched output reads low — see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the research behind the figure.

It is applied **at the display layer and deliberately not in `computeTune`**. Hz,
roll stiffness, mech balance and every handling-balance figure are wheel-rate
quantities and must not move when a motion ratio is entered — only the number you
type into the game changes. `tests-beamng.js` asserts that invariant directly.

That invariant is why `snapPhys` snaps in **wheel-rate space, with no motion-ratio
term**, even though the grid physically belongs to the post-`mr²` number on the
slider. Letting `mr` choose the snap point would make Hz and the balance bar shift
when a motion ratio is entered, which is exactly what the invariant forbids. The
cost is a corner case at `mr ≠ 1`: the printed value is snapped a second time by
the output helper *after* the `/mr²` division, so it can sit up to half a step away
from the rate the reported physics describes. At the default `mr` of 1.0 the two
coincide exactly, so this only affects tunes that opt into the advanced field. See
[HISTORY.md](HISTORY.md).

BeamNG does not expose motion ratio, and it differs per vehicle *and* per axle, so
it cannot be derived — only entered. Left at 1.0 the output is the wheel rate.

Three consequences worth knowing:

- **Nothing is clamped or floored, and none of Forza's quantisation applies.**
  `dampScale` has *two* branches (it scales up when the softer damper falls below
  1 click, not only down at the ceiling); both are bypassed, as is `clampDamp`'s
  0.1-click rounding. Physical modes are not unquantised, though — they snap to
  BeamNG's own grid instead, as described above.
- **Balance figures differ slightly from Forza for identical inputs.** Forza
  deliberately recomputes `rsAbF`/`rsAbR` back out of the *rounded, clamped*
  click values, so the balance bar reflects what the game will really do with the
  numbers you type. Physical modes have no quantisation to model, so the ARB
  budget flows through untouched. This is correct, not drift.
- **BASIC ARB stiffness is unavailable.** Its budget is defined as a percentage
  of the click ceiling (`1 + (lim.arb-1)·pct/100`), so it has no meaning without
  one. AUTO, ROLL ° and SHARE % are unaffected.

CO-SOLVE's Auto Spring Share normalises spring and ARB utilisation against
`lim.arb`. Because the same denominator divides *both* sides of its comparison,
it cancels — physical modes substitute a nominal `ARB_UTIL_REF = 65` and reach
the identical `S`. The one place it does not cancel is the `Math.min(1, …)`
saturation on the spring side, which is why the constant is pinned to Horizon's
value rather than being arbitrary. `tests-beamng.js` asserts the equivalence
across a 21-point Mech Balance Target sweep.

## Damping Balance Mode: equal-metric ζ split (`balancedZetas`)

`settleZetas` generalizes into `balancedZetas(rideRef, wF, wR, refZeta,
biasMult)`, which holds `ζ·w` equal between axles at `biasMult=1` for
whatever per-axle weight `wF`/`wR` the caller passes:

```js
balancedZetas(rideRef, wF, wR, refZeta, biasMult):
  rideRef==='rear':   zR = refZeta;               zF = refZeta * (wR/wF) / biasMult
  rideRef==='shared':  avg=(wF+wR)/2; b=sqrt(biasMult)
                       zF = refZeta * (avg/wF) / b;  zR = refZeta * (avg/wR) * b
  rideRef==='front' (default): zF = refZeta;      zR = refZeta * (wF/wR) * biasMult
```

The reference axle (whichever the Ride Stiffness slider anchors) holds
`refZeta` exactly; the other axle's ζ is derived so both axles reach the
held-equal metric at `biasMult=1`, then skewed by `biasMult =
2^(-dampingBias/50)` — moving the Damping Bias slider toward REAR (positive
displayed value) shifts weight onto the rear regardless of which axle is
the reference. The sign is inverted because the slider stores
`-dampingBias` as its displayed value, matching every other bias slider's
FRONT/REAR convention.

`refZeta` itself is **REBOUND MODE's** job, independent of Damping Balance
Mode: CHARACTER passes `reboundZeta` (typed directly); SETTLE TIME instead
back-solves it from the Settle Target at the ride-reference axle's Hz via
`2.302/(settleTarget·refHz·2π)*100`, clamped to **100%** (critical damping)
rather than the slider's full 200% ceiling — critical damping is the fastest
possible settle (see `settleTimeFromZeta` below), so an unreachable target
stops there instead of overshooting into overdamped territory where a higher
ζ actually settles *slower*. This combined value is `baseZeta` in
`feelToPhysics`. Whichever REBOUND MODE is active,
Damping Balance Mode then does the exact same split from that one number:

- **`settleZetas(rideRef,fHz,rHz,refZeta,biasMult)`** — holds *real* settle
  time equal between axles. Used by SYNC, under either REBOUND MODE. Ignores
  corner mass. Solves in rate-space via `dampRate`/`rateToZeta` (the same
  piecewise rate `settleTimeFromZeta` uses below), not a naive `ζ·Hz`
  constant — that naive version is only correct while both axles stay
  underdamped, and quietly stops meaning "equal settle time" the moment a Hz
  mismatch, a Damping Bias skew, or a high Rebound ζ/Settle Target anchor
  pushes either axle past 100% ζ. Falls back to critical damping (100%) on
  the derived axle when its Hz is too low to ever reach the reference's real
  settle time no matter how hard it's damped. Reduces to the exact old
  linear formula whenever both axles stay underdamped, which is true of
  most tunes — this is a from-scratch physical fix, not a behavior change,
  for the range where it actually diverges.
- **`forceZetas(rideRef,mF,fHz,mR,rHz,refZeta,biasMult)`** — `wF,wR =
  mF·fHz, mR·rHz`. Holds actual damping force equal (force ∝ `ζ·m·Hz`, see
  `solveDampRaw` above). Used by EQUAL FORCE (stored as `neutral`), under either REBOUND MODE.
  Corrects for corner-mass asymmetry that SYNC ignores.
- **HYBRID** (SYNC sub-mode) — `balModeZetas` averages the `settleZetas` and
  `forceZetas` results per axle. Both hold the anchor axle at `refZeta`, so
  the mean does too.
- **STANDARD** doesn't call either — it biases `baseZeta` directly by
  percentage, independent of Hz or mass entirely, under either REBOUND MODE.
  The ride-reference axle (`rideRef`) holds `baseZeta` exactly regardless of
  Damping Bias direction; the other axle swings by `dampingBias/100` (halved
  to `dampingBias/200` per side under `rideRef==='shared'`, so neither axle
  is a fixed anchor). Before this, the exact-anchor axle flipped with the
  Damping Bias slider's sign rather than following Ride Reference at all.

Under SETTLE TIME, only SYNC guarantees *both* axles hit the target time —
STANDARD/NEUTRAL still anchor the reference axle to it exactly, but the
other axle's real settle time is whatever that mode's split produces (`
tune.settleF`/`settleR` report the honest achieved values either way, not
a claim of equality).

### The bump stroke gets the same split

Everything above describes the *rebound* anchor. The bump stroke is split
front/rear by the same Damping Balance Mode, and how it gets there depends
on BUMP MODE:

- **BUMP RATIO** needs no extra work. Bump ζ is one percentage of rebound
  ζ, so scaling both `zetaF` and `zetaR` by `bumpRatioVal/100` carries
  whatever split the balance mode already solved straight onto bump.
- **INDEPENDENT** has no such link — the typed `fe.bumpZeta` is an anchor
  in its own right, not a function of rebound. So under the SYNC methods it is
  run through the *same solver a second time*, with the typed value as
  `refZeta` and the same `biasMult`. `balModeZetas(mode, …)` exists for
  exactly this: it picks `forceZetas` or `settleZetas` by mode, so the two
  anchors cannot drift apart. Under STANDARD the typed value is biased by
  percentage the same way `baseZeta` is.

Both splits clamp to 10–200%. Bump is deliberately **not** clamped to the
axle's own rebound ζ: crossing above rebound is a warned-but-allowed state
everywhere else (the slider reaches 115% and the readout says `⚠ CROSSED`),
so clipping it here would contradict the rest of the app.

Before this, INDEPENDENT under SYNC/NEUTRAL did the opposite of both rules —
it fed the same typed ζ to *both* axles and then clipped each to that axle's
rebound ζ. See [HISTORY.md](HISTORY.md).

**`settleTimeFromZeta(zetaPct,hz)`** computes the displayed `settleF`/
`settleR` (and, inverted, the SETTLE TIME back-solve above) from ζ and Hz.
It's piecewise on ζ because the 10%-envelope decay rate isn't `ζ` once ζ
passes 100%:

- **Underdamped (ζ≤100%)**: the envelope's *exponent* is exactly `-ζωn·t`,
  so `rate=ζ` and `t=2.302/(ζ·ωn)` (`2.302=ln10`). Note this drops the
  envelope's `1/√(1-ζ²)` amplitude factor, so it is a simplification of the
  standard envelope formula rather than an exact settling time — see
  *What this formula is, and is not* below.
- **Overdamped (ζ>100%, reachable up to the 200% slider max)**: response is
  governed by the *slower* of two real poles, `rate=ζ-√(ζ²-1)`, which falls
  as ζ climbs past 100%. Critical damping (ζ=100%) is the fastest possible
  settle in this model; pushing ζ higher makes it settle more slowly
  (sluggish), not faster. The single-branch `rate=ζ` formula used before
  this got that backwards — it kept reporting shorter settle times as ζ
  rose past 100%, and the SETTLE TIME back-solve would chase a fast target
  by pushing ζ past 100% (up to the old 200% clamp), which actually made
  the real settle time *worse*. Both are now piecewise-correct.

### What this formula is, and is not

It is a **simplified decay envelope**, and the gap between it and settling
time proper — "the last time the response leaves a ±10% band" — is worth
being precise about, because the two are not close everywhere.

The free decay modelled here (x(0)=1, v(0)=0) is algebraically the step-
response **error** signal of a prototype second-order system, so textbook
settling-time results transfer directly. The true underdamped response is

    x(t) = e^(-ζωn·t)/√(1-ζ²) · sin(ωd·t + acos ζ)

whose envelope carries a **1/√(1-ζ²)** amplitude factor. The standard
envelope-based settling time keeps it — `t = -ln(0.1·√(1-ζ²))/(ζωn)` for a
10% band — and that version *is* a genuine upper bound on the real settling
time. `settleTimeFromZeta` drops the factor (`t = -ln(0.1)/(ζωn)`), which
leaves it neither an upper nor a lower bound: against the exact trace at
1.4 Hz it runs **long** below ζ≈79% (0.582s vs 0.546s at ζ=45%) and
**short** above it (0.262s vs 0.442s at ζ=100%, a 41% underestimate — the
critically damped response carries a `(1+ωn·t)` factor the plain
exponential ignores). The overdamped branch is short for a similar reason:
the slow pole's residue exceeds 1, so `rate=ζ-√(ζ²-1)` gets the exponent
right but not the amplitude (0.977s vs 1.009s at ζ=200%).

That is acceptable for what it feeds — a per-axle spec figure, and the
SETTLE TIME back-solve, which only has to invert *consistently* — but it is
why the VISUALS DYNAMICS chart does **not** use it for its dashed settle
markers. That chart measures settle with `measureSettle` (`curveSettle`
over the plotted `computeOscillation` points) (last sample pair straddling |x|=0.1,
interpolated), which lands within ~1-2% of the closed-form answer and also
picks up the rebound/bump ζ alternation `settleTimeFromZeta` cannot see —
it takes rebound ζ only. So the chart's readout sits **above** the DAMPERS
figure past ζ≈79% and below it under that; both are correct for what they
measure, and the chart's hint says so.

The DAMPERS summary shows both side by side: **SETTLE** is the analytic
figure (what SETTLE TIME mode targets), **MEAS** is `measureSettle`'s
bump-aware figure, identical to the chart's. Beside them, **AVG ζ** is
`(rebound ζ + bump ζ)/2` per axle — an asymmetric damper removes roughly as
much energy per cycle as a symmetric one at the mean, so it approximates how
damped the car is overall. It is informational and uncoloured on purpose: it
hides which stroke comes first, and whether softer bump helps depends on
surface (see KNOWN_ISSUES on bump damping in the RESPONSE bar), so it must
not read as a verdict. Rebound ζ 59% at Bump Ratio 60% reads ≈47%, not 59%.

### "Critical damping is the fastest settle" is true of the envelope only

The bullets above are right that within this envelope model the decay rate
peaks at ζ=100%. The real ±10%-band settling time does **not**: it is
minimised at **ζ≈59.1%**, where the first overshoot peak stops clearing the
band (`e^(-πζ/√(1-ζ²)) = 0.1`). At 1.4 Hz the exact settling time steps from
0.456s at ζ=59% to 0.267s at ζ=60%, then climbs steadily to 0.442s at
ζ=100% — critical damping is about **1.65× slower** than the true optimum.
The same algebra reproduces the classic ζ≈0.78 optimum for a 2% band, which
is the standard check on this result.

Two consequences worth keeping in view, neither of them addressed here:

- The settling-time-vs-ζ curve is genuinely **discontinuous** at ζ≈59.1%,
  so the DYNAMICS marker jumps between ζ=58% and 60%. That is the metric,
  not the integration.
- SETTLE TIME Rebound Mode clamps its back-solve at ζ=100% on the stated
  grounds that critical damping is "the true fastest achievable". That
  holds inside the envelope model it inverts, and is self-consistent, but
  against the real response an aggressive target would be better served
  near ζ≈59% than at 100%. See [HISTORY.md](HISTORY.md).

`computeTune` re-runs whichever SYNC method is active a second time
after CO-SOLVE resolves `effectiveRHz`, so the settle-time or force split
matches the *post*-CO-SOLVE rear Hz rather than the pre-solve value
`feelToPhysics` saw. It runs under **either** REBOUND MODE, including
SETTLE TIME, and anchors to `baseZeta` — not the raw `reboundZeta` slider —
so the settle-time guarantee survives a CO-SOLVE rear-Hz shift. (What is
still pre-solve under SETTLE TIME is `baseZeta`'s own back-solve, which
used the pre-CO-SOLVE reference Hz; a scope limit, not a skipped pass.) The
INDEPENDENT bump anchor is re-split in the same pass, off the same
`effectiveRHz`, so the sidebar preview and the exported tune agree.

## Rear/secondary Hz modes

`fe.rearHzMode` picks which of these derives the non-anchored axle's
frequency (dispatch lives in `feelToPhysics`):

- **FLAT RIDE** (`flatRideRearHz` / `flatRideSharedHz`)
  — solves the rear (or, in `shared` ride-ref mode, both axles from an
  average) so front and rear wheels hit the same bump in phase at the
  target speed, cancelling pitch. The rear wheel arrives `t = wheelbase/speed`
  seconds later, so the rear is stiffened by exactly that much period:

  ```js
  1/rearHz = 1/frontHz − t        // ONE traverse time, not two
  ```

  `flatRideSharedHz` inverts the same relationship as a quadratic to solve
  for `fHz` when the slider represents the *average* of both axles rather
  than the front alone — `t·fHz² − fHz·(2 + 2·avg·t) + 2·avg = 0`, smaller
  root. Both are disabled at and above 200mph (they return the input frequency
  unchanged, which is what makes 200 read as flat-ride OFF on the Target Speed
  slider — see [SLIDERS.md](SLIDERS.md)). Below 1 m/s the relationship goes
  numerically unstable and each falls back differently: `flatRideRearHz` returns
  `fHz*1.2`, while `flatRideSharedHz` splits the average as `fHz = avgHz/1.1`
  with the rear taking the remainder. This section quoted the first figure for
  both until an audit separated them.

  The offset was `2·t` until it was checked against real flat-ride practice.
  Olley stated the rule as front natural **frequency** ≈ 80% of rear (rear
  ≈ ×1.25); the commonly published practical band is rear 10–20% above front.
  Every ratio in this section is a **frequency** ratio, never a spring-rate
  one — rate goes as Hz², so ×1.20 in frequency is ×1.44 in rate. The doubled
  offset gave far more, and got worse the harder you tuned:

  | | old (`2t`) | now (`t`) |
  |---|---|---|
  | stock chassis, 70 mph | ×1.43 | ×1.18 |
  | 2.5 Hz front, 70 mph | ×1.76 | ×1.28 |
  | 3.0 Hz front, 70 mph | ×2.07 (hit `HZ_MAX`) | ×1.35 |
  | stock chassis, 30 mph | ×3.39 | ×1.54 |

  FLAT RIDE **was** the default Hz mode when this bug was found, so it was
  also the app's out-of-box state: a fresh install put the rear axle in the
  RACE band while the front sat in ROAD, and the handling balance bar read
  **+14.9 oversteer** before the user touched anything. `tests.js` pins the
  ratio at two speeds and two stiffnesses so the doubling cannot silently
  return. The default has since moved to MULTIPLIER (below) — see
  [HISTORY.md](HISTORY.md) for both behaviour-change notes.

  **Two limits worth knowing before relying on this mode:**

  1. **The precondition isn't checked.** Olley's flat-ride result only holds
     when the vehicle's pitch dynamic index is close to 1
     (`k² ≈ a·b`, where `k` is the sprung mass's radius of gyration in pitch
     and `a`/`b` are the CG-to-front/rear-axle distances) — that's what lets
     front and rear be treated as two independent one-DOF systems in the
     first place. SUSP.OS has no pitch-inertia input and never tests this;
     the per-axle rule is applied unconditionally. For a car whose weight is
     unusually concentrated away from the axles (heavy overhangs, mid-engine
     packaging), the underlying assumption may not hold and the "ideal"
     ratio is less meaningful than the formula implies.
  2. **The ratio is only exact at one speed.** Marzbani and Jazar's analysis
     found that a fixed front/rear frequency ratio cancels pitch fully at one
     vehicle speed — the flat-ride condition is inherently speed-dependent,
     not a constant a passive suspension can satisfy everywhere at once.
     This is the reason Target Speed is a control here rather than a single
     baked-in multiplier, and it's a genuine advantage over a fixed ratio —
     but it also means the "ideal" framing only applies near whatever speed
     you've set. Outside a car's chosen Target Speed the cancellation
     weakens by design, not by a bug in the app.

  Sources: Maurice Olley's original flat-ride criteria; Marzbani et al.,
  *"Flat Ride; Problems and Solutions in Vehicle"* (*Nonlinear Engineering*
  1(3–4), 101–108, doi:10.1515/nleng-2013-0002); Crolla & King, *"Olley's
  'Flat Ride' Revisited"* (Vehicle System Dynamics 33(sup1), 762–774, 1999).
  That last title was credited here to Sharp & Pilbeam until it was checked —
  their related paper is *"Achievability and Value of Passive Suspension
  Designs for Minimum Pitch Response"* (1993). Also: Penske Racing Shocks,
  *"Natural Frequency, Ride Frequency, and CPM in Race Car Suspension"*;
  Race Comp Engineering, *"Spring Rates Part 2: Suspension Frequencies."*

  Practically: if the RIDE section's flat-ride advisory banner appears
  (ratio above ×1.25), raise Target Speed or lower Ride Stiffness — see
  [SLIDERS.md](SLIDERS.md).
- **MULTIPLIER** (the fresh-install default) — `rearHz = frontHz *
  fe.rearHzMult` (or the inverse split for `shared` ride-ref) — a fixed
  ratio, no chassis math involved.
- **INDEPENDENT** — `fe.rearHzMan` used directly, fully decoupled.
- **MECH** (PRO only) — solves the secondary axle's Hz so that, combined
  with whatever ARB balance mode is active (WEIGHT/ROLL/SHARE/MANUAL each
  contribute a different ARB roll-stiffness fraction that dilutes the
  spring-only correction), the resulting roll-stiffness rear fraction hits
  `resolveArbBalTarget`'s target exactly. This is the most complex branch
  in the file — conceptually it's "given the ARB's
  fixed contribution, what spring Hz ratio makes springs+ARBs sum to the
  target," solved differently depending on whether the ARB budget is a
  roll-stiffness fraction (WEIGHT/SHARE) or an absolute value (ROLL/MANUAL,
  the latter solved via a quadratic in `mult_man`).
- **SHARED** — only offered when `rideRef==='shared'` *and* the STIFFNESS
  toggle is BOTTOM G's (see [BOTTOM G's stiffness mode](#bottom-gs-stiffness-mode)
  below); selecting it any other way (a hand-edited share code, say) falls
  through to FLAT RIDE, same as INDEPENDENT does outside `shared` ride-ref.
  Where MULTIPLIER/MECH/FLAT RIDE all pick a front/rear **Hz ratio**, SHARED
  instead solves front and rear Hz so both axles bottom out at the
  **identical g** — the two axles can have very different ride heights, so
  an equal-Hz or flat-ride ratio does not generally mean an equal bottom-out
  g. Given `avgHz` (what the Avg Bottom-Out slider represents) and each
  axle's own ride height:

  ```js
  frontHz = avgHz * sqrt(rhAvg_mm / rhF_mm)
  rearHz  = avgHz * sqrt(rhAvg_mm / rhR_mm)
  ```

  Substituting back into `bottomG = rideHeight_mm·(2π·hz)²/9810` collapses
  both axles' g to `rhAvg_mm·(2π·avgHz)²/9810` — exactly the value the Avg
  Bottom-Out slider already shows — so the slider target *is* the shared
  bottom-out g, not just an average of two different numbers. Clamped to
  `HZ_MIN`/`HZ_MAX` per axle same as the other modes.
- **CO-SOLVE** (PRO only — the branch in `feelToPhysics`, plus the main
  solve in `computeTune`) — solves rear Hz *and* ARB split together, with
  `fe.springShare` controlling how much of the balance correction comes
  from springs vs ARBs. `Kcs = rHz/fHz` is derived once from the chassis,
  target, and spring share, then the ride-reference axle's slider is
  inverted through `Kcs` so the *other* axle's Hz stays correct regardless
  of which axle the user chose to anchor.

  Both MECH and CO-SOLVE (and the CO-SOLVE `Kcs` pre-inversion) convert the
  absolute `resolveArbBalTarget`/`arbBalTarget` reading into a *physical*
  roll-stiffness target the same way: subtract `tireCorr` (tyre-width) and
  `natOffset` (`natOffsetOf(ch)`) before it enters any ratio-inversion
  math, then add both back on the reported `mechBalance`. `natOffset` is 0
  unless MEASURE NAT BAL is on; then it is the measured reading minus the
  geometric track-width/mass estimate **minus `tireCorr`**. The measured
  value is read off Forza's display, which already includes the tyre-width
  effect, so leaving `tireCorr` inside `natOffset` counted it twice on any
  car with different front/rear tyre widths.

  These targets are in suspension space. In the Forza modes the reported
  balance is the tyre-series display, so `solveTune` adjusts the target these
  solvers receive until the displayed balance meets the user's — see
  [Tyres in series](#tyres-in-series-with-the-suspension-displayrsbalance).
  Without this, a MEASURE NAT BAL reading that differs from the geometric
  estimate made every one of these solvers "correct" a gap that wasn't
  real, even when the Balance Target sat exactly on the measured NAT (0
  bias). See [HISTORY.md](HISTORY.md) for the full incident and
  all four sites this touched (`resolveCoSolveSpringShare`'s `R_baseline`,
  the CO-SOLVE `Kcs` pre-inversion's `Rbl`, `computeTune`'s ARB-split
  `_mechTgt`/`mechBalance`, and MECH's own `rsBalTgt`).

  **Auto Spring Share** (`fe.springShareAuto`, the default) picks `S`
  itself instead of taking it from the slider: `resolveCoSolveSpringShare`
  binary-searches `S ∈ [0,1]` for the point where spring utilisation equals
  ARB utilisation. Both are expressed in the same currency so the
  comparison is meaningful — spring utilisation is the incremental rear
  roll-stiffness the spring correction is carrying (relative to its `S=0`
  baseline), converted through the same `arbScaleOf(ch)·track²` relationship
  real ARB clicks use, then scaled 0..1 against `lim.arb`: "how many ARB
  clicks would this same physical correction have cost, had bars done it
  instead." ARB utilisation is the heavier bar's clicks against `lim.arb`,
  **or** — since a lopsided split can just as easily want an axle *near
  zero*, which the game's 1-click floor then rounds up to real stiffness
  the split never asked for — `1/max(0.05, lighter bar's clicks) - 1`,
  whichever is larger. That floor term is unbounded the same way ceiling
  overshoot already is, so wanting an axle below the floor counts as
  "ARB is maxed" too, instead of reading as comfortable slack and leaving
  the search parked on a small `S` that the real click floor then quietly
  undermines. Whichever side is cheaper for a given `S` absorbs more of the
  correction, and the search converges on the split where neither is
  disproportionately stressed. A prior version compared Hz distance against
  the game's Hz range instead — see [HISTORY.md](HISTORY.md) for
  why that mismatch left AUTO pinned at 100% spring / 0% ARB in almost
  every real case; a later fix (also documented there) is the floor term
  above, for the opposite failure — AUTO understating how much correction
  springs needed to take on when the Balance Target sat far from a
  MEASURE NAT BAL reading.

  Note that only spring Hz feeds the RESPONSE/transient breakdown
  (`responseFactors` — Hz F and Hz R together are 55% of that score); ARB
  clicks feed only the steady-state balance bar (`bAb`). So for the same
  target, more of the correction landing on springs vs ARBs changes how much
  the fix also shifts PLANTED↔REACTIVE character as a side effect, not just
  which numbers move.

### When the band clamp is reported (`physics.rearHzClamped`)

Every mode above clamps its solved frequencies into `HZ_MIN..HZ_MAX`. One flag,
`rearHzClamped`, says whether that clamp actually bit, and it drives three things:
the amber banner under the RIDE rows, the matching `warnBox` in the output panel,
and the `CLAMPED`/`⚠` markers on the Hz readouts.

The name is historical — it means **the derived axle was clamped**, not
specifically the rear. Under a REAR ride reference the derived axle is the front,
and under SHARED both are solved together, so the banner names the axle it is
actually talking about rather than always saying "Rear".

Which modes can raise it:

| Mode | Raises the flag? |
|---|---|
| FLAT RIDE | yes — the solve genuinely runs out of band |
| MECH | yes |
| SHARED | yes |
| MULTIPLIER | yes — under a FRONT/REAR reference when the ratio throws the derived axle out of band, under SHARED when it throws one end of the split out |
| INDEPENDENT | no — the field itself is already clamped on entry |
| CO-SOLVE | no — forced false, since `mechBalClamped` covers its limits instead |

Two gaps here were closed together, both of which made the flag lie rather than
merely under-report. Under a REAR reference the assignment step discarded the
derived axle's clamp entirely and hard-set the flag false, so a front axle floored
at `HZ_MIN` — ordinary with inverse FLAT RIDE at a low Target Speed — reported
nothing at all. And in the SHARED multiplier and MECH paths `frontHz` carried only
a `HZ_MIN` floor with no ceiling, so a multiplier below 1.0 printed a front Hz
*above* `HZ_MAX` with no marker, while the multiplier path separately reported
`clamped:false` unconditionally and hid a rear pinned at the ceiling. All three
SHARED sites now share one `splitAvgHz` helper that clamps both axles and reports
off the raw values — which also means a solve landing exactly *on* a bound no
longer reports itself as clamped. See [HISTORY.md](HISTORY.md).

### Anti-roll bars at a click limit

In the Forza modes a bar that wants past `lim.arb`, or below the 1-click floor, is
pinned there and the **other** bar is re-solved so the roll-stiffness balance,
`(rsSpR+rsAbR)/rsTotal`, stays where the unclamped split put it. Scaling both bars
by one factor, as `dampScale` does for dampers, would not keep it: the springs'
share doesn't scale with the bars. Total bar stiffness moves instead, and ROLL °/
SHARE % report that through `rollClamped`/`shareClamped`. When the re-solved bar
also hits a limit the balance can't be held, and lands as close as the limits
allow. MAN is untouched (a typed value), and the physical modes have no ceiling.

## RESPONSE / transient character (`responseFactors`)

A feel score, not a physical output — nothing downstream consumes it, and it
is deliberately kept separate from the US/OS balance bar. Weights sum to 1:

| term | weight | source |
|---|---|---|
| Hz F | 0.35 | front ride frequency, normalised over `HZ_MIN`–`HZ_MAX` |
| Hz R | 0.20 | rear ride frequency, same normalisation |
| TOE F | 0.15 | front toe, −0.20° (reactive) to +0.20° (planted) |
| DAMP F | 0.12 | front rebound ζ over 10–115%, inverted — less damping reads more agile |
| CASTER | 0.10 | recommended caster over a 3.5° span |
| DAMP R | 0.08 | rear rebound ζ over 10–115%, inverted |

Both damping terms normalise over **ζ 10–115%** — the INDEPENDENT bump ζ input's
clamp, not rebound's own 10–200% range, which is what they actually read. Rebound
above 115% therefore saturates: 120% and 200% score the same. Kept as-is
deliberately. Widening the denominator to 190 would re-slope the term across its
whole range and move the RESPONSE score of every saved build, not just those above
115%, which costs more than the saturation does.

Both damping terms read **rebound ζ only**. That is a deliberate omission, not
an oversight — a bump term was built here and reverted; see the entry in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the full reasoning. The short version:

Bump damping pulls transient feel in two opposite directions depending on
surface. At low shaft speed it resists roll initiation, which reads **planted**.
At high shaft speed it stops the wheel absorbing an impact and deflects the car
instead, which reads **skittish** — the rally/baja case. `bumpZetaF`/`bumpZetaR`
are single low-speed ratios and cannot separate the two, so any sign chosen here
is right on smooth tarmac and wrong on rough ground.

Worth noting the same criticism lands on the rebound terms that *are* here:
heavy rebound packs the suspension down over rough ground for the same reason.
RESPONSE has always been a smooth-surface model. That is an argument for reading
the bar with that in mind, not for compounding it with a second term whose sign
is even less determinable.

Bump *is* fully represented in the VISUALS DYNAMICS chart, which measures the
drawn trace and so takes no position on feel at all. It is likewise absent from
`bDampBias` (the DAMP contributor to the US/OS bar), there because that number
is what the rest of the app is calibrated against — an invented coefficient
would move every saved tune's balance figure.

## Mech balance grip model (`mechBalanceLLT`/`balanceFromRsBal`)

```js
mechBalanceLLT(ch, Kf, Kr):
  sF = Kf/(Kf+Kr)                                          // front's share of roll stiffness
  dWf, dWr = lateral load transfer per axle (elastic + geometric terms, via cornerMasses/rollCenterHeight)
  fy(Fz) = Fz * max(0, 1 - TIRE_LOAD_SENS*(Fz/FzRef - 1))  // tyre grip falls off as load rises above reference
  FyF, FyR = combined outer+inner grip per axle, scaled by tyre width^WIDTH_GRIP_EXP
  return clamp(0, 1, 0.5 + MECH_BAL_GAIN*(FyF/(Mf*g) - FyR/(Mr*g)))
```

This is the *physical at-limit* grip balance (0.5 = neutral, >0.5 =
oversteer-prone), derived from lateral load transfer distribution — a
different model from the roll-stiffness-ratio-based `natMechBalance`
Forza itself displays. `balanceFromRsBal(ch, rsBal)` is the inverse-facing
helper: converts a roll-stiffness rear fraction into the equivalent
`Kf/Kr` ratio and runs it through the same LLT model, used wherever the
UI needs "what grip balance would this roll-stiffness split produce."
`TIRE_LOAD_SENS`, `MECH_BAL_GAIN`, `WIDTH_GRIP_EXP` are in the Calibration
constants table above.

**Balance Guide RANGE.** The PRO Balance Guide's recommended mech-balance
band is a fraction of the gap between `natMechBalance` (NATURAL) and
`1 - balanceFromRsBal(ch, natMechBalance)` (GRIP TARGET — the mech balance
that would fully cancel the chassis's natural grip tendency), not a flat
offset:

```js
gap = (1 - natGripBalance) - natMechBalance
[dlo, dhi] = balanceBandRange(fracLo, fracHi, gap)
lo, hi = natMechBalance + dlo, natMechBalance + dhi   // clamped to 0.20-0.90, hi ≥ lo + 0.03

balanceBandDelta = (frac, gap) => frac <= 1 || gap >= 0 ? frac*gap
                                                        : gap + (frac-1)*(-gap)
balanceBandRange = (fracLo, fracHi, gap) =>
  min/max of balanceBandDelta at fracLo, at fracHi, and at 1 when fracLo < 1 < fracHi
```

`fracLo`/`fracHi` come from a per-layout/build table (`BALANCE_BAND_FRACS`,
read through `balanceBandFracs(layout, build)` in `index.html`) generally in the 0.3-1.0 range, so the band
scales with how understeer/oversteer-prone the specific chassis actually
is instead of recommending a constant push regardless of gap size.
Fractions can exceed 1.0 — DRIFT on all three layouts (1.55 on FWD/RWD, 1.30
on AWD) and RWD DRAG at 1.05 — to intentionally recommend overshooting past
full grip-neutral for sustained rotation.

`balanceBandDelta` is why those two cases are not the same expression.
A fraction at or below 1.0 interpolates from natural toward grip-neutral,
which is a *magnitude* — correct under either sign of `gap`, since it just
under-corrects whatever the chassis already does. A fraction above 1.0 is a
*direction*: "past grip-neutral, into rotation". Multiplying it straight
through as `frac*gap` carries the gap's sign, so on a negative gap the
overshoot pointed at understeer instead — backwards for the only builds
that ask for it. Anchoring the overshoot at grip-neutral and adding
`(frac-1)*|gap|` keeps it aimed at oversteer whatever the sign.

The `gap >= 0` guard is load-bearing, not decoration: the overshoot branch
spells `|gap|` as `-gap`, which is only the absolute value on the branch
that runs it. Writing the helper guard-free as
`frac <= 1 ? frac*gap : gap + (frac-1)*Math.abs(gap)` would be algebraically
identical — for `gap >= 0` the second form reduces to `frac*gap` — but not
*bit*-identical, and the two differ by up to one ULP (~1.1e-16 measured).
Keeping the positive branch on the literal `frac*gap` it has always used
means no existing band can shift, including across the `.toFixed(2)`
rounding boundaries the widget displays.

That makes the delta **V-shaped in `frac` on a negative gap**, bottoming out at
`frac = 1` — grip-neutral. So the band is not simply the two endpoint deltas:
`balanceBandRange` takes the lowest and highest delta over the whole fraction
pair, which for a pair straddling 1.0 (DRIFT on every layout, RWD DRAG) means
including `frac = 1` itself. Taking `min`/`max` of the endpoints alone, as the
sign fix first did, dropped grip-neutral from those bands on every rear-biased
chassis, and the `hi ≥ lo + 0.03` floor then pushed the truncated band further
toward oversteer: AWD DRIFT at 45% front showed 0.457–0.487 when its fractions
only reach 0.430–0.463 (see [HISTORY.md](HISTORY.md)). On a `gap ≥ 0` the delta
is monotonic and `1·gap` sits strictly between the endpoint deltas, so the
extra point cannot move any front-biased band.

The `min`/`max` (rather than a fixed `lo=natMechBalance+fracLo*gap`
assignment) matters for a chassis whose natural balance already sits past
its own grip target, where `gap` goes negative: multiplying a negative gap
by the *larger* fraction (`fracHi`) gives the more-negative delta, so a
fixed assignment put `lo` above `hi` in that case — caught by the
`hi≥lo+0.03` floor, but that collapsed the whole band to a fixed
0.03-wide sliver instead of properly widening on the correct (downward)
side of natural. `min`/`max` picks the right delta for each bound
regardless of `gap`'s sign, so the band keeps scaling correctly there too.
The GRIP GAP sub-widget (tyre-width suggestions to bring GRIP TARGET into
range) computes its band the same way — the same `balanceBandFracs` lookup
and the same `balanceBandRange` call — so the two widgets cannot disagree on
what "in range" means.

**A negative `gap` is ordinary, not an edge case.** Its sign tracks front
weight bias almost exactly. With symmetric tyres and near-equal track
widths it turns negative below roughly 50% front — 49.51% on `DEF_CH`
— so every mid- and rear-engined car sits on the negative side, as does
any chassis a wide front tyre stagger pushes there. Track width moves the
crossover a point or so either way (51.61% at 1500F/1600R track, 48.39% at
1600F/1500R); tyre stagger moves it several (44.34% front with 245F/295R,
54.71% with 295F/245R); CG height and total weight do not move it at all.
Code reading `gap` must treat both signs as normal inputs. The `fracHi>1`
overshoot got this wrong until `balanceBandDelta` was introduced (see
[HISTORY.md](HISTORY.md)); the `frac ≤ 1` build ordering on a strongly
oversteering chassis is a related open question in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## Natural sag and bottoming risk (ride-height CHASSIS toggle)

```js
sag_mm = 9810 / (2π * hz)²   // per axle, using tune.fHz / tune.rHz
```

Static suspension compression under the car's own weight is a direct
function of natural frequency alone — mass cancels out of the classic
`f = (1/2π)√(g/δ)` relation, leaving `δ = g/(2πf)²`. Softer springs (lower
Hz) sag more; no separate spring-rate solve is needed since `solveSpring`
already folds mass into Hz. Since compression scales linearly with vertical
wheel load (mass cancels out the same way at any load factor, not just 1g),
sag at load factor `n` is simply `n × sag_1g` — a straight line through the
origin. This feeds the CHASSIS section's SAG vs LOAD chart (INT/PRO mode,
CG Height Source set to RIDE HEIGHT): an inline SVG plotting each axle's compression line
against load (g) on the x-axis, with a dashed reference line at that axle's
entered ride height — where the diagonal crosses the dashed line is the
load (in g) at which that axle bottoms out, also given as a plain number
and an at-a-glance LOW/MED/HIGH/BOTTOMED badge (`sag_1g/rideHeight`: <0.5
LOW, <0.8 MED, <1.0 HIGH, ≥1.0 BOTTOMED AT REST). A solid ring on the main
diagonal marks the static 1g operating point (`g=1`).

The main diagonal is still uniform-vertical-load-only — it does not include
dynamic load transfer from cornering or braking, or bump loads. The chart
now adds a second, fainter dashed line per axle that folds in *cornering*:
the outside wheel's extra compression from lateral load transfer, reusing
the same `latLoadTransfer` model as [`mechBalanceLLT`](#mech-balance-grip-model-mechbalancelltbalancefromrsbal):

```js
Kf, Kr = tune.rsSpF+tune.rsAbF, tune.rsSpR+tune.rsAbR   // total roll stiffness per axle
dWf, dWr = latLoadTransfer(ch, Kf, Kr)                  // outside-wheel load transfer (N) at 1g lateral
kWheel = cornerMass * (2π·hz)²                          // wheel-rate spring constant, N/m
dSag_mm = dWf / kWheelF * 1000                          // extra compression per g of lateral accel
outside_line(g) = sag_1g + dSag_mm * g                  // starts at static sag, not the origin
```

`latLoadTransfer` was factored out of `mechBalanceLLT` so both consumers
share one lateral-load-transfer implementation rather than duplicating it.
Because it takes the *same* `Kf`/`Kr` split the ARB/spring solve already
produced, the outside-wheel line reflects the car's actual current roll
stiffness balance, not a generic assumption. Its own hollow-ring marker and
"outside ≈Ng lat" readout show the lateral g at which the outside wheel
bottoms from roll transfer alone — independent of, and typically reached at
a lower g than, the vertical-g bottom-out on the main diagonal, since it's
added on top of static sag rather than starting from zero.

The top 12% of each axle's dashed ride-height line is shaded as a "bump
stop zone" reminder — a real spring goes progressive well before metal-to-
metal contact, softer than either line's linear-rate assumption shows near
the top. This is a visual cue only; no progressive-rate curve is modeled or
plotted.

Braking-induced (longitudinal) load transfer and dynamic bump loads are
still not modeled by either line — treat HIGH/BOTTOMED, and any bottom-out
g figure here, as a prompt to double-check, not a certainty. See the
Calibration constants section above and [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
for the same caveat as it applies to the CG-height estimate this toggle
also drives.

### BOTTOM G's stiffness mode

The INT/PRO RIDE panel's Ride Stiffness slider can also be driven in the
other direction — set a target vertical-g bottom-out and back-solve the Hz
that produces it — via a HZ / BOTTOM G's mode toggle next to RIDE REF.
(`index.html`, RIDE panel IIFE, only shown with RIDE HEIGHT → CG on). It
inverts the same `sag_mm` formula above for whichever axle RIDE REF.
currently anchors:

```js
bottomG = rideHeight_mm * (2π*hz)² / 9810        // forward, same as sag_1g/rideHeight above (inverted)
hz      = √(9810 * bottomG / rideHeight_mm) / 2π  // inverse — what the slider solves for
```

The slider's own min/max in g-space are just this formula evaluated at
`HZ_MIN`/`HZ_MAX` for the active axle's ride height, so the bounds shift per
axle and per chassis. It reads `ch.rideHeightF/R` directly (defaults 130mm
front / 120mm rear) regardless of whether the RIDE HEIGHT → CG toggle is on
— it doesn't require the SAG vs LOAD chart to be visible to work, though the
two are the same underlying model and should always agree.

This mode is also what makes the SHARED **Hz mode** (as opposed to SHARED
RIDE REF.) meaningful — see [Rear/secondary Hz modes](#rearsecondary-hz-modes)
above. That Hz mode only surfaces here, since it needs a per-axle bottom-out
g to equalise rather than a Hz ratio to hold.

Unlike RIDE REF., this is **not** a display-only toggle — `fe.rideStiffMode`
and the target `fe.rideBottomG` are real persisted fields (codec ids 63/64;
see [CODEC.md](CODEC.md)), because the target is meant to survive being
applied to a different chassis: copying a build/share-code tuned in BOTTOM
G's mode onto a chassis with a different ride height re-solves Hz to hit the
same target g, rather than carrying the raw Hz forward and letting the g
reading silently drift.

A single `useEffect` (`index.html`, directly after `tune`/`physics` are
computed) keeps this resolved, live — on ride-height edits, on a
build/share-code load landing a different target on the current chassis, and
on mount. It also handles the one case that must go the *other* direction:
switching RIDE REF. (FRONT/SHARED/REAR) must never itself change the actual
front/rear Hz (see the RIDE REF. hint text) — so on an axle switch, the
effect mirrors the stored target to the newly-active axle's already-current
g instead of resolving Hz from the old axle's target. It distinguishes these
two cases with a `useRef` that remembers only the previous RIDE REF. value
(not a float, so no rounding-drift false positives) — everything else (ride
height, the target itself) is a genuine "resolve" trigger.

This started as two separate effects (a resolve effect and a mirror effect)
and shipped with a real bug: a single `fe` update that changes
`rideStiffness` *and* `rideBottomG` together (loading a build) made both
effects' dependencies fire in the same commit, both reading the same
pre-resolve `tune` snapshot — the mirror effect stomped the freshly-loaded
target with a value derived from the not-yet-resolved Hz, fighting the
resolve effect into converging on the wrong number instead of the loaded
target. One effect making one atomic decision per fire, using the ref above
to disambiguate, closed that race. If this logic is touched again, re-verify
by loading a build with a known target onto a chassis with a different ride
height and confirming the resolved Hz matches the target exactly (not a
value quietly re-derived from whatever Hz happened to be loaded).

---

## Test coverage

**`tests.js` does not import, read, or evaluate `index.html`.** It is a
hand-maintained *duplicate* of the physics functions, re-declared inside the
test file. It will pass unchanged even if `index.html` is deleted outright,
so a green run proves the formulas documented here are self-consistent — it
proves nothing about the app. Any change to a mirrored function has to be
copied across by hand, and drift between the two is silent. There is no CI,
no linter and no build step, so nothing else catches it either.

Given that, the reliable way to verify a change to `index.html` is the
browser: load it, check the console and `#pre-load`, and exercise the
affected tier. See [CODE_MAP.md](CODE_MAP.md) for the runtime bootstrap that
makes compile and runtime failures visible.

`tests.js` mirrors `flatRideRearHz`, `solveSpring`, `solveDamp` (a shape the
app no longer has — see the note above its definition there), `settleZetas`,
and `mechBalanceLLT`/`balanceFromRsBal` (settle-mode ride-reference
anchoring in particular has a dedicated test section, since it was the site
of a prior legacy-formula regression guard). The Hz-mode dispatch inside
`feelToPhysics` (MULTIPLIER/MECH/CO-SOLVE branch selection) is not
separately tested — only the underlying functions each mode calls into.
`computeTune`, the codec, and all React UI have no coverage at all.
