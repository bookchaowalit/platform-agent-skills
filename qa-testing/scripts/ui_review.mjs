#!/usr/bin/env node
// Full-page visual review capture and automated audit for the UI quality gate.
//
// Captures every URL at every width (and emulated device, in every chosen browser) as
// full-page screenshots, sliced so each image is readable, then measures what the eye
// tends to miss: horizontal overflow, text under 12px, tap targets under 44px, long text
// blocks, the same money figure repeated, mixed money precision, bracketed labels split
// across lines, a lone card on the last grid row, forbidden words in visible copy, and
// more than one primary button in a section.
//
// App shells that scroll inside an inner container (a full-height div with overflow-y:auto)
// leave the document one viewport tall, so a full-page screenshot shows only the first
// screen. Before the audit and capture, the largest such scroller is expanded to its full
// height, along with its ancestors, and report.json records it. --no-expand-scroller turns
// that off.
//
// Optional passes, merged into report.json with their own severities:
//   --baseline <repo|dir>  visual diff against the last approved capture (ui_visual_diff.mjs)
//   axe-core               WCAG rules on every capture when axe-core is installed (ui_a11y_perf.mjs)
//   --perf mobile          throttled mobile Core Web Vitals and JS bytes per URL (Chromium)
//
// The audit only points at problems. The reviewer still looks at every slice and
// records the verdict with ui_signoff.py; passing this script is not a UX sign-off.
//
// Usage:
//   node ui_review.mjs --url https://example.com/a --url https://example.com/b \
//     [--widths 320,375,768,1024,1440] [--out ./ui-review] \
//     [--browser chromium,webkit,firefox] [--device iphone,android] \
//     [--baseline <product-repo>] [--a11y auto|off] \
//     [--perf mobile] [--perf-budget 300] [--perf-click "button.primary"] \
//     [--forbid unit,TODO] [--primary ".btn-primary,[data-primary]"] \
//     [--dismiss "Accept,ไม่อนุญาต"] [--slice 1400] [--no-expand-scroller]
// Playwright: resolved from PLAYWRIGHT_MODULE (path to the package) or `playwright`.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { axePass, axeSource, perfPass } from "./ui_a11y_perf.mjs";
import { captureBase, launchAll, loadPlaywright, parseBrowsers, unsupported, variants } from "./ui_browsers.mjs";
import { compareCapture, resolveBaselineDir } from "./ui_visual_diff.mjs";

function parseArgs(argv) {
  const args = {
    url: [], widths: "320,375,768,1024,1440", out: "ui-review", forbid: "", primary: "", dismiss: "", slice: "1400",
    browser: "chromium", device: "", baseline: "", a11y: "auto", perf: "off", "perf-budget": "300", "perf-click": "",
    "storage-state": "",
  };
  let expandScroller = true;
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (key === "no-expand-scroller") { expandScroller = false; continue; }
    const value = argv[i + 1];
    if (key === "url") args.url.push(value);
    else if (key in args) args[key] = value;
    else throw new Error(`unknown option --${key}`);
    i += 1;
  }
  if (!args.url.length) throw new Error("at least one --url is required");
  if (!["auto", "off"].includes(args.a11y)) throw new Error("--a11y takes auto or off");
  if (!["off", "mobile"].includes(args.perf)) throw new Error("--perf takes mobile or off");
  return {
    urls: args.url,
    widths: args.widths.split(",").map(Number).filter(Boolean),
    out: args.out,
    forbid: args.forbid.split(",").map((s) => s.trim()).filter(Boolean),
    primary: args.primary || ".button-primary,.btn-primary,[data-primary=\"true\"],button[type=submit].primary",
    dismiss: args.dismiss.split(",").map((s) => s.trim()).filter(Boolean),
    slice: Number(args.slice) || 1400,
    browsers: parseBrowsers(args.browser),
    devices: args.device,
    baseline: args.baseline,
    a11y: args.a11y,
    perf: args.perf,
    perfBudget: Number(args["perf-budget"]) || 300,
    perfClick: args["perf-click"],
    // Logged-in pages: a Playwright storage state saved by ui_login.mjs (kept outside the repo).
    storageState: args["storage-state"] || undefined,
    expandScroller,
  };
}

