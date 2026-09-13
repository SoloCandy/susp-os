# SUSP.OS — Factory Presets Reference

The six factory presets in `PRESET_SAVES`, loaded via the FACTORY cards pinned
at the top of the GARAGE drawer (all tiers). Each preset sets `fe` and `dr`
fields on top of the defaults (`{...DEF_FE, ...}` / `{...DEF_DR, ...}`) —
any field not listed below stays at its `DEF_FE`/`DEF_DR` default.

Loading a preset does **not** touch `ch` (chassis) or `layout` — both are
treated as sticky, car-specific state that a preset shouldn't override (see
`loadPreset`, and the `layout` migration in
[CODEC.md](CODEC.md) for why layout in particular is excluded).

That rule is now **structurally enforced**: presets are deliberately not garage
entries, and each factory card exposes a single LOAD and no chassis button, so
there is no affordance that could violate it. The user's own `car` entries are a
separate concept with their own explicit LOAD CHASSIS / LOAD BUILD buttons — those
*do* touch `ch`, which is the point of saving a car. See
[PERSISTENCE.md](PERSISTENCE.md) for the entry model.

Keeping presets out of the entry list also keeps them out of entry counts, search,
sort and — most importantly — backup files, where six identical read-only entries
would ride along in every export and multiply on every restore.

**Beginner mode** additionally forces `arbBalMode:'neutral'` and
`arbMode:'auto'` on preset load (Beginner doesn't expose these mode
toggles, and its Balance slider's own mechanism assumes NEUTRAL ARB mode —
see the Balance row in [SLIDERS.md](SLIDERS.md)), plus `dampCharMode:'zeta'`,
`dampBalMode:'standard'`, and zeroed `dampingBias` since Beginner's
Character slider only understands the simple rebound-ζ/bump-ratio model.
That `dampCharMode` override is why every preset authors damping as
`reboundZeta` and never as a Settle Target: a SETTLE preset carries no ζ of
its own, so Beginner falls back to `DEF_FE`'s 70%. Four presets did exactly
that until they were converted — see [HISTORY.md](HISTORY.md).
It also forces `rearHzMode:'multiplier'` — omitted from this list until an
audit caught it. That one matters for the Rear Hz Mult column below: a preset
authored under a different Hz mode still lands on MULTIPLIER in Beginner, so
the ratio shown is the one actually applied there.

| # | Name | Build Type | Diff Type | Ride Stiffness | Rear Hz Mult | Damping Char | Notes |
|---|---|---|---|---|---|---|---|
| 1 | STREET | street | race | 2.20 Hz | 1.15× | CHARACTER ζ=30.3, bias 0 | Bump ratio 52, ARB AUTO. diffBiasExit −10 (GRIP-leaning), diffBiasEntry +10 (STABLE-leaning) |
| 2 | TRACK | track | race | 2.50 Hz | 1.05× | CHARACTER ζ=36.6, bias −5 (FRONT) | Bump ratio 58, ARB ROLL @ 1.5°. diffBiasExit +5, diffBiasEntry 0 |
| 3 | RALLY | rally | rally | 1.55 Hz | 1.05× | CHARACTER ζ=58, bias +5 (REAR) | Bump ratio 38, ARB SHARE @ 8%. diffBiasExit −5, diffBiasEntry −15 |
| 4 | DRIFT | drift | drift | 1.80 Hz | 1.30× | CHARACTER ζ=60, bias −18 (FRONT) | Bump ratio 40. diffBiasExit +22, diffBiasEntry −18, diffRearAccel 65, diffRearDecel 15 |
| 5 | MOTORSPT | track | race | 3.20 Hz | 0.92× | CHARACTER ζ=45.8, bias −10 (FRONT) | Bump ratio 64, ARB ROLL @ 0.8°. diffBiasExit +10, diffBiasEntry −5 |
| 6 | X COUNTRY | offroad | offroad | 0.90 Hz | 1.00× | CHARACTER ζ=40.7, bias −5 (FRONT) | Bump ratio 38, ARB SHARE @ 5% |

