# UI Quality Gate

Run this gate on every user-facing web or mobile change before claiming it is done,
and on any screen a client will see. It exists because passing tests did not catch
what a client noticed in minutes: text and spacing that were hard to read, menus in an
odd order, and unnatural Thai.

Check the **rendered** app, not the source, and cite the screenshot, selector, or
computed value for every finding.

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
2. **Widths:** 375 and 1440 always. Add 320, 768 and 1024 for any layout or CSS change.
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

   ```bash
   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
   node scripts/ui_review.mjs --url https://host/page --url https://host/other \
     --widths 320,375,768,1024,1440 --out ./tmp/ui-review --forbid unit,TODO --dismiss "Accept"
   ```
4. **Look:** open every slice and read every section against sections 1–4 below. The
   automated hints are not a verdict. Passing tests, "no overflow" or an agent's summary
   ("scanned", "checked") never count as a visual review.
5. **Fix, then capture again,** until no blocker is left and every major finding is either
   fixed or recorded for the owner.
6. **Sign off** on the exact commit you reviewed with `scripts/ui_signoff.py`
   (`--verdict pass|pass-with-notes|fail`, with notes that say what you looked at). The
   `ui_review_gate.py` hook blocks `vercel --prod` and `gh pr merge` for UI changes until
   that commit, or an ancestor with no UI changes after it, is signed off.
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

## Output

Report per check area:

- pass / fail, with the evidence (screenshot path, selector, computed value);
- each finding: screen, width, current, expected or proposed, severity
  (blocker = a client cannot read or find something; major; minor);
- what could not be checked and why (login, data, feature flag).

A UI change is not done while any blocker in this gate is open, or before the commit is signed off after an actual look at the screenshots. Business decisions
(menu priority, terminology chosen by the client) are flagged for the owner, not decided
by the agent.
