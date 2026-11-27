---
name: system-docpack
description: Create, complete, audit, and publish the per-system document pack (PRD, architecture, NFR, runbook, SRS, UX flows, test/UAT, RTM, business and delivery docs) and its PDFs for any Solo Empire portfolio system, client project, or our own apps. Use when asked whether a system's documentation is complete, to bring a system up to the EV3-style docpack, to add a new system to the portfolio docpack registry, or to rebuild docpack PDFs. Also use before starting a spec, feature or refactor in a system, to read and update its As-Is / To-Be file (docs/diagrams/01-business-process.md) and name the gap the work moves.
---

# System Docpack

Every portfolio system keeps one evidence-based document pack sized to its
tier (L1 Lite, L2 Standard, L3 Full). EV3 is the reference implementation.

## Workflow

Starting a spec, feature or refactor (not a docpack audit)? Do only the
"Before larger work" steps in `references/as-is-to-be.md`; the steps below are
for auditing or writing a docpack.

1. Run `task docpack:check` (add `-- --system <id>` or `-- --json`) to see
   which systems and doc types are missing, malformed, or have stale PDFs.
   It does not check the As-Is / To-Be file: also run
   `task report:as-is-to-be` in `platform-ops-cli` (a checkout that has that
   task; if it lacks it, or the report cannot run, say so and check the
   checkout's `docs/diagrams/01-business-process.md` by hand against
   `references/as-is-to-be.md` against every rule the report applies (H1 and summary,
   `Last reviewed` line with a date within 30 days and a commit, a mermaid diagram under `## As-Is`, `## As-Is`, `## To-Be`, `## Gap` with the
   fixed header, valid statuses and unique IDs, G0 alone, a `decide` row when there is
   no written To-Be) and treat as
   docpack gaps both the repository's entry in `missing` and the `problems` of
   its entry in `systems` (`data/generated/as-is-to-be/as-is-to-be.json`). Always
   pass `-- --root <the checkout under audit> --out <scratch folder>` (the
   default root is the empire clone folder, which a separate workspace or a
   branch/worktree does not have) and read
   `<scratch folder>/as-is-to-be.json`, not the hub copy. For a whole-portfolio
   audit (`task docpack:check` with no `--system`), pass the folder that holds every
   checkout in scope as `--root` (or run once per checkout) and match each audited
   system to its report entry, so no repository is skipped. A checkout given
   directly as the root (with no clones below it) is reported as one system,
   named from its `origin` remote; use `platform-ops-cli` at current `main`
   (older revisions miss duplicate gap IDs and unknown statuses). Pass the
   worktree's own root (`git rev-parse --show-toplevel`), and run the report
   again after editing the file, before you hand off. If the checkout does not appear in `systems` or `missing`, open
   its `docs/diagrams/01-business-process.md` directly instead of trusting the
   empty result. `docpack:check` still reads the registry's clone, not your
   worktree: for a branch, check the worktree's own docpack files by hand
   before concluding. Sub-system folders are not scanned; check their files by
   hand too.
2. Read `references/doc-standard.md` for tiers, file names, front matter,
   required sections, and writing rules. Do not reload it per document.
3. New system → add a row to
   `repository-catalog/registries/docpack-coverage.yaml` (id, name, kind,
   tier, pack). Choose the tier by risk: paid client acceptance → L3, public
   or small client/internal system → L2, internal tool or prospect → L1.
4. Gather evidence from the owning boundary: code, configs, routes, migrations,
   notes, minutes, existing docs. Nested repositories are read-only.
5. Write each missing doc as `NN-<doc_type>.md` plus `docpack.yaml`. Route
   content to the role skill that owns it:
   `product-management` (overview, prd, ux-flows), `solution-architecture`
   (architecture, nfr-security, runbook, trd-api-data), `business-analysis`
   (srs, rtm, business-case, business-flow, business-rules-data,
   decisions-glossary), `qa-testing` (test-uat), `security-and-privacy`
   (security and PDPA sections).
6. Build PDFs with `task docpack:build -- <system-id> [glob]`. Packs marked
   `pdf_builder: legacy` (EV3) keep their own builder under the client's
   `automation/docpack-pdf/`.
7. Personal Book Dev repos are discovered automatically and need a Product
   Card (L0). Collect facts with `python3 infra/scripts/docpack/repo_facts.py`,
   write `DOCPACK/00-product-card.md` with a verdict, then
   `task docpack:cards:index`. Promote an `invest` repo through
   `repo_discovery.tier_overrides` and write its L1+ docs in the same pack.
   Commit only `DOCPACK/` inside each nested repo.
8. Re-run `task docpack:check`; then `task test:docpack` if the checker or
   registry changed, and `task docs:check` before handoff.

## Decision rules

- Every system keeps `docs/diagrams/01-business-process.md` in the As-Is /
  To-Be layout of `references/as-is-to-be.md` (As-Is from code, To-Be from a
  written source, a `## Gap` table with `done|doing|todo|blocked|decide`).
  Before a spec, feature or refactor, read it and name the gap the work moves
  (a refactor that leaves the process unchanged says "no gap moved"); update
  it in the same change. A missing file, a missing gap table or a
  `Last reviewed` older than 30 days is a docpack gap. The cross-repo picture
  is `task report:as-is-to-be` in `platform-ops-cli`.

- No evidence for a fact → write **[ต้องยืนยัน]** / **[สมมติฐาน]** and an open
  question; never fill the gap with invented numbers, prices, or decisions.
- Legacy pack with different file names → map types with `doc_type_map` in
  the registry or add a `doc_type:` front-matter line; do not rename files.
- Client edition (`audience: client`) → the builder strips source sections,
  source columns, and repository paths; internal packs keep them.
- Sending a PDF to a client, posting it, or uploading it anywhere is an
  external action → stop for explicit approval.
- Personal names, contact details, secrets, raw client data → never in a pack.
- The KPI plan is docpack type `kpi-plan` (KPI-PLAN, number 15), required for
  every Tier A/B product (registry `product_tier_required`; the checker does
  not enforce it yet). Write it from architecture-docs
  `templates/sdlc/kpi-and-instrumentation-plan.md`, usually at the repo's
  `docs/measurement/`, and map it into the pack. Launch plan, experiment log
  and outcome reviews stay outside the docpack in the project's SDLC
  workspace: link them from the overview (launch plan from the runbook,
  latest outcome review from the overview status).
- When asked whether a released system's documentation is complete, also
  check for a KPI plan with verified instrumentation (lifecycle Measure) and
  an outcome review newer than its cadence whose decisions are backlog tasks
  (lifecycle Learn, architecture-docs `docs/lifecycle/OUTCOME-REVIEW-TO-BACKLOG.md`).
  Report a missing or overdue one as a gap and route it to
  `product-management`; do not invent figures to fill it.
- For Tier A/B, report the Big Loop scorecard level from hub
  `infra/scripts/platform/app_goal_scorecard.py --repo <name>` (L3 needs the
  KPI plan, `specs/` and a deploy workflow) next to the docpack result.
- Also check the technical design detail documents listed in
  `references/doc-standard.md` (infrastructure and network, observability,
  capacity/performance/cost, failure modes, async integration, frontend,
  tech-debt register, landscape row, vendor exit plan). Work started on or
  after 2026-10-16 needs all of them (`N/A` + reason where a topic does not
  apply); older systems with no new work use the "Expected for" column. They
  are not docpack doc types, so `task docpack:check` will not flag them:
  report each missing one, or one without an `N/A` reason, as a gap and route
  it to `solution-architecture`. For the landscape, check the system's row in
  the portfolio file, not a per-system file.

## Resources

- `references/doc-standard.md` — tiers, layout, front matter, required
  sections, ID conventions, quality gate.
- `infra/scripts/utils/docpack_coverage.py` — coverage checker
  (`task docpack:check`).
- `infra/scripts/docpack/make_pdfs.sh` and `build_html.py` — PDF pipeline
  (`task docpack:build`); needs Playwright headless Chromium and Sarabun
  fonts in `.runtime/fonts` (or `FONT_DIR`).
