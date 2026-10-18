#!/usr/bin/env node
// Interaction-state audit (ux-review P8).
//
// For every visible control it measures text and background colour, contrast, and
// focus indication in the default, hover, keyboard-focus and active states. It flags:
//   hover-hides-text    hover drops text contrast below 3:1 while default was readable
//   low-contrast        any state below 4.5:1 (3:1 for large text)
//   no-focus-indicator  Tab focus changes no outline, box-shadow, border or background
//   state-identical     a button-like control looks the same on hover as by default
// It also screenshots each flagged control in the failing state.
//
// The audit points at problems; open the screenshots before you call a page done.
//
// Usage:
//   node ui_states.mjs --url https://host/page [--url ...] [--widths 375,1440]
//     [--browser chromium,webkit,firefox] [--device iphone,android]
//     [--out ./ui-states] [--max 150] [--dismiss "Accept"]
// Playwright: resolved from PLAYWRIGHT_MODULE (path to the package) or `playwright`.
// Browser and device handling is shared with qa-testing (../../qa-testing/scripts/ui_browsers.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureBase, launchAll, loadPlaywright, parseBrowsers, unsupported, variants } from "../../qa-testing/scripts/ui_browsers.mjs";

const CONTROLS = "a[href],button,[role=button],[role=tab],[role=menuitem],summary,input:not([type=hidden]),select,textarea";

function parseArgs(argv) {
  const args = { url: [], widths: "375,1440", out: "ui-states", max: "150", dismiss: "", browser: "chromium", device: "" };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (key === "url") args.url.push(argv[i + 1]);
    else if (key in args) args[key] = argv[i + 1];
    else throw new Error(`unknown option --${key}`);
  }
  if (!args.url.length) throw new Error("at least one --url is required");
  return {
    urls: args.url,
    widths: args.widths.split(",").map(Number).filter(Boolean),
    out: args.out,
    max: Number(args.max) || 150,
    dismiss: args.dismiss.split(",").map((s) => s.trim()).filter(Boolean),
    browsers: parseBrowsers(args.browser),
    devices: args.device,
  };
}

/** In-page: tag visible controls with data-uistate-id and return their count. */
function tagControls({ selector, max }) {
  const hidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return true;
    }
    const r = el.getBoundingClientRect();
    return r.width < 2 || r.height < 2;
  };
  let n = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (n >= max) break;
    if (hidden(el) || el.closest("[aria-hidden=true]")) continue;
    el.setAttribute("data-uistate-id", String(n));
    n += 1;
  }
  return n;
}

/** In-page: computed look of one control, with effective background and contrast. */
function readStyle(id) {
  const el = document.querySelector(`[data-uistate-id="${id}"]`);
  if (!el) return null;
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  let bg = { r: 255, g: 255, b: 255, a: 1 };
  let gradient = false;
  const layers = [];
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.backgroundImage && s.backgroundImage !== "none") gradient = true;
    const c = parse(s.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
  }
  if (layers.length) {
    bg = layers[layers.length - 1].a >= 1 ? layers[layers.length - 1] : blend(layers[layers.length - 1], bg);
    for (let i = layers.length - 2; i >= 0; i -= 1) bg = blend(layers[i], bg);
  }
  const s = getComputedStyle(el);
  let fg = parse(s.color) || { r: 0, g: 0, b: 0, a: 1 };
  if (fg.a < 1) fg = blend(fg, bg);
  const lum = ({ r, g, b }) => {
    const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  const size = parseFloat(s.fontSize);
  const weight = Number(s.fontWeight) || 400;
  const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 50);
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    cls: typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "",
    text,
    hasText: Boolean((el.innerText || el.value || "").trim()),
    buttonLike: el.tagName === "BUTTON" || el.getAttribute("role") === "button" || (el.tagName === "A" && (parse(s.backgroundColor)?.a || 0) > 0),
    large: size >= 24 || (size >= 18.66 && weight >= 700),
    color: s.color,
    background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
    gradient,
    contrast: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100,
    outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
    shadow: s.boxShadow,
    border: `${s.borderTopWidth} ${s.borderTopColor}`,
    bgColor: s.backgroundColor,
    decoration: s.textDecorationLine,
    y: Math.round(rect.top + scrollY),
  };
}

