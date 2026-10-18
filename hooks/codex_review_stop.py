#!/usr/bin/env python3
"""Claude Code Stop hook: Codex review gate for ~/*-hub and ~/nexatech-empire.

When a turn ends, every Git repository the session edited (from the transcript's
Edit/Write tool calls, plus the project root) that has uncommitted changes gets a
read-only ``codex review --uncommitted``. A [P1] finding blocks the stop.

- Each tree state is reviewed once; blocks are capped per session.
- A missing or failing Codex lets the stop through with a note.
- solo-empire has its own gate in harness_hooks.py and is skipped here.
- freelance-hub (client code) and ~/nexatech-empire (company code) are included at
  the owner's request (2026-10-17); their diffs go to OpenAI via Codex.
- Disable with ``SOLO_EMPIRE_CODEX_REVIEW=off``.

Overview: ~/ai-stack/README.md
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

HOME = Path.home()
DISABLE_ENV = "SOLO_EMPIRE_CODEX_REVIEW"
REVIEW_TIMEOUT = 600
MAX_REPOS_PER_STOP = 3
MAX_BLOCKS = 2
STATE_DIR = HOME / ".claude" / "hooks" / "state" / "codex-review"
EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
EXCLUDED_ROOTS = [HOME / "solo-empire"]
EXTRA_PROJECTS = {HOME / "nexatech-empire"}
P1_FINDING = re.compile(r"^\s*(?:[-*]\s*)?\[P[01]\]\s*(.+)$")  # P0 and P1 block
CODEX_COMMAND = [
    "review",
    "--uncommitted",
    "-c",
    'sandbox_mode="read-only"',
    "-c",
    'model_reasoning_effort="high"',
]


def enabled_project(project: Path) -> bool:
    return (
        project.parent == HOME and project.name.endswith("-hub")
    ) or project in EXTRA_PROJECTS


def excluded(path: Path) -> bool:
    return any(path == root or root in path.parents for root in EXCLUDED_ROOTS)


def git(repo: Path, *args: str) -> bytes:
    return subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, check=True, timeout=30
    ).stdout


def repo_root(path: Path) -> Path | None:
    probe = path if path.is_dir() else path.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    try:
        return Path(git(probe, "rev-parse", "--show-toplevel").decode().strip())
    except (OSError, subprocess.SubprocessError):
        return None


def edited_paths(transcript: str | None) -> list[Path]:
    paths: list[Path] = []
    if not transcript:
        return paths
    try:
        lines = Path(transcript).read_text(encoding="utf-8").splitlines()
    except OSError:
        return paths
    for line in lines:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        message = entry.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, list):
            continue
        for item in content:
            if (
                isinstance(item, dict)
                and item.get("type") == "tool_use"
                and item.get("name") in EDIT_TOOLS
            ):
                raw = (item.get("input") or {}).get("file_path") or (
                    item.get("input") or {}
                ).get("notebook_path")
                if isinstance(raw, str) and raw:
                    paths.append(Path(raw).expanduser())
    return paths


def fingerprint(repo: Path) -> str:
    """Hash of the repository plus staged, unstaged and untracked changes; empty when clean."""
    try:
        status = git(repo, "status", "--porcelain", "-z", "-uall")
        if not status.strip(b"\0").strip():
            return ""
        digest = hashlib.sha256(str(repo.resolve()).encode() + b"\0" + status)
        has_head = (
            subprocess.run(
                ["git", "-C", str(repo), "rev-parse", "--verify", "-q", "HEAD"],
                capture_output=True,
                check=False,
            ).returncode
            == 0
        )
        # A repository without a first commit diffs against the empty tree.
        base = "HEAD" if has_head else "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
        digest.update(git(repo, "diff", base, "--binary"))
        digest.update(git(repo, "diff", "--cached", base, "--binary"))
    except (OSError, subprocess.SubprocessError):
        return ""
    for entry in status.split(b"\0"):
        if entry.startswith(b"?? "):
            target = repo / entry[3:].decode("utf-8", "surrogateescape")
            try:
                content = target.read_bytes() if target.is_file() else b""
                # Length-prefixed per file, so content cannot shift between files.
                digest.update(
                    entry + b"\0" + str(len(content)).encode() + b"\0" + content
                )
            except OSError:
                pass
    return digest.hexdigest()


def p1_findings(review: str) -> list[str]:
    found: list[str] = []
    for line in review.splitlines():
        match = P1_FINDING.match(line)
        if match and match.group(1).strip() not in found:
            found.append(match.group(1).strip())
    return found


def run_review(repo: Path, report: Path) -> tuple[bool, str]:
    codex = shutil.which("codex") or str(HOME / ".local" / "bin" / "codex")
    try:
        result = subprocess.run(
            [codex, *CODEX_COMMAND],
            cwd=repo,
            env={**os.environ, DISABLE_ENV: "off"},
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=REVIEW_TIMEOUT,
            check=False,
        )
    except FileNotFoundError:
        return False, "codex CLI is unavailable"
    except subprocess.TimeoutExpired:
        return False, f"codex review timed out after {REVIEW_TIMEOUT}s"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        (result.stdout or "") + "\n--- stderr ---\n" + (result.stderr or ""),
        encoding="utf-8",
    )
    report.chmod(0o600)
    if result.returncode != 0:
        tail = " ".join((result.stderr or "").strip().splitlines()[-2:])[:200]
        return False, f"codex review exited {result.returncode}: {tail or 'see report'}"
    # Some Codex CLI releases print the review on stderr even on success.
    review = result.stdout if (result.stdout or "").strip() else (result.stderr or "")
    if not review.strip():
        return False, "codex review returned no output"
    return True, review


def gate(payload: dict[str, Any]) -> dict[str, Any]:
    if os.environ.get(DISABLE_ENV, "on").strip().lower() in {"off", "0", "false"}:
        return {}
    project = Path(
        os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    ).resolve()
    if not enabled_project(project):
        return {}

    repos: list[Path] = []
    for candidate in [project, *edited_paths(payload.get("transcript_path"))]:
        root = repo_root(candidate)
        if root and not excluded(root) and root not in repos:
            repos.append(root)

    session = hashlib.sha256(
        str(payload.get("session_id", "anonymous")).encode()
    ).hexdigest()[:24]
    state_file = STATE_DIR / f"{session}.json"
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    seen: list[str] = state.setdefault("seen", [])
    blocked: list[str] = state.setdefault("blocked", [])
    blocks = int(state.get("blocks", 0))

    pending = [
        (repo, fp) for repo in repos if (fp := fingerprint(repo)) and fp not in seen
    ]
    notes: list[str] = []
    problems: list[str] = []
    for repo, fp in pending[:MAX_REPOS_PER_STOP]:
        report = (
            STATE_DIR
            / session
            / f"{repo.name}-{hashlib.sha256(str(repo.resolve()).encode()).hexdigest()[:8]}.md"
        )
        if fp in blocked or blocks >= MAX_BLOCKS:
            seen.append(fp)
            notes.append(
                f"{repo.name}: open [P1] findings after {blocks} attempt(s); see {report}"
            )
            continue
        completed, review = run_review(repo, report)
        if not completed:
            seen.append(fp)
            notes.append(f"{repo.name}: review skipped ({review})")
            continue
        findings = p1_findings(review)
        if not findings:
            seen.append(fp)
            continue
        blocked.append(fp)
        listed = "\n".join(f"  - [P1] {item}" for item in findings[:8])
        problems.append(
            f"{repo} ({len(findings)} finding(s), report: {report}):\n{listed}"
        )
    if len(pending) > MAX_REPOS_PER_STOP:
        notes.append(
            f"{len(pending) - MAX_REPOS_PER_STOP} more changed repo(s) will be reviewed at the next stop"
        )
    if problems:
        state["blocks"] = blocks + 1

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state), encoding="utf-8")
    state_file.chmod(0o600)

    if problems:
        return {
            "decision": "block",
            "reason": (
                "Codex review found [P1] findings in uncommitted changes:\n"
                + "\n".join(problems)
                + "\nVerify each finding against the code, fix the confirmed ones, and explain any you dispute before finishing."
            ),
        }
    if notes:
        return {"systemMessage": "Codex review: " + "; ".join(notes)}
    return {}


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        output = gate(payload if isinstance(payload, dict) else {})
    except Exception as exc:  # noqa: BLE001 - a broken hook must never trap the session
        output = {
            "systemMessage": f"Codex review hook error: {type(exc).__name__}: {str(exc)[:200]}"
        }
    if output:
        print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
