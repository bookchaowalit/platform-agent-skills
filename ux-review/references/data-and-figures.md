# Data and figures (P10)

Users decide with numbers. A figure that repeats, changes precision, or disagrees with
another page costs more trust than any layout problem.

## 1. Figure inventory

For each page in scope, list every visible figure:

| Column | Example |
| --- | --- |
| page, width | /invest/123, 375 |
| section | return summary |
| label shown | กำไรสุทธิ (กรณีฐาน) |
| value shown | +฿16,881 |
| kind | estimate / exact amount / rate / count / date / quota |
| unit and period | ฿, per minimum ticket, over 8 years |
| source | API field `projected_net_gain_per_min_satang`, or computed in `file.ts:42` |
| times shown on page | 1 |

Use the rendered DOM. Skip text hidden from sight, such as screen-reader-only chart
tables, but do check that it agrees with what is shown.

## 2. Rules

- **One home per figure:** a figure appears once, where it is explained. A second
  appearance must add meaning, for example as a row in a breakdown. Three or more
  appearances on one page is a defect.
- **Precision by kind:**
  - Estimates, projections and averages are in whole currency units (฿36,881).
  - Exact amounts keep decimals: invoices, balances, payments, refunds, fees charged.
  - The same kind of figure uses the same precision everywhere on the page, including
    in charts, tables, tooltips, assumptions text from the API, and exports.
- **Rounding:** half up, applied only at display time. Never round inside a
  calculation to make a display match.
- **Units and period:** every figure shows its unit and period. Percentages say what
  they are a percentage of.
- **Format:** thousands separators. A sign comes before the currency symbol
  (`−฿1,234`, not `฿−1,234`).
- **Similar rates:** when two rates describe the same thing (simple average and IRR,
  gross and net), give each one a plain label, show them side by side, and add one
  line saying why they differ. Never show two unlabelled percentages.
- **Approximation:** "ประมาณ" or "≈" goes with a rounded number. Do not put "~" in
  front of a figure that still shows satang.
- **Estimates vs actuals:** label estimates as estimates, and keep actual results
  visually separate from projections.

## 3. Cross-page agreement

1. Pick the figures a user carries from page to page, for example:
   - price and minimum ticket;
   - units left;
   - expected return;
   - balance;
   - quota.
2. Record each figure on every page that shows it: list cards, detail, compare,
   checkout or summary, dashboard, emails, PDFs and exports.
3. The values match. Any difference is a defect. Trace it to its cause before fixing:
   - a stale cache;
   - two formulas;
   - a different base (per unit vs per minimum ticket);
   - rounding inside a calculation.

## 4. API reconciliation

1. For each figure, fetch the API response the page used, read-only. Confirm that the
   value shown equals the API value after display formatting.
2. Recalculate derived figures from their inputs:
   - totals equal the sum of their rows;
   - per-unit figures equal the pool divided by units;
   - waterfalls end at the stated share;
   - percentages match their numerators and denominators.

   Tolerance is half a display unit.
3. Text from the API (assumptions, notes, rights, disclosures) follows the same
   precision and language rules. Fix it in the API or seed, not in the UI.

## 5. Sample and test data

- No visible figure or name may come from sample, demo or test data unless the page
  labels it honestly and the owner has decided to show it.
- Seeded names must not collide with real entities (stations, shops, people). Seeded
  map pins must not sit on real locations.
- A seed re-run must update display fields on existing rows, so wording fixes reach
  production.

## Output

- `10-figures.csv`: the inventory, plus `issue` and `defect_id` columns.
- `10-figures.md`: the pages checked, mismatches with their causes, the precision
  decisions, and the API or seed fixes needed.
