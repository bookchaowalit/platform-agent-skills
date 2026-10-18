// Runs ui_review.mjs --perf mobile on a page with known accessibility and performance
// problems, served from a local HTTP server, and checks each new rule fires.
// A small clean page must pass the performance thresholds (no false positive).
// Skips (exit 0) when Playwright or Chromium is missing, e.g. on CI without browsers;
// the accessibility half skips when axe-core is not installed next to Playwright.
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  await (await pw.chromium.launch()).close();
} catch {
  console.log("ui_a11y_perf fixture test: skipped (Playwright or Chromium not available; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}

const bad = readFileSync(join(here, "fixtures", "ui-a11y-perf-bad.html"));
const bigJs = `${"// padding to exceed the JavaScript budget\n".repeat(16000)}window.loaded = true;\n`;
const server = createServer((req, res) => {
  if (req.url === "/big.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(bigJs); return; }
  if (req.url === "/good") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end("<!doctype html><html lang=\"en\"><head><meta name=\"viewport\" content=\"width=device-width\"><title>ok</title></head><body><main><h1>Fast page</h1><p>Small and static.</p></main></body></html>"); return; }
  setTimeout(() => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(bad); }, 4200); // slow LCP
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const run = (url) => {
  const out = mkdtempSync(join(tmpdir(), "ui-a11y-perf-"));
  // Async, so this process's HTTP server keeps answering while ui_review runs.
  return new Promise((resolve, reject) => {
    execFile("node", [join(here, "..", "qa-testing", "scripts", "ui_review.mjs"), "--url", url, "--widths", "375", "--out", out, "--perf", "mobile"], (error, stdout, stderr) => {
      process.stdout.write(stdout); process.stderr.write(stderr);
      if (error) reject(error); else resolve(JSON.parse(readFileSync(join(out, "report.json"), "utf8")));
    });
  });
};
let failed = false;
try {
  const report = await run(`${base}/bad`);
  const all = [...report.pages.flatMap((p) => p.findings), ...report.perf.flatMap((p) => p.findings)];
  const severityOf = (rule) => all.find((f) => f.rule === rule)?.severity;
  const expected = [["perf-lcp", "major"], ["perf-cls", "major"], ["perf-tbt", "major"], ["perf-inp", "major"], ["perf-js-bytes", "major"]];
  if (report.a11y === "axe-core") expected.push(["a11y:image-alt", "blocker"], ["a11y:label", "blocker"], ["a11y:button-name", "blocker"], ["a11y:color-contrast", "major"]);
  else console.log(`ui_a11y_perf fixture test: accessibility half skipped (${report.a11y})`);
  const wrong = expected.filter(([rule, severity]) => severityOf(rule) !== severity).map(([rule, severity]) => `${rule}=${severityOf(rule) || "missing"} (want ${severity})`);
  console.log(`metrics: ${JSON.stringify(report.perf[0]?.metrics)}`);
  const good = await run(`${base}/good`);
  if (!good.perf[0]?.pass) wrong.push(`clean page failed perf: ${good.perf[0]?.findings.map((f) => f.rule).join(", ")}`);
  if (wrong.length) { console.error(`ui_a11y_perf fixture test: ${wrong.join("; ")}`); failed = true; }
  else console.log(`ui_a11y_perf fixture test: ok (${expected.length} rules with their severities; clean page passes)`);
} finally {
  server.close();
}
process.exit(failed ? 1 : 0);
