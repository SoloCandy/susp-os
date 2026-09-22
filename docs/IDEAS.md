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
