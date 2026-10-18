# UI Quality Gate

Run this gate on every user-facing web or mobile change before claiming it is done,
and on any screen a client will see. It exists because passing tests did not catch
what a client noticed in minutes: text and spacing that were hard to read, menus in an
odd order, and unnatural Thai.

Check the **rendered** app, not the source, and cite the screenshot, selector, or
computed value for every finding.

This gate is the release check. For a full audit of an app (product map, routes,
authorization, persona flows, interaction states, figures, scoring and the fix loop),
use the `ux-review` skill; its `references/page-checklist.md` is the detailed version of
sections 1–4 below.

## 0. Review procedure (do this every time)

These rules exist because each of these misses happened on a real client project after
tests had passed:

- crowded text and the same figure repeated five times;
- estimates shown to the satang;
- a label that broke mid-bracket at desktop width.

1. **Scope:** every page the change touches, plus every page that renders the same
   components (list, detail, compare, dashboard). If someone points at one box, review the
   whole page and its siblings for the same class of problem, not just the box in the
   screenshot.
2. **Widths, browsers and devices:** 375 and 1440 always. Add 320, 768 and 1024 for any
   layout or CSS change. Run Chromium always. Before a release, also run WebKit (Safari
   and every iOS browser) and Firefox, and emulate a real phone with `--device
   iphone,android`. Setting up the browsers, including on WSL without sudo, is covered in
   `browsers-and-tools.md`.
3. **Capture:** use `scripts/ui_review.mjs`. It takes full-page screenshots sliced into
   readable images and lists automated hints:
   - overflow;
   - text under 12px;
   - long text blocks;
   - repeated figures and mixed money precision;
   - forbidden words;
   - brackets split across lines;
   - a lone card on the last row of a grid;
   - small tap targets;
   - more than one primary button in a section.

   Apps that scroll inside an inner container (a full-height app shell with
   `overflow-y: auto`) leave the document one viewport tall, so a plain full-page
   screenshot shows only the first screen. Before the audit and capture, the script
   expands the largest such scroller and its ancestors to their full height, and
   `report.md` / `report.json` (`expandedScroller`) record the selector and heights. If a
   page reports "900px tall" with one slice, check that line. `--no-expand-scroller`
   captures the page exactly as rendered.

   ```bash
   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
   node scripts/ui_review.mjs --url https://host/page --url https://host/other \
     --widths 320,375,768,1024,1440 --out ./tmp/ui-review --forbid unit,TODO --dismiss "Accept" \
     --browser chromium,webkit,firefox --device iphone,android \
     --baseline . --perf mobile
   ```

   The same run adds three passes, each merged into `report.json` with its own
   severity. Section 5 covers them:
   - `--baseline <repo>` compares the capture with the last approved one;
   - axe-core checks accessibility on every capture when it is installed;
   - `--perf mobile` measures Core Web Vitals on a throttled phone.
4. **Look:** open every slice and read every section against sections 1–5 below. When a
   baseline exists, start with the "Visual changes" list at the top of `report.md`: each
   changed region has a diff image (changes in red, boxed). Every changed region must be
   intended. The automated hints are not a verdict. Passing tests, "no overflow" or an agent's summary
   ("scanned", "checked") never count as a visual review.
5. **Fix, then capture again,** until no blocker is left and every major finding is either
   fixed or recorded for the owner.
6. **Sign off** on the exact commit you reviewed with `scripts/ui_signoff.py`
   (`--verdict pass|pass-with-notes|fail`, with notes that say what you looked at). Add
   `--promote-baseline` so the reviewed slices become the approved baseline for the next
   capture. It is refused with `--verdict fail`. The
   `ui_review_gate.py` hook blocks `vercel --prod`, `gh pr merge` and `git push` to the default
   branch (a local merge, which also triggers Git auto-deploys) for UI changes until
   that commit, or an ancestor with no UI changes after it, is signed off.
   The sign-off also posts the GitHub commit status `ui-review`: `success`, or `failure`
   for a fail verdict. The status shows on the pull request, and the gate accepts it from
   any machine. A branch rule can require it, which needs a paid plan for private repos.
   For a pull request that touches no UI files, post the status with
   `scripts/ui_review_status.py --repo . --base origin/main` instead of reviewing.