function judge(def, hover, focus, active) {
  const flags = [];
  const min = def.large ? 3 : 4.5;
  if (def.hasText && !def.gradient) {
    if (hover && def.contrast >= 3 && hover.contrast < 3) flags.push({ rule: "hover-hides-text", state: "hover", detail: `contrast ${def.contrast} → ${hover.contrast} (${hover.color} on ${hover.background})` });
    // One low-contrast flag per control, listing every failing state (hover-hides-text already covers hover).
    const low = [["default", def], ["hover", hover], ["focus", focus], ["active", active]]
      .filter(([state, look]) => look && look.contrast < min && !(state === "hover" && flags.length));
    if (low.length) {
      const [state, worst] = low.reduce((a, b) => (b[1].contrast < a[1].contrast ? b : a));
      flags.push({ rule: "low-contrast", state, detail: `${low.map(([s, l]) => `${s} ${l.contrast}:1`).join(", ")} (worst: ${worst.color} on ${worst.background}), needs ${min}:1` });
    }
  }
  const visualKey = (l) => [l.outline, l.shadow, l.border, l.bgColor, l.color, l.decoration].join("|");
  if (focus && visualKey(focus) === visualKey(def)) flags.push({ rule: "no-focus-indicator", state: "focus", detail: "keyboard focus looks the same as default" });
  if (hover && def.buttonLike && visualKey(hover) === visualKey(def)) flags.push({ rule: "state-identical", state: "hover", detail: "hover looks the same as default" });
  return flags;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();
  const list = variants(pw, opts.widths, opts.devices);
  mkdirSync(opts.out, { recursive: true });
  const { launched, failed } = await launchAll(pw, opts.browsers);
  const skipped = failed.map((f) => ({ browser: f.name, reason: `cannot launch: ${f.error}` }));
  const results = [];
  try {
    for (const { name: browserName, browser } of launched) for (const url of opts.urls) {
      for (const variant of list) {
        const why = unsupported(browserName, variant);
        if (why) { skipped.push({ browser: browserName, url, variant: variant.label, reason: why }); continue; }
        const { width } = variant;
        const ctx = await browser.newContext(variant.options);
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        for (const name of opts.dismiss) {
          const btn = page.getByRole("button", { name, exact: true });
          if (await btn.count()) await btn.first().click().catch(() => {});
        }
        await page.waitForTimeout(300);
        const count = await page.evaluate(tagControls, { selector: CONTROLS, max: opts.max });
        for (let id = 0; id < count; id += 1) {
          const loc = page.locator(`[data-uistate-id="${id}"]`);
          try {
            await page.mouse.move(0, 0);
            await page.evaluate(() => document.activeElement?.blur());
            await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
            const def = await page.evaluate(readStyle, id);
            if (!def) continue;
            await loc.hover({ timeout: 2000 });
            await page.waitForTimeout(150);
            const hover = await page.evaluate(readStyle, id);
            const box = await loc.boundingBox();
            let active = null;
            if (box) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.mouse.down();
              await page.waitForTimeout(80);
              active = await page.evaluate(readStyle, id);
              await page.mouse.move(0, 0); // release away from the control so nothing is clicked
              await page.mouse.up();
            }
            // Keyboard focus: focus the previous focusable element, then press Tab, so :focus-visible applies.
            await page.evaluate((i) => {
              const el = document.querySelector(`[data-uistate-id="${i}"]`);
              const all = [...document.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]")].filter((n) => n.tabIndex >= 0);
              const prev = all[all.indexOf(el) - 1];
              if (prev) prev.focus(); else document.body.focus();
            }, id);
            await page.keyboard.press("Tab");
            await page.waitForTimeout(120);
            const focused = await page.evaluate((i) => document.activeElement?.getAttribute("data-uistate-id") === String(i), id);
            const focus = focused ? await page.evaluate(readStyle, id) : null;
            const flags = judge(def, hover, focus, active);
            const shots = [];
            for (const flag of flags) {
              if (flag.state === "hover") await loc.hover({ timeout: 2000 }).catch(() => {});
              const file = join(opts.out, `${captureBase(url, browserName, variant)}-c${id}-${flag.rule}.png`);
              await loc.screenshot({ path: file, timeout: 2000 }).catch(() => {});
              if (!shots.includes(file)) shots.push(file);
              await page.mouse.move(0, 0);
            }
            results.push({ url, width, browser: browserName, device: variant.device, id, element: `${def.tag}${def.cls ? `.${def.cls}` : ""}`, text: def.text, y: def.y, default: def, hover, focus, active, flags, screenshots: shots });
          } catch (error) {
            results.push({ url, width, browser: browserName, device: variant.device, id, error: String(error.message || error).slice(0, 120), flags: [] });
          }
        }
        await ctx.close();
      }
    }
  } finally {
    for (const { browser } of launched) await browser.close();
  }
  const flagged = results.filter((r) => r.flags.length);
  const counts = {};
  for (const r of flagged) for (const f of r.flags) counts[f.rule] = (counts[f.rule] || 0) + 1;
  writeFileSync(join(opts.out, "states.json"), `${JSON.stringify({ created: new Date().toISOString(), browsers: opts.browsers, counts, skipped, results }, null, 2)}\n`);
  const lines = ["# Interaction states", "", `Controls checked: ${results.length} · flagged: ${flagged.length}`, "",
    ...Object.entries(counts).map(([rule, n]) => `- ${rule}: ${n}`), "",
    "Open each screenshot; contrast on gradients and images is not measured (gradient=true).", "",
    ...skipped.map((s) => `- skipped ${s.browser}${s.url ? ` ${s.url} ${s.variant}` : ""}: ${s.reason}`), ""];
  for (const r of flagged) {
    lines.push(`## ${r.url} @ ${r.device || `${r.width}px`} (${r.browser}) — ${r.element} "${r.text}" (y=${r.y})`);
    for (const f of r.flags) lines.push(`- **${f.rule}** (${f.state}): ${f.detail}`);
    if (r.screenshots.length) lines.push(`- screenshots: ${r.screenshots.map((s) => s.split("/").pop()).join(", ")}`);
    lines.push("");
  }
  writeFileSync(join(opts.out, "report.md"), `${lines.join("\n")}\n`);
  if (!launched.length) {
    console.error(`ui_states: no browser could start (${skipped.map((s) => `${s.browser}: ${s.reason}`).join("; ")})`);
    process.exit(2);
  }
  console.log(`ui_states: ${results.length} controls, ${flagged.length} flagged → ${opts.out}/report.md${skipped.length ? ` (${skipped.length} skipped)` : ""}`);
}

main().catch((error) => { console.error(`ui_states: ${error.message}`); process.exit(2); });
