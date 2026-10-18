// ui_login.mjs signs in to a local test server and ui_review.mjs reuses the session.
// Skips (exit 0) when Playwright is not installed, e.g. on CI without browsers.
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
try {
  createRequire(import.meta.url).resolve(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch {
  console.log("ui_login fixture test: skipped (Playwright not installed; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}

const page = (body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main>${body}</main></body></html>`;
const server = createServer((req, res) => {
  const signedIn = (req.headers.cookie || "").includes("session=ok");
  if (req.url === "/login" && req.method === "POST") {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      const form = new URLSearchParams(data);
      const ok = form.get("email") === "review@example.test" && form.get("password") === "s3cret";
      res.writeHead(303, ok ? { "Set-Cookie": "session=ok; HttpOnly; Path=/", Location: "/account" } : { Location: "/login" });
      res.end();
    });
    return;
  }
  if (req.url === "/login") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page('<form method="post" action="/login"><input type="email" name="email"><input type="password" name="password"><button type="submit">เข้าสู่ระบบ</button></form>'));
    return;
  }
  if (req.url === "/verify-login" && req.method === "POST") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page('<p>ยืนยันอีเมลก่อนเข้าสู่ระบบ</p><input autocomplete="one-time-code" maxlength="6"><button>ยืนยัน</button>'));
    return;
  }
  if (req.url === "/verify-login") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page('<form method="post" action="/verify-login"><input type="email" name="email"><input type="password" name="password"><button type="submit">เข้าสู่ระบบ</button></form>'));
    return;
  }
  if (req.url === "/account") {
    res.writeHead(signedIn ? 200 : 401, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page(signedIn ? "<h1>บัญชีของฉัน</h1>" : "<h1>ต้องเข้าสู่ระบบ</h1>"));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "ui-login-"));
const state = join(work, "session.json");
const scripts = join(here, "..", "qa-testing", "scripts");
// Async on purpose: a synchronous child would block this process and the test server with it.
const run = (args, env = {}) => new Promise((resolve, reject) => {
  execFile("node", args, { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
    if (error) reject(new Error(String(stderr || error.message)));
    else resolve(String(stdout));
  });
});
try {
  const out = await run([join(scripts, "ui_login.mjs"), "--url", `${base}/login`, "--out", state, "--success", "/account"],
    { UI_LOGIN_USER: "review@example.test", UI_LOGIN_PASS: "s3cret" });
  if (out.includes("s3cret")) throw new Error("password printed");
  if ((statSync(state).mode & 0o777) !== 0o600) throw new Error("session file is not mode 600");
  const anon = join(work, "anon"); const authed = join(work, "authed");
  await run([join(scripts, "ui_review.mjs"), "--url", `${base}/account`, "--widths", "375,1440", "--out", anon, "--a11y", "off"]);
  await run([join(scripts, "ui_review.mjs"), "--url", `${base}/account`, "--widths", "375,1440", "--out", authed, "--a11y", "off", "--storage-state", state]);
  const status = (dir) => JSON.parse(readFileSync(join(dir, "report.json"), "utf8")).pages.map((p) => p.status);
  if (!status(anon).every((s) => s === 401)) throw new Error(`anonymous run should get 401, got ${status(anon)}`);
  if (!status(authed).every((s) => s === 200)) throw new Error(`signed-in run should get 200, got ${status(authed)}`);
  let refused = false;
  await run([join(scripts, "ui_login.mjs"), "--url", `${base}/login`, "--out", join(work, "bad.json"), "--success", "/account"],
    { UI_LOGIN_USER: "review@example.test", UI_LOGIN_PASS: "wrong" }).catch(() => { refused = true; });
  if (!refused) throw new Error("a wrong password must fail");
  let pendingRefused = false;
  await run([join(scripts, "ui_login.mjs"), "--url", `${base}/verify-login`, "--out", join(work, "pending.json")],
    { UI_LOGIN_USER: "review@example.test", UI_LOGIN_PASS: "s3cret" }).catch(() => { pendingRefused = true; });
  if (!pendingRefused) throw new Error("a pending email-verification step must fail even without --success");
  console.log("ui_login fixture test: ok (session saved 600, reused by ui_review, wrong password and pending verification refused)");
} catch (error) {
  console.error(`ui_login fixture test: ${error.message}`);
  process.exitCode = 1;
} finally {
  server.close();
}