7. **After deploy,** capture the live URL again and look at it. Production data and
   production builds differ from local ones.

## 1. Readability: font size, line height, spacing

Measure with computed styles (`getComputedStyle`) on the real page, not from Tailwind
classes or CSS files.

| Check | Pass |
| --- | --- |
| Body text size | ≥ 16px on mobile and desktop; form inputs ≥ 16px (avoids iOS zoom) |
| Secondary text (labels, captions, metadata) | ≥ 14px; nothing a user must read below 12px |
| Thai line height | ≥ 1.6 for body; ≥ 1.3 for headings (Thai vowels and tone marks clip below this) |
| Line length | 45–75 characters (Latin) / about 30–40 Thai words per line on desktop |
| Heading scale | Each level visibly larger or bolder than the next; no two roles within 2px |
| Spacing scale | Padding and margins come from one scale (e.g. 4/8/12/16/24/32); repeated components use identical values |
| Density | Tap targets ≥ 44×44px on mobile; ≥ 8px between adjacent targets; cards and sections have breathing room (≥ 16px inner padding on mobile) |
| Contrast | Text ≥ 4.5:1 (≥ 3:1 for ≥ 24px or bold ≥ 18.7px) |
| Thai font | A Thai-capable font is loaded (e.g. Noto Sans Thai, IBM Plex Sans Thai, Sarabun); no fallback to a Latin-only face; tone marks not clipped |
| Overflow | No horizontal scroll at 375px; no clipped or overlapping text at 200% zoom |

## 2. Navigation and menu order

Menus must follow how the user thinks, not the order features were built.

- List every navigation surface: top bar, side bar, mobile menu, tab bar, footer,
  account menu. Record the item order of each.
- The primary job of the product comes first (for an investment product: browse and
  invest before profile or settings). Order the rest by user frequency or funnel
  stage, then group related items; put account, settings, help, and legal last.
- The same item has the same label and relative position on every surface and at
  every width. Mobile may hide items but must not reorder them arbitrarily.
- Labels match the destination page title. No duplicate entries that lead to the same
  place, and no dead or "coming soon" items in the main menu without a clear marker.
- The active page is visibly marked.
- Write the proposed order next to the current order and state the reason for each move.
  When the product has a PRODUCT.md, use case list, or sitemap, follow it; when the
  order is a business choice, flag it for the owner instead of guessing.

## 3. Thai copy quality

Extract every visible string (headings, buttons, menus, form labels, placeholders,
errors, empty states, toasts, emails) from the rendered pages and review them as a
native Thai reader would.

- Natural Thai, not translated English word order (e.g. "ทำการ...", "ได้รับการ..." chains,
  "ซึ่ง" overuse, literal "คุณ" in every sentence).
- One term per concept across the product; keep a glossary (e.g. ลงทุน / หน่วยลงทุน /
  ผลตอบแทน) and flag every variant.
- Consistent register and politeness; buttons are short verbs ("ลงทุน", "ยืนยัน",
  "ดูรายละเอียด"), not sentences.
- English only for brand names, units, and established terms; no half-translated
  screens, untranslated keys (`invest.title`), or English error messages.
- Correct spelling and spacing: ไม้ยมก (ๆ) written one way throughout (Royal Institute
  style puts a space before and after it), no stray spaces inside words,
  Thai numerals or Arabic numerals used consistently, dates and currency in Thai format
  (e.g. 17 ต.ค. 2569 or 17 Oct 2026 consistently; ฿1,000 or 1,000 บาท consistently).
- Line breaks: Thai has no spaces between words, so check that wrapping does not split
  words awkwardly and that buttons do not wrap to two lines at 375px.

For each finding give the screen, the current text, the proposed text, and why.

## 4. Information density and financial data

For pages that show money, returns, prices or quotas:

