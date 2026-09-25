# SUSP.OS — Known Issues & Limitations

Things that are still true: open gaps, deliberate limitations kept with their
reasoning, and designs considered and rejected. Everything here is live — if an
entry is in this file, it still describes the app as it stands.

> **Resolved incidents live in [HISTORY.md](HISTORY.md).**
> This file ran to ~1900 lines with only a handful of open items, which meant
> nobody read it end to end — and a contradiction survived undetected deep inside
> it for months because of that. Splitting the two keeps the open set small enough
> to actually review. Inline `docs/KNOWN_ISSUES.md` pointers elsewhere in the
> codebase may refer to a resolved incident; those are one hop away in HISTORY.md.

---

## Open — the grip model reverses direction once an inside wheel lifts

`mechBalanceLLT`'s tyre term floors at zero load:

```js
const fy=Fz=>{const z=Math.max(0,Fz);return z*Math.max(0,1-TIRE_LOAD_SENS*(z/FzRef-1));};
```

Once an axle's lateral load transfer exceeds its static wheel load, that floor is
holding the inside wheel at zero and further transfer only adds load to the outside
one — where load sensitivity means the axle's **total** capacity starts rising again.
Past that point the model predicts **less** oversteer for more rear roll stiffness,
which is backwards, and the same happens at the other end of the band: on a
rear-biased car the *front* inside wheel lifts at a low `rsBalance` and the reversal
appears there instead.

It is not an extreme-only case. Measured across the tunable band:

| Chassis | Turning point |
|---|---|
| default (0.45 m CG) | `rsBalance` 0.895 |
| 60% front bias | 0.745 |
| narrow track | 0.770 |
| 0.68 m CG | **0.555** |

A tall car reverses at 0.555 — inside the range `clampBalTarget` allows and well
inside what a solver will ask for. Everything reading `balanceFromRsBal` inherits it:
`gripNeutralOf`, GRIP target mode, the Balance Guide band and DNA's `balanceOffset`
axis.

**Found by `tests-balance.js`**, whose monotonicity property failed on the default
chassis at the first run. The suite now asserts the *invariant* rather than the
symptom — balance may reverse only where an inside wheel has lifted, never while both
are loaded — so the test keeps its teeth and still passes once the cause is fixed.

**Surfaced, not fixed.** `balanceEnvelope` raises a hard `LIFT` flag when the current
split reaches the threshold, so the app stops presenting those figures as sound. The
fix is a saturating falloff with no zero floor (something of the `Fz/(1+k·Fz/FzRef)`
shape) in place of the linear `1 − k(Fz/FzRef − 1)`, which removes the lift region
entirely and lets the 1500 mm CG cap — partly there to keep this out of sight — relax.
That changes every balance figure in the app, including saved tunes and the DNA axis,
so it wants calibrating and deciding rather than doing on the way past.

## Documented — what undo / redo does not cover

History holds the tune (`ch`, `fe`, `dr`, `al`) and the DNA link, nothing else:

- **Garage entries are outside it.** Saving, renaming, tagging, deleting and RESTORE
  aren't undoable. Undoing a tune edit and losing a saved entry with it would be a
  surprise, and delete is already behind a two-tap confirm.
- **The UI tier isn't in it.** Undo can restore a snapshot taken in PRO while you're
  in BEG or INT. The tier fallbacks re-run, so the tune stays valid for the tier, but
  a DNA link from that snapshot comes back hidden and reappears — usually drifted — on
  a return to PRO.
- **History doesn't survive a reload.** Persisting it would add a storage key, a
  migration story and stale snapshots after any `DEF_*` change, for little gain.

---

## Limitation — the ARB share part is not self-describing, and is guarded rather than fixed

`SHARE_PARTS` puts `gameMode` in the **`ride`** part (labelled SPRINGS) and
`arbManF`/`arbManR` in the **`arb`** part. Those two ids are the only ones in the
codec whose *units* depend on `gameMode` — clicks in a click mode, roll stiffness
in a physical one (see [CODEC.md](CODEC.md) ids 46/47). So a part that claims to be
independently applicable carries values that cannot be interpreted without a
different part.

Ticking **only ARB** from a BeamNG code while in a Forza mode (or the reverse)
imports numbers in the wrong units. Measured, default chassis, their tune BeamNG
MAN at 25947/24952, mine HORIZON, only `arb` ticked:

```
my gameMode after merge : horizon      (unchanged — gameMode rides with `ride`)
my arbMode  after merge : man
my arbManF  after merge : 25947        (ceiling is 65)
resulting ARB clicks    : 65 65        (computeTune clamps the output)
```

**Severity is display, not output.** `computeTune` clamps to `lim.arb` on the way
out, so the tune the user takes into the game is a legal 65 clicks — maximum bar,
not a wild number. What is wrong is the MAN entry field, which shows 25947 under a
`/ 65` maximum, and the fact that the user asked for the sender's bars and silently
got "maximum" instead.

**The harm is confined to an incoming `arbMode` of MAN**, which is narrower than it
first looks. `computeTune` reads `arbManF`/`arbManR` only in its MAN branch, so under
any other stiffness mode the wrong-unit pair rides along inert and the solver
recomputes bars from the intent fields. Measured, same BeamNG code, only `arb`
ticked, varying the sender's `arbMode`:

| incoming `arbMode` | `arbManF` after merge | ARB output |
|---|---|---|
| `man` | 25947 | **65 / 65** (pinned at the ceiling) |
| `auto` | 25947 | 9.9 / 9.5 |
| `share` | 25947 | 8.8 / 8.5 |
| `roll` | 25947 | 15.4 / 14.7 |

Nor is the inert value a landmine: the MAN button reseeds `arbManF`/`arbManR` from
the solved, already-clamped output, so switching to MAN afterwards overwrites it.

