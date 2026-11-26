#!/usr/bin/env python3
"""Tests for the skill governance audit (standalone: no registry hub required)."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from skill_governance import architecture_root, audit, validate_skill_package


class SkillGovernanceTest(unittest.TestCase):
    def test_tool_selection_policy_is_capability_first_and_context_bounded(self):
        skill = (REPO_ROOT / "ai-agent-workflows" / "SKILL.md").read_text(
            encoding="utf-8"
        )
        section_heading = "## Tool selection and context efficiency"
        self.assertIn(section_heading, skill)
        start = skill.index(section_heading)
        end = skill.index("## Core workflow", start)
        policy = " ".join(skill[start:end].lower().split())
        for required_rule in (
            "choose one best interface",
            "do not call each available interface in sequence",
            "for solo empire local data",
            "structured output",
            "purpose-built mcp/api",
            "tool order is a tie-breaker only",
            "web search",
            "browser ui",
            "signed-in or site-specific",
            "context tokens",
            "full page trees",
            "does not guarantee lower provider billing",
        ):
            with self.subTest(rule=required_rule):
                self.assertIn(required_rule, policy)
        agent_skill = (REPO_ROOT / "ai-agents" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("skills/ai-agent-workflows/SKILL.md", agent_skill)

    def test_repository_skill_system_passes(self):
        result = audit()
        self.assertEqual(result["status"], "ok", result["errors"])
        self.assertGreaterEqual(result["skill_count"], 13)
        self.assertEqual(result["warnings"], [])

    def test_role_coverage_candidates_when_architecture_is_present(self):
        architecture = architecture_root(REPO_ROOT)
        if not (architecture / "docs/registries/ROLE-COVERAGE.yaml").is_file():
            self.skipTest("architecture documents not present")
        result = audit()
        self.assertEqual(
            {item["id"] for item in result["role_coverage"]["candidate_skill_gaps"]},
            {"engagement-delivery", "operations-platform", "finance-and-legal"},
        )

    def test_router_audit_is_skipped_without_router_path(self):
        old = os.environ.pop("SOLO_ROUTER_PATH", None)
        try:
            self.assertIn("skipped", audit()["router"])
        finally:
            if old is not None:
                os.environ["SOLO_ROUTER_PATH"] = old

    def test_package_validator_rejects_missing_metadata_and_large_body(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            skill_dir = Path(temp_dir) / "oversized-skill"
            skill_dir.mkdir()
            body = "\n".join("instruction" for _ in range(501))
            (skill_dir / "SKILL.md").write_text(
                "---\n"
                "name: oversized-skill\n"
                "description: Validate that an oversized test package is rejected safely.\n"
                "---\n"
                "# Oversized Skill\n"
                f"{body}\n",
                encoding="utf-8",
            )
            _summary, errors = validate_skill_package(skill_dir)
            self.assertTrue(any("exceeds 500" in error for error in errors))
            self.assertTrue(
                any("missing agents/openai.yaml" in error for error in errors)
            )


if __name__ == "__main__":
    unittest.main()
