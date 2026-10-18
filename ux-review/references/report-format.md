# Report format

## Evidence folder

Store the evidence where the owner reviews it: a reviews repository or the product's
`docs/ux/`. Keep it out of runtime code.

Name the folder `<app>/ux-review-<YYYY-MM-DD>/` and lay it out like this:

```text
README.md                 scope, commit, environments, roles, widths, phases run or skipped
summary.md                one page: verdict, top findings, fixes, owner decisions, not verified
01-product-map.md
02-personas/
03-sitemap.csv  03-route-results.csv  03-link-results.csv
04-authorization.csv  04-authorization.md
05-flows/  05-traceability.csv  05-actual-vs-ideal.md
06-flow-tests/
07-pages/   (ui_review.mjs output) 07-page-findings.csv
08-states/  (ui_states.mjs output) 08-state-findings.csv
09-copy.csv  09-readiness.md
10-figures.csv  10-figures.md
11-heuristics.csv  11-ia.csv  11-scores.md
12-fixes.csv  12-owner-decisions.md
13-live/  13-release.md
```

Never put credentials, session or storage-state files, browser traces that contain
cookies, or personal data in the evidence folder. Keep those files on the local machine
only.

## Finding IDs and severity

Give each finding the ID `<phase>-<nnn>`, for example `P7-014`, and use the same ID in
the CSV, the fix commit and the summary.

| Severity | Meaning | Release |
| --- | --- | --- |
| blocker | cannot read, find, trust or complete a main use case; data wrong; leak | must fix |
| major | slows, misleads or looks broken; inconsistent with the product's own rules | fix, or the owner accepts it in writing |
| minor | polish | fix when touching the area |

## Finding CSV columns

`id, phase, page, width, section, element, state, check, current, expected, severity, evidence, source_file, status, fix_commit, owner_decision`

`status` takes one of these values:

- `open`
- `fixed`
- `owner-decision`
- `wont-fix` (with a reason)
- `not-reproducible`

## summary.md

1. **Verdict:** ready / ready with notes / not ready, with the reason in one line.
2. **Scope:** apps, commit, pages × widths, roles, phases run or skipped.
3. **Numbers:** findings by severity and phase, fixed vs open, flows passed vs failed vs
   blocked, and before/after scores (heuristics, IA).
4. **Top findings:** up to 10, each with a screenshot and its status.
5. **Fixes:** a PR link for each, plus the tests added.
6. **Owner decisions:** for each, the options, a recommendation and the impact of
   waiting.
7. **Not verified:** what could not be checked and what would unblock it (an account,
   data, a device, a third party).

Write the report in the owner's language (Thai by default). Keep code, paths and IDs as
they are.
