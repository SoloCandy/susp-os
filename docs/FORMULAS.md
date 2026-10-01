# SUSP.OS — Handling Balance Formulas

Ground-truth math behind every oversteer/understeer (OS/US) contribution
shown in the Handling Balance bar — the BEG/INT point contributors, and PRO's phase margins
(see "Phase margins"). Convention: **positive = oversteer, negative = understeer** for every
value below.

> This file exists because hint text and slider labels can drift out of
> sync with the actual math. It has happened more than once: Damping Bias, whose hint
> said the opposite of what `bDampBias` computes; the FWD EXIT hint, which
> named the wrong lock direction because that slider's balance direction and
> its lock direction genuinely point opposite ways on FWD; and the RWD manual
> Decel Lock hint, which said lower lock meant *less* lift-off oversteer when
> `bDiffDecel` says less lock means more lift-off rotation. When in doubt about
> which direction a control pushes handling, check the formula here, not
> the UI copy. Every hint is quoted in [HINTS.md](HINTS.md), which makes the
> UI copy reviewable in one place.

Scope note: this file is *balance-direction* math only. For the actual
Hz/spring-rate/damper-click solve math feeding these formulas' inputs
(`zetaF`/`zetaR`, `rsSpF`/`rsSpR`, etc.), see [PHYSICS.md](PHYSICS.md).

---

## Springs & ARBs (`computeTune`)

```js
const spShare = rsTotal>0 ? (rsSpF+rsSpR)/rsTotal : 1;
const abShare = rsTotal>0 ? (rsAbF+rsAbR)/rsTotal : 0;
const bSp = (rsSpF+rsSpR)>0 ? (nf-(rsSpF/(rsSpF+rsSpR)))*100*spShare : 0;
const bAb = (rsAbF+rsAbR)>0 ? (nf-(rsAbF/(rsAbF+rsAbR)))*100*abShare : 0;
const bTot = bSp + bAb;
```

- `nf` = front weight bias fraction (`ch.frontBias/100`).
- `rsSpF/rsSpR` = front/rear roll stiffness from springs; `rsAbF/rsAbR` = from ARBs.
- Each term is weighted by its **actual share of total roll stiffness**
  (`spShare`/`abShare`) so ARBs (typically 10-15% of total) don't appear as
  influential as springs (85-90%).
- Sign: if the rear carries a *larger* fraction of that source's stiffness
  than the front weight fraction would imply, the term goes positive
  (oversteer).

## Damping (`bDampBias`)

```js
const effectiveAvgZeta = (tune.zetaF+tune.zetaR)/2 || 70;
const bDampBias = -(tune.zetaF - tune.zetaR) * 16 / effectiveAvgZeta;
// more front rebound → understeer (−)
```

- `zetaF > zetaR` (front damped harder than rear) → **negative** → understeer.
- `zetaR > zetaF` (rear damped harder than front) → **positive** → oversteer.
- This is the formula that governs the Damping Bias slider: right
  (REAR bias: rear damped firmer relative to front) = oversteer; left (FRONT bias) = understeer.
- `tune.zetaF`/`tune.zetaR` themselves come from whichever Damping Balance
  Mode is active (STANDARD / TIME SYNC / HYBRID / EQUAL FORCE — see [SLIDERS.md](SLIDERS.md)), but
  this formula doesn't care how they were derived, only their final values —
  same reasoning as `bSp`/`bAb` not caring which ARB Balance Mode produced
  the roll-stiffness split feeding them.
- `tune.zetaF`/`tune.zetaR` are also back-calculated from the final, clamped
  click values (`impliedZeta`, see [PHYSICS.md](PHYSICS.md)) rather than the
  pre-clamp target, so `bDampBias` reflects the damping the displayed click
  values will actually produce in-game — same treatment `rsAbF`/`rsAbR`
  already get for ARB.

## Brakes (`bBrakeEntry`)

```js
const bBrakeEntry = -(brakeBias-50) * BRAKE_BIAS_SCALE; // BRAKE_BIAS_SCALE = 0.20
// high front bias → understeer (−)
```

- `brakeBias` is % front brake bias (50 = even). Above 50 (more front brake)
  → negative → understeer on entry. Below 50 (more rear brake) → positive
  → oversteer-leaning (more prone to rear lock-up rotation).