So the whole condition is `arb` ticked **and** `ride` not ticked **and** the
incoming `arbMode` is `man` **and** the two modes differ in physicality. That is
narrow enough that a check on it would essentially never fire spuriously, which is
what makes the warn and refuse options below cheap.

**This became visible by fixing a worse bug.** Until `sanitizeTune` learned about
`gameMode` (see [HISTORY.md](HISTORY.md)), the value was crushed to 65 before the
merge ever ran, so the cross-part case landed on a legal number by accident. The
old behaviour was not better — it destroyed the value on *every* path, including
the all-parts one — but it did mask this.

Nothing warns. The LOAD CODE staging panel summarises the `arb` part as
`arbMode · bias · spring share` and has no cross-part check; `partDiffers` compares
keys within one part and cannot see that a *different* part changes what this one
means.

### What ships: a warning, not a fix

The staging panel detects the exact combination and says what it would cost
(`arbUnitClash` in the LOAD CODE picker) — see [HISTORY.md](HISTORY.md). That
leaves the split itself in place, which is why this entry stays: the structural
problem is still true, it is merely no longer silent.

Warning was chosen over the three structural options below because the output is
clamped to something legal either way, and because this picker's ticks are
deliberately independent — a cross-part refusal would be the first control here
that overrides the reader. The same reasoning the app already applies to MEASURE's
A/B spread and RESTORE's replace counts: state the consequence, let the user
decide.

### The options that were rejected

Each is a decision about what a share part promises, not a bug fix:

- **Move `arbManF`/`arbManR` into `ride`.** Makes the unit and its meaning
  inseparable, which is correct in principle. But it puts ARB values in the part
  labelled SPRINGS, so a reader ticking SPRINGS to take someone's ride frequency
  silently takes their bars too — trading a rare cross-unit case for a common
  surprising one. It also breaks the property that each part maps onto a sidebar
  section, which is what makes the tick list legible.
- **Convert in `mergeTune`** when the incoming and current `gameMode` differ in
  physicality, using the same `arbScaleOf(ch)·track²` the App effect uses. Keeps the
  parts where they are and is invisible when it is not needed. `mergeTune` can do
  this: it holds both chassis objects and `SHARE_PARTS` orders `ch` before `arb`, so
  `out.ch` is already final when the ARB keys are copied. The real objection is
  *which* chassis that is. `arbScaleOf` is a per-car calibration (MEASURE ARB), so
  the conversion is only right when the `ch` part is ticked too — otherwise it
  converts the sender's bars using the reader's click scale and is quietly wrong by
  whatever those two differ by. It also turns `mergeTune` from a dumb key copy into
  something semantic, which is what currently makes the disjointness property
  `tests-share.js` enforces worth anything.
- **Refuse the combination**: disable the ARB tick, with a reason, when the staged
  code's `gameMode` differs in physicality from the current one and `ride` is not
  also ticked. Smallest change, no silent conversion, and it makes the dependency
  visible rather than handling it. But it is the first cross-part constraint in a
  UI whose whole premise is that the ticks are independent.
- **Warn and allow.** Same detection, no restriction. Cheapest, and consistent with
  how the app treats the A/B spread in MEASURE — say what looks wrong, let the user
  decide.

The last two share the detection that shipped, so switching from warning to
refusing is a change of what that detection does, not new work. None of the three
is obviously right, and all of them touch the promise the LOAD CODE panel makes,
which is why the non-structural option went first.

`tests-share.js` cannot catch this class as written: every assertion merges parts
of a code into a tune of the *same* mode, and the guard that shipped lives in the
picker's JSX rather than in `mergeTune`, so it is out of reach of a module-level
suite either way. It is verified in the browser across all four terms of the
condition — see [HISTORY.md](HISTORY.md).

---

## Open — Balance Guide RANGE's sub-1 fractions rank builds by correction, not by rotation

