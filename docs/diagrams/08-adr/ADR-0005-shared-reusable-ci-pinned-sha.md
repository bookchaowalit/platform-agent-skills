# ADR-0005 — CI through shared reusable workflows pinned by commit SHA on GitHub-hosted runners

- Status: accepted (retro-documented)

## Context
DevSecOps Phase 1 ให้ทุก repo ใช้ CI + security baseline กลาง; repo นี้เป็น public

## Decision
`.github/workflows/ci.yml` เรียก `bookchaowalit/platform-ci-workflows` `ci-python.yml` และ `security.yml` ที่ SHA `87dc5e1c…` (v1.1.1)
ด้วย runner default `"ubuntu-24.04"`; `test-command` รัน validators + 2 unittest suites; triggers push `main`, pull_request, workflow_dispatch

## Evidence
- .github/workflows/ci.yml (comment "Public repository: GitHub-hosted runners")
- platform-ci-workflows@87dc5e1c `.github/workflows/ci-python.yml`, `.github/workflows/security.yml`
- renovate.json (group `platform-ci-workflows`, `helpers:pinGitHubActionDigests`)
- git log: 3c456c1 (PR #1, 2026-10-17)

## Consequences
- ไม่มี deploy job: "CD" คือการที่ plugin track main
- ci.yml ไม่ได้รัน `ui_review_gate_test.py` และ Node fixture tests ที่ Taskfile `check` รัน (gap)
