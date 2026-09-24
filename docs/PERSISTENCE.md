# SUSP.OS — localStorage Persistence Keys

All persisted state uses the `usePersist(key, initial, repair?)` hook, which merges
stored JSON over the default object
(`{...initial, ...parsed}`) — so adding a new field to a default object is
automatically picked up for existing users without a migration step. Only
bump the version suffix when a field's **meaning** changes in a way that
old stored values would misrepresent (see [CODEC.md](CODEC.md) for recent
examples of that).

The merge fills keys the stored object is **missing**; it does not check the ones
that are present, so a persisted value that is invalid rather than absent beats its
default on every reload. The optional third argument, `repair`, runs once on the
rehydrated value **before the first render** for callers that need a key validated.
Only `suspos_fe_v8` passes one (`repairFe`, for `gameMode`), and only because that
one key's bad value used to crash the app rather than fall through to a default —
see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the rest, which still have the hole.

A repair must live here rather than in a mount effect: `usePersist`'s setter closes
over the render-time value, so two effects writing the same key in one tick clobber
each other, and an effect also runs too late to protect the first render. See
[HISTORY.md](HISTORY.md).

| Key | Holds | Default |
|---|---|---|
| `suspos_ch_v8` | Chassis state (`ch`) — weight, frontBias, tyres, wheelbase, track widths, CG height + CG source (`useRideHeightCG`, `rideHeightF`/`rideHeightR`), layout, measured nat-bal, BeamNG motion ratios (`motionRatioF`/`motionRatioR`, `arbMotionRatioF`/`arbMotionRatioR`) | `DEF_CH` |
| `suspos_fe_v8` | Feel/tune state (`fe`) — ride stiffness + its input mode (`rideStiffMode` HZ/BOTTOM G's, `rideBottomG` target), Hz mode + ride reference, ARB modes, damping, balance targets | `DEF_FE` |
| `suspos_dr_v8` | Drivetrain state (`dr`) — build type, diff type, diff lock/bias fields | `DEF_DR` |
| `suspos_al_v2` | Alignment state (`al`) — mode (build/mech/grip/manual), nudgeStrength, manual camber/toe/caster, and the legacy `alignManual` flag (still read as a fallback for old saves — see [ALIGNMENT.md](ALIGNMENT.md)) | `DEF_AL` |
| `suspos_units_v2` | Per-category display units from the UNITS modal: `{mass:'lb'\|'kg', spring:'lbin'\|'nmm'\|'kgfmm', length:'in'\|'cm', speed:'mph'\|'kmh'}` | all-imperial, or all-metric if `suspos_units_v1` was `true` |
| `suspos_units_v1` | Legacy IMP/MET boolean — **read-only**, seeds the `_v2` default once | `false` (imperial) |
| `suspos_saves_v9` | Legacy preset save slots — **read-only**, first link in the migration chain below | `PRESET_SAVES` |
| `suspos_uimode_v1` | Current complexity tier (`beginner`/`intermediate`/`pro`) | `'beginner'` |
| `suspos_zoom_v1` | Desktop UI zoom level — **read-only** since the header zoom buttons were removed in favour of browser zoom. A previously-set value is still honoured; nothing writes it any more | `1.1` |
| `suspos_tutorial_seen_v1` | Which tier guides have been dismissed | `{beginner:false, intermediate:false, pro:false}` |
| `suspos_tutorial_step_v1` | Last step reached in each tier guide (0-based), so `?` can offer RESUME. `0` = nothing to resume; cleared when that guide hits DONE and by RESET (Tutorials). Clamped to the guide's current length on read | `{beginner:0, intermediate:0, pro:0}` |
| `suspos_baltut_seen_v1` | Whether the Handling Balance bar's own guide has been seen | `false` |
| `suspos_onboard_v1` | Whether the first-run onboarding has been seen | `true` |
| `suspos_garage_v2` | **The garage.** Unified entry list — see the entry shape below | `[]` |
| `suspos_dna_v1` | Vehicle DNA: the DNA modal's `draft` and the last APPLY as `applied` (`{name, axes, achieved}`) — see [DNA.md](DNA.md) | `{draft: DNA_ARCHETYPES[0], applied: null}` |
| `suspos_garage_ui_v1` | Garage panel filter + sort preference (`{filter, sort}`) — search text is deliberately not persisted | `{filter:'all', sort:'recent'}` |
| `suspos_garage_v1` | Legacy chassis-only Garage (`{id, name, ch, savedAt}`) — **read-only**, migration source | `[]` |
| `suspos_builds_v1` | Legacy tune-only My Builds (`{id, name, fe, dr, savedAt}`) — **read-only**, migration source | `[]` |
| `suspos_builds_migrated_v1` | Sentinel, not data — `suspos_saves_v9` → `suspos_builds_v1` migration has run | *(absent)* |
| `suspos_garage_unified_v2` | Sentinel, not data — the `_v1` → `suspos_garage_v2` migration has run | *(absent)* |

## When to bump a version suffix

Bump (e.g. `_v8` → `_v9`) when:
- A field's stored value changes meaning (absolute → delta, different unit,
  different enum set) such that old stored values would now be
  misinterpreted, **and** you want a clean break rather than relying on
  `mergeDefaults` to paper over it.
