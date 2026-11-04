# 07 — C4 Component

## UI review gate + sign-off (qa-testing/scripts)

```mermaid
C4Component
    title Components: UI review gate and evidence
    Container_Boundary(qa, "qa-testing/scripts") {
        Component(gate, "ui_review_gate.main", "Python", "Reads hook JSON, splits command on && || ; |, follows cd")
        Component(detect, "is_vercel_prod / gh_merge_target / git_push_target", "Python", "Recognise shipping commands")
        Component(checks, "check_deploy / check_merge / check_push", "Python", "Decide deny or allow")
        Component(ev, "ui_review_evidence", "Python", "is_ui_file, repo_has_ui, covering_signoff, signed_shas, ui_changes_between")
        Component(ghs, "post_status / github_status", "Python", "Commit status context ui-review via gh api")
        Component(signoff, "ui_signoff.main", "Python", "Validates report, writes evidence, optional promote_baseline")
        Component(status, "ui_review_status.main", "Python", "Posts success when no UI files changed")
        Component(review, "ui_review.mjs", "Node", "Capture, slice, audit rules, report.json/md")
        Component(browsers, "ui_browsers.mjs", "Node", "--browser, --device, Playwright resolution")
        Component(diff, "ui_visual_diff.mjs", "Node", "Baseline diff in the browser canvas")
        Component(a11y, "ui_a11y_perf.mjs", "Node", "axe-core findings, --perf mobile vitals")
        Component(login, "ui_login.mjs", "Node", "Saves storage state 0600")
    }
    Rel(gate, detect, "per segment")
    Rel(detect, checks, "target")
    Rel(checks, ev, "covering_signoff")
    Rel(checks, ghs, "github_status")
    Rel(signoff, ev, "write_evidence, promote_baseline")
    Rel(signoff, ghs, "post_status")
    Rel(status, ev, "ui_changes_between")
    Rel(status, ghs, "post_status")
    Rel(review, browsers, "imports")
    Rel(review, diff, "--baseline")
    Rel(review, a11y, "axe + --perf")
    Rel(login, review, "--storage-state file")
```

Sources: qa-testing/scripts/ui_review_gate.py, qa-testing/scripts/ui_review_evidence.py, qa-testing/scripts/ui_signoff.py,
qa-testing/scripts/ui_review_status.py, qa-testing/scripts/ui_review.mjs, qa-testing/scripts/ui_browsers.mjs,
qa-testing/scripts/ui_visual_diff.mjs, qa-testing/scripts/ui_a11y_perf.mjs, qa-testing/scripts/ui_login.mjs

## Governance validators (scripts/)

```mermaid
C4Component
    title Components: skill governance
    Container_Boundary(gov, "scripts/") {
        Component(cs, "check_skills.check", "Python", "Glob */SKILL.md, name and description")
        Component(vp, "validate_skill_package", "Python", "Frontmatter YAML, limits 500 lines / 5000 words, openai.yaml interface")
        Component(ar, "_audit_router", "Python", "Only when SOLO_ROUTER_PATH is set")
        Component(rc, "_audit_role_coverage", "Python", "SOLO_ARCHITECTURE_ROOT or ../solo-architecture")
        Component(au, "audit", "Python", "README inventory diff, contract solo-empire.skill-governance.v1")
    }
    Rel(au, vp, "each skill dir")
    Rel(au, ar, "optional")
    Rel(au, rc, "optional")
```

Sources: scripts/check_skills.py, scripts/skill_governance.py

ความคลาดเคลื่อน: README บอกว่า `SOLO_ARCHITECTURE_ROOT` default `../architecture-docs` แต่โค้ด default คือ `project_root.parent / "solo-architecture"`

## Open questions

- default ไหนถูก (`../architecture-docs` ใน README หรือ `../solo-architecture` ในโค้ด)?
