// Shared browser and device setup for ui_review.mjs and ux-review's ui_states.mjs.
//
// --browser chromium,webkit,firefox runs every capture in each engine.
// --device iphone,android (or any Playwright device name, e.g. "iPhone 15") adds real
// device emulation (viewport, deviceScaleFactor, isMobile, hasTouch, user agent) next to
// the plain --widths. Firefox has no isMobile mode, so device variants skip Firefox.
//
// Playwright: resolved from PLAYWRIGHT_MODULE (path to the package) or `playwright`.
// Optional helpers (axe-core) are looked up next to it in the same node_modules.

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
export const BROWSERS = ["chromium", "webkit", "firefox"];
export const DEVICE_ALIASES = { iphone: "iPhone 13", android: "Pixel 7" };

export function loadPlaywright() {
  return require(process.env.PLAYWRIGHT_MODULE || "playwright");
}

/** Path of a package installed next to Playwright (or resolvable normally), or null. */
export function siblingPackageFile(pkg, file) {
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(join(dirname(process.env.PLAYWRIGHT_MODULE), pkg, file));
  try { candidates.push(join(dirname(require.resolve(`${pkg}/package.json`)), file)); } catch { /* not installed */ }
  return candidates.find((p) => existsSync(p)) || null;
}

export function parseBrowsers(value) {
  const list = (value || "chromium").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = list.filter((b) => !BROWSERS.includes(b));
  if (bad.length) throw new Error(`unknown --browser ${bad.join(",")} (use ${BROWSERS.join(",")})`);
  return [...new Set(list)];
}

export const slugText = (text) => text.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export function slug(url) {
  const { host, pathname } = new URL(url);
  return slugText(`${host}${pathname}`) || "page";
}

/**
 * Capture variants: one per plain width, one per emulated device.
 * Each has a label used in file names and baseline keys, and the context options.
 */
export function variants(pw, widths, deviceList) {
  const out = widths.map((width) => ({ label: String(width), width, device: null, options: { viewport: { width, height: 900 } } }));
  for (const raw of (deviceList || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const name = DEVICE_ALIASES[raw.toLowerCase()] || raw;
    const descriptor = pw.devices[name];
    if (!descriptor) throw new Error(`unknown --device "${raw}" (try iphone, android or a Playwright device name such as "iPhone 15")`);
    const { defaultBrowserType, ...options } = descriptor;
    out.push({ label: slugText(name).toLowerCase(), width: descriptor.viewport.width, device: name, defaultBrowserType, options });
  }
  return out;
}

/** Why this browser cannot run this variant, or "" when it can. */
export function unsupported(browserName, variant) {
  if (browserName === "firefox" && variant.options.isMobile) return "Firefox has no isMobile emulation";
  return "";
}

/** File-name base: chromium plain widths keep the historical `<slug>-<width>` names. */
export function captureBase(url, browserName, variant) {
  return browserName === "chromium" && !variant.device ? `${slug(url)}-${variant.width}` : `${slug(url)}-${browserName}-${variant.label}`;
}

/** Launch each browser once; a browser that cannot start is reported, not fatal. */
export async function launchAll(pw, names) {
  const launched = [];
  const failed = [];
  for (const name of names) {
    try {
      launched.push({ name, browser: await pw[name].launch() });
    } catch (error) {
      failed.push({ name, error: String(error.message || error).split("\n")[0].slice(0, 200) });
    }
  }
  return { launched, failed };
}
