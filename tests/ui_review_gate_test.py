"""Tests for the qa-testing UI review gate hook and sign-off evidence."""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1] / "qa-testing" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import ui_review_evidence
import ui_review_gate
import ui_signoff


def sh(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


class GateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.state = base / "state"
        self.repo = base / "web"
        self.repo.mkdir()
        sh(self.repo, "init", "-q", "-b", "main")
        sh(self.repo, "config", "user.email", "t@example.com")
        sh(self.repo, "config", "user.name", "t")
        sh(self.repo, "remote", "add", "origin", "https://github.com/acme/web.git")
        self.commit("src/page.tsx", "export const a = 1;\n")
        self.env = mock.patch.dict(
            os.environ,
            {
                "UI_REVIEW_STATE_DIR": str(self.state),
                "UI_REVIEW_GATE": "",
                # Never call the real GitHub API from tests.
                "UI_REVIEW_GITHUB_STATUS": "off",
            },
        )
        self.env.start()
        self.report = base / "report.json"
        self.report.write_text(
            json.dumps(
                {
                    "counts": {"blocker": 0, "major": 0, "minor": 0},
                    "pages": [
                        {"url": "https://x.test/a", "width": 375},
                        {"url": "https://x.test/a", "width": 1440},
                    ],
                }
            )
        )

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def commit(self, path: str, text: str) -> str:
        file = self.repo / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)
        sh(self.repo, "add", "-A")
        sh(self.repo, "commit", "-q", "-m", f"change {path}")
        return sh(self.repo, "rev-parse", "HEAD")

    def run_gate(self, command: str, cwd: Path | None = None) -> dict | None:
        payload = {
            "tool_name": "Bash",
            "tool_input": {"command": command},
            "cwd": str(cwd or self.repo),
        }
        out = io.StringIO()
        with (
            mock.patch("sys.stdin", io.StringIO(json.dumps(payload))),
            redirect_stdout(out),
        ):
            ui_review_gate.main()
        text = out.getvalue().strip()
        return json.loads(text) if text else None

    def decide(self, command: str, cwd: Path | None = None) -> dict:
        """run_gate for a command the gate must answer (deny or ask), not let through."""
        decision = self.run_gate(command, cwd)
        self.assertIsNotNone(decision, f"the gate let {command!r} through")
        assert decision is not None  # narrowed for mypy; assertIsNotNone already failed
        return decision

    def signoff(self, *extra: str) -> int:
        return ui_signoff.main(
            [
                "--repo",
                str(self.repo),
                "--report",
                str(self.report),
                "--reviewer",
                "test",
                "--verdict",
                "pass",
                "--notes",
                "looked at every slice",
                *extra,
            ]
        )

    def test_blocks_prod_deploy_without_signoff(self) -> None:
        decision = self.decide(
            "rm -f .env.local && npx -y vercel@latest deploy --prod --yes --scope s"
        )
        self.assertEqual(decision["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertIn(
            "acme/web", decision["hookSpecificOutput"]["permissionDecisionReason"]
        )

    def test_preview_deploy_and_other_commands_pass(self) -> None:
        self.assertIsNone(self.run_gate("vercel deploy --yes"))
        self.assertIsNone(self.run_gate("npm run build && git status"))

    def test_signoff_allows_and_survives_non_ui_commits(self) -> None:
        self.assertEqual(self.signoff(), 0)
        self.assertIsNone(self.run_gate("vercel --prod"))
        self.commit("src/lib/calc.ts", "export const b = 2;\n")
        self.commit("src/page.test.tsx", "test('x', () => {});\n")
        self.assertIsNone(self.run_gate("vercel --prod"))

    def test_ui_change_after_signoff_blocks_again(self) -> None:
        self.signoff()
        self.commit("src/app.css", ".a { color: red; }\n")
        self.assertEqual(
            self.decide("vercel --prod")["hookSpecificOutput"]["permissionDecision"],
            "deny",
        )

    def test_cd_prefix_is_followed(self) -> None:
        other = Path(self.tmp.name) / "elsewhere"
        other.mkdir()
        decision = self.decide(f"cd {self.repo} && vercel deploy --prod", cwd=other)
        self.assertEqual(decision["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_repo_without_ui_files_is_not_gated(self) -> None:
        api = Path(self.tmp.name) / "api"
        api.mkdir()
        sh(api, "init", "-q", "-b", "main")
        sh(api, "config", "user.email", "t@example.com")
        sh(api, "config", "user.name", "t")
        (api / "main.py").write_text("print(1)\n")
        sh(api, "add", "-A")
        sh(api, "commit", "-q", "-m", "api")
        self.assertIsNone(self.run_gate("vercel --prod", cwd=api))

    def test_off_switch(self) -> None:
        with mock.patch.dict(os.environ, {"UI_REVIEW_GATE": "off"}):
            self.assertIsNone(self.run_gate("vercel --prod"))

    def test_signoff_refuses_blockers_and_missing_widths(self) -> None:
        self.report.write_text(
            json.dumps(
                {
                    "counts": {"blocker": 1},
                    "pages": [{"url": "u", "width": 375}, {"url": "u", "width": 1440}],
                }
            )
        )
        self.assertEqual(self.signoff(), 1)
        self.assertEqual(self.signoff("--accept-blockers", "third-party widget"), 0)
        self.report.write_text(
            json.dumps(
                {"counts": {"blocker": 0}, "pages": [{"url": "u", "width": 375}]}
            )
        )
        self.assertEqual(self.signoff(), 1)

    def test_promote_baseline(self) -> None:
        shots = Path(self.tmp.name) / "shots"
        shots.mkdir()
        pages = []
        for width, slices in ((375, 2), (1440, 1)):
            files = []
            for index in range(slices):
                file = shots / f"x-{width}-{index:02d}.png"
                file.write_bytes(f"png {width} {index}".encode())
                files.append(str(file))
            pages.append(
                {
                    "url": "https://x.test/a",
                    "width": width,
                    "browser": "chromium",
                    "key": f"x-{width}",
                    "screenshots": files,
                }
            )
        self.report.write_text(json.dumps({"counts": {"blocker": 0}, "pages": pages}))
        baselines = ui_review_evidence.baseline_dir("acme/web")
        self.assertEqual(
            self.signoff("--verdict", "fail", "--promote-baseline"),
            1,
            "a failed review must not become the baseline",
        )
        self.assertFalse(baselines.exists())

        self.assertEqual(self.signoff("--promote-baseline"), 0)
        self.assertEqual(
            sorted(p.name for p in (baselines / "x-375").iterdir()),
            ["00.png", "01.png"],
        )
        manifest = json.loads((baselines / "manifest.json").read_text())
        self.assertEqual(manifest["x-375"]["slices"], 2)
        self.assertEqual(manifest["x-1440"]["sha"], sh(self.repo, "rev-parse", "HEAD"))
        evidence = json.loads(
            (
                ui_review_evidence.evidence_dir("acme/web")
                / f"{manifest['x-375']['sha']}.json"
            ).read_text()
        )
        self.assertEqual(sorted(evidence["baseline_promoted"]), ["x-1440", "x-375"])

        # A shorter page replaces the old slices instead of leaving a stale 01.png.
        # Paths relative to another working directory are found next to the report.
        moved = self.report.parent / "x-375-00.png"
        moved.write_bytes(b"png moved")
        pages[0]["screenshots"] = ["elsewhere/x-375-00.png"]
        self.report.write_text(json.dumps({"counts": {"blocker": 0}, "pages": pages}))
        self.assertEqual(self.signoff("--promote-baseline"), 0)
        self.assertEqual([p.name for p in (baselines / "x-375").iterdir()], ["00.png"])
        self.assertEqual((baselines / "x-375" / "00.png").read_bytes(), b"png moved")

    def test_github_status_counts_for_deploy(self) -> None:
        with mock.patch("ui_review_gate.github_status", return_value="success"):
            self.assertIsNone(self.run_gate("vercel --prod"))
        with mock.patch("ui_review_gate.github_status", return_value="failure"):
            self.assertEqual(
                self.decide("vercel --prod")["hookSpecificOutput"][
                    "permissionDecision"
                ],
                "deny",
            )

    def test_signoff_posts_status_and_can_skip(self) -> None:
        with mock.patch("ui_signoff.post_status", return_value=True) as post:
            self.assertEqual(self.signoff(), 0)
            slug, _sha, state, _desc = post.call_args.args
            self.assertEqual((slug, state), ("acme/web", "success"))
        with mock.patch("ui_signoff.post_status") as post:
            self.assertEqual(self.signoff("--no-github-status"), 0)
            post.assert_not_called()

    def test_status_script_refuses_ui_changes_and_marks_others(self) -> None:
        import ui_review_status

        base = sh(self.repo, "rev-parse", "HEAD")
        self.commit("src/lib/calc.ts", "export const c = 3;\n")
        with mock.patch("ui_review_status.post_status", return_value=True) as post:
            self.assertEqual(
                ui_review_status.main(["--repo", str(self.repo), "--base", base]), 0
            )
            self.assertEqual(post.call_args.args[2], "success")
        self.commit("src/new.css", ".b { color: blue; }\n")
        with mock.patch("ui_review_status.post_status", return_value=True) as post:
            self.assertEqual(
                ui_review_status.main(["--repo", str(self.repo), "--base", base]), 1
            )
            post.assert_not_called()

    def use_bare_remote(self) -> None:
        bare = Path(self.tmp.name) / "remote" / "web.git"
        bare.parent.mkdir()
        subprocess.run(
            ["git", "init", "-q", "--bare", "-b", "main", str(bare)], check=True
        )
        sh(self.repo, "remote", "set-url", "origin", str(bare))
        sh(self.repo, "push", "-q", "-u", "origin", "main")
        sh(self.repo, "remote", "set-head", "origin", "main")

    def deny_reason(self, command: str, cwd: Path | None = None) -> str | None:
        decision = self.decide(command, cwd)
        return (
            decision["hookSpecificOutput"]["permissionDecisionReason"]
            if decision
            else None
        )

    def test_push_of_unsigned_ui_change_to_main_is_blocked(self) -> None:
        self.use_bare_remote()
        self.commit("src/app.css", ".a { color: red; }\n")
        for command in (
            "git push",
            "git push origin main",
            "git push -u origin HEAD:main",
            "git push --force-with-lease origin main",
        ):
            self.assertIn("ships UI changes", self.deny_reason(command) or "", command)

    def test_push_paths_that_pass(self) -> None:
        self.use_bare_remote()
        self.commit("src/lib/calc.ts", "export const c = 3;\n")
        self.assertIsNone(
            self.run_gate("git push origin main")
        )  # no UI change since the remote tip
        self.commit("src/app.css", ".a { color: red; }\n")
        self.assertIsNone(
            self.run_gate("git push origin main:feature/x")
        )  # not the default branch
        self.assertIsNone(self.run_gate("git push --dry-run origin main"))
        self.assertEqual(self.signoff(), 0)
        self.assertIsNone(self.run_gate("git push origin main"))  # signed off

    def test_push_with_dash_c_from_elsewhere(self) -> None:
        self.use_bare_remote()
        self.commit("src/app.css", ".a { color: red; }\n")
        other = Path(self.tmp.name) / "elsewhere"
        other.mkdir()
        self.assertIn(
            "ships UI changes",
            self.deny_reason(f"git -C {self.repo} push origin main", cwd=other) or "",
        )
        self.assertIn(
            "ships UI changes",
            self.deny_reason(
                f"cd {self.repo} && git merge --ff-only x; git push", cwd=other
            )
            or "",
        )

    def test_merge_target_parsing(self) -> None:
        self.assertEqual(
            ui_review_gate.gh_merge_target(
                ["gh", "pr", "merge", "46", "--repo", "a/b", "--merge"]
            ),
            ("46", "a/b"),
        )
        self.assertEqual(
            ui_review_gate.gh_merge_target(["gh", "pr", "merge", "--squash", "feat/x"]),
            ("feat/x", None),
        )
        self.assertIsNone(ui_review_gate.gh_merge_target(["gh", "pr", "view", "1"]))

    def test_merge_without_ui_files_passes(self) -> None:
        view = mock.Mock(
            returncode=0,
            stdout=json.dumps(
                {"headRefOid": "abc", "number": 5, "files": [{"path": "app/api.py"}]}
            ),
        )
        with mock.patch("ui_review_gate.subprocess.run", return_value=view):
            self.assertIsNone(ui_review_gate.check_merge(self.repo, "5", "acme/web"))

    def test_ui_file_rules(self) -> None:
        self.assertTrue(ui_review_evidence.is_ui_file("src/components/card.tsx"))
        self.assertTrue(ui_review_evidence.is_ui_file("app/globals.css"))
        self.assertFalse(ui_review_evidence.is_ui_file("src/components/card.test.tsx"))
        self.assertFalse(ui_review_evidence.is_ui_file("e2e/flow.spec.ts"))
        self.assertFalse(ui_review_evidence.is_ui_file("src/domain/money.ts"))


if __name__ == "__main__":
    unittest.main()
