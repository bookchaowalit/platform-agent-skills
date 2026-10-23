# Measure → Learn → backlog loop

How product work closes the loop after release. Sources of truth (read them
before quoting numbers or rules):

- architecture-docs `docs/lifecycle/DEVELOPMENT-LIFECYCLE.md` and `.yaml` —
  stages `measure` and `learn` after `operate-and-improve`.
- architecture-docs `docs/lifecycle/OUTCOME-REVIEW-TO-BACKLOG.md` — how a
  signal becomes one task (keys, labels, dedupe).
- architecture-docs `docs/architecture/decisions/ADR-0005-product-analytics-standard.md`
  — analytics layers (accepted 2026-10-21).
- architecture-docs `operations/policies/TASK-SOURCE-OF-TRUTH.md` — single
  backlog (accepted 2026-10-23, owner decision D2).
- Hub `repository-catalog/roadmaps/BIG-LOOP-PLAN-2026-10-21.md` — Definition
  of Done and Wave 4.

## Stages

| Stage | Owner | Exit gate |
|---|---|---|
| Measure | Product (the owner in solo work) | KPI plan approved, events live and passing instrumentation checks 1–7, dated baseline for every outcome KPI |
| Learn | Product | Outcome review decided no later than 30 days after events went live; every decision is a backlog task with a source link |

Both apply to Tier A/B products. Other repos record `not_applicable` with a
reason instead of skipping silently.

## KPI plan (docpack type `kpi-plan`, KPI-PLAN)

- Template: architecture-docs `templates/sdlc/kpi-and-instrumentation-plan.md`.
- Required for product tier A and B (hub `docpack-coverage.yaml`,
  `product_tier_required`). The docpack checker does not enforce it yet; the
  Big Loop scorecard does (L3 `kpi_plan`).
- Location in the owning repo: `docs/measurement/kpi-and-instrumentation-plan.md`
  and versioned queries in `analytics/kpi/<KPI-ID>.sql`. The scorecard accepts
  any file under `docs/measurement/` or `analytics/kpi/`, or a name containing
  `KPI-PLAN`.
- Reference implementation: `productivity-tracking-web` (ADR-0005 pilot).

## ADR-0005 layers (which tool measures which KPI)

| Layer | Use for | Tool |
|---|---|---|
| 1 System of record | Money, orders, accounts, bookings and other regulated counts | Versioned SQL on the app's own DB, read-only role |
| 2 Product analytics | Funnels, activation, experiments | PostHog Cloud EU free tier (D4), pseudonymous `distinct_id`, consent-gated browser events; goes live after the owner's sign-up, DPA and consent banner |
| 3 Page analytics | Marketing and content sites | Cloudflare Web Analytics or Umami; never an outcome KPI |

Client work never sends end-user data into the owner's PostHog project.
Until the owner's PostHog sign-up and DPA are done, plan layer-2 events but measure outcome KPIs with layer 1.

## Outcome review

- Template: `templates/sdlc/outcome-review.md`. First at T+30 after events
  went live, then T+60, T+90, then the KPI plan cadence.
- Inputs: KPI results against baseline, experiment cards, open Sentry
  error issues, incidents (INC-xx), user feedback for the period.
- Attribution: "caused" only with `high` confidence (a controlled experiment
  whose pre-registered rule was met); otherwise "coincided with".
- Each row of "Decisions and actions" becomes a backlog task with key
  `outcome-review/<OR-id>#<row>` and labels `source:outcome-review`,
  `type:*`, `P0`–`P3`. Write the task link back into "Tracked in".

## Backlog (D2, decided 2026-10-23)

- platform-empire tasks-api is the single backlog; upsert by external
  identity (`PUT /v1/tasks/external/<source>/<key>`). GitHub issues labelled
  `autopilot` or `backlog` feed it (`github/<owner>/<repo>#<n>`).
- The sync worker `empire-backlog-sync` (platform-empire) files GitHub
  issues, Sentry errors, decided outcome reviews and incident reviews. It runs
  as a dry run until its Railway cron host (ADR-0006, proposed) and tokens are
  in place; until then, and always for experiment cards, file by hand with the
  same keys.

## Autopilot

`productivity-tracking-web/.autopilot/` runs maker → reviewer → visual gates
on issues labelled `autopilot:todo`. Its planner proposes work only when the
backlog is empty, as `autopilot:proposed`; only the owner moves an issue to
`autopilot:todo`. Outcome-review tasks for an autopilot repo are opened as
`autopilot:proposed` issues with Given/When/Then acceptance criteria. The
planner should read the KPI plan, outcome reviews, the experiment log and
labelled signal issues (Wave 4 item 5; that repo's session owns the change).

## Definition of Done (Big Loop scorecard)

`python3 infra/scripts/platform/app_goal_scorecard.py --repo <name> [--fetch]`
(hub). L1 baseline (CI, shared CI, lockfile, README, no suppressed errors, no
tracked secrets) → L2 product (`PRODUCT.md`, ≥ 3 test files, Sentry where
there is a runtime, type check) → L3 loop (KPI plan, `specs/`, deploy
workflow; Tier A/B only). A product has closed the loop once when: events
live → outcome review → task in the backlog → done and released → measured
again in the next review.

## Owner decisions (2026-10-23)

| ID | Decision | Effect on this skill |
|---|---|---|
| D2 | tasks-api is the single backlog | File every action there by its key; the sync worker is in dry run |
| D3 | ADR-0003 accepted | "Released" = deployed from Git after CI and smoke-tested (`deploy-railway.yml` v1.3.0 `mode: verify`) before measuring |
| D4 | PostHog free tier | Owner still signs up, accepts the DPA and adds a consent banner; layer-2 events wait for that |