- `brakeBias` is `recBrakeBias`, shifted at INT and PRO by BRAKES' Brake Bias:
  `clamp(centre − dr.brakeBiasShift, 40, 68)` (`BRAKE_BIAS_MIN`/`MAX`), the shift ±10 with + = rearward. The centre is
  `recBrakeBias`, or at PRO with `dr.brakeCentre === 'grip'` the rounded `gripBrakeBiasOf(ch,
  dr.brakeDecel)` (see "GRIP brake bias" below). With `'entry'` there is no shift: `brakeBias` is
  the rounded `entryBrakeBiasFor(ch, tune, dr.brakeEntryTarget).bias` ("ENTRY brake target"
  below). BEG ignores the shift and INT the Centre. `recBrakeBias` is clamped
  to **40–68**, so `bBrakeEntry` spans roughly **+2.0 … −3.6**. The sub-50
  half of that range is only reachable on rear-weighted cars in DRIFT/DRAG
  builds; every other combination lands front-biased because the
  CG/wheelbase weight-transfer term dominates. The floor was 50 until it was
  found to be silently truncating those cases — see
  [HISTORY.md](HISTORY.md).
- **Neutral point.** `bBrakeEntry` measures against a flat 50%, while `recBrakeBias`
  itself adds weight transfer and PRO's ENTRY BRK measures against `idealBrakeF`
  (see "Phase margins"), so the card's own recommendation usually reads as understeer
  here. The tips explain that rather than telling the user to move the bias; the three
  are not reconciled ([KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

## Differential (`computeDiff`)

```js
const nf = ch.frontBias/100;
const bs = DIFF_BIAS_SCALE * DIFF_TYPE_SCALE[diffType];  // effective lock = % × type scale
// RWD:
bDiffAccel =  vals.accel * (1-nf) * bs;   // rear accel lock → oversteer (+)
bDiffDecel = -vals.decel * (1-nf) * bs;   // rear decel lock → understeer (−), resists lift-off oversteer
// FWD:
bDiffAccel = -vals.accel * nf     * bs;   // front accel lock → understeer (−)
bDiffDecel = -vals.decel * nf     * bs;   // front decel lock → understeer (−)
// AWD (C = center split fraction, 0=all front, 1=all rear):
bFA = -vals.frontAccel * nf     * (1-C) * bs;  // front accel → understeer (−)
bRA =  vals.rearAccel  * (1-nf) * C     * bs;  // rear accel  → oversteer (+)
bFD = -vals.frontDecel * nf     * (1-C) * bs;  // front decel → understeer (−)
bRD = -vals.rearDecel  * (1-nf) * C     * bs;  // rear decel  → understeer (−), resists lift-off oversteer
bDiffFront = bFA + bFD;
bDiffRear  = bRA + bRD;
bDiffAccel = bFA + bRA;
bDiffDecel = bFD + bRD;
```

- `DIFF_BIAS_SCALE = 0.14`.
- **Diff type.** `DIFF_TYPE_SCALE` is effective lock per lock % (Race 1.00, Sport 0.88,
  Rally 0.76, Offroad 0.52, Drift 1.10). The balance above reads *effective* lock, in AUTO and
  MANUAL alike, so the same typed % counts for less on a gentler diff. AUTO works the other way
  round: each lock formula and its clamp is the effective (Race-equivalent) lock it wants, and
  `lockPct(eff) = min(100, round(eff / scale))` turns that into the % to enter. A gentler diff
  is therefore asked for **more** %, as `DIFF_TYPE_RANGES` and the MANUAL typical ranges say, and
  AUTO's diff balance is the same on every type up to % rounding, until `lockPct` hits 100%:
  Offroad's high-lock intents saturate there, and their balance then reads less than Race's
  (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)). AUTO used to multiply by the scale, which did the
  opposite (see [HISTORY.md](HISTORY.md)).
- **MATCH CHASSIS** adds `clamp(±25, (feEffective.arbBalTarget − natDisplayOf(ch)) × 150)` to the
  EXIT intent and half of it to ENTRY (negated on FWD), in AUTO only, and only while
  `hasBalTargetSolve(fe)`. With nothing solving toward the target it is the hidden
  `MECH_BALANCE_TARGET` fallback, so MATCH CHASSIS does nothing and its button is dimmed.
- Decel lock always pushes **understeer**, regardless of which axle is
  driven — it models "decel lock resists rotation" (matches the EXIT/ENTRY
  slider hint text, e.g. "STABLE = more lock, resists lift-off
  oversteer"). Accel lock, by contrast, always pushes toward oversteer on
  the driven axle. Unlike accel lock, decel lock's sign does **not** flip
  between RWD/AWD-rear and FWD-front — it's negative (understeer) in every
  case. Previously the aggregate formula treated decel lock the same as
  accel lock (rear decel lock → oversteer for RWD/AWD), which contradicted
  the slider hint text; fixed so the formula and hint text agree.

## Chassis (`bChassis`, `computeTune`)

```js
const bChassis = -100 * (gripNeutralSplitOf(ch) - natOffset - (1 - nf));
```

- `gripNeutralSplitOf(ch)` is the rear roll-stiffness fraction at which the grip model
  (`balanceFromRsBal`) reads exactly 0.5 — where this chassis's tyres, track widths, CG and
  weight split balance out. Found by Illinois (regula falsi) root-finding; unique because the
  model is monotone. It is the REAL car's split, while the springs and ARBs are in the solvers'
  model space, so `natOffset` (MEASURE NAT BAL; 0 without a measurement) moves it across — the
  same shift `gripBalance = balanceFromRsBal(ch, rsBalance + natOffset)` makes.
- **Why it exists.** `bSp + bAb` reduces exactly to `100·(rsBalance − (1 − nf))`: the
  stiffness split measured against the **weight** split. But the car is not neutral at the
  weight split — the grip model is neutral at `gripNeutralSplitOf`. Without this term a
  staggered RWD car (wider rears, the textbook understeer change) read OVERSTEER at every ARB
  setting while GRIP BIAS called it understeer-prone.
- **The identity it guarantees:**
  `bSp + bAb + bChassis = 100·(rsBalance + natOffset − gripNeutralSplitOf(ch))`. The mechanical part of the
  bar is zero exactly where the grip model is neutral, and always has the sign of
  `gripBalance − 0.5`. No conversion constant: both halves measure a change of stiffness split
  in the same unit. `tests-balance.js` asserts the identity and the sign agreement.
- **Reading it:** −10 means this car needs 10 points of rear-biased roll stiffness just to reach
  neutral — it leans understeer by that much before you touch anything.
- **Independent of `MECH_BAL_GAIN`** — 0.5 is where front and rear capacity are equal, and the
  gain only scales their difference. Its size on staggered cars does rest on `WIDTH_GRIP_EXP`;
  see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- Saturates when no split can neutralise the car (only absurd stagger, e.g. 200/400).

## NET (`bNet`) and the full total (`bTotFull`)

```js
const bNet     = tune.bTot + tune.bChassis;   // tune.bTot = bSp + bAb
const bTotFull = bNet + diff.bDiffAccel + diff.bDiffDecel + bBrakeEntry + bDampBias;
```

`bNet` is the Handling Balance headline (and its colour-coded OS/US label) in **BEG and INT**,
with ±3 reading NEUTRAL, and the white NET tick on the bar: the steady-state part, car plus
springs and bars. Brakes, decel lock and damping act on corner entry and accel lock on exit, so
the bar draws them as ENTRY and EXIT lanes stacked off NET instead of adding them in. The
Correction Tip judges `bNet` too.

`bTotFull` is not shown. BEG draws only NET; INT adds the ENTRY and EXIT lanes but no TOTAL
line, since summing the uncalibrated diff, brake and damping points into the steady state adds
precision it does not have. It is computed in every tier because `recommendedDiffType` reads it
(RACE → SPORT above +8). PRO's TOTAL line is its own sum, MID + BRK + DRIVE. PRO shows the phase margins below instead.

---

## Phase margins (`phaseMargins`, PRO only)

PRO's Handling Balance is not the point total above. It is read straight from the grip model, by
corner phase, in **grip-margin percent**:

```js
gripMargin(ch, rs, ax = 0, fxF = 0) = 200 * (gF - gR) / (gF + gR)   // axleLatG(ch, 1, rs/(1-rs), ax, fxF)
```

`gF`/`gR` are each axle's lateral capacity per unit of its own static weight
([PHYSICS.md](PHYSICS.md), `axleLatG`). The margin is how much more of it the front has than the
rear, as a percent of their mean — + means the rear gives up first (oversteer). `rs` is the REAL
rear roll-stiffness fraction, `Kr/(Kf+Kr) + natOffset`, as for `gripBalance`. It is the same
difference `mechBalanceLLT` maps onto 0–1, **without `MECH_BAL_GAIN`**, so it always shares
GRIP BIAS's sign and claims nothing the uncalibrated gain would add. `±PHASE_NEUTRAL` (1%) reads
NEUTRAL.

| Phase | Total | Parts |
|---|---|---|
| MID (headline) | `gripMargin(rs)` | CHAS = `gripMargin(1 − nf + natOffset)`, the margin at the weight-matched split; SPR and ARB share the rest in proportion to `bSp`/`bAb` |
| ENTRY | MID + BRK | BRK = `gripMargin(rs, −ENTRY_G, bias/100) − gripMargin(rs, −ENTRY_G, idealBrakeF)` |
| EXIT | MID + DRIVE | DRIVE = `gripMargin(rs, EXIT_G, driveF) − gripMargin(rs, EXIT_G, idealDriveF)` |

- **Reference loads.** `ENTRY_G = 0.3` g braking, `EXIT_G = 0.2` g drive. Arbitrary but stated
  on screen: how hard someone brakes or feeds in throttle is the driver's, not the tune's.
- **Ideal splits.** `idealBrakeF = gripBrakeBiasOf(ch, ENTRY_G) / 100`, BRAKES' GRIP solve at
  the ENTRY load (see "GRIP brake bias"): close to `nf + ENTRY_G·h/L`, pulled toward even by load
  sensitivity and moved by tyre stagger. `idealDriveF = nf − EXIT_G·h/L` (front drive share) is
  still load-proportional. BRK and DRIVE are zero when the axles share the work as they can carry
  it, so they measure the *setting*.
- **Drive front share:** RWD 0, FWD 1, AWD `1 − center/100`.
- **PITCH** — `gripMargin` at the ideal split minus MID — is shown per phase, muted, and **not
  added** to either total. It is the car's own weight transfer (+ on entry, − on exit), not
  tunable, and at any realistic load larger than everything that is.
- **Diff lock and damping have a direction only** (`DirSeg`), read from the signs of
  `bDiffDecel`, `bDiffAccel` and `bDampBias` above. `DIFF_BIAS_SCALE` is uncalibrated and damping
  acts only in transients, which a steady-state model cannot size.
- **The identities `tests-balance.js` asserts:** CHAS + SPR + ARB = MID; MID has GRIP BIAS's sign;
  BRK is zero at `idealBrakeF` (= GRIP at `ENTRY_G`) and falls as front bias rises; DRIVE is + for RWD, − for FWD and
  rises with AWD rear share; none of it moves with `MECH_BAL_GAIN`.

---

## Load transfer readout (`loadTransferOf`, PRO only)

The LOAD TRANSFER section reads `latLoadTransfer` at the real car's roll-stiffness split
(`Kr/(Kf+Kr) + natOffsetOf(ch)`, as `phaseMargins` does), in kg per g:

- **XFER** per axle = `dW / g`, split into **SPR+ARB** (elastic: the sprung roll couple
  `Mt·g·(h − RC)` shared by roll stiffness, ÷ track) and **GEOMETRY** (`M_axle·g·RC ÷ track`,
  with `RC = 0.2·h`). Only the elastic part moves with the tune.
- **FRONT TAKES** = `100·dWf/(dWf + dWr)`, shown beside the weight split. More of the transfer on
  the front than its weight share leans understeer; the CAR tick on the bar is the refined
  version, since it also counts tyre widths.
- **OUT / IN** = corner mass ± XFER, both capped where the inner wheel lifts (XFER ≥ corner mass,
  the point where `axleLatG` caps the transfer): the outer wheel then carries the whole axle.
- **FORE-AFT**: front axle load = `M_front − Mt·ax·h/L` at `ax = −ENTRY_G` (braking) and
  `+EXIT_G` (drive), clamped to the car's mass — the pitch the phase margins read, without cornering.

It replaced `2 × corner mass × h ÷ track`, which used the full CG height on each axle and no
roll-stiffness split, so no tune could move it. `tests-balance.js` asserts it equals
`latLoadTransfer`, moves with the split, conserves load and agrees with the LIFT check.

---

## Grip use (`gripUseOf`, PRO only)

`axleGrip` is the first half of `axleLatG`, split out: each axle's lateral capacity `Fy`
(N, at the pitch-shifted, transfer-capped wheel loads, before the friction circle) and the
longitudinal force `x` it is asked for. For a phase (MID: `ax = 0`; ENTRY: `−ENTRY_G` at the brake
bias; EXIT: `+EXIT_G` at `driveFrontOf(diff)`):

- lateral capacity left per axle, in g of its own weight: `g_axle = √(Fy² − x²) / (M_axle·g)`
- the car's limit: `g_lim = min(gF, gR)` — the first axle to saturate
- **use** per axle = `√((M_axle·g·g_lim)² + x²) / Fy`: exactly 1 on the limiting axle, below 1
  on the other; `1 − use` is its spare grip
- **braking / drive share** = `x / Fy`

It includes PITCH, since it predicts what the tyres see; the phase margins leave PITCH out of
ENTRY and EXIT to isolate the tune, so the two can disagree, most on EXIT. The limit agrees in
sign with `gripMargin` at the same load, which `tests-balance.js` asserts, along with use = 1 on
the limiting axle and that `axleGrip` + the friction circle is exactly `axleLatG`. There is no
friction coefficient, so `g_lim` is in the model's own units and is not shown.

## GRIP brake bias (`gripBrakeBiasOf`, PRO only)

BRAKES' GRIP Centre: the brake bias at which both axles reach their braking limit at the same
moment, braking in a straight line at `decel` g (`dr.brakeDecel`, 0.3–1.5, default 1.0).
`axleGrip(ch, 1, 1, −decel, ·, latG = 0)` gives each axle's capacity `Fy` at its pitch-shifted
load with no lateral transfer; a brake share `f` asks the axles for `f·Fx` and `(1−f)·Fx`, so
equal use (`x/Fy` the same front and rear) is

```
gripBrakeBias = 100 × FyF / (FyF + FyR)
```

On square tyres that is close to the classic ideal, `frontBias + 100 × decel × cgHeight /
wheelbase`, pulled slightly toward 50/50 by `TIRE_LOAD_SENS`; staggered tyres move it by their
`WIDTH_GRIP_EXP` weighting. Default chassis: 56% at 0.3 g, 66% at 1.0 g, and 74% at 1.5 g, which
`brakeBias` then clamps to 68. It leaves out the build mods and the PRO grip term, and with no
cornering the springs and bars cannot move it — it is a centre that follows the chassis, not a
lever that could cover a balance problem the springs made. `tests-balance.js` asserts equal use at
the solved bias, forward movement with decel and CG height, and the tyre-width direction.

PRO ENTRY measures BRK from it: `idealBrakeF` is `gripBrakeBiasOf(ch, ENTRY_G)`, so GRIP at a
0.3 g Decel reads BRK 0, give or take the bias's 1% rounding. BRAKES shows that BRK under the
Centre toggle as ENTRY BRK; it moves about 0.45% per point of bias on the test chassis, nearly
independent of the spring split.

## ENTRY brake target (`entryBrakeBiasFor`, PRO only)

BRAKES' ENTRY Centre solves the bias for a target **BRK**, `dr.brakeEntryTarget` (−5..+5, grip-margin
%, + = entry looser than mid-corner): bisection over 40–68 on `phaseMargins(...).entry.brk`, which
falls strictly with front bias. Out of reach, it returns the end (`clamped: 'rear'` at 40,
`'front'` at 68) and the section says so. Target 0 is `gripBrakeBiasOf(ch, ENTRY_G)`.

Deliberately limited:

- **BRK, not the ENTRY total.** ENTRY = MID + BRK. Aiming the total at a value would make the bias
  absorb MID, which the springs set (about 5 points of bias for a −2.2% MID): the brakes covering
  a spring problem. BRK barely moves with the spring split, so the solved bias follows the chassis;
  `tests-balance.js` asserts it moves under one point between rear splits of 0.4 and 0.6.
- **Not the Balance Target.** That is a mech balance (0–1) with no calibrated map to grip-margin
  percent.
- **Diff and damping held fixed.** The off-throttle diff, the main entry lever, and damping have no
  size in PRO, so they are not in the solve; the hint says so.
- **Scale.** BRK's size follows the arbitrary `ENTRY_G`, so the target is in the expanded panel's
  units, not an absolute one. About 0.45% per bias point, so 40–68 reaches roughly +7% to −5%.

---

## Quick sign reference

| Source | More rear-side stiffness/lock/damping | More front-side stiffness/lock/damping |
|---|---|---|
| Springs (`bSp`) | oversteer (+) | understeer (−) |
| ARBs (`bAb`) | oversteer (+) | understeer (−) |
| Damping (`bDampBias`) | oversteer (+) | understeer (−) |
| Brakes (`bBrakeEntry`) | oversteer (+) (more rear brake) | understeer (−) (more front brake) |
| Diff accel lock (`bDiffAccel`) | oversteer (+) (rear accel lock) | understeer (−) (front accel lock) |
| Diff decel lock (`bDiffDecel`) | understeer (−) — resists lift-off oversteer, regardless of which axle is driven | understeer (−) — resists lift-off oversteer, regardless of which axle is driven |

See [SLIDERS.md](SLIDERS.md) for how each individual slider maps onto these
contributors.
