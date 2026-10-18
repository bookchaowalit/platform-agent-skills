---
name: codex-review
description: Get a second-opinion code review from OpenAI Codex (uses the user's ChatGPT subscription via the local `codex` CLI). Use when the user says "codex review", "ให้ codex รีวิว", "/codex-review", or asks for a cross-model review of the current changes. Optional args - "base <branch>", "commit <sha>", or extra focus instructions.
---

# Codex review

Run Codex as a read-only reviewer on the current git repo, then report its findings back to the user. Codex never edits files here; Claude decides what (if anything) to fix.

## Steps

1. Confirm the working directory is a git repo with something to review (`git status --short`, `git log -1 --oneline`). If nothing changed and no base/commit was given, say so and stop.
2. Pick the target from the args:
   - nothing → `--uncommitted`
   - `base <branch>` → `--base <branch>`
   - `commit <sha>` → `--commit <sha>`
   - any other text (focus instructions) → use the `codex exec` form below instead, because `codex review` rejects a custom prompt together with `--uncommitted/--base/--commit`
3. Run in the background (reviews can take several minutes) and save the output to the session scratchpad:

   ```bash
   # standard review (tested, outputs [P1]/[P2] findings with file:line)
   codex review --uncommitted \
     -c sandbox_mode='"read-only"' \
     -c model_reasoning_effort='"high"' \
     > "$SCRATCHPAD/codex-review.md" 2>&1

   # review with custom focus
   codex exec -s read-only -c model_reasoning_effort='"high"' \
     "Review the uncommitted changes in this repo (run git diff yourself). Focus: <user's focus>. List findings by severity with file:line. Do not modify files." \
     > "$SCRATCHPAD/codex-review.md" 2>&1
   ```

   Raise effort to `"max"` only if the user asks for a deep review.
4. Read the output. For each finding, check it against the code yourself before relaying it — mark each one **confirmed**, **plausible**, or **disagree (why)**. Codex can be wrong.
5. Report a short ranked list to the user and ask whether to fix the confirmed ones. Do not apply fixes without a yes.

## Notes

- Auth: `codex login` (ChatGPT plan). If the command fails with an auth error, tell the user to run `codex login` in a terminal.
- Usage counts against the ChatGPT subscription, not Claude's.
- Stack overview: `~/ai-stack/README.md`.