- You're restructuring the shape of the object enough that a partial merge
  with old data would leave it in an inconsistent state.

Don't bump for:
- Adding a new field with a sensible default — `mergeDefaults` already
  handles this (existing users get the new default automatically).
- Removing a field — the extra key just sits unused in storage, harmless.

## The garage entry — what travels with what

One list holds every saved thing. An entry carries any combination of payloads:

```js
{ id, name, ch?, fe?, dr?, dna?, tier?, tags:[], notes:'', createdAt, updatedAt }
```

`tier` is the complexity tier (`beginner`/`intermediate`/`pro`) the entry was saved
in, shown as a `… TIER` chip on the card. It is stamped on save and re-stamped on
rewrite (the payload is being replaced, so the old tier would describe contents that
are gone). An entry imported from a share code carries the *sender's* tier, not the
importer's. It is omitted, not defaulted, when unknown — entries saved before the
field existed show no chip rather than claiming a tier nobody chose. Unlike `notes`
and `tags` it **is** a codec field (id 77), since it describes the tune's authoring
rather than this device's filing of it. Nothing ever applies it; see
[CODEC.md](CODEC.md).

Absent payloads are **omitted**, not stored as `null`. The entry's *kind* is
**derived** from which payloads are present (`kindOf`), never stored — a stored
kind would desync the moment an entry is rewritten:

| Kind | Payloads | Load buttons |
|---|---|---|
| `chassis` | `ch` | LOAD CHASSIS |
| `build` | `fe` + `dr` | LOAD BUILD |
| `car` | `ch` + `fe` + `dr` | both, separately |
| `dna` | `dna` only | LOAD DNA — shown in the DNA modal's MY DNA drawer, not the main list |
| `empty` | none | none — corrupt entry, delete only |

Save and load are still full generic spreads (`{...ch}` / `{...DEF_CH,...e.ch}`,
and the same for `fe`/`dr`), so **any new `ch`/`fe`/`dr` field automatically
travels with garage entries with no save/load code change** — the property the old
two-list split existed to provide, preserved. Only the *grouping* changed: a field
still only needs to live in the right one of `ch` / `fe` / `dr`.

`dna` means two things by position. Beside `fe`/`dr` it is the Vehicle DNA a build was
stamped from (the `applied` shape of `suspos_dna_v1`) and plays no part in `kindOf`; an
entry without it — every entry saved before DNA existed — loads as "no DNA". Alone it is
a saved DNA (a `sanitizeDNA` shape), kind `dna`. See
[DNA.md](DNA.md).

`notes` and `tags` are per-device metadata and deliberately **not** codec fields —
see [CODEC.md](CODEC.md)'s excluded-fields section.

**`al` (alignment) does not travel either.** The "any new field travels for free"
property above is specifically a `ch`/`fe`/`dr` property — those are the three
payloads an entry carries. `al` is persisted in its own key (`suspos_al_v2`) and is
not part of the entry shape, so SAVE CAR does **not** capture Alignment Mode, Nudge
Strength, or MANUAL camber/toe/caster, and LOAD CHASSIS / LOAD BUILD leave whatever
alignment state is currently live untouched. For BUILD mode that is invisible,
since `computeAlignment` re-derives the same angles from `ch` + the tune. For
MANUAL it means typed angles are lost on save. The share codec has the identical
gap for the identical reason — see [CODEC.md](CODEC.md) and
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Migration chain

