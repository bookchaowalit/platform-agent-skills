# Product

<!-- impeccable:product-schema 1 -->

## Platform

library (agent skills, Markdown with small validator and gate scripts)

## Users

- The Solo Empire owner and the AI agents working for them: Claude Code (the `solo` plugin, as
  `/<skill-name>` and the nine `solo:<role>` sub-agents in `agents/`), Codex through
  `.agents/skills`, and GitHub Copilot through the hub's `.github/skills` links.
- Outsourced contractors who follow the same skills when they work on owner repositories.

## Product Purpose

One source of truth for how work is done: each skill package (`<name>/SKILL.md`, optional
`references/`, `scripts/`, `agents/openai.yaml`) states when it applies and the steps, gates and
evidence it requires, for every agent harness at once.

Success: agents pick the right skill for a request, follow its gates (TDD, UI review, security)
without being reminded, and no two skills cover the same outcome.

## Positioning

Provider-neutral, repository-owned instructions instead of per-tool prompt files: the skills are
plain Markdown linked into each harness, so a change lands in Claude Code, Codex and Copilot in
one commit, and `task check` validates every package before it ships.

## Operating Context

- Not deployed: harnesses read the files from a clone (the hub links them with
  `infra/scripts/agent/harness_skills.py --write`) or from the `solo` plugin.
- CI: shared `ci-python` (validators, governance audit and tests from `uv.lock`, Ruff, mypy) and
  the security workflow; `task check` adds the Node fixture tests of the UI review and flow-video
  scripts.
- Sentry does not apply: nothing runs as a service. The scripts run inside the owner's own agent
  session, and an error reporter there would send local paths, prompts and repository names to
  a third party. Failures surface in the session and in CI instead.

## Capabilities and Constraints

- 24 skill packages plus `vendor/impeccable`; `skill-template` is the package contract and
  `govern-ai-skills` decides whether to extend a skill or add one.
- `agents/`: nine sub-agent definitions (explorer, implementer, debugger, reviewer, security,
  data, ui-verifier, researcher, social-intel) generated from the hub's
  `.github/agents/roles.yaml`.
- Gate scripts: `qa-testing/scripts/ui_review_gate.py` (blocks production deploys and pushes of
  unsigned UI changes), `ui_signoff.py`, `ui_review_status.py`.
- Constraints: no secrets, personal data, generated output or provider-local state in a
  package; skill names are lowercase with hyphens; trigger conditions live in the frontmatter.

## Measures

- `task check` and the governance audit pass on `main` (target: always).
- Skills with overlapping triggers reported by `skill_governance.py` (target: 0).
- Requests where an agent missed a required gate (UI review, TDD red run) found in review
  ([ต้องยืนยัน] where these are logged).
