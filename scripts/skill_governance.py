#!/usr/bin/env python3
"""Validate the AI skill packages in this repository.

Checks every ``<skill>/SKILL.md`` package (frontmatter, size limits, ``agents/openai.yaml``),
the README inventory, and optionally:

* the agent router (``SOLO_ROUTER_PATH`` -> router.py of the harness repository); skipped when unset;
* the role coverage registry (``SOLO_ARCHITECTURE_ROOT`` or ``../solo-architecture``); skipped when absent.

No path leads back to the solo-empire registry repository.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NON_SKILL_DIRS = frozenset(
    {"scripts", "tests", "docs", "node_modules", "vendor", "hooks", "agents"}
)


MAX_SKILL_LINES = 500
MAX_SKILL_WORDS = 5_000
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
README_ENTRY_PATTERN = re.compile(r"^-\s+([a-z0-9]+(?:-[a-z0-9]+)*)\s+—", re.MULTILINE)
APPROVED_ROUTER_OVERLAPS = {
    "webhook": frozenset({"data-lake", "external-integrations"}),
}
ROLE_COVERAGE_PATH = Path(
    "docs/registries/ROLE-COVERAGE.yaml"
)  # inside the solo-architecture checkout


def relative(path: Path, project_root: Path = PROJECT_ROOT) -> str:
    return path.relative_to(project_root).as_posix()


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        raise ValueError("missing YAML frontmatter")
    closing = text.find("\n---\n", 4)
    if closing == -1:
        raise ValueError("frontmatter is not closed")
    try:
        loaded = yaml.safe_load(text[4:closing])
    except yaml.YAMLError as exc:
        raise ValueError(f"invalid frontmatter YAML: {exc}") from exc
    if not isinstance(loaded, dict):
        raise ValueError("frontmatter must be a mapping")  # noqa: TRY004 - callers catch ValueError for every frontmatter error
    return loaded, text[closing + 5 :]


def validate_skill_package(skill_dir: Path) -> tuple[dict[str, Any], list[str]]:
    """Return compact package metrics and deterministic validation errors."""
    errors: list[str] = []
    skill_file = skill_dir / "SKILL.md"
    summary: dict[str, Any] = {
        "name": skill_dir.name,
        "path": skill_file.as_posix(),
        "lines": 0,
        "words": 0,
        "estimated_tokens": 0,
        "has_openai_metadata": False,
    }
    if not skill_file.is_file():
        return summary, [f"{skill_dir.name}: missing SKILL.md"]

    text = skill_file.read_text(encoding="utf-8")
    summary["lines"] = len(text.splitlines())
    summary["words"] = len(text.split())
    summary["estimated_tokens"] = max(1, (len(text.encode("utf-8")) + 3) // 4)
    if summary["lines"] > MAX_SKILL_LINES:
        errors.append(
            f"{skill_dir.name}/SKILL.md: {summary['lines']} lines exceeds {MAX_SKILL_LINES}"
        )
    if summary["words"] > MAX_SKILL_WORDS:
        errors.append(
            f"{skill_dir.name}/SKILL.md: {summary['words']} words exceeds {MAX_SKILL_WORDS}"
        )

    try:
        frontmatter, body = _parse_frontmatter(text)
    except ValueError as exc:
        errors.append(f"{skill_dir.name}/SKILL.md: {exc}")
        frontmatter, body = {}, ""

    extra_fields = sorted(set(frontmatter) - {"name", "description"})
    if extra_fields:
        errors.append(
            f"{skill_dir.name}/SKILL.md: unsupported frontmatter fields: {', '.join(extra_fields)}"
        )
    name = frontmatter.get("name")
    description = frontmatter.get("description")
    if not isinstance(name, str) or not NAME_PATTERN.fullmatch(name):
        errors.append(f"{skill_dir.name}/SKILL.md: invalid or missing name")
    elif name != skill_dir.name:
        errors.append(f"{skill_dir.name}/SKILL.md: name {name!r} must match the folder")
    if not isinstance(description, str) or len(description.strip()) < 40:
        errors.append(
            f"{skill_dir.name}/SKILL.md: description must be at least 40 characters"
        )
    elif "TODO" in description:
        errors.append(f"{skill_dir.name}/SKILL.md: description still contains TODO")
    if body and not re.search(r"^#\s+\S", body, re.MULTILINE):
        errors.append(f"{skill_dir.name}/SKILL.md: missing H1 heading")

    metadata_file = skill_dir / "agents" / "openai.yaml"
    if not metadata_file.is_file():
        errors.append(f"{skill_dir.name}: missing agents/openai.yaml")
        return summary, errors
    summary["has_openai_metadata"] = True
    try:
        metadata = yaml.safe_load(metadata_file.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        errors.append(f"{skill_dir.name}/agents/openai.yaml: invalid YAML: {exc}")
        return summary, errors
    interface = metadata.get("interface") if isinstance(metadata, dict) else None
    if not isinstance(interface, dict):
        errors.append(f"{skill_dir.name}/agents/openai.yaml: missing interface mapping")
        return summary, errors
    for field in ("display_name", "short_description", "default_prompt"):
        if not isinstance(interface.get(field), str) or not interface[field].strip():
            errors.append(
                f"{skill_dir.name}/agents/openai.yaml: missing interface.{field}"
            )
    short_description = interface.get("short_description")
    if isinstance(short_description, str) and not 25 <= len(short_description) <= 64:
        errors.append(
            f"{skill_dir.name}/agents/openai.yaml: short_description must be 25-64 characters"
        )
    default_prompt = interface.get("default_prompt")
    if (
        isinstance(name, str)
        and isinstance(default_prompt, str)
        and f"${name}" not in default_prompt
    ):
        errors.append(
            f"{skill_dir.name}/agents/openai.yaml: default_prompt must mention ${name}"
        )
    return summary, errors


def _load_router(project_root: Path) -> ModuleType:
    """Load the router named by SOLO_ROUTER_PATH (the harness repository owns router.py)."""
    configured = os.environ.get("SOLO_ROUTER_PATH")
    if not configured:
        raise RuntimeError("SOLO_ROUTER_PATH is not set")
    router_path = Path(configured).expanduser()
    router_directory = str(router_path.parent)
    if router_directory not in sys.path:
        sys.path.insert(0, router_directory)
    spec = importlib.util.spec_from_file_location(
        "solo_empire_skill_router", router_path
    )
    if spec is None or spec.loader is None or not router_path.is_file():
        raise RuntimeError(f"unable to load agent router at {router_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _audit_router(
    project_root: Path, skill_names: set[str]
) -> tuple[dict[str, Any], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not os.environ.get("SOLO_ROUTER_PATH"):
        return {"skipped": "SOLO_ROUTER_PATH is not set"}, errors, warnings
    try:
        router = _load_router(project_root)
    except (OSError, RuntimeError, ImportError) as exc:
        return {}, [f"agent router could not be loaded: {exc}"], warnings

    routes = list(router.ROUTES) + [router.UNKNOWN_ROUTE]
    child_routes: dict[str, list[str]] = {}
    keyword_routes: dict[str, set[str]] = {}
    for route in routes:
        child_routes.setdefault(route.child_skill, []).append(route.name)
        if route.child_skill not in skill_names:
            errors.append(
                f"router route {route.name!r} references missing skill {route.child_skill!r}"
            )
        for context_file in route.context_files:
            if (
                context_file.startswith("skills/")
                and not (project_root / context_file[len("skills/") :]).is_file()
            ):
                errors.append(
                    f"router route {route.name!r} references missing context file {context_file}"
                )
        for keyword in route.keywords:
            keyword_routes.setdefault(keyword.casefold(), set()).add(route.name)

    overlaps = {
        keyword: sorted(names)
        for keyword, names in sorted(keyword_routes.items())
        if len(names) > 1
    }
    approved_overlaps: dict[str, list[str]] = {}
    unapproved_overlaps: dict[str, list[str]] = {}
    for keyword, names in overlaps.items():
        if APPROVED_ROUTER_OVERLAPS.get(keyword) == frozenset(names):
            approved_overlaps[keyword] = names
        else:
            unapproved_overlaps[keyword] = names
            warnings.append(
                f"router keyword {keyword!r} is shared by routes: {', '.join(names)}"
            )

    inspect_route = router.route_request("audit skill inventory")
    change_route = router.route_request("add missing skill")
    return (
        {
            "version": router.ROUTER_VERSION,
            "route_count": len(router.ROUTES),
            "child_skill_routes": child_routes,
            "approved_keyword_overlaps": approved_overlaps,
            "unapproved_keyword_overlaps": unapproved_overlaps,
            "policy_snapshot": {
                "inspect_token_budget": inspect_route["token_budget"],
                "inspect_max_context_files": inspect_route["max_context_files"],
                "change_token_budget": change_route["token_budget"],
                "change_max_context_files": change_route["max_context_files"],
            },
        },
        errors,
        warnings,
    )


def _audit_role_coverage(project_root: Path) -> tuple[dict[str, Any], list[str]]:
    """Expose declared role groups without skills as candidates, not failures."""
    errors: list[str] = []
    architecture = Path(
        os.environ.get("SOLO_ARCHITECTURE_ROOT")
        or project_root.parent / "solo-architecture"
    )
    registry_path = architecture / ROLE_COVERAGE_PATH
    if not registry_path.is_file():
        return {
            "skipped": f"solo-architecture checkout not found at {architecture}"
        }, []
    try:
        registry = yaml.safe_load(registry_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        return {}, [f"invalid role coverage registry YAML: {exc}"]
    role_groups = registry.get("role_groups") if isinstance(registry, dict) else None
    if not isinstance(role_groups, list):
        return {}, ["role coverage registry must contain role_groups"]

    mapped: list[dict[str, str]] = []
    candidate_gaps: list[dict[str, str]] = []
    for row in role_groups:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            errors.append("role coverage registry contains a row without an id")
            continue
        role_id = row["id"]
        skill_path = row.get("skill")
        if skill_path is None:
            candidate_gaps.append(
                {
                    "id": role_id,
                    "name": str(row.get("name", role_id)),
                    "maturity": str(row.get("maturity", "unknown")),
                    "owner_boundary": str(row.get("owner_boundary", "")),
                }
            )
            continue
        if not isinstance(skill_path, str) or not skill_path.startswith("skills/"):
            errors.append(f"role group {role_id!r} has an invalid skill path")
            continue
        if not (project_root / skill_path[len("skills/") :]).is_file():
            errors.append(
                f"role group {role_id!r} references missing skill {skill_path}"
            )
            continue
        mapped.append({"id": role_id, "skill": skill_path})

    return {
        "registry": ROLE_COVERAGE_PATH.as_posix(),
        "role_group_count": len(role_groups),
        "mapped_skill_count": len(mapped),
        "mapped": mapped,
        "candidate_skill_gaps": candidate_gaps,
    }, errors


def audit(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    skills_root = project_root
    errors: list[str] = []
    warnings: list[str] = []
    if not skills_root.is_dir():
        return {
            "contract": "solo-empire.skill-governance.v1",
            "status": "error",
            "errors": ["skills directory is missing"],
            "warnings": [],
            "skills": [],
        }

    skill_dirs = sorted(
        path
        for path in skills_root.iterdir()
        if path.is_dir()
        and not path.name.startswith(".")
        and path.name not in NON_SKILL_DIRS
    )
    skills: list[dict[str, Any]] = []
    for skill_dir in skill_dirs:
        summary, package_errors = validate_skill_package(skill_dir)
        try:
            summary["path"] = relative(skill_dir / "SKILL.md", project_root)
        except ValueError:
            pass
        skills.append(summary)
        errors.extend(package_errors)

    skill_names = {item["name"] for item in skills}
    readme_path = skills_root / "README.md"
    if not readme_path.is_file():
        errors.append("README.md is missing")
        readme_names: set[str] = set()
    else:
        readme_names = set(
            README_ENTRY_PATTERN.findall(readme_path.read_text(encoding="utf-8"))
        )
    for name in sorted(skill_names - readme_names):
        errors.append(f"README.md is missing inventory entry: {name}")
    for name in sorted(readme_names - skill_names):
        errors.append(f"README.md lists an unknown package: {name}")

    router, router_errors, router_warnings = _audit_router(project_root, skill_names)
    errors.extend(router_errors)
    warnings.extend(router_warnings)
    role_coverage, role_errors = _audit_role_coverage(project_root)
    errors.extend(role_errors)
    return {
        "contract": "solo-empire.skill-governance.v1",
        "status": "ok" if not errors else "error",
        "skill_count": len(skills),
        "total_estimated_tokens": sum(item["estimated_tokens"] for item in skills),
        "limits": {
            "max_skill_lines": MAX_SKILL_LINES,
            "max_skill_words": MAX_SKILL_WORDS,
        },
        "skills": skills,
        "readme_inventory": sorted(readme_names),
        "router": router,
        "role_coverage": role_coverage,
        "errors": errors,
        "warnings": warnings,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit Solo Empire AI skill packages")
    parser.add_argument(
        "--json", action="store_true", help="emit the complete audit as JSON"
    )
    parser.add_argument(
        "--strict", action="store_true", help="treat warnings as failures"
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    result = audit()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("=" * 70)
        print("Solo Empire — AI Skill Governance")
        print("=" * 70)
        for item in result["skills"]:
            print(
                f"  PASS: {item['name']} "
                f"({item['lines']} lines, ~{item['estimated_tokens']} tokens)"
            )
        for warning in result["warnings"]:
            print(f"  WARN: {warning}")
        for error in result["errors"]:
            print(f"  FAIL: {error}")
        print(
            f"Result: {result['status'].upper()} "
            f"({result.get('skill_count', 0)} skills, "
            f"{len(result['warnings'])} warnings, {len(result['errors'])} errors)"
        )
    return 1 if result["errors"] or (args.strict and result["warnings"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
