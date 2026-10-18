// Runs ui_review.mjs and ui_states.mjs in Chromium, WebKit and Firefox, at a plain width
// and with iPhone and Android emulation, and checks the same rules fire in every engine.
// A browser that cannot start here (not installed, missing system libraries) is skipped
// with a note; the whole test skips (exit 0) when Playwright or Chromium is missing.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
try {
  const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
  await (await pw.chromium.launch()).close();
} catch {
  console.log("ui_cross_browser fixture test: skipped (Playwright or Chromium not available; set PLAYWRIGHT_MODULE)");
  process.exit(0);
}
const problems = [];
const browsers = "chromium,webkit,firefox";

// ui_review: layout rules fire in every engine and on emulated devices.
const reviewOut = mkdtempSync(join(tmpdir(), "ui-xb-review-"));
execFileSync("node", [join(here, "..", "qa-testing", "scripts", "ui_review.mjs"), "--url", pathToFileURL(join(here, "fixtures", "ui-review-bad.html")).href,
  "--widths", "375", "--browser", browsers, "--device", "iphone,android", "--out", reviewOut, "--a11y", "off"], { stdio: "inherit" });
const review = JSON.parse(readFileSync(join(reviewOut, "report.json"), "utf8"));
const cantLaunch = new Set(review.skipped.filter((s) => s.reason.startsWith("cannot launch")).map((s) => s.browser));
for (const name of cantLaunch) console.log(`ui_cross_browser fixture test: ${name} skipped (cannot launch here)`);
const ran = browsers.split(",").filter((b) => !cantLaunch.has(b));
for (const browser of ran) {
  for (const variant of ["375", "iPhone 13", "Pixel 7"]) {
    const expectSkip = browser === "firefox" && variant !== "375";
    const page = review.pages.find((p) => p.browser === browser && (p.device || String(p.width)) === variant);
    if (expectSkip) {
      if (page || !review.skipped.some((s) => s.browser === "firefox" && s.reason.includes("isMobile"))) problems.push(`firefox ${variant}: should be skipped with a reason`);
      continue;
    }
    const rules = new Set(page?.findings.map((f) => f.rule));
    for (const rule of ["page-overflow", "text-under-12px", "split-bracket", "multiple-primary"]) if (!rules.has(rule)) problems.push(`${browser} ${variant}: ${rule} did not fire`);
  }
}
const iphone = review.pages.find((p) => p.device === "iPhone 13");
if (iphone && (iphone.width !== 390 || iphone.deviceScaleFactor !== 3)) problems.push(`iPhone 13 emulation: width ${iphone.width}, scale ${iphone.deviceScaleFactor}`);

// ui_states: the four state rules fire in every engine, none on the good button.
const statesOut = mkdtempSync(join(tmpdir(), "ui-xb-states-"));
execFileSync("node", [join(here, "..", "ux-review", "scripts", "ui_states.mjs"), "--url", pathToFileURL(join(here, "fixtures", "ui-states-bad.html")).href,
  "--widths", "375", "--browser", ran.join(","), "--device", "iphone", "--out", statesOut], { stdio: "inherit" });
const { results } = JSON.parse(readFileSync(join(statesOut, "states.json"), "utf8"));
for (const browser of ran) {
  const flags = (text) => new Set(results.filter((r) => r.browser === browser && r.text === text).flatMap((r) => r.flags.map((f) => f.rule)));
  for (const [text, rule] of [["ลงทุนเลย", "hover-hides-text"], ["ยืนยัน", "no-focus-indicator"], ["ลิงก์สีจาง", "low-contrast"], ["ปุ่มเรียบ", "state-identical"]]) {
    if (!flags(text).has(rule)) problems.push(`ui_states ${browser}: ${rule} on "${text}" did not fire`);
  }
  if (flags("ปุ่มดี").size) problems.push(`ui_states ${browser}: false positive on the good button`);
}

if (problems.length) {
  console.error(`ui_cross_browser fixture test:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`ui_cross_browser fixture test: ok (${ran.join(", ")}; plain width, iPhone and Android emulation)`);
