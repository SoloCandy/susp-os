# SUSP.OS — Vehicle DNA (handling personality)

A saved, chassis-portable description of *how a car should drive* — sharp and
agile, compliant and forgiving, planted, tail-happy — that is applied to whatever
chassis is loaded by solving the tune that produces it on that car.

> **Status: implemented in PRO, first-pass UI.** The editor lives in the DNA
> modal (sidebar toolbar); the look is expected to change once it has been used. Core functions sit
> under the `── Vehicle DNA ──` banner in `index.html` and are exercised by
> `tests-dna.js`.

Scope note: this file is the design of a layer that sits *above* the solver. It
introduces no new physics and no new calibration constant. The solve math it
drives lives in [PHYSICS.md](PHYSICS.md); the balance-direction math in
[FORMULAS.md](FORMULAS.md).

---

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Apply model | **Apply once.** APPLY stamps `fe`/`dr`; nothing re-solves when the chassis is edited afterwards | Live binding fights manual edits, and the one live re-solve the app has (`rideBottomG`) shipped with a two-effect race. See [PHYSICS.md](PHYSICS.md#bottom-gs-stiffness-mode) |
| Balance axis | **Absolute offset from grip-neutral** — GRIP mode's own Balance Offset | Same meaning and authority on every chassis, and compiles with no transformation. A delta from NAT only carries Forza's displayed number; a gap fraction was accepted first and then rejected. See [Why not a gap fraction](#why-not-a-gap-fraction) |
| First tier | **PRO** | PRO already has the solvers the compiler needs (SHARE %, MECH, GRIP) |
| Integration | **Compile into ordinary `fe`/`dr` fields**; never modify `feelToPhysics`/`computeTune` | Keeps the calibrated core, every saved tune, the share codec and `tests-beamng.js`'s invariants untouched |
| Storage format | **Axis targets**, never macro-slider positions | Macro mappings will be retuned; stored macro positions would silently move every saved DNA — the same trade [KNOWN_ISSUES.md](KNOWN_ISSUES.md) records for RESPONSE's ζ normalisation |
| Hz arrangement | **MECH ARB split + MULTIPLIER**, not CO-SOLVE | CO-SOLVE cannot hold pitch independently. See [Why not CO-SOLVE](#why-mech-and-multiplier-and-not-co-solve) |
| Ride reference | **FRONT** | SYNC holds the reference axle's ζ exactly, so rebound ζ round-trips |

---

## What a personality is

`fe` already holds two kinds of field:

- **Settings** tell a mechanism what value to use: `arbBias`, `arbShareMan`,
  `arbBasicMan`, `rearHzMult`, `dampingBias`.
- **Targets** say where the car should end up, and a solver picks the settings:
  `arbBalTarget`/`arbBalDelta` (MECH, CO-SOLVE, GRIP), `arbTargetRollMan` (ROLL °),
  `settleTarget`, `rideBottomG`.

A garage **build** (`fe` + `dr`, no `ch`) already loads onto any chassis. Its
*numbers* carry over; its *handling* does not, because the same settings on a
different chassis land somewhere else. Some quantities already mean the same thing
on any car — Hz is mass-normalised (`k = m·ω²`), ζ is dimensionless, bump ratio and
the Hz multiplier are ratios. The ones that do not are **balance** and **bar stiffness**,
where the default controls are settings. That is where a DNA earns its keep, plus
bundling the axes and deciding which gives way when they cannot all be met.

> **A personality is a chassis-normalised target for the car's outcomes. Applying it
> means inverting the solver for this chassis.**

With chassis `c`, tune `x`, and the existing forward solve `y = F(c, x)`:

```
ŷ  = N(c, p)                                    denormalise the DNA vector p for this chassis
x* = argmin over x ∈ X(tier, game)  of how far F(c, x) misses ŷ, per the DNA's priority order
```

`p` is portable because `N` absorbs the chassis. In practice PRO needs almost no
search: every axis maps to one field in a mode where that field already *is* a
target, and search only runs when the game's limits make targets conflict.

---

## The axes

| Axis | Outcome read back | Stored as | Range | Compiles into |
|---|---|---|---|---|
| `platformHz` | `tune.fHz` | Hz | `HZ_MIN`..`HZ_MAX` | `fe.rideStiffness` |
| `pitchRatio` | `tune.rHz / tune.fHz` | ratio | 0.50..3.00 | `fe.rearHzMult` |
| `arbShare` | `tune.arbShare` | % of total roll stiffness from the bars | 0..80 | `fe.arbShareMan` |
| `balanceOffset` | `tune.mechBalance − gripTarget` | mech balance past grip-neutral, + = OVERSTEER | −0.20..+0.20 | `fe.arbBalDelta` |
| `reboundZeta` | `tune.zetaF` | % | 10..200 | `fe.reboundZeta` |
| `bumpRatio` | `tune.bumpZetaF / tune.zetaF` | % | 10..100 | `fe.bumpRatio` |
| `dampBias` | `−fe.dampingBias` | slider value, + = REAR | −50..+50 | `fe.dampingBias` |
| `diffExit` | slider reading of `dr.diffBiasExit` | slider value, + = ROTATE | −50..+50 | `dr.diffBiasExit` |
| `diffEntry` | slider reading of `dr.diffBiasEntry` | slider value, + = LOOSE | −50..+50 | `dr.diffBiasEntry` |

Every range is the `sanitizeTune` clamp of the field the axis compiles into, so a
compiled patch can never be rewritten by the sanitiser.

The first six are **outcome axes**: read from `tune`, so any tune can be measured
against them whatever modes it uses. The last three are **setting axes**: they only
mean the same thing when the tune is in the modes the compiler sets (see
[Measuring a tune against a DNA](#measuring-a-tune-against-a-dna)).

### Slack: how much of a target the personality needs

Every axis was a point target: the compiled tune had to land on it, within whatever quantisation
`dnaTolerances` allows, or the axis missed and the resolver started spending other axes to reach
it. That is stricter than a personality usually means. GT3 wants a small bar contribution; it does
not want *exactly* 4.5%.

`slack` is a per-axis half-width, stored on the DNA, added to the quantisation allowance when the
resolver decides whether an axis hit. It is **optional, sparse and defaults to 0**, so a DNA that
sets none behaves exactly as it did before.

- **Outcome axes only** (`DNA_SLACK_AXES`). The setting axes are written verbatim and always land.
- **Capped at half the axis range** (`dnaSlackMax`). Past that a "target" spans everything
  reachable and stops meaning anything.
- **`applyDNA` reports `accept`** — the quantisation allowance plus the slack — so a caller never
  adds the two itself and then disagrees with the resolver about what counts as met.
- **Drift is unaffected.** It is judged against `achieved`, not the target, so slack has no say in
  it.

What it buys is the resolver *not* spending a more protected axis on a target that was never that
precise. GT3 asking for the 8.5% share its v1 roll seed produced, in Motorsport, where 40-click
bars cannot sit on it, with share ranked first:

| `slack.arbShare` | Result |
|---|---|
| 0 | platform moved 3.30 → 3.64 Hz to hit the share exactly |
| 3 | share met at 9.1% where it lands; platform stays on 3.30 Hz |

The editor shows it as an **ACCEPT ±** box under each outcome axis, and the match readout says
`✓ 9.1% · within ±3.0% of 8.5%` — met, but not on the target, which is a different thing from a
bare ✓.

**The archetype seeds do not use it yet.** [Share seeds](#share-seeds-fit-motorsports-bars) records
why each was moved to a value that lands in Motorsport; slack is the mechanism that would let them
be seeded where they belong instead, with the reachable range expressed rather than implied. That
is a tuning decision to make in-game, not a mechanical one, so the seeds are unchanged.

### Balance: an absolute offset from grip-neutral

`balanceOffset` is how far the car's mech balance sits from grip-neutral, in
mech-balance units: positive is the oversteer side, negative the understeer side, 0
is neutral — the same meaning and the same authority on every chassis.

```js
gripTarget = 1 - balanceFromRsBal(ch, natRsOf(ch))   // grip-neutral mech balance (roll-stiffness natural)
target     = gripTarget + balanceOffset
```

This is GRIP mode's own Balance Offset. The `feEffective` funnel in `App` already
resolves `gripBalTarget = 1 − natGripBalance + arbBalDelta`, so the axis compiles
with no transformation at all:

```js
arbBalDelta = balanceOffset             // with arbBalTargetMode:'grip'
```

It measures back as `tune.mechBalance − gripTarget`; the grip model behind
`balanceFromRsBal` is in [PHYSICS.md](PHYSICS.md#mech-balance-grip-model-mechbalancelltbalancefromrsbal).
The axis range is `arbBalDelta`'s own ±0.20 `sanitizeTune` clamp, so the one clamp
left that can stop it landing is `gripBalTarget`'s 0.20..0.90, which the resolver
treats as a balance miss.

**Apply-once costs almost nothing here.** `feEffective` re-resolves the GRIP target
against the *current* chassis on every render, so after a chassis edit the stamped
`arbBalDelta` still means the same offset from that chassis's grip-neutral. SHARE %
behaves the same way, because `computeTune` re-sizes the bar budget from the current
springs. Balance and share drift from the DNA only when a limit bites, or when
a resolver move made for the old chassis no longer fits the new one.

### Why not a gap fraction

The first design stored balance as a fraction `f` of the gap between the chassis's
natural mech balance and grip-neutral — the normalisation the Balance Guide's
`BALANCE_BAND_FRACS` uses — anchored at grip-neutral with a floor:
`gripTarget + (f − 1)·max(gap, 0.03)`. It was accepted, then rejected once real
chassis were run through the natural balance and `balanceFromRsBal`.

**A negative gap is not rare.** PHYSICS.md described it as the rare chassis whose
natural balance already sits past its grip target, until the same finding corrected
it there. The sign flips just under 50% front — about 49.5% on the default chassis — and a
wide front tyre stagger flips it too; a broad grid over layout, weight bias, track
widths, tyre sizes, CG height and weight found it negative at about half its points.
A plain fraction then points the wrong way on every mid-engined car, and the floor
that fixed the sign gave all of them the minimum authority.

**Authority scaled with weight distribution.** Default chassis (3200 lb, track 1.55 /
1.52 m, 265/35R18 all round, CG 0.45 m) with only front weight bias changed. The last
column is how far a mildly tail-happy `f = 1.15` put the target past grip-neutral:

| Front bias | gap | Floored gap | Move past neutral at `f = 1.15` |
|---|---|---|---|
| 45% | −0.111 | 0.030 | 0.0045 |
| 50% | +0.012 | 0.030 | 0.0045 |
| 55% | +0.134 | 0.134 | 0.020 |
| 60% | +0.256 | 0.256 | 0.038 |
| 65% | +0.378 | 0.378 | 0.057 |

At 45% and 50% the move sits below `mechBalClamped`'s own 0.01 tolerance: the
personality did nothing measurable on a balanced or rear-biased car, and about 13×
more on a 65% front car. The understeer side scaled the same way. Layout does not
change the gap; tyre stagger does (225 front / 325 rear: +0.315; the reverse: −0.192).

Flooring `abs(gap)` instead keeps the proportionality and makes `f = 0` stop meaning
"natural" on rear-biased cars; raising the floor moves the collapse rather than
removing it. Proportionality to a chassis's own bias *is* the part that does not port,
so the axis dropped it.

The Balance Guide uses the same fraction and has run into the same fold. Its DRIFT
overshoot pointed at understeer on rear-biased cars until `balanceBandDelta` anchored
fractions above 1.0 at grip-neutral — the same anchor this design tried first — which
made the delta V-shaped, so `balanceBandRange` now has to include grip-neutral
explicitly. Its fractions at or below 1.0 still rank builds by how much natural
tendency they cancel rather than by rotation, which is recorded as open in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md). An absolute offset has neither problem, because
it never multiplies by the chassis's own gap.

### ARB share rather than roll degrees

v1 had `rollDegPerG`, compiled to ROLL ° (`arbTargetRollMan`). It was replaced by
`arbShare`, compiled to SHARE % (`arbShareMan`), because a roll target did not carry
between chassis. Measured by carrying each archetype's value unchanged to ten synthetic
chassis (the fixture set plus low CG, high CG, 2,200 lb and 4,500 lb), axis only:

| Game | Roll hits | Share hits (share equivalent to the roll seed) |
|---|---|---|
| Horizon | 33/40 | 37/40 |
| Motorsport | 33/40 | 25/40 |
| BeamNG | 36/40 | 38/40 |

- **Roll missed on CG height, in every game including BeamNG**, where bars have no
  ceiling: body roll scales with the roll moment arm, a low-CG car leans less than the
  target on springs alone, and CG height is the number the app estimates. A roll
  target is only as right as that estimate.
- **Share misses at the game's bar range**, which is known exactly. Nearly all of the
  Motorsport misses came from stiff archetypes asking for more share than 40-click bars
  give at 3.3 Hz — which is why the seeds were then chosen for Motorsport (see
  [Share seeds](#share-seeds-fit-motorsports-bars)).

Neither gives the bars more authority: both are limited by the same click range, and
both windows shrink as platform Hz or car weight rises, because bars add a fixed
stiffness per click while springs scale with mass and Hz. On the default chassis at
pitch 1.1 the Horizon share window runs 3–41.5% at 1.6 Hz and 0–13% at 3.3 Hz
(Motorsport 3–30% and 0–8%).

A saved v1 DNA migrates in `sanitizeDNA`: roll cannot be converted without a chassis,
so the axis takes the `arbShare` default and its `keep` rank carries over.

### Rebound ζ rather than settle seconds

From `settleTimeFromZeta`'s underdamped branch, `t = ln10 / (ζ·2π·fₙ)`, so

```
t · fₙ = ln10 / (2π·ζ) ≈ 0.366 / ζ
```

ζ *is* settle time measured in natural periods. Storing ζ keeps a personality's
damping character when `platformHz` moves (including when the resolver moves it);
storing seconds would force ζ to change with every Hz change.

### Sign conventions

Every axis stores the value **as its slider reads**, so a DNA and the sidebar agree
at a glance. Three stored fields are not in slider convention, and the compiler
converts at the boundary:

| Axis | Slider convention | Stored field | Conversion |
|---|---|---|---|
| `dampBias` | + = REAR (oversteer) | `fe.dampingBias` | always negated — the slider is `value={-(fe.dampingBias??0)}` |
| `diffExit` | + = ROTATE (oversteer) | `dr.diffBiasExit` | negated on FWD only — the slider flips for FWD |
| `diffEntry` | + = LOOSE (oversteer) | `dr.diffBiasEntry` | always negated — stored `+50` is STABLE (`computeDiff`) |

---

## Schema

```js
// DNA v2. Values are axis targets in slider conventions — never macro positions.
{
  v: 2,
  name: 'RALLY WEAPON',
  axes: {
    platformHz: 1.60,   pitchRatio: 1.03,   arbShare: 12.5,     balanceOffset: -0.035,
    reboundZeta: 55,    bumpRatio: 38,      dampBias: 5,
    diffExit: -5,       diffEntry: 15,
  },
  // Optional, sparse, outcome axes only: how far each may land from its target and still be met.
  slack: { arbShare: 3 },
  // Most protected first. A permutation of the five axes that can give way;
  // the setting axes never conflict, so they are not ranked.
  keep: ['platformHz', 'balanceOffset', 'reboundZeta', 'pitchRatio', 'arbShare'],
}
```

- `v` exists so a future axis or a changed meaning can migrate rather than
  misread. Adding an axis with a sensible default does not need a bump — same rule
  as [PERSISTENCE.md](PERSISTENCE.md).
- `slack` is optional and **sparse**: an axis with no slack is simply absent, and a DNA that
  uses none stores `{}`. See [Slack](#slack-how-much-of-a-target-the-personality-needs).
- `keep` is an order, not weights. An order is explainable in the UI ("share gave
  way to keep balance") and resolves every pairwise conflict consistently.
- **`surface` is deliberately absent from v1.** It was proposed as the arbiter for
  bump damping's surface-dependent sign, but its only consumer would be the macro
  sliders, which are deferred. A field with no reader is exactly what the next
  audit deletes. It arrives with the macros.

---

## Compiling a DNA into a tune

`compileDNA(ch, dna, gameMode)` returns a `{fe, dr}` **patch**, spread over the
current state, so everything it does not name — `gameMode`, `targetSpeed`, the
manual ARB fields — survives.

### The patch

| Axis | Field written | Mode fields set |
|---|---|---|
| `platformHz` | `rideStiffness` | `rideRef:'front'`, `rideStiffMode:'hz'` |
| `pitchRatio` | `rearHzMult` | `rearHzMode:'multiplier'` |
| `arbShare` | `arbShareMan` | `arbMode:'share'` — sets the total bar budget as a fraction of roll stiffness |
| `balanceOffset` | `arbBalDelta` | `arbBalMode:'mech'` — solves the front/rear bar split; `arbBalTargetMode:'grip'` |
| `reboundZeta` | `reboundZeta` | `dampCharMode:'zeta'` |
| `bumpRatio` | `bumpRatio` | `dampingMode:'ratio'` |
| `dampBias` | `dampingBias` | `dampBalMode:'sync'` |
| `diffExit`, `diffEntry` | `dr.diffBiasExit`, `dr.diffBiasEntry` | `dr.diffManual:false` |

**Never written:** `ch` (including layout), `dr.buildType`, `dr.diffType`, the AWD
front-exit and centre fields, `al`, and brakes. Brake bias is computed-only by
design — see [CODE_MAP.md](CODE_MAP.md)'s intentionally-absent section — and a DNA
must not become a back door to a manual override.

Share and balance are not searched: SHARE % sizes the bar budget from the springs,
and MECH solves the split within that budget. Both already exist in
`computeTune`.

### Why MECH and MULTIPLIER, and not CO-SOLVE

CO-SOLVE derives the rear/front Hz ratio from the spring share `S`:

```
Rsp = Rbl + S·(rst − Rbl),   Kcs = √( Rsp·mF·trackF² / ((1 − Rsp)·mR·trackR²) )
```

with `Rbl = W/(V+W)`, `V = mF·trackF²`, `W = mR·trackR²`. At `S = 0`,
`Rsp/(1 − Rsp) = W/V`, so `Kcs = 1` exactly, and as `S` rises the ratio can only
move toward the side the balance correction points. Pitch is therefore not an
independent axis in CO-SOLVE: a DNA asking for 1.15 on a car whose correction wants
a softer rear is unreachable by construction. MULTIPLIER sets pitch directly and
MECH puts the whole balance correction on the bars, which keeps the two axes
independent until a bar limit is hit — and that limit then shows up as a miss the
resolver can reason about.

### Why the front ride reference

Under SYNC, `balancedZetas`/`settleZetas` hold the reference axle at the anchor ζ
exactly and derive the other. With `rideRef:'front'`, `tune.zetaF` is the stored
`reboundZeta` up to the 0.1-click rounding `impliedZeta` reports. Under SHARED
neither axle holds it, so rebound ζ would never round-trip. `platformHz` is
therefore the front axle's frequency, not an average.

### One `feEffective` funnel

`feEffective` — the step that resolves `arbBalTarget` (a stored delta) or GRIP's
`arbBalDelta` into the absolute target the physics sees — used to be built inline in
`App`. The compiler has to run the identical resolution, so it is now the pure
`resolveFeEffective(ch, fe)`, and `App`'s `feEffective` is a call to it; grip-neutral
itself is `gripNeutralOf(ch)`. A second copy would have repeated the `natOffset`
incident, where one idea implemented at four sites drifted apart (see
[HISTORY.md](HISTORY.md)). `tests-dna.js` fails if an inline copy reappears.

---

## Conflicts

### Detecting a miss: residuals, not flags

After compiling, run `resolveFeEffective` → `feelToPhysics` → `computeTune`, then
measure the result (see [Measuring a tune against a DNA](#measuring-a-tune-against-a-dna)).
An axis **misses** when its residual exceeds tolerance. Flags only explain *why*.

Flags alone are not enough: the pitch row judges the rear the DNA asks for against
the Hz band directly, rather than trusting `rearHzClamped`, so the cause it names
does not depend on which axle the active reference derives (see
[PHYSICS.md](PHYSICS.md#when-the-band-clamp-is-reported-physicsrearhzclamped)).

`dnaTolerances(tune, gameMode)` sets each allowance to half of one quantisation step
of whatever produced the number, so rounding the game imposes is never reported as a
miss:

| Axis | Tolerance | Source |
|---|---|---|
| `platformHz` | 0.005 Hz, plus half a 500 N/m spring step in Hz in physical modes (`ΔHz/Hz = ½·Δk/k`) | `compileDNA`'s own 0.01 Hz rounding — `DNA_AXES.platformHz`'s step, deliberately coarser than `sanitizeTune`'s 0.001 Hz grid; `PHYS_SNAP.spring` |
| `pitchRatio` | exact in Forza; the two axles' half spring steps in physical modes | `PHYS_SNAP.spring` |
| `arbShare` | `tune.arbShareTol`: half a bar step (Forza 0.1 click, BeamNG's anti-roll spring grid) in share points, at least 0.5 | `shareClamped`'s own threshold, already downstream of bar rounding |
| `balanceOffset` | 0.01 | `mechBalClamped`'s own threshold |
| `reboundZeta` | ζ × half a damper step ÷ the rebound value — 0.05 click in Forza, 50 N·s/m in physical modes | `clampDamp` rounding; `PHYS_SNAP.damp` |
| `bumpRatio` | the same, summed over the rebound and bump dampers | as above |
| setting axes | exact | written verbatim |

`tests-dna.js` checks this against the app's own flags: across fixtures, game modes and
a grid of share and balance targets, a DNA share hit is exactly `!shareClamped`, a balance
hit is exactly `!mechBalClamped`, and no damping miss is reported while
`dampingClamped` is false.

### Which axes can give way

| Missed axis | Cause | Candidates that can move |
|---|---|---|
| `pitchRatio` | `platformHz · pitchRatio` outside `HZ_MIN`..`HZ_MAX` | `pitchRatio`, `platformHz` |
| `reboundZeta` or `bumpRatio` | `tune.dampingClamped` — a pair was scaled to fit the click range (down at the ceiling, up off the 1-click floor) | `reboundZeta`, `platformHz` (lower Hz needs fewer clicks, higher Hz more). `bumpRatio` is not ranked; the row uses `reboundZeta`'s rank |
| `arbShare` | `tune.shareClamped` — a bar at its ceiling ("at their limit") or its 1-click floor, often because MECH pushed the split to one end | `arbShare`, `platformHz` (softer springs let the bars reach a larger share) |
| `balanceOffset` | `tune.mechBalClamped`, or the `gripBalTarget` clamp | `balanceOffset`, `pitchRatio` (springs take part of the correction), `arbShare` (a bigger bar budget gives the split more authority) |

The rows are in **dependency order** and are handled top to bottom. Balance depends
on the bar budget: MECH can only split what SHARE supplies, and a bar pinned at its
floor or ceiling misses share and balance together. Resolving share first often clears
balance for free.

### The resolver

`applyDNA(ch, fe, dr, dna)`:

1. `sanitizeDNA`, compile, and measure.
2. Take the first row in the table whose axes miss and that has not been accepted.
3. Try its candidates **least protected first**. Reaching the missed axis itself means
   everything left is more protected, so the miss is **accepted** instead.
4. A candidate is searched toward **both** ends of its range: 96 steps outward from its
   current value, then bisection inside the first step that clears. The nearer
   clearing value wins. It clears only if the missed axes hit, the candidate hits its
   own new value, and every axis ranked above the candidate that currently hits still
   hits — a move may only spend axes ranked below itself.
5. If **no** single candidate clears it and at least two are eligible, try them **in pairs**
   (see below). A pair costs two of the move budget.
6. After any move, every accepted miss is judged again, because a move can unblock one:
   lowering pitch for balance can make a share miss fixable that no platform value
   could fix before. Stop after `DNA_MAX_MOVES` (4) moves or when nothing is left to
   resolve.

### Two candidates together

The single-candidate search rejects a move that breaks an axis ranked above it, and that used to
end the row. On a rear-biased chassis in Horizon, GT3 with balance ranked first shows the gap:
raising pitch reaches the balance offset but drops share below its 1-click floor, and share alone
cannot reach balance — so both were refused and the balance miss was accepted, although moving
pitch **and** share together clears it.

The pair pass is not a 2-D search. The **less protected** member moves first with the other
**released** from its guard — allowed to break — and then the more protected member moves to
repair itself while holding the first one's new value and the axes that were missing. Two 1-D
searches, a few milliseconds, instead of a grid.

The cost of a pair is the cost of its **more protected member**, which is what makes it legal
under the same rule as a single move: that member moving alone would already have been permitted
to spend everything ranked below it, and that is exactly what the other member's guard is relaxed
to. The invariant is unchanged — nothing ranked above *every* moved axis is broken, and both
members are still ranked below the axis they protect.

Both halves carry `with`, naming the other, so the readout says *moved with ARB SHARE to keep
BALANCE* rather than showing two unrelated concessions.

Measured over every archetype, eight chassis, three games and all 120 `keep` permutations —
11,520 applies: 30 resolutions improved, none got worse, worst case 9.4 ms.

There is no per-axis direction table. An earlier draft of this section listed one
("share too low → lower `platformHz`" and so on); searching both ways gets the same
answers without a table that could be written backwards.

The result carries `moves` (`{axis, from, to, protects, cause, with?}`), `misses`
(`{axis, target, achieved, cause}`) and `inexpressible`, for the match readout — e.g.
*ARB share 30 → 13%, anti-roll bars at their limit* — so the app never presents a
compromise as the target. This is the same principle as `impliedZeta` and the ARB
stiffness being recomputed from clamped clicks. A typical apply takes well under a
millisecond; `tests-dna.js` fails if the worst case in its sample reaches 50 ms.

**Limits worth knowing:**

- **At most two axes at a time.** Three lower-ranked axes moving together is not searched,
  and the pair pass only runs on rows with two eligible candidates — in practice that is
  the balance row, the only one with three candidates.
- **Resolution.** A clearing window narrower than one 96th of an axis's range can be
  stepped over. Such windows are real: on a 60% front chassis MOMENTUM's balance clears
  only across roughly 0.07 of pitch, because raising the rear spring rate moves the
  springs the share budget is sized from. (Measured under the v1 roll axis.) A 12-step first version missed exactly those. A window
  that is missed is reported as a miss, never hidden.
  Raising the count further was measured and is **not** a win: at 288 steps over the same
  11,520-apply grid, 8 cases improved and 12 got worse. The search is greedy, so finding a
  nearer clearing value first can lead the rest of the resolution somewhere worse. 96 stays.
- **Greedy.** Rows resolve in dependency order, not by a global optimum.

The resolver reads the same measurements in all three game modes. BeamNG has no
click ceilings, so `dampingClamped` and bar-ceiling share misses do not arise there;
nothing branches on the mode name.

### Not conflicts: inexpressible settings

- **Sport diff** has no decel lock in-game, so `diffEntry` cannot be expressed. It
  is reported as N/A, not resolved.
- **AWD** front-exit bias and centre split are outside v1; `diffExit` maps to
  `diffBiasExit`, which is the rear axle on AWD.

---

## Measuring a tune against a DNA

`measureDNA(ch, tune, fe, dr)` is the inverse of `compileDNA`, and it is what the
match readout shows.

```js
platformHz    = tune.fHz
pitchRatio    = tune.rHz / tune.fHz
arbShare      = tune.arbShare
balanceOffset = tune.mechBalance - gripNeutralOf(ch)
reboundZeta   = tune.zetaF
bumpRatio     = 100 * tune.bumpZetaF / tune.zetaF
dampBias      = fe.dampBalMode === 'sync' ? dnaNeg(fe.dampingBias) : null
diffExit      = dr.diffManual ? null : (ch.layout === 'FWD' ? dnaNeg(dr.diffBiasExit) : dr.diffBiasExit)
diffEntry     = dr.diffManual || dr.diffType === 'sport' ? null : dnaNeg(dr.diffBiasEntry)
```

`dnaNeg` negates without producing −0, which would survive JSON as 0 but fail
`Object.is` against it; `compileDNA` uses it for the same three fields.

`tune.mechBalance` and `gripBalTarget` are on the same scale — both include the
tyre-width and MEASURE NAT BAL corrections — which is what `mechBalClamped` already
relies on.

A `null` renders as **mode differs**, not as a number. A setting axis read under
different modes would compare two quantities that merely share a name.

### Reading a tune back as a DNA

`dnaReadBack(ch, fe, dr, tune, from)` turns a measurement into a DNA you can edit and
apply. TUNE CHECK's **IMPORT AS DNA** button is its first caller; anything else that wants
make a DNA out of a tune should go through it rather than calling `measureDNA` and
patching the holes itself.

It differs from a plain reading in exactly two places, because a DNA has no room for a
`null`:

- **An axis that reads `null` falls back to `from`**, the axes already in the editor.
  A tune in MANUAL DIFF says nothing about `diffExit`; inventing a number it never
  stated would be worse than leaving the draft's value where it was. The editor still
  shows the axis as *not expressible with this diff* on the chassis in front of it.
- **`dampBias` is converted, never dropped.** The axis is only defined under SYNC, so a
  tune in STANDARD or NEUTRAL would otherwise lose its whole front/rear damper split.
  Instead the bias is recovered from the zetas by inverting `settleZetas`'
  front-reference solve:

  ```
  rate(ζR) · rHz = rate(ζF) · fHz · biasMult      biasMult = 2 ^ (dampBias / 50)
  ⇒  dampBias = 50 · log2( rate(ζR) · rHz / (rate(ζF) · fHz) )
  ```

  `rate` is `dampRate`, the same piecewise decay rate SYNC itself uses, so this inverts
  SYNC's own forward formula exactly. It asks the axis's real question — *what bias
  reproduces this front/rear ζ split* — rather than copying a stored field that means
  something else in whichever mode wrote it.

Everything is then clamped into `DNA_AXES`, so the result is a `sanitizeDNA` fixed
point. Two things that clamp are worth knowing rather than treating as bugs: a chassis
whose grip-neutral sits far from its tune can measure a `balanceOffset` past ±0.20, and
an axle `rateToZeta` pinned at critical damping cannot be inverted exactly.

`tune.zetaF`/`zetaR` are back-calculated from the **rounded** damper values, so a
read-back carries the game's damper quantisation — the same half-step `dnaTolerances`
allows `reboundZeta`, propagated through the log above. On a Forza tune with small
damper clicks that is a few tenths of a bias point.

---

## Storage and transport

| What | Where | Notes |
|---|---|---|
| The editor's draft and the last APPLY | `suspos_dna_v1` = `{ draft, applied }` | Object-valued, so `mergeDefaults` fills new fields for free |
| Saved custom DNAs | garage entries carrying only `dna`, kind `'dna'` | Listed in the MY DNA drawer, not the main garage list; included in BACKUP/RESTORE |
| Which DNA a saved build came from | optional `dna` on a garage entry beside `fe`/`dr` | Not part of `kindOf` — a build with a `dna` is still a build |
| Factory archetypes | `DNA_ARCHETYPES` constant | Buttons in the DNA modal |
| Share codes | `encodeDNA`/`decodeDNA` — a separate codec, prefix `DNA-` | Its own version and ids; nothing threaded through `CODEC_FIELDS`. See [CODEC.md](CODEC.md#the-dna-codec--a-second-separate-code) |

`draft` is a DNA plus `ref`, what it was loaded from: `{name, axes}` for an archetype,
`{id, name, axes}` for a saved DNA. `sanitizeDNA` drops `ref`, so the app reads it off
the stored draft. A saved DNA is looked up live by `id`, so renaming or rewriting the
entry shows at once; `ref`'s own `name`/`axes` stand in if the entry was deleted. The
ref drives "EDITED FROM …", REVERT, and the APPLY name (`GT3 (edited)`).

`applied` is `{ name, axes, achieved }`: the name shown in the sidebar, the axis
targets, and what `measureDNA` read straight after APPLY. **Drift is judged against
`achieved`, not the targets**, so a resolver compromise is not reported as drift the
moment it is applied. An axis has drifted when its current measurement is more than its
`dnaTolerances` allowance from `achieved`, or when it reads `null` (mode differs)
where it didn't before.

**A saved DNA is `{ id, name, dna, tags, notes, createdAt, updatedAt }`** with `dna` a
`sanitizeDNA` shape. `kindOf` returns `'dna'` only when there is no `ch`/`fe`/`dr`; a
`dna` beside `fe`/`dr` is still a build's provenance. The main garage list, its ALL
count and its empty states use `garageEntries`, which excludes the kind; BACKUP and
RESTORE list it as a fourth checkbox. **Factory archetypes stay out of the entry list** for the reason presets do —
see [PRESETS.md](PRESETS.md).

**A DNA shares on its own code, never through `CODEC_FIELDS`.** A DNA group there would mean
permanent tune-codec ids threaded through `DEF_GROUPS`/`encodeTune`/`decodeTune`/`sanitizeTune`
for an object no solver reads. A separate table costs nothing on that side and lets an axis change
meaning under its own version without touching a single tune code. The code carries the axes,
`slack`, `keep` and the name; it does **not** carry `ref` or the applied link, which are local
state about where a draft came from. Decoding replaces the editor's draft with no `ref` — it came
from somewhere else, so "edited from" would name a DNA this app never had — and is not a commit.
Field table and rules: [CODEC.md](CODEC.md#the-dna-codec--a-second-separate-code).

### The applied link

APPLY is still apply-once: nothing re-solves when the chassis or a control changes.
The link only drives read-outs. What happens to it:

| Event | Link |
|---|---|
| APPLY | set to this DNA |
| SAVE BUILD / SAVE CAR, and REWRITE of a build | copied onto the entry as `dna` (removed from the entry if there is no link) |
| LOAD BUILD / LOAD CAR's build | replaced by the entry's `dna`, or cleared if it has none |
| Factory preset LOAD, LOAD CODE's APPLY SELECTED with any feel part (SPRINGS / DAMPERS / ARB) or DRIVETRAIN ticked, RESET of the tune | cleared |
| Leaving PRO | a confirm first; SWITCH clears it (one undo step) |
| ✕ on the sidebar DNA line | cleared, tune untouched (one undo step) |
| Undo (↩) / redo (↪) | restored with the tune: the link is part of every history snapshot, so undoing APPLY removes it and redo puts it back |
| Chassis edits, control edits | unchanged — they show as drift |

---

## UI (PRO)

- **DNA modal** (`showDnaModal`), opened by the DNA button in the sidebar toolbar, left of
  CHECK. Below PRO it shows only a note to switch to PRO.
  - archetype buttons, which load a draft; they do not apply;
  - **CODE**: this draft as a `DNA-` share code with COPY, and a box to paste one in. LOAD
    replaces the draft; it does not apply;
  - **MY DNA** (`dnaSavedOpen`), a drawer laid out like the GARAGE saved list: a name
    field and SAVE DNA, then an `EntryCard` per saved DNA — rename, date, ↺ REWRITE WITH
    EDITOR DNA, delete, summary, tags, notes, LOAD DNA. LOAD DNA fills the editor and
    does not apply. No filter, sort or search;
  - EDITING / EDITED FROM … with REVERT;
  - one `FeelSlider` per axis over the full `DNA_AXES` range, with an **ACCEPT ±** box under each
    outcome axis for its [slack](#slack-how-much-of-a-target-the-personality-needs);
  - **PRIORITY**, the draft's `keep` order: the five `DNA_YIELDABLE` axes, most protected
    first, each with ▲/▼ to swap with its neighbour. A row reads *gave way* or *missed*
    when the live preview says so, so the effect of a reorder is visible without applying.
    The editor always writes a full permutation, so `sanitizeDNA` never has to repair it.
    Reordering counts as an edit — `dnaEdited` compares `keep` as well as the axes, the
    name becomes `GT3 (edited)`, and REVERT restores the ref's order along with its values.
    The setting axes and `bumpRatio` are not listed, because they never trade;
  - **ON THIS CHASSIS**: `applyDNA` on the draft, per axis ✓, moved (and what for),
    missed (and why), or not expressible. Solved only while the modal is open;
  - **SWITCHES**: the modes in `DNA_MODE_FIELDS` that APPLY would change;
  - **APPLY**, one undo step like any load; ↩ also removes the link, ↪ restores both.
- **TUNE CHECK → DECODE → IMPORT AS DNA** (`CheckerModal`, `onImportDna`). Next to
  IMPORT TUNE, and the other half of the same decision: IMPORT TUNE keeps the *numbers*
  — it overwrites RIDE, DAMPERS and ANTI-ROLL BARS — while IMPORT AS DNA keeps the
  *handling*, overwriting the
  editor's draft and leaving the car alone. Both build from one `decodedFe` patch, so
  they can never read the same inputs differently. The draft arrives named DECODED TUNE
  with no `ref`, so the editor shows a fresh DNA rather than "edited from" whatever was
  loaded; `keep` is carried over, since a tune has nothing to say about rank. It closes
  TUNE CHECK and opens the DNA modal, and is **not** a commit — the undo snapshot
  carries the applied link, never the draft, and nothing on the car has changed. Below
  PRO the button is disabled with a title saying why.
- **Sidebar DNA line**, above CHASSIS: name, drift count, ✕ to remove the link. The name
  opens the editor. Not a `Sec`.
- **Sidebar marks**: a dot on the label of each control an axis compiled onto — indigo
  while it reads as applied, amber once drifted, **slate when the control is not showing that
  axis right now**. `dnaDot` is the only call site pattern. The third state is the ride stiffness
  and rear multiplier sliders under a reference other than FRONT, where they hold the average or
  the rear while the axis is the front: the dot used to be hidden there, which left no sign the
  DNA had set the control at all, and its title now says what the number on screen is not. The
  measurement is unaffected either way — `measureDNA` always reads `tune.fHz`.
- **VISUALS card DNA MATCH** (`visDna`): target, now, and ✓/≠ per axis. Shown only while
  a link exists.
- **Tier warning**: leaving PRO with a link asks first — the BEG/INT fallback effects
  rewrite `arbBalMode` (and at BEG `dampBalMode`/`dampingBias`) and nothing restores
  them. `requestMode` wraps `tryAccessMode` for the header tier buttons.

Not built from the first design: a radar chart and re-apply from the match card. The Balance Guide keeps showing its build-type band
even when the DNA sits outside it.

---

## Archetypes (seed values)

**These are hypotheses to test in-game, not calibration.** Seeded from the factory
presets and `BALANCE_BAND_FRACS`'s RWD bands. An archetype ships at the midpoint of each range
unless testing says otherwise; `arbShare` is a single measured value, not a range.

Unconfirmed values do not block implementation. `DNA_ARCHETYPES` is data, and a
saved DNA is a copy of axis values, so retuning an archetype later never moves a DNA
someone has already saved — the same property that keeps macro positions out of the
stored format.

| Axis | MOMENTUM | RALLY / B-ROAD | GT3 | TAIL-HAPPY RWD |
|---|---|---|---|---|
| `platformHz` | 2.6–3.0 | 1.4–1.8 | 3.0–3.6 | 2.0–2.4 |
| `pitchRatio` | 1.10–1.15 | 1.00–1.05 | 0.92–1.00 | 1.15–1.30 |
| `arbShare` | 7.5% | 12.5% | 4.5% | 7.0% |
| `balanceOffset` | −0.010..−0.005 | −0.045..−0.025 | −0.030..−0.020 | 0.000..+0.020 |
| `reboundZeta` | 36–42 | 55–60 | 43–48 | 38–44 |
| `bumpRatio` | 52–58 | 36–42 | 60–66 | 44–50 |
| `dampBias` | +5 | +5 | −10 | +10 |
| `diffExit` | +10 | −5 | +5 | +20 |
| `diffEntry` | 0 | +15 | −5 | +10 |
| `keep` (most protected first) | platform, balance, pitch, share, ζ | platform, balance, ζ, pitch, share | platform, share, pitch, balance, ζ | balance, share, ζ, platform, pitch |

Anchors: RALLY 1.55 Hz / ×1.05 / bump 38; MOTORSPT 3.20 Hz / ×0.92 / bump 64;
DRIFT ×1.30. RALLY's damping and diff seeds are the RALLY preset's
values converted to slider convention per [Sign conventions](#sign-conventions)
(stored `diffBiasEntry −15` reads +15 LOOSE), and GT3's `dampBias` is MOTORSPT's. The
other damping and diff seeds are judgement calls with no preset behind them.

The balance seeds are the earlier gap-fraction ranges (from `BALANCE_BAND_FRACS`'s RWD bands:
rally 0.30–0.55, track 0.55–0.95, drift 0.90–1.55) converted at the default chassis,
whose gap is 0.061, and rounded to 0.005. They are small because that chassis is
nearly balanced to begin with, and several sit inside the resolver's own 0.01
tolerance of neutral. Of all the seeds, these most need in-game tuning.

### Share seeds fit Motorsport's bars

The share seeds started as the share each v1 roll seed produced on the default chassis in
Horizon: MOMENTUM 8.5%, RALLY 9.5%, GT3 8.5%, TAIL-HAPPY 7%. Each was then moved to a
value whose share lands on all ten portability chassis in Horizon, Motorsport and BeamNG,
axis only:

| Archetype | Platform | v1-equivalent | Seed | Why |
|---|---|---|---|---|
| MOMENTUM | 2.80 Hz | 8.5% | 7.5% | 8% and up reaches only 5/10 in Motorsport |
| RALLY / B-ROAD | 1.60 Hz | 9.5% | 12.5% | below 12.5%, a bar hits its 1-click floor on up to half the chassis in both Forza games — the budget is small on soft springs and MECH's split pushes one bar to the bottom |
| GT3 | 3.30 Hz | 8.5% | 4.5% | Motorsport's 40-click bars top out at 4.4–6.3% at 3.3 Hz; 5% already misses one chassis |
| TAIL-HAPPY RWD | 2.20 Hz | 7% | 7.0% | lands everywhere as it is |

These moves change little about how much the car rolls. Total roll stiffness is springs
÷ (1 − share), so GT3 going from 8.5% to 4.5% adds about 4% roll and RALLY going from
9.5% to 12.5% removes about 3%.

**Before raising a seed, re-measure in Motorsport**: its bar ceiling is the tightest of
the three games — or give the axis
[slack](#slack-how-much-of-a-target-the-personality-needs) and seed it where it belongs, which is
what slack exists for. Either is a tuning decision; the seeds above are unchanged. Balance is a separate question: several of these combinations do not
reach their balance offset on the rear-biased, front-heavy and tyre-stagger chassis in
Forza at any share, and the resolver moves pitch or platform there.

The TRACK preset still asks for 1.5° under ROLL °, where its springs alone hold the
default chassis to 1.32°; that is a preset issue, not a DNA one. See
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Rebound ζ seeds

Every factory preset now authors rebound ζ directly: STREET 30.3, TRACK 36.6,
X COUNTRY 40.7, MOTORSPT 45.8, RALLY 58, DRIFT 60 (see [PRESETS.md](PRESETS.md)).
Four of them were Settle Targets until that conversion, and Beginner had been
silently replacing them with 70% — see [HISTORY.md](HISTORY.md).

The ζ row above comes from those: MOMENTUM from TRACK, RALLY from RALLY, GT3 from
MOTORSPT. TAIL-HAPPY has no preset behind it; its range follows the original brief's
"softer rebound" and deliberately does not borrow DRIFT's 60%.

---

## What the model does not express

The same test that rejected a bump term in the RESPONSE bar applies: an axis needs a
quantity the app computes and a sign the inputs determine.

- **Aero-dependent pitch stability.** There is no downforce input. The only proxies
  are `pitchRatio ≤ 1` and a stiff platform. A real version needs downforce and
  speed, and is a feature of its own.
- **Progressive breakaway.** There is no tyre saturation curve — `TIRE_LOAD_SENS` is
  a linear falloff. A DNA can set the levers (`balanceOffset` at or just short of
  neutral, and little accel lock on the driven axle — `diffExit` toward GRIP on RWD/AWD,
  but toward ROTATE on FWD, where the slider's balance direction and lock direction run
  opposite ways) but cannot claim to measure progressiveness. It is a label on an
  archetype, never an axis.
- **Surface.** Firm bump damping reads planted on smooth tarmac and skittish on
  rough ground ([KNOWN_ISSUES.md](KNOWN_ISSUES.md)). Deferred with `surface`; when it
  arrives it selects targets and must not add a coefficient to either balance bar.
- **Alignment and brakes.** Not written. Alignment stays wherever Alignment Mode puts
  it; brake bias stays computed.

---

## Tests

`tests-dna.js` lifts the real functions out of `index.html` the way `tests-beamng.js`
does — a mirror could not catch a compiler that drifted from the solver it drives.

1. **One funnel.** `resolveFeEffective` matches TARGET and GRIP resolution, and `App`
   calls it rather than an inline copy.
2. **Solver untouched.** Axis defaults match `DEF_FE`/`DEF_DR`; every range end and
   every compiled archetype is a `sanitizeTune` fixed point on every layout and game
   mode; the patch adds no unknown keys and leaves unrelated fields alone.
3. **Sign conventions.** Each setting axis compiles and measures back to itself on
   FWD, RWD and AWD; the three slider expressions it mirrors are pinned in the source;
   zero never compiles to −0; Sport's ENTRY reads as inexpressible.
4. **Independent oracle.** Miss detection agrees with `shareClamped`,
   `mechBalClamped` and `dampingClamped` (see the tolerance table). Forza platform and
   pitch read back exactly; BeamNG's stay within the spring-grid tolerance.
5. **Portability.** The fixtures still cover both gap signs and near-zero; in BeamNG,
   where bars have no ceiling, every archetype that ranks balance first or second lands
   it on every fixture; the same offset lands on the balanced and rear-biased chassis
   that broke the gap fraction; a v1 DNA migrates to `arbShare`.
6. **Resolver.** Each conflict — pitch band, bars at their ceiling for the share target,
   damper ceiling, damper floor, bar authority for balance — gives way in `keep` order
   both ways round; an out-of-range balance target is never chased; the pair pass fires on
   the rear-biased GT3 case, both halves name each other, and the pair stays inside the
   more protected member's licence.
7. **Slack.** It is sparse, clamped to `dnaSlackMax`, never negative, and never on a setting
   axis; a slack-widened target is met where a point target would have pulled a more protected
   axis off its own value; `accept` is the quantisation allowance plus the slack. Half the fuzz
   DNAs in the invariants below carry slack, so a widened `hit` is checked against every
   reporting invariant rather than only the happy path.
8. **Read-back.** A compiled tune read back by `dnaReadBack` returns the DNA that
   produced it: outcome axes match `measureDNA` clamped to their ranges, diff axes
   exactly, and `dampBias` within the damper quantisation propagated through the log.
   The bias inverts the ζ split even when STANDARD wrote it and `measureDNA` reads
   `null`; an inexpressible axis keeps the value it was handed; the result is always a
   `sanitizeDNA` fixed point.
9. **Invariants**, over every archetype and a seeded fuzz set on every fixture and game
   mode: moves stay within the cap and the axis ranges; no axis moves to save a
   less-protected one; nothing ranked above every moved axis is broken; every axis off
   its target was moved or reported; every outcome miss has a cause; resolved tunes
   are `sanitizeTune` fixed points; re-applying a resolution moves nothing; the worst
   case stays under 50 ms.

The invariants were also run one-off against 4,500 random chassis and DNAs over three
seeds with no violations. That first surfaced the accepted-miss re-judging in step 5 of
the resolver: a resolved DNA re-applied to itself moved again.

In the browser, a MOMENTUM tune compiled in Node for the preview's stored chassis and
written into its storage rendered exactly the springs, dampers, ARB clicks, roll and
mech balance Node predicted, with no unreached-target warning.

### Synthetic chassis set

The suite defines its own chassis rather than borrowing real cars. Portability is a
property of the math, so each chassis exists to break one assumption. Gaps are
measured on the default chassis with only the named field changed.

| Chassis | Change from `DEF_CH` | Exercises |
|---|---|---|
| Default | none — 52% front, gap +0.061 | the ordinary case |
| Balanced | `frontBias: 50` — gap +0.012 | natural balance already at grip-neutral, so the offset alone sets balance |
| Rear-biased | `frontBias: 45` — gap −0.111 | natural balance past neutral — the case that broke the gap fraction, kept as a regression guard |
| Front-heavy | `frontBias: 60` — gap +0.256 | a large correction for the bars to carry; bar authority |
| Wide rear | `tyreF: '225/40R18'`, `tyreR: '325/30R20'` — gap +0.315 | the tyre-width path, `TIRE_MECH_SCALE` |
| Wide front | the reverse — gap −0.192 | the tyre-width path with the gap reversed |
| Heavy | `weight: 12000` | `dampingClamped` at the damper ceiling, the ζ ↔ platform trade |
| Light | `weight: 500` | `dampScale`'s scale-up branch off the 1-click floor |

Every chassis runs in HORIZON, MOTORSPORT and BEAMNG. The Heavy and Light weights were
found by search against HORIZON's limits; the suite fails if a calibration change stops
either one reaching its limit, rather than letting the fixture quietly stop testing
anything.

**Real-car validation is a separate, later step.** Whether an archetype *feels*
right is an in-game question, answered by driving cars you already know. It needs no
particular calibration cars, and it is not what `tests-dna.js` proves.

---

## Open questions

1. **Archetype sign-off** — names, seeds, `keep` orders, and whether four is the
   right set. Not blocking: it is data, and it is best settled in-game.
2. **What the editor should look like** — the first pass is deliberately rough; see
   [UI (PRO)](#ui-pro) for what exists.

Settled since the first draft: balance is an absolute offset from grip-neutral (a
gap fraction was accepted first, then rejected — see
[Why not a gap fraction](#why-not-a-gap-fraction)); the portability test uses
synthetic chassis instead of calibration-car data; and the factory presets now author
ζ, which unblocked the ζ seeds; leaving PRO with an applied DNA asks first and
removes the link.

