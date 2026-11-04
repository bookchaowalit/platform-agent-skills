# 06 — C4 Container

"Container" ที่นี่ = ส่วนของ plugin / repo ที่ถูกโหลดหรือรันแยกกัน (ไม่มี process ที่ host อยู่)

```mermaid
C4Container
    title Containers: plugin solo inside a Claude Code install
    Person(agent, "Agent session", "Claude Code with plugin solo")
    System_Boundary(plugin, "platform-agent-skills checkout at plugin root") {
        Container(manifest, ".claude-plugin", "JSON", "marketplace solo-empire, plugin solo, skills ./ and ./vendor/")
        Container(skills, "Skill packages", "Markdown + YAML", "24 folders with SKILL.md and agents/openai.yaml")
        Container(vendor, "vendor/impeccable", "Markdown + JS + launcher + exe", "Third-party design skill v0.1.5")
        Container(agents, "agents/", "Markdown", "9 sub-agent roles solo-*")
        Container(hooks, "hooks/hooks.json", "JSON", "PreToolUse Bash -> ui_review_gate.py, timeout 90 s")
        Container(mcpreg, ".mcp.json + mcp_auth_header.py", "JSON + Python", "HTTP MCP server solo-empire with headersHelper")
        Container(qa, "qa-testing/scripts", "Python + Node", "gate, evidence, signoff, status, ui_review, browsers, diff, a11y/perf, login")
        Container(ux, "ux-review/scripts/ui_states.mjs", "Node", "Interaction-state audit")
        Container(fv, "flow-video/scripts/flow_video.mjs", "Node", "Walkthrough videos")
        Container(gov, "scripts/", "Python", "check_skills.py, skill_governance.py")
    }
    ContainerDb(state, "UI review state dir", "JSON + PNG files", "UI_REVIEW_STATE_DIR or ~/.local/state/ui-review")
    System_Ext(gh, "GitHub API", "commit statuses, PR view")
    System_Ext(inf, "Infisical CLI", "secrets get /mcp")
    System_Ext(worker, "Remote MCP Worker", "workers.dev /mcp")

    Rel(agent, manifest, "Loads")
    Rel(agent, skills, "Reads")
    Rel(agent, agents, "Spawns")
    Rel(hooks, qa, "Runs ui_review_gate.py")
    Rel(qa, state, "Reads and writes evidence + baselines")
    Rel(qa, gh, "gh api")
    Rel(mcpreg, inf, "subprocess")
    Rel(agent, worker, "MCP over HTTPS")
    Rel(ux, qa, "Imports ui_browsers.mjs")
```

Sources: .claude-plugin/plugin.json, .claude-plugin/marketplace.json, hooks/hooks.json, .mcp.json, hooks/mcp_auth_header.py,
agents/*.md, qa-testing/scripts/*, ux-review/scripts/ui_states.mjs, flow-video/scripts/flow_video.mjs, scripts/*.py,
vendor/impeccable/scripts/VERSION, qa-testing/scripts/ui_review_evidence.py (`state_dir`)

CI (`.github/workflows/ci.yml`) และ tests/ ไม่ถูกโหลดโดย plugin แต่อยู่ใน checkout เดียวกัน (ดู 15)

## Open questions

- ไม่มี
