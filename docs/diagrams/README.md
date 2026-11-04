# Core 22 SDLC diagram pack — platform-agent-skills

ชุดภาพ 22 รายการตาม SDLC Diagram Catalog v2 (knowledge-base `knowledge/tech/core-cs/sdlc-diagram-catalog.md`)
วาดจากโค้ดและ config ของ repo นี้ ณ `origin/main` `baae94a` (2026-10-23). repo นี้เป็น **skills/content repo**: skill packages (Markdown),
Claude Code plugin marketplace `solo-empire` / plugin `solo`, sub-agents 9 ตัว, UI review gate (PreToolUse hook), การลงทะเบียน tool hub MCP
และ validator/QA scripts ขนาดเล็ก. ไม่มี hosted runtime และไม่มี database: actors = owner, contractors และ agent harnesses;
"deployment" = plugin track `main`. ทุก diagram มี `Sources:`; สิ่งที่ไม่รู้อยู่ใน "Open questions" ของไฟล์นั้น;
ops records อ้างเป็น `ops record: <file-stem> (2026-11-03)`

| # | Item | Status | File | Sources read |
|---|---|---|---|---|
| 01 | Business process (As-Is / To-Be) | done (To-Be = open question: no specs/UPGRADE-PLAN) | [01-business-process.md](01-business-process.md) | README.md, PRODUCT.md, Taskfile.yml, scripts/, qa-testing/scripts/, ci.yml, git log |
| 02 | Use cases | done | [02-use-cases.md](02-use-cases.md) | PRODUCT.md, README.md, agents/, .mcp.json, hooks/, qa-testing/scripts/, flow-video/scripts/ |
| 03 | User flows | done (command/file journeys, no routes) | [03-user-flows.md](03-user-flows.md) | README.md, .claude-plugin/, qa-testing/scripts/, flow-video/scripts/, skill-template/ |
| 04 | Traceability (RTM) | done | [04-traceability.md](04-traceability.md) | PRODUCT.md, README.md, Taskfile.yml, ci.yml, scripts/, tests/ |
| 05 | C4 Context | done | [05-c4-context.md](05-c4-context.md) | PRODUCT.md, README.md, .mcp.json, central ADR-0003, ops records |
| 06 | C4 Container | done | [06-c4-container.md](06-c4-container.md) | .claude-plugin/, hooks/, .mcp.json, agents/, */scripts/, vendor/impeccable/ |
| 07 | C4 Component | done | [07-c4-component.md](07-c4-component.md) | qa-testing/scripts/*, scripts/*.py |
| 08 | ADRs (retro-documented) | done | [08-adr/](08-adr/) — [0001](08-adr/ADR-0001-provider-neutral-skill-packages.md), [0002](08-adr/ADR-0002-plugin-marketplace-tracks-main.md), [0003](08-adr/ADR-0003-ui-review-gate-pretooluse-hook.md), [0004](08-adr/ADR-0004-mcp-bearer-from-infisical-headershelper.md), [0005](08-adr/ADR-0005-shared-reusable-ci-pinned-sha.md), [0006](08-adr/ADR-0006-no-sentry-in-agent-scripts.md) | code, PRODUCT.md, README.md, git log, central ADR-0003 |
| 09 | ERD | done (file-based data: package metadata, evidence, baselines, reports; no DB) | [09-erd.md](09-erd.md) | skill_governance.py, ui_review_evidence.py, ui_signoff.py, ui_review.mjs |
| 10 | Sequences | done | [10-sequences.md](10-sequences.md) | ui_review_gate.py, ui_signoff.py, mcp_auth_header.py, ci.yml + reusable workflows |
| 11 | State machines | done (commit review state, gate decision, flow-video result) | [11-state-machines.md](11-state-machines.md) | ui_review_evidence.py, ui_review_gate.py, flow_video.mjs |
| 12 | API & integrations | done (no served endpoints; plugin/hook/MCP contracts + outbound calls) | [12-api-integration.md](12-api-integration.md) | hooks/, .mcp.json, qa-testing/scripts/, flow_video.mjs, vendor launcher |
| 13 | Threat model | done | [13-threat-model.md](13-threat-model.md) | plugin manifests, hooks/, scripts, vendor launcher, ci.yml, GitHub branch protection API |
| 14 | Backup & DR | done (Git copies only; RTO/RPO not defined) | [14-backup-dr.md](14-backup-dr.md) | README.md, ui_review_evidence.py, ui_login.mjs, security.yml |
| 15 | CI/CD pipeline | done | [15-cicd-pipeline.md](15-cicd-pipeline.md) | ci.yml, platform-ci-workflows@87dc5e1c, Taskfile.yml, gh run list |
| 16 | Deployment (distribution) | done | [16-deployment.md](16-deployment.md) | README.md, PRODUCT.md, .claude-plugin/, .mcp.json, ops record |
| 17 | Test coverage matrix | done | [17-test-coverage-matrix.md](17-test-coverage-matrix.md) | tests/, Taskfile.yml, ci.yml, local test run |
| 18 | Git & release workflow | done | [18-git-release-workflow.md](18-git-release-workflow.md) | git log, gh pr list, branch protection + rulesets API |
| 19 | Service dependency map | done | [19-service-dependency-map.md](19-service-dependency-map.md) | hooks/, scripts imports, pyproject.toml, ci.yml |
| 20 | Observability | done (no telemetry by decision; session, status and CI signals) | [20-observability.md](20-observability.md) | PRODUCT.md, scripts, ci.yml, security.yml, renovate.json |
| 21 | Incident response | done (no alert channel; real CI case) | [21-incident-response.md](21-incident-response.md) | ui_review_gate.py, git log, gh run list |
| 22 | DORA | done (production recovery + per-machine change fail = cannot compute) | [22-dora.md](22-dora.md) | git log, gh run list, gh repo view |

## Reused docs (ลิงก์ ไม่คัดลอก)

- Product framing, users, Sentry decision: [PRODUCT.md](../../PRODUCT.md) — ใช้ใน 01, 02, 04, 16, 20, ADR-0006
- Plugin install, sub-agents, harness links: [README.md](../../README.md) — ใช้ใน 03, 05, 16
- UI quality gate procedure: [qa-testing/references/ui-quality-gate.md](../../qa-testing/references/ui-quality-gate.md), [qa-testing/SKILL.md](../../qa-testing/SKILL.md)
- Scenario format for flow-video: [flow-video/references/scenario-format.md](../../flow-video/references/scenario-format.md)
- Central decision: [architecture-docs ADR-0003 hosted shared services](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0003-hosted-shared-services.md) (decision 1 = skill hub);
  [ADR-0007 design floor](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0007-central-design-floor-and-tokens.md) อ้าง repo นี้เป็น rule source
- ops records: hosted-shared-services, ai-stack (Codex Stop gate ถอดออกจาก plugin ใน ebb1298), merge-locally

## Main gaps found

1. `main` ไม่มี branch protection / ruleset ขณะที่ plugin ไม่มี version → ทุก push ถึงทุกเครื่อง (13, 18)
2. CI ไม่รัน `tests/ui_review_gate_test.py` และ Node fixture tests ที่ `task check` รัน (04, 15, 17)
3. hooks.json match แค่ `Bash` แม้ gate รองรับ `PowerShell` (13, ADR-0003)
4. `mcp_auth_header.py` ไม่มี test (17, ADR-0004)
5. central ADR-0003 / ops record hosted-shared-services ยังระบุ Codex review Stop gate ใน plugin ซึ่งไม่มีแล้ว (05)
6. README default ของ `SOLO_ARCHITECTURE_ROOT` (`../architecture-docs`) ไม่ตรงกับโค้ด (`../solo-architecture`) (07)
