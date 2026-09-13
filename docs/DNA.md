# SUSP.OS — Vehicle DNA (handling personality)

A saved, chassis-portable description of *how a car should drive* — sharp and
agile, compliant and forgiving, planted, tail-happy — that is applied to whatever
chassis is loaded by solving the tune that produces it on that car.

> **Status: core implemented, no UI.** `index.html` has the pure layer —
> `resolveFeEffective`, `gripNeutralOf`, and under the `── Vehicle DNA ──` banner
> `DNA_AXES`, `sanitizeDNA`, `compileDNA`, `measureDNA`, `dnaTolerances`,
> `dnaEvaluate` and `applyDNA`, plus `DNA_ARCHETYPES` beside the factory presets —
> and `tests-dna.js` exercises it. Nothing in `App` calls the DNA functions yet: there
> is no `suspos_dna_v1` key, garage payload, DNA section or VISUALS card. The sections
> on storage and UI below are still design. When the UI lands, the remaining facts
> move into the docs that own them (see
> [Doc obligations when the UI lands](#doc-obligations-when-the-ui-lands)).

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
| First tier | **PRO** | PRO already has the target-space solvers (ROLL °, MECH, GRIP) the compiler needs |
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
the Hz multiplier are ratios. The ones that do not are **balance** and **roll**,
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
| `rollDegPerG` | `tune.rollDeg` | ° at 1 g | 0.3..5.0 | `fe.arbTargetRollMan` |
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

### Balance: an absolute offset from grip-neutral

`balanceOffset` is how far the car's mech balance sits from grip-neutral, in
mech-balance units: positive is the oversteer side, negative the understeer side, 0
is neutral — the same meaning and the same authority on every chassis.

```js
gripTarget = 1 - balanceFromRsBal(ch, naturalMechBalanceOf(ch))   // grip-neutral mech balance
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
`arbBalDelta` still means the same offset from that chassis's grip-neutral. ROLL °
behaves the same way, because `computeTune` re-inverts the roll equation against the
current chassis. Balance and roll drift from the DNA only when a limit bites, or when
a resolver move made for the old chassis no longer fits the new one.

### Why not a gap fraction

The first design stored balance as a fraction `f` of the gap between the chassis's
natural mech balance and grip-neutral — the normalisation the Balance Guide's
`_fracMap` uses — anchored at grip-neutral with a floor:
`gripTarget + (f − 1)·max(gap, 0.03)`. It was accepted, then rejected once real
chassis were run through `naturalMechBalanceOf` and `balanceFromRsBal`.

**A negative gap is not rare.** PHYSICS.md describes it as the rare chassis whose
natural balance already sits past its grip target. On the default chassis geometry
the gap is negative for every front weight bias below about 50%, and a wide front tyre
flips it too; a broad grid over layout, weight bias, track widths, tyre sizes, CG
height and weight found it negative at about half its points. A plain fraction then
points the wrong way on every mid-engined car, and the floor that fixed the sign gave
all of them the minimum authority.

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
// DNA v1. Values are axis targets in slider conventions — never macro positions.
{
  v: 1,
  name: 'RALLY WEAPON',
  axes: {
    platformHz: 1.60,   pitchRatio: 1.03,   rollDegPerG: 3.0,   balanceOffset: -0.035,
    reboundZeta: 55,    bumpRatio: 38,      dampBias: 5,
    diffExit: -5,       diffEntry: 15,
  },
  // Most protected first. A permutation of the five axes that can give way;
  // the setting axes never conflict, so they are not ranked.
  keep: ['platformHz', 'balanceOffset', 'reboundZeta', 'pitchRatio', 'rollDegPerG'],
}
```

- `v` exists so a future axis or a changed meaning can migrate rather than
  misread. Adding an axis with a sensible default does not need a bump — same rule
  as [PERSISTENCE.md](PERSISTENCE.md).
- `keep` is an order, not weights. An order is explainable in the UI ("roll gave
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
| `rollDegPerG` | `arbTargetRollMan` | `arbMode:'roll'` — sets the total bar budget |
| `balanceOffset` | `arbBalDelta` | `arbBalMode:'mech'` — solves the front/rear bar split; `arbBalTargetMode:'grip'` |
| `reboundZeta` | `reboundZeta` | `dampCharMode:'zeta'` |
| `bumpRatio` | `bumpRatio` | `dampingMode:'ratio'` |
| `dampBias` | `dampingBias` | `dampBalMode:'sync'` |
| `diffExit`, `diffEntry` | `dr.diffBiasExit`, `dr.diffBiasEntry` | `dr.diffManual:false` |

**Never written:** `ch` (including layout), `dr.buildType`, `dr.diffType`, the AWD
front-exit and centre fields, `al`, and brakes. Brake bias is computed-only by
design — see [CODE_MAP.md](CODE_MAP.md)'s intentionally-absent section — and a DNA
must not become a back door to a manual override.

Roll and balance are not searched: ROLL ° inverts the roll equation for the bar
budget, and MECH solves the split within that budget. Both already exist in
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

Flags alone are not enough, because one of them is silent in exactly this
configuration: under MULTIPLIER with a FRONT reference the rear axle is clamped to
the Hz band with `rearHzClamped` forced false (see
[PHYSICS.md](PHYSICS.md#when-the-band-clamp-is-reported-physicsrearhzclamped)).

`dnaTolerances(tune, gameMode)` sets each allowance to half of one quantisation step
of whatever produced the number, so rounding the game imposes is never reported as a
miss:

| Axis | Tolerance | Source |
|---|---|---|
| `platformHz` | 0.005 Hz, plus half a 500 N/m spring step in Hz in physical modes (`ΔHz/Hz = ½·Δk/k`) | `sanitizeTune`'s 0.01 Hz rounding; `PHYS_SNAP.spring` |
| `pitchRatio` | exact in Forza; the two axles' half spring steps in physical modes | `PHYS_SNAP.spring` |
| `rollDegPerG` | 0.05° | `rollClamped`'s own threshold, already downstream of ARB click rounding |
| `balanceOffset` | 0.01 | `mechBalClamped`'s own threshold |
| `reboundZeta` | ζ × half a damper step ÷ the rebound value — 0.05 click in Forza, 50 N·s/m in physical modes | `clampDamp` rounding; `PHYS_SNAP.damp` |
| `bumpRatio` | the same, summed over the rebound and bump dampers | as above |
| setting axes | exact | written verbatim |

`tests-dna.js` checks this against the app's own flags: across fixtures, game modes and
a grid of roll and balance targets, a DNA roll hit is exactly `!rollClamped`, a balance
hit is exactly `!mechBalClamped`, and no damping miss is reported while
`dampingClamped` is false.

### Which axes can give way

| Missed axis | Cause | Candidates that can move |
|---|---|---|
| `pitchRatio` | `platformHz · pitchRatio` outside `HZ_MIN`..`HZ_MAX` | `pitchRatio`, `platformHz` |
| `reboundZeta` or `bumpRatio` | `tune.dampingClamped` — a pair was scaled to fit the click range (down at the ceiling, up off the 1-click floor) | `reboundZeta`, `platformHz` (lower Hz needs fewer clicks, higher Hz more). `bumpRatio` is not ranked; the row uses `reboundZeta`'s rank |
| `rollDegPerG` | `tune.rollClamped` — springs alone already stiffer than the target, or bars at ceiling | `rollDegPerG`, `platformHz` (springs carry the roll) |
| `balanceOffset` | `tune.mechBalClamped`, or the `gripBalTarget` clamp | `balanceOffset`, `pitchRatio` (springs take part of the correction), `rollDegPerG` (a bigger bar budget gives the split more authority) |

The rows are in **dependency order** and are handled top to bottom. Balance depends
on the roll budget: when springs alone exceed the roll target, `rsAbBudget` is not
positive, MECH's split is skipped entirely, and roll and balance typically miss together.
Resolving roll first often clears balance for free.

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
5. After any move, every accepted miss is judged again, because a move can unblock one:
   lowering pitch for balance can make a roll miss fixable that no platform value
   could fix before. Stop after `DNA_MAX_MOVES` (4) moves or when nothing is left to
   resolve.

There is no per-axis direction table. An earlier draft of this section listed one
("roll too flat → lower `platformHz`" and so on); searching both ways gets the same
answers without a table that could be written backwards.

The result carries `moves` (`{axis, from, to, protects, cause}`), `misses`
(`{axis, target, achieved, cause}`) and `inexpressible`, for the match readout — e.g.
*roll 3.0 → 2.2°/g, anti-roll bars at their limit* — so the app never presents a
compromise as the target. This is the same principle as `impliedZeta` and the ARB
stiffness being recomputed from clamped clicks. A typical apply takes well under a
millisecond; `tests-dna.js` fails if the worst case in its sample reaches 50 ms.

**Limits worth knowing:**

- **One axis at a time.** Keeping a protected axis by moving two lower-ranked ones
  together is not searched. TAIL-HAPPY on a front-heavy or staggered chassis in Forza
  shows it: raising pitch would reach balance but breaks roll, which TAIL-HAPPY ranks
  above pitch, and roll alone cannot reach balance — so the balance miss is accepted,
  even though moving pitch *and* platform together might have kept both.
- **Resolution.** A clearing window narrower than one 96th of an axis's range can be
  stepped over. Such windows are real: on a 60% front chassis MOMENTUM's balance clears
  only across roughly 0.07 of pitch, because raising the rear spring rate eats the
  bar budget ROLL ° leaves. A 12-step first version missed exactly those. A window
  that is missed is reported as a miss, never hidden.
- **Greedy.** Rows resolve in dependency order, not by a global optimum.

The resolver reads the same measurements in all three game modes. BeamNG has no
click ceilings, so `dampingClamped` and bar-ceiling roll misses do not arise there;
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
rollDegPerG   = tune.rollDeg
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

---

## Storage and transport

| What | Where | Notes |
|---|---|---|
| The editor's current DNA | `suspos_dna_v1` = `{ draft }` | Object-valued, so `mergeDefaults` fills new fields for free |
| Saved DNAs | Garage entries with a new `dna` payload | New derived kind `'dna'` |
| Factory archetypes | `DNA_ARCHETYPES` constant | FACTORY cards, same pattern as `PRESET_SAVES` |
| Share codes | **Not in v1** | The stamped tune already travels through the existing codec |

**A DNA entry carries only `dna`.** Mixing it with `ch`/`fe`/`dr` would turn
`kindOf`'s simple derivation into a combinatorial one. Adding the kind touches
`kindOf`, `normalizeEntry`, the garage filter chips, and RESTORE — whose kind list
is written out as three hardcoded rows plus a `disabled` condition naming all three,
so a fourth kind needs both.

**Factory archetypes stay out of the entry list** for the reason presets do: six
identical read-only entries would ride along in every backup and multiply on every
restore. See [PRESETS.md](PRESETS.md).

(For presets that was six identical read-only entries; for archetypes it would be four,
with the same multiplication on every restore.)

**Share codes stay out of v1** because a DNA group in `CODEC_FIELDS` means the same
threading the `al` gap needs — new ids, a group through `DEF_GROUPS`/`encodeTune`/
`decodeTune`/`sanitizeTune` — for an object that is not a tune. A DNA share code, if
wanted, should be its own format rather than new tune-codec ids. Codec ids are
permanent either way; see [CODEC.md](CODEC.md).

### Apply once without an "active DNA" link

The match readout always compares the **current** tune with the **editor's** DNA.
There is no stored "this tune came from that DNA" link, so loading a build, a preset
or a share code needs no invalidation logic — the readout simply becomes a
comparison ("how GT3 is this tune?"). That also avoids adding the kind of effect
the `rideBottomG` race came from.

---

## UI (PRO)

- **GARAGE drawer.** FACTORY DNA cards above saved DNA entries. The card action is
  **EDIT**, which loads the DNA into the editor; it does not apply. Below PRO, DNA
  entries still render — with a PRO badge and no action — so entry counts and search
  do not change with the tier.
- **Sidebar section DNA** (`zone-dna`, PRO only):
  - archetype picker;
  - one `FeelSlider` per axis, each with a `markers` entry at the current tune's
    measured value, so drift is visible on the control itself;
  - the `keep` order, reordered with ▲ ▼;
  - **APPLY** behind `useTwoTap`, because it overwrites the tune;
  - **SAVE DNA**.
- **VISUALS card DNA MATCH** (`visDna`). A radar of target over achieved, each axis
  normalised over its DNA range and balance centred on grip-neutral, plus the resolver's
  move list and any **mode differs** axes.
- **Balance Guide** keeps showing its build-type band even when the DNA sits outside
  it. A tail-happy DNA on a TRACK build *should* read out of band.
- **Macro sliders** (Aggression, Compliance, Oversteer Bias) are deferred to the
  BEG phase. In PRO the axes are the controls.

---

## Archetypes (seed values)

**These are hypotheses to test in-game, not calibration.** Seeded from the factory
presets and `_fracMap`'s RWD bands. An archetype ships at the midpoint of each range
unless testing says otherwise.

Unconfirmed values do not block implementation. `DNA_ARCHETYPES` is data, and a
saved DNA is a copy of axis values, so retuning an archetype later never moves a DNA
someone has already saved — the same property that keeps macro positions out of the
stored format.

| Axis | MOMENTUM | RALLY / B-ROAD | GT3 | TAIL-HAPPY RWD |
|---|---|---|---|---|
| `platformHz` | 2.6–3.0 | 1.4–1.8 | 3.0–3.6 | 2.0–2.4 |
| `pitchRatio` | 1.10–1.15 | 1.00–1.05 | 0.92–1.00 | 1.15–1.30 |
| `rollDegPerG` | 0.85–0.95 | 2.8–3.2 | 0.72–0.80 | 1.25–1.45 |
| `balanceOffset` | −0.010..−0.005 | −0.045..−0.025 | −0.030..−0.020 | 0.000..+0.020 |
| `reboundZeta` | 36–42 | 55–60 | 43–48 | 38–44 |
| `bumpRatio` | 52–58 | 36–42 | 60–66 | 44–50 |
| `dampBias` | +5 | +5 | −10 | +10 |
| `diffExit` | +10 | −5 | +5 | +20 |
| `diffEntry` | 0 | +15 | −5 | +10 |
| `keep` (most protected first) | platform, balance, pitch, roll, ζ | platform, balance, ζ, pitch, roll | platform, roll, pitch, balance, ζ | balance, roll, ζ, platform, pitch |

Anchors: RALLY 1.55 Hz / ×1.05 / bump 38; MOTORSPT 3.20 Hz / ×0.92 / bump 64;
DRIFT ×1.30. RALLY's damping and diff seeds are the RALLY preset's
values converted to slider convention per [Sign conventions](#sign-conventions)
(stored `diffBiasEntry −15` reads +15 LOOSE), and GT3's `dampBias` is MOTORSPT's. The
other damping and diff seeds are judgement calls with no preset behind them.

The balance seeds are the earlier gap-fraction ranges (from `_fracMap`'s RWD bands:
rally 0.30–0.55, track 0.55–0.95, drift 0.90–1.55) converted at the default chassis,
whose gap is 0.061, and rounded to 0.005. They are small because that chassis is
nearly balanced to begin with, and several sit inside the resolver's own 0.01
tolerance of neutral. Of all the seeds, these most need in-game tuning.

### Roll seeds sit inside what the platform allows

The first roll ranges were copied from the presets' ROLL ° targets, and two of them
could not be met. In Forza the bars add little roll stiffness — at about 40 clicks MOTORSPT's
bars supply roughly an eighth of the total — so at a given spring rate the reachable roll
window is narrow, and its top is whatever the springs alone produce. Measured on the
default chassis, reachable in both Forza modes:

| Archetype | Platform / pitch | Reachable roll | First seed | Now |
|---|---|---|---|---|
| MOMENTUM | 2.80 Hz / ×1.125 | 0.81–1.03° | 1.20° — flatter than asked, bars at 1 click | 0.90° |
| RALLY / B-ROAD | 1.60 Hz / ×1.025 | 2.15–3.32° | 3.00° | 3.00° |
| GT3 | 3.30 Hz / ×0.96 | 0.72–0.87° | 0.75° | 0.76° |
| TAIL-HAPPY RWD | 2.20 Hz / ×1.225 | 1.14–1.49° | 1.70° — flatter than asked, bars at 1 click | 1.35° |

Each new range sits inside its window where the personality puts its bars: MOMENTUM and
GT3 toward the stiff end, RALLY near the soft top, TAIL-HAPPY in the middle. The
windows move with the chassis, so on other chassis the resolver still decides.

The TRACK preset has the same problem, and it predates this work: it asks for 1.5° at
2.50 Hz, where its springs alone hold the default chassis to 1.32°. See
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
  neutral, low `diffExit`) but cannot claim to measure progressiveness. It is a label on an
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
4. **Independent oracle.** Miss detection agrees with `rollClamped`,
   `mechBalClamped` and `dampingClamped` (see the tolerance table). Forza platform and
   pitch read back exactly; BeamNG's stay within the spring-grid tolerance.
5. **Portability.** The fixtures still cover both gap signs and near-zero; in BeamNG,
   where bars have no ceiling, every archetype that ranks balance first or second lands
   it on every fixture; the same offset lands on the balanced and rear-biased chassis
   that broke the gap fraction.
6. **Resolver.** Each conflict — pitch band, springs stiffer than the roll target,
   damper ceiling, damper floor, bar authority for balance — gives way in `keep` order
   both ways round; an out-of-range balance target is never chased.
7. **Invariants**, over every archetype and a seeded fuzz set on every fixture and game
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
2. **What to do when a DNA tune leaves PRO** — a decision for the UI phase. Checked in
   the browser: switching a compiled tune to INT runs `App`'s BEG/INT fallback effect,
   which rewrites `arbBalMode:'mech'` to `'weight'`. Springs, dampers and roll are
   untouched, but the bar split stops solving for the balance target (24.2 / 21.5 →
   23.3 / 22.4 clicks on the default chassis) and the MECH readout disappears. Reading
   the code, Beginner's own effect goes further and also resets `dampBalMode` to
   `standard` and `dampingBias` to 0. Nothing restores any of it on returning to PRO.
   Options: warn before the tier change, offer RE-APPLY on return, or accept it.

Settled since the first draft: balance is an absolute offset from grip-neutral (a
gap fraction was accepted first, then rejected — see
[Why not a gap fraction](#why-not-a-gap-fraction)); the portability test uses
synthetic chassis instead of calibration-car data; and the factory presets now author
ζ, which unblocked the ζ seeds.

---

## Doc obligations when the UI lands

Done with the core: [CODE_MAP.md](CODE_MAP.md) lists the DNA functions,
`resolveFeEffective`, `DNA_ARCHETYPES` and `tests-dna.js`; the README lists the suite.

| Change | Update |
|---|---|
| `suspos_dna_v1`, the `dna` payload, the `'dna'` kind, RESTORE's kind list | [PERSISTENCE.md](PERSISTENCE.md) — `tests-docs.js` fails on an undocumented key |
| `zone-dna`, the new `Sec`, `visDna`, the DNA functions gaining call sites | [CODE_MAP.md](CODE_MAP.md) — its zone count and section count are both checked; move the DNA core out of the intentionally-retained section |
| `'dna'` in `SECTION_KEYS` and the `open` initialiser, `visDna` in the initialiser | `index.html` — `tests-docs.js` checks the initialiser |
| DNA axis sliders | [SLIDERS.md](SLIDERS.md) |
| Aero, progressive breakaway, CO-SOLVE for pitch, the gap-fraction balance axis — rejected | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) |
| PRO feature list | `README.md` |
| This file | Drop the status banner; keep only what is true of the shipped feature |
