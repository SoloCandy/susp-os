# SUSP.OS — Suspension Tuning Calculator

[![Live Demo](https://img.shields.io/badge/live%20demo-solocandy.github.io%2Fsusp--os-e2e8f0?style=flat-square)](https://solocandy.github.io/susp-os/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A single-file suspension tuning calculator for **Forza Horizon**, **Forza Motorsport**, and **BeamNG.drive**. Enter your car's physical stats and a handling target — SUSP.OS outputs values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics: exact in-game clicks for the Forza titles, and real physical units (N/m, N/m/s) for BeamNG.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://docs.google.com/spreadsheets/d/1ySrVkgQpohIduhdLCwe99p3d6KmWXKgck5Uk-qDOlPw/edit?usp=sharing)

![SUSP.OS PRO tier, Horizon mode — Balance Guide expanded in the sidebar alongside the alignment/ARB/spring/damper output panel](docs/screenshot.png)

**Contents:** [Quick Start](#quick-start) · [What It Does](#what-it-does) ·
[Complexity Tiers](#complexity-tiers) · [Architecture](#architecture) ·
[Documentation](#documentation) · [Development](#development) ·
[Compatibility](#compatibility) · [Feedback](#feedback) ·
[Credits](#credits) · [License](#license)

---

## Quick Start

**[Open the live app](https://solocandy.github.io/susp-os/)** — or download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

---

## What It Does

Forza's suspension tuning menus expose raw numbers — spring rate lb/in, damper clicks, ARB clicks — with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, front weight bias, drivetrain layout, and build type. From INT mode: CG height, estimated from ride height and tyre radius by default, or entered manually. In PRO mode: tyre sizes, wheelbase, and track widths for full chassis geometry.
2. **You set a handling target** — ride stiffness, mech balance target (how rear-biased the roll stiffness should be for your drivetrain and build), damping character, and differential intent. The balance guide shows a recommended range for your layout and build type — scaled between your chassis's natural balance and its grip-neutral point rather than a flat offset — and flags how far your chassis natural balance sits from the target.
3. **SUSP.OS computes the physics** — spring rates from natural frequency targets, damper clicks from critical damping coefficients, ARB split solved to hit your mech balance target, alignment geometry, brake bias, and differential lock percentages.
4. **You enter the output values into your game's tuning menu** — springs, dampers, ARBs, alignment, brakes, and differential: exact clicks for the two Forza titles, real physical units for BeamNG.

The result is a tune that starts from a principled baseline rather than trial-and-error guessing.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible. A short in-app guide opens the first time you enter each tier — reopen it any time with the **?** button. The **TERMS** button next to it opens a searchable glossary (Hz, ζ/damping ratio, ARB, mech balance, camber/toe/caster, and more) — not tied to any tier, available any time you forget what a word means.

A **RESET / CHECK / SHARE** toolbar is pinned to the top of the sidebar, above every tier's inputs, so it's always reachable without scrolling. RESET clears the tune or the tutorials back to defaults (garage saves are untouched). CHECK opens Tune Check, a reverse calculator for reading frequencies and damping ratios back out of existing spring/damper values. SHARE handles share codes and JSON garage backups.

A **VISUALS** card is pinned to the bottom of the sidebar (collapsible, stays put while the sections above it scroll) and holds every dial/graph in one place, in four independently collapsible groups — **ARB** (the split dial with ROLL/ARB SHARE), **RIDE / DAMPERS** (the spring-Hz dial and the rebound/bump dial), **DYNAMICS** (a damped step-response chart showing how fast each axle settles and whether it overshoots, with a shaded ±10% settle band, a dashed settle-time marker and a first-neutral-crossing ring per trace — the markers are measured off the drawn curve, so the settle line is literally where the trace enters the band), and **SAG** (the sag vs load chart, when RIDE HEIGHT → CG is active) — so they're visible regardless of which input section is currently open, instead of being scattered across ANTI-ROLL BARS/RIDE/DAMPERS/CHASSIS.

A **GARAGE** drawer slides out from the right (button at the top-right of the header, every tier) and holds everything you save. Each entry is a **chassis**, a **build** (feel + diff tune), or a **car** carrying both — a car gives you separate LOAD CHASSIS and LOAD BUILD buttons, so you can mix one car's chassis with another's tune, and every load is undoable. Entries take notes and your own tags, and derive automatic ones (drivetrain, weight balance, stiffness band, build type) that you can search on directly, alongside filter-by-kind and sort. Every entry has a COPY CODE button to get a share code back out. The six factory presets are pinned read-only at the top. This replaces the old split between a chassis-only GARAGE drawer inside CHASSIS and a tune-only MY BUILDS drawer inside BUILD.

Pasting a share code (SHARE → LOAD CODE) offers two ways in: **OVERWRITE** replaces your current tune, or **TO GARAGE** saves it as a new garage entry without touching what you're working on.

| Tier | Surface |
|---|---|
| **BEG** | <ul><li>Layout, build type (Street / Track / Drift / Rally / Offroad / Drag), weight, and front bias, plus three feel sliders (Ride Stiffness, Balance, Character)</li><li>Factory presets in the GARAGE drawer give build-appropriate starting points, with ★ marking the one matching your build type</li><li>ARB balance is set automatically for your layout and build type</li><li>Full GARAGE access — saving a chassis means not retyping weight and bias every time you switch cars</li></ul> |
| **INT** | All BEG inputs, plus: <ul><li>ARB stiffness modes (AUTO / BASIC / ROLL ° / SHARE % / **MAN** — MAN sets front/rear ARB clicks directly, bypassing the budget/split system and hiding Balance Mode while active) with ARB Bias</li><li>An ARB balance mode toggle (WEIGHT / NEUTRAL — NEUTRAL solves the F/R split to exactly cancel the springs' contribution to the balance bar), with a **Split Direction** toggle under WEIGHT (SAME tracks the reference balance directly; OPPOSITE mirrors it around 50/50 so the bars counteract rather than reinforce it)</li><li>Individual ride frequency and damping controls, including SETTLE TIME mode (set a target settle time and ζ is back-calculated per axle) and REBOUND/BUMP MODE toggles</li><li>A **RIDE REF.** toggle (FRONT / SHARED / REAR — which axle the stiffness slider anchors, without ever changing the resulting Hz on its own) and an **Hz MODE** selector for deriving the other axle: MULTIPLIER, FLAT RIDE, and INDEPENDENT</li><li>A **STIFFNESS** toggle (HZ / BOTTOM G's) that re-scales the Ride Stiffness slider to the vertical-g load factor at which the reference axle bottoms out instead of a frequency — available when CG Height Source is RIDE HEIGHT. With RIDE REF. on SHARED it also unlocks a **SHARED** Hz mode that solves both axles to bottom out at the same g rather than holding a fixed Hz ratio</li><li>Drivetrain intent sliders</li><li>A **Diff Type** selector (Race / Sport / Rally / Offroad / Drift) with per-type output scaling and a recommended type based on build</li><li>A **CG Height Source** toggle (RIDE HEIGHT, the default — derives CG height from front/rear ride height and tyre radius, and surfaces a SAG vs LOAD chart — or MANUAL, direct entry)</li></ul> |
| **PRO** | All INT inputs, plus: <ul><li>Tyre sizes, balance guide, chassis balance / grip bias / stability readouts, geometry gap, and Mech Balance Target slider</li><li>**CHASSIS** / MECH / CO-SOLVE ARB balance modes, on top of WEIGHT / NEUTRAL — CHASSIS behaves like WEIGHT but anchors to the car's actual natural mech balance instead of raw weight %, so it's the mode that benefits from a MEASURE NAT BAL reading (gets the same Split Direction toggle as WEIGHT)</li><li>Hz MECH mode</li><li>Full chassis geometry (wheelbase and track widths)</li><li>Per-wheel load transfer readouts</li><li>A differential **MANUAL** mode plus a **MATCH CHASSIS** toggle for AUTO mode (biases the EXIT/ENTRY sliders toward your chassis mech target — no effect once MANUAL is selected)</li><li>An **Alignment Mode** selector (BUILD / MECH / GRIP / MANUAL — MECH and GRIP nudge camber/toe toward the car's balance tuning, scaled by a Nudge Strength slider)</li><li>**Measured natural balance** calibration (enter an in-game reading to replace the geometry prediction as the solver baseline)</li><li>CO-SOLVE mode's **Auto Spring Share** — automatically finds the spring/ARB split that equalises utilisation of both, with SPR CORR / ARB CORR readouts showing each source's contribution to the balance correction</li><li>A wheel lift warning when CO-SOLVE drives rear ride frequency more than 20% above front</li><li>**Vehicle DNA** in the GARAGE drawer: pick or edit a handling personality (platform, pitch, roll, balance, damping, diff) and APPLY solves this car's tune for it, reporting anything the chassis can't reach; the sidebar marks what it set and VISUALS shows drift</li><li>In **BEAMNG** mode: **Motion Ratio F / R**, converting the solver's wheel-rate output to what BeamNG's spring/damper-acting sliders expect</li></ul> |

---

## Architecture

The entire app is a single HTML file: a pure-JS physics engine
(`feelToPhysics` → `computeTune` → `computeDiff`/`computeAlignment`), a React
UI transpiled in-browser via `@babel/standalone`, `localStorage` persistence,
and a sparse Base64 share codec. No build step, no server.

A **HORIZON / MOTORSPORT / BEAMNG** dropdown in the header picks which game's
tuning menu the output is written for. It changes *units, ceilings, and the
increments each game's sliders snap to* — the underlying physics solve
(spring/damper/ARB targets, handling balance, alignment) is the same one in all
three. Each mode then quantises that solve to its own grid and reports the
physics of the quantised value, so the Hz, ζ and balance figures printed beside
an output row describe the tune you can actually dial in rather than the
pre-rounding target. Because the grids differ, identical inputs give very
slightly different balance readouts between modes; that is correct, not drift.

**Horizon and Motorsport** express output as abstract 1–N "clicks," because
that's what those games' tuning screens use — Forza hides the real internal
units, so each has its own click ceiling (Horizon: 65 ARB / 20 damper.
Motorsport: 40 / 40). **BeamNG** has no such fixed scale — it builds its
tuning sliders per-vehicle from the car's own config — so that mode skips the
click conversion and outputs the real values directly: spring rate in N/m,
damping in N/m/s, anti-roll rate in N/m, each snapped to the increment BeamNG's
own slider moves in (500 / 100 / 1000). A few things are specific to BEAMNG
mode: BASIC ARB stiffness is Forza-only and hidden there; the anti-roll
number is BeamNG's least-validated output; and PRO gains a **Motion Ratio
F / R** input, since BeamNG's sliders act at the spring/damper rather than
the wheel. Full detail — the unit table, all behavioural differences from
Forza, and why no new calibration constant was needed — is in PHYSICS.md's
[**Physical-unit output**](docs/PHYSICS.md#physical-unit-output-beamng-game-mode)
section.

---

## Documentation

Reference docs for maintainers:
- [CODE_MAP.md](docs/CODE_MAP.md) — how `index.html` is laid out, and which legacy code must not be deleted
- [SLIDERS.md](docs/SLIDERS.md) — every slider's range, tier, physical effect, and oversteer/understeer direction
- [PHYSICS.md](docs/PHYSICS.md) — Hz/spring/damping solve math (Ride Stiffness → spring rate/clicks, Hz modes, settle time, the LLT grip model) and the empirical calibration constants
- [FORMULAS.md](docs/FORMULAS.md) — the ground-truth handling-balance contributor formulas
- [ALIGNMENT.md](docs/ALIGNMENT.md) — camber/toe/caster target formulas and per-build/layout baselines
- [CODEC.md](docs/CODEC.md) — the share-code field ID table (never reuse an id)
- [PERSISTENCE.md](docs/PERSISTENCE.md) — localStorage keys and when to bump a version
- [PRESETS.md](docs/PRESETS.md) — factory preset values and how to add a new one
- [DNA.md](docs/DNA.md) — Vehicle DNA, a chassis-portable handling personality compiled into a tune (PRO, in the GARAGE drawer)
- [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — open gaps, deliberate limitations kept with their reasoning, and designs considered and rejected
- [HISTORY.md](docs/HISTORY.md) — resolved incidents, kept because the reason each one broke is worth remembering

---

## Development

No build tools required. Open `index.html` in a browser, edit with any text editor, reload to see changes.

```
node tests.js          # physics unit tests (mirrored copy — see CODE_MAP.md)
node tests-beamng.js   # physical-unit mode tests (reads index.html directly)
node tests-docs.js     # documentation drift checks (reads index.html and docs/)
node tests-dna.js      # Vehicle DNA core tests (reads index.html directly)
```

`tests-docs.js` fails when a fact stated in the docs stops matching the code:
a codec id table that has drifted, an enum value no doc mentions, a storage key
that vanished, a slider range that contradicts what `sanitizeTune` actually
clamps to, a collapsible section missing from the `open` state, or a broken
link between docs. It checks names, ids, keys and numbers — never prose — so a
green run means the facts line up, not that the writing is still accurate.

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

---

## Feedback

- **Found a bug or something looks wrong?** [Open an issue](https://github.com/SoloCandy/susp-os/issues/new/choose) — a share code (SHARE → COPY CODE) makes it much easier to reproduce.
- **Have an idea or a question?** [Start a discussion](https://github.com/SoloCandy/susp-os/discussions).
- **Prefer email?** [soloc4ndy@gmail.com](mailto:soloc4ndy@gmail.com).

---

## Credits

- Physics foundation: [NumberlessMath](https://docs.google.com/spreadsheets/d/1ySrVkgQpohIduhdLCwe99p3d6KmWXKgck5Uk-qDOlPw/edit?usp=sharing) (2020)

---

## License

MIT
