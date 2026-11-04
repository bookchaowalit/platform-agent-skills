# ADR-0006 — No error reporter (Sentry) in the skill scripts

- Status: accepted (retro-documented)

## Context
baseline production ของ portfolio ใส่ Sentry ใน repos ที่ run เป็น service

## Decision
ไม่ใส่ Sentry หรือ telemetry: scripts รันใน agent session ของ owner และ error reporter จะส่ง local paths, prompts และชื่อ repo ออกไปบุคคลที่สาม;
ความล้มเหลวแสดงใน session และใน CI แทน

## Evidence
- PRODUCT.md (Operating Context: "Sentry does not apply")
- grep ไม่พบ `sentry` ใน scripts/, qa-testing/scripts/, ux-review/scripts/, flow-video/scripts/, hooks/
- git log: faca579 (2026-10-22)

## Consequences
- ไม่มีสัญญาณกลางว่า gate fail-open บนเครื่องใด (ดู 20-observability)
