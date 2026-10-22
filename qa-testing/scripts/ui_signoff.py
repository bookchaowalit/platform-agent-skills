#!/usr/bin/env python3
"""Record that a person or agent looked at the rendered pages and signs off the UI.

Run it after ui_review.mjs and after reading every screenshot slice:

    python3 ui_signoff.py --repo . --report ui-review/report.json \
        --reviewer claude --verdict pass \
        --notes "Reviewed /a and /b at 320-1440; no crowding, figures shown once"

It refuses when the report still has blocker findings, unless --accept-blockers gives
a reason (for example, a known third-party widget). Evidence is written outside the
repository (see ui_review_evidence.py), keyed by the commit you reviewed.

It also posts the commit status ``ui-review`` (success, or failure for a fail verdict) to
GitHub so the pull request shows it and a branch rule can require it; pass
--no-github-status to skip. For a change that touches no UI files, use
ui_review_status.py instead of a review.

With --promote-baseline (only for a pass verdict) the reviewed slices become the new
approved baseline that ``ui_review.mjs --baseline <repo>`` compares later captures with.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ui_review_evidence import (
    baseline_dir,
    git,
    post_status,
    promote_baseline,
    repo_root,
    repo_slug,
    write_evidence,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--repo", default=".", help="product repository that was reviewed"
    )
    parser.add_argument("--sha", help="commit that was reviewed (default: HEAD)")
    parser.add_argument(
        "--report", required=True, help="report.json from ui_review.mjs"
    )
    parser.add_argument(
        "--reviewer", required=True, help="who looked at the screenshots"
    )
    parser.add_argument(
        "--verdict", required=True, choices=["pass", "pass-with-notes", "fail"]
    )
    parser.add_argument(
        "--notes", required=True, help="what was reviewed and what is still open"
    )
    parser.add_argument(
        "--accept-blockers",
        default="",
        help="reason to sign off despite blocker findings",
    )
    parser.add_argument(
        "--promote-baseline",
        action="store_true",
        help="make the reviewed screenshots the approved visual baseline",
    )
    parser.add_argument(
        "--no-github-status",
        action="store_true",
        help="do not post the ui-review commit status to GitHub",
    )
    parser.add_argument(
        "--baseline-dir",
        help="baseline folder (default: <state dir>/<owner>__<repo>/baselines)",
    )
    args = parser.parse_args(argv)
    if args.promote_baseline and args.verdict == "fail":
        print("ui_signoff: a failed review cannot become the baseline", file=sys.stderr)
        return 1

    root = repo_root(Path(args.repo).resolve())
    if root is None:
        print("ui_signoff: --repo is not a git repository", file=sys.stderr)
        return 2
    report_path = Path(args.report).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    counts = report.get("counts", {})
    if args.verdict != "fail" and counts.get("blocker", 0) and not args.accept_blockers:
        print(
            f"ui_signoff: report has {counts['blocker']} blocker finding(s); fix them or pass --accept-blockers with a reason",
            file=sys.stderr,
        )
        return 1
    widths = sorted({page["width"] for page in report.get("pages", [])})
    if args.verdict != "fail" and not (
        {375, 1440} <= set(widths) or {375, 1280} <= set(widths)
    ):
        print(
            f"ui_signoff: report covers widths {widths}; include at least a phone (375) and a desktop (1280/1440) width",
            file=sys.stderr,
        )
        return 1

    sha = git(root, "rev-parse", args.sha or "HEAD")
    slug = repo_slug(root)
    signed_at = datetime.now(UTC).isoformat(timespec="seconds")
    promoted: list[str] = []
    if args.promote_baseline:
        folder = Path(args.baseline_dir) if args.baseline_dir else baseline_dir(slug)
        promoted = promote_baseline(folder, report, sha, signed_at, report_path.parent)
        if not promoted:
            print(
                "ui_signoff: --promote-baseline found no screenshots in the report",
                file=sys.stderr,
            )
            return 1
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
        "signed_at": signed_at,
        "baseline_promoted": promoted or None,
    }
    path = write_evidence(slug, sha, record)
    print(f"ui_signoff: {args.verdict} for {slug}@{sha[:7]} → {path}")
    if not args.no_github_status:
        state = "failure" if args.verdict == "fail" else "success"
        summary = f"{args.verdict} by {args.reviewer}: {counts.get('blocker', 0)} blocker, {counts.get('major', 0)} major, widths {','.join(map(str, widths))}"
        if post_status(slug, sha, state, summary):
            print(f"ui_signoff: posted GitHub status ui-review={state} on {sha[:7]}")
        else:
            print(
                "ui_signoff: GitHub status not posted (no gh access or not a GitHub repo)",
                file=sys.stderr,
            )
    if promoted:
        print(f"ui_signoff: promoted {len(promoted)} capture(s) to the visual baseline")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
