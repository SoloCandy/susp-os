# SUSP.OS — Share Codec Field Reference

The SHARE / LOAD CODE feature encodes tune state as a compact, sparse
`id:value` list, Base64-wrapped. Every field gets a permanent numeric `id`
in `CODEC_FIELDS`. This table exists so a new field
never accidentally reuses an old id and breaks existing share codes.

> **Rule: ids are permanent.** Once assigned, an id must never be reused for
> a different field, even if the original field is removed. If a field is
> deleted, move its id to the "Retired — never reuse" list below (and in
> the code comment) instead of deleting the row outright.

Fields not present in a code default to `DEF_GROUPS[group][key]` (or `def`
for tyre sub-fields) — this is what makes old codes forward-compatible with
new fields added later, and new codes backward-compatible with fields a
future version might not carry.

## Field table

| ID | Group | Key | Encoding |
|---|---|---|---|
| 1 | ch | weight | raw number |
| 2 | ch | frontBias | raw number |
| 3 | ch | wheelbase | raw number |
| 4 | ch | cgHeight | raw number |
| 5 | ch | trackF | raw number |
| 6 | ch | trackR | raw number |
| 7 | fe | rideStiffness | raw number |
| 8 | fe | arbBias | raw number |
| 9 | fe | targetSpeed | raw number |
| 10 | fe | gameMode | enum (`GAME_MODE_ENC/DEC`) — `beamng:2` appended; see note below |
| 11 | fe | dampingMode | enum (`DAMPING_MODE_ENC/DEC`) |
| 12 | fe | reboundZeta | raw number |
| 13 | fe | bumpRatio | raw number |
| 14 | fe | bumpZeta | raw number |
| 15 | fe | arbMode | enum (`ARB_MODE_ENC/DEC`) |
| 16 | fe | arbTargetRollMan | raw number |
| 17 | fe | arbShareMan | raw number |
| 18 | ch | layout | enum (`LAYOUT_ENC/DEC`) — moved from `dr` group; see note below |
| 19 | dr | buildType | enum (`BUILD_ENC/DEC`) |
| 20 | dr | diffManual | bool |
| 21 | dr | diffBiasExit | raw number |
| 22 | dr | diffAccel | raw number |
| 23 | dr | diffDecel | raw number |
| 24 | dr | diffFrontAccel | raw number |
| 25 | dr | diffFrontDecel | raw number |
| 26 | dr | diffRearAccel | raw number |
| 27 | dr | diffRearDecel | raw number |
| 28 | dr | diffCenter | raw number |
| 29 | dr | diffBiasEntry | raw number |
| 30 | fe | rearHzMode | enum (`REAR_HZ_MODE_ENC/DEC`) |
| 31 | fe | rearHzMan | raw number |
| 32 | fe | rearHzMult | raw number |
| 33 | fe | dampingBias | raw number |
| 34 | tyre F | width | tyre sub-field, default 265 |
| 35 | tyre R | width | tyre sub-field, default 265 |
| 36 | tyre F | aspectRatio | tyre sub-field, default 35 |
| 37 | tyre F | rimDiameter | tyre sub-field, default 18 |
| 38 | tyre R | aspectRatio | tyre sub-field, default 35 |
| 39 | tyre R | rimDiameter | tyre sub-field, default 18 |
| 40 | fe | arbBalTarget | raw number — semantics changed to "delta from natural mech balance" (see note) |
| 41 | fe | arbBalMode | enum (`ARB_BAL_MODE_ENC/DEC`) |
| 42 | dr | diffFrontExitBias | raw number |
| 43 | fe | springShare | raw number |
| 44 | fe | rideRef | enum (`RIDE_REF_ENC/DEC`) |
| 45 | dr | diffComplement | bool |
| 46 | fe | arbManF | raw number |
| 47 | fe | arbManR | raw number |
| 48 | fe | settleBias | raw number — **decode-only**, see semantic-change note below |
| 49 | fe | settleMode | bool — **decode-only**, see semantic-change note below |
| 50 | fe | settleTarget | raw number |
| 51 | fe | dampCharMode | enum (`{zeta:0,settle:1}`) |
| 52 | dr | diffType | enum (`DIFF_TYPE_ENC/DEC`) |
| 53 | fe | arbBalTargetMode | enum (`{manual:0,grip:1}`) |
| 54 | fe | arbBalDelta | raw number |
| 55 | fe | springShareAuto | bool |
| 56 | fe | arbSplitOpposite | bool |
| 57 | fe | arbBasicMan | raw number |
| 58 | ch | motionRatioF | raw number |
| 59 | ch | motionRatioR | raw number |
| 60 | ch | useMeasuredNatBal | bool |
| 61 | ch | measuredNatBal | raw number |
| 62 | fe | dampBalMode | enum (`DAMP_BAL_MODE_ENC/DEC`) |
| 63 | fe | rideStiffMode | enum (`'hz'`:0, `'bottomG'`:1) |
| 64 | fe | rideBottomG | raw number |
| 65 | ch | rideHeightF | raw number |
| 66 | ch | rideHeightR | raw number |
| 67 | fe | arbNeutralEqual | bool |
| 68 | ch | arbMotionRatioF | raw number |
| 69 | ch | arbMotionRatioR | raw number |

