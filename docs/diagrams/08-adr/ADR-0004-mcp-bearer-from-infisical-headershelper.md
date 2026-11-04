# ADR-0004 — Tool hub bearer comes from Infisical at connect time, never from a config file

- Status: accepted (retro-documented)

## Context
plugin ลงทะเบียน remote MCP `solo-empire` แต่ repo เป็น public จึงเก็บ token ในไฟล์ไม่ได้

## Decision
`.mcp.json` ใช้ `headersHelper` รัน `hooks/mcp_auth_header.py` ซึ่งเรียก `infisical secrets get` จาก folder `/mcp`, env `dev`
(project id จาก env `INFISICAL_PROJECT_ID` หรือ `~/.config/solo-empire/environment.sh`) แล้วพิมพ์ header JSON;
ถ้าไม่มี CLI / login / ค่า → พิมพ์ `{}` และ server ตอบ 401 (tool hub แค่ใช้ไม่ได้)

## Evidence
- .mcp.json, hooks/mcp_auth_header.py (docstring, `token`, `main`)
- README.md (Tool hub row)
- git log: 03e5b02 (PR #8)

## Consequences
- cloud sessions ต้องเพิ่ม server เองด้วย env header (docstring อ้าง remote MCP README)
- ไม่มี test ของ helper ใน tests/ (gap)
