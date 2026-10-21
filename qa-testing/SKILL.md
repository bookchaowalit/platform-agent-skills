---
name: qa-testing
description: Plan and evidence software quality for Solo Empire systems — test strategy, test levels, environments, test cases with expected results, entry/exit criteria, defect records, UAT scripts, quality-gate evidence linked to requirements, and the full-page UI visual review (cross-browser and device capture, visual baseline diff, accessibility and mobile performance) with sign-off before a UI release. Use when designing tests or UAT for a system, writing a test-uat document, assessing release readiness from test evidence, reconciling test results with the RTM, or reviewing, merging or deploying any user-facing UI change.
---

# QA and Testing

Make quality claims traceable: every priority requirement maps to a test,
every test to evidence, and every gap to an owner.

## Workflow

1. Read the system's requirements (SRS/FR-xx, user stories) and RTM, plus
   existing tests in the owning repository (unit, integration, E2E, smoke).
2. Run the existing suites when they are local and safe; record the command,
   date, and pass/fail counts as evidence. Never claim a run you did not do.
3. Write the test strategy: levels, scope per level, environments and data,
   tools, entry/exit criteria, defect severity and triage rules — base it on
   `templates/development-cycle/test-strategy.md` or
   `templates/positions/qa-test-engineer/quality-assurance-plan.md`.
4. Write TC-xx cases (precondition, steps, expected result, linked FR-xx,
   status, evidence) and a UAT script for business testers.
5. Record defects with `templates/development-cycle/defect-record.md` and
   update the RTM status column through `business-analysis`.
6. For any user-facing screen, run the UI quality gate in
   `references/ui-quality-gate.md` on the rendered app. It covers readability,
   menu order, Thai copy, and information density and financial data.
   - Follow its section 0 procedure: review every touched page and its sibling
     pages at 375 and 1440 (plus 320, 768 and 1024 for layout changes).
   - Capture with `scripts/ui_review.mjs`, then look at every screenshot slice.
     Before a release, add WebKit, Firefox and phone emulation (`--browser`,
     `--device`), the visual diff against the approved baseline (`--baseline`),
     axe-core accessibility, and mobile Core Web Vitals (`--perf mobile`). See
     gate section 5 and `references/browsers-and-tools.md`.
   - Log each finding as a defect.
   - Sign off the reviewed commit with `scripts/ui_signoff.py`. Add
     `--promote-baseline` to a pass so it becomes the next visual baseline.
   - Capture the live URL again after deploy.
7. Verify analytics before release: run checks 1–7 of the instrumentation
   verification in `templates/sdlc/kpi-and-instrumentation-plan.md` —
   every event fires once per real action, counts reconcile with the system
   of record, no personal data in payloads, dashboards render, alerts fire,
   baselines captured or a dated action recorded, and no analytics before
   consent where consent is the lawful basis. Record evidence
   per check. Checks 1–5 and 7 must pass before G10; only check 6 can be
   waived with a dated action.
8. For staged rollouts, confirm each stage's guardrail KPIs and rollback
   triggers in `templates/sdlc/launch-gtm-plan.md` section 8 match the
   runbook and the go-live checklist.
9. Check release readiness against `templates/development-cycle/quality-gate-pack.md`.

## Decision rules

- Distinguish developer retest, automated tests, client UAT, and business
  acceptance; only the client signs acceptance.
- Untested or blocked cases stay visible with a reason; never drop them.
- Production data or real payments in tests → stop for explicit approval.
- An A/B test result with a sample ratio mismatch (chi-square p < 0.001) or
  broken events is invalid: do not analyse it, record a deviation in the EXP
  card run record, raise a defect for broken instrumentation, and rerun.
- Passing tests, overflow checks and agent summaries are not a UI review. Only a
  look at the rendered screenshots is, recorded with `ui_signoff.py`.
- `ui_signoff.py` posts the GitHub commit status `ui-review`. For pull requests that
  touch no UI files, use `ui_review_status.py`. Where a branch rule requires the
  status, every pull request needs one of the two.
- Logged-in pages: `scripts/ui_login.mjs` saves a session (mode 600, outside any repo).
  Pass it to `ui_review.mjs` and `ui_states.mjs` with `--storage-state`.
- `scripts/ui_review_gate.py` is a PreToolUse hook. It blocks `vercel --prod`,
  `gh pr merge` and `git push` to the default branch for unsigned UI changes. A local
  merge followed by a push is gated the same way. `UI_REVIEW_GATE=off` disables it.

## Handoff

Report suites run with results, TC coverage of priority requirements, open
defects by severity, UAT status, instrumentation check results, exit-criteria
verdict, and next action.
