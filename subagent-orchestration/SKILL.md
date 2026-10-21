---
name: subagent-orchestration
description: Plan and delegate work as the Opus orchestrator by breaking a request into goal, tasks, and subtasks, routing each subtask to the right Solo Empire sub-agent and model, writing a detailed delegation brief, integrating the structured handoffs, and closing with an external review-and-fix loop. Use before spawning any solo-* sub-agent, when a request spans several files or steps, or when Haiku workers need precise instructions.
---

# Subagent Orchestration

The main agent (Opus 5.5) is the planner and orchestrator. It owns the goal,
the decomposition, every delegation brief, integration, final verification, and
release approval. Sub-agents get one bounded subtask each and return the
`solo-empire.subagent-handoff.v1` contract in
`skills/ai-agent-workflows/references/sub-agent-handoff.md`.

## When not to delegate

- One known file, symbol, or fact → read or search it directly.
- The next step depends on a result you can get in one or two tool calls.
- The work needs the full conversation context or a user decision.
- The work is a release, push, deploy, spend, or external message; only the
  main agent does those.

## Workflow

1. **Frame the goal.** Write the user outcome in one sentence, measurable
   success criteria, constraints (repository boundaries, approvals, secrets),
   and explicit non-goals. Stop and ask when the outcome is a user decision.
2. **Decompose.** Build a `Goal → Task → Subtask` tree with the plan template in
   [`references/delegation-brief.md`](references/delegation-brief.md). A task is
   one verifiable outcome; a subtask is one role, one scope, and one
   deliverable that fits a single sub-agent run. Record dependencies and mark
   which subtasks can run in parallel.
   **Register the work** before the first delegation through the supported
   Tasks MCP/API interface. The Tasks API in `empire-platform` is the live task
   source of truth; use `create_task` with `reuse_open: true` so retries reuse
   the open task. Add subtasks (`parent_task_id`) only for separate worker
   deliverables. Use the returned task ID as the correlation ID in each brief
   and commit message (`Task: #<id>`). If the supported task MCP tool is
   unavailable in this session, record the known correlation ID in the bounded
   brief/handoff and report that registration could not be completed. Do not
   create a local SQLite/shadow task store or request credentials as a
   workaround.
3. **Route.** Pick the role and model per subtask with the routing table below.
   Keep subtasks the main agent will do itself in the same tree.
4. **Brief.** Write one delegation brief per subtask with every field of the
   brief template. Haiku workers get exact paths, search patterns, line
   ranges, expected counts, and the output shape; never "look around".
5. **Dispatch.** Send independent subtasks in one message so they run
   concurrently. Run dependent subtasks only after their inputs return.
6. **Integrate.** Validate each handoff: contract fields present, evidence is
   concrete (paths, lines, command output), tests distinguish passed from
   skipped. Re-run the decisive verification yourself; never forward a
   sub-agent claim as fact. Re-brief or escalate on `blocked`/`needs_parent`.
7. **Review loop.** The main agent owns this loop; workers never drive it.
   The review unit is one reviewable change set (one task's diff, its
   acceptance criteria, and its test results), not every commit.
   - **Gate by risk.** Low risk (rename, formatting, boilerplate): automated
     checks only. Medium risk: one independent review when the task's
     implementation is done. High risk (security, migration, payment, data
     deletion, auth): independent review at each logical milestone and at the
     end, plus `solo-security`.
   - **Run the review** only after tests, typecheck, lint, and build pass.
     Commit the change set as one scoped commit, then dispatch a fresh
     `solo-reviewer` (`model: opus` for high risk) that did not write the
     change: "Review commit <sha> (git show <sha>) against: <acceptance
     criteria>. Do not edit files. Report each finding with severity,
     file:line, evidence, and a suggested fix, or say no findings."
   - **Triage every finding yourself** against the evidence; the reviewer has
     no veto. Mark each one *blocking* (must fix before accepting), *non-blocking*
     (record it in the report, do not loop on it), or *disputed* (check the
     evidence before anyone acts on it).
   - **Send only blocking findings back** to the worker that wrote the change,
     as a new brief with the finding, the evidence, and the check that must
     pass. The worker fixes the issue, adds a regression test, and reruns the
     checks. Then a fresh reviewer reviews the fix commit.
   - **Stop** when a review has no blocking finding (accept), or when the
     escalation limit below is reached.
   - **Track review scope.** Record the SHA each review covered. Accept only
     when the reviewed SHA set equals the commits being accepted; any commit
     after the last clean review needs its own review at the same risk tier.
   - **Track every blocking finding** to one end state: *fixed* (fix commit
     plus passing check), *disputed* (evidence that it is not a defect), or
     *escalated* (to a stronger model or the user). Do not accept a change set
     while a blocking finding is still open.
   - **Verify after the last change.** If anything changed after the review
     passed (even a rebase or a doc tweak), rerun the focused checks and
     confirm the diff stayed inside the reviewed scope before accepting.
   - The reviewer reports and never fixes. Give it read-only tools; if it
     edits a file anyway, discard that edit and re-run the review.
