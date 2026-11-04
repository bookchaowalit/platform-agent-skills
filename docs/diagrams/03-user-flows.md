# 03 — User flows

ไม่มี routes/pages: flow ด้านล่างคือ journey ของ actor แต่ละกลุ่มผ่าน command และไฟล์จริง

## F1 — Install the skill hub and use a skill (Claude Code)

```mermaid
flowchart TD
    A["Owner adds marketplace solo-empire: settings.json extraKnownMarketplaces or /plugin install"] --> B["Claude Code fetches github bookchaowalit/platform-agent-skills"]
    B --> C["Plugin solo: skills ./ and ./vendor/, agents/, hooks/hooks.json, .mcp.json"]
    C --> D["Skills appear as /solo:name"]
    C --> E["Sub-agents appear as solo:solo-role"]
    C --> F["PreToolUse Bash hook: ui_review_gate.py"]
    C --> G["MCP server solo-empire: headersHelper mcp_auth_header.py"]
    D --> H["Agent reads SKILL.md, loads references only when needed"]
```

Sources: README.md (Install as a Claude Code plugin), .claude-plugin/plugin.json, .claude-plugin/marketplace.json, hooks/hooks.json, .mcp.json

## F2 — Ship a UI change (reviewer + agent in a product repo)

```mermaid
flowchart TD
    A["Optional: ui_login.mjs saves session state, mode 0600, outside repo"] --> B["ui_review.mjs --url each page --widths ... --out dir"]
    B --> C["report.json + report.md + sliced screenshots"]
    C --> D["Reviewer looks at every slice, fixes findings"]
    D --> E{"blockers left?"}
    E -->|yes, no reason| D
    E -->|"none, or --accept-blockers reason"| F["ui_signoff.py --verdict pass"]
    F --> G["Evidence JSON in state dir + GitHub status ui-review=success"]
    G --> H["git push / gh pr merge / vercel --prod"]
    H --> I{"ui_review_gate.py"}
    I -->|"covering sign-off or status success"| J["Allowed"]
    I -->|"unsigned UI files"| K["Denied with HOW_TO"]
```

Sources: qa-testing/scripts/ui_login.mjs, qa-testing/scripts/ui_review.mjs, qa-testing/scripts/ui_signoff.py,
qa-testing/scripts/ui_review_evidence.py, qa-testing/scripts/ui_review_gate.py

PR ที่ไม่แตะไฟล์ UI: `ui_review_status.py --base origin/main` post `success` "no UI changes" (ใช้เมื่อ branch rule บังคับ status)

## F3 — Change a skill (owner / maintainer)

```mermaid
flowchart TD
    A["task audit JSON"] --> B{"overlap with an existing skill?"}
    B -->|yes| C["Extend it"]
    B -->|no| D["New folder from skill-template"]
    C --> E["Update README inventory entry: '- name — description'"]
    D --> E
    E --> F["task check"]
    F --> G["Commit / local merge to main, push"]
    G --> H["CI on push to main"]
    G --> I["Next plugin update on each machine picks up main"]
```

Sources: README.md, Taskfile.yml, scripts/skill_governance.py (README_ENTRY_PATTERN), skill-template/SKILL.md, .github/workflows/ci.yml

## F4 — Record walkthrough videos

```mermaid
flowchart LR
    A["Scenario JSON: tour or steps"] --> B["flow_video.mjs --scenarios file"]
    B --> C{"scenario writes AND --allow-writes AND readOnly not true?"}
    C -->|no| D["Non GET/HEAD/OPTIONS aborted and listed, except POST matching allowPost and WebSockets matching allowWebSocket"]
    C -->|yes| E["Writes allowed"]
    D --> F["webm, vtt, frames, manifest.json, page-map.md, index.html gallery"]
    E --> F
```

Sources: flow-video/scripts/flow_video.mjs (SAFE_METHODS, line 472 writes rule), flow-video/references/scenario-format.md, flow-video/SKILL.md

## Open questions

- ไม่มีขั้นตอนบันทึกการติดตั้ง plugin บนเครื่องใหม่ในรูป checklist นอกจาก README; ต้องการหรือไม่?
