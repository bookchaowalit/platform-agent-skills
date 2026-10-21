# Solo Skills

This repository (`bookchaowalit/platform-agent-skills`) holds the portable AI skill
packages for Solo Empire work. The `solo-empire` hub now owns the registry and
agent harness only. A skill is a directory at this repository root with a
required `SKILL.md`; it may also
include `agents/openai.yaml`, `scripts/`, `references/`, or `assets/` when they
are genuinely needed.

## Use

1. Find the skill whose `SKILL.md` description matches the task.
2. Read that skill's `SKILL.md` before acting on the task.
3. Load linked references only when the workflow needs them.
4. Run bundled scripts from the skill directory and verify their output.
5. Keep secrets, personal data, generated output, and provider-local state out
   of the skill package.

For a short or cross-cutting request, start with
`solo-empire-operator/SKILL.md`; it selects the relevant infra command,
repository document, and specialist skill without loading the whole system.

Run `task audit` (JSON) or `task check` before deciding that a new
package is needed. Use `govern-ai-skills` to extend an existing skill when the
user outcome already overlaps; otherwise use the active `skill-creator`
scaffold with `skill-template` as the repository contract. Skill names use
lowercase letters, digits, and hyphens. Keep the body concise and put trigger
conditions in frontmatter.

These are repository-owned, provider-neutral instructions. `.claude/`,
`.qoder/`, `.codex/`, and other dot-directories remain provider discovery and
runtime boundaries; do not move them here.

Codex discovers repository skills through `.agents/skills`. The setup script
creates symlinks there that point back to these canonical packages, so the
instructions have one source of truth and are not duplicated.

## Available skills

- ai-agent-workflows — reliable agent loops, approvals, evidence, and failure handling
- ai-agents — safe AI tool and infrastructure operation
- ai-native-estimation — module decomposition, parallel AI workstreams, wait-aware delivery ranges, critical path, and calibration
- ai-product-delivery — production delivery for AI products and features
- book-dev-engineering-loop — one-task Book Dev execution with repository isolation and approval gates
- business-analysis — requirements, traceability, UAT, and benefits handoff
- client-discovery-and-proposals — qualified scope, proposal, pricing, and delivery handoff
- content-distribution — evidence-backed content planning and measurement
- data-engineering — governed lake-first data products, contracts, quality, lineage, and replay
- flow-video — walkthrough videos per role and use case (role tours with a role × page map, captioned use-case recordings, read-only by default, gallery)
- govern-ai-skills — skill gap audit, lifecycle, routing, metadata, and context governance
- graphic-design — design principles, art style vocabulary, and critique checklist for graphics and campaigns
- lead-research-and-crm — lead qualification, outreach, and CRM hygiene
- main-only-development — keep the Solo Empire root repository on main and safely integrate extra refs
- product-management — PRD, roadmap, KPI and instrumentation plan, launch/GTM plan, experiment log, outcome reviews, screen inventory, and user flows
- qa-testing — test strategy, test cases, UAT scripts, quality evidence, and the full-page UI visual review gate (capture in Chromium/WebKit/Firefox and device emulation, audit, visual baseline diff, axe-core accessibility, mobile Core Web Vitals, sign-off, release hook)
- security-and-privacy — data classification, trust boundaries, and security review
- skill-template — blank repository contract for a new provider-neutral skill
- solo-empire-operator — bounded routing for short and cross-cutting requests
- solution-architecture — SA architecture, ADRs, NFRs, API/data TRD, and runbooks
- subagent-orchestration — Opus goal/task/subtask planning, Haiku/Opus routing, detailed delegation briefs, and review-fix loop
- system-docpack — tiered per-system document packs and PDFs across the portfolio
- unused-file-cleanup — read-only scan for unreferenced files, verification, and approved scoped removal
- ux-review — phased UX audit and fix loop: product map, routes, authorization, persona flows, page-by-page and interaction-state review, copy, figures, scoring, live re-check

## Layout

```text
<skill-name>/
├── SKILL.md
└── agents/
    └── openai.yaml
```

## Checks

```bash
task check        # python3 scripts/check_skills.py: every skill has valid SKILL.md frontmatter
```

Operational commands live in `platform-ops-cli` (legacy sibling name
`ops-toolkit`); architecture documents live in `architecture-docs`. This
repository has no runtime dependency on them or on the hub.

## Install as a Claude Code plugin (the shared skill hub)

This repository is also a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`)
holding one plugin, `solo`. GitHub hosts it, so every machine gets the same skills and gates
from this repository and nothing depends on local symlinks. Skills appear as `/solo:<name>`.

```text
/plugin install solo --marketplace bookchaowalit/platform-agent-skills
```

Or declare it in `~/.claude/settings.json` (CLI and Desktop read the same file):

```json
{
  "extraKnownMarketplaces": {
    "solo-empire": { "source": { "source": "github", "repo": "bookchaowalit/platform-agent-skills" } }
  },
  "enabledPlugins": { "solo@solo-empire": true }
}
```

The plugin carries:

| Part | Path | What it does |
|---|---|---|
| Skills | every `<name>/SKILL.md` at the root, plus `vendor/<name>/` | the skill packages listed above |
| UI review gate | `qa-testing/scripts/ui_review_gate.py` (PreToolUse on Bash) | blocks a push to the default branch that changes UI files until the full-page visual review is signed off |
| Tool hub (MCP) | `.mcp.json` → `solo-empire` | the hosted remote MCP (`platform-mcp-remote-worker`): `list_cells`, `describe_cell`, `call_cell` for every cell, plus the CRM and AI tools. `hooks/mcp_auth_header.py` supplies the bearer from Infisical `/mcp` at connect time, so no token is stored in a config file (cloud sessions add the server themselves, see the remote MCP README) |

The plugin has no `version`, so Claude Code tracks the latest commit on `main`: a merge here
reaches every machine on its next plugin update. Cloud sessions on claude.ai/code do not
install plugins that a repository's `.claude/settings.json` declares, so this hub serves the
CLI and the Desktop app; Codex keeps reading the same packages through `.agents/skills`.

Validate the manifests with `npx -y @anthropic-ai/claude-code plugin validate ./`.

## Using the skills from a harness

Harnesses (Claude Code, Codex, Gemini) discover skills through symlinks. The
hub harness creates them with
`python3 infra/scripts/agent/harness_skills.py --write`, pointing at this
checkout. Run that command from the hub only; skill validation (`task check`,
`task audit`) runs from this repository.

## Checks

```bash
cd agent-skills
task check     # check_skills.py + skill_governance.py + tests/skill_governance_test.py
task audit     # complete governance audit as JSON
```

`scripts/skill_governance.py` was moved from the solo-empire hub (`infra/scripts/utils/skill_governance.py`).
Router and role-coverage checks are optional: set `SOLO_ROUTER_PATH` to a `router.py` to audit routes, and
`SOLO_ARCHITECTURE_ROOT` (default `../architecture-docs`) to check role coverage. When unset or absent they
are skipped, so the checks pass in a fresh clone.

## Vendored skills

`vendor/<name>/` holds third-party skills kept as published (for example `vendor/impeccable`, the design skill). They are linked into the harness folders like our own skills but are not held to the house governance rules.
