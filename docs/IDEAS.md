# Ideas — parked designs

Designs worked out far enough to be worth keeping, but **not implemented and not
scheduled**. Nothing here describes current behaviour; check the code before
assuming any of it exists. When an idea ships, move its substance into the
relevant reference doc and record it in [HISTORY.md](HISTORY.md). When one is
rejected, move it to [KNOWN_ISSUES.md](KNOWN_ISSUES.md) with the reasoning.

---

## Alignment revamp (Forza)

Replace the ALIGNMENT section's AUTO / MANUAL + Nudge with controls in tuner vocabulary,
make the output explain itself, and add an ALIGNMENT group to VISUALS. Forza only for now.
The game's input span is already in code as `ALIGN_GAME` (camber and toe −5..+5°, caster
1–7°, 0.1° steps), and the recommendation bands as `ALIGN_REC`; see [ALIGNMENT.md](ALIGNMENT.md).

### Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Nudge MECH / GRIP | **Retired** (Phase 2). A saved `mech`/`grip` migrates to AUTO | Abstract (it follows a balance gap), often invisible (rounds back to the AUTO value), and the balance model never sees it |
| BEG | AUTO, plus the clearer output | Beginners read values; they don't tune alignment |
| INT | AUTO + intent sliders, **and MANUAL** | Tune Check's DECODE will take an existing in-game alignment and import it into MANUAL, and DECODE is open below PRO |
| PRO | Everything in INT, plus the symptom fixer | The camber sliders came down to INT: MANUAL camber has to translate into something AUTO holds |
| Balance model | **Shipped, following dampers:** INT sizes alignment in points like DAMP (small, uncalibrated); PRO shows its direction only (`alignBalanceOf`, see [FORMULAS.md](FORMULAS.md)). The Handling Balance headline reads ENTRY · MID · EXIT in words from INT up; INT stays on its own point model, since PRO's % model rests on PRO-only inputs (track widths, measured natural balance) | None of the alignment constants are calibrated. Leading idea, undecided: direction-only arrows on the Handling Balance lanes, the way diff lock and damping show now, with no magnitude |
| VISUALS | Camber-vs-roll chart, and range strips | Picked from a longer list; the tyre front view and the top-down toe diagram are not planned |
| Reference steer angle | 10° (`CASTER_REF_STEER`) | Owner's call |
| Intent reach | Offsets may carry a value past `ALIGN_REC`, to `ALIGN_GAME` | Owner's call: the sliders exist to override the recommendation |
| What travels | Intent only. MANUAL translates to its closest AUTO setting on the way out, and on switching to AUTO; AUTO → MANUAL starts from what AUTO + intent shows | Owner's rule, so a received alignment keeps following the reader's car |

### Phase 1 — output (shipped)

IN/OUT on toe, LIMIT, caster's steer camber, `AUTO x°` under MANUAL, and the term breakdown in the
card hint. Now described in [ALIGNMENT.md](ALIGNMENT.md) ("The ALIGNMENT output card").

### Phase 2 — controls (shipped)