| Check | Pass |
| --- | --- |
| One home per figure | Each figure appears once where it is explained. Other places link to it or summarise without restating it. |
| Precision | Estimates and projections in whole currency units (฿36,881, not ~฿36,881.28). Exact amounts (invoices, balances) keep satang. The same kind of figure uses the same precision everywhere on the page. |
| Label–value rows | Figures sit in labelled rows or tiles that line up. A figure is never buried in a sentence or floated mid-column. |
| Two similar rates | Two rates for the same thing (simple average vs IRR) each get a plain label and one line saying why they differ. Never two unlabeled percentages side by side. |
| Walls of text | No card or cell holds more than about 300 characters of running text. Split it into bullets or rows, or put the method and footnotes behind a details toggle. |
| Warnings | A material warning (no principal back, possible loss) is its own callout. It is not bold text in the middle of a paragraph. |
| One primary action | One primary button per section. Secondary jumps are links. Alternatives sit below a divider, smaller than the main action. |
| Spacing | Hint, total, consent and button each have their own space. Nothing touches the next line. |
| Grid balance | No single card alone on the last row of a multi-column grid. Long answers span the full row. |
| Wrapping | Brackets, units and amounts never split across lines (`white-space: nowrap` on the bracket or value). Pills that can wrap use a rounded rectangle, not a pill shape. |
| Language | No bare English words in Thai copy ("unit", "status") unless they are glossary terms. Data from the API counts too: fix it at the source. |

## 5. Visual baseline, accessibility and performance

### Visual baseline

- Baselines live outside the product repository, next to the sign-off evidence, in
  `$UI_REVIEW_STATE_DIR/<owner>__<repo>/baselines/<capture-key>/NN.png`, with a
  `manifest.json` that records the commit and the time of each promotion.
- A capture key is URL × browser × width or device. Each key is compared slice by slice
  against its baseline. The diff runs in the browser itself (YIQ colour distance per
  pixel, 16px cells, touching cells merged into rectangles), so it needs no image
  library.
- `report.md` lists only the changed captures, with each region in page coordinates and
  its diff image. `report.json` has `visual.status` (`new`, `same` or `changed`), the
  regions and the diff files for each page.
- A `visual-change` finding is minor. It is a pointer to look at, not a defect. A height
  change shifts everything below it, so start with the first region.

### Accessibility (axe-core)

Runs on every capture when axe-core is installed next to Playwright, with the WCAG 2.0,
2.1 and 2.2 A and AA rules. Turn it off with `--a11y off`. Each violated rule becomes a
finding named `a11y:<rule-id>`:

| axe impact | Finding severity | Typical rules |
| --- | --- | --- |
| critical | blocker | image-alt, label, button-name |
| serious | major | color-contrast, link-name |
| moderate, minor | minor | landmark and heading structure |

axe only finds what can be computed. Keyboard order, focus traps, screen-reader wording
and contrast on images still need a person (ux-review P8 and P8b).

### Performance (`--perf mobile`)

Each URL is loaded once more in Chromium as a mid-range Android phone. The connection
has 150 ms RTT, 1.6 Mbps down and 750 kbps up, and the CPU is 4× slower: Lighthouse's
mobile profile.

| Metric | Pass (good) | Poor | Severity over good / over poor |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | > 4 s | minor / major |
| CLS | ≤ 0.1 | > 0.25 | minor / major |
| TBT (lab stand-in for INP) | ≤ 200 ms | > 600 ms | minor / major |
| INP (one keyboard interaction, or a click on `--perf-click`) | ≤ 200 ms | > 500 ms | minor / major |
| JavaScript transferred | ≤ `--perf-budget` KB (default 300) | > 2× budget | minor / major |

- One lab run is noisy. Re-run a borderline value before acting on it.
- On a live site, field data (CrUX or RUM) has the last word.
- Measure production builds. A dev server is always slow and its numbers mean nothing.
- For a deeper look at one page, run Lighthouse itself:
  `npx lighthouse <url> --form-factor=mobile`.

## Output

Report per check area:

- pass / fail, with the evidence (screenshot path, selector, computed value);
- each finding: screen, width, current, expected or proposed, severity
  (blocker = a client cannot read or find something; major; minor);
- what could not be checked and why (login, data, feature flag, a browser that could
  not start).

A UI change is not done while any blocker in this gate is open, or before the commit is signed off after an actual look at the screenshots. Business decisions
(menu priority, terminology chosen by the client) are flagged for the owner, not decided
by the agent.
