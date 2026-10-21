---
name: flow-video
description: Record walkthrough videos of a running web app per role and use case, so the owner, a client or a new tester can see what pages and flows exist without reading code. A role tour visits every menu page that role can see and writes a role × page map. A use case video plays a scripted scenario (goto, click, fill, scroll) with Thai captions, a visible cursor and highlighted targets. Output is WebM (MP4 when ffmpeg has libx264), captions, one frame per step and a gallery page. It is read-only by default and aborts write requests. Use when asked for a demo, walkthrough, motion, screen recording, flow video, use-case video, a "what does each role see" map, onboarding or handover material, or when a vibe-coded app has grown past what the owner can keep in their head. Not for UX auditing (ux-review), test strategy (qa-testing) or designing new flows (product-management).
---

# Flow Video

Show the product as it really behaves, one role and one use case at a time.
A video is evidence of what exists today, not a design: record only routes and
actions that are live in the environment you point at.

## Workflow

1. **Map roles and use cases.** Take them from the system's docpack (`ux-flows`,
   `srs` use cases), ux-review P1–P2 output, or the code (role enums, route guards,
   menu config). Give each use case an ID that matches the docs (`UC-01`, `FR-03`).
   List per role: who they are, what they come to do, and the 2–5 use cases that
   matter most. Ask the owner only for business names the code does not show.
2. **Pick the environment.** Local or staging for anything that writes. Production
   only with review accounts, read-only, under
   `../ux-review/references/production-test-accounts.md`.
3. **Sign in each role once** with `../qa-testing/scripts/ui_login.mjs`. Sessions live
   in `~/.local/state/ui-review/sessions/<app>-<role>.json`, never in a repository.
   Run `source ~/ai-stack/ui-test-env.sh` first on this WSL machine.
4. **Write the scenario file** (`references/scenario-format.md`): one `tour` per role
   first, then one `steps` scenario per use case. Each step's `say` is one short Thai
   sentence about what the user does and why, not a description of the UI. Look up
   real selectors on the rendered page (role, visible text, `href`). Do not guess them.
5. **Record:** `node scripts/flow_video.mjs --scenarios flows.json --out <dir>`.
   Add `--only UC-02` to redo one video. The gallery keeps the others. Use
   `--slow 1.3` for a client audience and `--mp4` when it will be sent on LINE or
   by email.
6. **Review every video yourself.** Open each `<id>/NN.png` storyboard frame. Check
   that the caption matches what is on screen, that the target is highlighted, that
   no step landed on an error, empty state or sign-in page, and that no personal or
   client data shows that the audience must not see. A failed scenario writes
   `failed.png` and exits 1. Fix the selector or the flow and record it again.
7. **Check the page map** (`page-map.md`) against the intended permissions. A page
   in a role's menu that refuses (✗) and a page missing from a role that should
   have it are findings. Log them through `ux-review` or `qa-testing`.
8. **Publish inside the boundary.** Link the gallery and page map from the
   system's docpack `ux-flows` doc (use case ID → video file). Keep the videos out
   of git (large binaries, they may show data). Store them in the evidence folder,
   or in the client folder for client work.
9. **Re-record when a flow changes.** A release that changes a recorded flow or a
   role's menu re-records the affected videos in the same change, so the videos
   never describe an older app.

## Decision rules

- **Writes:** a scenario that must create or change data sets `"writes": true`, and
  the file sets `"readOnly": false`. The command then needs `--allow-writes`, and
  the run must target local or staging. On production that requires the owner's
  written approval of that exact flow, plus a clean-up.
- **Blocked writes:** in read-only mode only GET, HEAD and OPTIONS reach the server,
  and WebSockets are mocked. `blockedWrites` lists what was stopped. A step that
  submits a form ends the scenario as `blocked`. A use case whose point is a write
  (submit, approve) is recorded up to the button, with an `expect` step ("this button
  sends it for approval"). Do not fake the result.
- **Expired session:** a scenario that lands on the sign-in page stops with an error
  rather than record the public site under the role's name. Sign in again.
- **Audience edition:** for a client, show only that client's roles and use cases.
  Use demo data, and keep internal IDs, admin pages and other clients out of frame.
  Sending a video outside is an external action and needs approval.
- **No narration audio:** captions are burned in and also exported as `.vtt`.
  Voice-over is a separate, owner-approved step.
- **Videos are not a review:** they show the flow. They do not sign it off. UX
  findings still go through `ux-review` and `qa-testing`.

## Resources

- `scripts/flow_video.mjs` records tours and use cases. It writes `.webm`/`.mp4`,
  `.vtt`, step frames, `manifest.json`, `page-map.md` and `index.html`.
- `references/scenario-format.md` covers the JSON format, step actions, selectors,
  pacing and examples. Read it before writing a scenario file.
- `../qa-testing/scripts/ui_login.mjs` saves a role session.
- `../ux-review/references/production-test-accounts.md` sets the rules for review
  accounts on production.
