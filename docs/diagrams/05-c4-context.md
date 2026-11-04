# 05 — C4 Context

```mermaid
C4Context
    title System Context: platform-agent-skills (skill hub, plugin solo)
    Person(owner, "Owner", "Writes and governs skills, signs off UI")
    Person(contractor, "Outsourced contractor", "Follows the same skills")
    System(skills, "platform-agent-skills", "Skill packages, sub-agents, UI review gate, tool hub registration")
    System_Ext(claude, "Claude Code CLI / Desktop", "Installs plugin solo, runs hooks and helpers on the machine")
    System_Ext(hub, "solo-empire hub", "harness_skills.py links skills for Codex and Copilot")
    System_Ext(github, "GitHub", "Hosts the public repo, Actions CI, commit status API")
    System_Ext(infisical, "Infisical", "Holds the tool hub bearer in folder /mcp")
    System_Ext(mcp, "Remote MCP Worker", "solo-empire-mcp-remote on workers.dev")
    System_Ext(apps, "Product web apps", "Pages captured by the UI review and flow-video scripts")
    System_Ext(vendor, "pbakaus/impeccable releases", "Engine binary download for vendor/impeccable")

    Rel(owner, skills, "Edits, task check, pushes main")
    Rel(contractor, skills, "Reads skills")
    Rel(claude, github, "Fetches plugin from main")
    Rel(claude, skills, "Loads skills, agents, hooks")
    Rel(hub, skills, "Symlinks a checkout")
    Rel(skills, infisical, "infisical secrets get via CLI")
    Rel(claude, mcp, "HTTP MCP with bearer header")
    Rel(skills, github, "gh api statuses, gh pr view")
    Rel(skills, apps, "Playwright capture")
    Rel(skills, vendor, "Launcher downloads engine if missing")
```

Sources: PRODUCT.md, README.md, .claude-plugin/marketplace.json, .mcp.json, hooks/mcp_auth_header.py,
qa-testing/scripts/ui_review_evidence.py, qa-testing/scripts/ui_review_gate.py, qa-testing/scripts/ui_review.mjs,
vendor/impeccable/scripts/impeccable, .github/workflows/ci.yml,
central [ADR-0003 hosted shared services](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0003-hosted-shared-services.md),
ops record: hosted-shared-services (2026-11-03)

หมายเหตุ: Codex / Copilot อ่าน skills ผ่าน symlink ที่ hub สร้าง (`infra/scripts/agent/harness_skills.py --write`, อยู่ใน hub ไม่ใช่ repo นี้).
central ADR-0003 ข้อ 1 ยังเขียนว่า Codex review Stop hook ship ใน plugin แต่โค้ดปัจจุบันไม่มีแล้ว (ebb1298; ops record: ai-stack (2026-11-03))

## Open questions

- central ADR-0003 ควรได้ addendum ว่า Codex Stop gate ออกจาก plugin แล้วหรือไม่?
