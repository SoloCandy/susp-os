# SUSP.OS — Alignment Target Reference

`computeAlignment(ch, tune, layout, buildType)` derives
recommended camber, toe, and caster from build type, drivetrain layout,
front weight bias, front/rear spring Hz, and roll angle. Unlike the rest of
the physics engine (see [FORMULAS.md](FORMULAS.md)), none of its constants
are calibrated against Forza telemetry — they're reasonable static-alignment
starting points from general chassis-setup convention, not measured. This
file exists so they're documented *somewhere* rather than only as inline
magic numbers.

## Game ranges, recommendation bands and rounding

Two sets of limits, deliberately separate:

| | Camber F | Camber R | Toe F | Toe R | Caster |
|---|---|---|---|---|---|
| `ALIGN_GAME`: what Forza accepts; MANUAL and AUTO + intent stay inside it | −5.0..+5.0° | −5.0..+5.0° | −5.0..+5.0° | −5.0..+5.0° | 1.0..7.0° |
| `ALIGN_REC`: where AUTO's own recommendation stays | −4.0..0.0° | −3.5..0.0° | −0.2..+0.2° | 0.0..+0.3° | 4.0..7.0° |

`ALIGN_GAME` was read off the in-game tuning menu and is the same in Horizon and Motorsport,
all in 0.1° steps. `ALIGN_REC` is a design choice, not a game limit. Both ends of every band sit on the 0.1°
grid, so a rounded value can't land outside its band.

Every recommended value goes through `alignRec(key, v)`. It rounds to 0.1° half away from
zero, then clamps to the `ALIGN_REC` band. Half away from zero matters because the toe tables are full of
±0.05 entries: `Math.round` sends −0.05 to 0 and +0.05 to 0.1, so every slight toe-out was
lost while the matching toe-in survived. The formulas below write `clamp(lo, hi, x)` for
`alignRec`.

MANUAL values are clamped to `ALIGN_GAME` but not snapped to 0.1°: a typed −1.23 goes through
as typed.

**Toe sign.** Positive is toe-in, negative toe-out, which matches the numbers in the game and its
description box. Forum reports say the game's IN/OUT slider labels sit on the opposite sides,
so a tuner reading the labels instead of the number would enter toe backwards. The convention hasn't
been checked against the car's on-screen wheel angle.

`computeAlignment` itself is the AUTO recommendation's engine only. From INT, the ALIGNMENT
section adds intent offsets on top of it or replaces it with MANUAL values; `alignOut` makes
the alignment the output prints. See "Intent and MANUAL (INT+)" below.

## The ALIGNMENT output card

Each row prints the value to enter, and its meta tags (`alignView`):

