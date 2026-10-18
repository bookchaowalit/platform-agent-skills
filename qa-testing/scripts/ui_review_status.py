#!/usr/bin/env python3
"""Mark a commit that changes no UI files as not needing a visual review.

When a branch rule requires the ``ui-review`` commit status, every pull request needs it,
including ones that only touch the API, docs or tests. This posts ``success`` with
"no UI changes" after checking that nothing between --base and the commit is a UI file;
otherwise it refuses and points at the review procedure.

    python3 ui_review_status.py --repo . --base origin/main [--sha HEAD]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ui_review_evidence import (
    git,
    post_status,
    repo_root,
    repo_slug,
    ui_changes_between,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--repo", default=".", help="product repository")
    parser.add_argument(
        "--base", default="origin/main", help="branch the change merges into"
    )
    parser.add_argument("--sha", default="HEAD", help="commit to mark (default: HEAD)")
    args = parser.parse_args(argv)

    root = repo_root(Path(args.repo).resolve())
    if root is None:
        print("ui_review_status: --repo is not a git repository", file=sys.stderr)
        return 2
    sha = git(root, "rev-parse", args.sha)
    base = git(root, "merge-base", args.base, sha)
    changed = ui_changes_between(root, base, sha)
    if changed:
        shown = ", ".join(changed[:5]) + (" …" if len(changed) > 5 else "")
        print(
            f"ui_review_status: UI files changed ({shown}); run ui_review.mjs and ui_signoff.py instead",
            file=sys.stderr,
        )
        return 1
    slug = repo_slug(root)
    if not post_status(slug, sha, "success", f"no UI changes since {args.base}"):
        print(
            "ui_review_status: could not post the GitHub status (gh access?)",
            file=sys.stderr,
        )
        return 1
    print(f"ui_review_status: ui-review=success (no UI changes) on {slug}@{sha[:7]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
