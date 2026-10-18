#!/usr/bin/env python3
"""Record that a person or agent looked at the rendered pages and signs off the UI.

Run it after ui_review.mjs and after reading every screenshot slice:

    python3 ui_signoff.py --repo . --report ui-review/report.json \
        --reviewer claude --verdict pass \
        --notes "Reviewed /a and /b at 320–1440; no crowding, figures shown once"

It refuses when the report still has blocker findings, unless --accept-blockers gives
a reason (for example, a known third-party widget). Evidence is written outside the
repository (see ui_review_evidence.py), keyed by the commit you reviewed.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ui_review_evidence import git, repo_root, repo_slug, write_evidence  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default=".", help="product repository that was reviewed")
    parser.add_argument("--sha", help="commit that was reviewed (default: HEAD)")
    parser.add_argument("--report", required=True, help="report.json from ui_review.mjs")
    parser.add_argument("--reviewer", required=True, help="who looked at the screenshots")
    parser.add_argument("--verdict", required=True, choices=["pass", "pass-with-notes", "fail"])
    parser.add_argument("--notes", required=True, help="what was reviewed and what is still open")
    parser.add_argument("--accept-blockers", default="", help="reason to sign off despite blocker findings")
    args = parser.parse_args(argv)

    root = repo_root(Path(args.repo).resolve())
    if root is None:
        print("ui_signoff: --repo is not a git repository", file=sys.stderr)
        return 2
    report_path = Path(args.report).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    counts = report.get("counts", {})
    if args.verdict != "fail" and counts.get("blocker", 0) and not args.accept_blockers:
        print(f"ui_signoff: report has {counts['blocker']} blocker finding(s); fix them or pass --accept-blockers with a reason", file=sys.stderr)
        return 1
    widths = sorted({page["width"] for page in report.get("pages", [])})
    if args.verdict != "fail" and not ({375, 1440} <= set(widths) or {375, 1280} <= set(widths)):
        print(f"ui_signoff: report covers widths {widths}; include at least a phone (375) and a desktop (1280/1440) width", file=sys.stderr)
        return 1

    sha = git(root, "rev-parse", args.sha or "HEAD")
    slug = repo_slug(root)
    record = {
        "repo": slug,
        "sha": sha,
        "verdict": args.verdict,
        "reviewer": args.reviewer,
        "notes": args.notes,
        "accepted_blockers": args.accept_blockers or None,
        "urls": sorted({page["url"] for page in report.get("pages", [])}),
        "widths": widths,
        "counts": counts,
        "report": str(report_path),
        "signed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    path = write_evidence(slug, sha, record)
    print(f"ui_signoff: {args.verdict} for {slug}@{sha[:7]} → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
