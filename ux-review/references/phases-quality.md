# Phases P7–P13: page quality, fixes, release

## P7 Page review, section by section

Steps:

1. Pick the pages in scope:
   - every route from P3 with real content;
   - every page the change touches;
   - every page that renders the same components.
2. Capture every page at every width in scope:
   `node ../qa-testing/scripts/ui_review.mjs --url ... --widths 320,375,768,1024,1440 --out 07-pages --forbid <words>`.
3. Open every slice. Work through the page from top to bottom, one section at a time,
   using `page-checklist.md`, at phone width first and then desktop. Write findings
   against the section, not just the page.
4. Treat the automated findings in `report.md` as leads. Confirm or dismiss each one
   with a reason.

Pass: every section on every page has a verdict at every width, and every blocker or
major finding has a defect ID.

Output: `07-pages/report.md`, the slices, and `07-page-findings.csv`

## P8 Interaction states

Steps:

1. Run `node scripts/ui_states.mjs --url ... --widths 375,1440 --out 08-states` on each
   page. It forces hover, keyboard focus and press on every control. It records text and
   background colour, contrast and focus-outline visibility, and whether the state
   differs from the default.
2. By hand, open and check each of these against `interaction-states.md`:
   - every dialog, drawer and menu;
   - every dropdown and date picker;
   - every toast;
   - the cookie banner;
   - form validation, by submitting empty forms and bad values (local only);
   - the loading, empty and error states of lists and pages;
   - session expiry.
3. Walk each page with Tab and Shift+Tab. Focus order follows the visual order, focus
   is always visible, and dialogs trap and restore focus.

Pass: there is no state with text contrast under 4.5:1 (3:1 for large text and UI
borders), no invisible focus, no hover that hides text, and no state that looks the same
as default when it should differ.

Output: `08-states/states.json`, `08-states/report.md`, screenshots and
`08-state-findings.csv`

## P9 Content: Thai copy and production readiness

Steps:

1. Extract every visible string per page from the rendered DOM, including:
   - menus;
   - buttons;
   - labels;
   - placeholders;
   - errors;
   - empty states;
   - toasts;
   - emails and LINE/SMS templates when present.
2. Review the strings as a native Thai reader would:
   - natural word order;
   - one term per concept, checked against the glossary;
   - short verb buttons;
   - no half-translated screens;
   - consistent date and currency format;
   - no awkward line breaks at 375px.

   Write each finding as current text → proposed text → why.
3. Search both the rendered text and the API responses for these words:
   - demo, sample, test, mock, placeholder, lorem, TODO, FIXME, undefined, NaN,
     null, [object;
   - debug labels;
   - English error messages;
   - the Thai equivalents (ตัวอย่าง, ทดสอบ, สมมติ).

   For each hit, decide whether it is honest disclosure to keep (for example "estimate",
   or a legal "not binding" watermark) or a leak to remove. Fix leaks at their source:
   code, seed or API.

Pass: there are no leaks, and every copy finding is either fixed or listed for the
owner, for example terms the client chose.

Output: `09-copy.csv`, with page, current text, proposed text, reason and source file,
and `09-readiness.md`

## P10 Data and figures

Follow `data-and-figures.md`:

- the figure inventory;
- one home per figure;
- precision rules;
- cross-page agreement;
- API reconciliation;
- recalculation of totals.

Pass: no figure disagrees across pages or with the API, and precision is consistent per
kind of figure.

Output: `10-figures.csv` and `10-figures.md`

## P11 Heuristic and IA scoring

Steps:

1. Score each main page and flow against the ten usability heuristics:
   - visibility of status;
   - match with the real world;
   - user control;
   - consistency;
   - error prevention;
   - recognition over recall;
   - flexibility;
   - minimal design;
   - error recovery;
   - help.

   Use 0–10 per heuristic, with one line of evidence for each score.
2. Score the information architecture:
   - menu order by user priority;
   - grouping;
   - depth (three clicks or fewer to a main use case);
   - labels that match page titles;
   - information scent;
   - progressive disclosure;
   - mobile IA.
3. Give each issue a severity:
   - 4 = blocks a main use case;
   - 3 = major;
   - 2 = minor;
   - 1 = cosmetic.

   Link each issue to the flow step and page where it occurs.

Pass: every severity 3–4 issue has a fix or an owner decision.

Output: `11-heuristics.csv`, `11-ia.csv` and `11-scores.md`, which also includes the
as-is and to-be IA in Mermaid.

## P12 Fix loop

Steps:

1. Classify each finding:
   - **bug**: broken or wrong;
   - **UX defect**: clearly harms reading, finding or completing, by the product's own
     rules;
   - **owner decision**: menu order, terminology chosen by the client, pricing, legal
     text, role names, removing a feature.
2. Fix bugs and UX defects in shared tokens and components first, then in pages. Do not
   redesign.
3. Add a regression test for each fixed class, for example:
   - a list of every primary variant must keep its text colour on hover;
   - a seed must not contain sample wording;
   - a page must not show a figure with satang.
4. After each batch, re-run the phases the fix could affect: P3 for layout, P7 for the
   touched pages and their siblings, P8 for touched controls, and P10 for figures.
   Compare before and after.
5. Run the repository's own checks: lint, types, unit, e2e and the production build
   (use the same bundler as the deploy target).

Pass:

- every fixed finding has before and after evidence;
- the repository checks are green;
- the owner list has options and a recommendation for each item.

Output: `12-fixes.csv` (finding, fix, files, test, before, after) and
`12-owner-decisions.md`

## P13 Release and production re-check

Steps:

1. Sign off the reviewed commit with this command, writing in the notes what you looked
   at and what is still open:
   `python3 ../qa-testing/scripts/ui_signoff.py --repo . --report 07-pages/report.json --reviewer <who> --verdict pass|pass-with-notes --notes "..."`
2. Open the PR with before/after screenshots. Merge and deploy only with the owner's
   approval. The release gate blocks unsigned UI changes.
3. After deploy, run P3 (status and errors), P7 (capture every changed page and its
   siblings, and look at them) and P8 (states of changed controls) on the live URL.
   Production data and builds differ from local ones.
4. Compare the live captures with the approved after-captures. Any difference is either
   expected and noted, or a new defect.

Pass: the live re-check is clean, or every difference has a defect ID and a next step.

Output: `13-live/report.md`, slices and `13-release.md` (commit, deploy ID, URLs,
sign-off path, differences)
