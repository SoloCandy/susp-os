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
`gap = gripNeutral - natMechBalance` (see
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
with a negative gap — anything under about 49.5% front on `DEF_CH` — AWD DRIFT's band
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

## Open — DNA codes have no checksum

Tune codes carry a `~` checksum as their second pair (see [CODEC.md](CODEC.md)
"Integrity"), so a code cut short in transit is refused. DNA codes do not. They are
short, but a cut one still decodes with its missing axes at their defaults, or a value cut
mid-digit and clamped by `sanitizeDNA`. The same second-pair `~sum` would work there
unchanged: `decodeDNA` already skips a pair without a `:`. It was left out of the tune fix
because DNA codes have their own version and their own tests (`tests-dna.js`), and the
change belongs with them.

---

## Open — alignment state travels in neither the share codec nor the garage

`al` is the fourth state group (`suspos_al_v2`: `mode`, `nudgeStrength`, manual
`camberF`/`camberR`/`toeF`/`toeR`/`caster`, plus the legacy `alignManual`). It is
absent from both transport paths, and both docs were silent on it until an audit
went looking:

- **Share codec.** `encodeTune(ch, fe, dr)` takes three groups, `DEF_GROUPS` maps
  three, and no `CODEC_FIELDS` row carries `group:'al'`.
- **Garage.** An entry is `{id, name, ch?, fe?, dr?, tags, notes, …}`. SAVE CAR
  captures neither Alignment Mode nor any manual angle.

For AUTO with Nudge OFF (`al.mode` `'build'`) this is invisible and arguably correct: `computeAlignment` is a
pure function of `ch`/`tune`/`layout`/`buildType`, all of which travel, so the
receiver recomputes identical angles. That is presumably why the group was never
given ids — the same "computed-locally, shared-as-output" reasoning that still
justifies excluding `useRideHeightCG`.

It stops holding the moment `al.mode` is anything but `'build'`. A PRO user who
picks MANUAL and types exact angles, then shares a code or saves a car, ships or
stores a tune whose alignment silently reverts to the computed values. Nudge MECH/GRIP
plus Nudge Strength have the same problem: they are inputs with no other carrier.
Nothing warns either party.

This is the third instance of the same trap. ids 60/61 (`measuredNatBal`) and
65/66 (`rideHeightF/R`) were both added after exactly this reasoning — "its output
already travels, so the input need not" — turned out to have a second consumer.
[CODEC.md](CODEC.md)'s excluded-fields list now says outright that it has been
wrong twice; this would be the third.

Below PRO this no longer reaches the output: leaving PRO resets `al.mode` to AUTO (Nudge OFF), so
BEG and INT always show the computed alignment. The gap is between PRO sessions and devices.

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

## Considered and rejected — damped FLAT RIDE and a least-pitch damper mode

Both were checked against the app's pitch model (2.6 m wheelbase; 50/70/110 mph;
ζ 35/55/70%; bump ratio 56%; FRONT, REAR and SHARED ride reference).

**Damped FLAT RIDE** — matching damped periods, fd = fn·√(1−ζ²), instead of
undamped ones. It lowers the rear Hz (up to 1.26 Hz with FRONT reference, 0.36
REAR, 0.58 SHARED) and pitched more in every case under all three references.
Worst increases: FRONT +7% equal ζ / +20% TIME SYNC; REAR +9% / +28%; SHARED
+8% / +48%. The pitch-optimal rear Hz was always *above* FLAT RIDE's, often at
the 5.5 Hz ceiling, so the metric has no interior optimum to target either.

**Least-pitch rear-ζ mode** — with FLAT RIDE Hz fixed, solve rear ζ for minimum
pitch. At best 1% better than the better of TIME SYNC and equal ζ, and the
optimum sat at about the TIME SYNC value. Not worth a fifth mode.

Result: FLAT RIDE + TIME SYNC is effectively the lowest-pitch pairing; the
glossary and [SLIDERS.md](SLIDERS.md) say so.

## Considered and rejected — a META tier for wide-rear-tyre builds

