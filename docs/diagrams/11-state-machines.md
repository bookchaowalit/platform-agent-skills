# 11 — State machines

ไม่มี entity ใน database; lifecycle ที่มีในโค้ดจริงคือสถานะของ commit ในมุมของ UI review gate, verdict ของ sign-off
และสถานะของ scenario ใน flow-video

## SM1 — Commit as seen by the UI review gate

```mermaid
stateDiagram-v2
    [*] --> NotGated: repo has no UI files
    [*] --> Unsigned: repo has UI files and commit changes UI
    Unsigned --> Signed: ui_signoff.py verdict pass or pass-with-notes
    Unsigned --> Failed: ui_signoff.py verdict fail
    Failed --> Signed: new review signs this sha
    Unsigned --> StatusSuccess: ui-review status success from another machine
    Signed --> Covered: later commit changes no UI files
    Covered --> Unsigned: later commit changes a UI file
    Signed --> [*]: gate allows ship
    Covered --> [*]: gate allows ship
    StatusSuccess --> [*]: gate allows ship
    NotGated --> [*]: gate allows ship
```

Sources: qa-testing/scripts/ui_review_evidence.py (`repo_has_ui`, `signed_shas` นับเฉพาะ `pass`/`pass-with-notes`, `covering_signoff`, `github_status`),
qa-testing/scripts/ui_review_gate.py, qa-testing/scripts/ui_signoff.py

หมายเหตุ: verdict `fail` เขียน evidence และ post status `failure` แต่ gate ไม่นับ (ไม่อยู่ใน `signed_shas`)

## SM2 — Gate decision per Bash command

```mermaid
stateDiagram-v2
    [*] --> Off: UI_REVIEW_GATE=off
    [*] --> Parse
    Parse --> Allow: tool not Bash/PowerShell or bad JSON
    Parse --> Inspect: per segment
    Inspect --> Inspect: cd changes cwd
    Inspect --> Deny: shipping command with unsigned UI
    Inspect --> Allow: no shipping command or signed
    Inspect --> Allow: exception, fail-open
    Off --> [*]
    Allow --> [*]
    Deny --> [*]
```

Sources: qa-testing/scripts/ui_review_gate.py (`main`)

## SM3 — flow-video scenario result

```mermaid
stateDiagram-v2
    [*] --> Running
    Running --> ok: all steps done
    Running --> blocked: error after a blocked navigation or form submit
    Running --> failed: other error or step failure
    ok --> [*]
    blocked --> [*]
    failed --> [*]
```

Sources: flow-video/scripts/flow_video.mjs (`status: error ? (blockedNav ? "blocked" : "failed") : "ok"`, line ~583; `status: "failed"` line ~699)

## Open questions

- ไม่มี
