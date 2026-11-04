---
name: project-management
description: Run the Project Manager / Delivery Manager role for Solo Empire projects and client engagements — charter and authority, linked baseline (scope, schedule, cost, quality) with tolerances, WBS and resourcing, milestones and phase gates, RAID, a rated status report on a fixed cadence, change control against the baseline, external-party and vendor tracking, and closeout with final variance and lessons. Use when starting, planning, tracking, reporting on, escalating, re-baselining, or closing a project or engagement. Not for what to build or KPIs (product-management), backlog ordering and story acceptance (product-owner), requirements detail (business-analysis), or estimating effort (ai-native-estimation).
---

# Project Management

Keep a bounded project on its approved baseline, make its status honest and
visible, and close it with evidence.

## Workflow

1. Establish context: the owner and sponsor, client or internal, contract or
   SOW, the system's docpack, and the live task source. Open or create the
   control record from architecture-docs
   `templates/positions/project-delivery-manager/project-control-record.md`;
   it links every detailed artifact below rather than copying them.
2. Initiate: write `templates/sdlc/project-charter.md` (objective, scope,
   authority, sponsor, constraints) and get it approved. Client work starts
   from `templates/roles/engagement-delivery/engagement-kickoff.md`.
3. Plan the baseline:
   - scope from the BA requirements baseline (`business-analysis`);
   - WBS and resources with `templates/sdlc/wbs-and-resource-plan.md`;
   - effort and dates from `ai-native-estimation` (ranges, critical path,
     wait time);
   - milestones, gates, and RAID with
     `templates/development-cycle/delivery-plan-and-raid.md`;
   - cadence and audiences with `templates/sdlc/communication-plan.md`.
   Set a tolerance per dimension (scope, schedule, cost, quality). Mark
   dates that are not approved **[ต้องยืนยัน]**.
4. Track: on the stated cadence, update forecast against baseline, the RAID
   items rated high or due soon, and the milestone table. Outsourced or
   vendor work goes in `templates/sdlc/external-parties/` (milestone and
   deliverable tracker, delay and dependency log).
5. Report status with
   `templates/roles/engagement-delivery/delivery-status-review.md` and add a
   row to the control record. Rate with the written rule: green inside
   tolerance, amber outside with a recovery plan, red outside without one or
   when a sponsor decision is needed. Every decision needed has an owner and
   a date.
6. Change control: any change to scope, schedule, or cost beyond tolerance
   needs a change record
   (`templates/roles/engagement-delivery/delivery-change-record.md`, or the BA
   `change-request.md` for requirements) and an approval before the baseline
   moves. Then update the RTM, plan, and estimate.
7. Gates: run each phase gate with `templates/sdlc/phase-gate-record.md`;
   readiness and acceptance use the engagement-delivery `readiness-review.md`
   and `acceptance-plan.md`. Record minutes with
   `templates/sdlc/meeting-minutes.md`.
8. Close: accepted deliverables, final variance against baseline, handoff
   (`final-handoff.md`), lessons learned, estimate calibration back to
   `ai-native-estimation`, and open items moved to the backlog with a new
   owner.

## Decision rules

- Report what is true. Never show green to avoid a hard conversation; a
  missed date or a blocked item is amber or red until recovered.
- The baseline moves only through an approved change. Silent re-planning is
  a defect.
- Spending, contract scope, external messages, delay notices to clients, and
  vendor escalation are owner decisions; draft them, do not send them.
- Keep the evidence trail complete for outsourced and client work:
  decisions, approvals, minutes, and acceptance records with dates.
- Do not duplicate other roles' artifacts. Link the BA baseline, the PO
  backlog and acceptance record, the SA design, and the QA evidence.

## Handoff

Report the control record version, baseline versions and approvers, the
current rating per dimension with variance, high RAID items with owners,
open change records, next gate and its readiness, decisions needed with
owner and date, and closeout status when the project ends.
