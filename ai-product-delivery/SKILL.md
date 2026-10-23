---
name: ai-product-delivery
description: Plan and ship production-ready AI products and features for Solo Empire, from user outcome and architecture through implementation, evaluation, security, rollout, and handoff. Use when building an AI application, API, automation, retrieval flow, or client-facing delivery.
---

# AI Product Delivery

Ship the smallest useful vertical slice while making quality, cost, security, and ownership explicit.

## Delivery workflow

1. Define the user, job to be done, success metric, acceptance examples, and non-goals. Separate a demo promise from a production promise. Write acceptance examples as `AC-##` scenarios in `specs/<NNN>-<slug>/spec.md` (ADR-0004 SDD) and, for Tier A/B products, the KPI plan (docpack type `kpi-plan`, ADR-0005).
2. Inspect the repository state and choose the correct boundary: `projects/` for first-party project work, the client's own `bookchaowalit-freelance/<client>` repository for hired/client work, and `infra/` for shared operating capabilities.
3. Write a short architecture decision covering UI/API, model provider, prompts, data sources, authentication, authorization, observability, cost limits, fallbacks, and human review.
4. Implement one end-to-end slice using existing packages and patterns, test-first (ADR-0004: a failing test per AC, then the code). Keep provider-specific code behind a small adapter and keep deterministic validation in code.
5. Test behavior, not just the happy path: representative inputs, prompt or retrieval quality, malformed data, tool failure, rate limits, latency, cost, authorization, and secret handling.
6. Add an evaluation set that can be rerun after prompt, model, retrieval, or code changes. Record thresholds and known false positives or false negatives.
7. Roll out safely with environment-specific configuration, feature flags or a small audience where appropriate, logs that omit sensitive data, and a rollback path.
8. Handoff with operating notes: owner, data flow, limits, monitoring, support procedure, docs location, and the next improvement.
9. Measure and learn: events live with a baseline, outcome review by T+30, and each decision, Sentry error or incident action filed as one backlog task (tasks-api, D2). See `references/delivery-loop.md`.

## Decision rules

- Reuse the repository's existing stack unless a new dependency solves a demonstrated problem.
- Do not put credentials, API keys, client secrets, or raw private payloads in code, prompts, logs, fixtures, or generated reports.
- Treat model output as untrusted input. Validate schemas, permissions, links, file paths, and side effects before execution.
- Require human approval for production changes, external communication, financial commitments, and destructive operations.
- If scope, data access, or success criteria are unclear, narrow the slice and document the assumption instead of silently expanding it.
- Owner decisions 2026-10-23: tasks-api is the single backlog (D2), deploys come from Git after CI with a smoke test (D3, ADR-0003), PostHog free tier (D4; sign-up, DPA and consent banner still owner actions).
- Before database changes, follow the repository backup and migration procedure; before changing a nested repository, confirm that the task belongs there.

## Completion standard

Call a feature complete only when the acceptance examples work with a logged red/green run, the evaluation set passes its thresholds, the KPI plan names how the outcome is measured, failure behavior is understandable, checks pass, documentation names the owner, and a safe rollback or recovery path exists.