/** Runs in the page. Visible text only: screen-reader-only and hidden nodes are skipped. */
function auditPage({ forbid, primary, viewportWidth }) {
  const findings = [];
  const add = (severity, rule, detail, el) => {
    let where = "";
    if (el) {
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
      where = `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} @y=${Math.round(r.top + scrollY)}`;
    }
    findings.push({ severity, rule, detail, where });
  };
  const isHidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden") return true;
      const r = n.getBoundingClientRect();
      if (s.position === "absolute" && r.width <= 1 && r.height <= 1) return true; // sr-only
      if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true;
    }
    return false;
  };
  const root = document.querySelector("main") || document.body;
  // Mobile emulation zooms a too-wide page out, so innerWidth grows; judge against the device width.
  const vw = viewportWidth || innerWidth;

  // 1. Horizontal overflow
  if (document.documentElement.scrollWidth > vw + 1) add("blocker", "page-overflow", `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1 && !isHidden(el)) {
      let clipped = false;
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") { clipped = true; break; }
      }
      if (!clipped) { add("blocker", "element-overflow", `extends to ${Math.round(r.right)}px`, el); break; }
    }
  }

  // Visible text nodes
  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (t && n.parentElement && !isHidden(n.parentElement) && !n.parentElement.closest("script,style,noscript")) texts.push({ t, el: n.parentElement });
  }

  // 2. Small text
  const small = texts.filter(({ el }) => parseFloat(getComputedStyle(el).fontSize) < 12);
  if (small.length) add("major", "text-under-12px", `${small.length} text node(s), e.g. "${small[0].t.slice(0, 40)}"`, small[0].el);

  // 2b. Crushed text: a heading or label squeezed so narrow it wraps every few characters
  // (for example a 2-column grid inside a narrow app shell, or a badge eating a flex row).
  const crushed = new Set();
  for (const { t, el } of texts) {
    if (t.length < 6 || crushed.has(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight) || fs * 1.4;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.width < fs * 4 && r.height > lh * 3.5) {
      crushed.add(el);
      add("major", "crushed-text", `"${t.slice(0, 30)}" is ${Math.round(r.width)}px wide and wraps into ~${Math.round(r.height / lh)} lines — its container is too narrow (check grid columns and flex siblings)`, el);
    }
  }

  // 2c. Narrow text column: running text squeezed into a thin column beside other content
  // (thumbnail + text + button in one row on a phone), so it reads a few words per line.
  // Narrower than ~9 characters' width per line and 4+ lines, one finding per row.
  const narrowRows = new Set();
  for (const { t, el } of texts) {
    if (t.length < 24 || crushed.has(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight) || fs * 1.4;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.width < fs * 9 && r.height >= lh * 3.5)) continue;
    let row = el.parentElement;
    while (row && row !== root) {
      const rs = getComputedStyle(row);
      if ((rs.display === "flex" || rs.display === "inline-flex") && !rs.flexDirection.startsWith("column") && row.children.length > 1) break;
      if (rs.display === "grid" && rs.gridTemplateColumns.split(" ").length > 1) break;
      row = row.parentElement;
    }
    if (!row || row === root || narrowRows.has(row)) continue;
    narrowRows.add(row);
    add("major", "narrow-text-column", `"${t.slice(0, 30)}" runs in a ${Math.round(r.width)}px column (~${Math.round(r.width / fs)} characters per line, ${Math.round(r.height / lh)} lines) beside other content — stack the row on narrow screens or give the text the full width`, el);
  }

  // 3. Long text blocks inside cards/sections (wall of text)
  const BLOCK = "p,div,ul,ol,dl,dt,dd,li,section,article,table,h1,h2,h3,h4,h5,h6,details,form";
  const reported = new Set();
  for (const el of root.querySelectorAll("p,dd,li,td,span,div")) {
    // Only the innermost text box: a container of other blocks is a layout, not a paragraph.
    if (el.querySelector(BLOCK) || isHidden(el)) continue;
    const t = (el.innerText || "").trim();
    if (t.length > 320 && el.getBoundingClientRect().width < 900 && !reported.has(t)) {
      reported.add(t);
      add("major", "long-text-block", `${t.length} chars: "${t.slice(0, 60)}…" — split into rows, bullets or a details toggle`, el);
    }
  }

  // 4. Money figures: repetition and precision
  const money = /(?:฿|THB\s?|\$|€|£)\s?-?[\d,]+(?:\.\d+)?|-?[\d,]{4,}(?:\.\d+)?\s?(?:บาท|baht)/g;
  const all = texts.map(({ t }) => t).join(" \n ");
  const figures = (all.match(money) || []).map((m) => m.replace(/\s/g, ""));
  const norm = (m) => m.replace(/[^\d.]/g, "").replace(/\.0+$/, "");
  const counts = new Map();
  for (const f of figures) { const k = norm(f); if (k.replace(/\./g, "").length >= 4) counts.set(k, (counts.get(k) || 0) + 1); }
  for (const [k, c] of counts) if (c >= 3) add("major", "repeated-figure", `${k} appears ${c} times on screen — show each figure once, where it is explained`);
  const withDecimals = figures.filter((f) => /\.\d\d$/.test(f));
  const whole = figures.filter((f) => !/\.\d+$/.test(f));
  if (withDecimals.length && whole.length) add("major", "mixed-money-precision", `${whole.length} whole and ${withDecimals.length} with decimals (e.g. ${withDecimals[0]}) — estimates usually read in whole units`);

  // 5. Forbidden words in visible copy (e.g. untranslated units, TODO).
  // Case-sensitive whole-word match ("unit" is not "Unit"), done without a dynamic RegExp.
  const isLatin = (ch) => /[A-Za-z]/.test(ch || "");
  const hasWord = (text, word) => {
    for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) {
      if (!isLatin(text[i - 1]) && !isLatin(text[i + word.length])) return true;
    }
    return false;
  };
  for (const word of forbid) {
    const hit = texts.find(({ t }) => hasWord(t, word));
    if (hit) add("major", "forbidden-word", `"${word}" in "${hit.t.slice(0, 60)}"`, hit.el);
  }

  // 6. Bracketed labels split across lines: "(Dedicated" / "Unit)"
  for (const { el } of texts) {
    if (el.children.length) continue;
    const node = [...el.childNodes].find((c) => c.nodeType === 3 && /\([^()]{3,40}\)/.test(c.textContent));
    if (!node) continue;
    const m = /\([^()]{3,40}\)/.exec(node.textContent);
    const range = document.createRange();
    range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    if (tops.size > 1 && !reported.has(`b:${m[0]}`) && reported.add(`b:${m[0]}`)) add("minor", "split-bracket", `"${m[0]}" breaks across lines — keep it together (white-space: nowrap on the bracket)`, el);
  }

  // 7. Lone card on the last row of a multi-column grid
  for (const el of root.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (s.display !== "grid" || isHidden(el)) continue;
    const cols = s.gridTemplateColumns.split(" ").filter(Boolean).length;
    const items = [...el.children].filter((c) => !isHidden(c) && getComputedStyle(c).gridColumnEnd === "auto");
    if (cols < 2 || items.length < 2 || el.children.length !== items.length) continue;
    const tops = items.map((c) => Math.round(c.getBoundingClientRect().top));
    const last = Math.max(...tops);
    if (tops.filter((t) => t === last).length === 1 && tops.filter((t) => t < last).length >= cols) add("minor", "orphan-grid-item", `${cols}-column grid leaves one card alone on its last row`, el);
  }

  // 8. Small tap targets (mobile widths)
  if (vw <= 768) {
    const tiny = [...root.querySelectorAll("a,button,input,select,[role=button]")].filter((el) => {
      if (isHidden(el)) return false;
      // A checkbox or radio inside a label is tapped through the label, so measure that.
      const target = el.matches("input[type=checkbox],input[type=radio]") && el.closest("label") ? el.closest("label") : el;
      const r = target.getBoundingClientRect();
      return r.width > 0 && (r.height < 44 && r.width < 44) && getComputedStyle(target).display !== "inline";
    });
    if (tiny.length) add("minor", "tap-target", `${tiny.length} control(s) under 44×44px`, tiny[0]);
  }

  // 9. More than one primary action per section
  for (const section of root.querySelectorAll("section,form")) {
    const prim = [...section.querySelectorAll(primary)].filter((el) => !isHidden(el) && el.closest("section,form") === section);
    if (prim.length > 1) add("minor", "multiple-primary", `${prim.length} primary buttons in one section`, section);
  }

  return { height: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, findings };
}

/**
 * Runs in the page. When the document itself does not scroll but an inner container does
 * (an app shell with height:100vh and overflow-y:auto), expands the largest such container
 * and every ancestor so the document grows to the full content height. Returns what it
 * changed, or null when the page scrolls normally.
 */
function expandInnerScroller() {
  const doc = document.documentElement;
  const vw = innerWidth;
  let best = null;
  for (const el of document.body ? document.body.querySelectorAll("*") : []) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== "auto" && oy !== "scroll") continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6 || r.height <= 0) continue;
    const hidden = el.scrollHeight - el.clientHeight;
    if (!best || hidden > best.hidden) best = { el, hidden };
  }
  // Nothing worth expanding when the document already shows more than the scroller hides.
  if (!best || doc.scrollHeight - innerHeight >= best.hidden) return null;
  const selector = (el) => {
    const parts = [];
    for (let n = el; n && n !== doc; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      let part = n.tagName.toLowerCase();
      const cls = typeof n.className === "string" ? n.className.split(/\s+/).filter(Boolean).slice(0, 2) : [];
      if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join("");
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
      parts.unshift(part);
      if (n === document.body) break;
    }
    return parts.join(" > ");
  };
  const el = best.el;
  const info = { selector: selector(el), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, documentHeightBefore: doc.scrollHeight, ancestors: 0 };
  for (let n = el; n; n = n.parentElement) {
    n.style.setProperty("height", "auto", "important");
    n.style.setProperty("max-height", "none", "important");
    n.style.setProperty("min-height", "0", "important");
    n.style.setProperty("overflow-y", "visible", "important");
    if (n !== el) info.ancestors += 1;
  }
  info.documentHeightAfter = doc.scrollHeight;
  return info;
}

/**
 * Pages that poll, stream or hold a socket never reach "networkidle". Load the page, then
 * wait for network idle for a bounded time, so a busy signed-in page is still captured.
 */
async function gotoSettled(page, url) {
  const res = await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return res;
}

async function capture(browser, browserName, variant, url, opts, report, extras) {
  const ctx = await browser.newContext({ ...variant.options, storageState: opts.storageState });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  try {
    const res = await gotoSettled(page, url);
    for (const name of opts.dismiss) {
      const btn = page.getByRole("button", { name, exact: true });
      if (await btn.count()) await btn.first().click().catch(() => {});
    }
    await page.waitForTimeout(400);
    const scroller = opts.expandScroller ? await page.evaluate(expandInnerScroller).catch(() => null) : null;
    if (scroller) await page.waitForTimeout(200);
    const audit = await page.evaluate(auditPage, { forbid: opts.forbid, primary: opts.primary, viewportWidth: variant.width });
    const a11y = extras.axe ? await axePass(page, extras.axe) : null;
    const base = captureBase(url, browserName, variant);
    const shots = [];
    // Slice against the height the browser will actually render: some engines (Firefox with
    // device emulation) report a scrollHeight a few pixels taller than the full-page image.
    const pageHeight = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight || Infinity : Infinity)).catch(() => audit.height);
    const sliceTo = Math.max(1, Math.min(audit.height, pageHeight || audit.height));
    for (let y = 0, i = 0; y < sliceTo; y += opts.slice, i += 1) {
      const file = join(opts.out, `${base}-${String(i).padStart(2, "0")}.png`);
      const height = Math.min(opts.slice, sliceTo - y);
      try {
        await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "hide", clip: { x: 0, y, width: variant.width, height } });
      } catch {
        // Last resort: the remaining part as a plain viewport-sized capture at that offset.
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
      }
      shots.push(file);
    }
    const entry = {
      url, width: variant.width, browser: browserName, device: variant.device, key: base,
      deviceScaleFactor: variant.options.deviceScaleFactor || 1,
      status: res ? res.status() : null, height: audit.height, jsErrors: errors,
      findings: [...audit.findings, ...(a11y ? a11y.findings : [])], screenshots: shots,
    };
    if (a11y) entry.a11y = a11y.summary;
    if (scroller) entry.expandedScroller = scroller;
    // A redirect (most often to a sign-in page) means the page in scope was never reviewed.
    const finalUrl = page.url();
    entry.finalUrl = finalUrl;
    const asked = new URL(url);
    const landed = new URL(finalUrl);
    if (asked.protocol !== "file:" && (asked.host !== landed.host || asked.pathname.replace(/\/$/, "") !== landed.pathname.replace(/\/$/, ""))) {
      entry.findings.unshift({ severity: "blocker", rule: "redirected", detail: `asked for ${asked.pathname} but landed on ${landed.pathname}${landed.search} — sign in with --storage-state or check the route; this capture is not the page in scope`, where: "" });
    }
    if (extras.baselineDir) {
      const visual = await compareCapture(browser, { baselineDir: extras.baselineDir, key: base, screenshots: shots, sliceHeight: opts.slice, scale: entry.deviceScaleFactor, outDir: opts.out });
      entry.visual = visual;
      if (visual.status === "changed") {
        const top = visual.regions[0];
        entry.findings.push({ severity: "minor", rule: "visual-change", detail: `${visual.regions.length} changed region(s) vs the approved baseline; first at x=${top.x} y=${top.y} ${top.width ?? "?"}×${top.height ?? "?"} — look at ${visual.diffImages.map((f) => f.split("/").pop()).join(", ") || "the slice list"}`, where: "", source: "visual" });
      }
    }
    report.pages.push(entry);
  } finally {
    // Apps that rotate refresh tokens invalidate the old session once it is used, so keep
    // the session file current for the next context and the next run.
    if (opts.storageState) await ctx.storageState({ path: opts.storageState }).catch(() => {});
    await ctx.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();
  const list = variants(pw, opts.widths, opts.devices);
  mkdirSync(opts.out, { recursive: true });
  const axe = opts.a11y === "auto" ? axeSource() : null;
  const baselineDir = opts.baseline ? resolveBaselineDir(opts.baseline) : "";
  const report = {
    created: new Date().toISOString(), widths: opts.widths, browsers: opts.browsers, devices: list.filter((v) => v.device).map((v) => v.device),
    a11y: axe ? "axe-core" : `skipped (${opts.a11y === "off" ? "--a11y off" : "axe-core not installed next to Playwright; set AXE_CORE_PATH"})`,
    baselineDir: baselineDir || null, pages: [], skipped: [], perf: [],
  };
  const needed = opts.perf === "mobile" && !opts.browsers.includes("chromium") ? [...opts.browsers, "chromium"] : opts.browsers;
  const { launched, failed } = await launchAll(pw, needed);
  for (const f of failed) report.skipped.push({ browser: f.name, reason: `cannot launch: ${f.error}` });
  try {
    for (const { name, browser } of launched.filter((b) => opts.browsers.includes(b.name))) {
      for (const url of opts.urls) {
        for (const variant of list) {
          const why = unsupported(name, variant);
          if (why) { report.skipped.push({ browser: name, url, variant: variant.label, reason: why }); continue; }
          await capture(browser, name, variant, url, opts, report, { axe, baselineDir });
        }
      }
    }
    const chromium = launched.find((b) => b.name === "chromium");
    if (opts.perf === "mobile") {
      if (!chromium) report.skipped.push({ browser: "chromium", reason: "--perf needs Chromium" });
      else for (const url of opts.urls) report.perf.push(await perfPass(pw, chromium.browser, url, { budgetKb: opts.perfBudget, click: opts.perfClick, dismiss: opts.dismiss }));
    }
  } finally {
    for (const { browser } of launched) await browser.close();
  }
  const counts = { blocker: 0, major: 0, minor: 0 };
  for (const p of report.pages) { for (const f of p.findings) counts[f.severity] += 1; if (p.jsErrors.length || (p.status && p.status >= 400)) counts.blocker += 1; }
  for (const r of report.perf) for (const f of r.findings) counts[f.severity] += 1;
  report.counts = counts;
  report.visual = baselineDir ? {
    changed: report.pages.filter((p) => p.visual?.status === "changed").map((p) => p.key),
    new: report.pages.filter((p) => p.visual?.status === "new").map((p) => p.key),
    same: report.pages.filter((p) => p.visual?.status === "same").length,
  } : null;
  writeFileSync(join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(opts.out, "report.md"), `${markdown(report, opts).join("\n")}\n`);
  if (!report.pages.length) {
    console.error(`ui_review: nothing captured (${report.skipped.map((s) => `${s.browser}: ${s.reason}`).join("; ")})`);
    process.exit(2);
  }
  console.log(`ui_review: ${report.pages.length} captures → ${opts.out}/report.md (${counts.blocker} blocker, ${counts.major} major, ${counts.minor} minor)${report.skipped.length ? `, ${report.skipped.length} skipped` : ""}`);
}

function markdown(report, opts) {
  const { counts } = report;
  const lines = ["# UI review", "",
    `Created ${report.created} · widths ${opts.widths.join(", ")} · browsers ${opts.browsers.join(", ")}${report.devices.length ? ` · devices ${report.devices.join(", ")}` : ""} · accessibility: ${report.a11y}`, "",
    `Automated findings: ${counts.blocker} blocker · ${counts.major} major · ${counts.minor} minor`, "",
    "Look at every screenshot slice yourself; the automated rules are hints, not a verdict.", ""];
  if (report.visual) {
    lines.push("## Visual changes against the approved baseline", "",
      `${report.visual.changed.length} changed · ${report.visual.new.length} without a baseline · ${report.visual.same} unchanged (baselines: ${report.baselineDir})`, "");
    for (const p of report.pages.filter((x) => x.visual?.status === "changed")) {
      lines.push(`- **${p.key}** (${p.url}, ${p.browser}, ${p.device || `${p.width}px`}):`);
      for (const r of p.visual.regions.slice(0, 8)) lines.push(`  - slice ${r.slice}: x=${r.x} y=${r.y} ${r.width ?? "?"}×${r.height ?? "?"}${r.note ? ` — ${r.note}` : ""}${r.diff ? ` → ${r.diff.split("/").pop()}` : ""}`);
      if (p.visual.regions.length > 8) lines.push(`  - … ${p.visual.regions.length - 8} more in report.json`);
    }
    if (report.visual.new.length) lines.push("", `No baseline yet (promote with ui_signoff.py --promote-baseline): ${report.visual.new.join(", ")}`);
    lines.push("");
  }
  if (report.perf.length) {
    lines.push("## Mobile performance (throttled, Chromium)", "", "| URL | LCP ms | CLS | TBT ms | INP ms | JS KB | pass |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of report.perf) lines.push(`| ${r.url} | ${r.metrics.lcp} | ${r.metrics.cls} | ${r.metrics.tbt} | ${r.metrics.inp} | ${r.metrics.jsKb} | ${r.pass ? "yes" : "no"} |`);
    for (const r of report.perf) for (const f of r.findings) lines.push(`- **${f.severity}** ${f.rule}: ${f.detail} (${r.url})`);
    lines.push("");
  }
  for (const s of report.skipped) lines.push(`- skipped ${s.browser}${s.url ? ` ${s.url} ${s.variant}` : ""}: ${s.reason}`);
  if (report.skipped.length) lines.push("");
  for (const p of report.pages) {
    lines.push(`## ${p.url} @ ${p.device || `${p.width}px`} (${p.browser}) — HTTP ${p.status}, ${p.height}px tall`);
    const xs = p.expandedScroller;
    if (xs) lines.push(`- expanded inner scroller \`${xs.selector}\` (${xs.clientHeight}px visible of ${xs.scrollHeight}px, plus ${xs.ancestors} ancestor(s)): page ${xs.documentHeightBefore}px → ${xs.documentHeightAfter}px; pass --no-expand-scroller to capture as rendered`);
    if (p.jsErrors.length) lines.push(`- **blocker** js-error: ${p.jsErrors[0]}`);
    for (const f of p.findings) lines.push(`- **${f.severity}** ${f.rule}: ${f.detail}${f.where ? ` (${f.where})` : ""}`);
    if (!p.findings.length && !p.jsErrors.length) lines.push("- no automated findings");
    lines.push(`- slices: ${p.screenshots.map((s) => s.split("/").pop()).join(", ")}`, "");
  }
  return lines;
}

main().catch((error) => { console.error(`ui_review: ${error.message}`); process.exit(2); });
