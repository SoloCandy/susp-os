# SUSP.OS — Slider Reference

Every slider in the app: its range, which tier exposes it, what it does
physically, and its effect on handling balance (oversteer/understeer).

Balance direction is sourced from the authoritative `bXxx` contributor
formulas in `index.html` (`bSp`, `bAb`, `bDampBias`, `bDiffAccel/Decel/
Front/Rear`, `bBrakeEntry`), not slider hint text alone — hint text has
been wrong at least once (Damping Bias) relative to the actual formula.

Convention across the app: **right = OVERSTEER, left = UNDERSTEER** for
every balance-relevant slider.

> Keep this in sync with `index.html` whenever a slider's range, mechanism,
> or tier gating changes — see the note in `CLAUDE.md` about reviewing docs
> after major changes.

---

## Beginner (BEG) — always visible

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| Ride Stiffness | 0.8–5.5 Hz | Sets the spring frequency of whichever axle RIDE REF. anchors; the other derives via the active Hz mode. BEG has no RIDE REF. toggle, but the stored value persists from any prior INT/PRO session, so this is not always the front axle — the slider's own label follows it (`Ride Stiffness` / `Avg Stiffness` / `Rear Stiffness`) | None directly — magnitude only |
| Ride Stiffness — STIFFNESS mode (INT/PRO RIDE panel, only shown with RIDE HEIGHT → CG on) | HZ / BOTTOM G's | Toggle next to RIDE REF. that swaps what the slider sets. HZ is the slider above. BOTTOM G's re-scales the same slider to the vertical-g load factor at which the active RIDE REF. axle bottoms out (`rideHeight_mm·(2π·Hz)²/9810`, inverted to solve Hz from a target g) — same sag model as the SAG vs LOAD chart. Range is that formula evaluated at HZ_MIN/HZ_MAX for the active axle's ride height, so bounds vary per axle/chassis. Both `fe.rideStiffMode` and the target `fe.rideBottomG` are real persisted fields (codec ids 63/64, `DEF_FE`) — the target actively re-solves Hz whenever the chassis it applies to changes (ride-height edits, or a build/share-code landing a different target on the current chassis), not just a display convenience. With RIDE REF. also set to SHARED, this unlocks a SHARED **Hz mode** option (alongside MULTIPLIER/MECH/FLAT RIDE) that solves front and rear Hz to bottom out at the same g instead of holding a fixed Hz ratio — read-only display, no extra slider. See [PHYSICS.md](PHYSICS.md#bottom-gs-stiffness-mode) for the resolve mechanism and the RIDE REF. invariant it preserves, and [PHYSICS.md](PHYSICS.md#rearsecondary-hz-modes) for the SHARED Hz mode's formula | Same as Ride Stiffness — both modes drive the same underlying Hz value |
| Balance | −50..+50 | Blends NEUTRAL-mode ARB Bias (dominant) with a slight rear/front Hz ratio nudge, applied incrementally on top of whatever ratio is already set (e.g. a loaded preset's), not a reset | Right = OVERSTEER, Left = UNDERSTEER |
| Character | −50..+50 | Sets rebound ζ (`70 − v·0.5`, so it reaches only ζ 45–95%) and bump ratio (`56 + v·0.22`). A tune below ζ 45% — including three factory presets — reads pinned at AGILE; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | None — damping feel (STABLE↔AGILE) |
| Layout | FWD/RWD/AWD | Drivetrain type; reshapes diff behavior and natural balance | Indirect — redefines "neutral" |
| Weight | 100–18,000 lb | Scales spring rates, damper forces, ARB stiffness | None directly |
| Front Weight Bias | 30–70% | Front axle weight fraction | Higher front % → naturally more understeer-prone |
| Build Type | Street/Track/Drift/Rally/Offroad/Drag | Shifts alignment, diff AUTO behavior, brake balance, recommended targets | Indirect (changes recommendations) |

## Intermediate (INT) — adds these

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| <!--@range fe.arbBias-->ARB Bias | −50..+50 | Shifts front/rear ARB split (WEIGHT: from weight default; NEUTRAL: from the springs-cancelling point; CHASSIS (PRO): from the car's natural mech balance) | Right = OVERSTEER, Left = UNDERSTEER |
| <!--@range fe.arbBasicMan-->ARB Stiffness (Stiffness Mode BASIC) | 0–100% | Sets an overall ARB roll-stiffness budget directly (0%≈1 click, 100%≈this game mode's click limit, per axle at a neutral split) — unlike SHARE %, doesn't scale with spring rate. Balance Mode still splits it front/rear like AUTO/ROLL/SHARE. **Hidden in BEAMNG** — the range is defined entirely as a fraction of the click ceiling, so it has no meaning without one. Listed under PRO here until an audit checked the gating: the BASIC button carries a `!physMode` guard and no `uiMode` guard, so it is available from INT up, like the other Stiffness Modes | None directly — redistributes level only, Balance Mode/ARB Bias set direction |
| <!--@range fe.arbTargetRollMan-->Target Roll Angle (Stiffness Mode ROLL °) | 0.3–5.0° @ 1g | Body roll the bars are solved to allow at 1g lateral. Low (≈0.5–1°) = stiff bars and flat cornering; high (≈3–5°) = soft bars that let the suspension articulate. The solver inverts the roll equation to hit it, so the achieved angle can fall short when springs alone already exceed the target or the bars hit their ceiling — the output card says so when that happens | None directly — sets total ARB level, Balance Mode/ARB Bias set direction |
| <!--@range fe.arbShareMan-->ARB Share (Stiffness Mode SHARE %) | 0–80% | Fraction of **total** roll stiffness supplied by the bars. 0% = springs carry all roll resistance; 20–30% is typical sport. Higher means stiffer bars relative to springs and more abrupt lateral load transfer. Unlike BASIC, this scales with spring rate — change Ride Stiffness and the bars follow | None directly — sets total ARB level, Balance Mode/ARB Bias set direction |
| ARB F / ARB R (Stiffness Mode MAN) | Forza: 1–`lim.arb` clicks (65 HORIZON / 40 MOTORSPORT). BEAMNG: 0–200000 N/m | Direct ARB values, bypasses budget/split entirely. The max tracks the game mode rather than being fixed at 65 — `computeTune` clamps to `lim.arb`, so a fixed ceiling let you type values MOTORSPORT would silently discard. In BEAMNG the field shows BeamNG's linear Anti-Roll Spring Rate, has no ceiling, and is **not** snapped to BeamNG's 1000 N/m increment — a typed value is taken verbatim, the same way Forza's MAN bypasses the 0.1-click rounding, while the solved (non-MAN) budget does snap. Always **stored** as roll stiffness: displayed via `k = 2·rs/track²`, and converted by `ARB_RS_SCALE·track²` in both directions when the game mode changes. Balance Mode is hidden while MAN is active | More rear-relative → OVERSTEER |
| Split Direction (WEIGHT/CHASSIS) | SAME / OPPOSITE | SAME tracks the reference balance directly (front-heavy → front-heavy ARB). OPPOSITE mirrors the split around 50/50 (front-heavy → rear-heavy ARB), so the bars counteract the reference instead of following it. ARB Bias still nudges from whichever baseline this picks. | Indirect — flips which side WEIGHT/CHASSIS lean toward by default |
| <!--@range fe.reboundZeta-->Rebound ζ | 10–200% | Rebound damping ratio, both axles. Readout zones: plain below 68%, `· BUTTERWORTH` 68–72% (ζ≈70.7% is a *point*, so only its neighbourhood carries the name), `· FIRM` above 72%, `⚠ OVERDAMPED` above 100%. Marker at 70% is labelled BWORTH | None — magnitude/feel |
| <!--@range fe.bumpRatio-->Bump Ratio | 10–100% | Bump damping as % of rebound; readout appends the resulting bump ζ with the same BUTTERWORTH/FIRM/OVERDAMPED zones as Rebound ζ. Feeds the DYNAMICS chart — trace shape, settle marker and neutral ring all respond to it. Deliberately absent from the RESPONSE bar and from `bDampBias`, see [PHYSICS.md](PHYSICS.md#response--transient-character-responsefactors) | None — feel only |
| <!--@range fe.bumpZeta-->Bump ζ | 10–115% | Independent bump damping. This is an **anchor**, not a per-axle value — Damping Balance Mode splits it front/rear exactly as it splits the rebound anchor (see [PHYSICS.md](PHYSICS.md#the-bump-stroke-gets-the-same-split)), so the readout shows `F x% \| y% R` whenever the two diverge and a single figure when they don't. Same readout zones as Rebound ζ, plus `⚠ CROSSED` when **either** axle's bump exceeds **that axle's** rebound ζ (not the raw Rebound ζ slider, which is the wrong yardstick under SETTLE TIME and under any split). Switching in from BUMP RATIO seeds this from whichever axle the active Balance Mode anchors, so the tune on screen doesn't jump. Same reach as Bump Ratio — DYNAMICS yes, RESPONSE and `bDampBias` no | None — feel only |
| Damping Balance Mode | STANDARD / SYNC / NEUTRAL | Independent of REBOUND MODE — REBOUND MODE only decides how the anchor ζ is obtained (typed under CHARACTER, back-solved from a target time under SETTLE TIME); this decides how that value becomes a front/rear split, under either REBOUND MODE. STANDARD biases the anchor directly by percentage (simplest, Hz-agnostic). SYNC solves so front and rear finish settling at the same time (Hz-aware, ignores corner mass). NEUTRAL solves so both axles push the same actual damping force (Hz- **and** corner-mass-aware) — mirrors ARB Balance Mode's WEIGHT/NEUTRAL pattern. The Damping Bias slider below works the same way in all three and never resets when you switch modes — only the formula interpreting it changes. All three split the **bump** stroke as well as rebound, under either BUMP MODE. Under SETTLE TIME, only the ride-reference axle is guaranteed to hit the target time exactly (SYNC derives the other axle's ζ to match it too; STANDARD/NEUTRAL split differently, so the other axle's real settle time is whatever falls out of that split — shown honestly in the readout, not forced equal). | Indirect — changes what the Damping Bias slider solves for, not its own direction |
| Damping Bias | −50..+50 | STANDARD: softens the opposite axle from the anchor, up to 50%. SYNC: skews the equal-settle-time split (2× at ±50). NEUTRAL: skews the equal-force split (2× at ±50). Anchor is Rebound ζ under CHARACTER, the Settle Target-derived value under SETTLE TIME — same three Balance Mode formulas either way. | Right (REAR bias) = OVERSTEER, Left (FRONT bias) = UNDERSTEER |
| <!--@range fe.settleTarget-->Settle Target | 0.10–1.50s | Target settle time; back-solves rebound ζ (clamped 10–100%; markers at 0.35/0.60/0.90/1.30s = PLANTED/RACE/SPORT/ROAD, softer still is SOFT). Targets the `settleTimeFromZeta` envelope — the figure the DAMPERS rows quote, blind to bump damping — **not** the DYNAMICS chart's trace measurement, which can read differently. The 100% clamp is self-consistent with that envelope rather than physically optimal; see [PHYSICS.md](PHYSICS.md) | None directly |
| <!--@range fe.rearHzMult-->Rear/Front Multiplier | 0.50–3.00× | Secondary axle Hz as ratio of anchor | Higher → OVERSTEER-leaning, lower → UNDERSTEER-leaning |
| Independent Hz | 0.8–5.5 Hz | Manual secondary-axle Hz | Stiffer axle resists roll more there |
| CG Height Source (CHASSIS) | RIDE HEIGHT / MANUAL toggle, defaults to RIDE HEIGHT | RIDE HEIGHT estimates `ch.cgHeight` from Ride Height F/R + tyre radius (see next row); MANUAL exposes the CG Height field directly | None directly — feeds `ch.cgHeight` |
| CG Height (MANUAL) | 200–900mm | Roll moment arm | None directly |
| Ride Height F/R (RIDE HEIGHT) | 0.5–24in / 1.3–61cm | Estimates CG height from ride height (as shown on Forza's stat screen) + tyre radius — in INT, tyre radius comes from the PRO-only Tyre Size default (265/35R18) since that field isn't exposed here. Also drives a SAG vs LOAD chart (static sag from ride Hz alone, `g/(2π·Hz)²`, plotted against vertical load factor with a bottom-out marker where sag crosses the entered ride height). Uncalibrated heuristic — see [PHYSICS.md](PHYSICS.md) Calibration notes and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | None directly — feeds `ch.cgHeight` |
| <!--@range fe.targetSpeed-->Target Speed | 60–200 mph | Flat Ride phase-cancelling speed target. The range is **not** the slider's own `min`/`max` — the control is displayed inverted (`value={240-fe.targetSpeed}`, so its 40–180 domain maps to 200–60 mph, OFF on the left) and `sanitizeTune` clamps the stored field to 60–200. This row read 40–180 until an audit caught it quoting the inverted domain as if it were mph. 200 is flat-ride OFF. Should scale with Ride Stiffness — the flat-ride rear/front ratio only stays inside the ~10–20% practitioner band up to ~2.0 Hz at the default 70 mph; stiffer setups need a higher Target Speed to stay in range. The app shows an amber advisory when the ratio exceeds ×1.25 — see [PHYSICS.md](PHYSICS.md#rearsecondary-hz-modes) | None directly |
| Diff Type | Race/Sport/Rally/Offroad/Drift | Lock-curve aggressiveness scaling | Indirect (scales EXIT/ENTRY) |
| EXIT (grouped under FRONT AXLE for FWD, REAR AXLE for RWD/AWD) | −50..+50, GRIP↔ROTATE | Accel-lock intent (sign-flipped for FWD so right always leans OS) — same GRIP/ROTATE vocabulary across all layouts | Right = OVERSTEER-leaning |
| ENTRY (not SPORT, same axle group as EXIT) | −50..+50, STABLE↔LOOSE | Decel-lock intent | Right = OVERSTEER-leaning |
| EXIT — FRONT AXLE (AWD only) | −50..+50, PUSH↔NEUTRAL | Front-axle accel lock (independent of the FRONT/REAR AXLE EXIT above, which is rear-axle for AWD) | Left (PUSH) = more UNDERSTEER |
| POWER SPLIT (AWD, grouped under CENTER) | −30..+30 (20–80% rear) | Center torque split | Right (REAR) = OVERSTEER |

## Pro (PRO) — adds these

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| Wheelbase | 400–4,000mm | Flat-ride Hz solve, brake balance | None directly |
| Track Width F/R | 1,000–2,600mm | Roll-stiffness lever arm; feeds natural mech balance | Wider front → understeer lean; wider rear → oversteer lean |
| Tyre Size F/R | e.g. `265/35R18` | Grip capacity; asymmetry nudges displayed Mech Balance. Also feeds the INT-available RIDE HEIGHT → CG estimate's tyre radius | Wider rear → less oversteer; wider front → less understeer |
| Mech Balance Target | delta from NAT (≈−0.35..+0.70) | MECH/CO-SOLVE solve to `naturalMechBalanceOf(ch) + delta` | Positive = OVERSTEER target, negative = UNDERSTEER target |
| Balance Offset | −0.20..+0.20 | GRIP mode's offset from grip-neutralizing target | Positive = OVERSTEER, negative = UNDERSTEER |
| Motion Ratio F / R (BEAMNG only) | 0.20–1.50, default 1.00 | Spring/damper travel per unit wheel travel. Divides the *displayed* spring and damper rate by `mr²`, because BeamNG's sliders act at the spring while the solver works in wheel rate. Hidden in the Forza modes, which display wheel rate already. Floor is 0.20 rather than 0 because the value is squared | **None** — display-only; Hz, roll stiffness and every balance figure are unaffected by design. The physical-unit slider snap is applied in wheel-rate space specifically to keep it that way, which leaves a bounded half-step mismatch between the printed number and the physics beside it at `mr` ≠ 1 — see [HISTORY.md](HISTORY.md) |
| <!--@range fe.springShare-->Spring Share (CO-SOLVE) | 0–100% | Splits correction between spring Hz and ARB split | None directly — redistributes *how*, not the target |
| Accel/Decel Lock (MANUAL diff) | 0–100% each | Direct per-axle lock % | Rear lock → OVERSTEER; front lock → UNDERSTEER |
| Center Split (MANUAL AWD) | 0–100% rear | Direct torque split | Higher % rear → OVERSTEER |
| Nudge Strength (Alignment MECH/GRIP) | 0–100% | Scales how far camber/toe are nudged from the BUILD baseline toward the MECH/GRIP gap (see [ALIGNMENT.md](ALIGNMENT.md)) | 0% = no nudge (identical to BUILD); direction comes from the gap's sign, not this slider |
| Camber F/R, Toe F/R, Caster (Alignment MANUAL) | Camber −4.0/−3.5..0.0°, Toe −0.20..0.15° / 0.0..0.25°, Caster 4.0–7.5° | Direct entry, bypasses `computeAlignment` entirely | None directly — whatever you type |

## Auto-computed by default, or PRO's Alignment Mode

BRAKES (balance % — pressure was removed as dead output) is always fully computed from build type/
layout/weight bias/chassis geometry, with no manual override, and clamped to
**45–68% front**. Values below 50 (a rear bias, valid for trail-braking and
drift) are reachable only for rear-weighted cars on DRIFT/DRAG builds — the
CG/wheelbase weight-transfer term front-biases everything else. ALIGNMENT
(camber, toe, caster) is computed the same way by default (BUILD mode), but
PRO mode adds an Alignment Mode toggle (BUILD/MECH/GRIP/MANUAL) — see the
Nudge Strength/Camber/Toe/Caster rows above and
[ALIGNMENT.md](ALIGNMENT.md) for the full reference.
