# Delivery loop: spec → test → release → measure → learn

The current process every AI feature follows. Each line names its source;
read the source before applying a rule to a disputed case.

## Before code

- **Spec (SDD, ADR-0004).** `specs/<NNN>-<slug>/spec.md` from architecture-docs
  `templates/sdlc/feature-spec.md`: `AC-##` scenarios in Given / When / Then,
  each linked to a requirement and a test. Reviewed by another agent, approved
  by the owner (or client) before implementation.
- **KPI plan (ADR-0005).** Tier A/B products need the docpack type `kpi-plan`
  (template `templates/sdlc/kpi-and-instrumentation-plan.md`) at
  `docs/measurement/`. For an AI feature, separate the **evaluation set**
  (offline quality: accuracy, refusals, cost per call) from **product KPIs**
  (did users get the outcome). Both are needed; one does not replace the other.

## Build and verify

- **TDD (ADR-0004).** Red → green → refactor per AC; bug fixes start with a
  reproducing test. Main-only repos: the red run is local and red + green
  commits are pushed together (see `main-only-development`).
- **Evaluation** reruns after every prompt, model, retrieval or code change;
  thresholds live with the eval set.
- **Shared CI** `platform-ci-workflows` v1.1.1 with `coverage-threshold` =
  measured coverage rounded down; Sentry error-only with PII scrubbed where
  there is a runtime.

## Release

- CD standard is ADR-0003, **pending D3**. Until it is accepted, follow the
  owning repo's documented deploy target and check health after the push.
- Staged rollout guardrails and rollback triggers come from the launch plan.

## Measure and learn

- **Measure** stage exit: events live, instrumentation checks 1–7 pass,
  dated baseline. Layer-2 product analytics (PostHog EU) is **pending D4**
  (sign-up and DPA); until then measure outcome KPIs with system-of-record SQL
  (`analytics/kpi/<KPI-ID>.sql`). Never send prompts, completions or user
  text to analytics; send event names and counts.
- **Learn** stage exit: outcome review (`templates/sdlc/outcome-review.md`)
  decided by T+30, each decision a backlog task.
- Signals that become tasks (outcome review rows, Sentry error issues,
  INC-xx actions, experiment decisions) follow architecture-docs
  `docs/lifecycle/OUTCOME-REVIEW-TO-BACKLOG.md`: one task per action, dedupe
  key, labels `source:*`, `type:*`, `P0`–`P3`.

## Backlog and autopilot

- Single backlog: platform-empire tasks-api is proposed, **pending D2**;
  GitHub Issues in the owning repo are the fallback. Do not decide D2.
- Autopilot (`productivity-tracking-web/.autopilot/`): planner proposes
  `autopilot:proposed` issues, the owner approves to `autopilot:todo`, then
  maker → separate reviewer → visual gate → local merge. Caps: 3 tasks per
  run, 6 merges per day. Expansion to other repos is Wave 6, after the loop
  closes.

## Done means the scorecard agrees

Hub `infra/scripts/platform/app_goal_scorecard.py --repo <name>`:
L1 baseline → L2 product (`PRODUCT.md`, ≥ 3 test files, Sentry, type check) →
L3 loop (KPI plan, `specs/`, deploy workflow; Tier A/B). `PRODUCT.md`
describes only what exists.
