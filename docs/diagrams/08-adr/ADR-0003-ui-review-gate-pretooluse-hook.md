# ADR-0003 — UI review gate as a fail-open PreToolUse hook with off-repo evidence and a GitHub status

- Status: accepted (retro-documented)

## Context
agent ชอบสรุปว่า UI "ผ่าน" จาก tests/overflow checks โดยไม่ดู screenshot; ต้องหยุดการ release UI ที่ไม่มีคนดูจริง

## Decision
- `hooks/hooks.json` ลง PreToolUse matcher `Bash` เรียก `qa-testing/scripts/ui_review_gate.py` (timeout 90 s)
- deny `vercel --prod`/`--production`/`promote`, `gh pr merge`, `git push` ไป default branch เมื่อมีไฟล์ UI (suffix `.tsx .jsx .vue .svelte .astro .css .scss .sass .less .html .mdx` นอก tests/stories) ที่ไม่มี sign-off
- sign-off = evidence JSON ต่อ commit ใน `$UI_REVIEW_STATE_DIR/<owner>__<repo>/<sha>.json` (default `~/.local/state/ui-review`) หรือ commit status `ui-review` = success; sign-off ครอบ commit ถัดไปที่ไม่แตะไฟล์ UI
- error ที่ไม่คาดคิด → allow + พิมพ์ stderr (fail-open); `UI_REVIEW_GATE=off` ปิด gate

## Evidence
- hooks/hooks.json, qa-testing/scripts/ui_review_gate.py (docstring, `main`), qa-testing/scripts/ui_review_evidence.py (`UI_SUFFIXES`, `NOT_UI`, `covering_signoff`, `STATUS_CONTEXT`)
- qa-testing/scripts/ui_signoff.py (ต้องมี 375 และ 1280 หรือ 1440, ปฏิเสธ blocker เว้นแต่ `--accept-blockers`)
- tests/ui_review_gate_test.py
- git log: 9db3166 (PR #2), cb74a66 (PR #5 GitHub status), 708bede (gate git push)

## Consequences
- repo ที่ไม่มีไฟล์ UI ไม่ถูก gate (`repo_has_ui`) รวมถึง repo นี้เอง
- tool name `PowerShell` ถูกรองรับใน `main` แต่ hooks.json match แค่ `Bash` (gap)
- evidence ในเครื่องเขียนได้โดยผู้ใช้เครื่องนั้น; ไม่ใช่ control ที่กันคนตั้งใจเลี่ยง
