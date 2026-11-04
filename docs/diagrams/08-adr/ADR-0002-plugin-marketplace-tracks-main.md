# ADR-0002 — Distribute as a Claude Code plugin marketplace with no version (tracks main)

- Status: accepted (retro-documented)

## Context
skills และ gates เคยเป็น symlink / hook ใน `~/.claude` ต่อเครื่อง; owner ต้องการ shared service ที่ host อยู่และใช้ได้ทุกเครื่อง

## Decision
repo เป็น marketplace `solo-empire` มี plugin เดียว `solo` (`source: "./"`) ที่ไม่มี `version` จึง track commit ล่าสุดบน `main`;
plugin ห่อ skills (`./`, `./vendor/`), `agents/`, `hooks/hooks.json` และ `.mcp.json`

## Evidence
- .claude-plugin/marketplace.json, .claude-plugin/plugin.json (ไม่มี field `version`)
- README.md ("The plugin has no `version`, so Claude Code tracks the latest commit on `main`")
- central [ADR-0003](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0003-hosted-shared-services.md) decision 1
- ops record: hosted-shared-services (2026-11-03)
- git log: 94a1620 (PR #7, 2026-10-18), 03e5b02 (PR #8 tool hub MCP), ebb1298 (ถอด Codex review gate, 2026-10-21)

## Consequences
- merge ลง `main` = release ไปทุกเครื่องในการ update plugin ครั้งถัดไป; ไม่มี rollback channel อื่นนอกจาก revert บน main
- `main` ไม่มี branch protection (GitHub API 404 "Branch not protected", 2026-11-04) ดู 13-threat-model
- cloud sessions บน claude.ai/code ไม่ติดตั้ง plugin ที่ repo ประกาศ (README)
