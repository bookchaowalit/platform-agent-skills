# 20 — Observability

ไม่มี Sentry / PostHog / uptime / heartbeat โดยการตัดสินใจ (PRODUCT.md: "Sentry does not apply", ดู [ADR-0006](08-adr/ADR-0006-no-sentry-in-agent-scripts.md)).
สัญญาณที่มีจริงคือ output ของ scripts ใน session, GitHub commit status และผล CI

```mermaid
flowchart LR
    subgraph Session["Agent session on a machine"]
        G["ui_review_gate.py"] -->|"deny reason JSON"| CC["Claude Code transcript"]
        G -->|"stderr: ui_review_gate: skipped (error)"| CC
        SO["ui_signoff.py / ui_review_status.py"] -->|"stdout / stderr lines"| CC
        UR["ui_review.mjs / ui_states.mjs / flow_video.mjs"] -->|"report.json, report.md, states.json, manifest.json"| FS[("--out dir")]
        GOV["skill_governance.py --json"] -->|"status ok/error, warnings, errors"| CC
    end
    SO -->|"commit status ui-review"| GHS["GitHub PR / commit checks"]
    CI["GitHub Actions CI"] -->|"run conclusion, SARIF artifacts 14 days, step summary"| GHA["Actions UI"]
    GHA -.->|"GitHub notification settings, not in repo"| OWNER(["Owner"])
    GHS --> OWNER
```

Sources: PRODUCT.md, qa-testing/scripts/ui_review_gate.py (`deny`, `main` except branch), qa-testing/scripts/ui_signoff.py, qa-testing/scripts/ui_review_status.py,
qa-testing/scripts/ui_review.mjs, ux-review/scripts/ui_states.mjs, flow-video/scripts/flow_video.mjs, scripts/skill_governance.py,
.github/workflows/ci.yml, platform-ci-workflows@87dc5e1c security.yml (upload-artifact `retention-days: 14`, `GITHUB_STEP_SUMMARY`)

| What is watched | Signal | Who sees it |
|---|---|---|
| Package validity | CI `skills` job conclusion | GitHub Actions |
| Secrets / SAST / deps / IaC | CI `security` jobs + SARIF artifacts | GitHub Actions |
| UI release decisions | deny message in session; status `ui-review` บน commit | agent + PR viewers |
| Gate failure (fail-open) | บรรทัด stderr ใน session เท่านั้น | **gap**: ไม่มีที่รวมหรือแจ้งเตือน |
| Missed gates (PRODUCT.md Measures) | — | **gap**: `[ต้องยืนยัน]` |
| Dependency updates | renovate.json (schedule Monday before 9am, vulnerabilityAlerts) | ไม่พบ PR จาก Renovate ใน `gh pr list` → ไม่ยืนยันว่าทำงาน |

## Open questions

- Renovate app ติดตั้งบน repo นี้หรือไม่ (ไม่มี PR จาก Renovate ใน 9 PRs ที่มี)?
- ต้องการนับ gate deny / fail-open ต่อเครื่องหรือไม่ โดยไม่ส่ง prompt/paths ออกไป (ข้อจำกัดของ ADR-0006)?
