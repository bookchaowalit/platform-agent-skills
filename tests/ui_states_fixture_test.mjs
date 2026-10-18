// Runs ui_states.mjs on a page with known state bugs and checks each rule fires.
// Skips (exit 0) when Playwright is not installed, e.g. on CI without browsers.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
try {
  createRequire(import.meta.url).resolve(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch {
  console.log("ui_states fixture test: skipped (Playwright not installed; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}
const out = mkdtempSync(join(tmpdir(), "ui-states-"));
const url = pathToFileURL(join(here, "fixtures", "ui-states-bad.html")).href;
execFileSync("node", [join(here, "..", "ux-review", "scripts", "ui_states.mjs"), "--url", url, "--widths", "375", "--out", out], { stdio: "inherit" });
const { results } = JSON.parse(readFileSync(join(out, "states.json"), "utf8"));
const flagsFor = (text) => new Set((results.find((r) => r.text === text)?.flags || []).map((f) => f.rule));
const expect = [
  ["ลงทุนเลย", "hover-hides-text"],
  ["ยืนยัน", "no-focus-indicator"],
  ["ลิงก์สีจาง", "low-contrast"],
  ["ปุ่มเรียบ", "state-identical"],
];
const missing = expect.filter(([text, rule]) => !flagsFor(text).has(rule)).map(([t, r]) => `${t}:${r}`);
const good = flagsFor("ปุ่มดี");
if (missing.length || good.size) {
  console.error(`ui_states fixture test: missing ${missing.join(", ") || "none"}; false positives on good button: ${[...good].join(", ") || "none"}`);
  process.exit(1);
}
console.log("ui_states fixture test: ok (4 rules, no false positive on the good button)");
