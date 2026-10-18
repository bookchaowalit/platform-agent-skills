// Runs ui_review.mjs on an app shell that scrolls inside an inner div and checks the
// scroller is expanded (whole page captured, recorded in the report), and that
// --no-expand-scroller captures the page as rendered.
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
  console.log("ui_inner_scroller fixture test: skipped (Playwright not installed; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}
const script = join(here, "..", "qa-testing", "scripts", "ui_review.mjs");
const url = pathToFileURL(join(here, "fixtures", "ui-inner-scroller.html")).href;
const run = (extra) => {
  const out = mkdtempSync(join(tmpdir(), "ui-inner-scroller-"));
  execFileSync("node", [script, "--url", url, "--widths", "375", "--out", out, "--a11y", "off", ...extra], { stdio: "inherit" });
  return { page: JSON.parse(readFileSync(join(out, "report.json"), "utf8")).pages[0], md: readFileSync(join(out, "report.md"), "utf8") };
};
const fail = (msg) => { console.error(`ui_inner_scroller fixture test: ${msg}`); process.exit(1); };

const expanded = run([]);
const xs = expanded.page.expandedScroller;
if (!xs) fail("expected expandedScroller in report.json");
if (xs.selector !== "#main-scroll") fail(`expected selector #main-scroll, got ${xs.selector}`);
if (!(xs.scrollHeight >= 2400 && xs.clientHeight < xs.scrollHeight)) fail(`unexpected heights ${JSON.stringify(xs)}`);
if (expanded.page.height < 2400) fail(`page should be the full content height, got ${expanded.page.height}px`);
if (expanded.page.screenshots.length < 2) fail(`expected several slices, got ${expanded.page.screenshots.length}`);
if (!expanded.md.includes("expanded inner scroller `#main-scroll`")) fail("report.md does not mention the expanded scroller");

const asRendered = run(["--no-expand-scroller"]);
if (asRendered.page.expandedScroller) fail("--no-expand-scroller still expanded the scroller");
if (asRendered.page.height >= 2400) fail(`--no-expand-scroller page should be one viewport, got ${asRendered.page.height}px`);
console.log(`ui_inner_scroller fixture test: ok (${asRendered.page.height}px → ${expanded.page.height}px, ${expanded.page.screenshots.length} slices)`);