8. **Report.** Summarize the tree status, what changed, verification evidence,
   review rounds with their reviewed SHAs and finding states, and residual
   risks. Also record the workflow metrics: wall-clock task time, review
   latency, review rounds, first-pass acceptance (yes/no), escalations, and
   which models ran, plus the minutes spent on task bookkeeping. Append them
   to the parent task with `update_task` `append_notes` as one line:
   `trial: tier=<low|medium|high> models=<...> shas=<...> total_min=<n> review_min=<n> rounds=<n> first_pass=<yes|no> escalations=<n> findings=<fixed/disputed/escalated counts> task_mgmt_min=<n>`,
   then mark the task done. These feed the stack comparison; do not tune
   routing without them.

## Routing table

| Subtask kind | Role | Model / effort |
| --- | --- | --- |
| Locate files, map call paths, collect evidence | `solo-explorer` | Haiku, `medium` |
| Schema, contract, lineage, query audit | `solo-data` | Haiku, `medium` |
| Browser rendering and interaction checks | `solo-ui-verifier` | Haiku, `medium` |
| Bounded code or docs change | `solo-implementer` | Haiku, `medium` |
| Reproduce and root-cause a failure | `solo-debugger` | Sonnet, `medium` |
| Independent review of each medium- or high-risk change set (step 7) | `solo-reviewer` | Sonnet, `medium`; `model: opus` for high risk |
| Secrets, permissions, MCP, privacy audit | `solo-security` | inherit Opus |

Models and efforts come from `claude_model` and `claude_effort` in
`.github/agents/roles.yaml`; change them there and run `task subagents:sync`.
Override per call with the Agent `model` parameter when a subtask is harder or
easier than its role default.

## Risk-based routing

| Task kind | Primary | Review gate |
| --- | --- | --- |
| Rename, formatting, boilerplate | Haiku implementer | Focused tests and lint |
| CRUD, API, UI component in known patterns | Haiku implementer | Tests, typecheck, static analysis |
| Multi-file feature or large refactor | Implementer with `model: sonnet` | Independent review |
| Complex debugging | Sonnet debugger; escalate to Opus | Independent review |
| Architecture or cross-system design | Opus (main agent) | Independent review |
| Security, migration, payment, data deletion | Opus security plus implementer with `model: sonnet` or `opus` | Independent review and tests; release approval stays with the user |

The review gate column is the minimum. The risk tier in step 7 decides whether
an independent review also runs: any row rated medium or high risk gets one.
Automated checks (tests, lint, typecheck, CI) are always the first gate; the
review never replaces them.

## Escalation rule

- A Haiku worker gets at most two attempts at the same subtask. After the second
  failed verification, re-dispatch with `model: sonnet` and the failure
  evidence in the brief.
- A Sonnet worker gets at most two attempts; then the main agent takes the
  subtask itself or asks the user.
- Never loop a worker on the same failing check without new evidence.
- The same limits apply to review rounds: two failed rounds with the
  same worker model mean escalate the model, not a third round.

## Brief quality bar

- The brief stands alone: a worker with no conversation history can finish it.
- Scope lists files or directories in and out, plus what must not change.
- Acceptance criteria are checkable statements, not adjectives.
- Verification names exact commands and the expected result.
- Budget caps files read and tool calls so a worker stops instead of wandering.
- Stop conditions say when to return `blocked` or `needs_parent`.
- No credentials, tokens, cookies, or private payloads in the brief.

## Handoff

Return the goal tree with each subtask's status, the briefs that were sent,
integrated evidence, verification commands and results, review rounds, open
risks, and the single next safe action.
