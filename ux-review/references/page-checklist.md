# Page checklist (P7)

Work top to bottom, one section at a time, at phone width first and then desktop.
Measure on the rendered page with `getComputedStyle` or a screenshot, never from class
names. Each row is pass or fail with evidence.

Severity:

- **B** (blocker): cannot read, find or complete something.
- **M** (major): slows or misleads.
- **m** (minor): polish.

## 1. Layout and responsiveness

| Check | Pass | Sev |
| --- | --- | --- |
| Page width | No horizontal page scroll at any width in scope (320–1440) | B |
| Inner scroll | Only intentional areas scroll sideways (wide tables, timelines), and each shows a cue: a fade, a hint, or a visible scrollbar on touch devices | M |
| Clipping | No text or control is cut off, overlapped or hidden behind fixed headers, floating buttons or the cookie banner | B |
| Grid balance | No single card alone on the last row of a multi-column grid; long items span the full row | m |
| Alignment | Columns, tiles and labels line up; values in a row share a baseline | m |
| Tablet | At 768–1024, tables become cards or scroll with a cue; headers and breadcrumbs wrap rather than truncate | M |
| Page length | On a phone, the main action is reachable without scrolling past long reference content; long reference content sits after the action or behind a toggle | M |

## 2. Hierarchy and grouping

| Check | Pass | Sev |
| --- | --- | --- |
| First screen | The page's purpose, the key figure and the main action are visible on the first phone screen | M |
| One primary action | One primary button per section; secondary jumps are links; alternatives sit below a divider and are visibly smaller | M |
| Heading scale | Each heading level is visibly distinct (≥ 2px or a weight step); there are no two headings for the same thing | m |
| Grouping | Related facts share a container; unrelated categories are not packed into one oversized card; a divider or space separates groups | M |
| Order | Sections follow the user's decision order: what it is → what I get → what it costs → risks → act | M |

## 3. Density and text

| Check | Pass | Sev |
| --- | --- | --- |
| Walls of text | At most ~300 characters of running text in a card or cell; longer content becomes bullets or rows, or sits behind a details toggle | M |
| Label–value | Facts are label–value rows or tiles, not sentences that hide the value | M |
| Repetition | A sentence or note is shown once per page (for example "estimate, not guaranteed" once near the figures, not under every figure) | M |
| Warnings | Material warnings (loss, no refund, legal) are their own callout, not bold text mid-paragraph | M |
| Spacing | Hint, total, consent and button have their own space (≥ 8px between lines, ≥ 16px between groups); nothing touches | M |
| Line length | Desktop body text ≤ ~75 characters, or ~40 Thai words, per line | m |

## 4. Typography and readability

| Check | Pass | Sev |
| --- | --- | --- |
| Size | Body ≥ 16px; secondary ≥ 14px; nothing a user must read < 12px; inputs ≥ 16px (no iOS zoom) | M |
| Thai line height | Body ≥ 1.6; headings ≥ 1.3; tone marks are not clipped | M |
| Thai font | The font has Thai glyphs; monospace or code fonts fall back to a Thai-capable face | B |
| Contrast | Text ≥ 4.5:1 (≥ 3:1 for ≥ 24px or bold ≥ 18.7px) in every state (see `interaction-states.md`) | B |
| Wrapping | Brackets, units, amounts and short labels never split across lines; pills that may wrap become rounded rectangles; buttons do not wrap at 375px | m |

## 5. Copy

| Check | Pass | Sev |
| --- | --- | --- |
| Language | Thai copy has no bare English words unless they are glossary terms; no untranslated keys, English errors or debug text | M |
| Terms | One term per concept across pages; it matches the glossary | M |
| Buttons | Short verbs that say what happens next | m |
| Leaks | No demo, sample, test, placeholder, lorem, undefined, NaN or null text, including text from the API or seed data | B |
| Honesty | Estimates are labelled as estimates; nothing implies a guarantee the product does not give | B |

## 6. Numbers (details in `data-and-figures.md`)

| Check | Pass | Sev |
| --- | --- | --- |
| One home | Each figure appears once where it is explained; elsewhere link to it or summarise without restating it | M |
| Precision | One precision per kind of figure on a page: estimates in whole units, exact amounts with decimals | M |
| Similar rates | Two rates for one thing each have a plain label and one line saying why they differ | M |
| Units | Every figure has its unit and period (฿/เดือน, %/ปี); thousands separators everywhere | M |
| Agreement | The same figure matches across cards, tables, charts and the API | B |

## 7. Navigation and orientation

| Check | Pass | Sev |
| --- | --- | --- |
| Where am I | Active menu item, breadcrumb or step indicator on every inner page | M |
| Way back | Every page has a way back or forward; no dead ends after errors, empty results or closed states | B |
| Menu order | Matches user priority and is the same across surfaces; differences go to the owner list | M |
| Labels | Menu labels match page titles; no duplicate entries; no dead "coming soon" items without a marker | m |
| Journeys | Multi-step flows show step x of n, the current state and the next action, taken from real status | M |

## 8. Accessibility basics

| Check | Pass | Sev |
| --- | --- | --- |
| Tap targets | ≥ 44×44px on touch widths; ≥ 8px apart | M |
| Names | Every control's accessible name matches its visible text; icons-only controls have labels | M |
| Images | Informative images have alt text; decorative ones are hidden | m |
| Charts | Charts have a text or table equivalent | m |

Record each finding as: page, width, section, check, current, expected, severity,
evidence (slice and selector), and source file once found.
