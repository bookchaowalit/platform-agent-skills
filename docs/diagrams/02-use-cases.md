# 02 — Use cases

ไม่มี auth level ในโค้ด (ไม่ใช่ service). actors = ผู้ใช้และ harness ที่ PRODUCT.md ระบุ + automation ที่เรียก script จริง

```mermaid
flowchart LR
    owner(["Owner"])
    contractor(["Outsourced contractor"])
    claude(["Claude Code CLI / Desktop with plugin solo"])
    codex(["Codex via hub .agents/skills"])
    copilot(["GitHub Copilot via hub .github/skills"])
    reviewer(["UI reviewer: person or agent"])
    ci(["GitHub Actions CI"])

    subgraph Repo["platform-agent-skills"]
        UC1["UC-01 Find and load a skill"]
        UC2["UC-02 Delegate to a solo:solo-role sub-agent"]
        UC3["UC-03 Call cell tools through the tool hub MCP"]
        UC4["UC-04 Capture and audit UI pages"]
        UC5["UC-05 Sign off a reviewed commit"]
        UC6["UC-06 Mark a commit with no UI changes"]
        UC7["UC-07 Ship UI: gated deploy, merge or push"]
        UC8["UC-08 Record a role tour or use-case video"]
        UC9["UC-09 Audit skill governance"]
        UC10["UC-10 Add or extend a skill package"]
        UC11["UC-11 Validate packages and scan on push or PR"]
    end

    claude --> UC1
    codex --> UC1
    copilot --> UC1
    contractor --> UC1
    claude --> UC2
    claude --> UC3
    reviewer --> UC4
    reviewer --> UC5
    reviewer --> UC6
    claude --> UC7
    owner --> UC8
    owner --> UC9
    owner --> UC10
    ci --> UC11
    UC7 -.->|"requires"| UC5
    UC10 -.->|"includes"| UC9
```

Sources: PRODUCT.md (Users), README.md, agents/*.md, .mcp.json, hooks/hooks.json, qa-testing/scripts/ui_review.mjs,
qa-testing/scripts/ui_signoff.py, qa-testing/scripts/ui_review_status.py, qa-testing/scripts/ui_review_gate.py,
flow-video/scripts/flow_video.mjs, scripts/skill_governance.py, Taskfile.yml, .github/workflows/ci.yml

| UC | Entry point (จริงในโค้ด) | หมายเหตุ |
|---|---|---|
| UC-01 | `<name>/SKILL.md` frontmatter `description` | 24 packages + `vendor/impeccable`; plugin.json `skills: ["./", "./vendor/"]` |
| UC-02 | `agents/solo-*.md` | 9 roles; writers = solo-implementer, solo-debugger (tests/plugin_agents_test.py) |
| UC-03 | `.mcp.json` → `hooks/mcp_auth_header.py` | tools อยู่ใน Worker อีก repo (platform-mcp-remote-worker) |
| UC-04 | `node qa-testing/scripts/ui_review.mjs`, `node ux-review/scripts/ui_states.mjs`, `ui_login.mjs` | ต้องมี Playwright |
| UC-05 | `python3 qa-testing/scripts/ui_signoff.py` | ปฏิเสธเมื่อมี blocker หรือไม่มีความกว้าง 375 + 1280/1440 |
| UC-06 | `python3 qa-testing/scripts/ui_review_status.py` | post `ui-review=success` เมื่อไม่มีไฟล์ UI เปลี่ยน |
| UC-07 | PreToolUse hook matcher `Bash` | ตรวจ `vercel --prod`/`--production`/`promote`, `gh pr merge`, `git push` ไป default branch |
| UC-08 | `node flow-video/scripts/flow_video.mjs --scenarios <file>` | read-only by default (GET/HEAD/OPTIONS) |
| UC-09 | `task audit` / `task check` | contract `solo-empire.skill-governance.v1` |
| UC-10 | `skill-template/`, `govern-ai-skills/SKILL.md` | |
| UC-11 | `.github/workflows/ci.yml` | jobs `skills`, `security` |

## Open questions

- contractor ใช้ skills ผ่าน harness ใด (PRODUCT.md ระบุว่า "follow the same skills" แต่ไม่ระบุช่องทางติดตั้ง)?
