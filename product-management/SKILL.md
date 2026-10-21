---
name: product-management
description: Own product and UX artifacts for Solo Empire systems — problem framing, personas, product vision, PRD with scope and prioritised features, success metrics, KPI and instrumentation plan, launch and go-to-market plan, experiments, post-launch outcome reviews, phased roadmap, screen inventory, user flows, and design-system notes. Use when defining what a product should do and for whom, writing or reviewing a PRD or roadmap, prioritising features, defining KPIs, planning a product launch, running a product A/B test, reviewing outcomes after release, or producing UX flows and screen inventories; not for AI-specific delivery (ai-product-delivery), detailed requirements and traceability (business-analysis), content calendars or channel experiments (content-distribution), or client proposals and pricing quotes (client-discovery-and-proposals).
---

# Product Management

Decide what to build, for whom, and how success is measured, and make the
user experience explicit enough to build and test.

## Workflow

1. Establish context: owner, users, current status, live evidence (usage,
   feedback, UAT findings, minutes) and the system's existing docpack.
2. Frame the problem: user pain, business outcome, constraints, non-goals.
3. Write the PRD (`01-prd.md` in the docpack or
   `templates/positions/product-manager/product-brief-and-roadmap.md`):
   personas, in/out scope, features with MoSCoW or P1/P2/P3 priority and
   phase, success metrics as KPI IDs and targets linked to the KPI plan (step 6),
   assumptions, risks.
4. Roadmap: phases and milestones tied to outcomes; mark unapproved dates
   **[ต้องยืนยัน]**.
5. UX: build the screen inventory from actual routes/pages (ID, name, role,
   status) and draw the main user flows in mermaid; note design-system
   components in use. Use
   `templates/positions/ux-ui-designer/research-and-design-handoff.md` for a
   standalone design handoff. To show the built flows to the owner, client or a new
   tester, record a role tour and use-case videos with `flow-video`.
6. Measure: turn the PRD success metrics into
   `templates/sdlc/kpi-and-instrumentation-plan.md` (architecture-docs) —
   an outcome, a leading, and a guardrail KPI for every charter objective,
   with formula, minimum volume, baseline, dated target, and the events
   that feed them. Draft it in phase 06 so G5 can approve it.
7. Launch: write `templates/sdlc/launch-gtm-plan.md` at a high level in
   phase 05 (type, tier, window, budget) and in full in phase 10
   (audience, positioning, pricing, channels with consent, enablement,
   support content, staged rollout, launch KPIs). G4 approves the
   high-level plan; G10 approves the full plan.
8. Learn: pre-register every A/B, pricing, or messaging test, and every
   rollout used to measure impact, in
   `templates/sdlc/experiment-log.md` before it starts. After release, run
   `templates/sdlc/outcome-review.md` at T+30, T+60, T+90, then on the KPI
   plan's cadence, and route each decision to a backlog item, experiment,
   change request, discovery question, roadmap change, KPI definition
   change, or feature retirement.
9. Hand requirements detail and acceptance criteria to `business-analysis`,
   architecture to `solution-architecture`, and test design to `qa-testing`.

## Decision rules

- Prioritise by user outcome and evidence, not by feature count.
- Metrics need a baseline source or an explicit measurement plan. Define each
  metric once, in the KPI plan; other documents cite its KPI ID.
- Experiment design and decision rules are fixed before the test starts. No
  stopping early for a win unless a sequential method was pre-registered.
- Say a release "caused" a KPI change only with `high` attribution confidence
  (a controlled experiment whose pre-registered rule was met with no
  invalidating deviation); otherwise say it "coincided with" the change.
- Pricing, contract scope, or client commitments are owner decisions; record
  them as open questions unless a signed record exists.
- Screens that exist only in design are labelled planned, not built.

## Handoff

Report the PRD version, prioritised scope, KPI plan version and
instrumentation status, launch plan status, open experiments, the latest
outcome review verdict, roadmap, screen/flow coverage, open decisions, and
who must approve them.
