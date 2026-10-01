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
- **Hints are short; the depth is in the glossary.** A hint says what the control
  is and which way it pushes, then ends with a `TERMS: … ›` link to its `GLOSSARY`
  entry (the `term` / `hintTerm` prop, or a `TermLink` after a tip or footer). The
  link's label is rendered from the glossary, so it is not hint text and is not
  quoted here.
- **What's not.** Warnings and status messages the app raises about a tune (an
  unreachable target, a clamp, a game limit) are output, not guidance. The TERMS
  glossary itself lives in `GLOSSARY` and has its own modal. Tutorial text is in
  [TUTORIALS.md](TUTORIALS.md#step-text).
- **Format.** Each entry names the control, then gives its text as a `>` quote. Only
  UI text goes in quotes. `{…}` stands for a value filled in live. A hint that
  changes with layout, tier, game mode or another control's setting gets one quote
  per variant, each labelled. A sentence that's only added under some condition is
  quoted on its own after the base text.
- **Game mode.** "Forza" means a clicks-based game mode, "BeamNG" a physical-unit
  one (`physMode`: N/m and N/m/s output). The results panel renders one card set or
  the other, never both, so each card's text carries no branch for the other mode.
- **Copied exactly, typos and all.** A wording bug is quoted as the app shows it,
  and recorded in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) until it's fixed.

---

## BEG panel

The BEG sidebar's flat panel. Layout and Build share their text with the INT/PRO
controls through `HINT_LAYOUT` and `HINT_BUILD_TYPE`, so the two tiers can't drift
apart.

**Layout** (also CHASSIS, INT/PRO):

> Which wheels the engine drives. It changes the differential and alignment recommendations.

**Build** (also Build Type in BUILD, INT/PRO):

> The car's intended use. It shifts the alignment, differential and brake recommendations.

**Weight:**

> Total vehicle weight. Find this on the car's stat page.

**Front Weight Bias:**

> Share of weight on the front axle, from the car selection screen. 50% = an even split.

**Ride Stiffness:**

> How stiff the suspension feels: SOFT = comfortable, ROAD = balanced, FIRM = sporty, RACE = stiff competition setup.

**Balance:**

> Shifts handling balance. Right (OVERSTEER) = more rotation, freer rear end; left (UNDERSTEER) = more stability. Start at centre for most builds.

**Character:**

> Damping feel. STABLE (left) = more damping, settles quickly, predictable; AGILE (right) = lighter, livelier, quicker direction changes. Start at centre.

---

## CHASSIS

