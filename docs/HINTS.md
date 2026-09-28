# SUSP.OS — Hints

Every ⓘ hint in the app, and the always-visible help text around the controls,
word for word. Use it to review the wording in one place, check that a hint still agrees
with the math, or find which hint mentions something.

The code is the source of truth. `tests-docs.js` checks this file against
`index.html` in both directions: every piece of hint text in the code must be quoted
here, and every quote here must still be in the code. A reworded, added or removed
hint fails the run until this file is updated. It checks that the words match, not
that they are right: [FORMULAS.md](FORMULAS.md) and [SLIDERS.md](SLIDERS.md) are the
ground truth for what a control actually does, and hint text has contradicted the
math before.

## Reading this file

- **What's here.** Every ⓘ popover (the `Hint` component, and every `hint=` prop on
  `Field`, `FeelSlider`, `Toggle`, `Card`, `VisTrack`, `BiasSeg`, `DirSeg`), plus the
  inline guidance: the Handling Balance and RESPONSE correction tips, the SHARE
  dialog's per-mode description, the manual diff's `typical:` lines, the BeamNG ARB
  caveat, and the FIT? badge's detail sentences.
- **What's not.** Warnings and status messages the app raises about a tune (an
  unreachable target, a clamp, a game limit) are output, not guidance. The TERMS
  glossary lives in `GLOSSARY` and has its own modal. Tutorial text is in
  [TUTORIALS.md](TUTORIALS.md#step-text).
- **Format.** Each entry names the control, then gives its text as a `>` quote. Only
  UI text goes in quotes. `{…}` stands for a value filled in live. A hint that
  changes with layout, tier, game mode or another control's setting gets one quote
  per variant, each labelled. A sentence that's only added under some condition is
  quoted on its own after the base text.
- **Game mode.** "Forza" means a clicks-based game mode, "BeamNG" a physical-unit
  one (`physMode`: N/m and N/m/s output).
- **Copied exactly, typos and all.** A known wording bug is quoted as the app shows
  it, and recorded in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) until it's fixed.

---

## BEG panel

The BEG sidebar's flat panel. Layout and Build share their text with the INT/PRO
controls through `HINT_LAYOUT` and `HINT_BUILD_TYPE`, so the two tiers can't drift
apart.

**Layout** (also CHASSIS, INT/PRO):

> Which wheels the engine drives. Sets how the differential recommendation is calculated, and shifts alignment targets and the recommended balance range — FWD wants front grip protected, RWD wants rear traction, AWD splits the difference and unlocks the centre diff controls.

**Build** (also Build Type in BUILD, INT/PRO):

> Determines your intended use. Shifts alignment targets, diff AUTO behaviour, diff type recommendation, brake balance, and the recommended Mech Balance Target range.

**Weight:**

> Total vehicle weight. Find this on the car's stat page.

**Front Weight Bias:**

> Percentage of total weight on the front axle. Shown on the car selection screen. 50% = perfect balance.

**Ride Stiffness:**

> How stiff the suspension feels. SOFT = comfortable street ride. ROAD = balanced. FIRM = responsive sport. RACE = stiff competition setup.

**Balance:**

> Shifts overall handling balance. Right (OVERSTEER) = more rotation, freer rear end. Left (UNDERSTEER) = more stability. Start at centre for most builds — this nudges your ARB split and spring ratio rather than resetting them.

**Character:**

> Controls damping character. Stable (left) = higher damping, settles quickly, more predictable. Agile (right) = lighter damping, more lively and responsive, quicker direction changes. Start at centre.

---

## CHASSIS