| Row | Tags |
|---|---|
| Camber F / R | `dyn` (camber at the tune's roll, brighter under AUTO); `AUTO x°` when intent or MANUAL moved the value off AUTO |
| Toe F / R | `IN` / `OUT` from the sign (nothing at 0.0); then `AUTO x°` as above |
| Caster | `steer x° @ 10°`; `AUTO x°` as above |
| any | `LIMIT` note when `alignOut`'s `limit[key]` is set: AUTO held at its `ALIGN_REC` band with no offset moving it off, or AUTO + offset held at `ALIGN_GAME` |

The header reads `AUTO · {BUILD}`, plus `· ADJUSTED` while any offset is non-zero, or `MANUAL`.

`steer` is `casterSteerCamber(caster)`: `−caster × sin(CASTER_REF_STEER)`, the negative camber
the outside front wheel gains from caster when steered. It's small-angle geometry with KPI left out,
not calibrated. `CASTER_REF_STEER` is 10°, a stated choice, since Forza never shows the
road-wheel angle.

The `AUTO` tag is the only gap figure. The gap between MANUAL's `dyn` and the
build's target is the same number, because both sit at the same roll.

Under AUTO, the card's ⓘ hint ends with the terms behind each value: `computeAlignment`'s
`why`, `[label, degrees]` pairs that sum to the unclamped value, followed by `adjust`, the intent
offset (terms under 0.005° are left out, except the build base). Wording in [HINTS.md](HINTS.md).

## Camber

```js
camberGain = clamp(0.55, 0.85, 1.05 - cgHeight*0.8)     // roll-compensation gain, higher CG → less gain
rearGainMult = FWD: 0.50 | AWD: 0.70 | RWD: 0.75         // rear camber reacts less to roll than front
// both from camberGainOf(ch, layout), which the ALIGNMENT output also reads
fwdReduction = FWD: 0.3 | else: 0.0                      // FWD front camber reduced (needs front grip for both steering and traction)
```

All builds use the same roll-compensated formula — `optimalCamber` is the
only thing that varies per build:

```js
recCamberF = clamp(-4.0, 0.0, optimalCamber - rollDeg*camberGain + fwdReduction)
recCamberR = clamp(-3.5, 0.0, optimalCamber - rollDeg*camberGain*rearGainMult)
```

The ALIGNMENT output adds the roll term back to show each axle's `dyn` camber:
`static + rollDeg*camberGain` front, `static + rollDeg*camberGain*rearGainMult` rear. Under
AUTO that lands on `optimalCamber` (plus `fwdReduction` on a FWD front) unless a clamp or an
intent offset moved the static value; under MANUAL it shows what the typed camber gives at that roll.
A camber offset moves the static and the dynamic camber by the same amount, so Camber F / R
set the dynamic target as well.

| Build | optimalCamber |
|---|---|
| Drift | −2.5 |
| Drag | −0.2 |
| Street | −1.0 |
| Track (or unmatched) | −1.5 |
| Rally | −0.8 |
| Offroad | −0.3 |

Drift and Drag used to be fixed constants, ignoring CG height, track width,
and actual roll angle entirely — two drift cars with very different CG
heights got the same camber recommendation. Fixed to use the same
roll-compensated formula as every other build (see
[HISTORY.md](HISTORY.md) for the history).

## Toe front (`recToeF`)

```js
recToeF = clamp(-0.2, 0.2, toeFByBuild + (frontBias-50)×-0.003 + (fHz-1.8)×0.010)
```

Rounded to 0.1° (see above), because Forza's toe input only accepts one decimal place.
`toeFByBuild`'s 0.05° entries therefore land on a whole 0.1° step: on a default chassis,
TRACK RWD/AWD's −0.05 prints −0.1 and STREET FWD's +0.05 prints +0.1.

| Build | toeFByBuild (FWD / other layouts) |
|---|---|
| Street | 0.05 / 0.0 |
| Track | 0.05 / −0.05 |
| Drift | 0.0 / −0.10 |
| Rally | 0.0 / 0.0 |
| Offroad | 0.05 / 0.05 |
| Drag | 0.0 / 0.0 |
| *(unmatched build)* | −0.05 (fallback) |

Sign convention, as the app's own toe hints state it: positive is toe-in,
negative is toe-out. The `(frontBias-50)×-0.003` term therefore nudges
slightly toward toe-**out** with front-heavier cars (this doc said toe-in until
an audit checked it against the sign convention); `(fHz-1.8)×0.010` nudges
toward more toe-in with stiffer front springs (verified against the actual
formula — an earlier version of this doc had that direction backwards too).

## Toe rear (`recToeR`)

```js
recToeR = clamp(0.0, 0.3, toeRBase + (rearBiasFraction-0.5)×0.20 + max(0, rHz-fHz)×-0.03)
```

Same 0.1° rounding as `recToeF`.

`toeRBase` by build/layout (`toeRByBuild[build][layout]`, a lookup table
matching `toeFByBuild`'s style):

| Build | RWD | AWD | FWD |
|---|---|---|---|
| Drift | 0.05 | 0.05 | 0.05 |
| Drag | 0.0 | 0.0 | 0.0 |
| Offroad | 0.15 | 0.15 | 0.10 |
| Rally | 0.10 | 0.08 | 0.05 |
| Street | 0.15 | 0.08 | 0.05 |
| Track (or unmatched) | 0.10 | 0.08 | 0.05 |

The `(rearBiasFraction-0.5)×0.20` term adds toe-in as the car gets more
rear-weight-biased; `max(0, rHz-fHz)×-0.03` reduces rear toe-in when the
rear is stiffer than the front (a stiffer rear already resists rotation,
so it needs less toe-in help).

## Caster (`recCaster`)

```js
recCaster = clamp(4.0, 7.0, casterBase + (fHz-1.8)×0.4 + (frontBias-50)×0.04 + (layout==='FWD' ? -0.5 : 0))
```

| Build | casterBase |
|---|---|
| Drift | 4.8 |
| Drag | 4.0 |
| Offroad | 4.5 |
| Street | 5.2 |
| Track / Rally (or unmatched) | 5.8 |

Stiffer front springs and more front weight bias both increase recommended
caster (more self-centering force needed); FWD gets a flat −0.5° reduction
regardless of build (unlike camber/toe, which differentiate AWD from RWD,
caster only special-cases FWD vs everything else).

## Adding a new build type

1. Add camber `optimalCamber` case (or a fixed pair if it should behave
   like Drift/Drag).
2. Add a `toeFByBuild` entry.
3. Add a `toeRBase` case (all three layouts).
4. Add a `casterBase` case.
5. Update the tables in this file to match.

## Intent and MANUAL (INT+)

The ALIGNMENT section (INT and PRO; not in BEG) has two modes, stored in `dr` with the rest of
the build (`DEF_DR`):

| `dr` field | Meaning |
|---|---|
| `alignManual` | `false` = AUTO + intent (default), `true` = MANUAL |
| `alignOfsCamberF` / `CamberR` / `ToeF` / `ToeR` / `Caster` | intent offsets AUTO adds, ± degrees, ranges `ALIGN_OFS_RANGE` |
| `alignManCamberF` / … / `alignManCaster` | MANUAL values, absolute degrees within `ALIGN_GAME` |

**AUTO + intent.** Five sliders (`ALIGN_INTENT_ROWS`), each an offset from that value's AUTO
recommendation. Each slider's box shows the resulting value, the number to type into the game,
and typing there sets the offset back from it. Because they store offsets, the alignment keeps
following the chassis, springs and build type, with the preference on top.

| Slider | Value | Ends (− ↔ +) | Range |
|---|---|---|---|
| Camber F | front camber | MORE ↔ LESS (negative camber) | ±2.0° |
| Camber R | rear camber | MORE ↔ LESS | ±2.0° |
| Turn-in | front toe | SHARP (toe-out) ↔ STABLE (toe-in) | ±0.3° |
| Rear stability | rear toe | FREE ↔ PLANTED (toe-in) | ±0.3° |
| Steering feel | caster | LIGHT ↔ WEIGHTED | ±1.5° |

```js
value = clamp(ALIGN_GAME[k], round0.1(autoRec[k] + offset[k]))   // alignOut
```

The result may pass `ALIGN_REC`, which bounds only AUTO's own recommendation, out to the game's
limit. That was the owner's call: the sliders exist to override the recommendation.

**MANUAL.** Five number fields across `ALIGN_GAME`, for an alignment already in the game. Tune
Check DECODE feeds it, and that's why it's in INT: DECODE's step 1 has an optional ALIGNMENT
block (INT+, Forza modes), and IMPORT TUNE writes it here with `alignManual: true`. It has its
own gate (`ckAlEntered`), so an alignment imports on its own without the suspension seeds, and
the other way round, in one undoable commit.

**Switching carries the numbers across** (`setAlignManual`):

- AUTO → MANUAL: the MANUAL values become what AUTO + intent printed.
- MANUAL → AUTO: the offsets become `alignOfsFrom(auto, manual)`, the offsets that land AUTO
  closest to the MANUAL values: `manual − autoRec`, rounded to 0.1° and held to `ALIGN_OFS_RANGE`.
  Exact while the MANUAL value is within its slider's reach of AUTO.

**Leaving the device.** A share code carries only the offsets (ids 91–95, the ALIGNMENT part;
see [CODEC.md](CODEC.md)). Under MANUAL, `alignDrOut` translates the MANUAL values into offsets
first, the same way MANUAL → AUTO does. So a received alignment is always AUTO + intent and keeps
following the reader's car, and applying it puts the reader in AUTO. Garage SAVE / OVERWRITE
store the whole `dr`, so MANUAL comes back exactly on this device, with the translated offsets
beside it for the entry's COPY CODE.

**BEG** reads pure AUTO (`alignOut` with tier `beginner`). The stored mode, offsets and MANUAL
values are kept, not reset, the same as the BRAKES shift, so returning to INT brings them back.

**Retired: Nudge MECH / GRIP and Nudge Strength.** PRO used to tilt camber and toe toward the
Mech Balance Target's gap (MECH) or against the chassis's grip tendency (GRIP), scaled by a
0–100% strength. It was abstract, rounded back to the AUTO value at most strengths, and the
balance model never saw it, so the intent sliders replaced it. A saved `mech` or `grip` mode
migrates to AUTO. See [HISTORY.md](HISTORY.md).

**Migration.** Alignment used to live in its own key, `suspos_al_v2`. `migrateLegacyAl` runs
as `suspos_dr_v8`'s repair: a stored `dr` without `alignManual` predates the move and takes MANUAL
and its angles from the old key. See [PERSISTENCE.md](PERSISTENCE.md).
