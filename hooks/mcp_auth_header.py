#!/usr/bin/env python3
"""headersHelper for the solo-empire tool hub: print the Authorization header as JSON.

The bearer comes from Infisical folder /mcp through the logged-in Infisical CLI and is never
written to a config file. Claude Code hides credential-like environment variables from
plugin helpers, and cloud sessions do not install plugins, so a cloud session adds the
server itself with a literal ${SOLO_MCP_REMOTE_TOKEN} header (see the remote MCP README).
Without the CLI or a login it prints {} and the server answers 401, so the tool hub simply
stays unavailable.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ENV_FILE = Path.home() / ".config" / "solo-empire" / "environment.sh"


def infisical_project() -> str | None:
    if os.environ.get("INFISICAL_PROJECT_ID"):
        return os.environ["INFISICAL_PROJECT_ID"]
    try:
        text = ENV_FILE.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"INFISICAL_PROJECT_ID=[\"']?([\w-]+)", text)
    return match.group(1) if match else None


def token() -> str | None:
    cli = shutil.which("infisical") or str(Path.home() / ".local" / "bin" / "infisical")
    project = infisical_project()
    if not project or not Path(cli).exists():
        return None
    try:
        result = subprocess.run(
            [
                cli,
                "secrets",
                "get",
                "SOLO_MCP_REMOTE_TOKEN",
                "--projectId",
                project,
                "--env",
                "dev",
                "--path",
                "/mcp",
                "--plain",
                "--silent",
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    value = result.stdout.strip()
    return value if result.returncode == 0 and value else None


def main() -> int:
    value = token()
    print(json.dumps({"Authorization": f"Bearer {value}"} if value else {}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
