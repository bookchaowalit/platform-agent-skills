# ADR-0001 — Skills are provider-neutral Markdown packages at the repository root

- Status: accepted (retro-documented)

## Context
ทุก harness (Claude Code, Codex, Copilot) ต้องอ่านวิธีทำงานชุดเดียวกัน โดยไม่ซ้ำไฟล์ต่อเครื่องมือ

## Decision
skill หนึ่งตัว = folder ที่ root ของ repo ชื่อ lowercase-hyphen มี `SKILL.md` (frontmatter เฉพาะ `name` + `description`, มี H1,
≤ 500 lines / 5,000 words) และ `agents/openai.yaml` (`interface.display_name`, `short_description` 25–64 ตัวอักษร, `default_prompt`
ที่อ้าง `$<name>`); `references/`, `scripts/`, `assets/` เมื่อจำเป็นเท่านั้น. third-party skills อยู่ใต้ `vendor/` และไม่ถูกบังคับ governance

## Evidence
- README.md (Use, Layout, Vendored skills)
- scripts/check_skills.py (`NAME` regex, frontmatter name = folder)
- scripts/skill_governance.py (`MAX_SKILL_LINES`, `MAX_SKILL_WORDS`, allowed frontmatter fields, openai.yaml checks, `NON_SKILL_DIRS` รวม `vendor`)
- PRODUCT.md (Positioning: "Provider-neutral, repository-owned instructions")

## Consequences
- `task check` / CI ตรวจทุก package ก่อนถึงผู้ใช้; README inventory ต้องตรงกับ folders
- docs/ อยู่ใน `NON_SKILL_DIRS` จึงไม่ถูกนับเป็น skill
