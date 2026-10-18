#!/usr/bin/env python3
"""PreToolUse hook: no production UI release without a visual review sign-off.

Blocks a shell command that ships UI to users when the commit has UI changes nobody
signed off with ui_signoff.py:

- ``vercel ... --prod`` / ``vercel promote`` (the checkout's HEAD is what ships);
- ``gh pr merge`` (the PR head is what merges; PRs that touch no UI files pass);
- ``git push`` to the remote's default branch (a local merge followed by a push, which
  also triggers Git-based auto-deploys); pushes with no UI changes since the remote tip,
  and pushes to other branches, pass.

A local sign-off record or a ``ui-review`` = success commit status on GitHub (posted by
ui_signoff.py from any machine) both count.

A sign-off covers its commit and any later commit that changes no UI files. Passing
tests, overflow checks or an agent's summary are not a sign-off: someone has to look at
full-page screenshots of every touched page at phone and desktop widths
(references/ui-quality-gate.md, section 0).

Input: the hook JSON on stdin (``tool_name``, ``tool_input.command``, ``cwd``).
Output: a PreToolUse ``deny`` decision with the reason, or nothing to allow.
Unexpected errors allow the command and print a note, so the gate never locks you out.
Set ``UI_REVIEW_GATE=off`` in the environment to disable it.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ui_review_evidence import (
    covering_signoff,
    git,
    github_status,
    is_ui_file,
    repo_has_ui,
    repo_root,
    repo_slug,
    signed_shas,
    ui_changes_between,
)

SPLIT = re.compile(r"\s*(?:&&|\|\||;|\|)\s*")
HOW_TO = (
    "Run the UI visual review first (qa-testing skill, references/ui-quality-gate.md section 0): "
    "node <qa-testing>/scripts/ui_review.mjs --url <each touched page> --widths 320,375,768,1024,1440 --out <dir>, "
    "look at every screenshot slice and fix what you see, then "
    "python3 <qa-testing>/scripts/ui_signoff.py --repo <repo> --report <dir>/report.json --reviewer <who> --verdict pass --notes '<what you checked>'. "
    "The owner can disable this gate with UI_REVIEW_GATE=off."
)


def segments(command: str) -> list[list[str]]:
    out = []
    for part in SPLIT.split(command):
        try:
            tokens = shlex.split(part)
        except ValueError:
            tokens = part.split()
        while tokens and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]):
            tokens = tokens[1:]  # leading VAR=value assignments
        if tokens:
            out.append(tokens)
    return out


def is_vercel_prod(tokens: list[str]) -> bool:
    if "vercel" not in [Path(t).name for t in tokens] and not any(
        t.startswith("vercel@") for t in tokens
    ):
        return False
    return "--prod" in tokens or "--production" in tokens or "promote" in tokens


def gh_merge_target(tokens: list[str]) -> tuple[str, str | None] | None:
    if tokens[:3] != ["gh", "pr", "merge"]:
        return None
    target, repo, rest = "", None, tokens[3:]
    i = 0
    while i < len(rest):
        tok = rest[i]
        if tok in {"--repo", "-R"} and i + 1 < len(rest):
            repo = rest[i + 1]
            i += 2
            continue
        if tok.startswith("--repo="):
            repo = tok.split("=", 1)[1]
        elif not tok.startswith("-") and not target:
            target = tok
        i += 1
    return target, repo


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def check_deploy(cwd: Path) -> str | None:
    root = repo_root(cwd)
    if root is None or not repo_has_ui(root):
        return None
    head = git(root, "rev-parse", "HEAD")
    slug = repo_slug(root)
    if covering_signoff(root, slug, head) or github_status(slug, head) == "success":
        return None
    return f"UI review gate: {slug}@{head[:7]} is about to go to production without a visual review sign-off. {HOW_TO}"


def check_merge(cwd: Path, target: str, repo_arg: str | None) -> str | None:
    cmd = [
        "gh",
        "pr",
        "view",
        *([target] if target else []),
        "--json",
        "headRefOid,files,number",
    ]
    if repo_arg:
        cmd += ["--repo", repo_arg]
    view = subprocess.run(
        cmd, check=False, capture_output=True, text=True, timeout=60, cwd=cwd
    )
    if view.returncode != 0:
        raise RuntimeError(view.stderr.strip() or "gh pr view failed")
    pr = json.loads(view.stdout)
    ui_files = [f["path"] for f in pr.get("files", []) if is_ui_file(f["path"])]
    if not ui_files:
        return None
    head = pr["headRefOid"]
    root = repo_root(cwd)
    slug = repo_arg or (repo_slug(root) if root else "")
    if root is not None and repo_slug(root) == slug:
        if (
            subprocess.run(
                ["git", "-C", str(root), "cat-file", "-e", head],
                check=False,
                capture_output=True,
            ).returncode
            != 0
        ):
            subprocess.run(
                ["git", "-C", str(root), "fetch", "-q", "origin"],
                check=False,
                capture_output=True,
                timeout=120,
            )
        if covering_signoff(root, slug, head):
            return None
    elif head in signed_shas(slug):
        return None
    # A sign-off made on another machine reaches here through the GitHub commit status.
    if github_status(slug, head) == "success":
        return None
    shown = ", ".join(ui_files[:4]) + (" …" if len(ui_files) > 4 else "")
    return f"UI review gate: PR #{pr.get('number')} in {slug} changes UI ({shown}) and {head[:7]} has no visual review sign-off. {HOW_TO}"


PUSH_VALUE_OPTIONS = {
    "--repo",
    "--receive-pack",
    "--exec",
    "-o",
    "--push-option",
    "--signed",
}


def git_push_target(tokens: list[str]) -> tuple[Path | None, str, list[str]] | None:
    """For ``git [-C dir] push [options] [remote [refspec...]]``: (dir, remote, refspecs)."""
    if not tokens or Path(tokens[0]).name != "git":
        return None
    rest, cdir = tokens[1:], None
    while rest and rest[0].startswith("-"):
        if rest[0] == "-C" and len(rest) > 1:
            cdir = Path(os.path.expanduser(rest[1]))
            rest = rest[2:]
        elif rest[0] == "-c" and len(rest) > 1:
            rest = rest[2:]
        else:
            rest = rest[1:]
    if not rest or rest[0] != "push":
        return None
    positional: list[str] = []
    args = rest[1:]
    i = 0
    while i < len(args):
        tok = args[i]
        if tok in {"--dry-run", "-n", "--delete", "-d"}:
            return None  # nothing ships
        if tok in PUSH_VALUE_OPTIONS:
            i += 2
            continue
        if not tok.startswith("-"):
            positional.append(tok)
        i += 1
    remote = positional[0] if positional else ""
    return cdir, remote, positional[1:]


def default_branch(root: Path, remote: str) -> str:
    ref = git(
        root, "symbolic-ref", "--quiet", f"refs/remotes/{remote}/HEAD", check=False
    )
    if ref:
        return ref.rsplit("/", 1)[-1]
    for name in ("main", "master"):
        if git(
            root,
            "rev-parse",
            "--verify",
            "--quiet",
            f"refs/remotes/{remote}/{name}",
            check=False,
        ):
            return name
    return "main"


def check_push(
    cwd: Path, cdir: Path | None, remote: str, refspecs: list[str]
) -> str | None:
    root = repo_root((cwd / cdir) if cdir else cwd)
    if root is None or not repo_has_ui(root):
        return None
    current = git(root, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if not remote:
        upstream = git(root, "rev-parse", "--abbrev-ref", "@{u}", check=False)
        remote = upstream.split("/", 1)[0] if "/" in upstream else "origin"
        refspecs = (
            [f"HEAD:{upstream.split('/', 1)[1]}"] if "/" in upstream else [current]
        )
    elif not refspecs:
        refspecs = [current]
    target = default_branch(root, remote)
    slug = repo_slug(root)
    for spec in refspecs:
        src, _, dst = spec.lstrip("+").partition(":")
        dst = (dst or src).removeprefix("refs/heads/")
        if dst != target:
            continue
        sha = git(
            root,
            "rev-parse",
            "--verify",
            "--quiet",
            f"{src or 'HEAD'}^{{commit}}",
            check=False,
        )
        if not sha:
            continue
        remote_tip = git(
            root,
            "rev-parse",
            "--verify",
            "--quiet",
            f"refs/remotes/{remote}/{target}",
            check=False,
        )
        changed = (
            ui_changes_between(root, remote_tip, sha)
            if remote_tip
            else ["(new branch)"]
        )
        if not changed:
            continue
        if covering_signoff(root, slug, sha) or github_status(slug, sha) == "success":
            continue
        shown = ", ".join(changed[:4]) + (" …" if len(changed) > 4 else "")
        return f"UI review gate: pushing {sha[:7]} to {remote}/{target} in {slug} ships UI changes ({shown}) without a visual review sign-off. {HOW_TO}"
    return None


def main() -> int:
    if os.environ.get("UI_REVIEW_GATE", "").lower() == "off":
        return 0
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    if payload.get("tool_name") not in {"Bash", "PowerShell"}:
        return 0
    command = (payload.get("tool_input") or {}).get("command") or ""
    cwd = Path(payload.get("cwd") or os.getcwd())
    try:
        for tokens in segments(command):
            if tokens[0] == "cd" and len(tokens) > 1:
                cwd = (cwd / os.path.expanduser(tokens[1])).resolve()
                continue
            reason = None
            if is_vercel_prod(tokens):
                reason = check_deploy(cwd)
            elif (merge := gh_merge_target(tokens)) is not None:
                reason = check_merge(cwd, *merge)
            elif (push := git_push_target(tokens)) is not None:
                reason = check_push(cwd, *push)
            if reason:
                deny(reason)
                return 0
    except Exception as error:  # noqa: BLE001 - never lock the user out on a gate bug
        print(f"ui_review_gate: skipped ({error})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
