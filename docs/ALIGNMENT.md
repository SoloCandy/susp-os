# SUSP.OS — Alignment Target Reference

`computeAlignment(ch, tune, layout, buildType)` derives
recommended camber, toe, and caster from build type, drivetrain layout,
front weight bias, front/rear spring Hz, and roll angle. Unlike the rest of
the physics engine (see [FORMULAS.md](FORMULAS.md)), none of its constants
are calibrated against Forza telemetry — they're reasonable static-alignment
starting points from general chassis-setup convention, not measured. This
file exists so they're documented *somewhere* rather than only as inline
magic numbers.

`computeAlignment` itself is BUILD mode's engine only — PRO mode wraps it
with an **Alignment Mode** selector (`al.mode`) that can nudge its output
toward the car's actual balance tuning instead of taking BUILD's numbers
as-is. See "Alignment Mode (PRO)" below.

## Camber

```js
camberGain = clamp(0.55, 0.85, 1.05 - cgHeight*0.8)     // roll-compensation gain, higher CG → less gain
rearGainMult = FWD: 0.50 | AWD: 0.70 | RWD: 0.75         // rear camber reacts less to roll than front
fwdReduction = FWD: 0.3 | else: 0.0                      // FWD front camber reduced (needs front grip for both steering and traction)
```

All builds use the same roll-compensated formula — `optimalCamber` is the
only thing that varies per build:

```js
recCamberF = clamp(-4.0, 0.0, optimalCamber - rollDeg*camberGain + fwdReduction)
recCamberR = clamp(-3.5, 0.0, optimalCamber - rollDeg*camberGain*rearGainMult)
```

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
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the history).

## Toe front (`recToeF`)

```js
recToeF = clamp(-0.20, 0.15, toeFByBuild + (frontBias-50)×-0.003 + (fHz-1.8)×0.010)
```

Rounded to the nearest 0.1° — Forza's toe input only accepts one decimal
place, so anything finer isn't actually enterable in-game. `toeFByBuild`'s
own 0.05° table increments already get rounded down to this same 0.1° grid
in the final recommendation.

| Build | toeFByBuild (FWD / other layouts) |
|---|---|
| Street | 0.05 / 0.0 |
| Track | 0.05 / −0.05 |
| Drift | 0.0 / −0.10 |
| Rally | 0.0 / 0.0 |
| Offroad | 0.05 / 0.05 |
| Drag | 0.0 / 0.0 |
| *(unmatched build)* | −0.05 (fallback) |

The `(frontBias-50)×-0.003` term nudges toe-in slightly with front-heavier
cars; `(fHz-1.8)×0.010` nudges toward more toe-in with stiffer front springs
(verified against the actual formula — a prior version of this doc had the
direction backwards).

## Toe rear (`recToeR`)

