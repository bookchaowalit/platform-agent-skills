# Main-only with TDD, the Big Loop and the autopilot

These rules cover product clones that also work on `main` (the Big Loop batch
rules, `~/work/BIG-LOOP-BATCH-RULES.md`, and each repo's own README). The
hub rules in `SKILL.md` still apply to the hub.

## Red/green on main (ADR-0004 v1.1)

Source: architecture-docs `docs/architecture/decisions/ADR-0004-tdd-sdd-standard.md`.

1. The spec declares `Main-only: yes` in its Document control.
2. Commit the failing test on its own (`test: AC-01 ...`) before the
   implementation commit.
3. Rerun the red commit's test command locally and confirm the expected
   assertion failure **before** pushing.
4. Push the red and green commits **together** in one push. Never push a red
   commit alone: it turns `main` red and can block or break a deploy.
5. Do not squash, rebase or force-push after the red/green log is written; the
   logged red SHA must stay an ancestor of the pushed tip.
6. Log red as `sha · command · failure message`, green as the CI run URL of the
   tip. Check: `gh run list --commit <red-sha>` returns nothing; the tip's run
   passed.

## Merge and push

- Merge in the local clone and push `main`; never `gh pr merge` or a GitHub web
  merge unless the owner asks.
- Never `git add .` in a shared checkout; commit only your paths. Other
  sessions may own other files, or the whole repo, at the same time.
- No force-push, no deleting branches or repos, no archiving; list
  recommendations instead.
- What deploys from `main` ships on push: run the full checks and a local build
  first, check deploy/health after the push, and revert if it breaks. The CD
  standard is ADR-0003 (accepted 2026-10-23, D3): Railway services verify the
  deploy with `deploy-railway.yml` v1.3.0 `mode: verify`.

## Autopilot branches

`productivity-tracking-web/.autopilot/` is the one place where short-lived
branches are normal: the loop works on `autopilot/<issue>-<slug>`, merges with
`git merge --no-ff` in the runner's clone and pushes `main`, or opens a PR
labelled `needs-human` when a gate or merge rule fails. The owner approves a PR
by adding `autopilot:approved`; the next run merges it locally. Do not treat
these branches as stale cleanup while their issue is open or blocked, and do
not merge them by hand outside the loop's rules.

## Where the next task comes from

The next piece of work is a task in the single backlog (tasks-api,
D2, decided 2026-10-23; GitHub issues feed it), created from outcome reviews,
Sentry errors, incidents and experiment results per architecture-docs
`docs/lifecycle/OUTCOME-REVIEW-TO-BACKLOG.md`. A main-only session does not
keep its own task list in a Markdown file.
