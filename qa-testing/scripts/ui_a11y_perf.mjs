// Accessibility (axe-core) and mobile Core Web Vitals passes for ui_review.mjs.
//
// Accessibility: axe-core is injected into every capture when it is installed next to
// Playwright (or AXE_CORE_PATH points at axe.min.js). Each violated rule becomes a
// finding `a11y:<rule-id>` with its own severity:
//   critical → blocker, serious → major, moderate/minor → minor.
//
// Performance (--perf mobile, Chromium only): each URL is loaded once more as a mid-range
// Android phone on a throttled connection (150 ms RTT, 1.6 Mbps down, 750 kbps up, CPU 4×
// slower), the same profile Lighthouse uses for mobile. It reports LCP, CLS, TBT, INP
// (after one keyboard interaction, or a click on --perf-click) and the JavaScript bytes
// transferred, against these thresholds:
//
//   metric  good (pass)  poor        severity when over good / over poor
//   LCP     ≤ 2500 ms    > 4000 ms   minor / major
//   CLS     ≤ 0.1        > 0.25      minor / major
//   TBT     ≤ 200 ms     > 600 ms    minor / major
//   INP     ≤ 200 ms     > 500 ms    minor / major
//   JS      ≤ budget KB  > 2× budget minor / major   (--perf-budget, default 300 KB)
//
// Lab numbers from one run are noisy; re-run before acting on a borderline value, and use
// field data (CrUX, RUM) for the final word on a live site.

import { readFileSync } from "node:fs";
import { siblingPackageFile, variants } from "./ui_browsers.mjs";

const AXE_IMPACT = { critical: "blocker", serious: "major", moderate: "minor", minor: "minor" };
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export function axeSource() {
  const file = process.env.AXE_CORE_PATH || siblingPackageFile("axe-core", "axe.min.js");
  return file ? readFileSync(file, "utf8") : null;
}

/** Run axe on the current page. Returns { findings, summary } or null when axe is absent. */
export async function axePass(page, source, tags = AXE_TAGS) {
  if (!source) return null;
  await page.evaluate(source);
  const result = await page.evaluate(async (runTags) => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: "tag", values: runTags }, resultTypes: ["violations"] });
    return {
      version: r.testEngine?.version,
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length, target: String(v.nodes[0]?.target?.[0] || "") })),
    };
  }, tags);
  const findings = result.violations.map((v) => ({
    severity: AXE_IMPACT[v.impact] || "minor",
    rule: `a11y:${v.id}`,
    detail: `${v.impact}: ${v.help} — ${v.nodes} element(s) (${v.helpUrl})`,
    where: v.target,
    source: "axe",
  }));
  return { findings, summary: { engine: `axe-core ${result.version}`, tags, violations: result.violations.length } };
}

export const PERF_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: "ms", label: "LCP" },
  cls: { good: 0.1, poor: 0.25, unit: "", label: "CLS" },
  tbt: { good: 200, poor: 600, unit: "ms", label: "TBT" },
  inp: { good: 200, poor: 500, unit: "ms", label: "INP" },
};
export const MOBILE_THROTTLING = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpuSlowdown: 4 };

/** Installed before any page script: collects LCP, CLS (session windows), long tasks, FCP and INP. */
function collectVitals() {
  const v = { lcp: 0, fcp: 0, cls: 0, longTasks: [], inp: 0 };
  window.__uiVitals = v;
  const observe = (type, cb, extra = {}) => {
    try { new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch { /* unsupported */ }
  };
  observe("largest-contentful-paint", (e) => { v.lcp = e.renderTime || e.loadTime || e.startTime; });
  observe("paint", (e) => { if (e.name === "first-contentful-paint") v.fcp = e.startTime; });
  let windowValue = 0;
  let windowStart = 0;
  let last = 0;
  observe("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    if (e.startTime - last > 1000 || e.startTime - windowStart > 5000) { windowValue = 0; windowStart = e.startTime; }
    windowValue += e.value;
    last = e.startTime;
    v.cls = Math.max(v.cls, windowValue);
  });
  observe("longtask", (e) => { v.longTasks.push({ start: e.startTime, duration: e.duration }); });
  observe("event", (e) => { if (e.interactionId) v.inp = Math.max(v.inp, e.duration); }, { durationThreshold: 16 });
}

function rate(metric, value, budgetKb) {
  const t = metric === "js" ? { good: budgetKb, poor: budgetKb * 2 } : PERF_THRESHOLDS[metric];
  if (value > t.poor) return "major";
  if (value > t.good) return "minor";
  return null;
}

/** One throttled mobile load of url in Chromium. Returns { url, metrics, pass, findings }. */
export async function perfPass(pw, browser, url, { budgetKb = 300, click = "", dismiss = [] } = {}) {
  const [device] = variants(pw, [], "android");
  const context = await browser.newContext(device.options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const scripts = new Map();
  let jsBytes = 0;
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  cdp.on("Network.responseReceived", (e) => { if (e.type === "Script") scripts.set(e.requestId, e.response.url); });
  cdp.on("Network.loadingFinished", (e) => { if (scripts.has(e.requestId)) jsBytes += e.encodedDataLength; });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: MOBILE_THROTTLING.latency, downloadThroughput: MOBILE_THROTTLING.downloadThroughput, uploadThroughput: MOBILE_THROTTLING.uploadThroughput });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: MOBILE_THROTTLING.cpuSlowdown });
  await page.addInitScript(collectVitals);
  try {
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => ({ ...window.__uiVitals }));
    // One interaction for INP: a click on --perf-click, or a harmless Tab key press.
    // Consent dialogs from --dismiss are closed first, which also counts as an interaction.
    for (const name of dismiss) {
      const btn = page.getByRole("button", { name, exact: true });
      if (await btn.count()) await btn.first().click().catch(() => {});
    }
    if (click) await page.locator(click).first().click({ timeout: 5000 }).catch(() => {});
    else await page.keyboard.press("Tab");
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ ...window.__uiVitals }));
    const fcp = before.fcp || 0;
    const tbt = before.longTasks.filter((t) => t.start >= fcp).reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
    const metrics = {
      lcp: Math.round(before.lcp),
      fcp: Math.round(fcp),
      cls: Math.round(before.cls * 1000) / 1000,
      tbt: Math.round(tbt),
      inp: Math.round(after.inp),
      jsKb: Math.round(jsBytes / 1024),
      jsFiles: scripts.size,
    };
    const findings = [];
    for (const key of ["lcp", "cls", "tbt", "inp"]) {
      const severity = rate(key, metrics[key], budgetKb);
      const t = PERF_THRESHOLDS[key];
      if (severity) findings.push({ severity, rule: `perf-${key}`, detail: `${t.label} ${metrics[key]}${t.unit} (good ≤ ${t.good}${t.unit}, poor > ${t.poor}${t.unit}) on a throttled mobile load`, where: "", source: "perf" });
    }
    const js = rate("js", metrics.jsKb, budgetKb);
    if (js) findings.push({ severity: js, rule: "perf-js-bytes", detail: `${metrics.jsKb} KB of JavaScript in ${metrics.jsFiles} file(s) (budget ${budgetKb} KB)`, where: "", source: "perf" });
    return { url, profile: { device: device.device, ...MOBILE_THROTTLING, budgetKb }, metrics, pass: findings.length === 0, findings };
  } finally {
    await context.close();
  }
}
