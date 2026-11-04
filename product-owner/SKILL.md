---
name: product-owner
description: Own the Product Owner (PO) role for Solo Empire products — the ordered backlog in tasks-api, the written ordering rule, refinement until items meet the Definition of Ready, iteration or increment goals, accept/reject decisions on delivered items with evidence, and intake of stakeholder feedback into backlog items. Use when ordering or grooming a backlog, deciding what goes into the next iteration, checking DoR/DoD, or accepting a story, demo, or increment. Not for PRDs, roadmaps or KPIs (product-management), detailed requirements and RTM (business-analysis), or schedule, RAID and status reporting (project-management).
---

# Product Owner

Turn the approved product direction into an ordered, ready backlog, and
decide whether each delivered item is accepted.

## Workflow

1. Establish context: the product's PRD and roadmap version
   (`product-management`), the KPI plan, the DoR/DoD in use, and the live
   backlog in tasks-api (the single backlog, owner decision D2). Open or
   create the record from architecture-docs
   `templates/positions/product-owner/backlog-and-acceptance-record.md`.
2. Write the ordering rule before ordering: method (WSJF, value ÷ effort,
   MoSCoW within phase, or risk-first), inputs and where each comes from
   (KPI ID, user evidence, deadline, dependency, risk), tie-break, and which
   items bypass ordering (incidents, security, legal).
3. Order the top of the backlog by that rule. Every item in the top 10
   traces to a requirement (FR/US in the BA RTM) or a KPI ID; an item that
   traces to neither is a discovery question, not a ranked item.
4. Refine: split items until each fits one iteration, make acceptance
   criteria testable with `business-analysis` (`user-story.md`), get an
   estimate (`ai-native-estimation` for multi-module work), and check
   `templates/sdlc/definition-of-ready-and-done.md`. Record the change and
   any open question in the refinement log.
5. Set the iteration or increment goal as one outcome sentence, commit only
   items that meet the DoR, and note the capacity basis.
6. Accept: compare each delivered item with its acceptance criteria and the
   DoD, using evidence (tests from `qa-testing`, a demo, UAT, screenshots, a
   `flow-video` recording). Record accept, reject, or accept-with-defect,
   with the reason. A rejected item or a found defect becomes a backlog item
   with its ID in the record.
7. Feedback intake: put every piece of user, client, or review feedback into
   the intake table with a disposition (new item, merge, decline) and an
   item ID, and record whether the source was told.
8. Scope change: when acceptance or feedback changes an approved baseline,
   raise a change request through `business-analysis`; do not edit the
   baseline in place.

## Decision rules

- Order by evidence and the written rule, not by who asked last.
- Never accept an item without evidence against its acceptance criteria.
  "Looks done" or "tests pass" alone is not acceptance.
- Product direction, pricing, and client commitments belong to the product
  manager or owner; the PO records them as questions until decided.
- For autopilot repos, new items go in as `autopilot:proposed`; only the
  owner moves them to `autopilot:todo`.
- For client work, the client's named acceptor signs acceptance; the PO
  prepares the evidence and records the decision.

## Handoff

Report the ordering rule version, the top-of-backlog snapshot with trace
links, items refined and still not ready (with the gap), the iteration goal
and whether it was met, acceptance decisions with evidence links, new
backlog IDs from rejections and feedback, open change requests, and who must
decide what next.
