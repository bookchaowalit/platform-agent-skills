# Scenario file format (`flows.json`)

One JSON file per app and environment. It holds no secrets: roles point at saved
session files outside the repository. Keep it next to the system's docs (for example
`docs/flows/flows.json`, or the client folder for client work). Do not keep it inside
the skill.

```json
{
  "app": "MoldFlow (TMA)",
  "baseUrl": "https://staging.example.com",
  "viewport": { "width": 1440, "height": 900 },
  "readOnly": true,
  "locale": "th-TH",
  "timezone": "Asia/Bangkok",
  "loginPath": "^/login",
  "allowPost": ["/api/search$"],
  "roles": {
    "planner": { "label": "ผู้วางแผน", "storageState": "~/.local/state/ui-review/sessions/app-planner.json", "color": "#059669" }
  },
  "scenarios": [
    { "id": "TOUR-planner", "role": "planner", "title": "พาชมทุกหน้าที่ผู้วางแผนเห็น", "tour": { "start": "/dashboard" } },
    {
      "id": "UC-01", "role": "planner", "title": "วางแผนกระบวนการของงานใหม่",
      "goal": "ผู้วางแผนจัดลำดับขั้นตอนผลิตของ Job Order", "outcome": "แผนพร้อมส่งอนุมัติ",
      "refs": ["FR-04", "UC-01"],
      "steps": [
        { "say": "เปิดแผนกระบวนการของงานที่เลือก", "goto": "/mold-production/plan" },
        { "say": "ดูแผนภาพ PERT", "click": "main button[role=tab]:has-text(\"แผนภาพ PERT\")" },
        { "say": "ปุ่มนี้ส่งแผนให้ผู้อนุมัติ (ไม่กดในวิดีโอนี้)", "expect": "main button:has-text(\"ยืนยันแผน\")" }
      ]
    }
  ]
}
```

## Top level

| Key | Default | Meaning |
| --- | --- | --- |
| `app` | host | Name on title cards and the gallery. |
| `baseUrl` | required | Relative paths resolve against it. Tours stay on its origin. |
| `viewport` | 1440×900 | Video size. A scenario may set its own (`390×844` for a phone flow). |
| `readOnly` | `true` | `false` lets a scenario with `writes: true` run when `--allow-writes` is passed. |
| `loginPath` | `^/(login\|signin\|sign-in\|auth/login)` | A regex. Landing here with a saved session stops the scenario as expired. |
| `allowPost` | `[]` | Regexes for POST URLs that only read (search, GraphQL queries). They are let through in read-only mode. |
| `roles` | `{}` | `label` shows on the chip, `storageState` comes from `ui_login.mjs`, `color` is optional. |

## Scenario

| Key | Meaning |
| --- | --- |
| `id` | Unique. Match the docs: `TOUR-<role>`, `UC-xx`. Also the file name. |
| `role` | Key in `roles`. Leave it out for a public (signed-out) flow. |
| `title`, `goal`, `outcome` | Title card, gallery text and end card. Write them in Thai for Thai users. |
| `refs` | Requirement or use case IDs, shown in the gallery. |
| `tour` | `true` or `{start, nav, include, exclude, max, denied, scroll}`. See below. |
| `steps` | Array of steps. Use either `tour` or `steps`. |
| `writes` | `true` when the flow must create or change data. See the decision rules in SKILL.md. |
| `slow` | Pace multiplier for this scenario only. |

### Tour options

- `start`: the first page after sign-in (default `/`).
- `nav`: CSS selector for menu links (default `nav a[href], aside a[href],
  [role=navigation] a[href], header a[href]`). Narrow it when a header has marketing
  links.
- `include`: extra paths not in the menu: `["/share/customer-view/demo"]` or
  `[{ "path": "...", "label": "..." }]`.
- `exclude`: regexes of paths to skip, for example `"^/admin/danger"`. Sign-out links
  are always skipped.
- `max`: page limit (default 30).
- `denied`: regex of on-page text meaning "no access". The default covers common Thai
  and English messages.
- `scroll: false`: do not scroll each page.

## Step actions (one per step; `say` is optional but expected)

| Action | Example | What the viewer sees |
| --- | --- | --- |
| `goto` | `"/reports"` | The page loads under the caption. HTTP status is recorded. |
| `click` | `"main a:has-text(\"Step 2\")"` | The cursor glides to the target, it is framed, a ripple shows, then the click. |
| `fill` + `value` | `"input[name=customer]"` | The value is typed character by character. |
| `select` + `value` | `"select#line"` | The option is selected. |
| `press` | `"Enter"` | A keyboard press. |
| `hover` | `"[data-tip]"` | The cursor rests and the tooltip opens. |
| `scroll` | `"bottom"`, `"top"`, `"600"`, or a selector | A smooth scroll of the main scroller. With a selector, the target is scrolled to and framed. |
| `expect` | `"text=บันทึกแล้ว"` | Waits for it, then frames it. Use it to point at a result or a button not pressed. |
| `pause` | `1500` | Hold, in ms. |

Selectors are Playwright selectors. The first match is used. Prefer, in this order:
`role=button[name="บันทึก"]`, `main a:has-text("…")`, `[data-testid=…]`, `href`, CSS.
Scope to `main` so the sidebar does not match first. Never select by generated
class names.

## Pacing and captions

- Reading time per step is about 55 ms per character, between 1.6 and 5 s, times `--slow`.
- One idea per caption, at most about 60 Thai characters. Say the user's intent:
  "กรองเฉพาะงานที่ล่าช้า", not "คลิกปุ่มสีแดง".
- Five to twelve steps per use case. Split anything longer into two use cases.

## Output (`--out <dir>`)

```text
index.html          gallery by role, click a step to seek
manifest.json       per scenario: steps with time offsets, status, blocked writes, pages (tour)
page-map.md         role × page matrix and per-role page lists (tours only)
<id>.webm|.mp4      the video
<id>.vtt            captions, one cue per step
<id>/NN.png         frame after each step (the storyboard to review)
<id>/failed.png     only when the scenario failed
scenarios.json      copy of the input, for the record
```

MP4 needs an ffmpeg with libx264 on `PATH` or in `FLOW_VIDEO_FFMPEG`. The ffmpeg that
ships with Playwright only does VP8/VP9, so it is not enough. Without one, WebM plays
in every current browser, and the gallery uses it.

Thai text in captions uses the page font, then Sarabun / Noto Sans Thai. On a machine
with no Thai font, install Sarabun under `~/.local/share/fonts`, or pass
`--font /path/Sarabun-Regular.ttf`.