Layout uses `HINT_LAYOUT`, quoted under [BEG panel](#beg-panel).

In PRO the section is split by where each value comes from, under three `SrcHead`
group headers: **FROM THE GAME** (*stat, selection & upgrade screens*) — Layout,
Weight, Front Weight Bias, TYRE SIZE, CG Height Source with Ride Height, and MEASURE
NAT BAL; **LOOK UP ONLINE** (*not shown in game · car's spec sheet*) — Wheelbase and
Track Width; **ESTIMATES** (*not shown anywhere · typical values*), shown only when it
has something in it — a MANUAL CG Height and BeamNG's motion ratios. Below PRO every
input is in-game and there are no headers. With MANUAL CG in PRO, the CG source block
reads *CG Height is entered under ESTIMATES below ↓*.

**Weight:**

> Total vehicle weight, from the car's stat page. Scales the spring, damper and ARB outputs.

**Front Weight Bias:**

> Share of weight on the front axle, from the car selection screen. 50% = an even split; most front-engined cars are 52–58%.

**TYRE SIZE** (INT and PRO; the text differs by tier, since GRIP BIAS is PRO-only):

> Sidewall size, e.g. 265/35R18, from the upgrade screen. Its radius feeds the RIDE HEIGHT CG estimate below.

> Sidewall size, e.g. 265/35R18. Wider = more grip at that end: it moves GRIP BIAS, not roll stiffness.

**MEASURE NAT BAL** (PRO; last item under FROM THE GAME):

> Reads natural balance from the game instead of predicting it from the track widths below, which it then hides. Opens Tune Check's MEASURE step; the reading shows here and ✕ clears it.

**Wheelbase** (PRO):

> Axle-to-axle distance. Forza doesn't show it: look it up in the car's spec sheet online. Typical cars run 2400–2900 mm. Still used when a MEASURE NAT BAL reading replaces the track widths.

**Track Width F / Track Width R** (PRO; while a measured natural balance is in use they are replaced by *Track widths not needed: the MEASURE NAT BAL reading above replaces them.*):

> Distance between left and right wheels at the front. Forza doesn't show it: look it up online, or skip it with MEASURE NAT BAL. Typical: 1400–1800 mm. Wider = more roll resistance.

> Distance between left and right wheels at the rear. Forza doesn't show it: look it up online, or skip it with MEASURE NAT BAL. Typical: 1400–1800 mm, often slightly wider than the front. Wider = more roll resistance.

**Motion Ratio F / R** (PRO, BeamNG) — `{side}` is front or rear:

> How far the {side} spring and damper move per unit of wheel travel; 1.0 = direct-acting. Lower raises the output rates. Leave at 1.0 unless you know the geometry.

**ARB Motion Ratio F / R** (PRO, BeamNG):

> Length of the {side} anti-roll bar's arm as a fraction of track; a typical inboard link is 0.4–0.5. Lower raises the printed ARB rate only, not the solve.

**CG Height Source:**

> RIDE HEIGHT estimates CG height from Forza's ride heights plus tyre radius. MANUAL lets you type CG height if you have a better source.

**Ride Height F / Ride Height R** (RIDE HEIGHT source) — `{unit}` is the length unit:

> Front ride height as shown on the car's stat/tuning screen in Forza ({unit}). Feeds the CG estimate and bottoming risk.

> Rear ride height as shown on the car's stat/tuning screen in Forza ({unit}).

**CG Height** (MANUAL source):

> The game doesn't show CG height: use about 400–460 mm for sports cars, 480–550 for sedans, 580–700 for SUVs. Higher = more roll and load transfer.

---

## DRIVETRAIN

**DIFF TYPE** (INT/PRO):

> Match the diff fitted to the car: the same lock % locks harder on RACE or DRIFT than on RALLY or OFFROAD. SPORT is accel-only, so its decel controls hide.

**Differential Mode** (PRO):

> AUTO (default) works out every lock from your car and the sliders below. MANUAL has you type each lock % directly.

### AUTO sliders

**FRONT AXLE → EXIT** (AWD, INT/PRO):

> Front accel lock. Toward PUSH = more front pull and exit understeer; useful on AWD cars with strong rear rotation.

**MATCH CHASSIS** (PRO):

> Off by default. On, it biases the auto diff by how far your Mech Balance Target sits from natural: toward oversteer adds rotation, toward understeer stability. Needs MECH, CO-SOLVE or Hz MECH; not MANUAL.

**EXIT** — FWD, RWD, then AWD (the rear axle's EXIT):

> Front accel lock. GRIP = more lock: exit traction, but more push. ROTATE = less lock, less understeer.

> Rear accel lock. ROTATE = more lock, more power oversteer on exit. GRIP = less lock, cleaner exit traction.

> Rear accel lock. ROTATE = more lock, more exit oversteer. GRIP = less lock, more traction.

Added while MATCH CHASSIS is on — in PRO, then in INT (where the toggle is not shown). Leaving
PRO turns MATCH CHASSIS off, so the INT sentence is reached only by a share code or garage load
that carries it in below PRO. Either way the bias applies only while something solves toward the
Balance Target (`hasBalTargetSolve`), as the MATCH CHASSIS hint above says, and the button is
dimmed while it doesn't:

> MATCH CHASSIS is on and adds a bias from your mech target.

> A PRO-only diff setting is also biasing this; switch to PRO to turn it off.

**MANUAL diff below PRO** — a note under the diff controls, in place of the AUTO sliders, when a
share code or garage load brings a MANUAL diff in at BEG or INT. It reads "This tune's diff locks
were typed in MANUAL, a PRO-only mode:", then the locks in use (accel and decel, or front, rear and
center split on AWD; decel left out on a Sport diff), then:

> Switch to PRO to edit them or return to AUTO.

**ENTRY** (not on a Sport diff) — FWD, RWD, then AWD:

> Front decel lock. STABLE = more lock, more entry understeer. LOOSE = less lock, freer corner entry.

> Rear decel lock. STABLE = more lock, resists lift-off oversteer. LOOSE = less lock, freer rotation on entry.

> Rear decel lock. STABLE = more lock, resists lift-off oversteer. LOOSE = less lock, more rear rotation on entry.

Added while MATCH CHASSIS is on — in PRO, then in INT (the same INT sentence as EXIT's):

> MATCH CHASSIS is on and adds half its bias here.

**POWER SPLIT** (AWD):

> Share of drive sent to the rear. Toward REAR = more oversteer tendency; 60–70% rear is typical for track.

### MANUAL fields (PRO)

Every lock field (not Center Split) shows the selected diff type's typical range on a
line of its own underneath (`RangeHint`); AWD Front Decel's always reads 0–0:

> typical: {lo}–{hi}%

AWD, **Front Accel / Front Decel / Rear Accel / Rear Decel / Center Split:**

> Front lock under power. Higher = more front pull on exit, but more understeer.

> Front lock off throttle. Keep it at 0: any more strongly adds entry understeer.

> Rear lock under power. Higher = more exit oversteer.

> Rear lock off throttle. Lower = more entry rotation (and lift-off oversteer); higher = a more stable entry.

> Share of drive sent to the rear. Higher = more oversteer; 60–70% is typical for track.

RWD / FWD, **Accel Lock** — RWD uses the AWD Rear Accel text above; FWD:

> Front lock under power. Higher = more exit understeer.

RWD / FWD, **Decel Lock** (not on a Sport diff) — RWD uses the AWD Rear Decel text above;
FWD:

> Front lock off throttle. Lower = less entry understeer.

---

## BUILD

Build Type uses `HINT_BUILD_TYPE`, quoted under [BEG panel](#beg-panel).

---

## BRAKES (INT+)

**Brake Bias** — `{recommended}` is `recBrakeBias`:

> Shifts the recommended brake bias ({recommended}% front). ROTATE moves it rearward for more rotation on the brakes; STABLE forward for a steadier entry. Stays within 45-68%.

---

## BALANCE (PRO)

**Balance Target** (the target-mode toggle):

> What the target is measured from: NATURAL = offset from natural balance, RANGE = from the RANGE middle, GRIP = from GRIP TARGET, MANUAL = a raw value (e.g. 0.60).

**Mech Balance Target** — NATURAL, then MANUAL:

> Offset from natural balance: 0 = natural, positive = more rear bias (oversteer), negative = more front (understeer). The BALANCE GUIDE's RANGE is the recommended band.

> The raw Mech Balance to solve toward, e.g. 0.60; it stays put when the chassis changes. Above 0.50 = oversteer tendency, below = understeer.

**Balance Offset** — RANGE, then GRIP:

> Offset from the middle of the RANGE band: 0 = middle, positive = more rear bias (oversteer), negative = more front (understeer).

> Offset from GRIP TARGET: 0 cancels the chassis's grip tendency, positive = more rear bias (oversteer), negative = more front (understeer).

**BALANCE GUIDE**, and its rows NATURAL, GRIP BIAS, GRIP TARGET, RANGE and the
target row:

> Compares your suspension's mech balance to the chassis's natural, uncorrected balance. Tap each row's ⓘ for details.

> The chassis's own mech balance before any spring or ARB correction: predicted from geometry, or your MEASURE NAT BAL reading.

> At-limit grip balance at the natural point. Below 0.5 the front lets go first (understeer-prone); above, the rear does (oversteer-prone).

> The mech balance at which the grip model reads neutral for this chassis: what GRIP mode targets at a 0 offset.

> Recommended target band for your layout and build, set from NATURAL toward GRIP TARGET. RANGE mode aims at its middle.

> TARGET when MECH or CO-SOLVE ARB Balance Mode, or Hz MODE MECH, solves toward it; otherwise CURRENT, your car's achieved balance. Δ is its distance from natural.

MEASURE NAT BAL sits in CHASSIS (see above), not here.

---

## ANTI-ROLL BARS

**Stiffness Mode** — the base text, then the BASIC sentence (Forza only), then the
rest; `{unit}` is "clicks" on Forza and, on BeamNG:

> rates in N/m

> Total ARB stiffness. AUTO: from the car's roll tendency.

> BASIC: a direct level.

> ROLL °: a target roll angle. SHARE %: a fraction of roll stiffness. MAN: {unit} entered directly, so Balance Mode hides.

**ARB Stiffness** (BASIC, Forza) — `{limit}` is the game mode's ARB click limit:

> Overall ARB level: roughly 1 click at 0% to {limit} clicks (this game mode's limit) at 100%, per axle at an even split. Unlike SHARE %, it doesn't follow spring rate.

**Target Roll Angle** (ROLL °):

> Body roll the bars are solved to allow. Low (≈0.5–1°) = stiff bars, flat cornering. High (≈3–5°) = soft bars, so the suspension articulates over terrain.

**ARB Share** (SHARE %):

> ARBs' share of total roll stiffness. 0% = springs only; 20–30% is typical sport. Higher = stiffer bars relative to springs, more abrupt load transfer.

**ARB F / ARB R** (MAN) — `{side}` is Front or Rear; BeamNG, then Forza:

> {side} Anti-Roll Spring Rate in N/m, as BeamNG's slider shows it. No ceiling; track width and ARB Motion Ratio move this number.

> {side} ARB clicks, entered directly. This game mode's limit is {limit} clicks per axle.

**Balance Mode** (INT/PRO, not in MAN) — the base text, then the sentence PRO adds:

> Splits the bars front/rear. WEIGHT: by weight. NEUTRAL: from the springs (CANCEL offsets them, EQUAL ROLL matches them).

> CHASSIS: by natural balance. MECH, CO-SOLVE: solve to the Mech Balance Target.

**Split Direction** (WEIGHT / CHASSIS):

> SAME (default) follows the reference balance: a front-heavy car gets a front-heavy ARB split. OPPOSITE mirrors it around 50/50 so the bars counteract that tendency.

**Neutral Method** (NEUTRAL):

> CANCEL (default) splits the bars against the springs so the balance bar returns to neutral. EQUAL ROLL splits them in the springs' own proportion, adding stiffness without moving the springs' balance.

**Spring Share** (CO-SOLVE):

> How much of the balance correction comes from rear springs vs the ARB split. AUTO (default) is right for most builds; turn it off to set by hand.

**ARB Bias** — NEUTRAL with EQUAL ROLL, NEUTRAL with CANCEL, CHASSIS, then WEIGHT:

> Moves the ARB split off the springs' own proportion; centre leaves their balance untouched. FRONT HEAVY = stiffer front bar (more understeer). REAR HEAVY = stiffer rear bar (more oversteer).

> Moves the ARB split off the point that cancels the springs; centre cancels their bias. FRONT HEAVY = stiffer front bar (more understeer). REAR HEAVY = stiffer rear bar (more oversteer).

> Moves the ARB split off the car's calibrated natural balance, which centre matches. FRONT HEAVY = stiffer front bar (more understeer). REAR HEAVY = stiffer rear bar (more oversteer).

> Moves the ARB split off the car's weight balance, which centre matches. FRONT HEAVY = stiffer front bar (more understeer). REAR HEAVY = stiffer rear bar (more oversteer).

---

## RIDE

**RIDE REF.:**

> Which axle the stiffness slider sets. FRONT or REAR: that axle, the other is derived. SHARED: the average, with the mode below setting the ratio. Switching never changes the actual Hz.

**STIFFNESS** (with RIDE HEIGHT → CG on):

> What the stiffness slider below sets. HZ: spring frequency. BOTTOM G's: the vertical load at which the RIDE REF. axle bottoms out. Shown only with RIDE HEIGHT → CG on (CHASSIS section).

**Front / Rear / Avg Bottom-Out** (BOTTOM G's) — `{axle}` is front, rear or average,
following RIDE REF.:

> Vertical load, in g, at which the {axle} axle bottoms out, from static ride height and 1g sag. Saved with the build; Hz re-solves to hold it.

**Ride / Rear / Avg Stiffness** (HZ) — RIDE REF. REAR, SHARED, then FRONT:

> Rear spring frequency, the reference; the mode below derives the front. Typical: 1.0–1.8 Hz street, 1.8–2.6 Hz track.

> Average of front and rear spring frequency; both axles move together while the mode below holds the ratio.

> Front spring frequency, the reference; the mode below derives the rear. Typical: 1.0–1.8 Hz street, 1.8–2.6 Hz track.

**Hz MODE** — the base text, then the sentence PRO adds:

> Derives the other axle's Hz. MULTIPLIER: fixed ratio. FLAT RIDE: less pitch bounce at Target Speed. INDEPENDENT: by hand. SHARED: same bottom-out g.

> MECH: from Mech Balance Target. Hidden in CO-SOLVE.

**Target Speed** (FLAT RIDE) — RIDE REF. SHARED, REAR, then FRONT:

> Sets how the Avg Stiffness is split front/rear using flat-ride timing; the average stays put.

> Speed at which front and rear hit bumps in phase. Right (CITY) = lower speed, softer front. Left (OFF) = disabled, equal front and rear Hz.

> Speed at which front and rear hit bumps in phase. Right (CITY) = lower speed, stiffer rear. Left (OFF) = disabled, equal front and rear Hz.

**Rear Multiplier / Front Multiplier / F/R Ratio** (MULTIPLIER) — SHARED, REAR, then
FRONT:

> Rear-to-front Hz ratio; shifts stiffness between axles while Avg Stiffness holds the average.

> Front Hz as a fraction of rear Hz. ÷1.20 = front is 83% of rear Hz.

> Rear Hz as a multiple of front Hz. ×1.00 = matched; ×1.20 is a typical start. Higher leans toward oversteer.

**Front Hz / Rear Hz** (INDEPENDENT) — RIDE REF. REAR, then FRONT:

> Front spring frequency, set by hand; the stiffness slider above still sets the rear.

> Rear spring frequency, set by hand; the stiffness slider above still sets the front.

---

## DAMPERS

**REBOUND MODE** (INT/PRO) — SETTLE TIME, then CHARACTER:

> SETTLE TIME: set a target settle time and the app back-solves the rebound ζ that hits it on the ride-reference axle. DAMPING BALANCE MODE below sets how the other axle follows.

> CHARACTER: type rebound ζ directly on the slider below; nothing is back-solved.

**Settle Target** (SETTLE TIME):

> Target settle time after a bump; the app back-solves the rebound ζ that hits it. Lower = tighter, more controlled. Higher = softer, more comfortable. Damping Bias skews the F/R timing.

**Rebound ζ** (CHARACTER):

> Damping ratio for the rebound (extension) stroke. 55–70% is typical; 70% (default) is Butterworth. Above 70% feels planted but stiff; above 100% (overdamped) sluggish.

**BUMP MODE** — INDEPENDENT, then BUMP RATIO:

> INDEPENDENT: set bump ζ directly, decoupled from rebound, e.g. soft bump with firm rebound.

> BUMP RATIO: set bump damping as a percentage of rebound ζ, so the two strokes stay linked.

**Bump Ratio:**

> Bump damping as a percentage of rebound. Lower = softer over sharp hits, more compliant on rough roads; higher = more consistent between strokes. 40–65% is typical.

**Bump ζ:**

> Bump damping ratio set directly, independent of rebound. Keep it below rebound for normal handling; Damping Balance Mode splits it front/rear like rebound.

**DAMPING BALANCE MODE:**

> How the anchor ζ becomes a front/rear split. STANDARD: bias by percentage. TIME SYNC: equal settle time. EQUAL FORCE: equal damping force. HYBRID: halfway between those two.

**Damping Bias** — TIME SYNC, HYBRID, EQUAL FORCE, then STANDARD. `{anchor}` is "the
Settle Target" under SETTLE TIME and "Rebound ζ" under CHARACTER:

> TIME SYNC: skews settle time front/rear; centre = equal settle time (anchored to {anchor}). Left (FRONT) makes the front settle faster, right (REAR) the rear.

> HYBRID: centre sits halfway between TIME SYNC and EQUAL FORCE (anchored to {anchor}). Left (FRONT) firms the front, right (REAR) the rear.

> EQUAL FORCE: skews actual damping force front/rear; centre = equal force (anchored to {anchor}). Left (FRONT) shifts force to the front, right (REAR) to the rear.

> Your Ride Reference axle holds the base ζ (anchored to {anchor}); the other swings up to 50% at ±50 (SHARED: both share it). Firmer front leans understeer, firmer rear oversteer.

---

## ALIGNMENT (PRO)

**ALIGNMENT MODE:**

> AUTO: camber, toe and caster recommended from build type, layout, weight bias, ride Hz and roll, optionally nudged (below). MANUAL: type exact values.

**Nudge** (AUTO):

> OFF: AUTO values unchanged. MECH: nudges camber and toe toward your Mech Balance Target's understeer/oversteer intent. GRIP: counters the chassis's own grip tendency. Caster is never nudged.

**Nudge Strength:**

> How far MECH or GRIP moves camber and toe from the AUTO values: 0% = pure AUTO, 100% = full nudge. Caster is never adjusted.

**Camber F / Camber R / Toe F / Toe R / Caster** (MANUAL):

> Front static camber. Negative = top of the tyre leans inward.

> Rear static camber. Negative = top of the tyre leans inward.

> Front toe. Negative = toe-out, positive = toe-in.

> Rear toe. Positive = toe-in.

> Caster angle. More = stronger self-centring and heavier steering.

---

## VISUALS

What each chart draws is explained in [VISUALS.md](VISUALS.md); this is only what
their ⓘ says.

**ROLL SPLIT:**

> The car's front/rear share of roll stiffness: solid = springs, light = ARBs, grey tick = natural balance. Divide right of grey = more front stiffness (toward understeer), left = toward oversteer.

**RIDE Hz** — `{min}`–`{max}` is the Hz band (`HZ_MIN`–`HZ_MAX`):

> Front and rear ride frequency on one SOFT→RACE scale ({min}–{max} Hz). Amber = an axle's Hz hit a limit.

**ARB** — BeamNG, then Forza:

> Front and rear bar stiffness in N/m on one shared scale. BeamNG has no ceiling, so there are no warning bands.

> Front and rear ARB clicks from 0 to the game's ceiling. Bands mark 50 / 75 / 90% of it; a dot turns amber past 88%.

**DAMPING ζ:**

> Rebound (filled dot) and bump (hollow dot) damping ratio per axle, 10–200%. Bump normally sits below rebound; the bar turns amber if it crosses above.

**DYNAMICS:**

> Each axle settling back to ride height after one bump. Strip = ±10% of the initial displacement; dashed line = settle time (last exit from the strip); ring = first ride-height crossing.

**SAG vs LOAD** (RIDE HEIGHT → CG on):

> Solid line = sag vs vertical load; dashed = ride height, and where they meet is the g that bottoms that axle. Short-dashed = outside wheel when cornering. Real springs stiffen near the top.

---

## Results panel — Forza cards

These six cards only render in Forza game modes (the `!physMode` block); BeamNG gets
the cards in the next section.

**ALIGNMENT** — the first sentence depends on the alignment mode (MANUAL, then any
other), the rest on layout (FWD, then RWD and AWD). `{camber}` is the build type's
camber target and `{roll}` the tune's roll angle:

> Manual values.

> Recommended starting point.

> Camber targets {camber} dynamic. FWD front camber reduced for traction. Leans to toe-in for stability.

> Camber targets {camber} dynamic at {roll}° roll. Front leans toe-out on TRACK/DRIFT; rear toe-in except on DRAG.

**ANTI-ROLL BARS:**

> Click values to enter in the game's ARB menu. Amber means above 88% of the game's limit.

**SPRINGS:**

> Spring rates in the spring unit chosen in UNITS to enter in the tuning menu. Badge = stiffness band (SOFT/ROAD/FIRM/RACE); REAR × = rear Hz ÷ front Hz.

**DAMPERS:**

> Rebound and bump click values for the game's damping menu. Amber means above 88% of the game's limit. F/R BIAS = front share of damping: 50% is balanced, above is front-biased.

**BRAKES** (the same text on the Forza and BeamNG cards):

> Brake balance starting point. Higher front bias adds entry understeer; lower adds rotation. Fine-tune in 1% steps by feel.

**DIFFERENTIAL** — FWD, RWD, then AWD (`{rear %}` is the centre split):

> Starting point; fine-tune in 1% steps. More accel lock adds exit traction and understeer. Decel near zero frees entry rotation.

> Starting point; fine-tune in 1% steps. More accel lock adds exit rotation. Low decel helps entry rotation; raise it for lift-off stability.

> Starting point; fine-tune in 1% steps. Front decel at 0 minimises entry understeer; keep rear decel low for rotation. Center {rear %}% rear.

## Results panel — BeamNG cards

**FRONT / REAR SUSPENSION:**

> Values in BeamNG's own units: N/m for Anti-Roll and Spring, N/m/s for the dampers. Anti-Roll reads soft; see the note under that row.

The note under the Anti-Roll row, shown while both ARB Motion Ratios are 1.0 — PRO, then
BEG/INT (which have no ARB Motion Ratio field):

> Reads ~4–6× soft at ARB Motion Ratio 1.0. Set the ratio in CHASSIS (arm ÷ track, typically 0.4–0.5) if you know the geometry.

> Reads ~4–6× soft: BeamNG rates the bar at its own lever, so treat it as a direction.

**FRONT / REAR ALIGNMENT** — the Forza ALIGNMENT text above (as `{forza text}`), then:

> {forza text} Sliders are %, not degrees: match BeamNG's live readout.

**BRAKES:** as on the Forza card above.

**LOAD TRANSFER** (PRO):

> Loads at 1 g cornering from the balance model, so springs and bars move them. FRONT TAKES is the front axle's share of the transfer; above the weight split leans understeer.

When an inside wheel lifts — `{end}` is front or rear:

> The {end} inside wheel unloads before 1 g: past that point more roll stiffness on that end stops shifting balance.

When both do:

> Both inside wheels unload before 1 g: past that point more roll stiffness on that end stops shifting balance.

**GRIP USE** (PRO):

> Each axle's share of its grip in use when the car reaches its limit: the first to 100% sets understeer or oversteer. Predicted by the balance model, so it needs no laps.

The verdict under the sketch — `{where}` is mid-corner, on the brakes, or under power:

> Both axles run out together: balanced at the limit {where}.

> The front runs out first: understeer at the limit {where}.

> The rear runs out first: oversteer at the limit {where}.

On ENTRY and EXIT:

> Includes the car's own weight transfer, which the bar's ENTRY / EXIT figures leave out, so the two can differ.

---

## Handling Balance bar

### Header and compact bar

**HANDLING BALANCE** — PRO, then BEG/INT:

> Mid-corner grip margin: how much more grip the front has left than the rear. + = the rear gives up first (oversteer), − = the front does (understeer); within ±1% is NEUTRAL. Tap for ENTRY and EXIT.

> NET: the car's own lean plus springs and bars. + = oversteer, − = understeer. Brakes, diff and damping show as ENTRY / EXIT lanes. Tap for the breakdown and a tip.

**FIT?** badge (PRO, only while a figure is outside the fitted set). Its hint takes one
of three forms. Only extrapolated (soft) flags — with one flag its detail, with more
their tags:

> Extrapolated, not wrong: {detail or tags}.

Only the hard flag (CG), with its detail:

> Outside the balance model's valid range: {details}.

The hard flag plus soft ones — the hard detail, capitalised, then the soft tags:

> {details}. Also extrapolated: {tags}.

The details, from `balanceEnvelope` — tags HZ, MASS, TYRE, LIFT, then CG (the only
hard one):

> spring frequencies {F}/{R} Hz vs the fitted {lo}-{hi} Hz

> corner masses {F}/{R} kg vs the fitted {lo}-{hi} kg

> section widths {F}/{R} mm vs the sampled {lo}-{hi} mm

> at 1 g lateral the {wheels} unload completely, so more bar or spring on that end will not move the balance

where `{wheels}` is one of:

> inside wheels of both axles

> inside wheel

(the last preceded by "front" or "rear"), and:

> the ride-height CG estimate ({mm} mm) is outside the {lo}-{hi} mm CG Height range, so it is clamped and ride-height edits no longer move CG

**MECH** readout (PRO):

> Rear share of roll stiffness as Forza shows it (0.50 = even). The delta is from natural balance: blue = more rear-biased, amber = more front-biased.

**Segment legend** — PRO, then BEG, then INT:

> CAR (grey): the car's own MID lean. SPR and ARB stack from it to NET (white), the MID margin. Lanes stack brakes and drive off NET; arrows are diff and damping. TOTAL (pink) adds the sized ones.

> CAR (grey): the car's own lean. SPR and ARB stack from it to NET (white), the headline. Brakes, diff and damping are listed in the breakdown.

> CAR (grey): the car's own lean. SPR and ARB stack from it to NET (white), the headline. ENTRY / EXIT lanes stack brakes, diff and damping off NET.

**ENTRY · MID · EXIT** line (PRO) — `{entry g}` and `{exit g}` are `ENTRY_G` and `EXIT_G`:

> ENTRY is MID plus brake bias at {entry g} g braking; EXIT is MID plus the drive split at {exit g} g of drive. An arrow shows which way diff lock pushes, not how far.

### Expanded panel — BEG / INT

**Correction tip.** Shown at the top, followed by a TERMS link. Under 3 points either way:

> Setup is well balanced.

plus, when a tuning row is still large (`{NAME}` is the largest one in capitals; CHASSIS is
never named here, since nothing in the tune moves it):

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

> The car itself leans toward oversteer before any tuning. Move the balance toward the front to counter it.

> The car itself leans toward understeer before any tuning. Move the balance toward the rear to counter it.

SPRINGS — BEG (two lines), then INT:

> The rear springs are stiff for the weight they carry. {BEG balance}

> The front springs are stiff for the weight they carry. {BEG balance}

> Rear springs are stiff for their load. Lower the rear Hz relative to the front (RIDE multiplier), or move ARB Bias toward FRONT HEAVY.

> Front springs are stiff for their load. Raise the rear Hz relative to the front (RIDE multiplier), or move ARB Bias toward REAR HEAVY.

ARB — BEG, then INT:

> The rear bar carries more than its share. {BEG balance}

> The front bar carries more than its share. {BEG balance}

> Move ARB Bias toward FRONT HEAVY (in MAN, raise ARB F relative to ARB R).

> Move ARB Bias toward REAR HEAVY (in MAN, raise ARB R relative to ARB F).

DIFF rows in BEG, which has no diff sliders:

> At BEG the diff lock is set by Build and Layout, not tuned directly.

DIFF EXIT, DIFF ENTRY, DIFF F, DIFF R (INT):

> Move EXIT toward GRIP — less lock on throttle calms exit rotation.

> Move EXIT toward ROTATE to add rotation under power.

> Move ENTRY toward STABLE — more decel lock resists lift-off rotation.

> Move ENTRY toward LOOSE to allow freer rotation on entry.

> Move the FRONT AXLE EXIT toward PUSH — more front lock pulls the nose out of the corner.

> Move the FRONT AXLE EXIT toward NEUTRAL to free the front on throttle.

> Move the REAR AXLE EXIT toward GRIP, or ENTRY toward STABLE.

> Move the REAR AXLE EXIT toward ROTATE to add rotation under power.

BRAKES — by the sign of the brake contributor, oversteer then understeer; BEG, then INT:

> The BRAKES card's brake bias sits below 50% front, which this bar reads as oversteer. It is computed for this car, not a setting to chase.

> The BRAKES card's brake bias sits above 50% front, which this bar reads as understeer. It is computed for this car, not a setting to chase.

> Brake bias sits below 50% front, which this bar reads as oversteer. Brake Bias toward STABLE steadies entry; set it by feel, not to zero this row.

> Brake bias sits above 50% front, which this bar reads as understeer. Brake Bias toward ROTATE frees entry; set it by feel, not to zero this row.

DAMP (INT; BEG uses its balance line):

> Move Damping Bias toward FRONT — firmer front damping resists weight transfer off the front.

> Move Damping Bias toward REAR to let the front take weight more freely.

**Contributor rows** — CAR STARTS (the CHASSIS term, drawn as a tick), then SPRINGS, ARB
(MID · MAKES NET), then DIFF F, DIFF R (AWD), DIFF EXIT and DIFF ENTRY (FWD, then RWD), BRAKES,
DAMP (ENTRY / EXIT · NOT IN NET):

> Where the car sits before any tuning: its own lean at the limit from tyres, track widths, CG and weight split. The rows below move it from here.

> The front/rear spring split compared with the weight split. + = rear springs relatively stiffer (toward oversteer), − = front stiffer (toward understeer).

> The front/rear anti-roll bar split compared with the weight split. + = rear bars relatively stiffer (toward oversteer), − = front stiffer (toward understeer).

> Front diff lock, on and off throttle combined. More front lock = toward understeer (−).

> Rear diff lock, on and off throttle combined. On-throttle lock pushes toward oversteer (+), off-throttle lock toward understeer (−).

> Front accel lock on-throttle exit. Higher lock = more understeer (−).

> Rear accel lock on-throttle exit. Higher lock = more oversteer (+).

> Front decel lock off-throttle entry. Higher lock = more entry understeer (−).

> Rear decel lock off-throttle entry. Higher lock resists lift-off oversteer, pushing understeer (−).

> The computed brake bias measured against 50/50. Above 50% front reads as entry understeer (−), below as oversteer (+).

> The front/rear damping split. Firmer front = toward understeer (−), firmer rear = toward oversteer (+).

**Footer**, under the rows:

> Alignment is not counted, though it also affects balance.

### Expanded panel — PRO

**Phase tips.** One line per phase whose margin is at least ±1% (`PHASE_NEUTRAL`), or,
when none is:

> Balanced through every phase the model reads.

MID — by the dominant contributor (chassis, springs, bars), oversteer then understeer:

> Mid-corner: the chassis itself leans toward oversteer. Counter it with more front roll stiffness, or narrow a front-favouring tyre stagger.

> Mid-corner: the chassis itself leans toward understeer. Counter it with more rear roll stiffness, or narrow a rear-favouring tyre stagger.

> Mid-corner oversteer, mostly from the springs. Lower the Mech Balance Target, or use CO-SOLVE.

> Mid-corner understeer, mostly from the springs. Raise the Mech Balance Target, or use CO-SOLVE.

> Mid-corner oversteer, mostly from the bars. Lower the Mech Balance Target or move ARB Bias toward the front.

> Mid-corner understeer, mostly from the bars. Raise the Mech Balance Target or move ARB Bias toward the rear.

ENTRY — `{bias}` is the recommended brake bias, `{ideal}` the entry-load split:

> Entry: brake bias {bias}% sits behind the entry-load ideal (≈{ideal}%), so the rear brakes more than its share.

> Entry: brake bias {bias}% sits forward of the entry-load ideal (≈{ideal}%). The BRAKES card counts more weight transfer, so it usually reads this way.

EXIT — AWD, then RWD and FWD:

> Exit: the centre diff sends the rear more than its share of drive. Shift it toward the front to settle power-on oversteer.

> Exit: the centre diff sends the front more than its share of drive. Shift it toward the rear for more rotation under power.

> Exit: rear drive takes lateral grip from the rear under power. Only throttle and exit diff lock manage it.

> Exit: front drive takes lateral grip from the front under power. Only throttle and exit diff lock manage it.

**Phase rows** — MID: CAR STARTS (a tick), SPRINGS, ARB; ENTRY: BRAKES, PITCH; EXIT: DRIVE (CENTRE
on AWD), PITCH; then the direction-only rows DIFF ENTRY, DIFF EXIT and TRANSIENT's DAMP.
`{entry g}` / `{exit g}` as above; `{ideal front %}` and `{ideal rear %}` are this car's
load-proportional splits:

> Where the car sits mid-corner before any tuning: its own lean at the weight-matched stiffness split. SPRINGS and ARB move it from here.

> How far the springs move the MID margin from where the car starts, by shifting the roll-stiffness split.

> How far the anti-roll bars move the MID margin from where the car starts, by shifting the roll-stiffness split.

> Brake bias vs the entry-load ideal at {entry g} g braking ({ideal front %}% front on this car). + = the rear brakes more than its share (toward oversteer).

> Load moving forward at {entry g} g braking adds front grip and takes rear grip. Not tunable, so it is left out of the ENTRY figure.

> The drive split vs the load-proportional one at {exit g} g of drive ({ideal rear %}% rear on this car). + = the rear carries more than its share (toward oversteer).

> Load moving rearward at {exit g} g of drive. Not tunable, so it is left out of the EXIT figure.

> Off-throttle lock resists the car rotating on entry. Direction only: nothing has calibrated how much.

> On-throttle lock: whether it pushes the car wide or rotates it depends on the layout. Direction only.

> Front vs rear damping. It acts only while load is moving, so it shows a direction only.

**Footer**, under the rows — `{grip bias}` is GRIP BIAS on its 0–1 scale:

> Grip margin: + = the rear gives up first. GRIP BIAS {grip bias} is the same model on its 0–1 scale; alignment is not counted.

**MECH BALANCE** strip:

> Mech balance as the game shows it: the rear share of roll stiffness. NAT = natural, CUR = your setup, TGT = the target while something solves toward one. Balance Target offsets count from NAT.

### RESPONSE

**RESPONSE** bar:

> How quickly the car reacts to steering. PLANTED (left) is settled and predictable; REACTIVE (right) turns in at once but can feel nervous. Separate from understeer / oversteer.

**Tip** — within ±15 of centre:

> Transient response is balanced.

plus, when one factor is still large (`{factor}` is its row label):

> {factor} is the primary character driver.

Otherwise the dominant factor's tip below; with no dominant factor, "Setup is near
balanced.", and for a factor without a tip, "Adjust the dominant factor.":

> Setup is near balanced.

> Adjust the dominant factor.

Factor tips, each as a toward-PLANTED / toward-REACTIVE pair. The first of each pair
shows when the car reads REACTIVE. BEG points at its own sliders — Hz F, DAMP F, Hz R,
DAMP R:

> Lower Ride Stiffness for a more planted entry feel.

> Raise Ride Stiffness to sharpen initial turn-in response.

> Move Character toward STABLE to settle entry more firmly.

> Move Character toward AGILE to free up initial roll response.

> Lower Ride Stiffness to reduce rotation tendency.

> Raise Ride Stiffness for quicker rear body control.

> Move Character toward STABLE to plant the rear more firmly.

> Move Character toward AGILE for more rotation freedom.

INT and PRO — Hz F, DAMP F, Hz R, DAMP R:

> Soften front springs (lower Hz) for a more planted entry feel.

> Stiffen front springs to sharpen initial turn-in response.

> Increase front rebound damping to settle entry more firmly.

> Reduce front rebound damping to free up initial roll response.

> Soften rear springs (lower Hz) to reduce rotation tendency.

> Stiffen rear springs to improve rear body control and rotation speed.

> Increase rear rebound damping to plant the rear more firmly.

> Reduce rear rebound damping for more rotation freedom.

TOE F and CASTER — PRO:

> Add front toe-in to improve straight-line stability.

> Reduce front toe-in to sharpen turn-in response.

> Increase caster for stronger self-centering and stability.

> Reduce caster for lighter, quicker steering response.

and in BEG and INT, which have no alignment controls, for either:

> Alignment has no control at this tier; this factor is for reference.

**Factor rows** — Hz F, DAMP F, Hz R, DAMP R, TOE F, CASTER:

> Front ride frequency: higher = quicker turn-in. The largest response factor.

> Front rebound damping: lower = sharper turn-in, higher = more planted entry. Bump damping is left out.

> Rear ride frequency: higher = quicker rear body control and rotation feel.

> Rear rebound damping: lower = more rotation freedom, higher = more planted rear.

> Front toe-out sharpens turn-in (reactive); toe-in adds straight-line stability.

> Lower caster reduces self-centering, allowing quicker steering response.

---

## Tune Check (CHECK)

**DECODE — the destination line** under the import buttons, with IMPORT AS DNA
available (PRO), then without it:

> Two destinations. IMPORT TUNE keeps the numbers; IMPORT AS DNA keeps the handling.

> IMPORT TUNE writes these numbers onto this car. IMPORT AS DNA needs PRO.

**STEP 2 · DECODED TUNE:**

> The tune read back as Hz and damping ratios. One front/rear split drives both rebound and bump, so some damper splits land close rather than exact.

**MEASURE → Measure Hz:**

> The ride frequency the springs below are solved for. Softer is more accurate: use the lowest Hz whose spring rates the game accepts on this car.

---

## SHARE dialog

The description under the mode picker — SHARE, LOAD, BACKUP, RESTORE:

> A code for the current tune. COPY LINK puts the same code in a URL that opens SUSP.OS ready to load. Garage entries are not included.

> Paste a code or link, then READ CODE. Nothing changes until APPLY SELECTED, and only ticked parts are taken. TO GARAGE saves the result as a new entry instead.

> Downloads your garage entries as a JSON file. The unsaved current tune is not included.

> Loads garage entries from a backup file. Ticked kinds replace yours for good, so RESTORE takes two taps. The current tune is not touched.
