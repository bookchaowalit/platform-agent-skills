---
name: xr-engineering
description: Build and ship VR/XR experiences as VR Engineer (runtime choice, frame-time and thermal budgets, tracking and input fallbacks, device matrix, sensor privacy, builds and deploys) or VR Developer (scenes, interactions, locomotion and comfort, XR accessibility, headset playtests) for Solo Empire's own XR apps. Use when starting a WebXR or Unity XR app, choosing a headset target, profiling frame rate in a headset, designing VR interactions or locomotion, or planning a comfort playtest; not for flat 3D games (game-engineering), client XR work under Oak, or 2D web UI (qa-testing, ux-review).
---

# XR Engineering

Two atomic roles share this skill: `vr-engineer` owns whether the experience
*runs smoothly* on every headset it targets; `vr-developer` owns whether it is
*usable and comfortable* in the headset. Both work in the `bookchaowalit-vr`
organisation (`vr-hub` registry).

## Sources of truth

- Stack decision: architecture-docs
  `docs/architecture/decisions/ADR-0012-vr-xr-stack-webxr-first.md`
  (WebXR + three.js + Vite + TypeScript by default; Unity + OpenXR only on a
  recorded trigger)
- Roles and templates: architecture-docs `docs/registries/ROLE-CATALOG.yaml`
  (`vr-engineer`, `vr-developer`) and `templates/positions/vr-engineer/`,
  `templates/positions/vr-developer/`
- Reference code: `bookchaowalit-vr/devtools-vr-starter` (scene, input,
  comfort defaults, emulated-XR smoke test, CI)
- Test standard: ADR-0004 (spec before code, red/green); 2D shell design
  floor: ADR-0007

Read ADR-0012 first. Start a new XR app from the starter, not from scratch.

## Workflow

1. **Frame.** Name the experience in one sentence, the session type
   (`immersive-vr` / `immersive-ar` / inline), reference space (seated,
   standing, room-scale) and the target headsets in release order.
2. **Technical design (vr-engineer).** Fill `xr-technical-design.md`:
   runtime decision, device matrix with the floor device, frame-time /
   draw-call / texture budgets, input fallbacks, sensor privacy, build and
   deploy path. A runtime change from ADR-0012 is an ADR amendment.
3. **Interaction spec (vr-developer).** Fill
   `xr-interaction-and-comfort-test.md`: INT-xx interactions with input,
   feedback and edge cases; locomotion and comfort defaults; accessibility
   checklist.
4. **Build.** Rules (scoring, state machines, comfort settings, input
   mapping) live in plain TypeScript modules with Vitest tests; three.js and
   WebXR glue stays thin. Keep assets as glTF/GLB with Meshopt or Draco and
   KTX2 textures; large binaries go in LFS or object storage.
5. **Prove it runs.** CI: lint, type check, unit tests, `vite build`, and the
   Playwright smoke test with the emulated XR runtime. Then measure on the
   floor headset (OVR Metrics Tool or WebXR frame timing). A budget is met
   only when measured on that headset; desktop numbers never count.
6. **Prove it is comfortable.** Headset playtest with at least one
   first-time VR user and one person prone to motion sickness; record
   comfort 0–10 before and after, completion, and defects.
7. **Release.** Deploy the static build (Vercel); open the production URL on
   desktop (inline fallback) and in a headset (Enter VR). Record the URL,
   commit and evidence in the release record.

## Decision rules

- No store listing or native-only feature needed → WebXR. Store listing,
  native SDK, or a frame budget WebXR cannot meet on the floor device →
  propose Unity + OpenXR as an ADR-0012 amendment; check current licence
  terms, never answer fees from memory.
- Frame drops → profile first (CPU vs GPU vs GC; draw calls, overdraw,
  texture size), fix the top hotspot, re-measure. Lower render scale or
  foveation only after that.
- The camera must never move without user input; any forced motion, roll or
  head-locked text is a defect, not a style choice.
- A tester stops for discomfort or comfort rises by 3+ → release blocked
  until a fix is retested.
- Feature missing on a browser (hand tracking, anchors, layers, hit-test) →
  feature-detect and fall back; never assume Quest-only APIs.
- Pose, hand joints, room mesh or passthrough would leave the device → stop
  and run `security-and-privacy` first.
- Store account, signing key or paid fee needed → owner action; secret names
  only, values in Infisical.
- Third-party or AI-generated 3D asset without a recorded licence → do not
  ship.
- Landing page or 2D shell changed → also run the `qa-testing` UI gate.

## Done means

- XR technical design and interaction/comfort record exist and are linked
  from the repo's DOCPACK or README.
- CI green: lint, type, unit, build, emulated-XR smoke, shared security scan.
- Budgets measured on the floor headset; at least one comfort playtest
  recorded with no tester stopping for discomfort.
- Production URL opens the inline scene on desktop and enters VR in a
  headset; anything not run on a real headset is named as not verified.