The RANGE band scales its deltas with `balanceBandDelta(frac, gap)` (collected
over each fraction pair by `balanceBandRange`), where
`gap = (1 - natGripBalance) - natMechBalance` (see
[PHYSICS.md](PHYSICS.md)'s Balance Guide RANGE section). A fraction above 1.0
now overshoots toward oversteer under either sign of `gap`, which is what fixed
the DRIFT-points-at-understeer defect in [HISTORY.md](HISTORY.md). A fraction at
or below 1.0 was deliberately left alone, and that leaves a narrower version of
the same tension.

`frac ≤ 1` means "cancel this much of the chassis's natural tendency". On a
front-biased chassis (`gap > 0`) that reads as a rotation scale by accident:
OFFROAD at 0.15 barely corrects the natural understeer and TRACK at 0.95 nearly
erases it, so a higher fraction looks like more rotation. On a strongly
oversteering chassis (`gap` well negative) the same fractions run the other way
— a higher fraction cancels more of the *oversteer*, so it recommends less
rotation. The build table's intended ordering is only preserved by the
`frac > 1` entries.

This is visible where a build's whole pair sits below 1.0 while a more aggressive
build's pair straddles it. AWD is the layout where the two overlap enough to
invert: DRIFT is 0.75–1.30 against TRACK's 0.45–0.80, and on **every** chassis
with a negative gap — anything under 49.51% front on `DEF_CH` — AWD DRIFT's band
hi sits below AWD TRACK's. At AWD 36% front (`nat` 0.631, `gap` −0.332) TRACK
recommends 0.365–0.481 and DRIFT 0.299–0.398: the drift band is the more
conservative of the two.

FWD and RWD hold their ordering across 30–70% front bias except in a narrow strip
just under the crossover, 47.1–49.5% front on `DEF_CH`. There `|gap|` is under
0.03, every band is squeezed to the 0.03 minimum width around grip-neutral, and
DRIFT and TRACK differ by about 0.001 (at 48.3%: DRIFT 0.478–0.508, TRACK
0.479–0.509) — an ordering with nothing left to order. Below that strip their
DRIFT pair (0.90–1.55) clears TRACK's (0.55–0.95) outright.

This entry first quoted AWD DRIFT at 36% as 0.382–0.412 and put the AWD inversion
"below about 45%". Both came from a separate defect since fixed — the band dropped
grip-neutral when a fraction pair straddled 1.0, and the 0.03 floor then inflated
it (see [HISTORY.md](HISTORY.md)) — which also happened to keep FWD/RWD ordered
near the crossover.

Every band still lands on or past grip-neutral on the oversteer side for such a
chassis, so no recommendation is *backwards* in the way the fixed defect was — the
ordering between two builds is what is off: for AWD on any rear-biased chassis,
and for FWD/RWD only where the bands have collapsed to the minimum width anyway.

Fixing it properly means deciding what a sub-1 fraction is supposed to mean:
a fraction of the correction (today), or a position on an absolute rotation
scale anchored at grip-neutral. The second reading would move STREET, TRACK,
RALLY and OFFROAD on every rear-biased chassis, so it is a re-calibration of
published guidance rather than a bug fix, and wants a decision before code.
`tests-docs.js` cannot see this; the pinned characterisation lives in the
scratch verification described in [HISTORY.md](HISTORY.md)'s entry.

---

## Open — the TRACK preset's roll target is out of reach at its own spring rate

TRACK uses ARB Stiffness Mode ROLL ° with a **1.5°** target at 2.50 Hz (×1.05 rear).
On the default chassis its springs alone hold the car to **1.32°** — flatter than the
target — so the solver has no bar budget to give, both bars sit on the 1-click floor,
and `rollClamped` is true the moment the preset loads. The output card's roll-short
note is telling the truth.

In Forza the bars are a small share of total roll stiffness (MOTORSPT's roughly 40
clicks supply about an eighth), so the roll angles a given spring rate can reach form
a narrow window whose top is the springs-only figure. A ROLL ° target has to sit
inside it. Found while seeding Vehicle DNA's roll axis, whose first ranges copied this
mistake; see [DNA.md](DNA.md).

**Not fixed here.** Lowering the target (anything under about 1.3° on the default
chassis) or softening the springs changes what TRACK loads for every user, and which
of the two is right is a tuning decision. MOTORSPT's 0.8° at 3.20 Hz is reachable.

## Open — Beginner's Character slider cannot show three factory presets' damping

The Character slider maps its −50..+50 position to `reboundZeta = 70 − v·0.5`, so it
can only express **ζ 45–95%**, and its readout (`stAgVal`) clamps anything outside
that to the end stop. Since the factory presets were converted to ζ (see
[HISTORY.md](HISTORY.md)), three of them sit below the floor: STREET 30.3%, TRACK
36.6%, X COUNTRY 40.7%. MOTORSPT's 45.8% is just inside.

Loading one of those in Beginner shows Character pinned at **+50 AGILE**. The tune
itself is correct — it is exactly what INT/PRO produce — but the first drag on
Character rewrites ζ from the slider position, so STREET jumps from 30.3% to at
least 45%, roughly 1.5× the rebound damping, from a one-step nudge.

This was reachable before, by switching to Beginner with any tune under ζ 45%. The
conversion made it the normal path for half the factory presets.

**Not fixed here.** Widening the mapping does not move any stored tune — Character
writes `reboundZeta` directly — but it re-slopes what every slider position means
and what the readout shows for every Beginner user, and the new span (and whether
bump ratio's `56 + v·0.22` follows it) is a feel decision rather than a bug fix.

## Open — alignment state travels in neither the share codec nor the garage

`al` is the fourth state group (`suspos_al_v2`: `mode`, `nudgeStrength`, manual
`camberF`/`camberR`/`toeF`/`toeR`/`caster`, plus the legacy `alignManual`). It is
absent from both transport paths, and both docs were silent on it until an audit
went looking:

- **Share codec.** `encodeTune(ch, fe, dr)` takes three groups, `DEF_GROUPS` maps
  three, and no `CODEC_FIELDS` row carries `group:'al'`.
- **Garage.** An entry is `{id, name, ch?, fe?, dr?, tags, notes, …}`. SAVE CAR
  captures neither Alignment Mode nor any manual angle.

For **BUILD** mode this is invisible and arguably correct: `computeAlignment` is a
pure function of `ch`/`tune`/`layout`/`buildType`, all of which travel, so the
receiver recomputes identical angles. That is presumably why the group was never
given ids — the same "computed-locally, shared-as-output" reasoning that still
justifies excluding `useRideHeightCG`.

It stops holding the moment `al.mode` is anything but `'build'`. A PRO user who
picks MANUAL and types exact angles, then shares a code or saves a car, ships or
stores a tune whose alignment silently reverts to the computed values. MECH/GRIP
plus Nudge Strength have the same problem: they are inputs with no other carrier.
Nothing warns either party.

This is the third instance of the same trap. ids 60/61 (`measuredNatBal`) and
65/66 (`rideHeightF/R`) were both added after exactly this reasoning — "its output
already travels, so the input need not" — turned out to have a second consumer.
[CODEC.md](CODEC.md)'s excluded-fields list now says outright that it has been
wrong twice; this would be the third.

**Not fixed here.** Closing it means ids 67+, a fourth group threaded through
`DEF_GROUPS`/`encodeTune`/`decodeTune`/`sanitizeTune`, an `al` payload on the
garage entry shape (and therefore `normalizeEntry`, `kindOf`'s derivation, and the
backup format), and a decision about whether a chassis-less BUILD entry should
carry alignment at all. That is a feature-sized change, not a doc fix. Recorded in
[CODEC.md](CODEC.md) and [PERSISTENCE.md](PERSISTENCE.md) so it is at least no
longer silent.

## Documented — TUNE CHECK cannot reproduce every front/rear damper split

Found while fixing the decode's anchoring (see [HISTORY.md](HISTORY.md)), kept as-is
because both limits are the feel model's, not the decoder's.

DECODE's IMPORT TUNE writes one `dampingBias`, and that single number has to carry two
things the entered tune states separately:

- **Rebound and bump share it.** Under RATIO, bump ζ is a percentage of rebound ζ and
  the same bias splits both axles. A tune whose bump split differs from its rebound
  split — say rebound 6/4 with bump 4/3 — reproduces the rebound exactly and lands the
  rear bump a little off. There is no second slider to put the difference on.
- **±50 bounds the spread.** `zetaR = zetaF · (1 − dampingBias/100)`, so the slider
  reaches a rear ζ of 0.5–1.5× the front. A real tune can sit well outside that; a
  decoded 3/9 rebound split asks for a bias of −261.

**Why it stays.** Widening the bias range would change what every existing tune's
Damping Bias slider means, for a case the app's own solver never produces — the DNA
compiler, the presets and the balance modes all work inside ±50. The honest fix was to
stop hiding it: the DECODED TUNE card now names the bias the split asked for and says
the front is matched while the rear lands as close as the slider reaches. Anyone who
needs the exact split can type it into the DAMPERS section afterward, which the card
already tells them to review.

## Documented — RESPONSE's damping terms saturate above ζ 115%

Found during a physics review, kept as-is, written down so the next audit doesn't
read the bare constant as a typo.

`responseFactors` normalises both damping terms as `(ζ − 10) / 105`, so they
reach 1 at **ζ = 115%** and clamp there. 115 is the INDEPENDENT bump ζ input's
ceiling — but these two terms read `tune.zetaF`/`tune.zetaR`, which are
**rebound** and run to 200%. Consequence: a rebound ζ of 120% and one of 200%
produce an identical RESPONSE score. Together the two terms are 20% of the
weighting, pinned at zero contribution for any tune above 115%.

Every other normalisation in that block uses a named or derived span
(`HZ_MIN`–`HZ_MAX`, `TOE_MIN`–`TOE_MAX`, the 3.5° caster span). This one is a
bare literal, which is what made it look accidental.

**Why it stays.** Widening the denominator to 190 would not just unclamp the top
end — it re-slopes the term across its *whole* range, so every saved build's
RESPONSE score moves, not only the few sitting above 115%. RESPONSE is a feel
score with nothing downstream of it, so the saturation is cheaper than silently
reshuffling every stored build's bar. Revisit only with that trade in view.

## Considered and rejected — putting bump damping into the RESPONSE bar

Left here so the next audit doesn't "fix" the omission again. It was built,
measured, and reverted in the same session.

**The gap is real.** `responseFactors` normalises its two damping terms from
`tune.zetaF`/`tune.zetaR` — rebound only — so the Bump Ratio slider moves the
PLANTED↔REACTIVE bar by exactly zero. Demonstrated with two runs identical but
for Bump Ratio (15% → 60%, rebound ζ held at 30%): the DYNAMICS chart's rear
settle moved 0.74s → 0.58s while RESPONSE sat at −7 BALANCED in both, and the
US/OS bar at +11.4 in both. A quarter-second of real behaviour that neither
character readout noticed.

**The implementation worked.** Effective ζ = `reb + 0.5·(bmp − ref·reb)` with
`ref = DEF_FE.bumpRatio/100`, so the term collapsed to rebound ζ at the default
ratio and shifted no existing tune's score. Measured at ζreb=70%: +2 at Bump
Ratio 15%, −1 at 56%, −4 at 100%.

**Why it was reverted.** The sign is not determinable from the inputs the app
has. Bump damping pulls transient feel two opposite ways:

- **Low shaft speed** — resists roll initiation on turn-in (the outside wheel
  compresses, the inside extends, both strokes resist). Firmer bump → planted.
  This is what the implementation assumed.
- **High shaft speed** — stops the wheel absorbing an impact, so the car gets
  deflected instead of the suspension moving. Firmer bump → skittish, less
  contact, the opposite of planted. This is the rally/baja case, raised by a
  user against exactly this change.

`bumpZetaF`/`bumpZetaR` are single low-speed damping ratios; they cannot
separate the two regimes, and the app has no surface or shaft-speed axis in
RESPONSE to arbitrate. So the term is right on smooth tarmac and backwards on
rough ground, with no way to tell which the user is on. A feel bar that is
confidently wrong for a whole class of builds is worse than one that stays
silent, and the gap that prompted the audit is already closed by the DYNAMICS
chart, which measures the trace rather than asserting a feel direction.

Two things worth carrying forward. First, the same criticism applies to the
**rebound** terms that remain: heavy rebound packs the suspension down over
rough ground for the same reason, so RESPONSE has always been a smooth-surface
model. Second, a build-type-aware version (flip or damp the term for
`rally`/`offroad`) is the physically honest fix, and was rejected only because
it needs both a coefficient and a sign flip with no telemetry behind either.
That is the same trap as `DIFF_BIAS_SCALE`: the direction is arguable, the
magnitude is unknown, and only the magnitude matters once it is wired into
something anyone reads.

Bump is likewise absent from `bDampBias`, the damping contributor to the US/OS
balance bar — there for a stronger reason still. That number is what every
other recommendation in the app is calibrated against, so an invented bump
coefficient would move the balance figure on every tune anyone has saved.

## Open — Handling Balance bar's five contributors aren't on a comparable scale

[FORMULAS.md](FORMULAS.md) documents each contributor's *sign* (oversteer
vs understeer direction) but never claims they're comparable in
*magnitude* — and they aren't. Springs/ARB can swing the bar roughly an
order of magnitude further than diff, brakes, or damping can, even when
those are pushed to their own slider maximums.

`bSp`/`bAb` aren't scaled by an arbitrary constant
at all — they're derived directly from real roll-stiffness shares
(`spShare`/`abShare`), self-normalizing against `rsTotal`. Because Rear
Multiplier (0.50–3.00×) can push the spring-only front/rear split far from
the weight-neutral point, `bSp` alone can reach roughly **±35** at
realistic, in-slider-range settings — worked example: RWD, front weight
52%, `rearHzMult=3.00`, spring share ≈87% → `bSp ≈ (0.52−0.10)×100×0.87 ≈
36.5`. By contrast `bDiffAccel`/`bDiffDecel`/`bBrakeEntry`
are each `<input>% × <weight
fraction> × <flat scale constant>` (`DIFF_BIAS_SCALE=0.14`,
`BRAKE_BIAS_SCALE=0.20`) — maxing the EXIT slider on a RWD Track car tops
out around `bDiffAccel ≈ 3.0`, maxing brake bias around `bBrakeEntry ≈
-3.6`, and `bDampBias` tops out around **±10.7** at Damping Bias's ±50
extreme — a fixed ceiling regardless of the Rebound ζ value the bias is
applied to (the ratio in `bDampBias`'s formula cancels ζ out algebraically).
Diff and brakes are close to invisible on the bar's own scale. Concrete
consequence: `HandlingVerdict`'s dominant-contributor sort
(sorts by `Math.abs(val)`) will pick springs or ARB
as the "dom" contributor almost any time Ride Stiffness/Rear
Multiplier/ARB Bias have been touched at all, even mildly — the actionable
tip can essentially never recommend adjusting diff/brakes unless
spring/ARB sit at *exact* neutral defaults.

Unlike `ARB_RS_SCALE`, `DAMPING_CALIBRATION`, `TIRE_LOAD_SENS`, and
`TIRE_MECH_SCALE` — all tied in [PHYSICS.md](PHYSICS.md) to SimHub telemetry and Stage 2
testing across three real cars — `DIFF_BIAS_SCALE` and `BRAKE_BIAS_SCALE`
have no documented calibration methodology at all. `tests.js` only asserts
*sign* for `bDiffAccel`/`bDiffDecel`, never magnitude; `BRAKE_BIAS_SCALE`
has zero references anywhere in `tests.js`. Git history confirms neither
constant has ever been empirically recalibrated: `BRAKE_BIAS_SCALE` has
exactly one commit (its introduction, `7932982`); `DIFF_BIAS_SCALE` has
one substantive change (`fdc4361`, 0.12→0.14), and that commit's own
message says the bump "compensates for AWD split-by-center" — a
structural fix for the center-fraction math introduced in that same
commit, not a recalibration against real game behavior.

This scale gap is **not** coordinated with the separately-known issue that
RWD Track's diff accel ceiling (`accelBase`) caps out
well below community-typical lock settings. Git confirms `accelBase` has
never been touched since the file's earliest tracked commit — not once,
let alone in tandem with `DIFF_BIAS_SCALE`'s later bump. These are two
independently-evolved numbers that happen to compound (a capped input
*and* a low-visibility scale multiplying it), not a deliberate "keep diff
modest" design.

If either gets addressed, they need independent treatment — no single
constant fixes both, and they carry different risk. Raising `accelBase`
changes the actual differential recommendation entered into Forza; it
should get the same real-car validation rigor as the existing three-car
protocol before changing. Raising `DIFF_BIAS_SCALE`/`BRAKE_BIAS_SCALE`
only changes how loud diff/brakes read on the bar and the
dominant-contributor tip — it doesn't touch `mechBalance`
(a separate roll-stiffness-only calculation) or any
value the user enters into the game, so it's lower blast radius. But
there's no telemetry-backed target to raise either constant *to* — any new
number would be another guess unless someone runs the same kind of
structured test SUSP.OS already has a protocol for. Not fixed here since
it's a calibration question, not a code bug — out of scope for a
documentation pass.

## Open — Ride-height-derived CG height and bottoming risk are unvalidated heuristics

The INT/PRO CHASSIS section's CG Height Source toggle (RIDE HEIGHT, the
default, vs MANUAL) estimates CG height as
`tyreRadiusAvg + weight-weighted rideHeightAvg`, and the accompanying
SAG vs LOAD chart derives static sag purely from ride Hz (`g/(2π·hz)²`),
plotted linearly against a vertical load factor. Unlike `ARB_RS_SCALE`, `DAMPING_CALIBRATION`,
`TIRE_LOAD_SENS`, and `TIRE_MECH_SCALE` — all tied in [PHYSICS.md](PHYSICS.md) to real
telemetry/testing — neither formula has been validated against actual
Forza CG-height behaviour or real bottoming events. Both are geometric
plausibility checks, not measured physics:

- CG height genuinely depends on engine position, body height, and mass
  distribution — none of which are available inputs. The formula sanity
  checks against the existing manual-entry hint's ballpark ranges (a
  typical sports car lands ≈450mm, in the middle of the 400–460mm
  guidance) but that's a single spot-check, not a validated model across
  vehicle classes.
