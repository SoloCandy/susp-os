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

## Open — BeamNG anti-roll output reads soft; cause identified (wrong lever arm), fix deferred

The BEAMNG mode converts the solver's roll stiffness to BeamNG's linear
Anti-Roll Spring Rate by inverting `rs = k·track²/2`, the same relationship the
spring side uses. On the default chassis that yields ≈10,300 / 9,800 N/m front and
rear. A stock vehicle's own defaults, read off the tuning menu, were **40,000 /
60,000 N/m** — roughly 4–6× stiffer.

This entry originally listed three candidate causes with none established. That
research is now done: **one is eliminated, one is confirmed as the cause, and one
is weakened.** The gap itself is still open — nothing in the app has changed.

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

### Deferred fix (specified, not implemented)

An **ARB Motion Ratio F/R** chassis input, defaulting to **1.0** so today's output
is unchanged and no constant is invented, applied as:

```
k = 2·rs / (track² · mr²)
```

reusing the existing `mrDiv()` helper next to `springOut` in `index.html`.

Two constraints for whoever implements it:

- It must be applied at **every** N/m ↔ roll-stiffness site — the ARB output card,
  MAN-mode entry, and the Tune Check ARB inputs. An asymmetry between the display
  and entry conversions caused a real bug during the spring motion-ratio work.
- It must be a **separate** field from `motionRatioF`/`motionRatioR`. The spring
  mount and the ARB drop link are independent geometry; reusing the spring value
  would be wrong.

**No fudge factor has been applied** — inventing a multiplier to close the gap is
exactly what the physical-unit approach exists to avoid, and one sampled vehicle is
not a calibration. A second and third vehicle would confirm the arm-ratio range and
settle the coefficient question.

**The in-app caveats already name this cause.** The amber banner under the ARB rows
and the suspension card hint both state the lever-arm assumption and tell the user to
scale by (track/arm)² if they know the geometry. They read *"cause unresolved"* until
this research landed; they no longer do, and need no further wording change before the
deferred fix.
