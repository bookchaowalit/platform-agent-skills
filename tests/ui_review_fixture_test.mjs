// Runs ui_review.mjs on a page with every known problem and checks each rule fires.
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
  console.log("ui_review fixture test: skipped (Playwright not installed; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}
const out = mkdtempSync(join(tmpdir(), "ui-review-"));
const url = pathToFileURL(join(here, "fixtures", "ui-review-bad.html")).href;
execFileSync("node", [join(here, "..", "qa-testing", "scripts", "ui_review.mjs"), "--url", url, "--widths", "375", "--out", out, "--forbid", "unit"], { stdio: "inherit" });
const report = JSON.parse(readFileSync(join(out, "report.json"), "utf8"));
const rules = new Set(report.pages.flatMap((p) => p.findings.map((f) => f.rule)));
const expected = ["page-overflow", "element-overflow", "text-under-12px", "long-text-block", "repeated-figure", "mixed-money-precision", "forbidden-word", "split-bracket", "orphan-grid-item", "multiple-primary"];
const missing = expected.filter((rule) => !rules.has(rule));
if (missing.length) {
  console.error(`ui_review fixture test: missing rules ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`ui_review fixture test: ok (${expected.length} rules)`);
