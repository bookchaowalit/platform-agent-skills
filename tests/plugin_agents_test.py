#!/usr/bin/env python3
"""Tests for the plugin sub-agents in agents/ (loaded by Claude Code as solo:<name>)."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
AGENTS_DIR = REPO_ROOT / "agents"
EXPECTED = {
    "solo-data",
    "solo-debugger",
    "solo-explorer",
    "solo-implementer",
    "solo-researcher",
    "solo-reviewer",
    "solo-security",
    "solo-social-intel",
    "solo-ui-verifier",
}
# Claude Code ignores these fields in plugin agents, so a role must not rely on them.
PLUGIN_IGNORED_FIELDS = {"hooks", "mcpServers", "permissionMode", "initialPrompt"}
# Write-capable tools; a read-only role must not be granted them.
WRITE_TOOLS = {"Edit", "Write", "NotebookEdit"}
PLUGIN_PATH = re.compile(r"\$\{CLAUDE_PLUGIN_ROOT\}/([A-Za-z0-9_./-]+)")


def parse(path: Path) -> tuple[dict[str, object], str]:
    match = re.match(
        r"^---\n(.*?)\n---\n(.*)$", path.read_text(encoding="utf-8"), re.DOTALL
    )
    if not match:
        raise AssertionError(f"{path.name}: missing frontmatter")
    fields: dict[str, object] = {}
    current = ""
    for line in match.group(1).splitlines():
        if line.startswith("  - ") and current:
            fields.setdefault(current, [])
            fields[current].append(line[4:].strip())  # type: ignore[union-attr]
            continue
        key, _, value = line.partition(":")
        current = key.strip()
        fields[current] = value.strip().strip('"') if value.strip() else []
    return fields, match.group(2)


class PluginAgentsTest(unittest.TestCase):
    def test_every_role_ships(self):
        self.assertEqual({p.stem for p in AGENTS_DIR.glob("*.md")}, EXPECTED)

    def test_frontmatter_is_plugin_safe(self):
        for path in sorted(AGENTS_DIR.glob("*.md")):
            with self.subTest(agent=path.stem):
                fields, body = parse(path)
                self.assertEqual(fields.get("name"), path.stem)
                self.assertTrue(fields.get("description"))
                self.assertTrue(fields.get("tools"))
                self.assertNotIn("Agent", str(fields["tools"]).split(", "))
                self.assertFalse(PLUGIN_IGNORED_FIELDS & fields.keys())
                for skill in fields.get("skills", []):  # type: ignore[union-attr]
                    self.assertTrue(
                        (REPO_ROOT / skill / "SKILL.md").is_file()
                        or (REPO_ROOT / "vendor" / skill / "SKILL.md").is_file(),
                        f"unknown skill {skill}",
                    )
                self.assertIn("Never spawn child agents", body)
                self.assertIn(
                    f"`role` set to `{path.stem.removeprefix('solo-')}`", body
                )

    def test_read_only_roles_cannot_write(self):
        writers = {"solo-debugger", "solo-implementer"}
        for path in sorted(AGENTS_DIR.glob("*.md")):
            if path.stem in writers:
                continue
            with self.subTest(agent=path.stem):
                tools = set(str(parse(path)[0]["tools"]).split(", "))
                self.assertFalse(tools & WRITE_TOOLS)

    def test_no_hub_only_references(self):
        for path in sorted(AGENTS_DIR.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            with self.subTest(agent=path.stem):
                # Hub-relative skill paths do not exist outside solo-empire; use ${CLAUDE_PLUGIN_ROOT}.
                self.assertNotRegex(text, r"`skills/[a-z-]+/")
                self.assertNotIn("apply_patch", text)
                self.assertNotRegex(text, r"/home/|~/|infra/scripts")
                for rel in PLUGIN_PATH.findall(text):
                    self.assertTrue((REPO_ROOT / rel).exists(), f"missing {rel}")


if __name__ == "__main__":
    unittest.main()