Meta builds (very wide rear tyres for cheap PI, paired with near-floor front / near-ceiling
rear ARBs to win the rotation back) use a fraction of PRO's surface, so a fourth tier that
assumed the build and hid the rest was considered. Rejected: tiers are an ordered superset
(BEG ⊂ INT ⊂ PRO), and roughly a hundred `uiMode` checks, the tier guides, the unlock chain and
the codec's tier field all assume that order. A side-branch tier would need every one of them
revisited, for what is really a display preference. What shipped instead is the SECTIONS
modal: INT and PRO each hide whatever they don't use, without the tune or the physics knowing
— see [CODE_MAP.md](CODE_MAP.md#hidden-sections-sections-modal).

## Open — LANDING solves one linear coefficient against a rigid floor

BUMP MODE → LANDING (see [PHYSICS.md](PHYSICS.md#landing-bump-mode)) is a guide figure,
like BOTTOM G's, and shares its assumptions:

- **Ride height is the whole travel**, and the floor is rigid. There is no tyre flex, no
  progressive bump stop and no packer, and the "bump stop zone" on the SAG chart is not
  modelled. Real cars catch somewhat more than the figure says.
- **The hit starts at static ride height.** A car landing from a jump arrives with the
  suspension at droop, so it has more travel than the model gives it but also more
  energy. The model treats the drop as a hit at the landing speed `√(2g·drop)` from rest
  position. That is closer to a square-edged bump than to a true landing.
- **One coefficient for every shaft speed.** Forza has a single bump value, so the bump
  that catches a big landing also stiffens the car over small chatter. Rally setups want
  soft low-speed bump for exactly that reason. The solve picks the softest ζ that works,
  which limits the cost but can't remove it. The same limit is why bump stays out of
  RESPONSE (below).
- **Only the RIDE REF. axle is guaranteed** to catch the drop. Damping Balance Mode
  splits the anchor, so the other axle catches whatever its share gives it. The Catch row
  shows that honestly instead of forcing it, the same way the DAMPERS table treats the
  non-reference axle's settle time under SETTLE TIME.
- **The game's click range can undo the solve.** When `dampScale` scales dampers down to
  fit `lim.damping`, the final bump is softer than solved. The Catch row reads the final ζ,
  so it shows the shortfall.

## Considered and rejected — a bump mode that works in force at a reference speed

Raised alongside LANDING: set bump as a force (N at some shaft speed) instead of a ζ.
With the app's linear damper, force at speed `v` is just the coefficient times `v`, so the
choice of `v` is arbitrary and the control would only relabel the number. It would also
duplicate EQUAL FORCE, which already balances damping by `ζ·m·Hz`. LANDING gives the speed
a meaning (the landing speed from a drop height), so force comes out as a result on the
Catch row's tooltip instead of being typed in.

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

## Open — Handling Balance bar's five contributors aren't on a comparable scale (BEG/INT)

BEG and INT only. PRO reads Handling Balance as grip-margin percent by phase
(`phaseMargins`, [FORMULAS.md](FORMULAS.md) "Phase margins"), where springs, ARBs, chassis,
brakes and drive all come out of one grip model in one unit, and diff and damping — the two with
no defensible size — show a direction only. The point bar below is still what BEG/INT show and
what `recommendedDiffType` reads. The headline is only NET (car, springs, bars) now; diff, brakes
and damping sit in the bar's ENTRY / EXIT lanes, so the mismatch shows as lane length rather than
as a shift in the headline. `recommendedDiffType` still reads the full sum.

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
  typical-track car unload at around half a g, and while `mechBalanceLLT` is no
  longer wrong there — its transfer cap keeps it monotone through lift, see
  [HISTORY.md](HISTORY.md) — an axle whose inside wheel is airborne has stopped
  responding to roll stiffness at all, so the balance output still says very
  little about how the car can be tuned. `balanceEnvelope` flags that case
  directly now (`LIFT`), which is the honest version of what this cap was
  standing in for.
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
  VISUALS ARB track), MAN-mode entry, and the TUNE CHECK import. Display and entry were checked
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

**The in-app caveat now names the input.** The amber note under each suspension
card's Anti-Roll row states the lever-arm assumption, names ARB Motion Ratio and
suggests a typical 0.4–0.5, and disappears once either ratio is moved off 1.0. The
card's hint points to it ("Anti-Roll reads soft — see the note under that row").

---

## Open — how large a tyre stagger reads rests on an uncalibrated exponent

The Handling Balance bar's CHASSIS contributor (`bChassis`, see [FORMULAS.md](FORMULAS.md))
has the grip model's sign by construction and does not depend on `MECH_BAL_GAIN`. Its
**size** on a staggered car, though, is set almost entirely by `WIDTH_GRIP_EXP = 0.4` — how
much grip a wider tyre adds — and that exponent has no documented calibration. On the default
chassis a 235/305 stagger reads about −37; a 255/285 one about −19. The direction is the
textbook one (wider rears add rear grip, so understeer); whether a 70 mm stagger is worth 37
points of stiffness bias or 20 is not something the app has measured. PRO's MID CAR STARTS row,
in grip-margin percent, comes out of the same grip model and rests on the same exponent.

It matters more now than it did: before the chassis term, `WIDTH_GRIP_EXP` only reached the
PRO-only GRIP BIAS readout. It now moves the headline OS/US figure every tier sees. Calibrating
it needs at-limit data — a skidpad balance or slip-angle comparison with only tyre width
changed — which the three-car protocol does not collect.

## Open — PRO's ENTRY and EXIT figures are read at chosen loads

`phaseMargins` reads ENTRY at `ENTRY_G = 0.3` g of braking and EXIT at `EXIT_G = 0.2` g of drive.
Neither is measured; they are stated beside the figures because how hard someone trail-brakes or
feeds in throttle is the driver's, not the tune's. BRK and DRIVE scale with them roughly
linearly, and PITCH — the car's own weight transfer — scales faster and is larger than any
setting at any realistic load, which is why it is shown but left out of both totals. Diff lock and
damping have no size in PRO at all: `DIFF_BIAS_SCALE` is uncalibrated (see the BEG/INT entry
above), and damping acts in transients a steady-state model cannot size. Sizing either needs
at-limit data the three-car protocol does not collect.

The bar's TOTAL line in PRO adds BRK and DRIVE to MID, so it sums terms read at two different
chosen loads, and leaves diff and damping out for want of a size. It says where the sized terms
land together, not what the car does at any one moment.

## Open — GRIP USE predicts shares, not the limit itself

GRIP USE says which axle runs out of grip first and how much the other has spare, but not at
what lateral g: the grip model has no tyre friction coefficient, so its capacities are relative.
It also reads load transfer at the model's 1 g reference rather than at the limit itself, and
treats both tyres on an axle as using the same share of their grip (one slip angle, force in
proportion to capacity); a real tyre pair at different loads and cambers will not match exactly.
ENTRY and EXIT carry the chosen loads above. Treat it as a ranking of where grip runs out, and
check it against the car on track.

## Open — VISUALS shows the Balance Target when nothing solves toward it

Only the displays are affected: MATCH CHASSIS and alignment Nudge MECH, which also read the
target, act only while `hasBalTargetSolve` holds (see [FORMULAS.md](FORMULAS.md)).

The MECH BALANCE strip draws TGT only while something solves toward the target (MECH or CO-SOLVE
under a non-MAN Stiffness Mode, or Hz MODE MECH). VISUALS' ROLL SPLIT and the RIDE Hz / ARB tracks
draw the green target tick, label and rings whenever `feEffective.arbBalTarget` differs from NAT,
and `resolveFeEffective` always resolves it: an untouched target falls back to
`MECH_BALANCE_TARGET` (0.60). So INT, which cannot set a target, sees a green 0.60 mark on most
cars. The `ride-roll-damping` glossary entry explains it at INT rather than hiding it; making the
two displays agree is a code change not yet made.

## Open — three brake-bias models disagree

Brake bias is read three ways, and they do not share a neutral point:

- **BRAKES card** (every tier and game): `recBrakeBias` is the front weight plus
  `cgHeight/wheelbase × 50`, a build-type mod and, at PRO only, a grip-balance adjustment,
  clamped to 40–68. Its note reads FRONT above 55, REAR below 50.
- **BEG/INT Handling Balance** (the BRK segment and its correction tip): `bBrakeEntry` measures
  that same value against a fixed 50%. The card's own recommendation is usually front of 50, so
  the bar almost always counts it as understeer.
- **PRO ENTRY** (`PhaseVerdict`): `phaseMargins` measures it against `idealBrakeF`, BRAKES' GRIP
  bias at `ENTRY_G` (0.3 g of braking), close to the front weight plus `ENTRY_G ×
  cgHeight/wheelbase`. The card counts more weight
  transfer than that, so the recommendation normally sits forward of the PRO ideal and ENTRY
  reads BRK as understeer too.

So the app recommends a value that two of its own readouts call understeer-biased. The hints no
longer tell the user to move it, and the ENTRY line says the card usually reads this way, but
the models are unreconciled. Picking one reference is a model decision with no telemetry behind
it (see the scale entry above for `BRAKE_BIAS_SCALE`).

At INT and PRO, BRAKES' Brake Bias can shift `brakeBias` up to 10 points from `recBrakeBias`; at
its default and in BEG they are equal. PRO's GRIP Centre (`gripBrakeBiasOf`) is the
same solve as ENTRY's reference at a chosen decel, so at 0.3 g the two PRO readings agree; the
card and the BEG/INT BRK segment still do not. PRO's ENTRY Centre solves against that same
reference, and leaves the off-throttle diff and damping out of the solve because PRO does not size
them ([FORMULAS.md](FORMULAS.md) "ENTRY brake target"). So the BRK segment mostly shows how far the app's own
recommendation leans, and today most of
that is the weight transfer the card adds on purpose. The card's `cgHeight/wheelbase × 50` is the
load-proportional split at 0.5 g of braking; PRO's `idealBrakeF` is GRIP's split at `ENTRY_G`,
0.3 g, within about a point of the load-proportional one. On the default chassis (h/L ≈ 0.167) that is +8 against +5, and BEG/INT counts all +10
above 50.

**Proposal — one reference, `brakeRefF(ch) = frontBias + 100 × ENTRY_G × cgHeight / wheelbase`.**
PRO's `phaseMargins` uses its grip-model form (`idealBrakeF = gripBrakeBiasOf(ch, ENTRY_G)`,
within about a point of this), and `ENTRY_G` is the load the grip model sizes ENTRY at, so it is the only choice that is consistent with the model reading it. Then:

- BEG/INT: `bBrakeEntry = −(brakeBias − brakeRefF) × BRAKE_BIAS_SCALE`, replacing the fixed 50.
- The card: `recBrakeBias = brakeRefF + BRAKE_STABILITY_MARGIN + build mod (+ PRO grip term)`,
  with the margin a named `100 × (0.5 − ENTRY_G) × cgHeight / wheelbase` — the gap between the
  two loads, made explicit instead of hidden in a different constant.

That keeps every recommended number the same (to rounding), and makes both readouts show what the
recommendation *deliberately* adds on top of neutral: the stability margin and the build mod
(TRACK +3 reads slightly understeer, DRIFT −5 slightly oversteer), which is what the BRK row
should mean.

Trade-offs, and why it is not done here:

- **Every BEG/INT balance total moves toward oversteer**, by `(brakeRefF − 50) × 0.20`: +1.4 on
  the default chassis, more on tall or front-heavy cars. The verdict band, the factory presets'
  "reads neutral" state and the `tests-balance.js` fixtures were all set with the old offset in
  place and would need re-baselining.
- **The alternative, moving the card to 0.3 g** (no margin), is simpler but shifts every
  recommended value — the one number users type into the game — about 3 points rearward (5–6 on
  tall SUVs). Rearward bias raises rear lock-up under threshold braking, where the true
  load-proportional split (≈1 g) is well forward of both figures.
- **Moving ENTRY_G to 0.5** instead would reconcile PRO with the card, but it also scales PITCH,
  BRK and every ENTRY margin, and 0.5 g of sustained trail-braking overstates typical entry load.
- None of the three has telemetry behind it; the margin option is the only one that changes no
  output, only what the readouts measure from.

## Open — the diff-type scale factors have no source

`DIFF_TYPE_SCALE` (Race 1.00, Sport 0.88, Rally 0.76, Offroad 0.52, Drift 1.10) says the same
lock % locks a different amount on each diff type. The code calls the values community-estimated,
but no source or in-game measurement for them is on record, and a search of published Forza tuning
guides (October 2026) found none. Those guides describe the five Horizon diffs as differing in
which sliders they unlock, not in how hard a given % locks. Several give the same tuning advice for
every adjustable type.

What is confirmed, and matches the app:

- Horizon's adjustable diffs are Sport, Race, Rally, Off-Road and Drift. Rally and Off-Road are
  offered only on some cars.
- Sport unlocks acceleration lock only: no deceleration, and no centre balance on AWD, where it
  unlocks front and rear accel.
- Race, Rally, Off-Road and Drift unlock every diff slider.

What is not:

- **The scale itself.** It sets real outputs, not just a readout. AUTO divides by it, so on the
  default chassis a TRACK RWD asks for 35% accel on Race, 46% on Rally and 67% on Offroad, and an
  AWD rear accel goes from 48% to 92%. If the types in fact lock the same at the same %, a Rally or
  Offroad AUTO tune locks 1.3× or 1.9× harder than intended. The Offroad saturation entry below
  exists only because of the 0.52.
- **Wording that rests on it.** The DIFF TYPE hint ("the same lock % locks harder on RACE or DRIFT
  than on RALLY or OFFROAD"), the `diff-type` glossary entry, the Diff Type tutorial step, the
  higher MANUAL typical ranges for Rally and Offroad, and the DIFFERENTIAL card's RECOMMENDED
  reasons ("sharpest, most predictable lock", "softer lock curve", "most compliant", "most
  aggressive engagement"). Forza exposes one lock % per slider, and no source found describes an
  engagement curve that differs by type. [HINTS.md](HINTS.md) quotes the hint as the app shows it.

Measuring it is possible: Forza's Data Out telemetry streams each wheel's rotation speed. The
same car, at the same lock %, with Race, then Rally, then Off-Road fitted, run through the same
power-on corner, gives the wheel-speed split each type allows. Until then the safe neutral is every
scale at 1.00. That would change every non-Race AUTO output, so it waits for a decision.

## Open — the RACE → SPORT switch above +8 works against its own model

`recommendedDiffType` turns a Race recommendation into Sport when `bTotFull` is above +8, to calm a
strongly oversteery car. In `computeDiff`, rear decel lock is the term that resists oversteer
(`bDiffDecel` is negative), and Sport forces decel to 0. AUTO keeps the accel term the same across
types, so the net effect of taking the suggestion is to drop the stabilising term: on the default
chassis a TRACK RWD's `bDiffDecel` goes from −0.81 to 0, and the car reads more oversteery than
before. The suggestion's reason, "clean exit traction without decel snap", does not match how the
app models decel lock either. The rule needs replacing, not retuning, and nothing better has been
chosen yet.

## Open — DRIFT's typical decel and the DRIFT build's AUTO locks run against drift practice

`DIFF_TYPE_RANGES.drift.decel` is 0–8%, "kept low on purpose for rotation", and a DRIFT build's AUTO
on RWD gives about 44% accel and 2% decel on a Drift diff. Published Horizon drift guides commonly
run accel and decel both at or near 100%, so the rear wheels stay locked together through
transitions. The app's MANUAL typical line, and the AUTO starting point, sit at the opposite end.
Whether a grip-style lock is a deliberate choice for the DRIFT build or an oversight is not
recorded; until it is, the range should not be read as community practice.

## Open — a SPORT diff's decel lock is assumed to be 0

Sport has no decel slider in-game, so `computeDiff` writes 0 for every decel lock on a Sport diff
and the balance counts no decel term. The game must use some fixed decel value it does not show,
and nothing here says what that value is. It is the same gap as the Sport centre split below.

## Open — DIFF TYPE applies in MOTORSPORT and BEAMNG

`computeDiff` never reads the game mode, so the five Horizon diff types, their scale factors and
Sport's N/A rows apply in every mode, the BeamNG DIFFERENTIAL output included. Forza Motorsport's
tuning needs a single adjustable, race-level diff, and no Rally, Off-Road or Drift diff was found
there. BeamNG's diffs are a different set (open, LSD, locked, viscous) and map onto none of these.
The `diff-type` glossary entry already says BeamNG has no diff-type recommendation; the picker and
the scaling still apply there.

## Open — AUTO diff locks saturate at 100% on an Offroad diff

AUTO solves in effective (Race-equivalent) lock and divides by `DIFF_TYPE_SCALE`, then
`lockPct` caps the result at 100%. Offroad's 0.52 puts anything above 52 effective past
that cap: RWD accel tops out at 65 effective (125%) and AWD rear accel at 70 (135%), both
entered as 100%. Two things then stop holding at those extremes: the diff balance reads
100 × 0.52 = 52 effective, less than the same intent on Race, and the % can sit above
Offroad's `DIFF_TYPE_RANGES` typical top of 90. It takes a far-ROTATE EXIT or MATCH
CHASSIS push to get there. No higher % exists in the game, so the cap itself is right; the
open question is only whether the balance should say the diff is out of lock instead.

## Open — a SPORT diff's hidden centre split still weights the AWD DIFF balance

A Sport diff has no centre lock: CENTER POWER SPLIT hides and the card's Center Split reads N/A.
`computeDiff` still clamps `dr.diffCenter` to 45–90 and uses it as `C`, the front/rear weighting
of the AWD DIFF balance terms, so a split set before switching to SPORT keeps moving the DIFF row
with no control on screen. What Forza actually splits a Sport AWD diff at is unknown here, so there
is no better fixed `C` to use yet.

## Open — the RIDE Hz track marks the rear row amber whichever axle clamped

`physics.rearHzClamped` means the *derived* axle's Hz hit the band, and the RIDE card and
`hzClampNote` read `physics.rideRef` to name it. `VisSuspTracks`' RIDE Hz track passes the flag
only to the rear row, so under a REAR ride reference, where the front is the derived axle, the
amber lands on the rear row that was set directly. The summary's amber is right; the row is not.

## Open — the unmeasured natural reads low against Forza

In-game measurement on three cars found the geometric estimate (`natGeomOf`) reads
0.017–0.028 lower than Forza with the tyre term out of the picture. MEASURE NAT BAL
covers this per car; the geometric formula does not, so `natDisplayModelOf` — the
unmeasured natural every target is a delta from — inherits the same bias.

This is a calibration gap in the geometry model, not the space confusion that used
to share this entry: "natural" now has one definition per space (`natRsOf`,
`natDisplayOf`), which is recorded in [HISTORY.md](HISTORY.md). Closing this one
needs more than three cars' worth of readings to say whether the bias is a constant,
scales with track width, or depends on something the model does not take as input.

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
`uiMode` and the rest are all read from persisted state
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
- **Loading a factory preset forces HORIZON** *(reproduced)*. `PRESET_SAVES` spread `DEF_FE`,
  so every preset carries `gameMode:'horizon'` and `loadPreset` writes it.
- **BeamNG Ride Stiffness slider can stick** *(reproduced)*. INT/PRO and BEG sliders are bound
  to the post-snap `tune.fHz`/`rHz`; when 0.01 Hz is under half a 500 N/m step, a wheel or
  arrow step re-snaps to the same spring (2000 lb car stays at 1.2041 Hz).
- **"NaN% ARB" when both bars solve to 0** *(reproduced)*. The ARB row's `% ARB` meta has no
  zero guard; TRACK preset in BeamNG shows it on both suspension cards.
- **Footer MECH Δ colours contradict the Balance Guide.** The Balance Guide now uses orange for
  oversteer / blue for understeer; the footer MECH delta and its hint still use blue for
  rear-biased and amber for front-biased.
- **Track width above 2.2 m is cut by the codec** *(reproduced)*. The fields and SLIDERS.md
  allow 1000–2600 mm, but `sanitizeTune` clamps `trackF`/`trackR` to 1.0–2.2 m.
- **EQUAL ROLL shows its non-zero NET in success green**, the colour CANCEL uses for a
  successful cancel.

## Accepted — the update notice watches `#app-source` only

`useDeployCheck` lights the GitHub button only when the live file's `#app-source`
differs from the tab's. A push that changes only what sits outside it — the CSS in
`<head>`, the loader script at the end — never reaches an open tab or a downloaded
copy until it reloads or is downloaded again for another reason. The rest of the file
can't be compared: React and Babel rewrite the DOM around it, so the tab has no clean
copy. Those parts change rarely, and nearly every feature lives in `#app-source`.

## Accepted — a downloaded copy that differs from live reads as out of date

Off file://, "different from the Pages site" is taken to mean "older". A copy edited
by hand, or downloaded from a branch ahead of `main`, shows the ↓ download state too.
Telling newer from older would need a version stamp that a push without a build step
would have to keep updated by hand. A local copy also checks only while online; offline it
stays quiet, which is the intended degradation.

---

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
