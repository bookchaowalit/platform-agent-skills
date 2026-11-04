# 09 — ERD (file-based data)

ไม่มี database. ข้อมูลที่ persist คือ **ไฟล์**: (1) package metadata ใน repo, (2) evidence/baselines ที่ scripts เขียนนอก repo
ใน state dir, (3) GitHub commit status. ERD ด้านล่างแสดงโครงสร้างจริงของไฟล์เหล่านี้ (field จากโค้ดที่เขียน/อ่าน)

```mermaid
erDiagram
    SKILL_PACKAGE ||--|| OPENAI_METADATA : "agents/openai.yaml"
    SKILL_PACKAGE {
        string folder "lowercase-hyphen, equals name"
        string name "frontmatter"
        string description "frontmatter, at least 40 chars, no TODO"
        int lines "max 500"
        int words "max 5000"
    }
    OPENAI_METADATA {
        string display_name
        string short_description "25-64 chars"
        string default_prompt "mentions $name"
    }
    README_INVENTORY ||--o{ SKILL_PACKAGE : "lists"
    README_INVENTORY {
        string entry "- name — description"
    }
    SUB_AGENT {
        string name "solo-role, equals file stem"
        string description
        string tools
        string model
        string effort
        list skills
    }
    REPO_STATE ||--o{ SIGNOFF_EVIDENCE : "owner__repo/sha.json"
    REPO_STATE ||--o| BASELINE_MANIFEST : "owner__repo/baselines/manifest.json"
    REPO_STATE {
        string slug "owner/name from origin remote"
    }
    SIGNOFF_EVIDENCE {
        string repo
        string sha PK
        string verdict "pass, pass-with-notes, fail"
        string reviewer
        string notes
        string accepted_blockers
        list urls
        list widths
        json counts
        string report "path to report.json"
        string signed_at
        list baseline_promoted
    }
    BASELINE_MANIFEST ||--o{ BASELINE_CAPTURE : "key"
    BASELINE_CAPTURE {
        string key PK "URL x browser x width or device"
        string url
        string browser
        int width
        string device
        int slices "files NN.png"
        string sha
        string promoted_at
    }
    UI_REVIEW_REPORT ||--o{ REPORT_PAGE : "pages"
    UI_REVIEW_REPORT {
        json counts "blocker, major, minor"
        list skipped
    }
    REPORT_PAGE ||--o{ FINDING : "findings"
    REPORT_PAGE {
        string key
        string url
        string browser
        int width
        string device
        list screenshots
    }
    FINDING {
        string severity "blocker, major, minor"
        string rule
        string detail
        string where
    }
    COMMIT_STATUS {
        string context "ui-review"
        string state "success or failure"
        string description "max 139 chars"
    }
    SIGNOFF_EVIDENCE ||--o| COMMIT_STATUS : "posted unless --no-github-status"
```

Sources: scripts/skill_governance.py, scripts/check_skills.py, agents/*.md, tests/plugin_agents_test.py,
qa-testing/scripts/ui_review_evidence.py (`write_evidence`, `promote_baseline`, `post_status`), qa-testing/scripts/ui_signoff.py (`record`),
qa-testing/scripts/ui_review.mjs (`add`, report.json write), qa-testing/scripts/ui_visual_diff.mjs

ไฟล์อื่นที่ scripts เขียน (output ไม่ใช่ state ถาวร): `ui_states.mjs` → `states.json` + `report.md`; `flow_video.mjs` → `manifest.json`
(app, baseUrl, recordedAt, readOnly, results[] ที่มี status `ok`/`blocked`/`failed`), `page-map.md`, `index.html`, `<id>.webm/.vtt`;
`ui_login.mjs` → storage state (session cookies, mode 0600, default `~/.local/state/ui-review/sessions/`)

## Open questions

- evidence/baselines ใน state dir ควรมีอายุเก็บ (retention) หรือไม่? โค้ดไม่ลบเอง