Layout uses `HINT_LAYOUT`, quoted under [BEG panel](#beg-panel).

**Weight** — kg or lb, following the mass unit:

> Total vehicle weight in kg. Find this on the car's stat page. Affects spring rates, damper forces, and ARB stiffness directly.

> Total vehicle weight in pounds. Find this on the car's stat page. Affects spring rates, damper forces, and ARB stiffness directly.

**Front Weight Bias:**

> Percentage of total weight on the front axle. Shown on the car selection screen. 50% = perfect balance. Most front-engined cars are 52–58% front.

**TYRE SIZE** (PRO):

> Enter tyre sizes (e.g. 265/35R18). Width (first number, in mm) sets each axle's grip capacity at the limit — wider = more grip on that end. This affects the GRIP BIAS readout (physical handling at limit) but not the roll stiffness balance directly. Aspect ratio and rim diameter determine rolling radius.

**Wheelbase** (PRO):

> Distance between front and rear axles in millimetres. Used by the flat-ride formula to match rear spring frequency to your target speed, and by the brake balance calculation. Still needed in MEASURED mode — only track widths are skipped there. Typical cars: 2400–2900 mm.

**Track Width F / Track Width R** (PRO; hidden while a measured natural balance is in use):

> Distance between left and right wheels at the front. Typical: 1400–1800 mm. Wider = more roll resistance.

> Distance between left and right wheels at the rear. Typical: 1400–1800 mm. Often slightly wider than front.

**Motion Ratio F / R** (PRO, BeamNG) — `{side}` is front or rear:

> How far the {side} spring and damper move per unit of wheel travel. 1.0 = direct-acting (strut on the hub). Lower means the spring sits inboard on a control arm and must be stiffer to give the same wheel rate — the output is divided by the ratio squared, so 0.7 raises it by about double. BeamNG's sliders act at the spring, so this is what makes the numbers match; it does not change Hz, roll stiffness, or handling balance. Leave at 1.0 unless you know the car's geometry.

**ARB Motion Ratio F / R** (PRO, BeamNG):

> Length of the {side} anti-roll bar's arm as a fraction of track — where the drop link attaches, not where the spring does. 1.0 assumes the bar acts at the wheels, which makes the N/m read low; a typical inboard link is around 0.4–0.5, which raises the printed rate by (1/ratio)². Display and entry only: the roll stiffness this app solves, the balance bar and Hz are unchanged.

**CG Height Source:**

> RIDE HEIGHT estimates CG height from the front/rear ride height Forza shows on the car's stat screen, plus tyre radius — a rough heuristic (real CG height also depends on engine position, body height, and mass distribution, none of which are available inputs), but a better starting point than a guess. MANUAL lets you enter CG height directly if you have a better source.

**Ride Height F / Ride Height R** (RIDE HEIGHT source) — `{unit}` is the length unit:

> Front ride height as shown on the car's stat/tuning screen in Forza ({unit}). Used with tyre radius to estimate CG height, and to gauge bottoming risk from natural sag.

> Rear ride height as shown on the car's stat/tuning screen in Forza ({unit}).

**CG Height** (MANUAL source):

> Estimated height of the centre of gravity above ground. The game doesn't expose this — use 400–460 mm for sports cars, 480–550 mm for sedans, 580–700 mm for SUVs, 800–1100 mm for lifted off-roaders. Affects roll moment and ARB stiffness.

---

## DRIVETRAIN

**DIFF TYPE** (INT/PRO):

> Differential type installed on the car. Sport is accel-only (no decel control). Race is aggressive — the same lock % produces stronger effective locking than Rally or Offroad. Drift is even more aggressive than Race, for maximum rotation. Rally and Offroad use gentler lock curves suited to low-traction surfaces. The AUTO solver scales its output to match your chosen type.

**Differential Mode** (PRO):

> AUTO derives lock values from layout, build type, weight bias, and the intent sliders. MANUAL exposes all individual lock percentages directly.

### AUTO sliders

**FRONT AXLE → EXIT** (AWD, INT/PRO):

> Front diff accel lock for AWD. Toward PUSH increases front accel lock — more front-axle pull and understeer tendency on exit. Useful for AWD cars with strong rear rotation.

**MATCH CHASSIS:**

> When on, the diff auto-solver factors how far your mech balance target lies from the chassis's natural balance. A target tuned for more oversteer biases the diff toward rotation; a target tuned for understeer leans the diff toward stability. Off (default) means the diff ignores chassis target entirely. Has no effect in MANUAL mode. Affects the EXIT/ENTRY sliders in this group.

**EXIT** — FWD, RWD, then AWD (the rear axle's EXIT):

> Front diff accel lock. Toward GRIP increases lock — more corner-exit traction, but more push. Toward ROTATE reduces lock for a freer pivot and less understeer.

> Rear diff accel lock. Toward ROTATE increases lock — more power oversteer on exit. Toward GRIP reduces lock for cleaner exit traction.

> Rear diff exit character. Toward ROTATE increases rear accel lock — more oversteer on exit. Toward GRIP reduces rear accel lock for traction.

Added while MATCH CHASSIS is on:

> MATCH CHASSIS is on — this is further biased by your chassis mech target.

**ENTRY** (not on a Sport diff) — FWD, RWD, then AWD:

> Front diff decel lock. Toward STABLE increases lock — more resistance to rotation on entry (understeer). Toward LOOSE reduces lock for freer corner entry.

> Rear diff decel lock. Toward STABLE increases lock — resists lift-off oversteer. Toward LOOSE reduces lock for freer rotation on entry.

> Rear diff decel lock. Toward STABLE increases lock — resists lift-off oversteer. Toward LOOSE reduces lock for more rear rotation on entry.

Added while MATCH CHASSIS is on:

> MATCH CHASSIS is on — this is further biased (at half strength) by your chassis mech target.

**POWER SPLIT** (AWD):

> AWD center torque split. Toward REAR sends more power rearward — increases oversteer tendency and rear diff contribution to handling balance. 60–70% rear is typical for track.

### MANUAL fields (PRO)

`{diff type}` is the selected diff (race, sport, rally, offroad, drift), and `{lo}–{hi}`
its typical range. Every lock field (not Center Split) also shows a range on a line of
its own underneath (`RangeHint`); AWD Front Decel's always reads 0–0:

> typical: {lo}–{hi}%

AWD, **Front Accel / Front Decel / Rear Accel / Rear Decel / Center Split:**

> Front axle lock under power. Higher = more front pull out of corners but risks understeer. Typical for {diff type}: {lo}–{hi}%.

> Front axle lock off throttle. 0 is strongly recommended — anything above strongly increases understeer on corner entry.

> Rear axle lock under power. Higher = more oversteer on exit. Typical for {diff type}: {lo}–{hi}%.

> Rear axle lock off throttle. Low values improve corner entry rotation. 0–15% typical.

> Power distribution rear bias. Higher = more oversteer. 60–70% typical for track.

RWD / FWD, **Accel Lock:**

> RWD rear accel lock. Higher = more exit oversteer. Typical for {diff type}: {lo}–{hi}%.

> FWD front accel lock. Higher = more understeer on exit. Typical for {diff type}: {lo}–{hi}%.

RWD / FWD, **Decel Lock** (not on a Sport diff):

> RWD rear decel lock. Lower = better corner entry rotation, less lift-off oversteer. Typical for {diff type}: {lo}–{hi}%.

> FWD front decel lock. Lower = less understeer on entry. Typical for {diff type}: {lo}–{hi}%.

---

## BUILD

Build Type uses `HINT_BUILD_TYPE`, quoted under [BEG panel](#beg-panel).

---

## BALANCE (PRO)

**Balance Target** (the target-mode toggle):

> Sets what the mech balance target is measured from. NATURAL: an offset from the chassis natural balance. RANGE: an offset from the middle of the Balance Guide's RANGE for your layout and build. GRIP: an offset from the mech balance at which the grip model reads exactly neutral (the Balance Guide's GRIP TARGET), so the suspension cancels the chassis's understeer or oversteer tendency. MANUAL: the raw mech balance itself, e.g. 0.60 — no offset.

**Mech Balance Target** — NATURAL, then MANUAL:

> Deviation from the chassis natural roll balance. 0 = target the natural balance exactly — no ARB correction needed. Positive = rear-biased from natural (oversteer tendency), negative = front-biased (understeer tendency). The BALANCE GUIDE below shows the recommended range for your drivetrain and build type as deltas from NAT — use those as your reference.

> The mech balance to solve toward, as the game shows it — e.g. 0.60. Not an offset: it stays put when the chassis, build type or natural balance changes. Above 0.50 is rear-biased roll stiffness (oversteer tendency), below is front-biased (understeer tendency).

**Balance Offset** — RANGE, then GRIP:

> Offset from the middle of the Balance Guide's RANGE for your layout and build type. 0 = the middle of the recommended band. Positive = more rear bias (oversteer tendency). Negative = more front bias (understeer tendency). Shared with GRIP mode. The derived target is shown in the balance guide below.

> Offset from the grip-neutralising target. 0 = mech balance exactly opposes the car's natural grip tendency for neutral at-limit handling. Positive = more rear bias (oversteer tendency). Negative = more front bias (understeer tendency). Shared with RANGE mode. The derived target is shown in the balance guide below.

**BALANCE GUIDE**, and its rows NATURAL, GRIP BIAS, GRIP TARGET, RANGE and the
target row:

> Compares your suspension's mech balance to the chassis's natural, uncorrected balance. Tap each row's ⓘ for details.

> Baseline mech balance from chassis geometry and weight alone — before any spring or ARB correction.

> At-limit lateral grip balance at the natural point (LLT model). Below 0.5 the front grips out first (understeer-prone); above 0.5 the rear does (oversteer-prone).

> The mech balance at which the grip model reads exactly neutral (0.50) for this chassis at these springs and bars — what GRIP mode targets at a 0 offset. Not a mirror of GRIP BIAS: the two are in different units, and the model is not symmetric enough for the mirror to land on neutral.

> Recommended target range for your layout and build, scaled between natural balance and the grip-neutral point (GRIP TARGET) — not a flat offset. RANGE target mode aims at its middle.

> In MECH or CO-SOLVE ARB mode, shows how far you're deliberately pushing away from natural. In WEIGHT or MAN mode there's no target to solve toward, so this shows your car's actual achieved balance instead.

**MEASURE NAT BAL:**

> An alternative to entering track widths — the game's Mech Balance already accounts for your car's real geometry, including track width upgrades. Wheelbase is still used separately for flat-ride Hz and brake balance. Open Tune Check and switch to MEASURE for step-by-step setup. CHASSIS = geometry prediction (track widths required). MEASURED = your in-game reading.

---

## ANTI-ROLL BARS

**Stiffness Mode** — the base text, then the BASIC sentence (Forza only), then the
rest; `{unit}` is "roll stiffness" on BeamNG and "clicks" on Forza:

> AUTO derives ARB stiffness from the car's natural roll tendency — heavier, taller, softer cars get more ARB contribution.

> BASIC sets an overall stiffness level directly (0% ≈ softest, 100% ≈ stiffest bars the game allows) — like SHARE %, but the level doesn’t scale with spring rate.

> ROLL ° targets a specific body roll angle. SHARE % directly sets ARBs as a fraction of total roll stiffness. MAN sets front/rear ARB {unit} directly for calibration testing — bypasses the budget/split system entirely, so Balance Mode is hidden while this is active.

**ARB Stiffness** (BASIC, Forza) — `{limit}` is the game mode's ARB click limit:

> Overall ARB stiffness level, roughly 0% ≈ 1 click to 100% ≈ {limit} clicks (this game mode's limit) per axle at a neutral front/rear split. Unlike SHARE %, this doesn't scale with spring rate — moving the springs won't change the target level. Balance Mode still splits it front/rear, and unequal track widths mean the actual clicks per side won't land exactly on the stated percentage.

**Target Roll Angle** (ROLL °):

> Body roll the anti-roll bars are solved to allow. Low (≈0.5–1°) = stiff bars, flat cornering. High (≈3–5°) = soft bars that let the suspension articulate over terrain.

**ARB Share** (SHARE %):

> Fraction of total roll stiffness supplied by ARBs. 0% = springs handle all roll resistance. 20–30% is typical sport. Higher = stiffer bars relative to springs, more abrupt load transfer.

**ARB F / ARB R** (MAN) — `{side}` is Front or Rear; BeamNG, then Forza:

> {side} Anti-Roll Spring Rate in N/m, the same unit BeamNG's slider uses. No ceiling — BeamNG has no fixed ARB scale. Stored internally as roll stiffness and converted by k = 2·rs/track², so changing track width moves this number.

> {side} ARB clicks, entered directly. This game mode's limit is {limit} clicks per axle.

**Balance Mode** (INT/PRO, not in MAN) — the base text, then the sentence PRO adds.
The literal `%%` is a known bug (KNOWN_ISSUES):

> WEIGHT splits front/rear ARB from the car's weight distribution, adjusted by the ARB Bias slider. NEUTRAL either cancels the springs' contribution to the balance bar (CANCEL) or splits the bars in the springs' own proportion so every axle carries the same ARB roll % (EQUAL ROLL) — ARB Bias nudges away from either point.

> CHASSIS works like WEIGHT but is anchored to the car’s actual natural mech balance (track-width-corrected geometry, or your MEASURE NAT BAL reading when set) instead of raw weight %% — use this once you’ve customised geometry or measured in-game. MECH solves the ARB split to hit the Mech Balance Target exactly. CO-SOLVE co-solves rear spring Hz and ARB split together.

**Split Direction** (WEIGHT / CHASSIS):

> SAME tracks the reference balance directly — a front-heavy car gets a front-heavy ARB split, reinforcing its natural tendency (this is how WEIGHT/CHASSIS behave by default). OPPOSITE mirrors the split around 50/50 instead, so the bars actively counteract that tendency rather than follow it. Applies to both WEIGHT (raw weight %) and CHASSIS (calibrated natural balance) — ARB Bias still nudges further from whichever baseline this picks.

**Neutral Method** (NEUTRAL):

> CANCEL splits the bars against the springs so the balance bar returns to neutral, whatever the springs are doing. EQUAL ROLL splits the bars in the springs' own proportion instead, so each axle's ARB carries the same % of that axle's roll stiffness — the bars add stiffness without moving the springs' balance. ARB Bias nudges away from whichever point this picks.

**Spring Share** (CO-SOLVE):

> How much of the mechanical balance correction comes from rear spring stiffness vs ARB split. AUTO finds the split that equalises spring and ARB utilisation — recommended for most builds. Disable AUTO to set manually.

**ARB Bias** — NEUTRAL with EQUAL ROLL, NEUTRAL with CANCEL, CHASSIS, then WEIGHT:

> Shifts the ARB split away from the springs' own front/rear proportion, where each axle's bar carries the same share of that axle's roll stiffness. FRONT HEAVY adds more front bar stiffness (more understeer). REAR HEAVY adds more rear bar stiffness (more oversteer). Neutral (centre) leaves the springs' balance untouched.

> Shifts the ARB split away from the point that exactly cancels the springs' contribution to the balance bar — at the extremes this can swing the split all the way to front-only or rear-only. FRONT HEAVY adds more front bar stiffness (more understeer). REAR HEAVY adds more rear bar stiffness (more oversteer). Neutral (centre) cancels the springs' bias.

> Shifts the front/rear ARB stiffness split from the car's actual natural mech balance (track-width geometry, or your MEASURE NAT BAL reading) instead of raw weight %. FRONT HEAVY adds more front bar stiffness (more understeer). REAR HEAVY adds more rear bar stiffness (more oversteer). Neutral (centre) matches the calibrated natural balance.

> Shifts the front/rear ARB stiffness split from the neutral weight-distribution default. FRONT HEAVY adds more front bar stiffness (more understeer). REAR HEAVY adds more rear bar stiffness (more oversteer). Neutral (centre) matches the car's weight balance.

---

## RIDE

**RIDE REF.:**

> Which axle the stiffness slider controls. FRONT: slider sets front Hz, rear is derived. REAR: slider sets rear Hz, front is derived. SHARED: slider sets the average of both axles, the mode below sets the front/rear ratio. Switching never changes the actual front or rear frequencies — it just moves which axle the slider follows. Works in CO-SOLVE too.

**STIFFNESS** (with RIDE HEIGHT → CG on):

> What the Ride Stiffness slider below sets. HZ: spring frequency directly. BOTTOM G's: the vertical load factor at which the active RIDE REF. axle bottoms out (same model as the SAG vs LOAD chart) — the slider back-solves the Hz that produces it, and keeps re-solving it if ride height changes or a build/share-code lands a different target on this chassis. Switching RIDE REF. never changes the actual Hz values, only which axle's number is shown. Switching between HZ and BOTTOM G's carries the current value across — the g you were holding becomes the Hz that produces it, and vice versa — so the car doesn't jump. Only available with RIDE HEIGHT → CG enabled (CHASSIS section).

**Front / Rear / Avg Bottom-Out** (BOTTOM G's) — `{axle}` is front, rear or average,
following RIDE REF.:

> Vertical-g load factor at which the {axle} axle bottoms out, from static ride height and 1g sag — same model as the SAG vs LOAD chart. This target is saved with the build/share code and re-solves Hz on whatever chassis it's applied to.

**Ride / Rear / Avg Stiffness** (HZ) — RIDE REF. REAR, SHARED, then FRONT:

> Rear spring frequency — the fixed reference. The mode below derives front Hz from it. Typical range: 1.0–1.8 Hz for street, 1.8–2.6 Hz for track.

> Average of front and rear spring frequency. Moving the slider scales both axles together while the mode below holds the front/rear ratio.

> Front spring frequency — the fixed reference. The mode below derives rear Hz from it. Typical range: 1.0–1.8 Hz for street, 1.8–2.6 Hz for track.

**Hz MODE:**

> How the secondary axle frequency is derived. MULTIPLIER: a fixed ratio of the anchored axle Hz. MECH: derived from the mech balance target — PRO only. FLAT RIDE: the mathematically ideal pitch-cancelling ratio for a target speed. INDEPENDENT: set manually, free of the other axle. SHARED: (RIDE REF. SHARED + STIFFNESS BOTTOM G's only) solves both axles to bottom out at the identical g instead of holding a fixed Hz ratio. Hidden in CO-SOLVE — rear Hz is solved automatically.

**Target Speed** (FLAT RIDE) — RIDE REF. SHARED, REAR, then FRONT:

> Scales both axles together using flat-ride timing. The average Hz is held by the Avg Stiffness slider above; this speed sets how the average is split between front and rear.

> Solves front Hz so rear and front wheels hit the road's bumps in phase at your chosen speed. Right (CITY) = lower target speed, softer front. Left (OFF) = disabled, front Hz matches rear adjusted for mass only.

> The speed at which front and rear wheels hit bumps in phase (flat ride). Right (CITY) = lower target speed, stiffer rear. Left (OFF) = flat-ride correction disabled — rear Hz matches front Hz adjusted for mass only, useful for very high-speed circuits.

**Rear Multiplier / Front Multiplier / F/R Ratio** (MULTIPLIER) — SHARED, REAR, then
FRONT:

> Rear-to-front Hz ratio. The average is held by the Avg Stiffness slider — changing the ratio shifts stiffness between axles without moving the average.

> Front Hz as a fraction of rear Hz. ÷1.20 = front is 83% of rear stiffness. Useful when you want the front consistently softer.

> Rear Hz as a multiple of front Hz. ×1.00 = matched. ×1.20 is a typical starting point for most builds.

**Front Hz / Rear Hz** (INDEPENDENT) — RIDE REF. REAR, then FRONT:

> Front spring frequency set independently. Full decoupling — set rear via Ride Stiffness above, set front here.

> Rear spring frequency set independently from flat-ride. Allows full decoupling of front and rear stiffness. Front Hz is still set by Ride Stiffness above.

---

## DAMPERS

**REBOUND MODE** (INT/PRO) — SETTLE TIME, then CHARACTER:

> SETTLE TIME: set a target settle time in seconds. The app back-calculates the rebound ζ needed to hit that time on the ride-reference axle. How that value reaches the other axle is set by DAMPING BALANCE MODE below — TIME SYNC derives the other axle's own ζ from its own spring frequency to match the same time exactly; STANDARD, HYBRID and EQUAL FORCE split differently, so only the reference axle is guaranteed to hit the target.

> CHARACTER: set rebound damping directly as a ζ (damping ratio) percentage. Full manual control — you pick the value, the app doesn't back-solve anything. Switching between the two modes carries the current value across: the settle time you were holding becomes the equivalent ζ, and vice versa, so the car doesn't jump.

**Settle Target** (SETTLE TIME):

> Target settle time — how quickly oscillations die out after a bump. The app back-calculates rebound ζ for each axle from its spring frequency, against the same ζ-only estimate the DAMPERS rows show — bump damping doesn't move it, and the DYNAMICS chart, which measures the real curve, can read differently. The back-solve stops at 100% ζ: past critical damping more damping settles slower, not faster. Lower = tighter, more controlled. Higher = softer, more comfortable. Damping Bias skews the F/R timing ratio.

**Rebound ζ** (CHARACTER):

> Damping ratio for the rebound (extension) stroke — how quickly the suspension returns after compression. 55–70% is typical. 70% is Butterworth: the flattest response to a rough surface, which is not the same as the quickest settle after a single bump (that sits nearer 59%). Above 70% the car feels planted but stiff. Above 100% (overdamped) the suspension moves sluggishly.

**BUMP MODE** — INDEPENDENT, then BUMP RATIO:

> INDEPENDENT: set bump ζ directly, decoupled from rebound. Use this when you want a specific bump/rebound combination the ratio can't express — e.g. soft bump with firm rebound.

> BUMP RATIO: set bump damping as a percentage of rebound ζ — the app derives the bump ζ from that ratio, so the two strokes stay linked as rebound changes.

**Bump Ratio:**

> Bump damping as a percentage of rebound. Lower = softer over sharp hits, more compliant on rough roads. Higher = more consistent feel between bump and rebound strokes. 40–65% is the typical range for most builds. The box is the ratio; the text beside it is the resulting bump ζ.

**Bump ζ:**

> Bump damping ratio set independently from rebound. Useful when you want precise control — e.g. soft bump for road compliance with firm rebound for body control. Keep below rebound for normal handling. This is the anchor value: Damping Balance Mode splits it front/rear the same way it splits rebound, so the readout shows both axles whenever they diverge.

**DAMPING BALANCE MODE:**

> Independent of REBOUND MODE above — REBOUND MODE decides how the anchor ζ is obtained (typed directly under CHARACTER, back-solved from a target time under SETTLE TIME); this decides how that single value becomes a front/rear split. STANDARD biases it directly by percentage — simplest, ignores any front/rear Hz difference. The other three derive the second axle from its own Hz: TIME SYNC (equal settle time, ignores corner mass), EQUAL FORCE (equal actual damping force, Hz- and corner-mass-aware — useful when equal timing still leaves one end feeling harsher), and HYBRID (halfway between them, per axle). The table below highlights the row the chosen method equalises. Under SETTLE TIME, only the axle REBOUND MODE anchors to is guaranteed to hit your target time exactly — the other axle's real time is whatever this mode's split produces, shown honestly in the readout below even when it isn't equal. The Damping Bias slider below works in every mode and never resets when you switch between them — only the formula interpreting it changes.

**Damping Bias** — TIME SYNC, HYBRID, EQUAL FORCE, then STANDARD. `{anchor}` is "the
Settle Target" under SETTLE TIME and "Rebound ζ" under CHARACTER:

> TIME SYNC: biases settle time between front and rear. At centre (0), front and rear damp out in equal time regardless of any Hz difference between them (anchored to {anchor}). Left (FRONT) makes the front settle faster. Right (REAR) makes the rear settle faster. The bias scales as 2× at ±50.

> HYBRID: at centre (0), each axle's ζ sits halfway between the TIME SYNC (equal settle time) and EQUAL FORCE (equal damping force) solutions (anchored to {anchor}). Left (FRONT) firms the front. Right (REAR) firms the rear. The bias scales as 2× at ±50.

> EQUAL FORCE: biases actual damping force between front and rear. At centre (0), both axles push the same physical force — accounts for Hz and corner mass, not just a raw ζ split (anchored to {anchor}). Left (FRONT) shifts force toward the front. Right (REAR) shifts it toward the rear. The bias scales as 2× at ±50.

> Biases damping around whichever axle is your Ride Reference — that axle holds the base ζ (anchored to {anchor}); the other axle swings up to 50% at ±50, firmer one way and softer the other. Whichever axle ends up relatively firmer keeps more grip: firmer front leans understeer/stable, firmer rear leans oversteer/loose. SHARED splits the swing across both axles instead of pinning one.

---

## ALIGNMENT (PRO)

**ALIGNMENT MODE:**

> AUTO: camber/toe/caster recommended from build type, layout, weight bias, and roll angle — optionally nudged toward your Mech Balance Target or the chassis's natural grip tendency (see Nudge below). MANUAL: type in exact values, bypassing all of this.

**Nudge** (AUTO):

> OFF: BUILD's numbers, unchanged. MECH: nudges camber and toe toward your resolved Mech Balance Target's gap from natural — reinforces whatever oversteer/understeer intent you've already dialed in via the ARB/Mech Balance Target. GRIP: nudges to counteract the chassis's own natural grip tendency instead, independent of ARB mode. Caster is never nudged — it isn't an oversteer/understeer lever.

**Nudge Strength:**

> How strongly camber and toe are nudged away from the BUILD baseline. 0% = identical to BUILD mode. 100% = full nudge toward the MECH/GRIP gap. Caster is never adjusted by this — it isn't an oversteer/understeer lever.

**Camber F / Camber R / Toe F / Toe R / Caster** (MANUAL):

> Front camber, entered directly.

> Rear camber, entered directly.

> Front toe, entered directly. Negative = toe-out, positive = toe-in.

> Rear toe, entered directly.

> Caster, entered directly.

---

## VISUALS

What each chart draws is explained in [VISUALS.md](VISUALS.md); this is only what
their ⓘ says.

**ROLL SPLIT:**

> The car's front/rear share of roll stiffness, as the game's Mech Balance shows it — the divide sits where the MECH BALANCE strip's CUR does. Solid = springs, light = ARBs, each as a share of its own end. Grey tick = NAT (the chassis's natural balance), green tick = your Balance Target. Divide right of green = more front roll stiffness than targeted (toward understeer); left = toward oversteer. The line below gives body roll at 1 g (in ROLL mode, your Roll Target after the slash) and the springs/ARBs share of total roll stiffness.

**RIDE Hz** — `{min}`–`{max}` is the Hz band (`HZ_MIN`–`HZ_MAX`):

> Front and rear ride frequency on one SOFT→RACE scale ({min}–{max} Hz), so the gap between the dots is the F/R split. Hollow rings sit on the derived axle (the one Ride Reference doesn't fix): where it would need to be for the springs alone to carry your chassis's natural balance (grey) or your Balance Target (green). Amber = the rear Hz hit a limit.

**ARB** — BeamNG, then Forza:

> Front and rear anti-roll bar stiffness on one shared scale (no game ceiling here, so the scale is the stiffer bar plus headroom and there are no warning bands). Values in N/m, as the ARB card prints them. Hollow rings on the derived axle: where it would sit for the bars alone to carry natural balance (grey) or your Balance Target (green).

> Front and rear ARB clicks on one track from 0 to the game's ceiling. Bands mark 50 / 75 / 90% of the ceiling, and a dot goes amber past 88%. Hollow rings on the derived axle: where it would sit for the bars alone to carry natural balance (grey) or your Balance Target (green).

**DAMPING ζ:**

> Damping ratio per axle on a 10–200% scale. Filled dot = rebound, hollow dot = bump, joined by a bar; the header gives bump as a share of rebound, front then rear. Bump normally sits below rebound — the bar turns amber if it crosses above. Zones use the Rebound ζ / Bump ζ sliders' thresholds: blue under-damped (bouncy), green approaching Butterworth, amber at or past Butterworth (≈70%), red overdamped (sluggish).

**DYNAMICS:**

> Damped spring step response: one bump, one corner, coming back to rest — how fast each axle settles, whether it overshoots, and how ride stiffness and damping interact. The shaded strip is ±10% of ride height. DASHED LINE = settle time, the last moment that axle's trace leaves the strip (the standard settling-time definition), measured off the curve as drawn, so it reflects your bump/rebound split and not just rebound ζ. RING = the first time the curve crosses neutral (ride height), a rise-speed indicator rather than a settling one. Two results surprise people, both correct: past roughly 60% ζ the dashed line lands BEFORE the ring, because the trace enters the strip on the way down and never leaves — settled, while still creeping the last 10% home; and the number falls in steps rather than smoothly as you add rebound ζ, each step being one overshoot peak dropping inside the strip, with little gained in between. The DAMPERS rows quote a different settle figure — a quick estimate from rebound ζ and Hz alone, blind to bump damping, running long below ζ≈79% and short above it, by about 40% at ζ=100%. Both markers are read out numerically below the chart.

**SAG vs LOAD** (RIDE HEIGHT → CG on):

> Solid line: suspension compression scales linearly with vertical wheel load (mass cancels out of the spring/frequency relation), so it's just static 1g sag × load factor. The small ring on it marks the static 1g operating point. Dashed line: ride height you entered per axle — where the solid diagonal crosses it is the load (in g) at which that axle bottoms out under pure vertical load. Faint short-dashed line: the OUTSIDE wheel's extra compression from lateral load transfer during cornering (same LLT model as MECH BAL), added on top of static sag — its own hollow-ring marker shows the lateral g at which that wheel bottoms from roll alone, independent of the vertical-g line. Shaded band at the top of each axle's travel is a reminder that real springs go progressive near the bump stop, softer than this linear model shows. Still simplified — doesn't combine cornering with braking or bump load, and treats front/rear independently.

---

## Results panel — Forza cards

These six cards only render in Forza game modes (the `!physMode` block); BeamNG gets
the cards in the next section. The ANTI-ROLL BARS, SPRINGS and DAMPERS hints still
carry a BeamNG branch from before that split. It can't be displayed, but it's quoted
below, labelled, because the code still holds it.

**ALIGNMENT** — the first sentence depends on the alignment mode (MANUAL, then any
other), the rest on layout (FWD, RWD, AWD). `{camber}` is the build type's camber
target and `{roll}` the tune's roll angle:

> Manual values.

> Recommended starting point.

> Camber targets {camber} dynamic. FWD front camber reduced for traction. Toe-in front and rear for stability.

> Camber targets {camber} dynamic at {roll}° roll. Front toe-out for turn-in, rear toe-in for stability.

> Camber targets {camber} dynamic at {roll}° roll. Front toe-out for turn-in, rear toe-in scaled to center bias.

**ANTI-ROLL BARS** — the unreachable BeamNG branch, then Forza:

> Anti-Roll Spring Rate per axle in N/m, matching BeamNG's slider. Converted from the solver's roll stiffness by k = 2·rs/(track·ARB Motion Ratio)², which at ratio 1.0 assumes the bar acts at the wheels. BeamNG specifies the rate at the bar's own lever instead, so a real inboard bar needs a higher number by (track/arm)² — this output reads roughly 4–6× soft on a sampled vehicle. Scale it up by that ratio if you know the geometry, or treat it as a direction. See KNOWN_ISSUES.

> Click values to enter in the ARB tuning menu. Roll angle and ARB share are shown in the ANTI-ROLL BARS section of inputs. Amber warn when above 88% of the game limit.

**SPRINGS** — `{unit}` is "lb/in"; the unreachable BeamNG branch puts this in its place:

> Spring rates in {unit} to enter in the tuning menu. The badge shows the frequency category — SOFT/ROAD/FIRM/RACE. Hz values live in the RIDE section of inputs. The ratio in the header is rear Hz ÷ front Hz — the same relationship as that section's Rear Multiplier slider, however it's currently derived (Flat Ride, Multiplier, Mech, or Independent).

> N/m — the unit BeamNG’s Spring Rate slider uses, and divided by motion ratio squared if you set one

**DAMPERS** — the unreachable BeamNG branch, then Forza:

> Rebound (REB) and bump (BUMP) damping in N/m/s, matching BeamNG's sliders. These are the real coefficients the solver works in with no game-specific scaling, divided by motion ratio squared if you set one. Note BeamNG's own defaults tend to run a much higher rebound-to-bump ratio than this app's default Bump Ratio produces. F/R BIAS in the header is the front axle's share of total damping — 50% is balanced, above 50% is front-biased, below is rear-biased.

> Rebound (REB) and bump (BUMP) click values for front and rear dampers. Enter in the damping tuning menu. Amber warn when above 88% of the game limit. F/R balance is preserved — if either end exceeds the limit, both are scaled proportionally so the ratio is maintained. F/R BIAS in the header is the front axle's share of total damping — 50% is balanced, above 50% is front-biased, below is rear-biased.

**BRAKES** (the same text on the Forza and BeamNG cards):

> Brake balance starting point. Balance affects corner entry — higher front bias increases understeer tendency, lower increases rotation. The recommendation accounts for forward weight transfer under braking (CG height and wheelbase), which front-biases it for most builds. DRIFT and DRAG on a rear-weighted car can land below 50% — a rear bias is a real trail-braking and drift technique, not an error. Fine-tune in 1% steps by feel.

**DIFFERENTIAL** — FWD, RWD, then AWD (`{rear %}` is the centre split):

> Starting point — fine-tune by feel in 1% steps. Accel lock controls exit traction and understeer. Decel near zero improves corner entry rotation.

> Starting point — fine-tune by feel in 1% steps. Accel lock aids exit rotation. Decel low for better corner entry; raise for stability under lift-off.

> Starting point — fine-tune by feel in 1% steps. Front decel at 0 minimises entry understeer. Rear decel low for rotation. Center {rear %}% rear.

## Results panel — BeamNG cards

**FRONT / REAR SUSPENSION:**

> Anti-Roll Spring Rate, Spring Rate, and Rebound/Bump Damping in N/m / N/m/s, matching BeamNG's sliders — divided by motion ratio squared if you set one. Spring badge shows frequency category (SOFT/ROAD/FIRM/RACE); damping notes flag over/underdamped. The settle figure beside each damper is the quick ζ-only estimate — it cannot see bump damping, so the DYNAMICS chart, which measures its drawn curve, may read differently. Anti-Roll reads soft — see the note under that row.

The note under the Anti-Roll row, shown while both ARB Motion Ratios are 1.0:

> Reads ~4–6× soft: at ARB Motion Ratio 1.0 this assumes the bar acts at the wheels, but BeamNG sets the rate at the bar's own lever. Set the ratio in CHASSIS (arm ÷ track, typically 0.4–0.5) if you know the geometry.

**FRONT / REAR ALIGNMENT** — the Forza ALIGNMENT text above (as `{forza text}`), then:

> {forza text} BeamNG's Camber/Caster/Toe Adjust sliders are % of this vehicle's Jbeam-defined range, not degrees — there's no formula to convert this target angle into that %. Dial the slider while watching BeamNG's own live tuning-screen alignment readout until it matches the angle below. If you change Spring Height afterward, recheck against the readout — the %-to-angle relationship shifts with ride height.

**BRAKES:** as on the Forza card above.

---

## Handling Balance bar

### Header and compact bar

**HANDLING BALANCE** — PRO, then BEG/INT:

> Mid-corner grip margin: how much more lateral grip the front axle has left than the rear at the limit, as a percent of their mean, from the grip model at this tune's roll-stiffness split. + = the rear gives up first (oversteer), − = the front does (understeer); within ±1% reads NEUTRAL. Tap to expand for ENTRY and EXIT, and what each setting contributes.

> Combined steady-state handling tendency from all tuning inputs. Positive (+) = oversteer tendency, negative (−) = understeer. Zero is weight-matched neutral — neither end saturates grip first. Tap to expand for contributor breakdown and actionable tip.

**FIT?** badge (PRO, only while a figure is outside the fitted set). Its hint opens with
one of two lead-ins, each followed by the matching details joined by `;`, and always
ends with the pressure caveat:

> The balance model is outside the range where it answers correctly: {details}.

> Outside the calibrated set, so these figures are extrapolated rather than verified against the game: {details}. Nothing is clamped to those bounds and the tune is not wrong — the model simply has no measurements that far out.

> Not flagged because it is always true: the whole tyre fit, and any MEASURE ARB or MEASURE NAT BAL reading, is only valid at the tyre pressures it was taken at, and the app has no pressure input.

The details, from `balanceEnvelope` — tags HZ, MASS, TYRE, LIFT, then CG (the only
one that uses the first lead-in):

> spring frequencies {F}/{R} Hz sit outside the {lo}-{hi} Hz band the tyre-series balance model was fitted on

> corner masses {F}/{R} kg sit outside the {lo}-{hi} kg the model's root-load tyre scaling was fitted on

> section widths {F}/{R} mm sit outside the {lo}-{hi} mm sampled, so the tyre-width balance term is extrapolated

> at 1 g lateral the {wheels} unload completely, so that axle has stopped responding to roll stiffness — more bar or spring on that end will not move the balance further

where `{wheels}` is one of:

> inside wheels of both axles

> inside wheel

(the last preceded by "front" or "rear"), and:

> the ride-height CG estimate ({mm} mm) is past the {lo}-{hi} mm CG Height range, so CG has stopped responding to ride-height edits and the load-transfer model is running on the clamped value

**MECH** readout (PRO):

> Mech Balance is the rear fraction of total roll stiffness (0 = all front, 1 = all rear, 0.5 = even split). This matches Forza's in-game mech balance display. The delta shows how far your setup has shifted from the car's natural balance — blue means more rear-biased than natural, amber means more front-biased.

**Segment legend** — PRO, then BEG/INT:

> The mid-corner margin as coloured segments: CHAS (the car's own lean before tuning — tyre sizes, track widths, CG and weight split), SPR (springs), ARB (anti-roll bars). The bar's half-width is ±10%. Brakes, drive, diff and damping act in other phases — see the ENTRY / EXIT line and the expanded panel.

> Stacked bar shows each contributor as a coloured segment: CHAS (the car's own lean before tuning — tyre sizes, track widths, CG and weight split), SPR (springs), ARB (anti-roll bars), DIFF (differential), BRK (brakes), DAMP (damping bias). Segments stack outward from neutral — the bar's total reach is the combined handling balance.

**ENTRY · MID · EXIT** line (PRO) — `{entry g}` and `{exit g}` are `ENTRY_G` and `EXIT_G`:

> ENTRY is MID plus what brake bias does at {entry g} g braking; EXIT is MID plus what the drive split does at {exit g} g of drive. The weight transfer itself (PITCH) is left out of both — it depends on how hard you brake or accelerate, not on the tune. An arrow is the way diff lock pushes that phase; nothing has calibrated how far.

### Expanded panel — BEG / INT

**Correction tip.** Shown at the top. Under 3 points either way:

> Setup is well balanced.

plus, when one contributor is still large (`{NAME}` is its name in capitals):

> Keep an eye on {NAME} if the car feels inconsistent.

Otherwise the dominant contributor's tip below. If no contributor is dominant:
"Adjust the Balance slider." in BEG, "Adjust ARB Bias." in INT, and, for a contributor
with no tip of its own, "Adjust the dominant contributor.":

> Adjust the Balance slider.

> Adjust ARB Bias.

> Adjust the dominant contributor.

Each dominant-contributor tip below comes as an oversteer / understeer pair (the total's
sign picks one). In BEG the Balance slider covers springs, bars and damping, and those
tips end with the BEG balance line (`{BEG balance}`):

> Move Balance toward UNDERSTEER to counter it.

> Move Balance toward OVERSTEER to counter it.

CHASSIS:

> The car itself leans toward oversteer — its build, not your settings. Move the balance toward the front to counter it.

> The car itself leans toward understeer — its build, not your settings. Move the balance toward the rear to counter it.

SPRINGS — BEG (two lines), then INT:

> The rear springs are stiff for the weight they carry. {BEG balance}

> The front springs are stiff for the weight they carry. {BEG balance}

> The rear springs are stiff for the weight they carry. Lower the rear Hz relative to the front (the RIDE multiplier), or offset it with ARB Bias toward FRONT HEAVY.

> The front springs are stiff for the weight they carry. Raise the rear Hz relative to the front (the RIDE multiplier), or offset it with ARB Bias toward REAR HEAVY.

ARB — BEG, then INT:

> The rear bar carries more than its share. {BEG balance}

> The front bar carries more than its share. {BEG balance}

> Move ARB Bias toward FRONT HEAVY (in MAN, raise ARB F relative to ARB R).

> Move ARB Bias toward REAR HEAVY (in MAN, raise ARB R relative to ARB F).

DIFF rows in BEG, which has no diff sliders:

> In BEG the diff lock comes from Build Type and Layout. INT adds the EXIT and ENTRY sliders to tune it directly.

DIFF EXIT, DIFF ENTRY, DIFF F, DIFF R (INT):

> Move EXIT toward GRIP — less lock on throttle calms exit rotation.

> Move EXIT toward ROTATE to add rotation under power.

> Move ENTRY toward STABLE — more decel lock resists lift-off rotation.

> Move ENTRY toward LOOSE to allow freer rotation on entry.

> Move the FRONT AXLE EXIT toward PUSH — more front lock pulls the nose out of the corner.

> Move the FRONT AXLE EXIT toward NEUTRAL to free the front on throttle.

> Move the REAR AXLE EXIT toward GRIP, or ENTRY toward STABLE.

> Move the REAR AXLE EXIT toward ROTATE to add rotation under power.

BRAKES:

> The recommended brake balance (BRAKES card) is rear-leaning for this car. In game, move it forward to calm entry rotation.

> The recommended brake balance (BRAKES card) is front-heavy for this car. In game, move it rearward for more turn-in.

DAMP (INT; BEG uses its balance line):

> Move Damping Bias toward FRONT — firmer front damping resists weight transfer off the front.

> Move Damping Bias toward REAR to let the front take weight more freely.

**Contributor rows** — CHASSIS, SPRINGS, ARB (MECHANICAL), then DIFF F, DIFF R (AWD),
DIFF EXIT and DIFF ENTRY (FWD, then RWD), BRAKES, DAMP (DYNAMIC):

> The car's own at-limit lean before any tuning: tyre widths, track widths, CG height and weight split, read from the grip model. Shown as the stiffness bias it takes to cancel it, so −10 means this car needs 10 points of rear-biased roll stiffness just to reach neutral. Springs and ARBs are measured against the weight split; this is the correction from there to where the car is actually neutral.

> Spring roll-stiffness bias vs weight distribution. + = oversteer (rear springs relatively stiffer). − = understeer (front springs relatively stiffer).

> ARB roll-stiffness bias vs weight distribution. + = oversteer (rear ARBs relatively stiffer). − = understeer (front ARBs relatively stiffer).

> AWD front diff net contribution (accel+decel). Front lock pushes understeer (−). Center split and front weight fraction are factored in.

> AWD rear diff net contribution (accel+decel). Accel lock pushes oversteer (+); decel lock resists it, pushing understeer (−). Center split and rear weight fraction are factored in.

> Front accel lock on-throttle exit. Higher lock = more understeer (−).

> Rear accel lock on-throttle exit. Higher lock = more oversteer (+).

> Front decel lock off-throttle entry. Higher lock = more entry understeer (−).

> Rear decel lock off-throttle entry. Higher lock resists lift-off oversteer, pushing understeer (−).

> Brake-balance contribution to entry. High front bias = understeer on entry (−). Low front bias (rear-biased) = oversteer tendency (+). Based on deviation from 50% neutral.

> Damping bias contribution. More front rebound damping resists weight transfer off the front, producing understeer tendency (−). More rear damping does the opposite (+).

### Expanded panel — PRO

**Phase tips.** One line per phase whose margin is at least ±1% (`PHASE_NEUTRAL`), or,
when none is:

> Balanced through every phase the model reads.

MID — by the dominant contributor (chassis, springs, bars), oversteer then understeer:

> Mid-corner: the chassis itself leans toward oversteer (tyre stagger, track widths, CG, weight split). Counter it with more front roll stiffness, or narrow a front-favouring stagger.

> Mid-corner: the chassis itself leans toward understeer (tyre stagger, track widths, CG, weight split). Counter it with more rear roll stiffness, or narrow a rear-favouring stagger.

> Mid-corner oversteer, mostly from the springs. Lower the Mech Balance Target, or use CO-SOLVE.

> Mid-corner understeer, mostly from the springs. Raise the Mech Balance Target, or use CO-SOLVE.

> Mid-corner oversteer, mostly from the bars. Lower the Mech Balance Target or move ARB Bias toward the front.

> Mid-corner understeer, mostly from the bars. Raise the Mech Balance Target or move ARB Bias toward the rear.

ENTRY — `{bias}` is the recommended brake bias, `{ideal}` the load-proportional split:

> Entry: brake bias {bias}% asks the rear for more than its share under braking. Move it toward {ideal}% to calm the rear.

> Entry: brake bias {bias}% loads the fronts past their share under braking. Move it toward {ideal}% for more turn-in.

EXIT — AWD, then RWD and FWD:

> Exit: the centre diff sends the rear more than its share of drive. Shift it toward the front to settle power-on oversteer.

> Exit: the centre diff sends the front more than its share of drive. Shift it toward the rear for more rotation under power.

> Exit: rear drive takes lateral grip from the rear under power. Only throttle and exit diff lock manage it.

> Exit: front drive takes lateral grip from the front under power. Only throttle and exit diff lock manage it.

**Phase rows** — ENTRY: BRAKES, DIFF ENTRY, PITCH; MID: CHASSIS, SPRINGS, ARB; EXIT:
DRIVE (CENTRE on AWD), DIFF EXIT, PITCH; TRANSIENT: DAMP. `{entry g}` / `{exit g}` as
above; `{ideal front %}` and `{ideal rear %}` are this car's load-proportional splits:

> Brake bias against the load-proportional split at {entry g} g braking ({ideal front %}% front on this car). Positive: the rear brakes more than its share and has less grip left to corner.

> Off-throttle lock resists the car rotating on entry. Shown as a direction only: nothing has calibrated how much.

> Load moving forward at {entry g} g braking adds front grip and takes rear grip. Not tunable, and not in the ENTRY figure: its size depends on how hard you brake, and it would bury everything a setting can change.

> The margin at the weight-matched stiffness split — the car's own lean before springs and bars move it: tyre widths, track widths, CG height and weight split, from the grip model.

> How far the springs move the MID margin from CHASSIS, by shifting the roll-stiffness split. Shares the move with ARB in proportion to how far each shifts the split.

> How far the anti-roll bars move the MID margin from CHASSIS. See SPRINGS.

> The drive split against the load-proportional one at {exit g} g of drive ({ideal rear %}% rear on this car). Positive: the rear carries more than its share of drive and has less grip left to corner.

> On-throttle lock. Whether it pushes the car wide or rotates it depends on the layout. Direction only: nothing has calibrated how much.

> Load moving rearward at {exit g} g of drive. Not tunable, and not in the EXIT figure — see ENTRY's PITCH.

> Front vs rear damping. Acts only while load is moving — turn-in and direction changes — which a steady-state model cannot size. Direction only.

**Footer**, under the rows — `{grip bias}` is GRIP BIAS on its 0–1 scale:

> Grip margin: how much more lateral grip the front axle has left than the rear, as a percent of their mean. + = the rear gives up first. ENTRY and EXIT are MID plus what brakes and drive change. GRIP BIAS {grip bias} is the same model on its 0–1 scale. Alignment also affects balance.

**MECH BALANCE** strip:

> Mech balance on the 0–1 scale as the game displays it — the rear share of roll stiffness, with each tyre counted in series with its axle in Forza. NAT is the balance the game shows for this car at equal ride frequency front/rear and no bars: your MEASURE NAT BAL reading when you have one, otherwise the model's prediction of what that measurement would read. Balance Target deltas are measured from NAT, so 0 means stay exactly here. CUR is where your current setup lands. TGT (shown in MECH/CO-SOLVE modes) is the balance you are targeting. The band between NAT and CUR shows how much correction your setup applies.

### RESPONSE

**RESPONSE** bar:

> Transient response character — how quickly and freely the car reacts to steering inputs. PLANTED (left) means settled and damped: the car resists sudden direction changes but feels stable and predictable. REACTIVE (right) means quick to respond: the car turns in immediately but can feel nervous. Driven by front Hz (35%), front rebound damping (12%), rear Hz (20%), rear rebound damping (8%), toe (15%), and caster (10%). Bump damping is deliberately left out — its effect on transient feel reverses between smooth and rough surfaces. Independent of handling balance — a car can be neutral and still feel very planted or very reactive.

**Tip** — within ±15 of centre:

> Transient response is balanced.

plus, when one factor is still large (`{factor}` is its row label):

> {factor} is the primary character driver.

Otherwise the dominant factor's tip below; with no dominant factor, "Setup is near
balanced.", and for a factor without a tip, "Adjust the dominant factor.":

> Setup is near balanced.

> Adjust the dominant factor.

Factor tips, each as a toward-PLANTED / toward-REACTIVE pair — Hz F, DAMP F, Hz R,
DAMP R, TOE F, CASTER. The first of each pair shows when the car reads REACTIVE:

> Soften front springs (lower Hz) for a more planted entry feel.

> Stiffen front springs to sharpen initial turn-in response.

> Increase front rebound damping to settle entry more firmly.

> Reduce front rebound damping to free up initial roll response.

> Soften rear springs (lower Hz) to reduce rotation tendency.

> Stiffen rear springs to improve rear body control and rotation speed.

> Increase rear rebound damping to plant the rear more firmly.

> Reduce rear rebound damping for more rotation freedom.

> Add front toe-in to improve straight-line stability.

> Reduce front toe-in to sharpen turn-in response.

> Increase caster for stronger self-centering and stability.

> Reduce caster for lighter, quicker steering response.

**Factor rows** — Hz F, DAMP F, Hz R, DAMP R, TOE F, CASTER:

> Front ride frequency — higher Hz = faster initial turn-in response. Primary driver of transient character.

> Front rebound damping — lower = less resistance to roll initiation = sharper turn-in. Higher = more planted entry. Rebound only: bump damping affects turn-in too, but its sign flips with surface roughness, so this bar leaves it out rather than guess — the DYNAMICS chart shows what bump actually does.

> Rear ride frequency — higher Hz = quicker rear body control and rotation feel.

> Rear rebound damping — lower = more rotation freedom and rear agility. Higher = more planted rear. Rebound only, same as DAMP F.

> Front toe-out sharpens turn-in response (agile). Toe-in adds straight-line stability.

> Lower caster reduces self-centering force, allowing quicker steering response.

### LOAD TRANSFER (PRO)

> Corner weights and lateral load transfer at 1g cornering — see the LOAD TRANSFER entry in TERMS for what drives it. CORNER WT: static per-corner mass. XFER: total axle load transfer per g. OUT/IN: outer and inner wheel loads at 1g.

---

## Tune Check (CHECK)

**DECODE — the destination line** under the import buttons, with IMPORT AS DNA
available (PRO), then without it:

> Two destinations. IMPORT TUNE keeps the numbers; IMPORT AS DNA keeps the handling.

> IMPORT TUNE writes these numbers onto this car. IMPORT AS DNA needs PRO.

**STEP 2 · DECODED TUNE** — `{unit}` is "roll stiffness" on BeamNG and "clicks" on Forza:

> The app reads these as a front Hz plus rear multiplier, and a front rebound ζ plus one Damping Bias. That bias sets both the rebound and bump splits and stops at ±50, so some damper splits land close rather than exact. IMPORT TUNE sets the ARB {unit} directly (ANTI-ROLL BARS switches to MAN); IMPORT AS DNA turns them into ARB share and balance targets.

**MEASURE → Measure Hz:**

> The ride frequency the probe springs are solved for. Softer is more accurate — at a lower Hz the bars account for more of the balance Forza displays, so the same two-decimal reading pins both this and the ARB click scale harder. Go as soft as the game will let you set on this car; the spring rates below are what to enter.

---

## SHARE dialog

The description under the mode picker — SHARE, LOAD, BACKUP, RESTORE:

> Generates a compact code for the current tune — chassis, springs, dampers, ARBs, and all feel settings. COPY LINK wraps the same code in a URL that opens SUSP.OS with it ready to load. Does not include your garage entries.

> Paste a code or link from another device or user, then READ CODE to stage it — nothing on your tune moves until you APPLY SELECTED. Only the parts you tick are taken; the rest keep your values. TO GARAGE saves the result as a new garage entry instead, without touching your current tune.

> Downloads a JSON file of your garage entries. Use this to move your collection to another device or keep a local copy. Does not include the current unsaved tune.

> Loads garage entries from a backup file — older backups from before the garage was unified are read too. Pick which kinds to restore: each row says how many the file holds and how many of yours it replaces, and the summary gives the net. A replaced entry is gone — the garage is outside undo — so RESTORE takes two taps. Does not affect the current unsaved tune.
