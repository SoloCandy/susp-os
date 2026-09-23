# Ideas — parked designs

Designs worked out far enough to be worth keeping, but **not implemented and not
scheduled**. Nothing here describes current behaviour; check the code before
assuming any of it exists. When an idea ships, move its substance into the
relevant reference doc and record it in [HISTORY.md](HISTORY.md). When one is
rejected, move it to [KNOWN_ISSUES.md](KNOWN_ISSUES.md) with the reasoning.

---

## AUTO Balance Mode (PRO)

A PRO ARB Balance Mode, next to WEIGHT / NEUTRAL / CHASSIS / MECH / CO-SOLVE, in
which the user sets only a handling intent. The solver picks the balance target
and decides which levers carry the correction.

### How it differs from what exists

| | Beginner Balance slider | MECH / CO-SOLVE | AUTO |
|---|---|---|---|
| User sets | Direction (lever changes) | Target + (CO-SOLVE) Spring Share | Intent only |
| Centre means | WEIGHT's neutral split | `naturalMechBalanceOf(ch)` + delta | Grip-neutral car |
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
3. **Alignment** — the existing MECH/GRIP nudge, with Nudge Strength set
   automatically from the remaining gap.
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
  `naturalMechBalanceOf(ch)`, which depend on tyre sizes, CG height, weight split
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
