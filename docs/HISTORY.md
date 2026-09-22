# SUSP.OS — Resolved Incident History

Bugs found and fixed, and deliberate behaviour changes. Split out of
[KNOWN_ISSUES.md](KNOWN_ISSUES.md), which now carries only what is still true.

This is not a changelog of features. Every entry is here because the *reason* it
broke is worth remembering — several are traps the codebase could fall into again,
and a few inline comments in `index.html` point here specifically to say “do not
reintroduce this”. Newest first, matching the order they were written in.

> Nothing in this file describes current behaviour. If an entry here seems to
> contradict the app, the app is right and the entry is history.

## Changed — a bar at a Forza click limit now holds the roll balance

A bar past `lim.arb` or under 1 click used to be clamped on its own, which shifted
the roll balance its split was solved for. The out-of-range bar is now pinned and
the other re-solved to hold that balance. Across 399 pinned cases in a sweep (WEIGHT,
NEUTRAL, CHASSIS × AUTO/SHARE) the gap to the unclamped balance fell from a mean of
0.058 to 0.021; what remains is cases where the re-solved bar hits a limit too.

Considered alongside it and rejected: scaling both Hz axles to hold the ratio when
one leaves the band. It only matters at extreme multipliers, makes the Ride
Stiffness slider disagree with the Hz actually run, and removes the ratio-flattening
that was quietly easing balance targets. The band clamp warning, which says to move
the multiplier toward 1.00, is the better answer there.

## Fixed — MULTIPLIER under a FRONT/REAR reference clamped the derived axle silently

The SHARED multiplier path was fixed to raise `rearHzClamped` (see "the Hz band
clamp reported the wrong axle" below), but the FRONT/REAR multiplier path kept
`secondaryHzClamped=false`. Ride Stiffness 3.2 Hz × 3.00 asked for a 9.6 Hz rear
and delivered 5.5; 1.0 Hz × 0.50 asked for 0.5 and delivered 0.8 — no banner, no
amber Hz, no CLAMPED badge. Found by a sweep of every clamp flag against the
delivered tune (210,600 cases); this was the only flag that failed to fire. The
flag now comes from the raw request like every other path, so the existing
`hzClampNote` banner covers it.

## Changed — `solveTune`'s target-correction loop now runs in BeamNG too

The secant loop that re-runs the solve until the reported balance meets the
target was skipped in physical modes, since BeamNG has no tyre-series display
offset. But BeamNG snaps springs to 500 N/m after CO-SOLVE solves the rear Hz,
and the snapped front no longer matches the front the rear was solved against,
so the final balance drifts. Running the loop there too cut the mean BeamNG
CO-SOLVE miss in the sweep from 0.0013 to 0.0008 and the cases a hand-picked
Spring Share could beat from 70 to 25; the worst miss left is about 0.005,
the spring grid's own resolution. No other code changed.

## Fixed — CO-SOLVE Auto Spring Share stopped short under ROLL stiffness mode

With ARB Stiffness Mode ROLL, the ARB budget is whatever roll stiffness the springs
leave unmet. At strongly biased Balance Targets, raising `S` stiffens the springs
until they meet the roll target alone and the budget hits zero — and `simUtil`
returned `abUtil:0` there, which the search read as "ARB relaxed". It backed off to
the `S` just below that point, where the bars were floored and too weak to help.
A 65/35 FWD car asking for 0.75 landed at 0.51; `S=100` reached it within 0.0004.
A sweep (6 chassis × 3 games × 4 ARB modes × targets 0.25–0.75) found 102 such
misses, all ROLL. Zero budget now reports unbounded ARB strain, same reasoning as
the floor-strain fix below: ARB can deliver none of the correction, so springs take
it all. After the fix no unpinned case misses by more than 0.006; the misses left
are pinned at `S=100` and no spring share does better.

## Fixed — CO-SOLVE Auto Spring Share measured spring strain before the Hz clamp

`simUtil` in `resolveCoSolveSpringShare` measured `spUtil` from the rear roll
stiffness *before* `clampHz`, while everything downstream used the clamped Hz.
Once the rear Hz hit its limit the search believed springs were delivering more
correction than they could, and handed them too large a share. `spUtil` now reads
the clamped stiffness. Same pass hoisted loop-invariant work out of `simUtil`
(`arbScaleOf`, the front spring roll stiffness, and a recomputed copy of
`targetRsBalance` and its `K`). Unclamped cases are unchanged; all suites pass.

## Changed — measured values lost their sliders (experiment branch)

A slider suits a value you choose by feel. It doesn't suit one you read off a spec
sheet or the game's tuning screen: nobody drags to find 3,200 lb. `Field` and
`FeelSlider` gained a `noSlider` prop that keeps the number box (typing, wheel
stepping, clamping) and drops the range input. Front Weight Bias, MEAS. NAT BAL,
Target Speed and Bottom-Out g lost theirs too at first, then got them back:
each is a value you move along to try, not one you copy down. Stored values, codec and `sanitizeTune` are untouched. The list
of which controls are which is in [SLIDERS.md](SLIDERS.md).

## Changed — slider − / + nudge buttons removed

On touch screens (768px and narrower) every slider row had a − and + button either
side of its number field that stepped the value by one. Useful when they were added,
but they crowded the row and broke its alignment. Removed. `stepBy` stays because
the mouse wheel on a focused number field or slider still uses it; touch users drag
the slider or type a value.

## Fixed / changed — mobile sidebar drawer

- The drawer popped in and out instead of sliding: its `display` toggled to `none`,
  and a transform can't animate out of that. It now stays mounted and hides with
  `visibility`, and the backdrop fades with it (see CODE_MAP's
  intentionally-retained legacy section).
- The width was a fixed 300px, which left a 20px backdrop strip on a 320px phone.
  It's now 88% of the screen, capped at 360px.
- A leftward swipe on the drawer (over 60px, mostly horizontal) closes it. A touch
  that starts on an `input`, `select` or `textarea` is ignored. Without that,
  dragging a slider thumb left closed the drawer mid-drag.
- Phones only: the pinned VISUALS footer hides while a sidebar field has focus
  (keyboard up), and its scroll area is capped at 32vh instead of 50vh, so the
  controls keep their height.

## Fixed — tutorial leftovers found on the phone walkthrough

- Three steps were long enough to need scrolling or fill a phone screen: INT
  "Corner Exit & Entry" and "ARB Stiffness & Balance Mode", PRO "Mech Balance
  Target". Trimmed; none scrolls at 375×812.
- Both "Reading the Results" steps said "the right panel", which is not where the
  results are on a phone. Now "the results panel".
- The beginner tour ends on a garage step, and the garage overlay stayed open
  behind the complexity popup. `closeTut` now closes it when the closing step
  spotlights `garage`.

## Fixed — on phones the tutorial card covered the control it pointed at

Sidebar targets always placed the card "just right of the sidebar", clamped to the
screen edge. On a phone the sidebar is nearly full-width, so the clamp dropped the
card straight on top of the spotlit control — for most beginner steps, including
the Balance step whose TRY IT asks the user to drag that slider. The card also
anchored only to `focus[0]`, so a two-zone step (Layout & Build Type) covered its
second zone. The side placement now needs the whole card to fit beside the sidebar;
otherwise the card goes above or below the target, anchored to all focus zones
together. A sidebar section taller than the screen pins the card to the bottom edge
rather than centring it over the section's middle.

## Changed — tutorial tier gating is now explained

INT and PRO were locked until the previous tier's guide had been opened, but nothing
said so: a click on a locked tier just switched to the prerequisite tier and opened
its guide. Locked tier buttons now show 🔒, dimmed, with a tooltip naming the guide
that unlocks them; the redirected guide's first card says why it opened; and the
complexity popup after BEG/INT names the tier that just unlocked. The gating rules
themselves are unchanged.

## Changed — the beginner guide loads a preset at step 3 and keeps every step short

Results used to appear only at step 12 of 13, so a new user read eleven steps about
inputs with an empty results panel. "Load a Preset" is now step 3, straight after
units, and every later step refines a tune that is already on screen. "Saving Your
Own" moved to the end, where there is something worth saving.

"Getting Around" (~160 words, `focus:null`, which dimmed the whole page) is cut to ☰,
undo/redo and ⓘ and now spotlights `toolbar`; header-button detail is left to the ⓘ
hints. "Output Toolbar" drops ↩ / ↪, now covered earlier. No step exceeds about 70
words, so no step's text triggers ▼ SCROLL FOR MORE. The "Load any FACTORY preset"
task moved with the preset step.

## Changed — the beginner guide offers a QUICK START path

The beginner guide's first card now offers QUICK START (Units, Factory Presets,
Balance, Reading the Results) beside FULL TOUR. The quick path is the `quick:true`
steps of `TUTORIALS.beginner` filtered by `tutSteps`, not a second array, so it
can't drift from the full tour. It closes through `closeTutEnd` like the full tour.

## Changed — tier guides can resume where they were left

The current step used to be session state, so a reload lost it and `?` always
restarted at step 1. The last step per tier guide now persists in
`suspos_tutorial_step_v1`; `?` offers RESUME AT STEP n / START OVER. DONE clears it,
as does RESET with Tutorials ticked. It is clamped on read because a guide can
shrink between visits.

## Changed — tutorial steps can carry a task

Steps take an optional `task: {text, check}`. The card shows the text with ○ and
flips it to ✓ once `check(fe, snapshotAtStepOpen)` passes, so "changed" means changed
during this step rather than ever. NEXT is never blocked. The beginner guide's
Factory Presets, Ride Stiffness and Balance steps have tasks.

## Changed — closing the BEG/INT guide early now shows the complexity popup; tutorial reset includes the balance guide

The complexity popup (pointing at BEG / INT / PRO and `?`) used to appear only on
DONE ✓ at the end of the beginner or intermediate guide, so anyone who closed a
guide with ✕ never saw where the tier buttons were. ✕ and DONE now share one
handler, `closeTutEnd`; PRO and the balance guide still don't show the popup.

RESET with Tutorials ticked now also clears `suspos_baltut_seen_v1`. It previously
left it set, so the Handling Balance guide could never be seen again after a reset.

## Changed — Damping Balance Mode is now STANDARD / SYNC, with SYNC sub-modes

NEUTRAL moved under SYNC, which now reveals TIME SYNC / HYBRID / EQUAL FORCE. The old
SYNC is now labelled TIME SYNC and the old NEUTRAL is EQUAL FORCE. HYBRID is new: the
per-axle mean of the TIME SYNC and EQUAL FORCE ζ solves. Stored values are unchanged
(`sync` = TIME SYNC, `neutral` = EQUAL FORCE, still index 2); `hybrid` takes codec index 3, so old codes
decode as before.

## Changed — Vehicle DNA moved out of GARAGE into its own modal

The DNA editor and MY DNA left the GARAGE drawer for a modal opened by a DNA button in
the sidebar toolbar, left of CHECK. TUNE CHECK's IMPORT AS DNA now closes the checker and
opens that modal. The `dnaOpen` open-state key went with the section; `dnaSavedOpen`
still collapses MY DNA inside the modal. Saved DNAs are unchanged garage entries of kind
`'dna'`, so nothing persisted moved.

## Changed — sidebar RESET became an icon

The toolbar's RESET button now shows a red ⟲ (aria-label and tooltip unchanged)
to free width in `zone-toolbar` for another button. On the (then 300px) touch sidebar the
row was already wrapping; the word label was the easiest width to reclaim.

## Changed — a measured ARB scale is flagged when MEAS. NAT BAL moves

MEASURE ARB solves the click scale against the current MEAS. NAT BAL, on springs
at its Hz. Re-measuring NAT BAL afterwards silently left a scale solved against
the old anchor, and the card could only tell you in words to re-measure. APPLY
now records both values (codec ids 75/76, chassis group). `arbScaleStale` shows
RE-MEASURE on the card and an ARB SCALE: RE-MEASURE button under the sidebar's NAT BAL
row when they no longer match, including when NAT BAL is cleared. Scales applied
before this change have nothing recorded, so they count as unknown and are never
flagged; the alternative was warning on every older save.

To revert: drop ids 75/76 from `CODEC_FIELDS` (retire them, never reuse),
`arbScaleStale` and its call sites, and the two fields from `DEF_CH`,
`sanitizeTune` and APPLY/RESET.

## Fixed — tutorials and glossary described the old balance model

After the tyre-series change, the help text still described the model that change
replaced. The PRO "Mech Balance Target" step called the slider an absolute
0.20–0.90 rear share, but it had become an offset from NAT. The glossary said the
plain spring-and-bar split "is the number Forza displays", which is exactly the
assumption the tyre-series change disproved. Neither said where the natural
balance's reference Hz comes from, and ARB SCALE SETUP had no help at all.

Now:
- The PRO track has a "Calibrating ARB Scale" step, and the NAT BAL step
  mentions the saved Hz and the ✕ button.
- The glossary adds Tyre Compliance and ARB Scale.
- MECH and CO-SOLVE say they aim at the balance Forza displays.

The ARB SCALE SETUP card itself also got numbered steps. They cover which bars to set, which box each reading goes in, that both readings are needed before APPLY works, and to re-measure after changing MEAS. NAT BAL.

Text only. Every new step reuses an existing focus id.

## Changed — the balance display counts the tyres in series; ARB click scale 540

The app still overshot the game at big balance offsets after the ARB scale fix:
"close, but not quite" past about ±0.15. A far-offset sweep separated springs
from bars (Rear Hz MECH with ARB 1/1, against MECH with equal springs) and found
the bars fine and the springs short: the game moved 0.70 of the app's predicted
shift at 2.5 Hz, less at 3.0 and 3.5 Hz. That pattern — a ratio falling as the
springs stiffen — is the tyre acting as a spring in series with the suspension.
Fitted across 33 readings on three cars: a 3.94 Hz tyre on a 269 kg corner,
stiffening with √load, no width term; rms about 0.006 against 0.040 without it.
The Ultima's rows were predicted before they were measured.

What changed:

- `computeTune`'s `mechBalance` in the Forza modes is the tyre-series display
  (`displayRsBalance`). The solvers still work in suspension space, and
  `solveTune` wraps `feelToPhysics` + `computeTune` to re-run the target modes
  until the displayed balance meets the target. All three solve call sites use it.
- `ARB_RS_SCALE` 285 → 540. The old values had the tyre's softness folded into
  each click; with the tyre modelled, a click is about 1.9× the suspension
  stiffness. Solved modes (AUTO, SHARE, ROLL, the balance modes) therefore print
  roughly half the clicks for the same requested stiffness — AUTO had in effect
  been asking for about twice its intended bar share in-game. MAN clicks are kept
  and read stiffer.
- MEASURE ARB's solve is now a bisection through the display model. Its stored
  field moved to `measuredArbClick` (codec ids 73/74) and ids 70/71 are retired:
  a scale measured before this is about half the new meaning and is dropped
  rather than misread. Re-measure.
- MEASURE NAT BAL stores the Hz it was read at (`measuredNatBalHz`, id 72): the
  model's equal-Hz natural moves a little with Hz on uneven cars.
- Targets that need big spring splits now ask for them, and hit Forza's spring
  limits sooner. On the sweep cars those limits were real (MX-5 front min 246,
  Scirocco rear min 305.6 and max 1528, Ultima front min 217.8 and max 1088.9).
- `tests-dna.js`'s FrontHeavy pitch-rescue scenario moved from balance offset 0
  to −0.10: with springs 0.7× as effective, offset 0 was out of reach at any pitch.

**If this needs reverting.** It is one commit (`d22d813`, "Model the tyres in series
in Forza's balance display"), tests and docs included, independent of the MEASURE
NAT BAL double-count fix and the MEASURE ARB commit before it, which stay. What a
revert does to data:

- Saved chassis carrying `measuredArbClick`/`measuredNatBalHz`: the reverted
  `sanitizeTune` doesn't know them and drops them. MEASURE ARB is lost (re-measure
  under the old model); the nat bal reading itself is kept.
- Share codes made after this carry ids 72–74: the reverted decoder skips them as
  unknown ids. Mark 72–74 **retired** in CODEC.md then, since codes in the wild
  carry them — they must never be reused for anything else.
- Ids 70/71 come back with the meaning they always had (the pre-tyre click scale),
  so old codes and saves work again. That is restoring the original field, not
  reusing an id, so the never-reuse rule isn't broken — but move them out of the
  Retired list.
- Undoing only the scale while keeping the tyre model is not a partial revert:
  540 is fitted under the tyre term, and 285 without it double-counts the tyre.

## Changed — ARB click scale raised to 285, and MEASURE ARB added

`ARB_RS_SCALE` was 240, described as validated across three cars. That check
had only compared balance near the natural point, where springs dominate and the
bars barely register. A sweep with MAN bars on the same three cars (front- and
rear-biased, equal springs, MEASURE NAT BAL on) found the bars shift Forza's
balance by up to 0.12, and fitted scales of about 310, 258 and 339. The
Ultima's and Scirocco's within-noise ranges don't overlap, so no single value
can be right for every car. The default moved to 285, which roughly halves the
error on the MX-5 and Scirocco and barely changes the Ultima. MEASURE ARB
(`ch.measuredArbScale`, codec ids 70/71) sets the scale per car from two
in-game readings.

Existing builds: for the same target, the solved modes now print about 16% fewer
clicks. MAN builds keep their clicks, so their roll stiffness, roll angle and
balance readout change instead.

## Fixed — MEASURE NAT BAL counted the tyre-width correction twice

With MEASURE NAT BAL on, every solve site set
`natOffset = naturalMechBalanceOf(ch) − geometric estimate` and the reported
balance was `rsBalance + tireCorr + natOffset`. The measured value is read off
Forza's own mech balance display, which already includes the tyre-width effect,
so `natOffset` had silently absorbed `tireCorr` and the formula added it a
second time. Invisible on matched tyres (`tireCorr` = 0); on staggered tyres
the app read high by exactly `tireCorr` at every setting.

Found during in-game ARB calibration on an Ultima Evo (245/335 tyres, measured
0.65): at equal Hz and 1/1 bars the app showed 0.674 while Forza showed 0.65,
and 0.024 is `0.08·ln(335/245)`. Refitting the tyres square moved Forza's
reading to 0.62, the size the tyre term predicts, which confirms the measured
value carries the tyre effect. The target solves (MECH, CO-SOLVE, Rear Hz MECH)
were affected too: they subtracted and re-added the same inflated offset, so the
app reported the target as hit while Forza read about `tireCorr` lower. That
matches the long-standing report that the app overshoots the game.

Fixed with `natOffsetOf(ch)`, which subtracts `tireCorr` and returns 0 when not
measuring; all four sites use it. Unmeasured cars and measured cars on matched
tyres give the same output as before (differences of order 1e-11 from the old
near-zero subtraction). After the fix the Ultima's five in-game rows match
Forza's absolute readings within its 2-decimal display. Guarded by a
`tests-beamng.js` test that fails on the old code.

## Changed — DAMPERS summary gains AVG ζ and a measured settle row

The summary showed rebound ζ, bump ζ and the analytic settle time, which
sees rebound ζ only. Setting rebound to 59% read as "at the settle optimum"
while the car, with softer bump, behaved closer to 47%. Two rows now sit
under SETTLE: **AVG ζ**, the per-axle bump/rebound mean, and **MEAS**, the
bump-aware settle measured off the DYNAMICS trace.

