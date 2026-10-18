---
name: ux-review
description: Audit and fix the UX of a running web app end to end, with evidence. The phases are product map from code, personas, sitemap and route sweep, authorization matrix, persona flows and flow tests, then section-by-section page review at every width. They continue with interaction states, accessibility and mobile performance, Thai copy and production readiness, data and figure consistency, heuristic and IA scoring, a fix loop, and a re-check on production. Use when asked to review, audit, QA or polish a product's UX or UI, to check a site before or after release, to run a UX checklist across an organisation's apps, or when a reader found a UI problem that passing tests missed. Not for writing a PRD or designing new flows (product-management), new visual design (impeccable), or test strategy and UAT (qa-testing).
---

# UX Review

Find what a real user would trip over, prove it with screenshots and numbers, fix
what is clearly a defect, and hand the owner a short list of real decisions.
Automated checks and tests narrow the search; only looking at the rendered page
closes it.

## Workflow

Run the phases in order. Each phase has inputs, steps, pass criteria and outputs in
the linked reference. Skip a phase only when the owner says so, and record the skip.

1. **Set up** (P0): environment, accounts per role, test data, widths, and the evidence
   folder. Production stays read-only. See `references/phases-discovery.md`.
2. **Map the product from code** (P1–P2): roles, routes, permissions, and main use
   cases as business outcomes, with implemented/partial/proposed status. Personas only
   where code shows them.
3. **Sweep every route** (P3–P4): every route × role × width for status, errors,
   overflow and access, plus an authorization matrix of role × page × action × API.
4. **Walk the flows** (P5–P6): as-is and to-be Mermaid flows per persona and use case,
   then run each flow step in a browser at phone and desktop width.
5. **Review every page** (P7): section by section at 320/375/768/1024/1440 with
   `../qa-testing/scripts/ui_review.mjs`, against `references/page-checklist.md`. Open
   every screenshot slice. Main use cases also run in WebKit and Firefox and on emulated
   phones (`--browser`, `--device`). With a baseline (`--baseline`), start with the
   changed regions.
6. **Check interaction states** (P8): hover, focus, active, disabled, loading, empty,
   error, success, dialogs, menus, toasts and forms. Use `scripts/ui_states.mjs` and
   `references/interaction-states.md`.
7. **Check accessibility and performance** (P8b): axe-core WCAG findings on every
   capture, mobile Core Web Vitals and JS bytes with `--perf mobile`, and the keyboard
   and screen-reader checks that tools cannot do.
8. **Check content** (P9): Thai copy, terminology, and leaks of demo, sample, test or
   placeholder text, including text from the API and seed data.
9. **Check data and figures** (P10): each figure has one home, precision is
   consistent, numbers agree across pages and with the API, and calculations
   reconcile. See `references/data-and-figures.md`.
10. **Score** (P11): heuristic and IA findings with severity, linked to the flows and
   pages where they occur.
11. **Fix loop** (P12): fix bugs and clear UX defects, re-run the affected phases, keep
    before/after evidence, and list owner decisions without changing them.
12. **Release and re-check** (P13): sign off with `../qa-testing/scripts/ui_signoff.py
    --promote-baseline`, ship through the release gate, then repeat P3, P7, P8 and P8b
    on the live URL against the baseline.

Report with `references/report-format.md`.

## Decision rules

- **What counts as reviewed:** a page is reviewed only when every section was looked at
  at every width in scope. "Scanned", "no overflow" or "tests pass" do not count.
- **One finding means a whole-page review:** if one finding is reported (by the owner,
  a client or a tool), review the whole page and every page that renders the same
  components.
- **What you fix:**
  - A defect (broken, unreadable, wrong, inconsistent with the product's own rules)
    gets fixed.
  - A business choice goes on the owner list with options and a recommendation:
    menu order, pricing, legal text, role names, feature removal.
- **Text from the API or seed data:** fix it at the source repository and say so. Do
  not patch it over in the UI.
- **Production:** never create accounts or data, or pay, on production. Use local or
  staging for anything that writes.
- **Numbers:** never change a calculation to make a page look right. A figure that
  disagrees across pages is a defect to trace, not to hide.
- **Splitting work:** delegate a phase only with a brief that names pages, widths,
  evidence paths and pass criteria. Check the returned screenshots yourself before
  accepting the result.

## Resources

- `references/phases-discovery.md` covers P0–P6: setup, product map, personas,
  sitemap, authorization, flows and flow tests. Read it when starting a review.
- `references/phases-quality.md` covers P7–P13: page review, states, accessibility and
  performance (P8b), content, data, scoring, the fix loop and the production re-check.
- `references/page-checklist.md` has the measurable section-by-section criteria for P7.
- `references/interaction-states.md` has the state matrix and contrast rules for P8.
- `references/data-and-figures.md` has the figure inventory and reconciliation for P10.
- `references/production-test-accounts.md`: rules for read-only review accounts and sessions on production. Read it before any logged-in live check.
- `references/report-format.md` sets the evidence folder layout, IDs, severities, CSV
  columns and summary.
- `scripts/ui_states.mjs` forces hover, focus and active on every control and measures
  contrast and focus visibility.
- `../qa-testing/scripts/ui_review.mjs`, `ui_signoff.py` and `ui_review_gate.py` handle
  capture, page audit, sign-off and the release gate. `ui_review.mjs` also runs the
  visual baseline diff, axe-core and the mobile performance pass. Browser and device
  setup is in `../qa-testing/references/browsers-and-tools.md`.