Five intent sliders under AUTO (Camber F / R ±2.0°, Turn-in and Rear stability ±0.3°, Steering
feel ±1.5°), MANUAL in INT, AUTO ↔ MANUAL translation, alignment state moved into `dr`, codec ids
91–95 and the ALIGNMENT share part. Now described in [ALIGNMENT.md](ALIGNMENT.md) ("Intent and
MANUAL") and [CODEC.md](CODEC.md). The slider ranges are first guesses, to be tuned with use.

### Phase 3 — Tune Check DECODE: alignment (shipped)

DECODE's step 1 takes an optional alignment, and IMPORT TUNE writes it into MANUAL. Now described
in [ALIGNMENT.md](ALIGNMENT.md) ("Intent and MANUAL").

### Phase 4 — VISUALS: ALIGNMENT group (shipped)

CAMBER vs ROLL and RANGES. Now described in [VISUALS.md](VISUALS.md#alignment). Not done from the
first sketch: a second dot at the ENTRY / EXIT roll.

### Phase 5 — the symptom fixer

Grew past alignment: it is now its own idea, [Symptom fixer](#symptom-fixer-int), covering every
control. The alignment proposals sketched here are its v2 alignment rows.

### Open questions

- The intent slider ranges, once they have been used.

---

## Symptom fixer (INT+)

A toolbar panel where the tuner says what feels wrong, in problem terms ("it pushes on entry"),
and the app proposes **one** change to the controls they already have. It says why, shows what it
does before it's applied, and applies it with one tap. The change lands on a visible slider and is
one undo step. It covers every control, not only alignment: most complaints have a stronger lever
than toe.

### Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Tier | **INT and PRO**, each limited to the levers its tier shows | It helps most where the controls are new to the tuner. A proposal never touches a control the tier hides |
| Where | A **toolbar** button opening a panel, like CHECK and DNA | Reachable from any section. The balance bar's correction tip links into it rather than running a second advice system |
| Changes | **One change per proposal**, plus one or two alternatives, never a bundle | Change one thing, drive, report back: otherwise nobody knows which change helped |
| Wording | **Problem terms**: what the car does wrong, not the feel wanted | Easier to name from the driver's seat. Proposals may still say the goal ("more rotation on entry") |
| Scope order | v1 balance symptoms by phase; v2 response, steering, bumps, traction and alignment; v3 a session log | v1 is where the model can predict the effect, so the preview means something |

### Flow

1. **Where in the corner:** ENTRY (braking, turn-in), MID-CORNER, EXIT (on throttle), plus STRAIGHTS
   and BUMPS for the non-balance symptoms (v2).
2. **What:** only the symptoms that make sense for that phase, e.g. ENTRY: *pushes wide*, *snaps
   loose on lift-off*, *lazy turn-in*, *unstable under braking*; EXIT: *pushes on power*, *tail steps
   out on power*, *wheelspin*.
3. **How much:** *a little* / *a lot*, which sets the step size of the proposal.
4. **The proposal:** the best lever as a before → after on that control, the reason in a sentence, the
   predicted effect (below), and APPLY. Under it, one or two alternatives with the same detail.
5. **After APPLY:** "Drive it, then tell me what it does now", back to step 1 with the phase kept.

### Ranked by what the app can predict

Each proposal carries one of three labels, and the modelled levers rank first:

| Label | Means | Levers (v1) |
|---|---|---|
| **MODELLED** | the effect is computed before applying: the balance bar's NET (INT) or the phase margin (PRO) moves by the figure shown | springs and bars (ARB Bias, the rear Hz ratio, or the Mech Balance Target, depending on mode); brake bias (ENTRY, sized in PRO); AWD power split (EXIT, sized in PRO) |
| **DIRECTION** | the model knows which way, not how far, as with the balance bar's arrows | diff ENTRY / EXIT (decel and accel lock), Damping Bias |
| **BY FEEL** | not in the model; general setup practice | alignment intent (toe, camber, caster) until the balance-model question in [Alignment revamp](#alignment-revamp-forza) is settled |

The preview runs the pure solve (`solveTune`, then `phaseMargins` in PRO) on the patched `fe` / `dr`
for each candidate, the way the app already does for the live tune, so the figure is the app's own
model of the change. It is still a model figure, not a lap time, and the panel says so once.

### v1 lever table (balance symptoms)

Understeer = the front gives up first; oversteer = the rear does. Listed best-first. A lever is
skipped when it is at its limit (with a line saying so, as AUTO Balance Mode's cascade would) or
when the current mode ignores it.

| Phase · symptom | Levers, best first |
|---|---|
| ENTRY · pushes wide | brake bias rearward (BRAKES shift; PRO ENTRY target) · diff ENTRY toward LOOSE · softer front / stiffer rear roll (bars first) |
| ENTRY · snaps loose on lift-off | diff ENTRY toward STABLE · brake bias forward · stiffer front / softer rear roll |
| MID · pushes wide | softer front / stiffer rear roll (ARB Bias toward REAR, or the target in a target-solving mode) · rear Hz up |
| MID · loose | the reverse of MID · pushes wide |
| EXIT · pushes on power | diff EXIT toward ROTATE · AWD power split rearward · stiffer rear / softer front roll |
| EXIT · tail steps out on power | diff EXIT toward GRIP · AWD power split forward · softer rear roll *(less rear roll stiffness keeps the inside rear loaded)* |

**The mode decides the lever.** Under ARB Balance Mode MECH or CO-SOLVE, or Hz MODE MECH, the
solver holds the Mech Balance Target, and ARB Bias does nothing. There the roll-balance proposal
moves the target (Balance Offset or the MANUAL target, per Balance Target Mode). Under ARB
Stiffness Mode MAN, it moves the bar clicks directly. Each proposal names the control it actually
moves.

### v2 (sketch)

Turn-in response, straight-line stability, steering weight, bumps (rebound and bump damping, ride Hz,
bottoming against SAG vs LOAD), traction (accel lock, power split), and the alignment rows:

| Symptom | Proposal (BY FEEL) |
|---|---|
| Lazy turn-in | Turn-in toward SHARP (front toe-out); less caster |
| Wanders on straights | Turn-in toward STABLE (front toe-in); more caster |
| Nervous rear on lift-off / braking | Rear stability toward PLANTED (rear toe-in) |
| Pushes mid-corner, tyre flat-out of grip | Camber F toward MORE (dynamic camber toward the target, seen in VISUALS) |
| Steering too heavy | Steering feel toward LIGHT (less caster) |

### v3 (sketch)

A session log of what was applied and the symptom it answered, so the panel doesn't re-propose a
change that was just tried and undone, and so a tuner can read back the path they took. Session
only; not saved.

### How it fits what exists

- **Correction tip** (balance bar): stays as the one-line summary and links into the panel with
  the phase pre-picked.
- **Vehicle DNA:** DNA is "describe the car you want, solve it once", and the fixer is "this one
  thing is wrong, nudge it". They should share vocabulary (ROTATE, PLANTED, STABLE…). Applying a
  proposal to a DNA-linked tune drifts it from the DNA like any edit; DNA MATCH already shows that.
- **AUTO Balance Mode** (below): the same lever priority and limit handling, applied once by
  hand instead of continuously by the solver. If both are built, they should share the table.

### Open questions

- Step sizes for *a little* / *a lot*, per lever.
- Whether BEG gets a cut-down version (three symptoms, the Balance slider as the only lever).
- How a proposal reads when every modelled lever is at its limit.
- Whether the alternatives may come from a different phase's levers.

---

## AUTO Balance Mode (PRO)

A PRO ARB Balance Mode, next to WEIGHT / NEUTRAL / CHASSIS / MECH / CO-SOLVE, in
which the user sets only a handling intent. The solver picks the balance target
and decides which levers carry the correction.

### How it differs from what exists

| | Beginner Balance slider | MECH / CO-SOLVE | AUTO |
|---|---|---|---|
| User sets | Direction (lever changes) | Target + (CO-SOLVE) Spring Share | Intent only |
| Centre means | WEIGHT's neutral split | `natDisplayOf(ch)` + delta | Grip-neutral car |
| Levers | ARB split + Hz ratio, fixed proportion | ARB (+ Hz for CO-SOLVE), fixed share | ARB → Hz → alignment → diff, in priority order |
| At a limit | Silent | Amber clamp warning | Moves to the next lever and shows which one ran out |

### 1. Target

- **Intent slider:** STABLE ↔ NEUTRAL ↔ ROTATE, stored as a delta (like
  `fe.arbBalDelta`).
- **Base:** the grip-neutralising point GRIP target mode already derives from
  `natGripBalance`, plus the intent delta.
- **Layout bias:** small, since the drivetrain already shifts "neutral" in the
  model (slight OS lean for FWD, slight US lean for high-power RWD).
- **Clamped** to `clampBalTarget`'s band, and further pulled in when the gap from
  natural balance is large, so it avoids the "couldn't reach target" case instead
  of reporting it after the fact.

### 2. Lever priority

Each lever works only on the gap the ones before it left:

1. **ARB split** — cheapest in ride terms. Stops at the game mode's click limit
   (reusing the hold-roll-balance-at-click-limit behaviour).
2. **Rear/front Hz ratio** — capped at about ±4%, the same span the beginner
   Balance slider uses, so ride quality isn't spent on balance.
3. **Alignment** — the ALIGNMENT intent offsets (camber and toe), set automatically from the
   remaining gap. The MECH/GRIP nudge this step first named is retired; alignment also has no
   balance-model effect yet (see "Alignment revamp" above), which this step would need first.
4. **Diff entry/exit** — last and light; it shapes corner phases, not
   steady-state balance.

Fits inside `solveTune`'s existing balance-target correction loop.
**Damping is excluded** on purpose: Damping Balance Mode is transient feel and is
kept separate from steady-state balance throughout the docs.

### 3. UI

- Sections AUTO owns (ARB, Hz ratio, alignment, diff) collapse to one read-only
  line each, e.g. "ARB 62/38 — set by AUTO (click limit)". Not hidden: seeing
  what it chose is the point, and solved modes already print their values.
- Controls AUTO doesn't touch stay editable: overall stiffness level, ride
  height, damping, tyres.
- BALANCE readout: resolved target plus a stacked contribution bar
  (ARB / Hz / align / diff), amber on any lever at its limit, and a one-line
  explanation of how the target was derived.
- Leaving AUTO keeps the solved values as the new manual starting point.

### Decisions already made

- **PRO only, never BASIC.** AUTO's centre comes from `natGripBalance` and
  the natural balance (`natRsOf`/`natDisplayOf`), which depend on tyre sizes, CG height, weight split
  and ride heights. BASIC doesn't collect most of those, so AUTO there would be a
  guess presented as precision. BASIC's slider is right for its tier because it
  claims only a direction. It should stay as it is.
- **A mode, not a new tier.** Tiers decide how many controls are shown; AUTO
  decides who owns them, which is what Balance Modes already express. A PRO+ tier
  would touch every `uiMode` gate, the tutorials and the tier docs for no gain.
- **Default-data guard:** when key chassis inputs are still at defaults, the
  readout says the target rests on default chassis data (amber).

### Open questions for when it's picked up

- **Codec:** store the mode and the intent, never the solved split, so share
  codes survive solver changes. It needs a new `arbBalMode` enum value, appended
  (see [CODEC.md](CODEC.md) on enum appends).
- **Stability:** a four-lever cascade can jump between levers near limits. Use a
  fixed order plus hysteresis.
- **Cheap first cut:** step 1 plus CO-SOLVE with Spring Share set automatically
  gets most of the benefit with no new solver.

---

## Finer slider steps

Halving (or better) the `step` on the feel sliders that currently move in whole
units. Worked out far enough to know which ones are safe, which are pointless and
which are blocked; not implemented.

### The starting point

Most `FeelSlider` call sites use `step=1` across `−50..+50` or `0..100` — ARB
Bias, Damping Bias, Character, Balance, EXIT/ENTRY, POWER SPLIT, ARB Share %, ARB
Stiffness BASIC. The Hz sliders and Settle Target use `0.01`; Target Speed uses
`5`.

Fractional values on those sliders are **already legal state**. Every slider
carries a number box, and a typed value is clamped but not snapped to the step
(see [SLIDERS.md](SLIDERS.md)). So a finer step does not open a new state space —
it only lets the mouse reach states the box already reaches, and nothing
downstream can be newly surprised by a fractional field.

### What a finer step costs

- **Nothing in the codec.** `encodeTune` writes the raw number with no rounding,
  so `8:12.5` is a valid field today. Share codes get a few characters longer; no
  version bump, no new ids, old codes unaffected. See [CODEC.md](CODEC.md).
- **Nothing in `sanitizeTune`** for the clamp-only fields: `arbBias`,
  `dampingBias`, `reboundZeta`, `bumpRatio`, `bumpZeta`, `arbShareMan`,
  `arbBasicMan`, `settleTarget`, `rearHzMult`, the `diffBias*` pair.
- **Dead steps, where the game grid is coarser than the slider.** This is the
  real failure mode, and it is a UI one: the slider moves, the output does not,
  and a control that visibly refuses to do anything reads as broken. Forza snaps
  dampers and ARB to 0.1 clicks and springs to whole lb/in; BeamNG snaps to
  500 N/m springs and 100 N/m/s dampers (`PHYS_SNAP`, `clampDamp`, `snapPhys`).
  A step is only worth adding where one current step moves the output by more
  than roughly 1.5 game clicks.
- **Keyboard and wheel traversal.** `FeelSlider`'s arrow/wheel handlers step by
  `step`. Going from 1 to 0.1 across ±50 means 1000 keypresses end to end. If a
  slider goes much finer, the arrows should keep the coarse unit and the fine one
  should come from a modifier or the number box.

### The Hz grid part of this has shipped

The `sanitizeTune`/`hzToRs` 0.01 Hz rounding is now 0.001 Hz — see
[HISTORY.md](HISTORY.md) and [PHYSICS.md](PHYSICS.md#the-0001-hz-grid). It was
lifted for BOTTOM G's, whose 0.01 g steps were mostly landing back on the value
they started from, not to make the Hz sliders finer. **The Hz sliders still step
by 0.01 and this idea does not propose changing that** — the grid underneath them
simply no longer sets a floor if it ever should change.

### Proposed steps

| Slider | Now | Proposed | Reasoning |
|---|---|---|---|
| ARB Bias | 1 | 0.5 | Continuous split; one point is well above a click |
| Damping Bias | 1 | 0.5 | Same, under all three Damping Balance Modes |
| Rebound ζ / Bump ζ / Bump Ratio | 1 | 0.5 | Damper solve is continuous ahead of the 0.1-click snap |
| ARB Share % | 1 | 0.5 | Already has a half-step tolerance concept downstream (`halfArbStep`) |
| Target Speed | 5 | 1 | 5 mph is coarse against a flat-ride ratio that already trips an advisory |
| ARB Stiffness BASIC % | 1 | leave | 1% is already worth ~0.6 of a click — finer is mostly dead steps |
| Character, Balance | 1 | leave | Deliberately coarse feel abstractions for BEG |
| Ride Stiffness, Independent Hz | 0.01 | leave | 0.01 Hz is already a fine step to traverse; the 0.001 grid underneath is for BOTTOM G's, not for these |

### Open questions for when it's picked up

- **DNA axis steps are not in scope.** `DNA_AXES`'s own `step` values are chosen
  so every archetype seed is hit exactly; changing them risks a seed falling off
  the grid. `tests-dna.js` asserts the sanitize fixed-point property, so a
  mistake there is at least caught.
- **Arrow-key unit** needs deciding before shipping, per the traversal point
  above.
- **Presets and share codes stay integer-valued** regardless — no factory preset
  needs a half step, and codes written before the change are unaffected either
  way.
