"""Shared helpers for UI review sign-off evidence.

Evidence is one JSON file per reviewed commit, kept outside the product repository:
``$UI_REVIEW_STATE_DIR/<owner>__<repo>/<sha>.json`` (default
``~/.local/state/ui-review``). The gate allows a production deploy or PR merge when the
commit being shipped, or an ancestor with no UI changes after it, has a sign-off.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

UI_SUFFIXES = (".tsx", ".jsx", ".vue", ".svelte", ".astro", ".css", ".scss", ".sass", ".less", ".html", ".mdx")
NOT_UI = re.compile(r"(\.test\.|\.spec\.|\.stories\.|(^|/)(tests?|__tests__|e2e|stories)/)")


def state_dir() -> Path:
    return Path(os.environ.get("UI_REVIEW_STATE_DIR") or Path.home() / ".local" / "state" / "ui-review")


def is_ui_file(path: str) -> bool:
    return path.endswith(UI_SUFFIXES) and not NOT_UI.search(path)


def git(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=30)
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def repo_root(path: Path) -> Path | None:
    try:
        return Path(git(path, "rev-parse", "--show-toplevel"))
    except (RuntimeError, OSError, subprocess.TimeoutExpired):
        return None


def repo_slug(repo: Path) -> str:
    """owner/name from the origin remote, or the folder name when there is none."""
    url = git(repo, "remote", "get-url", "origin", check=False)
    match = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?$", url)
    return f"{match.group(1)}/{match.group(2)}" if match else repo.name


def evidence_dir(slug: str) -> Path:
    return state_dir() / slug.replace("/", "__")


def write_evidence(slug: str, sha: str, record: dict[str, Any]) -> Path:
    folder = evidence_dir(slug)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{sha}.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def signed_shas(slug: str) -> list[str]:
    folder = evidence_dir(slug)
    if not folder.is_dir():
        return []
    shas = []
    for file in folder.glob("*.json"):
        try:
            if json.loads(file.read_text(encoding="utf-8")).get("verdict") in {"pass", "pass-with-notes"}:
                shas.append(file.stem)
        except (OSError, ValueError):
            continue
    return shas


def ui_changes_between(repo: Path, base: str, head: str) -> list[str]:
    names = git(repo, "diff", "--name-only", f"{base}..{head}").splitlines()
    return [name for name in names if is_ui_file(name)]


def covering_signoff(repo: Path, slug: str, head: str) -> str | None:
    """A signed sha that is head itself, or an ancestor of head with no UI change after it."""
    for sha in signed_shas(slug):
        if sha == head:
            return sha
        ancestor = subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", sha, head], capture_output=True, timeout=30)
        if ancestor.returncode == 0:
            try:
                if not ui_changes_between(repo, sha, head):
                    return sha
            except RuntimeError:
                continue
    return None


def repo_has_ui(repo: Path) -> bool:
    return any(is_ui_file(name) for name in git(repo, "ls-files").splitlines())
