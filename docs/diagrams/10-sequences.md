# 10 — Sequences

## S1 — PreToolUse gate on `git push` to the default branch

```mermaid
sequenceDiagram
    participant A as Agent (Claude Code)
    participant H as hooks.json PreToolUse Bash
    participant G as ui_review_gate.py
    participant Git as git
    participant E as ui_review_evidence
    participant GH as GitHub API (gh)
    A->>H: Bash tool call with command
    H->>G: hook JSON on stdin
    G->>G: UI_REVIEW_GATE=off? then exit 0
    G->>G: segments(command), follow cd
    G->>Git: rev-parse root, ls-files
    G->>E: repo_has_ui(root)
    alt no UI files in repo
        G-->>A: no output, command runs
    else UI repo
        G->>Git: default_branch, rev-parse src, remote tip
        G->>E: ui_changes_between(remote tip, sha)
        alt no UI changes or not the default branch
            G-->>A: allow
        else UI changes
            G->>E: covering_signoff(root, slug, sha)
            G->>GH: GET repos/slug/commits/sha/statuses
            alt signed or status success
                G-->>A: allow
            else unsigned
                G-->>A: permissionDecision deny + HOW_TO
            end
        end
    end
    Note over G: any exception -> stderr "ui_review_gate: skipped", allow
```

Sources: hooks/hooks.json, qa-testing/scripts/ui_review_gate.py (`main`, `git_push_target`, `check_push`, `default_branch`), qa-testing/scripts/ui_review_evidence.py

## S2 — Capture, review and sign off

```mermaid
sequenceDiagram
    participant R as Reviewer
    participant UR as ui_review.mjs
    participant PW as Playwright browser
    participant App as Product web app
    participant SO as ui_signoff.py
    participant FS as State dir
    participant GH as GitHub API
    R->>UR: --url pages --widths --out dir
    UR->>PW: launch per browser and device
    PW->>App: load page
    UR->>PW: expand inner scroller, audit rules, slice screenshots
    UR->>FS: optional baseline read (--baseline)
    UR-->>R: report.json, report.md, slices
    R->>R: look at every slice
    R->>SO: --report --reviewer --verdict --notes
    SO->>SO: refuse blockers or missing 375 + 1280/1440 widths
    SO->>FS: write owner__repo/sha.json, optional promote baseline
    SO->>GH: POST repos/slug/statuses/sha context ui-review
    SO-->>R: printed result
```

Sources: qa-testing/scripts/ui_review.mjs, qa-testing/scripts/ui_signoff.py, qa-testing/scripts/ui_review_evidence.py, qa-testing/scripts/ui_visual_diff.mjs

## S3 — Tool hub MCP connect

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant HH as mcp_auth_header.py
    participant IC as Infisical CLI
    participant W as solo-empire-mcp-remote Worker
    CC->>HH: run headersHelper
    HH->>HH: project id from INFISICAL_PROJECT_ID or environment.sh
    HH->>IC: secrets get SOLO_MCP_REMOTE_TOKEN --env dev --path /mcp --plain
    alt value returned
        HH-->>CC: {"Authorization": "Bearer ..."}
    else CLI missing, no login, error
        HH-->>CC: {}
    end
    CC->>W: POST /mcp with headers
    W-->>CC: tools or 401
```

Sources: .mcp.json, hooks/mcp_auth_header.py. พฤติกรรม 401 ของ Worker อ้างจาก docstring ของ helper; โค้ด Worker อยู่ใน repo platform-mcp-remote-worker

## S4 — CI on push to main

```mermaid
sequenceDiagram
    participant Dev as Owner
    participant GH as GitHub
    participant CP as ci-python python job
    participant SEC as security jobs
    Dev->>GH: push main
    GH->>CP: skills (reusable ci-python @87dc5e1c)
    GH->>SEC: security (reusable security @87dc5e1c)
    CP->>CP: checkout, setup uv, uv sync --frozen --all-extras
    CP->>CP: ruff check + format --check, mypy, test-command
    SEC->>SEC: gitleaks, semgrep, osv-scanner, trivy-fs in parallel
    GH-->>Dev: run conclusion
    Note over GH: no deploy job, plugin installs follow main on update
```

Sources: .github/workflows/ci.yml, platform-ci-workflows@87dc5e1c .github/workflows/ci-python.yml and security.yml

## Open questions

- ไม่มี
