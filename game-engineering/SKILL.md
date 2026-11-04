---
name: game-engineering
description: Build and ship games as Game Engineer (engine choice, frame and memory budgets, asset and build pipelines, platform ports) or Game Developer (core loop, mechanics, levels, balance, playtests) for Solo Empire's own games. Use when starting or prototyping a game, choosing Unity/Godot/web, profiling frame rate, setting up game builds or ports, or planning a playtest; not for client game work under Oak, store-listing copy (content-distribution), or generic web UI (qa-testing, ux-review).
---

# Game Engineering

Two atomic roles share this skill: `game-engineer` owns whether the game
*runs* everywhere it ships; `game-developer` owns whether it is *fun and
stable* to play. Both answer to the Game Studio Hub registry.

## Sources of truth

- Game portfolio and stage: knowledge-base `projects/product/content-media/book-games/studio/registry/games.yaml`
- Release channels and fees: `studio/registry/platforms.yaml`
- Release checks per platform: `studio/RELEASE-CHECKLIST.md`
- Roles and templates: architecture-docs `docs/registries/ROLE-CATALOG.yaml`
  (`game-engineer`, `game-developer`) and `templates/positions/game-engineer/`,
  `templates/positions/game-developer/`
- Unity prototype tool `game-v1a` (`book-production game build|export`):
  `book-products/content-production/catalog/production-tools.yaml`
- Org repositories: `game-hub` registry for `bookchaowalit-game`

Read the game's `games.yaml` entry first. Do not start code for a game that
has no entry; add one with `stage: idea`.

## Workflow

1. **Frame.** Confirm stage (idea → research → prototype → vertical-slice →
   production → released), target platforms in release order, and the one
   question this piece of work must answer.
2. **Technical design (game-engineer).** Fill `game-technical-design.md`:
   engine decision with licence/fees, update loop, save versioning, input per
   device, budgets per lowest target device, asset rules and rights register,
   build/port matrix. Record hard-to-reverse choices as an ADR.
3. **Slice (game-developer).** Fill `gameplay-slice-and-playtest.md`: core
   loop in one sentence, MEC-xx mechanic specs with numbers and edge cases,
   scope in/out, balance data in data files rather than code.
4. **Build.** Small commits; gameplay logic in plain testable classes, engine
   glue thin. Unit-test rules and balance maths (Unity Test Framework, GUT for
   Godot, Vitest/Jest for web). Keep binary assets in LFS or outside Git.
5. **Prove it runs.** Headless build from a clean checkout for every target,
   then profile on the lowest device. A budget is met only when measured on
   that device; editor numbers never count.
6. **Prove it plays.** Run a playtest round with real players, consent
   recorded, no personal data in the repo. Log completion rate, session
   length, crashes/softlocks, top findings with P0–P3.
7. **Decide and record.** go / iterate / kill on the template, update
   `games.yaml` stage and `releases:`, walk the platform release checklist
   before any store submission.

## Decision rules

- Web-first or 2D, small scope → Phaser/web or Godot; 3D, console or the
  `game-v1a` GameIR path → Unity. Check current engine licence terms before
  committing; never answer fees from memory.
- Frame time over budget → profile first (CPU vs GPU vs GC), fix the top
  hotspot, re-measure; no speculative optimisation.
- Mechanic not fun after two playtest rounds → cut or redesign it; do not add
  content to rescue a weak loop.
- Store account, signing key, or paid fee needed → stop; owner action. Keep
  secret names only, values in Infisical.
- Third-party or AI-generated asset without a recorded licence → do not ship.
- Online play, payments, or children as audience → run `security-and-privacy`
  before the slice leaves prototype.
- Web build of a game → also run the `qa-testing` UI gate on its menus and
  landing page.

## Done means

- Technical design and slice record exist and are linked from `games.yaml`.
- Clean-checkout builds pass for each target; budgets measured on device.
- At least one playtest round recorded; no open crash or softlock.
- Evidence (build ids, profiler captures, playtest record) is linked, and
  anything not verified is named as not verified.