`suspos_saves_v9` → `suspos_builds_v1` → `suspos_garage_v2`

Each link is a mount-once effect guarded by its own sentinel, wrapped in
`try/catch`, and **never deletes the source key**. The two `_v1` keys now have no
UI and no React binding — the unified migration's two `getItem` calls are their
*only* remaining readers. They look like dead keys to a search-based audit;
removing them (or that effect) silently loses every saved chassis and build for
anyone who hasn't opened the app since the unification. See
[CODE_MAP.md](CODE_MAP.md)'s intentionally-retained-legacy section.

That migration reads localStorage directly rather than the React state, because
both migration effects run on the same mount pass — the state variables still hold
their pre-migration values while localStorage is already current.

## Array-valued keys need read-time normalization

**`mergeDefaults` returns arrays verbatim.** It only spreads when *both* the
default and the parsed value are non-array objects, so an array-valued key gets
**no per-entry default filling at all**.

This makes the "don't bump, adding a field is free" rule above **object-only**. For
an array-valued key it is simply false: a new entry field is `undefined` on every
previously stored element. The fix is a normalizer applied to everything entering
the list (`normalizeEntry`, the single choke point for migration, legacy file
import and v2 file import) — not a version bump, and not `??` defaulting scattered
across every render site.

`suspos_garage_v2` was still given a new version rather than reusing
`suspos_garage_v1`, because that change was a *merge of two keys into one* — a case
the rules above have no vocabulary for, and one where a partial merge would leave
entries in an inconsistent state. The contrast with `suspos_garage_ui_v1`, which is
object-valued and therefore does get free field defaulting, is the cleanest
illustration of the distinction.

## Backup file format

BACKUP writes `suspos-data.json`:

```json
{ "version": 2, "entries": [ … ] }
```

RESTORE checks for `entries` **before** looking at `version`, then falls back to
sniffing the pre-unification `{garage:[…], builds:[…]}` shape (which had no version
field at all) and running it through the same merge the localStorage migration
uses. So `version` is documentation and future dispatch, not a load-bearing gate,
and a v2 file with a damaged version field still imports.

Restore replaces the **selected kinds** and keeps the rest. The old behaviour
replaced one whole list and left the other alone; with a single list, replacing
everything would silently delete the kinds the user didn't tick. A kind the file
carries none of is not replaced even if its greyed-out box is still ticked — see
[HISTORY.md](HISTORY.md).

Because it replaces and the garage is **outside undo history** (see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md)), the panel states the trade before it runs
rather than after: each row carries the file's count for that kind and how many of
yours it replaces, amber on the rows that actually drop something; a summary line
gives the net garage size, what came from the file, and what was kept; and RESTORE
itself is a two-tap `ConfirmBtn`. One `chosen(kind)` predicate drives both the
printed counts and the entries actually dropped, so the summary cannot describe a
different restore than the one that runs.

Incoming ids are deduped against the entries being kept by bumping on collision —
the same approach `unifyLegacy` uses for legacy imports, but against the live
garage rather than a second legacy list. Entries are normalised by `parseBackup`
on the way in; writing to `suspos_garage_v2` directly bypasses that and can crash
the garage cards, which is worth knowing before hand-editing the key.

The backup holds garage entries only. UI and tutorial state (`suspos_uimode_v1`,
`suspos_tutorial_seen_v1`, `suspos_tutorial_step_v1`, …) is per-device and
deliberately not included.

## Share links (`#t=`) persist nothing

COPY LINK's `#t=CODE` hash touches no storage key. The link is read once on mount,
the code is staged into component state (`pending`), and `history.replaceState`
strips the hash immediately — so a reload restores the ordinary persisted tune, not
the link, and cannot restage an old code over edits made since. The part ticks
(`importSel`) are component state too: they stay put for the session, including
across a load, but a fresh page starts with every part ticked. See
[CODEC.md](CODEC.md#parts--how-a-decoded-code-is-applied).

Nothing changes on disk until APPLY SELECTED (which writes the live tune through
the usual persisted keys) or TO GARAGE (which writes one new garage entry).