- The estimate is clamped to the 200–1500mm CG Height range, so the tallest
  ride heights saturate it. With 35in truck tyres (~445mm radius), ride heights
  above roughly 41in / 105cm all read 1500mm, and CG stops responding to
  ride-height edits; sports-car tyres reach the cap only near the 48in / 122cm
  input limit. The SAG vs LOAD chart and BOTTOM G's still use the full entered
  ride height. The cap is deliberate: above ~1500mm the inside wheels of a
  typical-track car unload at around half a g, where `mechBalanceLLT`'s
  zero-load floor is doing most of the work and its balance output means little.
- Bottoming risk (and the LOW/MED/HIGH/BOTTOMED badge specifically) is
  still static-vertical-load-only — sag vs. entered ride height at a plain
  g multiplier. The chart's second, fainter line adds *cornering* via the
  same lateral-load-transfer model `mechBalanceLLT` uses (`latLoadTransfer`,
  see [PHYSICS.md](PHYSICS.md#natural-sag-and-bottoming-risk-ride-height-chassis-toggle)),
  so outside-wheel bottoming under a given lateral g is now covered — but
  braking-induced (longitudinal) load transfer and dynamic bump loads are
  still not modeled by either line. A car flagged LOW could still bottom
  out under hard braking or a big compression, and a car flagged
  HIGH/BOTTOMED may never actually touch down if driven gently. The
  LOW/MED/HIGH/BOTTOMED thresholds (0.5/0.8/1.0 sag-to-ride-height ratio)
  are round numbers chosen for intuitive spacing, not derived from any real
  bottoming-incident data. The chart's "bump stop zone" shading (top 12% of
  each axle's travel) is a visual reminder that real springs go progressive
  before contact — it is not a modeled progressive-rate curve.

Both toggle state and its ride-height inputs (`useRideHeightCG`,
`rideHeightF`, `rideHeightR`) are excluded from `CODEC_FIELDS` — only the
resulting `ch.cgHeight` value travels in share codes, since `cgHeight` is a
self-contained absolute value nothing else needs to re-derive. (This used to
be described as following the same pattern as `useMeasuredNatBal` — it no
longer does, since `useMeasuredNatBal`/`measuredNatBal` are now codec ids
60/61; see the "share codes reinterpret the Balance Target" entry below and
[CODEC.md](CODEC.md) for why that exclusion turned out to be wrong for a
value feeding a *delta*-based target. Ride-height CG's exclusion stands on
its own merits, unaffected by that change.)

## Resolved — BeamNG anti-roll output reads soft; ARB Motion Ratio input added

The BEAMNG mode converts the solver's roll stiffness to BeamNG's linear
Anti-Roll Spring Rate by inverting `rs = k·track²/2`, the same relationship the
spring side uses. On the default chassis that yields ≈10,300 / 9,800 N/m front and
rear. A stock vehicle's own defaults, read off the tuning menu, were **40,000 /
60,000 N/m** — roughly 4–6× stiffer.

This entry originally listed three candidate causes with none established. The
research settled it — **one eliminated, one confirmed as the cause, one weakened**
— and the specified fix has since landed as the **ARB Motion Ratio F / R** chassis
input. The research below is kept because it is the whole argument for why the
input exists and why no constant was invented; the two genuine unknowns it names
are still unknown, and are now the user's to supply rather than the app's to guess.

### 1. `ARB_RS_SCALE` doesn't transfer from Forza — ELIMINATED

Verified in `index.html`: under `physUnits`, `clk` is `rs => Math.max(0, rs)`. The
constant is not in the path at all. Every reachable physical-mode budget is
physics-derived — ROLL inverts roll moment / target angle, AUTO and SHARE take a
fraction of the *spring* roll stiffness (`rsSp * share/(1-share)`). The only
`ARB_RS_SCALE` budget path is BASIC, which is hidden in physical modes. The Forza
click constant cannot be causing this.

### 2. The rate is specified at the bar, not at the wheel — CONFIRMED, this is the cause

- BeamNG's docs define `torsionbars` `spring` as **N·m/rad** (torsional) and name
  sway bars as their use case — but the vehicle's tuning slider reads **N/m**, a
  *linear* rate, so that vehicle drives a linear beam rather than a torsionbar.
- The BeamNG forum states the relationship directly: *"the stiffness you get would
  equal the beamSpring you put in multiplied by length of the arm to the power of
  2"* — so the N/m figure is at the bar's own lever and reaches roll stiffness via
  **arm²**.
- The same thread warns *"the motion ratio… definitely means that you shouldn't use
  real life values"* — the identical caveat that motivated the spring/damper Motion
  Ratio input already in the app.

`arbOut`'s `k = 2·rs/track²` assumes the bar's lever arm **is the full track**, i.e.
that the bar acts at the wheels. Any real anti-roll bar attaches inboard on the
control arm, so its arm is shorter and the N/m needed is larger by `(track/arm)²`.
The observed 4–6× implies an arm ratio of ~2.0–2.4×; on a 1.55 m track that puts the
effective arm at roughly 0.63–0.78 m, entirely ordinary drop-link geometry.

### 3. The test vehicle just runs stiff bars — WEAKENED

The gap is systematic across *both* axles rather than one-off, and its magnitude
matches ordinary geometry rather than an outlier setup. Not excluded on a single
vehicle, but no longer the leading explanation.

### Still genuinely unknown

- **The exact coefficient** — whether the relationship is `K = k·arm²` or
  `2·k·arm²`. The two conventions differ by 2× and the forum post is informal prose,
  not a spec. Not something to guess at.
- **The arm length for any given vehicle** — BeamNG does not expose it, and it
  differs per vehicle and per axle, exactly like the spring motion ratio.

### The fix, as implemented

`ch.arbMotionRatioF`/`arbMotionRatioR` (PRO CHASSIS, physical modes only, range
0.20–1.50, default **1.0** so an untouched tune's output is unchanged and no
constant is invented), applied through the existing `mrDiv()` helper as:

```
k = 2·rs / (track² · mr²)
```

Both constraints the specification set were met:

- Applied at **every** N/m ↔ roll-stiffness site — `arbOut` (the ARB rows and the
  dial), MAN-mode entry, and the TUNE CHECK import. Display and entry were checked
  to invert each other exactly across track widths, ratios and rates, because an
  asymmetry between them caused a real bug during the spring motion-ratio work.
- A **separate** field from `motionRatioF`/`motionRatioR`, on codec ids 68/69.

Like the spring motion ratio it is display-only: nothing in `computeTune` reads it,
so Hz, roll stiffness, mech balance and the handling-balance figures do not move
when it is set. At 0.45 on the default chassis the front bar prints 49,000 N/m
instead of 10,000 — a 4.9× correction, inside the 4–6× the sampled vehicle showed.

The amber caveat under the ARB rows now appears **only while both ratios are 1.0**,
and points at the input instead of telling the user to scale the number by hand.

**No fudge factor has been applied** — inventing a multiplier to close the gap is
exactly what the physical-unit approach exists to avoid, and one sampled vehicle is
not a calibration. The default stays at 1.0 for that reason: the app still ships the
unscaled number and lets a user who knows their geometry supply the arm ratio. A
second and third vehicle would confirm the arm-ratio range and settle the
coefficient question (`K = k·arm²` vs `2·k·arm²`), which the input does not decide.

**The in-app caveats now name the input.** The amber banner under the ARB rows and
the suspension card hint state the lever-arm assumption, name ARB Motion Ratio and
suggest a typical 0.4–0.5, and both disappear once either ratio is moved off 1.0.

---

## Open — "NAT" means two different things without MEASURE NAT BAL

`naturalMechBalanceOf(ch)` returns Forza's displayed value when MEASURE NAT BAL
is on, but the geometric roll-stiffness fraction (no tyre term) when it is off.
On staggered tyres without a measurement, the Balance Target's NAT therefore sits
`tireCorr` away from the balance the car actually displays at equal Hz and
minimal bars, so a 0-delta target still asks the solver for a small correction.
`gripNeutralOf` has the mirror problem: it passes `naturalMechBalanceOf` to
`balanceFromRsBal`, which expects a roll-stiffness fraction, so a measured
reading on staggered tyres arrives with the tyre term still in it. Making both
consistent moves stored deltas and GRIP targets for existing builds, so it was
kept out of the MEASURE NAT BAL double-count fix.

Separately, in-game measurement on three cars found the geometric estimate
reads 0.017–0.028 lower than Forza with the tyre term out of the picture. MEASURE
NAT BAL covers this per car; the geometric formula does not.

The tyre-series display adds a third reading of "natural": without a
measurement, `naturalMechBalanceOf` is still the plain mass·track² fraction, but
the display at equal Hz is the tyre-series fraction, which differs by up to about
0.01 on uneven cars. It is the same class of inconsistency as the two above and
was kept out of the tyre change for the same reason.

## Open — the tyre-series model's reach

`displayRsBalance` is fitted to three cars (MX-5 Cup, Ultima Evo, Scirocco R) at
2.5–3.5 Hz. Untested: ride frequencies outside that band, very light or heavy
cars (the √load scaling is extrapolated from 269–476 kg corners), and whether
tyre compound or profile matters (widths 215–335 showed no effect). It governs
only the displayed balance and the target solves: roll angle, GRIP BIAS, the
Handling Balance contribution bars and `coSolveAbCorr` are still suspension-only,
so near a big spring split they no longer describe the same stiffness the balance
readout does. BeamNG has no displayed balance to calibrate against and stays
suspension-only.

## Open — tyre pressure moves Forza's balance, and the app has no pressure input

Changing tyre pressure in Forza's tuning menu moves the displayed mech balance.
The app has no pressure control. `tyreRollStiffness` gives every tyre one
stiffness (`TYRE_HZ` on a `TYRE_REF_MASS` corner, scaled by √ corner mass), and
that stiffness was fitted at whatever pressures the three calibration cars ran,
which weren't recorded. So a tune whose pressures differ from those gets a
displayed balance and target solves that the game won't match. The same goes for
anything else fitted through the tyre: the per-car MEASURE ARB click scales and
MEASURE NAT BAL readings are only valid at the pressures they were measured at.

Not yet known: whether pressure acts through the tyre's stiffness (the series
model predicts a bigger shift on stiffer suspension) or as a flat offset, and
whether it scales with tyre width or compound. A calibration run is planned: a
pressure sweep at two spring stiffnesses, front and rear separately, then with
bars, on the same three cars. Until it's done, keep pressures at stock while
measuring or comparing against the game.

## Open — rehydration still validates only one persisted enum

`usePersist` rehydrates with `mergeDefaults`, a plain spread:

```js
?{...initial,...parsed}:parsed;
```

so a key that is **present** but nonsense beats its `DEF_*` value and wins every
reload. Missing keys are filled; bad ones are not checked. Nothing in the
rehydrate path validates a value against its enum the way `sanitizeTune` does for
a share code, and plain persisted state never passes through `sanitizeTune`.

`fe.gameMode` was the case where this was **fatal** rather than merely wrong, and
it is now handled: `repairFe` (passed to `usePersist` as its `repair` argument)
fixes that one key before the first render, and `limitsOf` keeps an unknown mode
from being a crash in the first place. See [HISTORY.md](HISTORY.md) for the
incident and why the repair cannot live in an effect.

**Every other persisted enum still has the hole.** `arbMode`, `arbBalMode`,
`dampBalMode`, `rearHzMode`, `rideStiffMode`, `dampCharMode`, `rideRef`,
`arbBalTargetMode`, `uiMode` and the rest are all read from persisted state
without validation. None of them crashes — they fall through to a default branch,
or render a `<select>` whose value matches no option — but each can hold a value
the UI cannot produce and cannot clear, and a `<select>` in that state silently
reports `''` to its own change handler, which is how `gameMode` got poisoned to
begin with.

The general fix is to widen `repair` into a per-key validator, or to give
`usePersist` an enum map and check every key it knows about. That is a decision
about every persisted key and its failure mode — which values are worth rejecting,
whether rejecting should be silent, and what a rejected value costs a user mid-tune
— so it wants deciding rather than implementing on the way past. `repairFe` is
deliberately the narrow version: one key, because one key was dangerous.

Related but separate: writing entries straight into `suspos_garage_v2` bypasses
`parseBackup`'s `normalizeEntry` and crashes the garage cards. That one is
expected — see [PERSISTENCE.md](PERSISTENCE.md) — and is a reason not to hand-edit
the key, not a hole in rehydration.

## Open — code review findings (2026-09-18)

Found in a full review of `index.html`. Items marked *reproduced* were run against the
real solver/codec in Node; the rest are from reading the code. None is fixed yet.

- **Cross-game loads re-convert MAN ARB values** *(reproduced)*. The `physMode` effect in
  `App` converts `arbManF`/`arbManR` whenever the click/physical flag flips, but LOAD CODE
  OVERWRITE and LOAD BUILD already bring values in the new mode's units. A Horizon MAN code
  (20 clicks) loaded in BeamNG becomes 0 → 1 click; a BeamNG build (48000 N·m/rad) loaded in
  Horizon becomes ≈27.7M. Only undo restores are exempt (`restoringRef`). Fix: convert in the
  game-mode selector's `onChange`, not in an effect that can't tell a switch from a load.
- **`sanitizeTune` clamps `arbManF`/`arbManR` to 1–65 in every game mode** *(reproduced)*.
  In BeamNG these are roll stiffness, so a shared MAN tune at 48000/30000 arrives as 65/65
  and both ARB outputs read 0 N/m. TO GARAGE stores the same clamped values.
- **ROLL ° button seeds a 0° target** *(reproduced)*. It reads `physics.arbTargetRoll`, which
  `feelToPhysics` sets to 0 unless already in ROLL mode; the 0.3 floor then maxes the bars
  (default car 22.2/21.3 → 65/65). Should seed from `tune.rollDeg`.
- **Loading a factory preset forces HORIZON** *(reproduced)*. `PRESET_SAVES` spread `DEF_FE`,
  so every preset carries `gameMode:'horizon'` and `loadPreset` writes it.
- **BeamNG Ride Stiffness slider can stick** *(reproduced)*. INT/PRO and BEG sliders are bound
  to the post-snap `tune.fHz`/`rHz`; when 0.01 Hz is under half a 500 N/m step, a wheel or
  arrow step re-snaps to the same spring (2000 lb car stays at 1.2041 Hz).
- **HandlingVerdict damping tip is backwards.** It says "Damping Bias toward positive" to add
  front rebound, but the slider's positive side is REAR.
- **"NaN% ARB" when both bars solve to 0** *(reproduced)*. The ARB row's `% ARB` meta has no
  zero guard; TRACK preset in BeamNG shows it on both suspension cards.
- **Footer MECH Δ colours contradict the Balance Guide.** The Balance Guide now uses orange for
  oversteer / blue for understeer; the footer MECH delta and its hint still use blue for
  rear-biased and amber for front-biased.
- **DAMPERS summary mixes pre- and post-solve ζ** *(reproduced)*. REB, BUMP and AVG ζ read
  `physics.zeta*`; SETTLE, MEAS and the output cards read `tune.zeta*`. They diverge under
  CO-SOLVE + SYNC/NEUTRAL, BeamNG snapping, and Forza damper clamping (90% shown vs 85.9%
  exported on a 12000 lb Motorsport car).
- **Track width above 2.2 m is cut by the codec** *(reproduced)*. The fields and SLIDERS.md
  allow 1000–2600 mm, but `sanitizeTune` clamps `trackF`/`trackR` to 1.0–2.2 m.
- **Balance Mode hint shows a literal "%%"** ("raw weight %%"), from a printf-style escape in
  a template literal.
- **EQUAL ROLL shows its non-zero NET in success green**, the colour CANCEL uses for a
  successful cancel.
- **Stale `~index.html:NNNN` references** in the FWD diff-polarity comments (in `computeDiff`
  and at the EXIT slider) now point at `sanitizeTune` and `feelToPhysics`.

## RESET with Tutorials ticked while on INT or PRO can lock the current tier

RESET clears `suspos_tutorial_seen_v1` but leaves `uiMode` alone. The `uiMode`
effect then marks only the *current* tier's guide as seen and reopens it, so a
reset done on INT leaves you on INT with `tutSeen.beginner` false: the INT button
shows 🔒 while you are on it, and PRO is unlocked. Opening the BEG guide
(or clicking INT) restores the normal order. The gating rules were left as-is.

---

## Accepted — Ride Stiffness can read 3 decimals after a BOTTOM G's edit

The Hz sliders step by 0.01 and the BOTTOM G's slider steps by 0.01 g, but the
stored value lands on the 0.001 Hz grid `hzToRs` imposes (see
[PHYSICS.md](PHYSICS.md)'s "The 0.001 Hz grid"). Because `Hz ∝ √g`, one g step is
worth well under 0.01 Hz over most of the range, so a tune resolved from BOTTOM
G's keeps a third decimal — the Ride Stiffness number box shows `2.446`, not
`2.45`, and `NumBox.fmt` widens `dp` to the value's own precision rather than
truncating it.

This is deliberate. Two alternatives were considered and rejected:

- **Round the stored value back to 0.01 Hz.** That is the grid the dead steps came
  from: two to five consecutive g steps, and closer to ten near the ceiling,
  produced no change in the tune at all.
- **Format the box to 2dp and keep the 0.001 grid.** Two readings that look
  identical would then export different spring rates, which is worse than an
  extra digit.

Typing into the Hz box, or stepping either Hz slider, still lands on 0.01 — the
third decimal only appears when BOTTOM G's put it there.
