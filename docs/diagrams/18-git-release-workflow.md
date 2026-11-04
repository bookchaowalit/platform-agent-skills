# 18 — Git & release workflow

repo สร้างบน GitHub 2026-10-11 (`gh repo view` createdAt) จากประวัติของ hub (commits ก่อนหน้านั้นเป็น history ที่ย้ายมา).
`main` เป็น default branch, **ไม่มี branch protection** (API 404) และ rulesets ว่าง. ไม่มี git tag/release

รูปแบบที่เห็นใน `git log --first-parent origin/main`:
1. 2026-10-17 → 2026-10-18: feature branch + GitHub PR (#1–#8, merge commit "Merge pull request #N")
2. 2026-10-18 → 2026-10-21: feature branch + **local merge** แล้ว push ("Merge branch 'feat/…'") — PR #9 ถูกปิดโดยไม่ merge แต่ branch ถูก merge local ใน `5362793`
3. 2026-10-21 → 2026-10-23: commit ตรงบน `main`

```mermaid
gitGraph
    commit id: "3c456c1 ci adopt shared CI (#1)"
    branch feat/ui-visual-review-gate
    commit id: "gate + signoff"
    checkout main
    merge feat/ui-visual-review-gate id: "9db3166 PR #2"
    branch feat/plugin-marketplace
    commit id: "marketplace"
    checkout main
    merge feat/plugin-marketplace id: "94a1620 PR #7"
    branch feat/flow-video
    commit id: "flow-video"
    checkout main
    merge feat/flow-video id: "81d4d47 local merge"
    commit id: "5c7d68b agents, CI fail"
    commit id: "b9c4919 fix EXE001"
    commit id: "baae94a docs D2 D3 D4"
```

```mermaid
flowchart LR
    A["Branch or direct commit"] --> B{"PR?"}
    B -->|"PR #1-#8"| C["CI on pull_request"]
    B -->|"local merge / direct"| D["git push main"]
    C --> E["Merge on GitHub"]
    E --> F["CI on push main"]
    D --> F
    D -.->|"PreToolUse gate: no UI files in this repo, allows"| F
    F --> G["main = release: plugin solo updates pick it up"]
```

Sources: git log origin/main --first-parent, `gh pr list --state all` (2026-11-04), `gh api repos/bookchaowalit/platform-agent-skills/branches/main/protection` (404),
`gh api .../rulesets` (`[]`), `gh repo view --json createdAt`, .claude-plugin/plugin.json, qa-testing/scripts/ui_review_evidence.py (`repo_has_ui`)

นโยบายที่ skill ของ repo นี้เองกำหนด: `main-only-development/SKILL.md` (สำหรับ root repo ของ hub) และ `ops record: merge-locally (2026-11-03)`
(merge ใน local clone แล้ว push) ซึ่งตรงกับรูปแบบ 2–3

## Open questions

- ควรกลับไปใช้ PR + required check สำหรับ repo ที่ทุกเครื่องรันโค้ด hook หรือไม่?