SETTLE itself is unchanged, for the reason in the entry on the DYNAMICS
settle marker below: SETTLE TIME mode back-solves against it. MEAS is
shown *beside* it rather than replacing it. The chart's window fit and
`curveSettle` moved to a top-level `measureSettle` so the chart and the row
cannot drift apart.

## Changed — Balance Guide strip recentred on 0.50, Δ colours matched to the marker

The strip ran 0.20–0.90, so its midpoint was 0.55 and an even roll-stiffness split
sat left of centre. It now runs 0.10–0.90 with 0.50 in the middle. Only the drawn
axis moved; the RANGE band's own 0.20–0.90 clamp is unchanged.

The CURRENT/TARGET Δ line coloured oversteer blue and understeer amber, while the
marker above it coloured above-range (oversteer side) orange and below-range blue —
an above-range value showed an orange marker over a blue "OS". The Δ line now uses
the marker's colours: orange for OS, blue for US.

The per-build fraction table, which the RANGE and GRIP GAP blocks each carried a
copy of (`_fracMap` / `_ggFracMap`), is now one `BALANCE_BAND_FRACS` read through
`balanceBandFracs`. Values unchanged.

---

## Fixed — TUNE CHECK's tune import handed back a damper split that wasn't the one typed

`importDecoded` anchored `reboundZeta` to whichever axle damped *harder* and wrote
`dampingBias` as `200 · (1 − ratio)`. Both halves were right once. The patch has always
set `rideRef:'front'`, and STANDARD's exact-anchor axle used to follow the Damping Bias
slider's *sign*, so the dominant axle really was the anchor. When that changed — the
anchor now follows Ride Reference, see the comment on the STANDARD branch in
`feelToPhysics` — the decode was not updated with it, and the scale factor was never
right for `zetaR = zetaF · (1 − dampingBias/100)` either.

Measured on the shipped code, default chassis, 400/300 lb/in springs:

| typed | imported |
|---|---|
| rebound 6 / 4 | 6 / 3 — the rear 25% too soft, because the bias moved it twice as far as asked |
| rebound 4 / 6 | 7.2 / 9 — both wrong, because the rear's ζ was written onto the front anchor |

The front-dominant case was a quiet 25% error. The rear-dominant case put the rear
axle's damping ratio on the front axle and scaled from there, so nothing about the
result described the tune that was entered. Neither showed a warning: the numbers just
came out different from the ones on screen, and the card's "best-effort approximation"
hint made that look expected.

Now the front axle is the anchor to match `rideRef:'front'`, the bias is
`100 · (1 − ζR/ζF)`, and bump ratio reads off the front too. 6/4 round-trips exactly.

Two limits that remain are the model's, not bugs, and both are documented rather than
hidden: one Damping Bias slider drives the rebound *and* bump splits, so a tune whose
bump split differs from its rebound split cannot be reproduced exactly; and the slider's
±50 stops at a rear ζ of 0.5–1.5× the front, so a wider split now says so in the
DECODED TUNE card instead of silently landing somewhere else. See
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Found while factoring `importDecoded` into the `decodedFe` patch that TUNE CHECK's new
IMPORT AS DNA button shares, which is how the round-trip came to be checked at all.

---

## Changed — Ride Height F/R raised to 4 ft, CG Height cap to 1500mm

The Ride Height F/R inputs stopped at 24in / 61cm, too low for lifted off-road and
rally builds. They now go to 48in / 122cm, and `sanitizeTune`'s `rideHeightF/R` clamp
went from 0.61m to 1.22m to match. The clamp has to move with the inputs: it runs on
every load and share-code decode, so a stale 0.61 would quietly cut a saved 40in
ride height back to 24in.

CG Height's 900mm cap went to 1500mm with it. At 900mm the RIDE HEIGHT → CG estimate
saturated at about 22in of ride height on ordinary tyres, so most of the new range
changed nothing, and 900mm was already short of lifted trucks. The cap lives in three
places that must agree: the `cgHeight` clamp in `sanitizeTune`, the `Math.min` in the
RIDE HEIGHT → CG effect, and the manual CG Height input's `max`. A share code carrying a
CG height above 900mm decodes to that value now; before, it was clamped to 900mm.

---

## Changed — BEG's Balance slider centres on WEIGHT, not NEUTRAL

Touching BEG's Balance slider switched ARB mode to NEUTRAL, and a Beginner preset load
did the same. NEUTRAL's centre solves the bar split so the bars *cancel* the springs'
front/rear bias and total roll stiffness lands on the weight distribution. With springs
off 50/50 through the rear multiplier, cancelling them needs a lopsided bar split: on a
50/50 RWD car at 3.30 Hz ×0.96 with AUTO bars, a centred slider labelled NEUTRAL solved
the front bar to its 1-click floor and the rear to 38.7. The OVERSTEER half then did
nothing to the bars (still 1 / 39 at +50) because ARB Bias could only push further past a
floor it was already on; only the UNDERSTEER half moved them, back toward 19 / 19.

The slider now keeps ARB mode on WEIGHT, which BEG already enters with. Its centre is the
bars split by weight and the springs at whatever MULTIPLIER ratio is set; off centre it
nudges both toward the requested handling, WEIGHT's ARB Bias (±20 points of bar split)
and the rear Hz multiplier (±4%), as it already did for the springs. The same car now reads
18.8 / 19.5 at centre, 26.3 / 11.7 at −50 and 11.3 / 27.3 at +50. Its centre is a little
more understeer than before (bTot −2.8 against −0.1), because the bars no longer offset
the springs' front bias. NEUTRAL mode itself
is unchanged and still selectable at INT/PRO.

---

## Changed — undo rebuilt with redo, and moved to the sidebar toolbar

The old undo was an effect that snapshotted `{ch, fe, dr, al}` 600 ms after changes
stopped, and popped that list on ↩. It had no notion of an action, and four things were
wrong with it:

- **A load right after an edit lost the state between them.** Both landed inside one
  600 ms window and became one snapshot, so ↩ jumped past the pre-load tune.
- **Undo across a game-mode change could corrupt MAN ARBs.** Restoring a snapshot with a
  different `gameMode` flipped `physMode`, and the unit-conversion effect converted
  `arbManF`/`arbManR` again, though the snapshot already held them in the right units.
- **Undo past a tier switch left PRO modes in BEG/INT.** The fallback effects fire only
  when `uiMode` changes, and a restore doesn't change it.
- **Undoing APPLY kept the DNA link**, so the sidebar judged the old tune against a DNA
  that was no longer applied. DNA.md documented that as intended; it stopped making
  sense once APPLY became one step.