**Next available id: 70.**

Ids 63/64 are the Ride Stiffness slider's BOTTOM G's mode (a target
vertical-g bottom-out load factor, alternative to entering Hz directly — see
[PHYSICS.md](PHYSICS.md#bottom-gs-stiffness-mode)). `rideBottomG` is
intentionally a *stored target*: it's meant to actively re-solve
`rideStiffness` (id 7) against whatever chassis it's applied to, not just
describe how the sender arrived at their number.

Ids 68/69 (`arbMotionRatioF`/`arbMotionRatioR`) are the anti-roll bar's drop-link
arm as a fraction of track. They are deliberately separate from the spring/damper
motion ratio (ids 58/59): the spring mount and the drop link are independent
geometry, so one value cannot stand for both. Like ids 58/59 they are display-only
— they scale the N/m the ARB rows print and the MAN-mode entry that inverts it, and
never reach the solve — so a code carrying them describes the same tune to a
recipient whose own ratio differs, just printed against their geometry.

Ids 65/66 (`rideHeightF`/`rideHeightR`) are `group:'ch'` — see the
semantic-changes note below for why they moved from excluded to codec fields.

Ids 58/59 are `group:'ch'` because a motion ratio describes the car's suspension
geometry, so it travels with a chassis entry rather than a tune — same reasoning
as id 18 (`layout`). They are display-only (physical-unit game modes divide the
shown rate by `mr²`) and inert in the Forza modes, but they still belong in the
codec so a shared BeamNG tune reproduces the numbers the sender saw.

Ids 60/61 (`useMeasuredNatBal`/`measuredNatBal`) are `group:'ch'` for the same
reason. They used to be excluded from the codec entirely (see the removed note
below) until it became clear that exclusion was actively wrong: `arbBalTarget`
(id 40) and `arbBalDelta` (id 54) both store *deltas* from
`naturalMechBalanceOf(ch)`, so if the measured-override baseline itself doesn't
travel, a receiver decoding with `useMeasuredNatBal` defaulted to `false`
silently re-expands the sender's delta against a different (geometry-only)
baseline — producing a different absolute Mech Balance Target than the sender
actually tuned toward. See the semantic-change note below.

## Retired — never reuse

None yet. (No field has been deleted since the codec's v1 sparse-table
redesign; ids that predate it were never individually numbered.)

## Extending an enum (id 10 / `gameMode`, and the general rule)

Appending a value to an existing enum needs **no version bump**, because three
independent mechanisms already make it safe:

1. `encodeTune` omits any field still at its default, so a `horizon` code carries
   no `10:` pair at all. Only non-default modes emit one.
2. `decodeTune` ignores ids it doesn't recognise and pre-fills defaults first.
3. `sanitizeTune` gates the result through `GAME_MODE_DEC.includes(...)`, so an
   out-of-range index falls back to `horizon`.

`gameMode` gained `beamng:2` for the physical-unit output mode. An older client
handed a `10:2` code decodes it to `horizon` rather than throwing — verified, not
assumed. The same reasoning applies to any future enum append.

**Enum indices are as permanent as ids.** Renumbering `GAME_MODE_DEC` would
silently reinterpret every code already in circulation. Append only.

The full index registry, which is what "append only" is a promise about. Every
value below is load-bearing at the position shown: a share code stores the index,
never the string, so moving one reinterprets codes already in the wild.
`tests-docs.js` checks that each of these values is written somewhere in `docs/`
as a quoted or backticked literal, so a newly appended value cannot slip in
undocumented.

| Array | Index → value |
|---|---|
| `DIFF_TYPE_DEC` | 0 `race` · 1 `sport` · 2 `rally` · 3 `offroad` · 4 `drift` |
| `ALIGN_MODE_DEC` | 0 `build` · 1 `mech` · 2 `grip` · 3 `manual` |
| `GAME_MODE_DEC` | 0 `horizon` · 1 `motorsport` · 2 `beamng` |
| `DAMPING_MODE_DEC` | 0 `ratio` · 1 `independent` |
| `REAR_HZ_MODE_DEC` | 0 `flatRide` · 1 `independent` · 2 `multiplier` · 3 `mech` · 4 `shared` |
| `ARB_MODE_DEC` | 0 `auto` · 1 `roll` · 2 `share` · 3 `auto` · 4 `man` · 5 `basic` |
| `ARB_BAL_MODE_DEC` | 0 `weight` · 1 `mech` · 2 `coSolve` · 3 `man` · 4 `neutral` · 5 `chassis` · 6 `manual` |
| `RIDE_REF_DEC` | 0 `front` · 1 `rear` · 2 `shared` |
| `DAMP_BAL_MODE_DEC` | 0 `standard` · 1 `sync` · 2 `neutral` |
| `LAYOUT_DEC` | 0 `FWD` · 1 `RWD` · 2 `AWD` |
| `BUILD_DEC` | 0 `street` · 1 `track` · 2 `drift` · 3 `rally` · 4 `offroad` · 5 `drag` |

`ARB_MODE_DEC` carries `auto` twice on purpose — index 3 is a retired `balance`
value decoding to `auto` rather than throwing. `ALIGN_MODE_DEC` has no encoder
and no id at all: `al` is not a codec group (see the excluded-fields section
below), so only its membership test matters, not its order.

## Notes on semantic changes (id kept, meaning changed)

Changing what a raw number *means* without changing its `id`/`group`/`key`
is technically safe for the codec (it just moves bytes), but it silently
reinterprets old codes under new rules. Two examples so far:

- **id 18 (`layout`)** — moved from `group:'dr'` to `group:'ch'` so it would save
  and load with the chassis rather than the tune. (At the time those were two
  separate systems, Garage and My Builds; they have since merged into one garage
  where an entry can carry either or both — but the grouping still decides which
  payload `layout` travels in, so the move stands. See
  [PERSISTENCE.md](PERSISTENCE.md).) Old codes still decode correctly (the wire
  value is unchanged, only which in-memory object it's written into changed).
- **id 40 (`arbBalTarget`)** — changed from an absolute mech-balance value
  (0.20-0.90) to a delta from `naturalMechBalanceOf(ch)`. Old codes/saved
  builds with an explicit (non-default) target will be reinterpreted under
  the new delta semantics and will likely need re-tuning.
- **id 41 (`arbBalMode`) `'man'`** — MAN moved from Balance Mode to Stiffness
  Mode (id 15, `arbMode`), since it bypasses the budget/split system
  entirely rather than choosing a split within it. `'man'` stays in
  `ARB_BAL_MODE_DEC` at its original index purely so old codes still decode
  the string correctly, but `sanitizeTune` immediately rewrites it: any
  decoded `arbBalMode:'man'` becomes `arbBalMode:'manual'` + `arbMode:'man'`.
  A matching one-time migration effect in `App()` does the same for plain
  persisted state (pre-move saves loaded without going through a share
  code). `arbManF`/`arbManR` (ids 46/47) are untouched by the move.

  This said `'weight'` until an audit caught it — the destination is the
  `'manual'` placeholder (index 6, below), not WEIGHT, and the difference is
  user-visible: landing on WEIGHT would light up a Balance Mode button the
  user never chose, which is the exact thing the placeholder exists to avoid.
  [CODE_MAP.md](CODE_MAP.md)'s retained-legacy section had it right.
- **id 41 (`arbBalMode`) `'manual'`** — index 6, the deliberately invisible
  placeholder. Behaves exactly like `'weight'` everywhere in `feelToPhysics`
  and `computeTune`, but is not one of the Balance Mode buttons, so nothing
  lights up while Stiffness Mode is MAN and switching Stiffness Mode away from
  MAN doesn't look like a WEIGHT selection the user never made. Live producers:
  `sanitizeTune`'s `'man'` migration above, the `App()` migration effect, and
  TUNE CHECK's import. Being set by no visible control is the design, not an
  oversight — see [CODE_MAP.md](CODE_MAP.md). Its index is as permanent as any
  other; it was appended after `'chassis'` (index 5) for exactly that reason.
- **id 41 (`arbBalMode`) `'chassis'`** — new PRO-only mode (index 5), added
  alongside the MAN migration. Same split formula as WEIGHT, but anchored to
  `naturalMechBalanceOf(ch)` (track-width geometry, or the MEASURE NAT BAL
  reading when set) instead of raw `ch.frontBias` — see
  [HISTORY.md](HISTORY.md) for why WEIGHT itself was deliberately
  left on the simpler raw-weight formula rather than switched over.
- **ids 48/49 (`settleBias`/`settleMode`) → id 62 (`dampBalMode`)** — the
  boolean "Settle Sync" toggle (id 49) plus its own bias field (id 48) were
  replaced by a 3-way Damping Balance Mode (STANDARD/SYNC/NEUTRAL, id 62)
  that shares the existing `dampingBias` field (id 33) instead of a second
  one. Both old ids stay in `CODEC_FIELDS` purely so old codes still decode
  the raw values — `sanitizeTune` immediately migrates them: a decoded
  `settleMode:true` becomes `dampBalMode:'sync'`, and its `settleBias` value
  (sign-flipped to the unified field's storage convention — the slider
  displays `-dampingBias`) overwrites whatever `dampingBias` (id 33) the code
  also carried, since the Settle Bias value was the one actually driving the
  car at save time. A matching one-time migration effect in `App()` does the
  same for plain persisted state. New codes never emit ids 48/49 — `dampBalMode`/
  `dampingBias` are the only fields written going forward. See
  [SLIDERS.md](SLIDERS.md) for the three modes and [FORMULAS.md](FORMULAS.md)
  for how `bDampBias` reads the result.
- **id 15 (`arbMode`) `'basic'`** — new mode (index 5), added alongside new
  id 57 (`arbBasicMan`). Sets an ARB roll-stiffness budget directly as a
  0–100% level (0%≈1 click, 100%≈`lim.arb` clicks, at a neutral front/rear
  split), independent of spring stiffness — unlike SHARE %, whose budget is
  a fraction of the *current* spring roll stiffness. Old codes are
  unaffected: `'basic'` is a brand-new enum index, not a reinterpretation of
  an existing one.
- **ids 60/61 (`useMeasuredNatBal`/`measuredNatBal`) added** — previously
  excluded entirely (see the removed section this replaced, below). id 40's
  delta-from-natural semantics (above) turned out to depend on the baseline
  travelling too: without it, a receiver always resolves
  `naturalMechBalanceOf(ch)` from geometry, which can differ substantially
  from what the sender measured in-game, silently reinterpreting the
  delta against the wrong absolute value. Unlike `useRideHeightCG` (below,
  still excluded), whose output `ch.cgHeight` is a self-contained absolute
  value that already travels via id 4, `useMeasuredNatBal`'s output only ever
  fed a *delta*-based target, so nothing carried its effect. Old codes
  without ids 60/61 decode `useMeasuredNatBal:false` (the default) exactly as
  before — no behavior change for codes that never had a measured reading.
- **ids 65/66 (`rideHeightF`/`rideHeightR`) added** — previously excluded (see
  the removed "Fields deliberately excluded" text below) on the reasoning
  that they were pure calibration inputs to `cgHeight` (id 4), which already
  travels as a self-contained absolute value. That reasoning held for the CG
  consumer, but missed a second one added later: ids 63/64 (BOTTOM G's mode)
  re-solve `rideStiffness` (id 7) from `rideBottomG` against
  `ch.rideHeightF/R` *directly* — and that resolve effect runs regardless of
  whether the RIDE HEIGHT → CG toggle is on (see
  [PHYSICS.md](PHYSICS.md#bottom-gs-stiffness-mode)). Without these two ids,
  a BOTTOM G's-mode code decoded on a device with different local ride
  heights re-solved to a different Hz than the sender tuned, even though the
  g-target read identically — the exact "output isn't actually
  self-contained" trap the ids 60/61 note above already flagged. Old codes
  without ids 65/66 decode to `DEF_CH.rideHeightF/R` (130mm/120mm) exactly as
  before — no behavior change for codes that predate this fix, since none of
  them could have carried a different value anyway.

When making a change like this, note it here so future debugging of "why
did my old share code load weird" has a paper trail.

## Fields deliberately excluded from the codec

Not every `ch`/`fe`/`dr` field needs an id. `useRideHeightCG` is local-only:
it's a UI mode toggle whose only effect — auto-deriving `ch.cgHeight` (id 4)
from ride height — already produces a self-contained absolute value that
travels via that id. A share code carries the *resulting* physics value, not
the calibration-toggle UI state used to arrive at it — `usePersist` still
remembers the toggle locally across reloads on the same device, it just
doesn't travel with a shared code. `rideHeightF`/`rideHeightR` themselves
used to be excluded on the same reasoning but are now ids 65/66 — see the
semantic-changes note above for why that turned out to be wrong once a
second consumer (BOTTOM G's mode) needed the raw inputs, not just their
`cgHeight` output.

`useMeasuredNatBal`/`measuredNatBal` used to follow the same excluded pattern
too, on the (incorrect, as it turned out) assumption that they were
"computed-locally, shared-as-output" like ride-height CG. They're now codec
ids 60/61 — see the semantic-changes note above for why. If a future field
looks like it should have an id but doesn't, check here first before
assuming it's an oversight, but note this list has been wrong twice now:
verify the field's output is genuinely self-contained — an absolute value
with exactly one consumer, not a delta or an input feeding some other field
too — before excluding it.

**The whole `al` (alignment) group is excluded — every field of it.** This is the
largest omission in the codec and it was undocumented here until an audit went
looking for it. `encodeTune(ch, fe, dr)` takes three groups and `DEF_GROUPS` maps
exactly three; there is no `group:'al'` anywhere in `CODEC_FIELDS`. So a share code
carries **none** of `al.mode`, `al.nudgeStrength`, or the MANUAL
`camberF`/`camberR`/`toeF`/`toeR`/`caster` values.

The consequence is worth stating plainly, because it is silent: a PRO user who
sets Alignment Mode to MANUAL and types exact angles, then sends a code, ships a
tune whose recipient sees BUILD-mode computed alignment instead. Nothing warns
either party. The same is true of a MECH/GRIP nudge and its Nudge Strength.

For BUILD mode this is harmless and arguably correct — `computeAlignment` is a
pure function of `ch`/`tune`/`layout`/`buildType`, all of which *do* travel, so
the receiver recomputes identical angles from the same inputs. That is the
"computed-locally, shared-as-output" pattern `useRideHeightCG` follows above, and
it is presumably why the group was never given ids. It stops holding the moment
`al.mode` is anything but `'build'`, since MANUAL's values and the nudge strength
are inputs with no other carrier — the same trap ids 60/61 and 65/66 were both
added to close. Treat this as a known gap rather than a settled exclusion; closing
it means ids 67+ and a fourth group in `DEF_GROUPS`/`encodeTune`/`decodeTune`/
`sanitizeTune`. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Garage entries' `notes` and `tags` are excluded for the same reason, one level up:
they describe *your* relationship to a tune ("needs work", "Nordschleife"), not the
tune's physics. A share code carries the setup; your private note about it stays on
your device. The whole garage is likewise outside the codec — a code is one tune,
not a collection. Use BACKUP/RESTORE to move a garage between devices (see
[PERSISTENCE.md](PERSISTENCE.md)).