> **STREET's diff type is `race`, not `sport`.** It was changed from `sport`
> in `3960b38`, a commit whose message is entirely about surfacing the diff
> type in the output card and marking N/A fields for Sport — the preset edit
> is not mentioned. It is very likely deliberate rather than a slip: Sport is
> accel-only in-game, so its decel fields render N/A, and STREET sets
> `diffBiasEntry:+10`, a decel-lock intent that a Sport diff cannot express.
> `DEF_DR`'s own default is still `sport`. This doc said `sport` until an
> audit caught the drift.

## Reading the columns

- **Ride Stiffness** — `fe.rideStiffness`, the front spring frequency (Hz)
  before layout/build-specific derivation.
- **Rear Hz Mult** — `fe.rearHzMult` under `rearHzMode:'multiplier'`; ratio
  of rear to front spring frequency.
- **Damping Char** — `CHARACTER` mode for all six (`dampCharMode:'zeta'`,
  explicit `reboundZeta`, `dampBalMode` + `dampingBias` — all six use the
  default `dampBalMode:'standard'`). STREET, TRACK, MOTORSPT and X COUNTRY
  were authored as Settle Targets (0.55s, 0.40s, 0.25s, 1.00s); their ζ is
  what those targets back-solved to at each preset's own Hz, to one decimal.
  On the default chassis that keeps their INT/PRO output identical in all
  three game modes; on other chassis the rounding can move one damper by a
  single 0.1-click step. Three of them sit below ζ 45%, the floor of
  Beginner's Character slider, which therefore loads pinned at AGILE — see
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
  The "bias" figure above is the **Damping Bias slider's own reading**,
  which is `-dampingBias` in *every* mode — the slider is a single
  unconditional negation (`value={-(fe.dampingBias??0)}`, `leftLabel="FRONT"`
  / `rightLabel="REAR"`), with no branch on `dampCharMode` or `dampBalMode`.
  So a stored `dampingBias:18` reads as **−18, FRONT** on the slider, and
  stiffens the front (`zetaF = baseZeta*(1+dampingBias/100)`). The
  parenthesised side is spelled out per row because the sign alone is easy
  to read the wrong way round.

  The negation is a display convention only: `9eca491` swapped the slider's
  end labels from REAR/FRONT to FRONT/REAR and negated the value in the same
  edit, so the physical side a given stored value lands on never changed.
  Presets 3 and 4 still carry the raw `dampingBias` values authored in
  `56d2dec`, just before that flip. The other four stored `settleBias` at the
  time and were re-expressed as negated `dampingBias` when `30ba96e` merged
  the two fields (`settleBias:-5` → `dampingBias:5`), which is why the two
  groups' stored numbers look inverted relative to each other — both are
  correct, and all six land where the slider says. See
  [SLIDERS.md](SLIDERS.md).
- **diffBiasExit / diffBiasEntry** — see [SLIDERS.md](SLIDERS.md)'s EXIT/
  ENTRY rows for what these values mean directionally (positive =
  oversteer-leaning per the convention documented there).

## Build-type → recommended presets

The "★ FOR YOUR BUILD" recommendation (`BUILD_PRESET_MAP`) maps build type to
preset numbers. It shows at **all tiers** — it was Beginner-only when the presets
lived in two duplicated drawers, which read as an accident of which copy got the
feature rather than a deliberate gate:

| Build Type | Recommended preset(s) |
|---|---|
| street | 1 (STREET) |
| track | 2 (TRACK), 5 (MOTORSPT) |
| drift | 4 (DRIFT) |
| rally | 3 (RALLY) |
| offroad | 6 (X COUNTRY) |
| drag | 2 (TRACK) |

## Adding a new preset

- Add a new numbered entry to `PRESET_SAVES`, spreading `DEF_FE`/`DEF_DR`
  and overriding only what's distinctive about the preset.
- Author damping as `dampCharMode:'zeta'` with an explicit `reboundZeta`,
  never as a `settleTarget`. Beginner's `loadPreset` forces CHARACTER mode, so
  a Settle Target would be silently replaced by `DEF_FE`'s 70% there.
- Update `PRESET_DESC` (module scope, one copy — it used to be duplicated in the
  Beginner panel and the BUILD section, with diverging text; unifying the garage
  collapsed them) with a `tag`/`sub` description pair.
- Consider adding it to `BUILD_PRESET_MAP` if it should be the recommended
  starting point for a build type.
- Update this file.
