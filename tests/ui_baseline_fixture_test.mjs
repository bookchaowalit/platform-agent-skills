// Visual baseline round trip: capture, sign off with --promote-baseline, capture an
// unchanged page (no change reported) and a changed page (regions and diff images).
// Baselines go to a temporary UI_REVIEW_STATE_DIR keyed by a temporary git repository.
// Skips (exit 0) when Playwright or Chromium is missing, e.g. on CI without browsers.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
try {
  const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
  await (await pw.chromium.launch()).close();
} catch {
  console.log("ui_baseline fixture test: skipped (Playwright or Chromium not available; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}
const tmp = mkdtempSync(join(tmpdir(), "ui-baseline-"));
const env = { ...process.env, UI_REVIEW_STATE_DIR: join(tmp, "state") };
const repo = join(tmp, "web");
const git = (...args) => execFileSync("git", ["-C", repo, ...args], { env });
execFileSync("git", ["init", "-q", "-b", "main", repo]);
git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
git("remote", "add", "origin", "https://github.com/acme/web.git");

const scripts = join(here, "..", "qa-testing", "scripts");
const page = pathToFileURL(join(here, "fixtures", "ui-visual.html")).href;
const capture = (name, query) => {
  const out = join(tmp, name);
  execFileSync("node", [join(scripts, "ui_review.mjs"), "--url", `${page}${query}`, "--widths", "375,1440", "--out", out, "--baseline", repo, "--a11y", "off"], { env, stdio: "inherit" });
  return JSON.parse(readFileSync(join(out, "report.json"), "utf8"));
};
const problems = [];

const first = capture("first", "?v=1");
if (first.visual.new.length !== 2) problems.push(`first capture should have no baseline, got ${JSON.stringify(first.visual)}`);
execFileSync("python3", [join(scripts, "ui_signoff.py"), "--repo", repo, "--report", join(tmp, "first", "report.json"), "--reviewer", "fixture", "--verdict", "pass", "--notes", "baseline", "--promote-baseline"], { env, stdio: "inherit" });
const manifest = join(tmp, "state", "acme__web", "baselines", "manifest.json");
if (!existsSync(manifest)) problems.push("no baseline manifest after --promote-baseline");

const same = capture("same", "?v=1");
if (same.visual.changed.length || same.visual.same !== 2) problems.push(`unchanged page reported changes: ${JSON.stringify(same.visual)}`);

const changed = capture("changed", "?v=2");
if (changed.visual.changed.length !== 2) problems.push(`changed page not detected at both widths: ${JSON.stringify(changed.visual)}`);
// ?v=2 changes the Starter price and the colour of both "Choose" buttons; nothing else.
const near = (regions, top, bottom) => regions.some((r) => r.y < bottom && r.y + r.height > top);
for (const p of changed.pages) {
  const rule = p.findings.find((f) => f.rule === "visual-change");
  const regions = p.visual?.regions || [];
  const hits = { price: near(regions, 190, 250), firstButton: near(regions, 270, 340), secondButton: near(regions, 510, 580) };
  if (!rule || Object.values(hits).includes(false)) problems.push(`${p.width}px: visual-change=${Boolean(rule)}, regions ${JSON.stringify(hits)}`);
  if (!p.visual?.diffImages.length || !p.visual.diffImages.every((f) => existsSync(f))) problems.push(`${p.width}px: diff image missing`);
  if (regions.some((r) => r.y > 600 || (r.y > 340 && r.y + r.height < 510))) problems.push(`${p.width}px: change reported where nothing changed: ${JSON.stringify(regions.map(({ x, y, width, height }) => ({ x, y, width, height })))}`);
}
if (problems.length) {
  console.error(`ui_baseline fixture test:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("ui_baseline fixture test: ok (new → promoted → unchanged → changed regions with diff images)");
