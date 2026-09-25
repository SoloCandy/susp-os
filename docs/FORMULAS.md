# SUSP.OS — Handling Balance Formulas

Ground-truth math behind every oversteer/understeer (OS/US) contribution
shown in the Handling Balance bar. Convention: **positive = oversteer,
negative = understeer** for every value below.

> This file exists because hint text and slider labels can drift out of
> sync with the actual math. It has happened twice: Damping Bias, whose hint
> said the opposite of what `bDampBias` computes, and the FWD EXIT hint, which
> named the wrong lock direction because that slider's balance direction and
> its lock direction genuinely point opposite ways on FWD. When in doubt about
> which direction a control pushes handling, check the formula here, not
> the UI copy.

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
  (REAR bias, front stays firm) = oversteer; left (FRONT bias) = understeer.
- `tune.zetaF`/`tune.zetaR` themselves come from whichever Damping Balance
  Mode is active (STANDARD/SYNC/NEUTRAL — see [SLIDERS.md](SLIDERS.md)), but
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
- `recBrakeBias` (the only producer — there is no manual override) is clamped
  to **45–68**, so `bBrakeEntry` spans roughly **+1.0 … −3.6**. The sub-50
  half of that range is only reachable on rear-weighted cars in DRIFT/DRAG
  builds; every other combination lands front-biased because the
  CG/wheelbase weight-transfer term dominates. The floor was 50 until it was
  found to be silently truncating those cases — see
  [HISTORY.md](HISTORY.md).

## Differential (`computeDiff`)

```js
const nf = ch.frontBias/100;
// RWD:
bDiffAccel =  vals.accel * (1-nf) * DIFF_BIAS_SCALE;   // rear accel lock → oversteer (+)
bDiffDecel = -vals.decel * (1-nf) * DIFF_BIAS_SCALE;   // rear decel lock → understeer (−), resists lift-off oversteer
// FWD:
bDiffAccel = -vals.accel * nf     * DIFF_BIAS_SCALE;   // front accel lock → understeer (−)
bDiffDecel = -vals.decel * nf     * DIFF_BIAS_SCALE;   // front decel lock → understeer (−)
// AWD (C = center split fraction, 0=all front, 1=all rear):
bFA = -vals.frontAccel * nf     * (1-C) * DIFF_BIAS_SCALE;  // front accel → understeer (−)
bRA =  vals.rearAccel  * (1-nf) * C     * DIFF_BIAS_SCALE;  // rear accel  → oversteer (+)
bFD = -vals.frontDecel * nf     * (1-C) * DIFF_BIAS_SCALE;  // front decel → understeer (−)
bRD = -vals.rearDecel  * (1-nf) * C     * DIFF_BIAS_SCALE;  // rear decel  → understeer (−), resists lift-off oversteer
bDiffFront = bFA + bFD;
bDiffRear  = bRA + bRD;
bDiffAccel = bFA + bRA;
bDiffDecel = bFD + bRD;
```

- `DIFF_BIAS_SCALE = 0.14`.
- Decel lock always pushes **understeer**, regardless of which axle is
  driven — it models "decel lock resists rotation" (matches the EXIT/ENTRY
  slider hint text, e.g. "STABLE increases lock — resists lift-off
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

## Total (`bTotFull`)

```js
const bTotFull = tune.bTot + tune.bChassis + diff.bDiffAccel + diff.bDiffDecel + bBrakeEntry + bDampBias;
```

This is the number shown as the overall Handling Balance total (and its
color-coded OS/US label). `tune.bTot` already includes `bSp + bAb`.

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