Its replacement is `makeHistory` plus explicit steps: `commit` for discrete actions,
coalesced bursts for continuous edits, raw setters for deriving effects, and a
`restoringRef` / `restoreTick` pair so effects neither double-convert nor skip the tier
clamp after a restore. Snapshots now carry `dnaApplied`. Redo arrived with it (↪,
Ctrl/⌘+Shift+Z, Ctrl+Y), both buttons moved from the header to beside RESET, and the
cap went from 50 to 100 steps. Details in [CODE_MAP.md](CODE_MAP.md#undo--redo).

---

## Changed — Vehicle DNA's roll axis became ARB share

`rollDegPerG` (ROLL °) was replaced by `arbShare` (SHARE %), and the DNA format moved to
v2. A roll target was unreliable to hit: body roll scales with CG height, which the app
estimates, so a value that landed on one chassis missed on a lower or higher one — in
BeamNG too, where the bars have no ceiling. Share doesn't depend on CG; its misses come
from the game's bar range instead, which is exact. `computeTune` gained `shareClamped`
and `arbShareTol` as SHARE's counterparts of `rollClamped`, and the sidebar ARB Share
field now steps by 0.5 so DNA values can be set by hand. The archetype seeds and the
measurements behind them are in [DNA.md](DNA.md#arb-share-rather-than-roll-degrees).

---

## Fixed — RESTORE deleted every entry of a kind the backup file didn't contain

RESTORE replaces the ticked kinds and keeps the rest. A kind absent from the file had
its checkbox greyed out, but the box stayed ticked, and the replace step read the tick
state alone. So restoring a builds-only file deleted every chassis and car entry in
the garage, replacing them with nothing. Found while adding saved Vehicle DNAs as a
fourth kind, where it would have hit every restore: no backup made before that has a
DNA in it. A kind now counts as selected only when the file carries at least one entry
of it.

---

## Changed — leaving PRO asks first while a Vehicle DNA is applied

The BEG/INT fallback effects rewrite `arbBalMode` MECH → WEIGHT (and BEG also resets
`dampBalMode` and `dampingBias`) with nothing to restore them on returning to PRO, so a
compiled DNA tune silently stopped solving for its balance target. The header tier
buttons now go through `requestMode`: with a DNA link it shows STAY PRO / SWITCH, and
SWITCH removes the link along with the tier change. Switching tiers without a link is
unchanged.

---

## Fixed — the Balance Guide band dropped grip-neutral when a fraction pair straddled 1.0

Introduced by the overshoot fix directly below, found reviewing it the same day.

`balanceBandDelta` made the band delta V-shaped in `frac` on a negative gap, bottoming
out at `frac = 1` — grip-neutral. The RANGE block and the GRIP GAP widget still built
each band from `min`/`max` of the two endpoint deltas. That was correct while the delta
was `frac*gap` and therefore monotonic, but a pair straddling 1.0 now has its low
extreme *between* its endpoints. Every such pair lost grip-neutral from its band on
every rear-biased chassis: DRIFT on all three layouts (0.90–1.55, AWD 0.75–1.30) and
RWD DRAG (0.60–1.05).

The `hi ≥ lo + 0.03` floor made it worse. With `lo` truncated upward, the floor could
lift `hi` beyond anything the fractions produce, so the band shifted toward oversteer
rather than only narrowing. Default chassis geometry, `natMechBalance` scale:

| Layout / front bias / build | Before | After |
|---|---|---|
| AWD 45% DRIFT | 0.457–0.487 | 0.430–0.463 |
| AWD 36% DRIFT | 0.382–0.412 | 0.299–0.398 |
| RWD 45% DRIFT | 0.441–0.490 | 0.430–0.490 |
| FWD 40% DRIFT | 0.380–0.485 | 0.357–0.485 |
| RWD 45% DRAG | 0.435–0.474 | 0.430–0.474 |

The entry below gives RWD 45% DRIFT and DRAG as moving to 0.441–0.490 and
0.435–0.474; those were the truncated bands.

Fixed with `balanceBandRange(fracLo, fracHi, gap)`, which returns the lowest and highest
delta over the whole pair — the two endpoints plus `frac = 1` when the pair straddles
it — and which both widgets now call. Checked against the previous `index.html` over
every layout and build, front bias 30–70% in half-point steps, and three tyre staggers:
no band moved anywhere `gap ≥ 0`, every change was a negative-gap straddling pair, and
every new band equals the fraction pair's exact range.

It changed two claims in KNOWN_ISSUES' sub-1-fraction entry, both of which rested on
the truncated bands. The AWD DRIFT/TRACK inversion covers every rear-biased chassis, not
only "below about 45%". And FWD/RWD lose their ordering in a strip just under the
crossover (47.1–49.5% front), where every band is at the 0.03 minimum width and DRIFT
and TRACK differ by about 0.001 — the truncation had been lifting DRIFT there by
accident.

The lesson is the one the V-shape paragraph already stated and the code did not act on:
once a function stops being monotonic, its endpoints stop being its extremes.

## Fixed — DRIFT's overshoot aimed at understeer on every rear-biased chassis

The PRO Balance Guide's RANGE band scales its bounds as a fraction of
`gap = (1 - natGripBalance) - natMechBalance`, the distance from NATURAL to GRIP
TARGET. Fractions above 1.0 exist to recommend overshooting *past* grip-neutral
into sustained rotation — DRIFT at 0.90–1.55 on FWD/RWD, 0.75–1.30 on AWD, and
RWD DRAG at 0.60–1.05. The band computed those bounds as `frac*gap`, which
carries the gap's sign. "Past grip-neutral" therefore meant "further toward
oversteer" only while `gap` was positive; on a negative gap the same
multiplication carried the overshoot past neutral in the **understeer**
direction — the exact opposite of what the fractions are for.

Reproduced with the real `naturalMechBalanceOf`/`balanceFromRsBal` lifted out of
`index.html`, and confirmed against the live widget in a browser at PRO / RWD /
DRIFT / 45% front bias:

| front bias | gap | NAT | RANGE | grip balance across the band |
|---|---|---|---|---|
| 45% | −0.111 | 0.540 | 0.369–0.441 | 0.467–0.511 |
| 52% | +0.061 | 0.470 | 0.525–0.565 | 0.501–0.525 |
| 60% | +0.256 | 0.391 | 0.621–0.788 | 0.495–0.552 |

At 45% front the chassis is already oversteer-prone (`natGripBalance` 0.570) and
the DRIFT band landed mostly on the *understeer* side of neutral. The sharpest
symptom was that the build table inverted end to end on that chassis: OFFROAD
0.547–0.565, RALLY 0.534–0.552, STREET 0.527–0.547, TRACK 0.507–0.534, DRAG
0.501–0.531, DRIFT 0.467–0.511 — the more rotation a build wanted, the less it
recommended.

Fixed by pulling the band edge into a module-level `balanceBandDelta(frac, gap)`
that anchors an above-1 fraction's overshoot at grip-neutral and adds
`(frac-1)*|gap|`, so it points at oversteer under either sign. Fractions at or
below 1.0 are untouched: those interpolate toward grip-neutral and were already
direction-correct either way. The helper guards on `gap >= 0` as well as
`frac <= 1`, redundantly on purpose — it keeps the positive-gap branch on the
identical expression, verified bit-identical across every layout/build pair from
49.6% to 75% front bias, so no existing recommendation moved. The RANGE block and
the GRIP GAP sub-widget both call it rather than each holding their own copy of
the arithmetic, since the two are supposed to agree on what "in range" means.

`min`/`max` on the two deltas stays necessary after the fix, for a new reason:
with a negative gap the delta is V-shaped in `frac` with its minimum at
`frac = 1`, so neither end of a fraction pair is reliably the lower bound.

At RWD 45% front the DRIFT band moves from 0.369–0.441 (grip 0.467–0.511) to
0.441–0.490 (grip 0.511–0.541), and RWD DRAG from 0.424–0.474 to 0.435–0.474.
In GRIP balance-target mode the GRIP GAP sub-widget follows: where it previously
judged grip-neutral already inside the DRIFT band and stayed hidden, it now
suggests a wider rear tyre (+5mm at 45% front, +10mm at 40%) to bring
grip-neutral up into the band — the right advice for a drift build on a
rear-biased car, and a coherence check that the two widgets still agree.

A cosmetic defect in the same block was fixed alongside, and it is the tell that
nobody had looked at this branch on screen: the RANGE delta caption hard-coded
its signs as `Δ+{_dlo} → +{_dhi}`, so a negative gap rendered "Δ+-0.17 → +-0.10".

What this fix does **not** resolve is the ordering of the `frac ≤ 1` builds on a
strongly oversteering chassis, which is a question about what a sub-1 fraction
means rather than a sign error. It is open in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Fixed — "the rare chassis whose natural balance already sits past its own grip target" was not rare

The Balance Guide RANGE gap, `gap = (1 - natGripBalance) - natMechBalance`, was
described as going negative only for a rare chassis — in
[PHYSICS.md](PHYSICS.md)'s Balance Guide RANGE section, in the code comment beside
`_fracMap`, and in the resolved `min`/`max` entry further down this file. Measured
against the real `naturalMechBalanceOf`/`balanceFromRsBal` lifted out of
`index.html`, the sign turns out to track front weight bias almost exactly and
flips just under 50% front: 49.51% on `DEF_CH`, 48.39%–51.61% across the track-width
range, 44.34%–54.71% across tyre stagger, and completely unmoved by CG height or
total weight. Every mid- and rear-engined car is therefore on the negative side,
not a rarity — a bias-only sweep from 35% to 65% front is negative at 48.7% of
its points.

The phrase had propagated to three places from one original claim, which is the
case CLAUDE.md's "grep the phrase across all of them" habit exists for. All three
now describe the real distribution, with the measurements recorded in PHYSICS.md
so the next reader does not have to re-derive them.

The mis-characterisation was load-bearing, not cosmetic: believing the negative
branch was exotic is why nobody checked what the `fracHi>1` overshoot does there.
That defect was real, and is fixed in the entry above.

## Fixed — the FWD EXIT hint named the wrong lock direction

The EXIT slider's FWD hint read "Toward GRIP reduces lock … Toward ROTATE
increases lock for cleaner pivot and less push". Both halves were backwards.
On FWD the slider is displayed flipped
(`value={ch.layout==='FWD'?-(dr.diffBiasExit??0):…}`) while `computeDiff`'s
accel term keeps RWD's sign, so the ROTATE end is *less* front accel lock, not
more. Probed against the real `computeDiff` (FWD, 60% front, Track/Race):

| EXIT slider | stored `diffBiasExit` | front Accel | `bDiffAccel` |
|---|---|---|---|
| −50 (GRIP) | +50 | 28% | −2.35 |
| 0 | 0 | 20% | −1.68 |
| +50 (ROTATE) | −50 | 13% | −1.09 |

The slider itself is correct — right is still the oversteer-leaning end, because
*less* front lock is what frees a FWD car's rotation, and `bDiffAccel` rises
from −2.35 to −1.09 across that sweep. Only the hint's description of the lock
was wrong, and it contradicted the `Accel %` readout sitting directly beneath
it. `tests.js` already asserted the underlying direction ("FWD: higher
EXIT/ENTRY → more accel lock" on the *stored* value), and the MATCH CHASSIS
entry below recorded the same measurement from a live check — the hint was
never checked against either.

Rewritten to mirror the RWD/AWD phrasing: "Toward GRIP increases lock — more
corner-exit traction, but more push. Toward ROTATE reduces lock for a freer
pivot and less understeer."

The block comment above the slider was the likelier source of the error — it
asserted "right = more lock = more rotation-leaning, same as RWD/AWD always
used", chaining a true claim (right = more rotation-leaning, every layout) to a
false one (right = more lock, FWD excepted). Corrected to separate the two,
since that conflation is exactly what the hint encoded. The AWD front-axle EXIT
hint (PUSH↔NEUTRAL, `diffFrontExitBias`) was checked at the same time and is
correct: PUSH does increase front accel lock there.

**Lesson:** on FWD, balance direction and lock direction point opposite ways —
that is the whole reason the UI flip exists. Any copy about this slider has to
say which of the two it is describing. The `Accel %` readout under the slider
is the cheapest check available: sweep the slider and read it.

## Fixed — PRESETS.md described the diff-bias *slider* sign as the stored sign

[PRESETS.md](PRESETS.md)'s "Reading the columns" section sent readers to
[SLIDERS.md](SLIDERS.md) for `diffBiasExit`/`diffBiasEntry` with the gloss
"positive = oversteer-leaning per the convention documented there". SLIDERS.md's
convention is the app-wide **right = OVERSTEER** rule for *sliders*, and both of
these sliders reach it through a sign flip, so the gloss was wrong for the
stored values the preset table actually lists:

- `dr.diffBiasEntry` stored positive is **STABLE** (understeer-leaning) on every
  layout — `computeDiff` says so in a comment (`−50=loose, +50=stable`), and the
  slider negates unconditionally (`value={-(dr.diffBiasEntry??0)}`). The same
  table's STREET row already read `diffBiasEntry +10 (STABLE-leaning)`, directly
  contradicting the column note a few lines below it.
- `dr.diffBiasExit` stored positive is more accel lock on the driven axle, which
  is oversteer-leaning only on RWD/AWD; the slider flips it for FWD, where the
  reading is GRIP.

Corrected in place: the column note now describes the stored fields and names
the flip at each slider, and the preset rows spell the side out per row the way
the Damping Char column does (RALLY `−15` and DRIFT `−18` as LOOSE-leaning,
exit sides qualified "on RWD/AWD"). SLIDERS.md's EXIT/ENTRY rows keep their
correct `Right = OVERSTEER-leaning` reading and now state the stored polarity
beside it, since PRESETS.md points there.

**Lesson:** "positive = oversteer" is three different claims in this codebase —
the `bXxx` contributor sign ([FORMULAS.md](FORMULAS.md)), the slider reading
([SLIDERS.md](SLIDERS.md)), and the stored field. A doc that hands one
convention off to another doc by reference is where they get conflated. No code
changed.

## Changed — factory presets author damping as ζ, and Beginner no longer drops it

STREET, TRACK, MOTORSPT and X COUNTRY stored their damping as Settle Targets
(`dampCharMode:'settle'`, 0.55s / 0.40s / 0.25s / 1.00s) and carried no
`reboundZeta` of their own. Beginner's `loadPreset` forces `dampCharMode:'zeta'`,
so in Beginner those four presets silently fell back to `DEF_FE`'s 70% while INT
and PRO back-solved the target. **The same preset produced two different tunes by
tier.** On the default chassis in HORIZON, STREET gave rebound 4.3 / 4.5 clicks in
INT/PRO and 9.9 / 10.5 in Beginner — more than double.

It surfaced while seeding the Vehicle DNA archetypes ([DNA.md](DNA.md)): converted
to ζ, the presets spanned 30–70% in an order that made no sense (STREET lighter
than RALLY in INT/PRO, everything near 70% in Beginner).

All four now use CHARACTER mode with the ζ their old target back-solved to at
their own Hz, to one decimal: STREET 30.3, TRACK 36.6, MOTORSPT 45.8, X COUNTRY
40.7.

- **INT/PRO: unchanged.** Checked against the previous `index.html` with the real
  solver across 6 presets × 3 chassis × 3 game modes: 52 of 54 identical in every
  spring, damper and ARB output. The two exceptions are TRACK on a heavy FWD
  chassis in HORIZON and MOTORSPORT, where front bump moves 5.2 → 5.1 — one 0.1-click
  step from rounding 36.637 to 36.6. Whole numbers were tried and rejected: they
  move dampers on the default chassis too.
- **Beginner: changed deliberately.** It now gets the damping the presets were
  authored with. STREET rebound 9.9 / 10.5 → 4.3 / 4.5, TRACK 11.2 / 10.9 → 5.9 /
  5.7, MOTORSPT 14.3 / 12.2 → 9.4 / 8.0, X COUNTRY 4.0 / 3.7 → 2.3 / 2.2 (default
  chassis, HORIZON). RALLY and DRIFT were already ζ presets and do not move.

The trap worth remembering is that a mode override on load is only safe when every
preset supplies the field that mode reads. PRESETS.md's "Adding a new preset" now
says so. The conversion also makes an existing Beginner limitation routine — three
of these ζ values sit below the Character slider's reach; see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Fixed — the Hz band clamp reported the wrong axle, or no axle at all

`physics.rearHzClamped` is the single flag behind the amber RIDE banner, the output
panel's `warnBox`, and the `CLAMPED`/`⚠` markers on the Hz readouts. It means "the
derived axle was clamped", and three separate paths in `feelToPhysics` stopped it
meaning that.

**Under a REAR ride reference it was hard-set to `false`.** The primary/secondary
assignment step wrote `rearHzClamped=false` instead of carrying
`secondaryHzClamped` across, so every front-axle clamp went unreported — including
the ordinary case of inverse FLAT RIDE at a low Target Speed, which floors the
front at `HZ_MIN`. The reference axle is the one that is never clamped, so the flag
was reporting the only axle that could not need it.

**In the SHARED multiplier path it was hard-set to `false` too.** Avg 5.0 Hz at a
×3.00 multiplier asks for a 7.50 Hz rear, silently delivers 5.50, and so delivers a
2.2 ratio rather than the 3.0 requested, with nothing on screen saying so.

**`frontHz` had no ceiling in the SHARED multiplier and MECH paths.** Both clamped
it with `Math.max(HZ_MIN, …)` and no `Math.min(HZ_MAX, …)`, so a multiplier below
1.0 — avg 5.0 Hz at ×0.50 gives 6.67 — printed a front Hz above the band with no
marker beside it. The MECH path's flag test (`frontHz<=HZ_MIN||rearHz>=HZ_MAX`) also
read the clamped results rather than the raw ones, so a solve landing exactly on a
bound reported itself as clamped when nothing had moved.

All three SHARED sites now go through one `splitAvgHz` helper that clamps both
axles and derives the flag from the raw values, and the REAR assignment carries
`secondaryHzClamped` through. The three sites were byte-identical copies of the
same six lines, which is how two of them drifted from the third.

Found alongside a rewrite of the banner copy itself, which had claimed a "1.6×
front" cap that nothing has ever applied, told the user to *increase* Ride
Stiffness (the wrong direction under a front reference, and contradicting the RIDE
section's own advisory), and always said "Rear". The rewritten note was correct but
unreachable for the REAR case until the flag was fixed — see
[PHYSICS.md](PHYSICS.md) for which modes can raise it today.

## Changed — SECTIONS −/+ no longer toggles things that are not sections

The sidebar's SECTIONS `−`/`+` buttons mapped over `Object.keys(open)`. That object
also holds `balanceExpanded`, `factoryOpen` and the four `vis*` visualisation cards,
so `+` popped the balance detail overlay and every visualisation card open and `−`
closed the GARAGE factory list — none of them sections, and the blast radius grew
with every flag added to `open`.

They now walk an explicit `SECTION_KEYS` list. This also replaces the invariant that
a missing key silently opts a section out of expand-all: the earlier fix for
`alignment` added the key to the initialiser, which worked, but left the next
section to fall into the same trap. See [CODE_MAP.md](CODE_MAP.md).

## Fixed — the rear-Hz clamp warning described a cap that never existed (resolved)

Both output layouts rendered "Rear Hz capped at 1.6× front" whenever
`physics.rearHzClamped` was set. Nothing in the app has ever capped a front/rear
ratio: every branch in `feelToPhysics` clamps the derived axle to `HZ_MIN`/
`HZ_MAX`, the band. The sentence carried two further errors:

- **The advice was backwards.** It said to *increase* Ride Stiffness, which under
  a FRONT ride reference pushes the rear further out of the band. The RIDE
  section's own flat-ride advisory says to *lower* it, so the two contradicted
  each other on screen.
- **It always said "Rear".** Under a REAR ride reference the clamped axle is the
  front; under SHARED both axles are solved together.

Replaced by a single `hzClampNote` derived once in `App()` and consumed by both
layouts. It names the axle actually clamped, quotes the band and the clamped
value, and picks advice per `physics.rearHzMode` — leading with Target Speed for
FLAT RIDE, since raising it shrinks the traverse offset toward zero and so moves
the derived axle back toward the reference for *either* Ride Reference, unlike a
stiffness nudge whose correct direction flips with the anchor.

The two layouts previously held byte-identical copies of the wrong sentence, which
is how a fix to one would have missed the other. That duplication is the reason it
is now computed in one place rather than written twice correctly.

## Fixed — SECTIONS expand-all skipped ALIGNMENT (resolved)

`open`'s initial `useState` listed every collapsible sidebar section except
`alignment`. The section itself worked — `undefined` is falsy so it rendered
collapsed, and its own header toggled it — but the SECTIONS `+`/`−` buttons
blanket-toggle `Object.keys(p)`, so a key absent from that object is skipped
entirely. Expand-all therefore left ALIGNMENT closed until the user had opened it
by hand at least once, or until a PRO tutorial step wrote the key via the
`tutFocus` effect.

PRO-only, cosmetic, and self-healing after one manual toggle, which is why it
survived. Fixed by initialising `alignment:false` alongside the other section
keys. The invariant — every section needs its key present from the start, even at
`false` — is now written down in [CODE_MAP.md](CODE_MAP.md), since adding a
section is exactly when it is easy to miss again.

## Fixed — flat-ride docs said "stiffer" where they meant frequency, and miscredited a source

Two documentation errors around `flatRideRearHz`, both caught by checking the
literature rather than the code. No behaviour change.

**"Rear 10–20% stiffer than front"** appeared in the `flatRideRearHz` comment, in
[PHYSICS.md](PHYSICS.md), and in the FLAT RIDE entry below. Every ratio in that
material is a **frequency** ratio, and rate goes as Hz², so read as spring rate
the same band is 21–44%. Olley's own statement of the rule is front natural
frequency ≈ 80% of rear, i.e. rear ≈ ×1.25 — slightly above the 10–20% band the
docs quoted, which comes from Penske and Race Comp rather than from Olley.

**"Olley's 'Flat Ride' Revisited"** was credited to Sharp & Pilbeam. It is Crolla
& King, Vehicle System Dynamics 33(sup1), 762–774, 1999. Sharp & Pilbeam have a
genuinely related paper, *"Achievability and Value of Passive Suspension Designs
for Minimum Pitch Response"* (1993), which is not the same work. The companion
citation was also tightened: the *Nonlinear Engineering* paper is Marzbani et
al., *"Flat Ride; Problems and Solutions in Vehicle"*, 1(3–4), 101–108,
doi:10.1515/nleng-2013-0002, rather than Jazar alone.

Worth noting what survived the check: the speed-dependence limitation recorded
under FLAT RIDE is correct, and it is the main modern criticism of the criterion.
Crolla & King separately report that Olley tuning still gives a marked pitch
suppression advantage at higher speeds, so the mode is not obsolete.

## Fixed — INDEPENDENT bump mode was inert under SYNC and NEUTRAL damping balance

Reported as "bump mode independent is currently unusable in damping balance mode
sync and neutral modes". It was, and for two compounding reasons in one line of
code. Under `dampBalMode` SYNC or NEUTRAL, `feelToPhysics` (and its `computeTune`
re-run) resolved the bump zetas as:

```js
bumpZetaF = Math.max(10, Math.min(zetaF, bumpZeta));
bumpZetaR = Math.max(10, Math.min(zetaR, bumpZeta));
```

**The same typed value went to both axles.** The Damping Bias slider moved
`zetaF`/`zetaR` and nothing else, so it steered the rebound stroke while bump sat
flat — and SYNC's and NEUTRAL's entire premise (equal settle time, equal damping
force) applied to half the damper. On the default chassis in SYNC at bias 0,
front 2.0 Hz / rear 2.4 Hz, rebound 70%: rebound solved to 70/58 for an exactly
equal 0.305 s, while bump ran 39/39 and settled 0.305 s front against 0.262 s
rear. Nothing in the UI said so.

**Then the clamp to rebound ζ made the residue nonsense.** Whichever axle's
rebound sat below the typed value got clipped to it, so the only front/rear bump
split that survived was an artifact of that clipping — with a rear-biased slider
the two axles could land at 60/60 (no split at all), and at a firm anchor a typed
90% against a 70/58 rebound came out 70/58, meaning the top third of a slider
that reaches 115% did literally nothing. The clamp also contradicted the rest of
the app, which treats bump above rebound as warned-but-allowed (`⚠ CROSSED`)
rather than impossible.

RATIO mode was never affected: one percentage scaling both rebound zetas carries
their split onto bump for free. That is exactly what INDEPENDENT lacked, so the
fix gives the typed value its own trip through the same solver as its own
`refZeta` — `balModeZetas(mode, …)` now picks `forceZetas`/`settleZetas` by mode
for both anchors, at both call sites, so the two cannot drift apart. Bump then
clamps to 10–200% like STANDARD's independent branch, not to rebound. Same
scenario after the fix: bump 39/33 at bias 0 in SYNC, both settling 0.305 s;
90% typed comes out 90/75 and is flagged `⚠ CROSSED` instead of silently clipped.
See [PHYSICS.md](PHYSICS.md#the-bump-stroke-gets-the-same-split).

Two display bugs fell out of the same misreading and were fixed with it:

- The Bump ζ readout printed the raw typed number. Since *every* Balance Mode
  splits that anchor, it was one axle's ζ at best (STANDARD, at the ride-reference
  axle) and neither axle's under SYNC/NEUTRAL. It now shows `F x% | y% R` when
  the axles diverge, matching what the RATIO readout already did.
- `⚠ CROSSED` compared the typed bump against `fe.reboundZeta`. That is the wrong
  yardstick under SETTLE TIME, where the anchor is back-solved rather than typed,
  and under any split at all. It now compares each axle against its own rebound ζ.

Also fixed while in there: the RATIO→INDEPENDENT toggle seeded the typed value
from `physics.bumpZetaF` unconditionally, which is only the anchor axle under a
FRONT ride reference — under REAR it seeded from the derived axle and the tune
jumped on a mode switch that is supposed to be continuous. It now seeds from the
anchor axle (midpoint under SHARED, which anchors neither), clamped to the
slider's own 10–115 range so a firm rebound can't leave the handle pinned at one
end while the tune runs something else.

## Fixed — physical-unit output was snapped for display but the reported physics was not

Found during a documentation review rather than by a test run — there is no CI,
and `node tests.js` is the suite that usually gets run, so `tests-beamng.js` sat
at 35/41 from 2026-08-15 until this was picked up.

`2f640b3` (*"Revamp BeamNG output panel into two-column per-axle layout"*) added
rounding to BeamNG's real slider increments — 500 N/m spring, 1000 N/m anti-roll,
100 N/m/s damper — and applied it inside `springOut`/`dampOut`/`arbOut` only,
explicitly as a display concern. The comment on `roundTo` said so: *"every solver
calculation keep[s] consuming the raw unrounded v … so this cannot affect
thresholds or math."*

That was the bug. The rounding was correct; treating it as cosmetic was not.
The output panel printed a snapped value next to physics derived from the
**pre-snap** target, so the two did not describe the same tune:

> Front spring printed as **45500 N/m** beside **1.75 Hz**. On the default
> chassis 45500 N/m gives **1.7476 Hz**; 1.75 Hz needs **45627 N/m**, which the
> slider cannot hold. Same for ζ and for every balance figure fed by `rsAb`.

This is the identical mistake, in a different mode, to the one already recorded
below under *"damping ζ% output showed the pre-clamp target, not what the click
value actually does"* — and the fix is the same shape. Forza quantises to its
click grid and then back-calculates (`impliedZeta` from the clamped clicks, and
`rsAbF`/`rsAbR` from the rounded ARB clicks) *"so the balance bar shows what the
game will really do"*. Physical modes now do that against BeamNG's grid:
`computeTune` snaps, then derives Hz, ζ, settle times, roll stiffness and the
balance bar from the snapped values. The grid moved to `PHYS_SNAP` beside the
calibration constants so the solver can reach it. See
[PHYSICS.md](PHYSICS.md#physical-unit-output-beamng-game-mode).

Springs are snapped **before** the damper solve and before `rsSpF`/`rsSpR`, so one
forward pass leaves everything downstream consistent with no second solve. Forza
does not snap springs — its spring input is fine-grained enough that the pre-snap
Hz is the Hz you get.

Two things deliberately kept out of it:

- **ARB `MAN`** is a typed value, not a solved one, and Forza's `MAN` likewise
  bypasses `clk()`'s 0.1-click rounding. Snapping it would have overwritten a
  number the user entered; `tests-beamng.js` guards this.
- **Motion ratio** still never reaches the physics. See the caveat below.

### The `mr ≠ 1` corner this leaves behind

The grid physically belongs to the number on the slider, which is the wheel rate
*after* the `/mr²` division. Snapping there would have made Hz and the balance bar
move whenever a motion ratio was entered — precisely what the display-only motion
ratio invariant forbids, and what `tests-beamng.js`'s *"motion ratio never reaches
the physics"* case asserts.

So `snapPhys` snaps in **wheel-rate space, with no `mr` term**. The consequence:
at `mr ≠ 1` the printed number is snapped a second time by the output helper after
the division, and can land up to half a step from the rate the reported physics
describes. At the default `mr` of 1.0 the two coincide exactly, so only tunes that
opt into the advanced field are affected, and the residual is bounded by half a
grid step either way.

Resolving it properly means deciding whether the motion-ratio invariant should
survive at all, which is a larger question than this fix — the same field is
already implicated in the deferred ARB lever-arm work in
[PHYSICS.md](PHYSICS.md#physical-unit-output-beamng-game-mode).

### On the grid values themselves

`PHYS_SNAP`'s 500 / 1000 / 100 arrived inside a layout commit with no recorded
derivation beyond *"confirmed in-game"*. They are now load-bearing for the
reported physics rather than for display alone, so they deserve the same scrutiny
as a calibration constant if anyone re-checks them against the game.

`tests-beamng.js` is back to 41/41, with the assertions that pinned the old
behaviour rewritten rather than deleted: *"spring rate is mode-invariant"* became
*"mode-invariant up to BeamNG's slider grid"*, the cross-mode ARB identity now
allows for both games' quantisation, and *"physical damping keeps full precision"*
became *"snaps to BeamNG's grid, not to Forza's 0.1 clicks"* — the claim that
actually mattered. `tests.js` unchanged at 119/119.

## Fixed — brake bias floor of 50% made rear bias unreachable

**The floor.** `recBrakeBias` was clamped to `[50, 68]`. `cade75d` raised the
floor from 45 to 50 as part of a genuinely correct fix — the previous formula
subtracted from static weight distribution and ignored that braking transfers
load forward, so it produced over-aggressive rear bias (its example: 45% front
for a 44%-front Porsche). Adding the CG/wheelbase weight-transfer term was
right. Raising the floor on top of it was an overcorrection: the weight-transfer
term already front-biases the typical recommendation on its own, so the floor
stopped being a nonsense-guard and became a silent truncator.

It bound hardest exactly where the community *does* recommend rear bias —
trail-braking and drift (~46–47% front for front-engine, ~46% for mid/rear-
engine). A 39%-front rear-engine car (`wtMod` ≈ +9) solves to 43 on DRIFT and
40 on DRAG; both were silently reported as 50.

Three downstream things were unreachable as a direct result, and all three
had been written as if they weren't:

- the `brakeBias<50 → ['REAR','#ef4444']` indicator in **both** BRAKES cards —
  a dead branch, since the clamp floor *was* 50
- `HandlingVerdict`'s tip *"Reduce front brake bias to add entry rotation"* —
  advice the recommendation engine would not itself follow
- `bBrakeEntry = -(brakeBias-50)*BRAKE_BIAS_SCALE` could only ever be
  **negative or zero**, so the brakes contributor could never push oversteer —
  contradicting its own hint text, which describes the positive case

Floor lowered to **45**. Build-type mods deliberately left alone: they were
set while the floor masked them, but re-tuning them is a calibration question
with no telemetry behind it — the same trap as `DIFF_BIAS_SCALE`/
`BRAKE_BIAS_SCALE` in the open bar-scale entry below.

**Why there is no manual override to fall back on — by design.** Brake bias
once had one: `7932982` added a BRAKES section with an AUTO/MANUAL toggle,
manual bias, and brake pressure, and at `cade75d` the resolver still read
`br.brakeManual ? br.brakeBias : recBrakeBias`. `1c66ba2` removed the UI and
`082d51e` (codec rewrite) then pruned `brakeManual`/`brakeBias`/`brakePressure`
as dead state. **This was intentional, not a regression** — worth stating
plainly because `1c66ba2`'s message ("Fix tutorial card positioning under CSS
zoom") does not mention brakes, so the git history reads like an accident and
an audit could easily "restore" it.

The rationale is the app's general contract: SUSP.OS produces a *starting
point* to enter into the game, and users finalise by feel in-game — the same
way other tuning calculators work. A manual brake field would only be used
after the point where the user has left the calculator, so it earns nothing.
That is why brakes and alignment are auto-only and why the BRAKES card says
"Fine-tune in 1% steps by feel." See
[CODE_MAP.md](CODE_MAP.md)'s intentionally-absent note.

This is also why the floor mattered independently of the missing override: with
no manual escape hatch, the clamped AUTO value *is* the number the user takes
into the game, so a floor of 50 sent trail-braking and drift builds to a
starting point the formula never asked for.

Related tier quirk, not fixed: `_brakeGripAdj` is gated on `uiMode==='pro'`,
so BEG/INT and PRO produce brake recommendations differing by up to ±3% for
the same car.

## Changed — default Mech Balance Target moved 0.65 → 0.60, and the NAT hint described the wrong baseline

Two independent findings from checking the mech-balance model against
published community and vehicle-dynamics sources.

**1. The default target sat at the edge of the usable window.** The Forza
tuning community's documented range for road/circuit work is 0.55–0.65 with
**~0.60 as the neutral baseline**; 0.62–0.65 is specifically categorised as a
rotation-biased (touge) setting, and above 0.65 reads as instability.
`MECH_BALANCE_TARGET` shipped at **0.65** from the commit that introduced BAL
mode (`a8c94e1`) and was never revisited — so every fresh build defaulted to
the rotation-biased extreme while presenting itself as the neutral default.
Now `0.60`. This moves the default *target*, not any formula; `tests.js`'s
MATCH CHASSIS block still sees a positive gap on its 50/50 fixture (NAT ≈0.49
vs target 0.60, previously 0.65) so its polarity assertions are unaffected.
The mirrored copy of the constant in `tests.js` was updated in step — it is
duplicated there because `index.html` has no build step.

**2. The BALANCE GUIDE's NAT hint described a baseline the code doesn't
compute.** The hint read *"NAT is the car's natural balance with equal spring
rates and no ARBs."* But `naturalMechBalanceOf` is
`m_r·t_r² / (m_f·t_f² + m_r·t_r²)` — mass- and track-weighted, i.e. spring
rate scaled to corner mass (**equal ride frequency**), not equal spring rates.
With genuinely equal spring rates and equal track widths the answer would be
0.50 for every car, which is not what the strip shows. Hint text corrected.
This is exactly the hint-vs-formula drift [FORMULAS.md](FORMULAS.md) opens by
warning about, and the same class of bug as the Damping Bias incident recorded
there.

Also corrected in passing: the GRIP-mode entry below cited
`MECH_BALANCE_TARGET` as 0.55. It was 0.65 at the time of that fix and has
never been 0.55.

**Not changed — the displayed number is still an unverified match to Forza's.**
`computeTune`'s comment claims `mechBalance` "matches what Forza displays as
Mech Balance." Forza does not publish the formula, and the community reference
documenting the stat explicitly describes its internal definition as opaque.
Two facts sit in tension and can't both be right: the app's quantity is
definitionally *roll stiffness distribution*, which the racing literature
targets at **front weight bias + ~5% front** (a **rear** fraction near 0.43 for
a 52/48 car), yet the in-game window everyone tunes to is 0.55–0.65 rear.
Either the app's number equals Forza's and real-world LLTD is a different
quantity, or vice versa. Resolving it needs telemetry, not a code change, so
the claim is left standing but flagged here. Note the app *does* compute
textbook LLTD separately — `mechBalanceLLT`/`gripBalance`, surfaced as **GRIP
BIAS** — and that path was verified term-by-term against the standard
elastic + geometric load-transfer decomposition and found correct.

## Fixed — BOTTOM G's share codes re-solved against the wrong ride height (resolved)

`rideHeightF`/`rideHeightR` were excluded from the share codec (see
`docs/CODEC.md`) on the reasoning that they were pure calibration inputs to
`ch.cgHeight` (codec id 4), which already travels as a self-contained
absolute value — true for that one consumer. But BOTTOM G's stiffness mode
(codec ids 63/64, see `docs/PHYSICS.md#bottom-gs-stiffness-mode`) added a
second consumer: its `useEffect` re-solves `rideStiffness` (id 7) from the
persisted `rideBottomG` target against `ch.rideHeightF/R` *directly*, and
does so regardless of whether the RIDE HEIGHT → CG toggle is on. Since ride
height itself never travelled with the code, decoding a BOTTOM G's-mode tune
on a device whose local ride height differed from the sender's silently
re-solved to a different Hz — the g-target read identically, but the actual
spring frequency the receiver got was never the one the sender tuned.

Fixed by adding `rideHeightF`/`rideHeightR` as codec ids 65/66 (`group:'ch'`)
and giving them entries in `sanitizeTune`'s chassis object — they previously
weren't clamped/returned there either, so even if a caller had passed them
through decode they'd have been silently dropped before reaching `setCh`.
Same root cause as the earlier `useMeasuredNatBal`/`measuredNatBal` fix (ids
60/61): a field assumed "computed-locally, shared-as-output" turned out to
have a second consumer that needed the raw input, not just the one output
already covered.

## Fixed — TUNE CHECK import silently froze ARB balance when already on BEG/INT (resolved)

`importDecoded` (TUNE CHECK's DECODE tab) always sets `arbMode:'man'` to hold
the exact imported ARB clicks, but MAN was PRO-only — its toggle button was
hidden below PRO, and a downgrade `useEffect` (keyed on `[uiMode]`) reset it
back to `'auto'` whenever *leaving* PRO. That effect only fires on a tier
*change*, so a user already on BEG or INT who opened TUNE CHECK and hit
its import button (IMPORT? then, IMPORT TUNE now) never triggered it: `arbMode` stuck on `'man'` with no visible
indicator, no editing UI at BEG (its ANTI-ROLL BARS card is read-only), and —
since MAN bypasses the budget/split solve entirely — the FEEL section's
Balance slider silently stopped moving ARB balance at all, despite its own
hint text still claiming it does.

First fix attempt promoted `uiMode` to `'pro'` as a side effect of import, so
the exact ARB split always had a tier that could hold it; rejected as too
surprising a side effect for what should be a "convert these numbers" button.
Fixed instead by ungating MAN itself: it's no longer `uiMode==='pro'`-gated
in the Stiffness Mode button row, and the downgrade effect no longer resets
`arbMode` away from `'man'` on leaving PRO. MAN is a stable value at every
tier now, selectable directly at INT; BEG still has no raw-value ARB editing
UI (same as it has none for springs or dampers), so it stays import-only
there, but the imported value now sticks correctly instead of being silently
orphaned.

## Fixed — Balance Guide RANGE band collapsed to a sliver when natural balance already passed grip target (resolved)

The RANGE band (`lo, hi = natMechBalance + fracLo*gap, natMechBalance +
fracHi*gap`, see `docs/PHYSICS.md`'s Balance Guide RANGE section) assigned
`fracLo`'s delta to `lo` and `fracHi`'s delta to `hi` unconditionally. That's
correct while `gap` (NATURAL→GRIP TARGET) is positive, but for a chassis
whose natural mech balance already sits past its own grip-neutral point
— `gap` negative — multiplying by the larger fraction (`fracHi`)
produces the *more negative* delta, so the fixed assignment put `lo` above
`hi`. The existing `hi=Math.max(lo+0.03,...)` floor caught the inversion and
kept the widget from rendering nonsense, but it also collapsed the
recommended band to a fixed 0.03-wide sliver near natural instead of
properly widening on the correct (downward) side, same as it does for the
positive-gap case.

Verified with a constructed chassis (30% front bias, narrow rear tyre,
equal tracks) where `gap≈-0.67`: the old formula gave a 0.30-wide sliver
(0.332–0.362); the fix gives a properly-scaled 0.20–0.332 band (clamped by
the 0.20 absolute floor, not the bug). Fixed by taking `min`/`max` of the
two fraction-scaled deltas before assigning them to `lo`/`hi`, in both the
RANGE block and its mirrored GRIP GAP sub-widget. The band's width was the
only thing this fix changed.

Two claims made in this entry at the time have since been measured and were
wrong. A negative `gap` is not an edge case — it is every chassis under
about 50% front weight bias, so the whole mid- and rear-engined half of the
roster (see [PHYSICS.md](PHYSICS.md)'s Balance Guide RANGE section for the
crossover measurements). And "the direction was never wrong" held only for
the `fracLo`/`fracHi` ≤ 1 builds this fix was exercised against; for the
`fracHi>1` builds the direction *was* wrong once `gap` went negative, which
took `balanceBandDelta` to fix — see the DRIFT overshoot entry near the top
of this file.

## Fixed — UI copy sold Butterworth as a settling-time claim (resolved)

Found in the copy audit that followed the settle-marker work below, after a
user asked what Butterworth still means once the settle readout stopped
agreeing with it. Three places described ζ≈70% in *settling* terms — "the
sweet spot, settling cleanly in one or two cycles" (quick glossary and the
DAMPERS tips card), and the same phrasing in the ζ glossary entry.

Butterworth (ζ = 1/√2 ≈ 0.707) is a **frequency-domain** property: the
damping ratio at which the response has no resonant peak, so no road
frequency is amplified more than the rest. It says nothing about how long a
single bump takes to settle, and the numbers do not line up with the
settling story it was being used to tell — at ζ=0.707 a single bump
overshoots ≈4.3% (`e^-πζ/√(1-ζ²)`), which is one small overshoot, not "one
or two cycles", and the quickest ±10% settle sits nearer ζ≈59%.

The glossary's own **Butterworth** entry was already correct ("the flattest,
smoothest response with no resonant peak"); the other entries have been
brought in line with it, and the three optimums are now stated where they
are likely to be compared: ≈59% quickest settle after one bump, ≈70%
flattest response to a continuous surface, 100% quickest with no overshoot.
The default is unchanged and the sweep defends it — at 1.75 Hz, ζ=70%
settles in 0.23s against 0.21s at the ζ=60% optimum, so the flat response
costs about two hundredths of a second.

Also corrected while in there: the Rebound ζ / Bump ζ / Bump Ratio readouts
labelled **everything** above 70% as "BUTTERWORTH", so ζ=95% announced
itself as Butterworth. Butterworth is a point, not a region — the label now
covers 68–72% only, and above that the readout says FIRM. Zone colours and
slider markers are unchanged.

## Fixed — the DYNAMICS chart's settle markers described a different curve than the one drawn (resolved)

Third in the settle-time family below, and the one that was purely a
*presentation* mismatch: the dashed vertical markers in the VISUALS
DYNAMICS chart were drawn at `tune.settleF`/`settleR`, straight from
`settleTimeFromZeta`, while the trace beside them came from
`computeOscillation`. Those are two different models of the same axle:

- `settleTimeFromZeta` is a **simplified decay envelope**, and not a bound
  in either direction: it drops the `1/√(1-ζ²)` amplitude factor that the
  standard envelope formula `-ln(0.1·√(1-ζ²))/(ζωn)` keeps (that one *is* a
  true upper bound), and it has no equivalent of the `(1+ωn·t)` factor at
  critical damping. Measured against the closed-form trace at 1.4 Hz it ran
  **long** below ζ≈79% (0.582s vs 0.546s at ζ=45%) and **short** above it
  (0.262s vs 0.442s at ζ=100% — 41% early, in the direction that flatters
  the tune). So the old marker was not biased one way; it drifted either
  side of the truth depending where the tune sat.
- `settleTimeFromZeta` takes **rebound ζ only**. `computeOscillation`
  alternates rebound and bump ζ by velocity sign, so on a tune with a wide
  split the two disagree again whenever overshoot clears the band (ζ≲60%):
  at 1.4 Hz, ζreb=30%, the measured settle moves 0.83s → 0.58s as bump ζ
  goes 30% → 60%, a change the marker could not see at all.

Fixed by measuring settle off the plotted points — a local `curveSettle`
finds the last sample pair straddling |x|=0.1 and interpolates, the same
shape as the neutral-crossing `firstCrossing` beside it — and by fitting
the chart window in two passes (size from the analytic estimate, measure,
re-fit, re-integrate), because `computeOscillation`'s `nPts` is fixed and
its step size therefore depends on the window length; measuring on the
final points is what keeps the marker consistent with the polyline drawn.

Deliberately **not** propagated to the DAMPERS section, the damper detail
rows, or `tune.settleF`/`settleR` themselves. Those are the per-axle spec
figure, and SETTLE TIME Rebound Mode back-solves `baseZeta` by inverting
`settleTimeFromZeta` — swapping in a trace measurement there would break
the target→readout round-trip (type 0.55s, get 0.55s back) for no gain,
since the back-solve only needs to invert *consistently*. The consequence
is that the chart's readout and the DAMPERS figure legitimately differ —
chart lower on most tunes, higher past ζ≈85% — which the chart's hint now
states outright.

Known characteristic, not a bug: "last band exit" steps discontinuously at
**ζ≈59.1%**, where the first overshoot peak stops clearing ±10%
(`e^(-πζ/√(1-ζ²)) = 0.1`). At 1.4 Hz the exact settling time goes 0.456s at
ζ=59% → 0.267s at ζ=60%. The textbook settling-time definition has the same
discontinuity; the envelope formula hid it by never looking at the peaks.
Right at the step the marker is knife-edge sensitive — a peak grazing the
band edge — so it jumps between ζ=58% and 60%. Everywhere else the Euler
measurement is within ~1–2% of the closed-form answer (verified against an
RK4 reference at dt=1e-5, including the asymmetric bump/rebound case the
closed form cannot cover).

**The ±10% band is now drawn on the chart**, added after a ζ sweep made the
readout look wrong when it was not. Two things are unreadable without it:

- Past ζ≈60% the settle marker lands *before* the neutral-crossing ring —
  at 1.75 Hz, ζ=95%: settle 0.33s, neutral 1.09s. Correct, and impossible
  to believe with no band drawn: the trace enters the band on the way down
  and never leaves, so it counts as settled while still creeping the last
  10% back to ride height.
- The number falls in **steps**, not smoothly, as rebound ζ rises. Measured
  in-app at 1.75 Hz with Bump Ratio 56%: 0.93 (ζ=25%) → 0.69 → 0.68 → 0.66
  → 0.42 (ζ=45%) → 0.41 → 0.39 → 0.21 (ζ=60%) → 0.22 → 0.23 → … → 0.35
  (ζ=100%). Each drop is an overshoot peak falling inside the band; between
  drops, more rebound damping buys almost nothing, and past ζ≈60% it makes
  things worse. The old envelope readout hid all of this behind a smooth
  1/ζ curve, which is the "it used to feel right" the change trades away.

**Found while verifying the above, not fixed:** that same step is where the
real settling-time minimum lives, which makes the UI's *"critical damping is
the fastest possible settle"* true of the envelope model only. Against the
actual response, ζ≈59.1% settles in 0.267s where ζ=100% takes 0.442s — 1.65×
slower. SETTLE TIME Rebound Mode's back-solve clamps at ζ=100% on the
grounds that it is "the true fastest achievable"; that is self-consistent
with the envelope model it inverts (and the clamp is still right to stop
there rather than run into overdamped territory), but an aggressive target
would be better served near ζ≈59%. Left alone deliberately — changing it
means changing what SETTLE TIME *means* and would move every tune saved
under it, which is a bigger call than a chart fix. The same algebra
reproduces the classic ζ≈0.78 optimum for a 2% band, which is the standard
check that this is the real curve and not an artefact.

## Fixed — settle-time formula treated overdamped ζ as faster, not slower (resolved)

Both the displayed settle time (`tune.settleF`/`settleR`) and the SETTLE
TIME Rebound Mode's back-solve for `baseZeta` used a single-branch formula,
`t = 2.302/(ζ·ωn)` (`rate=ζ` throughout), across the *entire* ζ range
including overdamped (ζ>100%, up to the slider's 200% max). That formula is
exact for underdamped ζ (≤100%) — the response envelope really does decay
as `e^-ζωn·t` there — but wrong for overdamped ζ, where the real decay is
governed by the *slower* of two poles, `rate=ζ-√(ζ²-1)`, which *falls* as ζ
rises past 100%. Critical damping (ζ=100%) is the fastest possible settle;
pushing ζ higher makes it settle more slowly (correctly described elsewhere
in the UI as "sluggish"), not faster.

Two consequences before the fix: (1) the settle-time readout kept reporting
*shorter* settle times as a user cranked ζ past 100%, the opposite of the
real behavior; (2) SETTLE TIME mode's back-solve, chasing an aggressive
(short) target time at a low Hz, could push `baseZeta` past 100% up toward
its 200% clamp — which in reality made the axle settle *slower*, silently
defeating the point of the target.

Fixed by extracting a shared `settleTimeFromZeta(zetaPct,hz)` (used for both
the forward readout and, inverted, the back-solve) that branches on ζ vs.
100%, and by lowering the back-solve's clamp ceiling from 200% to 100% —
an unreachable target now stops at critical damping (the true fastest
achievable) instead of overshooting into overdamped territory. See
`docs/PHYSICS.md`'s `settleTimeFromZeta` section.

## Fixed — SYNC Damping Balance Mode's "equal settle time" broke the same way past critical damping (resolved)

`settleZetas` (SYNC's implementation) held `ζ·Hz` constant between axles —
the same naive assumption the settle-time formula above had, and broken for
the identical reason: "equal `ζ·Hz`" only means "equal real settle time"
while both axles stay underdamped (ζ≤100%). A Hz mismatch between axles, a
Damping Bias skew, or simply a high Rebound ζ/Settle Target anchor (up to
the 200%/critical-damping-and-beyond range) could push the derived axle
past 100% ζ, at which point SYNC's core promise — both axles finish
settling at the same time — silently stopped holding, even though the
(already-fixed) `settleF`/`settleR` readout would show the resulting
mismatch honestly.

Concrete case: Rebound ζ=200% (heavily overdamped) anchoring a SHARED ride
reference at front/rear Hz of 1.15/1.31 — the old formula produced settle
times of ~1.19s front vs ~0.97s rear (a 22% mismatch) despite SYNC being
active. The whole point of SYNC failed exactly when a user pushed damping
hard enough to need it least gracefully.

Fixed by giving `settleZetas` its own rate-aware solve: it derives the
other axle's zeta by matching real decay rate (via `dampRate`/`rateToZeta`,
the same rate function `settleTimeFromZeta` uses), not raw ζ, falling back
to critical damping (100%) when the target axle's Hz is too low to ever
physically match the reference's settle time. `balancedZetas` (the plain
linear solver) is unchanged and still correct for `forceZetas`/NEUTRAL,
since damping force is linear in ζ regardless of over/underdamped — only
settle time needed the nonlinear treatment. Verified in-browser: the case
above now settles at ~1.11s on both axles. See `docs/PHYSICS.md`'s
`settleZetas` section and the "settle mode ride-reference anchoring" tests
in `tests.js`.

## Fixed — MAN ARB stiffness still registered as MECH/CO-SOLVE balance mode enabled (resolved)

Stiffness Mode MAN (direct front/rear ARB clicks) is supposed to bypass the
ARB budget/split solve entirely — `computeTune`'s `arbMode==='man'` branch
does this correctly (`index.html` around the `if(arbMode==='man')` check).
But four separate UI-facing "is a mech/co-solve target active" checks only
looked at `arbBalMode` (`'mech'`/`'coSolve'`), never at `arbMode`, so a
leftover `arbBalMode` of MECH or CO-SOLVE from before switching to MAN kept
the app displaying as if a target were still being solved toward, even
though ARB itself was no longer participating in any solve:

- `chassisAnalysis.hasMechTarget` (drives the BALANCE GUIDE's target marker)
- the BALANCE section's `_hasMechTarget` (shown twice — gates the "Balance
  Target only applies in..." message and the CURRENT/TARGET label)
- `computeTune`'s `mechBalClamped` (drove a "Mech balance target couldn't
  be reached" warning even though nothing was targeting it)
- the Handling Balance widget's `showTgt` (main output panel — showed a
  TGT marker/value even in MAN mode)

Fixed by adding `arbMode!=='man'` to the `arbBalMode==='mech'||'coSolve'`
clause in all four, while preserving the existing `arbMode==='man' &&
rearHzMode==='mech'` case (Hz MECH mode keeps solving spring Hz toward the
target independently of ARB stiffness mode, so that combination correctly
still counts). Verified: MECH balance mode + switching Stiffness Mode to
MAN now correctly falls back to "Balance Target only applies in..." and
drops the TGT marker; switching back to AUTO restores it.

Not touched: the ANTI-ROLL BARS section's MECH/CO-SOLVE "ARB SPLIT"
readout boxes (`(fe.arbBalMode??'weight')==='mech'/'coSolve'` blocks) still
show under MAN — CO-SOLVE's rear-Hz solve genuinely keeps running
independent of `arbMode` (see `computeTune`'s `arbBalMode==='coSolve'`
branch, which isn't gated on `arbMode` at all), so a blanket hide would
wrongly remove the still-functional SPRING SHARE control. Properly
resolving this needs to split "ARB-derived readouts" (stale under MAN)
from "Hz-derived readouts" (still live) rather than one on/off flag —
left as a follow-up, not fixed here.

**Follow-up review found a fifth site the fix above missed:** `showTgt`
(the Balance Guide widget's own "is a target active" check, main output
panel) still read `... || (arbMode==='man' && rearHzMode==='mech')` — the
Hz-MECH clause restricted to MAN — while the four sites above correctly
treat `rearHzMode==='mech'` as unconditional. Concretely: with
`arbMode='auto'` and `rearHzMode='mech'`, the spring-Hz solve was actively
targeting Mech Balance and the BALANCE section showed live target controls,
but the widget's own TGT marker stayed hidden — contradicting the sidebar
one screen away. Fixed by dropping the `arbMode==='man'&&` restriction so
`showTgt` matches `hasMechTarget`. Verified in-app: AUTO stiffness mode +
MECH Hz mode now shows TARGET in the BALANCE GUIDE strip instead of CURRENT.

## Fixed — GRIP mode's resolved target wasn't reaching several read sites (resolved)

`feEffective.arbBalTarget` is documented as "the single funnel that resolves
both TARGET and GRIP modes to an absolute value ... for every downstream
display," but six call sites bypassed it and called `resolveArbBalTarget(ch,fe)`
directly instead — a function that only understands TARGET-mode deltas and has
no concept of GRIP mode. Whenever `arbBalTargetMode==='grip'`, all six instead
showed/used a stale or default (`MECH_BALANCE_TARGET`, 0.65 at the time) value rather than
the live grip-derived target the physics engine was actually solving toward:
`computeDiff`'s MATCH CHASSIS correction, the alignment MECH-mode gap, the RIDE
section's Hz-readout text, both SpringDial/ArbDial ghost rings, and the
`mechBalClamped` warning text. Fixed by reading `feEffective.arbBalTarget`
(already resolved, GRIP-aware) at all six sites instead; `computeDiff`'s call
site now passes `feEffective` rather than raw `fe`. Verified in-app: switching
Balance Target mode to GRIP now shows the same TARGET value in the BALANCE
GUIDE strip, the ARB SPLIT readout, and the RIDE section's solved-Hz text —
previously the RIDE/warning text lagged behind with the old TARGET-mode value.

## Fixed — share codes reinterpreted the Balance Target against the wrong baseline (resolved)

`arbBalTarget` (id 40) and `arbBalDelta` (id 54) are both stored as *deltas*
from `naturalMechBalanceOf(ch)`, specifically so a shared build "re-targets
correctly against whatever chassis it's applied to." But `useMeasuredNatBal`/
`measuredNatBal` were excluded from the codec, on the assumption that this
followed the same "computed-locally, shared-as-output" pattern as
`useRideHeightCG`. It didn't: `ch.cgHeight` (ride-height CG's output) is a
self-contained absolute value, but `naturalMechBalanceOf(ch)` is the *baseline*
a delta gets re-expanded against on the receiving end. Since the measured
override never travelled, a receiver always decoded with
`useMeasuredNatBal=false`, so the baseline silently fell back to geometry —
which can differ substantially from what the sender measured in-game (the
MEASURE NAT BAL entry above cites a real 0.49-vs-0.42 case). The delta then
re-expanded against a different baseline than the sender used, so the
receiver's absolute Mech Balance Target silently diverged from what the sender
actually tuned toward. The identical gap affected GRIP mode, since
`gripBalTarget = 1 - natGripBalance + arbBalDelta` and `natGripBalance` has the
same measured-or-geometry split.

Fixed by adding `useMeasuredNatBal`/`measuredNatBal` to the codec as ids 60/61
(`group:'ch'`, same reasoning as `motionRatioF/R`) — see
[CODEC.md](CODEC.md) for the field table and semantic-change note. Also
widened `sanitizeTune`'s decode clamp on `arbBalTarget` from a flat `±0.70` to
`[0.20-natMechBalance, 0.90-natMechBalance]`, matching the live Field's actual
reachable range (the flat clamp could silently truncate deltas beyond ±0.70 for
chassis with a low natural balance). Verified in-app: with MEASURE NAT BAL set
to 0.65 and Balance Target in GRIP mode, the generated share code decodes
(`60:1|61:0.65`) to the same NAT/TARGET values (0.65/0.42) as the sender after
loading it into a reset instance; an old-format code without ids 60/61 still
decodes cleanly with `useMeasuredNatBal` falling back to its default.

## Fixed — NEUTRAL+AUTO ARB budget could blow up with ARB Bias + high Rear Multiplier (resolved)

`computeTune`'s NEUTRAL ARB balance mode (AUTO stiffness only) expands
the ARB roll-stiffness budget when the natural AUTO budget is
too small to let the F/R split fully cancel the springs' balance-bar bias.
That expanded budget was computed once, before ARB Bias was applied — but
ARB Bias then shifts the split away from that exact-cancel point anyway. At
a high Rear Multiplier (1.25×+ — springs strongly rear-biased) combined
with ARB Bias pushed to REAR HEAVY, this left both front *and* rear ARB
oversized (a real case hit 63.1/65.0, both effectively maxed) instead of
the moderate values a rear-heavy bias should produce.

Fixed by only running the expansion when ARB Bias is centred (`0`) — the
only case where "reach exact cancellation" is the actual goal. Any nonzero
bias means the user has already opted out of exact cancellation, so the
budget stays at its natural AUTO size. Verified: same car (2.90 Hz front,
1.25× rear multiplier) with ARB Bias at full rear-heavy went from 63.1/65.0
(MAX/MAX) to 18.9/19.7 (LOW/LOW); ARB Bias at 0 is unaffected (still
reaches the springs-cancelling split and still shows "ARB MAXED — CAN'T
FULLY CANCEL" honestly when the game's 65-click limit is a genuine
constraint).

## Fixed — MEASURE NAT BAL calibration was ignored by WEIGHT/NEUTRAL ARB modes (resolved)

The Tune Check "MEASURE NAT BAL" flow lets a PRO user replace the
track-width geometry prediction with an actual in-game Mech Balance
reading (`ch.measuredNatBal`, read via `naturalMechBalanceOf(ch)`). That
calibration only ever reached `resolveArbBalTarget` — the MECH/CO-SOLVE
target and the informational "NATURAL"/"CUR" display — never the ARB
split WEIGHT and NEUTRAL modes actually compute. Both of those read raw
`ch.frontBias` directly (`arbBalance` in `feelToPhysics`, and NEUTRAL's
`nf0` in `computeTune`), completely bypassing the calibration.

Since WEIGHT is the default mode, this meant a user's in-game measurement
had zero effect on their actual tune for anyone not specifically in
MECH/CO-SOLVE. Real case: measured 0.49 in-game, calculator predicted
CUR 0.42 (from the uncalibrated formula), applied tune actually read 0.50
in Forza — an 0.08 gap the calibration was supposed to prevent.

Fixed by adding a new PRO-only Balance Mode, **CHASSIS** (`index.html`
`computeTune`, `arbBalMode==='chassis'` branch) — same split formula as
WEIGHT, but anchored to `naturalMechBalanceOf(ch)` instead of raw
`ch.frontBias`, so it honours a MEASURE NAT BAL reading (or at minimum the
track-width-corrected geometry) instead of the cruder heuristic. WEIGHT
and NEUTRAL themselves were deliberately left unchanged — swapping their
formula would shift ARB output for every BEG/INT tune too, since
`naturalMechBalanceOf`'s fallback is track-width-weighted even at default
geometry, not just weight-fraction. CHASSIS scopes the fix to PRO only.

## Fixed — MECH/CO-SOLVE solved a real correction against a MEASURE NAT BAL target that needed none (resolved)

A deeper version of the bug above, found by a user with a 50/50-weight-distribution
car whose measured natural balance (0.55) differs from what the track-width
geometry formula predicts (~0.49, since the front track is wider than the
rear). `resolveArbBalTarget` correctly resolves the MECH/CO-SOLVE **target**
through `naturalMechBalanceOf(ch)` (the measured reading, when set). But the
solvers that figure out *how much springs/ARBs need to move* to reach that
target — `resolveCoSolveSpringShare`'s `R_baseline`, `feelToPhysics`'s CO-SOLVE
Kcs pre-inversion `Rbl`, and `computeTune`'s ARB-split `_mechTgt`/final
`mechBalance` — all independently recomputed the *geometric* equal-Hz,
zero-ARB ratio from raw track width/mass, never consulting
`naturalMechBalanceOf(ch)`. So even with the Mech Balance Target sitting at
"0 from NAT" (target = the measured 0.55 exactly — the UI's own documented
meaning: "no ARB correction needed"), CO-SOLVE saw a target of 0.55 against a
baseline of 0.49 and "corrected" a 0.06 gap that wasn't real, biasing the rear
spring Hz (~1.09–1.20× front) and skewing the ARB split (e.g. 40/60F/R)
instead of leaving both alone. Confirmed live: user's share code
`1|1:2021|2:50|...|60:1|61:0.55` (measured 0.55, weight distribution 50/50,
CO-SOLVE, ROLL stiffness mode) read CUR 0.64 against TGT 0.55 with the rear
spring pinned to REAR ×1.20 — nowhere near the "0 correction" state the 0-delta
target promised.

Fixed by treating the gap between `naturalMechBalanceOf(ch)` and the plain
geometric formula as a constant offset — the same treatment `tireCorr`
already gets — instead of substituting the measured value directly into the
ratio-inversion math (an earlier attempt at this fix did exactly that and made
things worse: it forced the Hz solve to fake-match the measured ratio through
the geometry formula, distorting springs even further from equal). The
offset is subtracted from the solve target going in and added back to the
reported balance coming out, at all three sites, so it cancels in the final
reported `mechBalance` (unchanged) while correctly zeroing the *work* the
solver thinks it needs to do when target and NAT coincide. Verified live with
the reported share code: springs now read REAR ×0.98 (matching the same
small residual `tireCorr` offset the *unmeasured* geometric case shows at its
own natural target — i.e. identical relative behavior, not a new distortion),
ARB split reads 52/48F/R (vs 40/60 before), and MECH BALANCE reads
`NAT 0.55 → CUR 0.55 → TGT 0.55`. `tests.js` (111) and `tests-beamng.js` (41)
unaffected.

**Follow-up (now also fixed):** the `rearHzMode==='mech'` Hz-ratio solve in
`feelToPhysics` (reached whenever Ride Frequency Mode is MECH, for ARB
Balance Modes `weight`/`manual`/`mech` — everything except CO-SOLVE, which
has its own pre-inversion above) had the identical gap: its `rsBalTgt` was
`fe.arbBalTarget` clamped straight through with no tyre-width or NAT-BAL
correction, then fed directly into the same raw track-width/mass ratio
inversion used everywhere else. Confirmed with the same share code
(RIDE HZ MODE = MECH, ARB BAL MODE = MECH): target sitting exactly on the
measured NAT (0.55, 0-delta) still produced `rHz/fHz = 1.1274` instead of
~1.00. Fixed with the same additive-offset treatment — `tireCorr_m` and
`natOffset_m` (gap between `naturalMechBalanceOf(ch)` and the block's own
geometric `_rsBalNat_m`) are now subtracted from `rsBalTgt` before it enters
the ratio math, in both the `shared`-reference and `front`/`rear`-reference
copies of this block. Verified live: `rHz/fHz` now reads 0.9809 (the same
residual as the CO-SOLVE fix — parity, not a new distortion) and
`mechBalance` reads 0.5500 against the 0.5500 target for both `rideRef`
settings. `tests.js`/`tests-beamng.js` still 152/152.

Also checked ARB BAL CHASSIS (`arbBalMode==='chassis'`) while auditing the
other modes — it already anchors directly to `naturalMechBalanceOf(ch)`
(`const natPct=naturalMechBalanceOf(ch)*100`) rather than inverting a ratio
against a geometric baseline, so it was never affected by this bug class.

## Fixed — CO-SOLVE Auto Spring Share fell far short of large Balance Target bias values

Follow-up to the fix above, found on a rear-biased test car (40/60 weight
distribution) whose measured NAT sat 0.08 below the geometric estimate —
then a Balance Target bias was dialed ±0.05–0.15 away from that NAT on top.
CO-SOLVE with **Auto Spring Share** (the default) undershot badly at the
larger bias values — e.g. bias +0.15 (target 0.646) only achieved 0.535, an
11% miss — while switching Spring Share to **manual** and pushing it to
~100% reliably landed within 0.03% of every target in the same sweep. That
gap meant Auto Spring Share was leaving the correction on the table it was
capable of making.

Root cause: `resolveCoSolveSpringShare`'s Auto Spring Share search
(`simUtil`/bisection) picks `S` — how much of the correction springs take
vs. ARBs — by searching for where a spring "utilization" measure crosses an
ARB "utilization" measure. But `abUtil` (`Math.max(abF_s,abR_s)/utilRef`)
only measured how close ARB sat to the **ceiling**. When a large correction
drives one ARB axle toward zero, `abUtil` read as comfortably low — the
search saw no problem and settled on a low `S`, handing most of the
correction to a low-budget ARB. In reality that near-zero axle gets floored
up to the game's 1-click minimum by `clk()` later in `computeTune` — real,
extra stiffness the split never asked for, which steals back part of the
correction ARB was supposed to deliver, and the search never saw it happen
because `simUtil` doesn't model the floor.

Fixed by adding a floor-strain term to `simUtil` — `1/max(0.05, min(abF_s,
abR_s)) - 1`, unbounded the same way ceiling overshoot already is — so
wanting an axle near zero is now treated exactly like wanting one past the
ceiling: both mean "ARB can't cleanly express this split," and the search
hands more of the correction to springs instead of stopping early. Verified
live on the same rear-biased car across a full bias sweep (±0.15): the
worst-case error dropped from ~11% to ~0.13%, and every other point in the
sweep landed under 0.15%. `tests.js` (111) and `tests-beamng.js` (41) both
still pass — the bias=0 / small-bias / default cases the existing test suite
covers were already comfortably inside ARB's floor and ceiling, so `S`
there is unchanged.

## Changed — ARB MAN moved from Balance Mode to Stiffness Mode

MAN (direct front/rear ARB click entry) used to live under Balance Mode
(`arbBalMode:'man'`) alongside WEIGHT/NEUTRAL/MECH/CO-SOLVE. It's now a
Stiffness Mode option (`arbMode:'man'`, alongside AUTO/ROLL/SHARE)
instead, since it bypasses the entire budget+split system rather than
choosing a split within a budget — a stiffness-level concept, not a
balance-level one. Selecting Stiffness Mode MAN now hides Balance Mode
entirely (nothing left for it to control).

Old share codes/saves with `arbBalMode:'man'` still load correctly: a
migration in `sanitizeTune` (share-code path) and a matching one-time
`useEffect` in `App()` (persisted-state path) both rewrite it to
`arbBalMode:'manual'` + `arbMode:'man'` on load — see
[CODEC.md](CODEC.md)'s notes on id 41 for the encoding side of this.

This entry and [CODEC.md](CODEC.md) both said `'weight'` until an audit
checked them against the code. The destination is the invisible `'manual'`
placeholder (`ARB_BAL_MODE_DEC` index 6), added precisely so that migrating
off MAN doesn't light up a Balance Mode button the user never chose —
landing on WEIGHT would defeat the placeholder's whole purpose.
[CODE_MAP.md](CODE_MAP.md)'s retained-legacy section had it right
throughout; the two that were wrong have been corrected.

## Fixed — MATCH CHASSIS ignored layout polarity for FWD (resolved)

`computeDiff`'s MATCH CHASSIS correction biases
`diffBiasExit`/`diffBiasEntry` toward the Mech Balance Target's gap from
natural balance. The correction was applied with the same sign regardless
of drivetrain layout — but more front-axle lock means *understeer* on a
FWD car, while more rear-axle lock means *oversteer* on RWD/AWD (see
[FORMULAS.md](FORMULAS.md)'s `bDiffAccel`/`bDiffDecel` signs). So on a FWD
car with MATCH CHASSIS on, wanting more oversteer would push the correction
the wrong way — toward more front lock, i.e. more understeer.

Fixed by flipping the correction's sign for `ch.layout==='FWD'` only (RWD/AWD
unaffected — their diff-lock polarity already matches the correction's
assumption). Verified manually: FWD Accel lock reads 17% with MATCH CHASSIS
off (baseline), and correctly *drops* to 13% with it on and a
oversteer-wanting target — previously it would have risen instead.

**Lesson:** any correction/nudge formula that's derived assuming one
drivetrain's polarity needs an explicit per-layout check before being
applied generically. This is the same class of bug as the Damping Bias
hint-text mismatch (see [FORMULAS.md](FORMULAS.md)) — trust the underlying
`bXxx` balance formulas over intuition when wiring up a new correction.

**Not a bug (re-verified after an external report claimed otherwise):**
the EXIT slider's UI code flips the sign of the
stored `dr.diffBiasExit` value for FWD only, so the slider's right side
reads as oversteer-leaning despite FWD's lock-to-balance polarity being
opposite RWD/AWD's. `computeDiff`'s `+effBiasExit*0.15` term for FWD
is *intentionally* the same sign as RWD's — the UI flip
already carries the per-layout inversion, so the formula doesn't need to.
An external review (Gemini) analyzed the formula in isolation, missed the
UI-level flip, and proposed flipping the formula's sign too — which would
double-cancel and silently reintroduce this exact bug. Re-verified live:
FWD EXIT slider at −50 ("PUSH") reads Accel 30%; at +50 ("ROTATION") reads
Accel 15% — correctly less lock on the oversteer-leaning side. Both sites
now cross-reference each other in comments to prevent this specific
misdiagnosis from recurring. (The slider's left/right labels were later
unified to GRIP/ROTATE across all layouts for UI consistency — FWD no
longer shows PUSH/ROTATION specifically — but the underlying sign-flip
logic and this verification are unaffected, since only the label text
changed, not the polarity.)

## Fixed — Test coverage gaps: `computeDiff` and `computeAlignment` now covered (resolved)

`tests.js` gained suites for both, previously untested:

- **`computeDiff`**: layout-dependent lock/balance signs for RWD/FWD/AWD,
  diff type scaling (drift/offroad vs race), SPORT's decel lockout, MANUAL
  mode bypassing MATCH CHASSIS, and a regression guard for the MATCH
  CHASSIS FWD-polarity bug above — exactly the test that would have caught
  it immediately instead of it surviving until manual testing.
- **`computeAlignment`**: roll/CG-height compensation, layout-dependent
  camber gain ordering (FWD least reactive, RWD most), the front camber
  clamp floor, toe front/rear lookup-table sanity, caster's FWD flat
  reduction, and a regression guard for the Drift/Drag frozen-camber bug
  above. Writing it also caught a real error in this file's own toe-front
  documentation (see [ALIGNMENT.md](ALIGNMENT.md) — the `(fHz-1.8)×0.010`
  term's direction was written backwards).

## Fixed — `bDiffDecel` pushed the same direction as `bDiffAccel` instead of resisting it (resolved)

Per [FORMULAS.md](FORMULAS.md), the Handling Balance model treated *any*
lock magnitude (accel or decel, on whichever axle is driven) as pushing
the same oversteer/understeer direction. Real-world tuning intuition (and
this app's own EXIT/ENTRY slider hint text) treats decel lock as more
nuanced — e.g. "STABLE increases rear decel lock, which *resists*
lift-off oversteer" implies decel lock reduces oversteer risk, not that it
straightforwardly adds to an oversteer number the way accel lock does. For
RWD/AWD-rear, the old formula had `bDiffDecel` scaling *positive*
(oversteer) with more rear decel lock — directly contradicting the ENTRY
slider's own "resists lift-off oversteer" hint text.

Fixed by flipping `bDiffDecel`'s sign on the driven axle for RWD and
AWD-rear so decel lock always contributes **understeer**, regardless of
layout (`bDiffDecel = -vals.decel*(1-nf)*DIFF_BIAS_SCALE` for RWD; `bRD =
-vals.rearDecel*(1-nf)*C*DIFF_BIAS_SCALE` for AWD). FWD's decel term was
already correct (front decel lock → understeer, matching its own hint
text: "more resistance to rotation on entry") and was left unchanged.
Net effect: decel lock's direction no longer depends on layout the way
accel lock's does — it's understeer-pushing everywhere, matching the
"decel lock resists rotation" tuning intuition. Updated the balance-bar
hint text and the `HandlingVerdict` dominant-contributor tip for "diff
entry" (which previously assumed rear-decel-dominant meant oversteer, and
inferred FWD vs RWD/AWD from the total's sign rather than checking
`diffLayout` directly) to match. See [FORMULAS.md](FORMULAS.md) for the
corrected formula. Verified via `tests.js`'s `computeDiff` layout-sign
suite (`RWD: bDiffDecel negative (understeer) at high lock`).

## Fixed — damping ζ% output showed the pre-clamp target, not what the click value actually does (resolved)

Found immediately after the Damping Balance Mode work above, via a direct design question: ARB
already has a deliberate, documented precedent for this (`rsAbF`/`rsAbR` are recomputed from
the clamped, rounded ARB click values rather than the pre-clamp roll-stiffness target — "so the
balance bar shows what the game will really do," see the BeamNG plan's correction #4 in git
history and [PHYSICS.md](PHYSICS.md)). Damping never got the same treatment: `computeTune`
solved `zetaF`/`zetaR`/`bumpZetaF`/`bumpZetaR` once, used them to compute the raw damper
coefficient, scaled/clamped/rounded *that* into the final `rebF`/`rebR`/`bumpF`/`bumpR` click
values — and then kept displaying the original pre-clamp ζ everywhere (output card sub-labels,
`settleF`/`settleR`, and `bDampBias`'s Handling Balance contribution), even when clamping had
silently pulled the real value far below it. A car requesting 115% ζ on a heavy build could
clamp to 18.1/20.0 clicks (a real ζ of ~17%) while every ζ% readout in the app kept saying 115%.

Fixed by adding `impliedZeta` (the exact inverse of `solveDampRaw`) and reassigning
`zetaF`/`zetaR`/`bumpZetaF`/`bumpZetaR` from the final click values immediately after they're
solved, so everything computed from them afterward — `settleF`/`settleR`, the output cards,
`bDampBias` — describes the click value actually shown, not the target that produced it before
clamping. Verified live: the 115%-target/heavy-car scenario above now correctly reads 17% ζ on
both axles (front and rear converge on the *same* implied ζ despite different Hz/mass and
different final click values, since `solveDampRaw` is linear in ζ — a proportional click
scale-down is mathematically identical to scaling ζ by the same factor). An unclamped scenario
is unaffected beyond ~0.1-click rounding noise. Four regression tests added to `tests.js`
(`impliedZeta — inverse of solveDampRaw...`): a round-trip identity check, a clamped scenario
confirming the implied ζ lands well below an unreachable target, and an unclamped scenario
confirming near-exact agreement.

## Fixed — Damping Balance Mode was hardcoded to SYNC-equivalent under SETTLE TIME (resolved)

Shipped alongside the Damping Balance Mode feature and caught the same day, before release,
after a user pointed out the flaw directly: REBOUND MODE (CHARACTER/SETTLE TIME) and Damping
Balance Mode (STANDARD/SYNC/NEUTRAL) are two independent decisions — REBOUND MODE only decides
how a single anchor ζ is obtained (typed directly, or back-solved from an absolute settle-time
target); Damping Balance Mode decides how that one value becomes a front/rear split. The
initial implementation conflated them: `feelToPhysics` special-cased `dampCharMode==='settle'`
into always using the SYNC formula (`settleZetas`), and the UI hid the Balance Mode selector
entirely under SETTLE TIME on the (wrong) assumption that STANDARD/NEUTRAL had no meaning
there.

Fixed by extracting a single `baseZeta` value (typed `reboundZeta` under CHARACTER, or the
settle-target back-solve under SETTLE TIME) and running the *same* STANDARD/SYNC/NEUTRAL
dispatch against it regardless of REBOUND MODE. Under SETTLE TIME, only SYNC now guarantees
both axles hit the target time — STANDARD/NEUTRAL still anchor the reference axle to it
exactly, but the other axle's real settle time is whatever that mode's split produces, reported
honestly rather than forced equal. Verified live: STANDARD under SETTLE TIME shows the
reference axle exactly at target with the other axle deviating; NEUTRAL produces a third,
distinct split; SYNC still shows EQUAL — all three now behave distinctly under both REBOUND
MODEs.

## Fixed — SETTLE TIME's zeta and bump readouts fell back to the frozen CHARACTER default (resolved)

Two further bugs found immediately after the above fix, while verifying it — both are the same
root mistake in different call sites: reading `fe.reboundZeta`/`physics.reboundZeta`/
`physics.bumpZeta` (the raw CHARACTER-mode inputs) instead of the actual computed
`physics.zetaF`/`physics.bumpZetaF` (which correctly reflect whichever REBOUND MODE + Damping
Balance Mode combination is active).

1. **A DAMPERS-section readout box showed the frozen default instead of the live value.** Its
   `biased` flag (whether to show a two-column F/R breakdown vs. a single combined number) was
   `(fe.dampingBias??0)!==0` — true only when the bias slider is off-centre. But SYNC/NEUTRAL
   can diverge front-to-rear *at bias 0 too* (Hz/mass differ even unbiased), and the "not
   biased" branch displayed `physics.reboundZeta`/`physics.bumpZeta` — fields that are always
   `fe.reboundZeta`/a `reboundZeta`-derived value, never updated for SETTLE TIME's back-solved
   anchor. Reported as "some parts say the correct zeta value, where others report the default
   70%." Fixed by deriving `biased` from actual `zetaF`/`zetaR` divergence
   (`Math.abs(physics.zetaF-physics.zetaR)>0.5`) and using `physics.zetaF`/`physics.bumpZetaF`
   in both branches — the single-number case is now just "the front value," which already
   equals the rear value whenever they're not meaningfully biased, instead of a stale fallback.
   The same stale-field pattern was also found and fixed in the DampingDial visual (VISUALS
   card), the Bump Ratio slider's own preview readout, and the INDEPENDENT bump-mode toggle's
   seed value (all three now read `physics.zetaF`/`physics.bumpZetaF` unconditionally, dropping
   redundant `dampCharMode==='settle'` special cases entirely).

2. **Bump output stayed frozen regardless of Hz.** `bumpZeta` (the RATIO-mode intermediate,
   consumed by the STANDARD branch's %-split and by the INDEPENDENT-bump fallback) was computed
   from the raw `reboundZeta` (`fe.reboundZeta`, the CHARACTER-mode default) rather than
   `baseZeta` (the value REBOUND MODE actually anchors to). Under SETTLE TIME + STANDARD, this
   meant Front Bump/Rear Bump — real output values, not just a display readout — never changed
   when Ride Stiffness or the Settle Target moved, staying pinned at whatever
   `70×bumpRatioVal/100` worked out to. Reported as "damping outputs don't change when the Hz
   is altered, but the zeta is updated" (Rebound ζ *did* correctly track Hz via `baseZeta`;
   Bump ζ silently didn't, because its own anchor computation ran before `baseZeta` existed and
   was never updated to use it). Fixed by reordering `feelToPhysics` so `baseZeta` is computed
   first and `bumpZeta`'s RATIO-mode branch reads it instead of `reboundZeta`. Verified live:
   Front Bump moved from 39% (frozen) to 10% at Hz 3.00 and 26% at Hz 1.00, matching
   `baseZeta×bumpRatioVal/100` exactly at each point. A regression test
   (`tests.js`, "SETTLE TIME mode: bumpZeta anchors to baseZeta, not raw reboundZeta")
   explicitly compares the fixed formula's Hz-sensitivity against the buggy formula's frozen
   output.

**Lesson:** when a feature introduces a new "real" source of truth for a value (`baseZeta`
composing REBOUND MODE with Damping Balance Mode), every existing call site that read the old
raw input directly (`fe.reboundZeta`, `physics.reboundZeta`, `physics.bumpZeta`) needs an
explicit audit — grep for the retired field's every use, not just the primary computation path.
Both of these were readout/display and derived-value sites well outside the formula that was
the actual focus of the change, which is exactly why they were missed on the first pass.

## Fixed — legacy Settle Sync migration silently dropped SYNC on GARAGE-loaded builds (resolved)

Shipped alongside the Damping Balance Mode feature (STANDARD/SYNC/NEUTRAL replacing the old
boolean "Settle Sync" toggle) and caught the same day, before release. `migrateDampBalMode`,
the helper that converts a legacy `settleMode`/`settleBias` pair into the new `dampBalMode`/
`dampingBias` fields, originally decided whether to migrate by checking
`DAMP_BAL_MODE_DEC.includes(fe.dampBalMode)` — "does this object already have a valid balance
mode?" That check is unreliable: `decodeTune` pre-fills *every* `CODEC_FIELD` (including
`dampBalMode`) with its default before overlaying whatever ids a code actually carries, and
`mergeDefaults`/`{...DEF_FE,...e.fe}` do the same for persisted state and GARAGE entry loads.
So a legacy object that still carried `settleMode:true` also arrived with `dampBalMode`
already sitting at `'standard'` — inherited from the spread, not actually chosen — and the
naive check treated that as "already migrated," silently discarding the real
`settleMode`/`settleBias` values.

This was invisible in the two paths exercised during initial testing (a hand-rolled test
object with no `dampBalMode` key at all, and the one-time persisted-state migration effect,
whose *outer* `if(fe.settleMode!=null)` guard happened to make the inner bug unreachable) but
broke the third: `garageLoadBuild`, which loads a saved GARAGE "build" entry into live state.
Loading any build entry saved before this feature existed — with Settle Sync switched on —
silently reverted it to STANDARD mode instead of the equivalent SYNC mode, with no warning.

Fixed by making `fe.settleMode`'s mere *presence* (not `fe.dampBalMode`'s value) the migration
trigger — `settleMode` is only ever present on a pre-migration object, since nothing in the
app writes it anymore, making it the only reliable signal. Also routed `garageLoadBuild`
through the same shared `migrateDampBalMode` helper as `sanitizeTune` and the persisted-state
effect (it previously did a raw `{...DEF_FE,...e.fe}` merge with no migration at all — the
proximate bug reported as "settle time isn't working"). Verified by seeding a legacy GARAGE
entry (`settleMode:true, settleBias:-20`) directly into `localStorage` and loading it via LOAD
BUILD: now correctly resolves to `dampBalMode:'sync', dampingBias:20`. Four regression tests
added to `tests.js` (`migrateDampBalMode — legacy Settle Sync migration`), specifically
including the "dampBalMode already default-filled" case that let this ship in the first place.

**Lesson:** a field's mere presence/validity is not proof it was *chosen* — defaulting logic
(`mergeDefaults`, `decodeTune`'s pre-fill) can populate a "new" field on an old object before
migration code ever sees it. The reliable signal for "does this need migrating" is the
presence of the *legacy* field being replaced, not the absence or validity of the new one.

## Fixed — CHASSIS Balance Mode's SAME/OPPOSITE Split Direction was inverted (resolved)

`computeTune`'s `arbBalMode==='chassis'` branch is meant to mirror WEIGHT's
SAME/OPPOSITE split-direction toggle exactly, just anchored to
`naturalMechBalanceOf(ch)` (a rear roll-stiffness fraction) instead of raw
`ch.frontBias`. WEIGHT's formula is `(arbSplitOpposite ? ch.frontBias :
(100-ch.frontBias)) + arbBias*0.4` — SAME uses the *rear* weight fraction
(`100-frontBias`) directly as `rF` (the rear ARB fraction consumed
downstream by `arbR=budget*rF`). CHASSIS used `(arbSplitOpposite ? natPct :
(100-natPct))` — but `natPct` is already a rear fraction (same role as
`100-ch.frontBias`, not `ch.frontBias`), so the two branches were swapped
relative to WEIGHT's pattern.

Effect: selecting **SAME** in CHASSIS mode actually mirrored the ARB split
*away* from the chassis's natural balance (behaved like OPPOSITE), and
**OPPOSITE** actually reinforced it (behaved like SAME) — contradicting
both the function's own inline comment and the in-app Split Direction hint
text ("SAME tracks the reference balance directly — a front-heavy car gets
a front-heavy ARB split... this is how WEIGHT/CHASSIS behave by default").
PRO-only (CHASSIS mode is PRO-gated) and untouched by `tests.js`, which has
no CHASSIS-mode coverage — nothing caught it before a manual code review.

Fixed by swapping the ternary branches to `(arbSplitOpposite ?
(100-natPct) : natPct)`, matching WEIGHT's SAME/OPPOSITE mapping. Verified
in-app: default chassis (`NAT 0.47`, i.e. front is naturally 53% of roll
stiffness) now reads **F 53% / R 47%** under SAME (front-heavy chassis →
front-heavy ARB split, correct) and **F 47% / R 53%** under OPPOSITE
(mirrored around 50/50, correct) — previously these were swapped.

## Fixed — Alignment Mode's MECH/GRIP nudge was nearly invisible (resolved)

The ALIGNMENT sidebar presented BUILD/MECH/GRIP/MANUAL as four co-equal
buttons, but comparing their output showed the differences were hardly
noticeable. Two compounding causes: (1) the MECH/GRIP toe nudge
(`±0.05×k`) was smaller than `computeAlignment`'s 0.1° toe rounding step for
most realistic gaps/strengths, so it got rounded away to nothing — toe
essentially never visibly changed between modes; (2) GRIP's gap
(`gripGap = -(natGripBalance-0.5)*2`) was pre-scaled `×2` relative to MECH's
gap before both hit the same `/0.30` saturation clamp, so GRIP reliably
nudged at full strength while MECH rarely did, despite the two being shown
as equivalent options.

The 0.1° toe rounding itself is correct and was kept — Forza's toe input
only accepts one decimal place, so a finer grid would recommend values that
aren't actually enterable in-game (an earlier pass at this fix tried
rounding to 0.05° instead, which had to be reverted for that reason). Fixed
instead by doubling the toe nudge coefficient (`0.05`→`0.10`, see
[ALIGNMENT.md](ALIGNMENT.md)) so a fully-saturated nudge can cross one whole
0.1° step, dropping GRIP's `×2` pre-scale so both nudge sources sit on the
same raw scale, and restructuring the sidebar into an AUTO (→ Nudge:
OFF/MECH/GRIP) / MANUAL hierarchy instead of four flat peer buttons, since
BUILD/MECH/GRIP were never actually equal alternatives — MECH/GRIP are small
nudges layered on the BUILD baseline, and MANUAL is a full bypass. At
typical (non-saturated) gaps/strengths, toe still often rounds back to
BUILD's value — that now reflects the real precision ceiling rather than a
formula bug.

## Fixed — `computeAlignment` was blind to the car's actual balance tuning (resolved)

`computeAlignment` only reacted to build type, drivetrain layout, front
weight bias, front/rear spring Hz, and roll angle — never `natMechBalance`,
`gripBalance`, or the resolved Mech Balance Target. Two cars with identical
build+layout but very different balance tuning got identical camber/toe/
caster recommendations.

Fixed by adding a PRO-only **Alignment Mode** selector (BUILD/MECH/GRIP/
MANUAL) with a Nudge Strength slider — see
[ALIGNMENT.md](ALIGNMENT.md)'s "Alignment Mode (PRO)" section for the full
formula. `computeAlignment` itself (BUILD mode) is unchanged; the nudge is
layered on top, opt-in per mode rather than an always-on background
adjustment, so the design question ("which signal, how strong") became a
user choice instead of something we had to bake in.

## Fixed — Drift/Drag camber ignored CG height and roll angle (resolved)

Every other build's camber target scaled with `rollDeg×camberGain` (itself
derived from `cgHeight`) — see [ALIGNMENT.md](ALIGNMENT.md)'s Camber table.
Drift and Drag instead returned fixed constants regardless of those inputs,
so two drift cars with very different CG heights got the same camber
recommendation.

Fixed by folding Drift (`optimalCamber:-2.5`) and Drag (`optimalCamber:-0.2`)
into the same roll-compensated formula every other build uses, instead of a
separate branch with hardcoded values. Verified manually: Drift camber now
moves from −1.2° to −4.0° (clamp) as CG height goes from 450mm to 800mm on
the same car, where it used to stay frozen at −3.0° regardless.

## Fixed — Dead-code audit (resolved)

A full pass over `index.html` removed code that no consumer referenced —
unreferenced scalars and constants, dead object keys (including
`PRESET_SAVES`' unused `notes` field — *not* the same `notes` field later
added to unified GARAGE entries, which is live user data; same name,
different thing, don't remove it on a future sweep), dead component props,
and two large discarded blocks (a duplicate tyre-width recommendation chain,
and a ~20-binding IIFE prologue whose live twin sat ~550 lines further
down and had already drifted — it destructured a `gap` key
`chassisAnalysis` doesn't return, so its guard was permanently false). The
full itemised inventory lives in the commit messages, not here — `git log
--grep "Dead-code cleanup"` for the pass, `git log -S<identifier>` for any
individual removal.

**Why this needed a custom verification method.** `tests.js` cannot detect
breakage in `index.html` (it duplicates the physics rather than importing
them), and there is no linter or CI. So the pass was gated on a zero-diff
browser harness instead: nine `localStorage` fixtures covering BEG/INT/PRO,
all three ride references, CO-SOLVE, MECH with off-centre weight bias,
asymmetric tyres, and MANUAL alignment; each captured the `outerHTML` of
every `#zone-*` section after expanding all sections and the handling-balance
panel. Because everything removed was unreferenced, the pass criterion was
byte-identical output. Baseline reproducibility was confirmed first (same
fixture, two reloads, zero diffs). Every phase came back CLEAN.

Two limits of that harness are worth recording. It only sees rendered DOM, so
**tooltip text is invisible to it** — `Hint` content is not in the document
until the tooltip is opened, which is exactly how the ALIGNMENT hint bug below
escaped notice. And it cannot reach state that only arises mid-migration.

## Fixed — ALIGNMENT card hint said "Recommended starting point" in MANUAL mode (resolved)

The output panel's ALIGNMENT card built its hint prefix from
`al.alignManual` — a legacy boolean that nothing sets true (`DEF_AL` defines
it `false`; the alignment UI writes `al.mode`). So the hint described the
values as a recommendation even when the user had typed them in by hand.

Fixed by testing the resolved `alignMode` instead. The `al.alignManual`
fallback inside `alignMode` itself, and its `DEF_AL` entry, both stay — they
still migrate state saved before `al.mode` existed.

Found during the dead-code audit but fixed separately, since it changes
behaviour and the cleanup was deliberately zero-diff.

## Fixed — FLAT RIDE offset was doubled, biasing every fresh install toward oversteer (resolved)

`flatRideRearHz` computed `1/rearHz = 1/frontHz − 2·(wheelbase/speed)`. The rear
wheel meets a bump **one** traverse time after the front, not two, so the offset
should be `t`. No comment or doc justified the doubling and git history doesn't
reach past the original single-file import.

FLAT RIDE is `DEF_FE.rearHzMode`, so this was the out-of-box state. On a fresh
install with stock defaults the app produced:

| | before | after |
|---|---|---|
| rear/front Hz ratio | ×1.43 | ×1.18 |
| rear spring | 494 lb/in (**RACE** band) | 334 lb/in (FIRM) |
| handling balance | **+14.9 oversteer** | +6.5 |

Front sat at 1.75 Hz in the ROAD band throughout, so a new user's first view was a
road-frequency front axle paired with a race-frequency rear, and a balance bar
already reading strongly oversteer before they had touched a control.

It also degraded as the user tuned, which is the wrong way round for a default —
the ratio climbed with stiffness (×1.76 at 2.5 Hz front, ×2.07 at 3.0 Hz, where it
hit the `HZ_MAX` ceiling) and with lower target speeds (×3.39 at 30 mph). Olley's
flat-ride rule of thumb is rear ≈10–20% higher in *frequency* than front (every
ratio here is a frequency ratio, not a spring-rate one); the corrected form
gives ×1.18 at the default and stays inside ×1.35 across the practical range.

**This changes output for existing FLAT RIDE tunes**, including saved garage
entries and shared codes — those store the *mode*, not the resolved Hz, so they
re-solve with the corrected offset and get a softer rear. Accepted deliberately as
a bug fix rather than versioned behind a toggle.

`flatRideSharedHz` inverts the same relationship and was re-derived to match
(`t·fHz² − fHz·(2 + 2·avg·t) + 2·avg = 0`); a round-trip check over 24
speed/stiffness combinations confirms the solved pair still averages to the target
and agrees with `flatRideRearHz`.

Two notes for future work:

- `tests.js` kept passing after the app was fixed, because it **mirrors** the
  formula rather than importing it — exactly the silent-drift hazard
  [CODE_MAP.md](CODE_MAP.md) warns about for that file. The mirror is now updated and four assertions pin the
  resulting ratio, so a re-doubling fails immediately.
- The two clamp/band assertions in that suite encoded the old formula's numbers
  rather than independent physics, so their fixtures had to be re-derived. Worth
  remembering that "the tests pass" said nothing here.

## Fixed — Fresh installs defaulted to a track build with a comfort-oriented Hz mode (resolved)

Fixing the `2t`→`t` offset above corrected FLAT RIDE's own math, but FLAT RIDE was
still `DEF_FE.rearHzMode`, and `DEF_DR.buildType` defaulted to `'track'`. Research
into flat-ride methodology (see the caveat now in
[PHYSICS.md](PHYSICS.md#rearsecondary-hz-modes)) found the literature explicit that
flat ride is a comfort/road philosophy — Race Comp: *"Many racecars do not use flat
ride and there can be benefits to higher front frequencies"* — which is backwards
for a `track`-flagged fresh install.

Changed both fresh-install defaults:

- `DEF_FE.rearHzMode`: `'flatRide'` → `'multiplier'` at the existing `rearHzMult:1.20`
  (already the upper end of Penske/Race Comp's published 10–20% band).
- `DEF_DR.buildType`: `'track'` → `'street'`.

**`buildType` could not change alone.** `recommendedDiffType` maps
`street→'sport'`, `track→'race'`; `DEF_DR.diffType` was hardcoded `'race'`,
matching `track` exactly. Changing only `buildType` would have shown a spurious
amber "RECOMMENDED: SPORT / → USE SPORT" mismatch banner on the DIFFERENTIAL card
for every INT/PRO fresh install — trading one first-launch rough edge for another.
`DEF_DR.diffType` moved to `'sport'` alongside it. Checked the AWD center-split
recommendation for the same hazard: `DEF_DR.diffCenter:65` was already a latent
mismatch against `_baseCenterLookup.track`'s `70` (dormant, since that banner is
AWD-only and layout defaults to RWD) — it now matches `_baseCenterLookup.street`
exactly, a side-effect fix rather than a new change.

The BEG-panel RESET button carried its own hardcoded
`rearHzMode:'multiplier', rearHzMult:1.0` — a second, divergent "flat" default
(matched axles) presumably chosen specifically to counter the old `flatRide`
default. Simplified to inherit `DEF_FE` directly now that the two agree.

Also reordered the Hz Mode buttons to **MULTIPLIER, MECH, FLAT RIDE, INDEPENDENT**
(previously FLAT RIDE first) so the button order reflects which modes the new
defaults favour, and added an in-app advisory: when FLAT RIDE's resulting
rear/front ratio exceeds ×1.25 (Olley's own front≈80%-of-rear reference), a banner
suggests raising Target Speed or lowering Ride Stiffness. FLAT RIDE itself is
unchanged and remains fully available.

**Verification note:** the fresh-install default change moved `fHz`/`rHz` (and
everything downstream — springs-R, dampers-R, ARB, balance, roll) for 56 of the
existing 64-case Horizon/Motorsport regression fixtures from last session, because
those fixtures don't override `rearHzMode` and therefore all resolved rear Hz via
whatever the default was. Checked that the front axle is byte-identical in all 64
cases (it's always the reference axle) and that the 8 CO-SOLVE fixtures are
byte-identical (CO-SOLVE overrides `effectiveRHz` regardless of `rearHzMode`) — the
diff is fully explained by the intended default change, not a leak elsewhere.

## Changed — beginner tutorial asks for units as its second step

A "Choose Your Units" step now follows the welcome card and embeds the same
`UnitsPicker` the UNITS modal uses, so a new user sets their units before
reading any numbers. Steps carry an optional `units:true` flag for this.

## Changed — IMP/MET toggle replaced by a UNITS modal

The header's IMP/MET pair (and its compact-header copy in the sidebar) is now one
UNITS button opening a modal that sets weight (lb/kg), spring rate (lb/in /
Forza N/mm / kgf/mm), ride height (in/cm) and speed (mph/km/h) independently, with ALL
IMPERIAL / ALL METRIC shortcuts. Stored as `suspos_units_v2`; the old boolean
`suspos_units_v1` is read once so metric users start all-metric. ALL METRIC (and
that seed) uses kgf/mm for springs, Forza's own metric default.

## Reverted — `NMM_PER_LBIN` back to `/100` to match Forza's metric spring readout

The `/1000` "fix" below was physically correct and wrong for the job. Forza's
metric spring field is labelled N/mm but shows **10× true N/mm** (the number is
really N/cm). Metric audit in-game: Forza showed **1903.7 N/mm** for a spring the
app printed as **190.4 N/mm** — exactly 10×. The app exists to produce numbers
typed straight into the game, so the MET readout now mirrors Forza's label again.
Forza's kgf/mm has the same 10× quirk (confirmed in-game), so the kgf/mm
option added in the UNITS modal mirrors it too.
Tune Check keeps its one decimal / 0.1 step, which matches Forza's own display.
BeamNG (N/m) is unaffected.

## Superseded — `NMM_PER_LBIN` was 10× too high, so every MET-mode spring readout was wrong

`NMM_PER_LBIN` was defined as `LB_IN_TO_NM/100`. `LB_IN_TO_NM` is **N/m** per
lb/in (175.127 — the name is misleading), and N/m → N/mm is a divide by
**1000**, not 100. The correct figure is 1 lbf/in = 4.4482 N / 25.4 mm =
**0.175127 N/mm**; the constant evaluated to 1.751.

Confirmed in the running app before the fix: with the default chassis the
SPRINGS card showed `261 lb/in` under IMP and `457 N/mm` under MET, where the
correct value is **45.7 N/mm**. A 457 N/mm spring would be beyond a formula car;
45.7 is an ordinary sports-car rate. Every metric spring number the app had ever
shown — output card, VISUALS strip, and the Tune Check spring inputs — was off by
exactly one decimal place.

It was **deliberately deferred** during the BeamNG work rather than folded into a
feature commit, because it visibly changes numbers users had been reading and
acting on. This entry records discharging that deferral.

Fixed by correcting the divisor to `1000`. All four consumers route through the
one constant (`springOut`'s MET branch, which feeds both the SPRINGS card and the
VISUALS strip; the Tune Check spring inputs; and the MEASURE-mode probe rate
readouts), so no call site needed its own change.

**One knock-on handled at the same time.** The Tune Check spring input rendered
`Math.round(value * conv)` at `step={1}`. With the corrected constant those
numbers are 10× smaller, so whole-number rounding would have turned ~0.57 lb/in
of entry resolution into ~5.7 lb/in, and 45.7 N/mm would have displayed as "46".
The MET branch now carries one decimal at `step 0.1`, matching the output card.
The BeamNG branch keeps whole N/m at `step 100`, which is right for that unit.

The BeamNG mode was unaffected throughout: BeamNG's slider is **N/m**, so it
converts with `LB_IN_TO_NM` directly and never touched this constant. (An interim
`N_MM_PER_LB_IN` existed while BeamNG output was mistakenly built in N/mm; once
the real unit was confirmed from an in-game screenshot it became unnecessary and
was removed rather than left as a near-duplicate.) Verified post-fix: BeamNG
springs still read ~45,600 N/m and the 64-fixture physics snapshot showed **zero**
diffs, since the constant is display-only and `computeTune` never reads it.

`tests-beamng.js` previously pinned the wrong value deliberately. That assertion
is now inverted to guard the correct one, checked against SI from first principles
(`4.4482216 / 25.4`) rather than against the app's own constants, so a regression
in either `LB_IN_TO_NM` or the divisor is caught. The MET assertion in
`springOut`'s test was also strengthened — it compared the function against the
same constant the function uses, so it passed under any value and pinned nothing.

## Fixed — MAN ARB fields didn't respect the per-game click ceiling (resolved)

Two bugs, found months apart, in the same theme: the MAN-mode ARB click
fields (`fe.arbManF`/`arbManR`) getting out of sync with the game's actual
ceiling (`lim.arb`, 65 for HORIZON / 40 for MOTORSPORT).

1. **The field accepted clicks MOTORSPORT would silently discard.** The
   input hardcoded `max={65}` — `GAME_LIMITS.horizon.arb` — so in
   MOTORSPORT (ceiling 40) anything typed between 41 and 65 was accepted,
   stored, and then quietly thrown away by `computeTune`'s `lim.arb` clamp
   before it reached the output; the field's hint named no limit, so
   nothing on screen contradicted the wrong number. Fixed by binding `max`
   to `lim.arb` and stating the ceiling in the hint, the same way BASIC
   mode's hint already interpolates `${lim.arb}`.
2. **Switching between the two Forza modes didn't reclamp an existing
   value.** A React input's `max` attribute doesn't retroactively clamp a
   value already sitting in state, and the migration effect that converts
   these fields only fires on the *physical vs. click-scale* boundary
   (e.g. BeamNG↔Forza, the only transition where what the field's units
   *mean* changes) — not on a HORIZON↔MOTORSPORT switch. Concretely: set
   MAN ARB F to 55 under HORIZON, switch to MOTORSPORT — the field kept
   showing 55 while `computeTune` silently clamped the real output to 40,
   displayed value and actual output disagreeing with no visible
   indication. Fixed by adding a second effect, keyed on `fe.gameMode`
   rather than the physical/click-scale boundary, that clamps
   `arbManF`/`arbManR` to the new mode's `lim.arb` whenever the
   destination is non-physical and Stiffness Mode is MAN.

General lesson (part 1) matches the `arbCtx`/`lim.arb` pattern used
everywhere else: a game-mode-dependent limit should never be written as a
literal, because only one of the two modes will be right. Lesson (part 2):
binding an input's `max` fixes new entry, not values already in state —
a ceiling that can change at runtime needs its own reclamp effect, not just
a tighter `max`.

## Fixed — GEOMETRY GAP readout could never show a negative sign (resolved)

The BALANCE section's GEOMETRY GAP panel printed its value as
`{dSign}{gap.toFixed(2)}`, where `dSign` was computed as `gap>=0?'+':'-'`.
But `gap` is `Math.abs(_sgap)`, so the test could never be false and the sign
was always `+`. The direction text immediately below it branches correctly on
`targetBal>natBal`, so a negative gap rendered as `+0.10` directly above the
line "Wider front track or narrower rear…" — the number contradicted its own
caption.

Fixed by taking the sign from `_sgap`, the pre-`abs` value.

Worth flagging for future cleanup passes: this **looked** like dead code (a
ternary with an unreachable branch) but was actually lost information.
Deleting `dSign` and hardcoding `'+'` — the obvious "simplification" — would
have made the bug permanent.

## Fixed — CO-SOLVE Auto Spring Share pinned at 100% spring / 0% ARB regardless of target (resolved)

Auto Spring Share is supposed to binary-search for the spring/ARB split `S`
where "spring utilisation" equals "ARB utilisation" — i.e. find a genuine
middle ground rather than dumping the whole balance correction onto one
side. In practice it almost never found one. Two compounding bugs:

1. **Scale mismatch.** Spring utilisation was measured as Hz distance moved
   toward `HZ_MAX`, against the full `HZ_MIN..HZ_MAX` span (~4.7 Hz). ARB
   utilisation was measured as clicks used against the 65-click limit.
   Measured directly with the default chassis and a `+0.15` Mech Balance
   Target delta: across the full `S` sweep, ARB utilisation only dropped
   from 0.71→0.41, while spring utilisation only climbed to 0.17 at `S=100%`
   — it could never reach ARB's floor, so the search always walked to the
   `S=100%` boundary. AUTO behaved like SPRING ONLY in essentially every
   realistic configuration.
2. **Directional clamp.** Spring utilisation was `Math.max(0, ...)`-clamped,
   so any target requiring the rear to *soften* relative to front
   (understeer-leaning deltas — the direction a naturally rear-heavy chassis
   typically needs) pinned the metric at exactly 0 regardless of `S`. `ARB
   CORR` read exactly `-0.000` no matter how large the correction.

Fixed by expressing both sides in the same currency: spring utilisation is
now the incremental rear roll-stiffness the spring correction carries,
converted through the same `ARB_RS_SCALE·track²` relationship real ARB
clicks use, then scaled against `lim.arb` — "how many ARB clicks would this
same physical correction have cost." No arbitrary reference band, and
`Math.abs()` on the signed delta makes it direction-agnostic.

Verified (default chassis, PRO, CO-SOLVE, AUTO on): `+0.15` target now
splits 63% spring / 37% ARB (previously 100/0); `-0.15` splits 84%/16% with
a nonzero ARB contribution (previously exactly 0); a small `+0.05` target
correctly stays spring-only (cheap to do that way, not a regression); a
large `+0.30` target shifts to 34% spring / 66% ARB. A degenerate case
(manually forced 50% ARB share) still pins at spring-only, but for a
legitimate reason confirmed by inspection — both ARB bars were already
maxed at 65 clicks purely from the oversized budget, independent of `S`.

An intermediate fix attempt rescaled spring utilisation against the
Rear/Front Multiplier slider's own 0.50–3.00 band instead of the full Hz
range. Also insufficient — a typical target's Hz ratio shift (~35%) still
only moved the metric to ~0.18 against that scale, short of ARB's floor.
Recorded here so a future pass doesn't reach for the same fix and stop
short of verifying it against a real target.

## Fixed — SYNC/NEUTRAL Damping Balance recompute stayed skipped/mis-anchored under SETTLE TIME + CO-SOLVE (resolved)

A recurrence of the same bug class as "Damping Balance Mode was hardcoded to
SYNC-equivalent under SETTLE TIME" above, at a call site that fix didn't
reach. `computeTune` re-derives `zetaF`/`zetaR` from `effectiveRHz` (the
post-CO-SOLVE rear Hz) so SYNC/NEUTRAL's "both axles hit the same settle
time/force" guarantee still holds after CO-SOLVE moves the rear Hz away from
what `feelToPhysics` originally solved zetas against. The guard excluded
`dampCharMode==='settle'` entirely, so with CO-SOLVE + SETTLE TIME + SYNC or
NEUTRAL all active together (three independent, freely combinable toggles),
the recompute never ran and the damper split stayed solved against the stale
pre-CO-SOLVE rear Hz. Fixing just the guard wasn't enough on its own: the
recompute anchors to `phys.reboundZeta`, the raw CHARACTER-mode slider value
— under SETTLE TIME the real anchor is `baseZeta` (the settle-target
back-solved value), which `feelToPhysics` computed internally but never
returned.

Fixed by dropping the `dampCharMode!=='settle'` exclusion and returning
`baseZeta` from `feelToPhysics` so the recompute can anchor to it instead of
`reboundZeta` (this is a no-op outside SETTLE TIME, where `baseZeta` already
equals `reboundZeta`). Verified numerically in physical-unit mode (no click
quantisation to obscure the result): with CO-SOLVE + SETTLE TIME + SYNC,
front and rear settle times now match to floating-point precision after the
fix, versus a ~25% mismatch before it.

## Fixed — inverse FLAT RIDE (rear→front) kept the doubled traverse-time offset (resolved)

A second, missed instance of "FLAT RIDE offset was doubled" above. That fix
corrected `flatRideRearHz` and `flatRideSharedHz`, but `feelToPhysics` has a
third, mirror-image path — Ride Reference = REAR under FLAT RIDE, which
solves front Hz *from* the user's rear-Hz target — that still divided by
`2*(wheelbase/speed)` instead of the single traverse time `t`. Anyone using
Ride Reference REAR (rather than the default FRONT) got the same class of
error the original fix was meant to eliminate everywhere: at the default
chassis, rearHz=2.0 Hz, 70 mph, the buggy formula solved front Hz to 1.487
instead of the correct 1.706 (~15% off).

Fixed by removing the `2*` so this path mirrors the other two. Verified
numerically against the corrected `flatRideRearHz`/`flatRideSharedHz` math.

## Fixed — CO-SOLVE's Hz-slider pre-inversion ignored Auto Spring Share (resolved)

A gap in the same feature as "CO-SOLVE Auto Spring Share pinned at 100%..."
above. When Ride Reference is REAR or SHARED under CO-SOLVE, `feelToPhysics`
has to pre-invert the Hz slider (the user is setting the rear/shared target,
but the solver works front→rear) through a spring-share ratio `Kcs`. That
inversion assumed a fixed `S=50%`, while `computeTune`'s Auto Spring Share
(the default) resolves the real `S` via a 12-step binary search that
generally lands elsewhere — so the Hz value that comes back out of the full
solve didn't match what the user set on the slider (measured ~4%, ~0.08 Hz,
in a representative case). The analogous MECH-mode solver already runs a
2-pass fixed-point loop specifically to avoid this kind of mismatch; CO-SOLVE
had no equivalent.

Fixed by factoring the Auto Spring Share search out of `computeTune` into a
shared `resolveCoSolveSpringShare` helper, called from both `computeTune`
(unchanged behaviour) and `feelToPhysics`'s pre-inversion via a 2-pass fixed
point on the estimated front Hz — the same pattern MECH mode uses for its
own auto-share estimate. Guarantees both call sites converge on the same
`S` instead of drifting independently. Verified: the manual-share path
(`springShareAuto:false`) still solves the rear Hz to the exact slider
target; the auto-share path now converges to within the 2-pass
approximation instead of the previous ~4% miss.

## Fixed — LOAD CODE for CHASSIS reset the locally-calibrated ride-height CG fields (resolved)

`useRideHeightCG`/`rideHeightF`/`rideHeightR` are deliberately excluded from
the share codec (see [CODEC.md](CODEC.md)) so they stay locally remembered
per the note there. But the LOAD CODE handler applied the decoded chassis as
`setCh({...DEF_CH,...ic})` — defaults overlaid only by the codec's fields —
rather than merging over the *current* chassis state, so loading any share
code that included CHASSIS data silently reset the user's ride-height CG
calibration back to `DEF_CH`'s defaults (`useRideHeightCG:false`,
`rideHeightF:0.13`, `rideHeightR:0.12`) with no warning.

Fixed by merging over the current chassis instead of the defaults
(`{...DEF_CH,...prev,...ic}`) — the decoded fields still win where the codec
carries them, but anything absent from the codec (ride-height CG, and any
future local-only chassis field) now survives a code load unchanged.

## Fixed — restoring a v2 backup file could produce duplicate garage entry ids (resolved)

`unifyLegacy` (the legacy v1 backup/migration path) explicitly dedups entry
ids against a running `used` Set before they enter the garage list, with a
comment noting duplicate ids are a "silent render corruption" hazard (the
garage list keys `<EntryCard>` by `id`). The v2 restore path never got the
same treatment — it applied `parseBackup`'s output straight into `entries`
with no id check, so re-importing a previously-exported v2 file (or merging
two export files) whose entries shared ids with entries already in the
garage produced duplicate React keys.

Fixed by dedup'ing incoming ids against the ids being kept at the RESTORE
button handler, using the same bump-on-collision approach as
`unifyLegacy`. v2 entries carry explicit `createdAt`/`updatedAt` (unlike
legacy ones, which use `id` as a timestamp fallback), so bumping `id` alone
is safe here and doesn't disturb sort order.

## Fixed — PRO-only MAN ARB clicks and MANUAL diff mode survived a downgrade to BEG/INT (resolved)

Two related tier-gating gaps found together, both missing from the
"BEG/INT: fall back to simple modes if switching down from PRO" effect that
already resets `arbBalMode`/`rearHzMode`:

1. **ARB Stiffness Mode MAN** (direct front/rear click entry) is a separate
   PRO-only control from `arbBalMode` — its fields render on
   `fe.arbMode==='man'` alone, with no `uiMode==='pro'` check, and nothing
   reset `arbMode` on downgrade. A user who enabled MAN mode on PRO kept
   full editable access to it after dropping to INT.
2. **MANUAL differential mode** (`dr.diffManual`) and its AUTO/MANUAL toggle
   are both PRO-gated, but nothing reset `diffManual` on downgrade either —
   so a user who set MANUAL on PRO and downgraded got a completely blank
   DRIVETRAIN diff section: the AUTO block stayed hidden (`diffManual` still
   true) and the MANUAL block plus the toggle to get back to AUTO were both
   gated behind PRO, with no way back short of returning to PRO.

Fixed by extending the same downgrade effect to also reset `arbMode` to
`'auto'` and `dr.diffManual` to `false` when leaving PRO tier.

## Fixed — garage sort comparator called `Date.now()` fresh on every comparison (resolved)

`stampOf()` falls back to `Date.now()` for entries with no
`updatedAt`/`createdAt` (hand-edited or corrupted entries), and the garage
list's `recent`/`oldest`/`kind` sort comparators called it directly inside
the comparator function rather than precomputing it once. Since
`Date.now()` returns a different value on each call, two timestamp-less
entries being compared could get different "now" values on different
invocations during the same sort — an inconsistent comparator, which can
produce unstable ordering.

Fixed by precomputing a `stampOf` value per visible entry once, before
sorting, and having the comparators read from that instead of calling
`stampOf` themselves.

## Fixed — ARB MAN fields could never be omitted from a share code once touched (resolved)

`CODEC_FIELDS` resolves each field's "is this at default, and can it be
omitted" check against `DEF_GROUPS.fe` (`=DEF_FE`), but `DEF_FE` never
defined `arbManF`/`arbManR` (ids 46/47) — their real nominal default of 20
lived only in `sanitizeTune`'s clamp calls. So the codec's default came out
as `undefined`, which a real value can never equal, and `encodeTune` could
never omit these two fields once a user's `fe.arbManF`/`arbManR` became a
concrete number (i.e. the first time MAN mode was ever touched) — even after
setting them back to 20, every future share code still carried them,
bloating the code without changing what it decoded to.

Fixed by adding `arbManF:20,arbManR:20` to `DEF_FE`, matching
`sanitizeTune`'s fallback.

## Fixed — four in-app hint/tutorial strings lagged behind recent behavior changes (resolved)

A full audit of every hint and tutorial step against the live formulas turned
up four places where UI copy still described pre-fix or pre-refactor
behavior:

1. **STANDARD Damping Balance Mode's hint** still described the pre-`daad350`
   mechanism, where the bias slider's own sign picked which axle stayed
   pinned at the base ζ ("front bias: front stays firm, rear softens; rear
   bias: rear stays firm, front softens"). Since `daad350` made the pinned
   axle follow Ride Reference instead, that description is only correct for
   one of the two bias directions under the default (FRONT) Ride Reference,
   and wrong outright under REAR. Fixed by rewriting the hint to describe the
   Ride-Reference-anchored mechanism generically instead of naming a fixed
   front/rear direction.
2. **Three tutorial steps** (PRO's "Welcome — Pro Mode", INT's "Chassis", and
   PRO's "Chassis Geometry") described CG Height Source as something PRO adds
   on top of Intermediate. `23791d3` moved it to INT tier months ago; the
   README's tier table was updated at the time, but these three tutorial
   strings were missed. Fixed by dropping "CG height" from the two "what PRO
   adds" lists (Welcome and Chassis Geometry) and moving the mention into the
   INT step instead, where it's actually new.
3. **The Settle Target hint** referenced "Settle Bias" — the pre-rename name
   for what's now the Damping Bias slider. `settleBias` only exists in
   migration/legacy-read code, so the hint pointed at a control name that no
   longer appears anywhere in the UI. Fixed by updating the hint to say
   "Damping Bias."

Also, PRO's "Mech Balance Target" tutorial step quoted static per-layout
target ranges (e.g. "RWD track: 0.60–0.70") that were never derived from the
app's own math — the actual Balance Guide range comes from a per-chassis,
per-build-type calculation (`_fracMap`, see `docs/PHYSICS.md`) that can land
well outside those numbers for a given car. Not a regression from a specific
commit, just guidance that was never grounded in the calculation it sat next
to. Replaced with a pointer to the Balance Guide itself rather than numbers
that could mislead more than they helped.

## Fixed — TutorialPanel forced "SCROLL FOR MORE" on short steps because the card was too narrow (resolved)

`TutorialPanel`'s card width (`CARD_W`) was a flat 264px on every screen
size, in the app's monospace font. On a wide desktop viewport that's a lot of
unused horizontal room next to the card, but the card itself still wrapped
body text into as many short lines as it would on a phone — so even a
brief, brevity-audited 4-sentence step (e.g. PRO's "Chassis Geometry") could
still overflow its `maxHeight` and trigger the "▼ SCROLL FOR MORE" fade,
purely from wrap count rather than actual length. Fixed by scaling `CARD_W`
with viewport width — `min(380, max(264, innerWidth/zoom * 0.24))` — so it
stays at 264px on mobile (unchanged) but widens on desktop, cutting the
wrapped-line count enough that the same audited-brief copy fits without a
scrollbar.

Separately, the RIGHT-panel branch of `measure()` (targets like the
balance-bar or `zone-output`) always floated the card *above* the target,
sized to whatever room existed above it — even when the target sat high in
the viewport with most of the screen empty below it. Fixed by comparing
`availAbove` vs `availBelow` and floating the card on whichever side has
more room, flipping the arrow to point up when the card lands below its
target. `TutorialPanel`'s arrow renderer gained an `'up'` case alongside the
existing `'left'`/`'down'` ones.

A follow-up screenshot (PRO's "Calibrating Natural Balance" step, with the
BALANCE sidebar section expanded) showed the same symptom survived on the
LEFT-panel branch for a different reason: `top` was pinned to a fixed
`midY-80` offset from the focused zone's vertical centre, not to the card's
actual content height. A tall focused section (spanning from the section
header down through the Balance Guide widget) has its midpoint sitting low
in the viewport, so the card got pinned low too — starved to a short box
even though the rest of the screen above it had nothing in the card's way.
Fixed to match the RIGHT-panel branch's approach: measure the card's real
rendered height (`cardRef`) and centre the card on the target's midpoint
using that actual height, clamped to stay fully on-screen, instead of
deriving position from a fixed offset that had no relationship to how tall
the content actually was.

A second follow-up screenshot (PRO's last step, "Output Panel & Tune Check",
`focus:['output']`) showed the RIGHT-panel branch still had a version of the
same bug: `zone-output` spans nearly the full panel height on that step (the
sidebar is closed for it), so both `availAbove` and `availBelow` are small —
the fix above just made it pick whichever cramped sliver was *larger*, which
still wasn't enough room for that step's five-sentence body and still forced
a scrollbar, while the actual open space (available by centring, same as the
`MIN_USABLE` fallback already did for the fully-symmetric case) sat unused.
Fixed by comparing both sides against the card's own measured natural height
instead of a flat 180px minimum — if neither side can actually fit the
content, centre it (full near-viewport-height budget) rather than hug a side
that's merely the less-cramped of two bad options.

## ARB NEUTRAL gains an EQUAL ROLL method

NEUTRAL's only behaviour was to split the bars *against* the springs until the
balance bar cancelled (`bAb = -bSp`), which on a lopsided spring split pushes
the bars hard the other way. A new **Neutral Method** toggle (`fe.arbNeutralEqual`,
codec id 67, default off = the old CANCEL behaviour so existing codes are
unchanged) adds **EQUAL ROLL**: the ARB budget is split in the springs' own
proportion, `rF = rsSpR/rsSp` (+ ARB Bias × 0.01), so `rsAbF/rsSpF = rsAbR/rsSpR`
and each axle's bar carries the same share of that axle's roll stiffness. The
bars then stiffen roll without moving the springs' balance. No budget expansion
is needed. The ARB readout shows each axle's ARB roll %.

## ARB AUTO share formula consolidated into `autoArbShare`

ARB Stiffness Mode AUTO's bar share (`clamp(5, 50, 7 × spring-only roll°) / 100`)
was written out four times: twice in `feelToPhysics`'s MECH pre-inversion, once in
`resolveCoSolveSpringShare`'s spring-share search and once in `computeTune`. Each
copy has to agree with `computeTune`, or the Hz a solver chose would assume a
different ARB share from the one the tune actually applies. All four now call one
module-level `autoArbShare(springRollDeg)`. No output changes. The 7 %/° slope and
the 5–50 % clamp are still uncalibrated round numbers.

## Shared physics helpers replace repeated inline formulas

Three formulas were written out inline across `feelToPhysics`,
`resolveCoSolveSpringShare`, `computeTune` and the UI's chassis analysis. Each now
has one definition:

- `axleRollStiffness(hz, mass, track)`: `(2πf)²·m·t²/2`, one axle's spring roll
  stiffness.
- `rollMomentOf(ch)`: roll moment at 1 g.
- `tyreWidths(ch)` / `tireCorrOf(ch)`: tyre section widths with the 265 mm
  fallback, and the tyre-width mech-balance correction.

No output changes: `feelToPhysics` + `computeTune` gave identical results before
and after across every ARB mode, balance mode, game and several chassis, and the
rendered page text matched. The measured-balance offset
(`naturalMechBalanceOf(ch) − geometric estimate`) was deliberately left inline.
Each site computes its geometric estimate a different way (`A/(1+A)` against
`r/(f+r)`), so one helper would change the floating-point results, and wrapping
only the subtraction would add nothing.

## `feelToPhysics`'s two MECH blocks share `mechSpringSplit`

Rear Hz Mode MECH (outside CO-SOLVE) had two near-copies of about 60 lines each:
one for the SHARED ride reference (average Hz) and one for FRONT/REAR (a fixed
reference axle). They differed only in which front/rear Hz they assumed while
estimating AUTO's ARB share, and in how they turned the final ratio into Hz. The
common part (converting the target to a physical rsBalance, the ARB-share dilution
with its two-pass AUTO estimate, and the resulting Hz ratio) is now
`mechSpringSplit(ch, fe, arbBalModeEarly, hzPairFor)`. Each caller passes its own
Hz estimate through `hzPairFor`. MAN ARB's closed-form solves stay with the
callers, because the two paths solve different equations.

No output changes: identical `feelToPhysics` + `computeTune` results across
145,152 combinations, including every Rear Hz Mode × Ride Reference × ARB mode ×
balance mode.

## One `hasBalTargetSolve`, and a second Balance Target default removed

"Is anything solving toward the Balance Target?" was written inline three times —
once in the chassis recommendations off `feEffective`, twice in the Balance Target
panel off `fe`, with the `arbBalMode` default spelled out in some copies but not
others. HISTORY already records a fix to this predicate's MAN-ARB exception that
reached only some copies. It is now `hasBalTargetSolve(fe)`, verified to agree with
all three originals across every arbMode × arbBalMode × rearHzMode combination,
undefined included.

The chassis recommendations also fell back to `arbBalTarget ?? 0.55` where every
solver falls back to `MECH_BALANCE_TARGET` (0.60). `resolveFeEffective` always
resolves `arbBalTarget` to a number, so the branch is unreachable and nothing
changes today; it now names the same constant so a future caller passing a raw
`fe` cannot aim the recommendations at a different balance from the solve.

Also mechanical, no behaviour change: `clampHz` replaces 15 inline
`Math.max(HZ_MIN,Math.min(HZ_MAX,…))` clamps, and `App` reads `arbBalMode` once
instead of repeating `fe.arbBalMode??'weight'` 25 times.

## `clampBalTarget`, and three more per-scope mode locals

Mechanical, no behaviour change: `clampBalTarget` replaces the five inline
`Math.max(0.20,Math.min(0.90,…))` Balance Target clamps (`sanitizeTune` still
clamps the stored *delta* against its own shifted band, so it is not one of them),
and `App` reads `rearHzMode` and `dampingMode` once each instead of repeating
their defaults 9 and 4 times. Sites reading a different object — `p.` inside state
updaters, `physics.dampingMode`, a garage entry's `e.fe` — keep their own
defaults.

Worth recording for the next mechanical rename: replacing `(fe.rearHzMode??'flatRide')`
by text produced `returnrearHzMode` at one site where the expression followed
`return` with no space. Every Node suite still passed — they exercise the physics
entry points, not JSX — and the app failed to load in the browser. Text-level
edits inside the JSX need a browser load, not just green tests.

## Damper mode locals hoisted to `App`

The last of the per-scope mode locals: `App` reads `dampCharMode` and
`dampBalMode` once instead of repeating `fe.dampCharMode??'zeta'` (4 sites) and
`fe.dampBalMode??'standard'` (3). The damping-bias hint block kept its own copies
under the shorter names `charMode`/`balMode`; it now uses the hoisted ones.
Mechanical, no behaviour change.

## ARB Motion Ratio F / R

BEAMNG's anti-roll output read ~4–6× soft because `arbOut` inverted
`rs = k·track²/2`, which assumes the bar acts at the wheels; a real drop link
attaches inboard, so the N/m needed is larger by `(track/arm)²`. KNOWN_ISSUES had
the research and a specified-but-unimplemented fix. It is now
`ch.arbMotionRatioF`/`arbMotionRatioR` (PRO CHASSIS, physical modes only,
0.20–1.50, default 1.0, codec ids 68/69), applied as `k = 2·rs/(track·mr)²` through
the existing `mrDiv`.

Display-only, exactly like the spring motion ratio: `computeTune` never reads it,
so Hz, roll stiffness, mech balance and the handling-balance figures do not move.
Verified — solver output identical across 145,152 mode combinations, and the ARB
rows' "% roll" / "% ARB" metas unchanged while the printed N/m moved.

Applied at all three N/m ↔ roll-stiffness boundaries, which must agree or a value
will not round-trip: `arbOut`, MAN-mode entry, and the TUNE CHECK import. Display
and entry were checked to invert each other exactly across track widths, ratios and
rates — the asymmetry that caused a real bug during the spring motion-ratio work.

The amber "reads soft" caveat under the ARB rows and on the suspension cards now
shows only while both ratios are 1.0, and names the input rather than telling the
user to scale by hand. The default stays 1.0: the app still ships the unscaled
number rather than inventing a multiplier from one sampled vehicle.
