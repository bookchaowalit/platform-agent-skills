// flow_video.mjs records a role tour and a scripted use case against a local two-role app.
// Checks: menu discovery per role, refused pages in the page map, write requests blocked in
// read-only mode, captions/frames/gallery written, and a failing step reported as failed.
// Skips (exit 0) when Playwright is not installed, e.g. on CI without browsers.
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
try {
  createRequire(import.meta.url).resolve(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch {
  console.log("flow_video fixture test: skipped (Playwright not installed; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}

const writes = [];
const menu = () => `<nav><a href="/dashboard">แดชบอร์ด</a><a href="/orders">ใบสั่งงาน</a><a href="/settings">ตั้งค่า</a><a href="/logout">ออกจากระบบ</a><a href="https://elsewhere.example/">ลิงก์นอก</a></nav>`;
const page = (role, body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Fixture</title></head><body style="font-family:sans-serif;margin:0;display:flex">
<aside style="width:200px;padding:16px;background:#eef">${menu()}</aside><main style="padding:24px;flex:1">${body}</main>
<style>nav a{display:block;padding:10px 0}</style></body></html>`;
const server = createServer((req, res) => {
  const role = /role=(\w+)/.exec(req.headers.cookie || "")?.[1] || "";
  const send = (code, html) => { res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); };
  if (req.method !== "GET") { writes.push(`${req.method} ${req.url}`); return send(200, "saved"); }
  if (req.url === "/login") return send(200, '<h1>เข้าสู่ระบบ</h1><input type="password">');
  if (!role) { res.writeHead(302, { Location: "/login" }); return res.end(); }
  if (req.url === "/dashboard") return send(200, page(role, `<h1>แดชบอร์ด</h1>${"<p>งานวันนี้ 12 รายการ</p>".repeat(40)}`));
  if (req.url === "/orders") return send(200, page(role, `<h1>ใบสั่งงาน</h1><form method="post" action="/orders"><label>ลูกค้า <input name="customer"></label><button type="submit">บันทึก</button></form>`));
  if (req.url === "/settings") return send(200, page(role, role === "admin" ? "<h1>ตั้งค่า</h1>" : "<h1>ไม่มีสิทธิ์เข้าหน้านี้</h1>"));
  return send(404, "<h1>ไม่พบหน้า</h1>");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "flow-video-"));
const state = (role, cookie = "role") => {
  const file = join(work, `${role}.json`);
  writeFileSync(file, JSON.stringify({ cookies: [{ name: cookie, value: role, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] }));
  return file;
};
const spec = {
  app: "Fixture", baseUrl: base, viewport: { width: 1280, height: 800 },
  roles: { admin: { label: "ผู้ดูแล", storageState: state("admin") }, staff: { label: "พนักงาน", storageState: state("staff") },
    expired: { label: "หมดอายุ", storageState: state("expired", "stale") } },
  scenarios: [
    { id: "TOUR-staff", role: "staff", title: "พาชมทุกหน้าของพนักงาน", tour: { start: "/dashboard" } },
    { id: "UC-01", role: "admin", title: "บันทึกใบสั่งงาน", goal: "ผู้ดูแลสร้างใบสั่งงานใหม่", outcome: "ใบสั่งงานถูกบันทึก", refs: ["FR-01"],
      steps: [
        { say: "เปิดหน้าใบสั่งงาน", goto: "/orders" },
        { say: "กรอกชื่อลูกค้า", fill: "input[name=customer]", value: "บริษัท ตัวอย่าง" },
        { say: "กดบันทึก", click: "button[type=submit]" },
      ] },
    { id: "TOUR-expired", role: "expired", title: "session หมดอายุ", tour: { start: "/dashboard" } },
    { id: "UC-02", role: "admin", title: "ขั้นที่หาไม่เจอ", steps: [{ say: "เปิดแดชบอร์ด", goto: "/dashboard" }, { say: "กดปุ่มที่ไม่มี", click: "#missing" }] },
  ],
};
const specFile = join(work, "flows.json");
writeFileSync(specFile, JSON.stringify(spec));
const out = join(work, "out");
const script = join(here, "..", "flow-video", "scripts", "flow_video.mjs");
const run = (args) => new Promise((resolve) => {
  execFile("node", [script, ...args], { env: process.env, timeout: 240000 }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout: String(stdout), stderr: String(stderr) }));
});
const fail = (msg) => { throw new Error(msg); };
try {
  const r = await run(["--scenarios", specFile, "--out", out, "--slow", "0.3"]);
  if (r.code !== 1) fail(`expected exit 1 (UC-02 fails), got ${r.code}\n${r.stdout}${r.stderr}`);
  const m = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
  const byId = Object.fromEntries(m.results.map((x) => [x.id, x]));
  const tour = byId["TOUR-staff"];
  if (tour.status !== "ok") fail(`tour failed: ${tour.error}`);
  const paths = tour.pages.map((p) => p.path);
  if (paths.join(",") !== "/dashboard,/orders,/settings") fail(`tour pages wrong: ${paths}`);
  if (tour.pages.find((p) => p.path === "/settings").access !== "denied") fail("staff /settings should be denied");
  const uc = byId["UC-01"];
  if (uc.status !== "ok") fail(`UC-01 failed: ${uc.error}`);
  if (writes.length) fail(`read-only run let writes through: ${writes}`);
  if (!uc.blockedWrites.includes("POST /orders")) fail(`POST /orders not recorded as blocked: ${uc.blockedWrites}`);
  if (byId["TOUR-expired"].status !== "failed" || !/session has expired/.test(byId["TOUR-expired"].error)) fail(`expired session not caught: ${byId["TOUR-expired"].error}`);
  if (byId["UC-02"].status !== "failed" || !existsSync(join(out, "UC-02", "failed.png"))) fail("UC-02 should fail with failed.png");
  for (const id of ["TOUR-staff", "UC-01", "UC-02"]) {
    if (statSync(join(out, `${id}.webm`)).size < 10000) fail(`${id}.webm is too small`);
    if (!readFileSync(join(out, `${id}.vtt`), "utf8").startsWith("WEBVTT")) fail(`${id}.vtt invalid`);
  }
  if (!existsSync(join(out, "UC-01", "03.png"))) fail("UC-01 step frame missing");
  const map = readFileSync(join(out, "page-map.md"), "utf8");
  if (!map.includes("`/settings`") || !map.includes("✗ denied")) fail("page map missing refused page");
  const html = readFileSync(join(out, "index.html"), "utf8");
  if (!html.includes("UC-01.webm") || !html.includes("พนักงาน") || !html.includes("FR-01")) fail("gallery incomplete");
  // Unknown role in the file is rejected before any browser starts.
  writeFileSync(specFile, JSON.stringify({ ...spec, scenarios: [{ id: "X", role: "nobody", title: "x", steps: [{ goto: "/" }] }] }));
  const bad = await run(["--scenarios", specFile, "--out", join(work, "bad")]);
  if (bad.code !== 2 || !bad.stderr.includes('role "nobody"')) fail(`bad role not rejected: ${bad.stderr}`);
  console.log(`flow_video fixture test: ok (${out})`);
} finally {
  server.close();
}