```js
recToeR = clamp(0.0, 0.25, toeRBase + (rearBiasFraction-0.5)×0.20 + max(0, rHz-fHz)×-0.03)
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
recCaster = clamp(4.0, 7.5, casterBase + (fHz-1.8)×0.4 + (frontBias-50)×0.04 + (layout==='FWD' ? -0.5 : 0))
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

## Alignment Mode (PRO)

PRO mode adds an ALIGNMENT sidebar section (`zone-alignment`) storing four
possible values in `al.mode` (`ALIGN_MODE_DEC`: BUILD/MECH/GRIP/MANUAL), but
the UI presents them as a two-tier hierarchy rather than four flat peer
buttons, since they aren't actually peers — BUILD is the baseline every
other value is a small perturbation of (or a full bypass, for MANUAL):

- **Top tier — AUTO / MANUAL.** AUTO covers BUILD/MECH/GRIP (`computeAlignment`,
  optionally nudged); MANUAL is a full bypass. Picking AUTO here sets
  `al.mode='build'` (any previous MECH/GRIP nudge selection resets to OFF —
  there's no separate memory of it).
- **Second tier — Nudge: OFF / MECH / GRIP** (shown only under AUTO). Sets
  `al.mode` directly to `'build'`/`'mech'`/`'grip'` — the second tier is just
  a different arrangement of the same stored values, not additional state.

INT and Beginner always get BUILD — the whole section (and thus the Nudge
sub-tier/MANUAL) is PRO-only, since there's nothing to configure without it.

| `al.mode` | What it does |
|---|---|
| **build** (AUTO / Nudge OFF, default) | `computeAlignment`'s output, unchanged — see the rest of this file |
| **mech** (AUTO / Nudge MECH) | Nudges camber and toe toward `gap = feEffective.arbBalTarget − naturalMechBalanceOf(ch)` — the same signal `computeDiff`'s MATCH CHASSIS uses (see [FORMULAS.md](FORMULAS.md)). Reinforces whatever oversteer/understeer intent you've explicitly dialed into the Mech Balance Target. Note the minuend is the **resolved** target, not `resolveArbBalTarget(ch,fe)` directly as this row said until an audit: under Balance Target mode GRIP, `feEffective.arbBalTarget` is the grip-derived value instead, so MECH and GRIP nudge from the same number whenever GRIP target mode is active |
| **grip** (AUTO / Nudge GRIP) | Nudges using `gripGap = -(natGripBalance-0.5)` instead — counteracts the chassis's own natural at-limit tendency (understeer-prone chassis gets pushed toward more aggressive/oversteer-leaning alignment, and vice versa), independent of whatever ARB balance mode is active |
| **manual** | Direct entry — wires up `al.camberF/camberR/toeF/toeR/caster` (these fields, plus `al.alignManual`, predate this feature and were previously unused dead state with no UI) |

`mechGap` and `gripGap` are both differences of ~0.5-centered 0–1 fractions
(`arbBalTarget`, `naturalMechBalanceOf`, and `natGripBalance` are all
balance-fraction values on the same scale), so the two nudge sources
saturate the shared `normGap` clamp below at comparable real-world
magnitudes. `gripGap` used to be pre-multiplied by `2` before that clamp,
which made GRIP saturate to full nudge strength for almost any chassis while
MECH rarely did — despite both being presented as equal-strength options.

**MECH/GRIP nudge formula:**

```js
normGap = clamp(-1, 1, rawGap / 0.30)       // rawGap = mechGap or gripGap depending on mode
k = normGap * (nudgeStrength / 100)          // nudgeStrength: 0-100 slider, 0 = identical to BUILD

recCamberF = clamp(-4.0, 0.0, buildCamberF - 0.5*k)    // more oversteer-leaning (k>0) → more front bite
recCamberR = clamp(-3.5, 0.0, buildCamberR + 0.3*k)    // more oversteer-leaning (k>0) → less rear grip, freer rotation
recToeF    = clamp(-0.20, 0.15, buildToeF - 0.10*k)    // more oversteer-leaning (k>0) → more toe-out, sharper turn-in
recToeR    = clamp(0.0, 0.25, buildToeR - 0.10*k)      // more oversteer-leaning (k>0) → less toe-in, freer rear
recCaster  = buildCaster                               // never adjusted — not an oversteer/understeer lever
```

`recToeF`/`recToeR` still round to the nearest 0.1° — same as BUILD's own
toe rounding, matching Forza's toe input precision (one decimal place, so
anything finer isn't actually enterable in-game). The toe coefficient is
`0.10` here (not `0.05`, camber/toe's other coefficients are unchanged) so
that a fully-saturated nudge (`k=±1`) can cross one whole 0.1° step reliably
instead of landing under the rounding threshold every time. At more typical
gaps/strengths the toe nudge still often rounds back to BUILD's value — that
reflects the real precision ceiling, not a bug.

The **Nudge Strength** slider (0-100%, default 50%) controls `k`'s
magnitude only — direction always comes from `rawGap`'s sign. At 0% every
output is identical to BUILD; verified manually that camber/toe converge
back to the BUILD baseline exactly at 0%.

Persisted in `suspos_al_v2` (see [PERSISTENCE.md](PERSISTENCE.md)) alongside
the legacy `alignManual` boolean, which is still read as a fallback for old
saved state (`al.mode ?? (al.alignManual ? 'manual' : 'build')`) so existing
users who had it set don't silently revert to BUILD.
