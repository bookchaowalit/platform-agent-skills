---
name: main-only-development
description: Use when a development session starts or performs Git work in the top-level Solo Empire repository, especially when branches or worktrees need to be consolidated.
---

# Main-Only Development

## Overview

Start development in the top-level Solo Empire repository on `main` and keep
working there. Merging is a one-time cleanup for non-main branches that already
exist; it restores the intended state and is not the normal development flow.
After cleanup, continue every new task directly on `main`. This policy does not
apply to nested repositories; follow their own instructions and preserve their
independent Git boundaries.

## Workflow

1. Confirm the repository root, then inspect `git status --short --branch`,
   `git branch --all --verbose`, and `git worktree list --porcelain` before any
   Git mutation. Run `git -C <worktree-path> status --short --branch` for every
   listed worktree. Before any merge, branch switch, branch-ref deletion, or
   worktree removal, inspect the staged and unstaged diffs, untracked paths, and
   relevant ignored files in every worktree. Do not proceed until all pending
   work is identified and retained; do not expose sensitive file contents.
2. After the inventory, run `git fetch origin --prune` when the remote is
   reachable so remote-tracking refs are current. Pruning removes stale local
   tracking refs; it does not delete branches from `origin`.
3. Start new work on `main`. If an existing session is on another branch,
   switch only after step 1 confirms its work is safe and retained. Do not
   create feature branches or extra worktrees for ordinary development; commit
   only scoped files on `main`.
4. Treat any non-main branch already present as cleanup. Inspect its commits
   and file changes against `main`, integrate the intended changes once, and
   resolve conflicts by preserving both intended changes. Verify the changes
   are present in `main` before removing the local or `origin` ref; check commit
   ancestry for regular merges and patch content for squash or cherry-pick.
5. Treat staged, unstaged, untracked, ignored, stashed, and other-worktree
   changes as separate work from branch commits. Preserve them. If switching,
   merging, deleting a ref, or removing a worktree could affect work that has
   not been identified and retained, stop and ask the user how to handle it.
6. Push only `main` to `origin` when the scoped changes are ready and the
   repository's approval and verification requirements are satisfied. If
   branch protection or a required review workflow conflicts with main-only
   development, stop and explain the conflict before creating any temporary
   branch or pull request flow.

## Product clones, TDD and autopilot

Product clones in the Big Loop also work main-only, by their own README.
There, ADR-0004 TDD runs on `main`: the failing-test commit comes first, its
red run is checked locally, and red and green are pushed together, never red
alone; no squash or force-push after the red/green log. The autopilot in
`productivity-tracking-web/.autopilot/` is the one place with short-lived
`autopilot/*` branches, merged locally by the loop. Details:
`references/tdd-and-autopilot-on-main.md`.

## Decision rules

- A stale branch shown by an app is not proof that the Git ref still exists; inspect the repository and refresh the app after cleanup.
- A stash is not a branch. Do not pop, drop, or create stashes as branch cleanup.
- Keep ignored runtime data out of commits. Preserve it outside any worktree that must be removed; ask if the safe destination is unclear.
- Never use `git reset --hard`, `git clean`, or force-push to make the branch list look clean.
- Do not delete an attached worktree or a branch with unmerged commits or unidentified work.
- Do not use root-repository instructions to change branches in nested repositories.
- Merge locally and push; never `gh pr merge` unless the owner asks.

## Verify

After integration, confirm the root checkout is on `main`, the only local branch
is `main`, the only remote branch is `origin/main`, `origin/HEAD` points to
`origin/main`, and `main` matches `origin/main` after a successful push. Use
`git ls-remote --heads origin` to verify the actual remote has no other branch
heads; if the remote is unavailable, report that check as unverified. Confirm
that any extra worktrees or stashes were preserved unless their contents were
explicitly handled.
