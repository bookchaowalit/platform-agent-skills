---
name: system-docpack
description: Create, complete, audit, and publish the per-system document pack (PRD, architecture, NFR, runbook, SRS, UX flows, test/UAT, RTM, business and delivery docs) and its PDFs for any Solo Empire portfolio system, client project, or our own apps. Use when asked whether a system's documentation is complete, to bring a system up to the EV3-style docpack, to add a new system to the portfolio docpack registry, or to rebuild docpack PDFs.
---

# System Docpack

Every portfolio system keeps one evidence-based document pack sized to its
tier (L1 Lite, L2 Standard, L3 Full). EV3 is the reference implementation.

## Workflow

1. Run `task docpack:check` (add `-- --system <id>` or `-- --json`) to see
   which systems and doc types are missing, malformed, or have stale PDFs.
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

- No evidence for a fact → write **[ต้องยืนยัน]** / **[สมมติฐาน]** and an open
  question; never fill the gap with invented numbers, prices, or decisions.
- Legacy pack with different file names → map types with `doc_type_map` in
  the registry or add a `doc_type:` front-matter line; do not rename files.
- Client edition (`audience: client`) → the builder strips source sections,
  source columns, and repository paths; internal packs keep them.
- Sending a PDF to a client, posting it, or uploading it anywhere is an
  external action → stop for explicit approval.
- Personal names, contact details, secrets, raw client data → never in a pack.
- Work started on or after 2026-10-16 also follows the 12-phase SDLC set in
  architecture-docs `templates/sdlc/README.md`. Its SDLC measurement and launch
  records are not docpack doc types: keep `kpi-and-instrumentation-plan.md`,
  `launch-gtm-plan.md`, `experiment-log.md`, and one `outcome-review.md` per
  review in the project's SDLC workspace, and link them from the docpack
  overview (KPI plan from the prd success-metrics section, launch plan from
  the runbook, latest outcome review from the overview status).
- When asked whether a released system's documentation is complete, also
  check for a KPI plan with verified instrumentation and an outcome review
  newer than its cadence. Report a missing or overdue one as a gap and route
  it to `product-management`; do not invent figures to fill it.
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
