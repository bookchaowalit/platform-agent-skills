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
            os.environ, {"UI_REVIEW_STATE_DIR": str(self.state), "UI_REVIEW_GATE": ""}
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
        decision = self.run_gate(
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
            self.run_gate("vercel --prod")["hookSpecificOutput"]["permissionDecision"],
            "deny",
        )

    def test_cd_prefix_is_followed(self) -> None:
        other = Path(self.tmp.name) / "elsewhere"
        other.mkdir()
        decision = self.run_gate(f"cd {self.repo} && vercel deploy --prod", cwd=other)
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
