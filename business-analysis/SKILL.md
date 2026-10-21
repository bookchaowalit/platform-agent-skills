---
name: business-analysis
description: Run an evidence-backed Business Analyst lifecycle for ambiguous business needs, product discovery, client work, process improvement, requirements, user stories, traceability, change control, UAT, and handoff. Use when a request needs stakeholder analysis, BRD-style requirements, acceptance criteria, business decisions, or measurable benefits.
---

# Business Analysis — Solo Empire

## Overview

Turn a vague request into an approved, traceable, testable, and handoff-ready
business outcome. Use the role charter and process as the governing contract;
use only the artifact templates required by the bounded initiative.

## Establish context

- Read dashboard/CURRENT-STATE.md, docs/ARCHITECTURE.md, and
  docs/AI-AGENT-GUIDE.md before substantial work.
- Read `roles/business-analyst/README.md` and `PROCESS.md` from the `bookchaowalit/knowledge-base`
  checkout (set `SOLO_KNOWLEDGE_ROOT`; default is the `knowledge-base` sibling of this checkout); they no longer live in this repository.
- Identify the owning boundary, accountable decision maker, affected users,
  data classification, current status, and live task source.
- Inspect git status and preserve unrelated changes.

## Lifecycle

1. Intake: state the business problem, outcome, owner, scope, non-goals, and
   decision path. Create a concrete SQLite task for the next action.
2. Discovery: use discovery-plan.md and stakeholder-map.md. Gather permitted
   evidence, interviews, workflows, constraints, and unanswered questions.
3. Options: use business-case.md when the decision needs trade-offs,
   investment, risk, or benefits analysis.
4. Process analysis: use as-is-to-be-process.md to model current behavior,
   target behavior, gaps, rules, exceptions, and controls.
5. Requirements: use business-requirements.md and user-story.md. Make each
   priority item testable, sourced, prioritized, and owned.
6. Baseline: obtain accountable approval, version the baseline, and start
   requirements-traceability-matrix.md. Include the KPI definitions and
   targets from `templates/sdlc/kpi-and-instrumentation-plan.md` (owned by
   `product-management`) in the baseline; for client work the client signs
   them at G5 with the requirements.
7. Change control: never silently edit an approved baseline. Use
   change-request.md and decision-log.md, then update the RTM after a decision.
8. UAT: use uat-plan-report.md. Distinguish smoke checks, technical tests,
   UAT, business acceptance, defects, waivers, and evidence.
9. Handoff: use handoff-benefits-review.md. Transfer ownership, limitations,
   support boundaries, metrics, evidence, and the next review task. Cite KPI
   IDs from the KPI plan; do not define metrics again.
10. Benefits follow-up: the **Actual** column of the benefits review cites
   the latest `templates/sdlc/outcome-review.md`. Each outcome-review
   decision that changes scope goes through change-request.md and the RTM.

## Artifact rules

- Keep drafts, approved baselines, rejected changes, and evidence separate.
- Link objective → requirement → acceptance criterion → test/evidence →
  release → KPI → experiment → outcome review, as in the SDLC traceability chain
  (`templates/sdlc/README.md`).
- Record source, rationale, priority, owner, status, approver, and date.
- Use placeholders only in templates; do not leave them in an approved artifact.
- Store reusable blank starters under templates/roles/business-analyst/.
- Keep live actions in SQLite and use Markdown for durable evidence and
  reusable procedures.

## Stop conditions and approvals

- Stop when there is no accountable owner, decision path, or usable evidence.
- Stop and ask for direction before sending external messages, changing
  production, spending money, exposing private data, or deleting/overwriting.
- Route legal, tax, employment, medical, or regulated questions to the proper
  expert; do not convert analysis into professional advice.
- Treat conflicting or incomplete tool results as unknowns and record them.
- Do not claim UAT, acceptance, benefits, or publication without evidence.

## Quality gate

Before handoff, verify:

- [ ] Accountable owner approved the baseline or disposition.
- [ ] Priority requirements have acceptance criteria.
- [ ] RTM links requirements to tests/evidence.
- [ ] Changes have impact assessment and decision records.
- [ ] UAT scope, environment, tester, result, and evidence are recorded.
- [ ] Known limitations, support owner, KPI baseline, and next review exist.
- [ ] The first outcome review is scheduled (G11) and benefits cite KPI IDs.

## Handoff

Report the artifacts created, baseline/version, approvals, evidence links,
open risks, unresolved assumptions, tests/UAT performed, known limitations,
and the next safe action. Run `task roles:check` before
declaring the role package structurally complete.
