# TDD + SDD evidence (ADR-0004) and post-release quality signals

Source of truth: architecture-docs
`docs/architecture/decisions/ADR-0004-tdd-sdd-standard.md` (v1.1, accepted
2026-10-21). Read it before judging a disputed case; this page is the
checklist a tester applies.

## Spec before code (SDD)

- Every change that adds or changes behaviour has
  `specs/<NNN>-<slug>/spec.md` in the owning repo, copied from
  architecture-docs `templates/sdlc/feature-spec.md`.
- Behaviour is numbered scenarios `AC-##` in Given / When / Then, each linked
  to a requirement ID and to the test that proves it. TC-xx cases and the RTM
  cite the AC IDs.
- The spec is reviewed by a different agent than its maker and approved by
  the owner (or client) before implementation: part of the Definition of Ready.

## Failing test first (TDD)

- Each scenario goes red → green → refactor; a bug fix starts with a test
  that reproduces the bug.
- The spec's red/green log records red: `sha · command · failure message`
  (an assertion, not a typo or import error) and green: the CI run URL.
- Main-only repositories (spec says `Main-only: yes`): the red run is local.
  The failing-test commit comes before the implementation commit, the checker
  reruns the red commit and sees the expected failure before the push, and
  both are pushed together. `gh run list --commit <red-sha>` returns no run;
  the tip's run passed. No squash, rebase or force-push after the log.
- Exceptions (spikes, generated code, pure config/docs, visual-only UI covered
  by the UI quality gate) are written in the spec with the replacement check
  and an owner-approved DoD exception row.

## CI gates (opt-in per repo)

- Shared CI `bookchaowalit/platform-ci-workflows` v1.1.1:
  `require-tests: true` (ci-node) and `coverage-threshold: "<n>"`.
- `<n>` is measured coverage **rounded down** (82.96% → 82), no cap, raised
  when coverage beats it by ≥ 2 points, never lowered without an
  owner-approved exception. Below 80% gets a task to add tests.
- Coverage is a floor, not proof: check that tests assert behaviour from the
  AC, not lines.

## Definition of Done checks a tester can confirm

From the Big Loop scorecard (hub `infra/scripts/platform/app_goal_scorecard.py
--repo <name>`): L2 needs ≥ 3 meaningful test files; L3 needs `specs/`. Tests
never hit live third-party sites. Report the scorecard level with the
evidence, not instead of it.

## Post-release signals that come back as tests

| Signal | What QA does |
|---|---|
| Sentry error issue in a live repo | Write the failing test that reproduces it before the fix; link the Sentry issue in the defect and the task (key `sentry/<project>/<fingerprint>`) |
| Incident action (INC-xx) | Regression test for the failure mode, or a recorded reason why it cannot be tested |
| Experiment with SRM or broken events | Invalid; defect for the instrumentation; rerun |
| Outcome review flags a KPI drop | Check the instrumentation (checks 1–7) before anyone reads the drop as real |

Filing rules (dedupe, labels, backlog choice pending D2) are in
architecture-docs `docs/lifecycle/OUTCOME-REVIEW-TO-BACKLOG.md`.

## Autopilot gates

`productivity-tracking-web/.autopilot/` merges only after gate 1
(`npm test`, lint, build), gate 2 (a separate read-only reviewer session) and
gate 3 (visual: `ui_review.mjs` at 375/768/1440 on `main` and the branch,
judged against `ui-quality-gate.md`). A tester reviewing autopilot work
checks the task record in `docs/autopilot/tasks/` and that each Given/When/Then
in the issue has a test or a screenshot.
