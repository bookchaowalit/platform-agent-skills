#!/usr/bin/env node
// Record walkthrough videos of a web app, one per role and use case, so the owner (or a
// client, a new teammate, an outsourced tester) can see what pages and flows exist
// without reading the code.
//
// Two kinds of scenario, both in one JSON file (see ../references/scenario-format.md):
//   tour     — signs in as a role, collects every menu link that role can see, and visits
//              each page in turn with a caption, cursor and slow scroll. It also writes the
//              role's page map (which pages exist, what each is called, which ones refuse).
//   steps    — a scripted use case: goto, click, fill, select, press, hover, scroll, expect,
//              each with a Thai caption (`say`) that is burned into the video.
//
// Output per run (--out): <id>.webm, <id>.vtt (captions), <id>/NN.png (one frame per step,
// the storyboard you review), manifest.json, page-map.md, and index.html, a gallery grouped
// by role with click-to-seek steps. With --mp4 and an ffmpeg that has libx264, also <id>.mp4.
//
// Read-only by default: every POST/PUT/PATCH/DELETE is aborted and listed in the manifest,
// so a tour of production changes nothing. A scenario that must write needs
// "writes": true in the file AND --allow-writes on the command line.
//
// Usage:
//   node flow_video.mjs --scenarios flows.json [--out ./flow-video] [--only UC-01,TOUR-admin]
//     [--role admin] [--allow-writes] [--mp4] [--font /path/Sarabun-Regular.ttf] [--slow 1]
// Playwright: resolved from PLAYWRIGHT_MODULE (path to the package) or `playwright`.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_LINK = /logout|log-out|sign-?out|ออกจากระบบ/i;

function parseArgs(argv) {
  const args = { scenarios: "", out: "flow-video", only: "", role: "", font: "", slow: "1" };
  const flags = { "allow-writes": false, mp4: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (key in flags) { flags[key] = true; continue; }
    if (!(key in args)) throw new Error(`unknown option --${key}`);
    args[key] = argv[i + 1];
    i += 1;
  }
  if (!args.scenarios) throw new Error("--scenarios <file.json> is required");
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  return {
    scenarios: resolve(args.scenarios), out: resolve(args.out), only: list(args.only), roles: list(args.role),
    font: args.font || process.env.FLOW_VIDEO_FONT || "", slow: Math.max(0.25, Number(args.slow) || 1),
    allowWrites: flags["allow-writes"], mp4: flags.mp4,
  };
}

const expandHome = (p) => (p || "").replace(/^~(?=\/|$)/, homedir());
const slugId = (id) => String(id).replace(/[^a-zA-Z0-9_-]+/g, "-");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Validate the scenario file and fill defaults; throws with every problem listed. */
export function loadSpec(path) {
  const spec = JSON.parse(readFileSync(path, "utf8"));
  const problems = [];
  if (!spec.baseUrl) problems.push("baseUrl is required");
  spec.roles = spec.roles || {};
  spec.viewport = spec.viewport || { width: 1440, height: 900 };
  spec.readOnly = spec.readOnly !== false;
  const seen = new Set();
  for (const [i, sc] of (spec.scenarios || []).entries()) {
    const where = `scenarios[${i}]${sc.id ? ` (${sc.id})` : ""}`;
    if (!sc.id) problems.push(`${where}: id is required`);
    else if (seen.has(sc.id)) problems.push(`${where}: duplicate id`);
    seen.add(sc.id);
    if (!sc.title) problems.push(`${where}: title is required`);
    if (sc.role && !spec.roles[sc.role]) problems.push(`${where}: role "${sc.role}" is not in roles`);
    if (!sc.tour && !Array.isArray(sc.steps)) problems.push(`${where}: needs "tour" or "steps"`);
    for (const [j, step] of (sc.steps || []).entries()) {
      const actions = ["goto", "click", "fill", "select", "press", "hover", "scroll", "expect", "pause"].filter((k) => k in step);
      if (actions.length > 1) problems.push(`${where} step ${j + 1}: one action per step (found ${actions.join(", ")})`);
      if (!actions.length && !step.say) problems.push(`${where} step ${j + 1}: empty step`);
      if (("fill" in step || "select" in step) && !("value" in step)) problems.push(`${where} step ${j + 1}: fill/select needs value`);
    }
  }
  if (!spec.scenarios?.length) problems.push("scenarios is empty");
  if (problems.length) throw new Error(`invalid scenario file ${path}:\n  - ${problems.join("\n  - ")}`);
  return spec;
}

// ---------------------------------------------------------------- overlay (runs in the page)

// Injected into every document with addInitScript, so it survives navigation. Lives in a
// closed shadow root with pointer-events: none, so it never changes layout or steals clicks.
function overlayInit(fontData) {
  if (window.top !== window) return;
  const boot = () => {
    if (window.__flow) return;
    const host = document.createElement("flow-video-overlay");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:var(--ff),"Sarabun","Noto Sans Thai","Leelawadee UI",system-ui,sans-serif}
      .bar{position:fixed;left:24px;right:24px;bottom:24px;display:flex;gap:16px;align-items:center;padding:14px 20px;
        border-radius:14px;background:rgba(17,24,39,.88);color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);
        transition:opacity .25s;opacity:0}
      .bar.on{opacity:1}
      .chip{flex:none;padding:4px 12px;border-radius:999px;background:#2563eb;font-size:15px;font-weight:600;white-space:nowrap}
      .txt{flex:1;min-width:0}.ttl{font-size:13px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .say{font-size:22px;line-height:1.35;font-weight:600}
      .cnt{flex:none;font-size:14px;opacity:.75;font-variant-numeric:tabular-nums}
      .cur{position:fixed;left:0;top:0;width:28px;height:28px;transform:translate(-200px,-200px);
        transition:transform .7s cubic-bezier(.45,.05,.25,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
      .ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f59e0b;
        opacity:0;transform:scale(.3)}
      .ring.go{animation:ring .6s ease-out}
      @keyframes ring{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
      .box{position:fixed;border:3px solid #f59e0b;border-radius:8px;box-shadow:0 0 0 9999px rgba(15,23,42,.18);
        opacity:0;transition:all .35s}
      .box.on{opacity:1}
      .card{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.94);
        color:#fff;opacity:0;transition:opacity .35s}
      .card.on{opacity:1}
      .card .in{max-width:900px;padding:40px;text-align:center}
      .card .k{font-size:18px;opacity:.7;margin-bottom:10px}.card h1{font-size:44px;margin:0 0 14px;line-height:1.25}
      .card p{font-size:22px;opacity:.9;margin:8px 0;line-height:1.5}
      .card .chip{display:inline-block;font-size:20px;margin-top:16px}
    </style>
    <div class="box"></div><div class="ring"></div>
    <svg class="cur" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.4L21 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>
    <div class="bar"><span class="chip"></span><div class="txt"><div class="ttl"></div><div class="say"></div></div><span class="cnt"></span></div>
    <div class="card"><div class="in"></div></div>`;
    const $ = (s) => root.querySelector(s);
    const setFont = () => {
      const page = getComputedStyle(document.body || document.documentElement).fontFamily;
      host.style.setProperty("--ff", window.__flowFont ? `"FlowVideo",${page}` : page);
    };
    if (fontData && !window.__flowFont) {
      try {
        const bin = Uint8Array.from(atob(fontData), (c) => c.charCodeAt(0));
        const face = new FontFace("FlowVideo", bin.buffer);
        document.fonts.add(face);
        window.__flowFont = true;
      } catch { /* fall back to the page font */ }
    }
    let cursor = { x: -200, y: -200 };
    window.__flow = {
      caption({ role, title, say, n, total, color }) {
        setFont();
        $(".chip").textContent = role || "";
        $(".chip").style.background = color || "#2563eb";
        $(".chip").style.display = role ? "" : "none";
        $(".ttl").textContent = title || "";
        $(".say").textContent = say || "";
        $(".cnt").textContent = total ? `${n}/${total}` : "";
        $(".bar").classList.toggle("on", Boolean(say));
      },
      card(html) {
        setFont();
        $(".card .in").innerHTML = html || "";
        $(".card").classList.toggle("on", Boolean(html));
      },
      move(x, y) { cursor = { x, y }; $(".cur").style.transform = `translate(${x - 4}px,${y - 2}px)`; },
      where() { return cursor; },
      ring(x, y) { const r = $(".ring"); r.style.left = `${x}px`; r.style.top = `${y}px`; r.classList.remove("go"); void r.offsetWidth; r.classList.add("go"); },
      box(rect) {
        const b = $(".box");
        if (!rect) { b.classList.remove("on"); return; }
        Object.assign(b.style, { left: `${rect.x - 6}px`, top: `${rect.y - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` });
        b.classList.add("on");
      },
    };
    document.documentElement.appendChild(host);
  };
  if (document.documentElement) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
  // Some frameworks replace <html> children on hydration; put the overlay back if it goes.
  new MutationObserver(() => {
    if (window.__flow && !document.querySelector("flow-video-overlay")) { window.__flow = null; boot(); }
  }).observe(document, { childList: true, subtree: true });
}

// ---------------------------------------------------------------- recording helpers

const ROLE_COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

async function settle(page, ms = 12000) {
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
}

/** Call the overlay, waiting for it to exist after a navigation. */
async function overlay(page, fn, arg) {
  for (let i = 0; i < 20; i += 1) {
    const ok = await page.evaluate(([f, a]) => {
      if (!window.__flow) return false;
      window.__flow[f](...(Array.isArray(a) ? a : [a]));
      return true;
    }, [fn, arg]).catch(() => false);
    if (ok) return;
    await page.waitForTimeout(150);
  }
}

/** Glide the fake cursor to the middle of an element and frame it. Returns the point. */
async function pointAt(page, locator, pace) {
  await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  const box = await locator.boundingBox();
  if (!box) return null;
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await overlay(page, "box", [box]);
  await overlay(page, "move", [x, y]);
  await page.waitForTimeout(800 * pace);
  return { x, y };
}

/** Largest scrollable element (app shells often scroll an inner pane, not the window). */
async function scrollPage(page, pace, target) {
  await page.evaluate(async ({ pace: p, target: t }) => {
    const candidates = [document.scrollingElement, ...document.querySelectorAll("main,[class*=scroll],[class*=content],div")]
      .filter(Boolean)
      .filter((el) => {
        const s = getComputedStyle(el);
        return el === document.scrollingElement || /(auto|scroll)/.test(s.overflowY);
      })
      .filter((el) => el.scrollHeight - el.clientHeight > 60);
    candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    const el = candidates[0];
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const to = t === "top" ? 0 : t === "bottom" || t == null ? Math.min(max, 2400) : Math.min(max, Number(t));
    const from = el.scrollTop;
    const steps = Math.max(8, Math.round(Math.abs(to - from) / 40));
    for (let i = 1; i <= steps; i += 1) {
      el.scrollTop = from + ((to - from) * i) / steps;
      await new Promise((r) => setTimeout(r, 28 * p));
    }
  }, { pace, target });
}

function readTime(text, pace) {
  return Math.round(Math.min(5000, Math.max(1600, String(text || "").length * 55)) * pace);
}

// ---------------------------------------------------------------- scenario runners

async function runSteps(page, ctx, sc, spec, rec) {
  const steps = sc.steps;
  for (const [i, step] of steps.entries()) {
    const n = i + 1;
    const say = step.say || "";
    rec.mark(n, say);
    await overlay(page, "caption", [{ ...ctx.caption, say, n, total: steps.length }]);
    const loc = (sel) => page.locator(sel).first();
    if ("goto" in step) {
      const res = await page.goto(new URL(step.goto, spec.baseUrl).href, { waitUntil: "load", timeout: 60000 });
      await settle(page);
      rec.status(n, res?.status());
      await overlay(page, "caption", [{ ...ctx.caption, say, n, total: steps.length }]);
      await page.waitForTimeout(readTime(say, ctx.pace));
    } else if ("click" in step) {
      const target = loc(step.click);
      await target.waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(readTime(say, ctx.pace) / 2);
      const pt = await pointAt(page, target, ctx.pace);
      if (pt) await overlay(page, "ring", [pt.x, pt.y]);
      await page.waitForTimeout(250);
      await overlay(page, "box", [null]);
      await target.click({ timeout: 10000 });
      await settle(page, 8000);
      await overlay(page, "caption", [{ ...ctx.caption, say, n, total: steps.length }]);
      await page.waitForTimeout(readTime(say, ctx.pace) / 2);
    } else if ("fill" in step || "select" in step) {
      const target = loc(step.fill ?? step.select);
      await target.waitFor({ state: "visible", timeout: 15000 });
      const pt = await pointAt(page, target, ctx.pace);
      if (pt) await overlay(page, "ring", [pt.x, pt.y]);
      if ("select" in step) await target.selectOption(step.value);
      else {
        await target.click();
        await target.fill("");
        await target.pressSequentially(String(step.value), { delay: Math.round(55 * ctx.pace) });
      }
      await page.waitForTimeout(readTime(say, ctx.pace) / 2);
      await overlay(page, "box", [null]);
    } else if ("press" in step) {
      await page.keyboard.press(step.press);
      await settle(page, 8000);
      await page.waitForTimeout(readTime(say, ctx.pace));
    } else if ("hover" in step) {
      const target = loc(step.hover);
      await target.waitFor({ state: "visible", timeout: 15000 });
      await pointAt(page, target, ctx.pace);
      await target.hover();
      await page.waitForTimeout(readTime(say, ctx.pace));
      await overlay(page, "box", [null]);
    } else if ("scroll" in step) {
      if (typeof step.scroll === "string" && !["top", "bottom"].includes(step.scroll) && !/^\d+$/.test(step.scroll)) {
        const target = loc(step.scroll);
        await target.scrollIntoViewIfNeeded({ timeout: 10000 });
        const box = await target.boundingBox();
        if (box) await overlay(page, "box", [box]);
        await page.waitForTimeout(readTime(say, ctx.pace));
        await overlay(page, "box", [null]);
      } else {
        await scrollPage(page, ctx.pace, step.scroll);
        await page.waitForTimeout(readTime(say, ctx.pace) / 2);
      }
    } else if ("expect" in step) {
      const target = loc(step.expect);
      await target.waitFor({ state: "visible", timeout: 15000 });
      const box = await target.boundingBox();
      if (box) await overlay(page, "box", [box]);
      await page.waitForTimeout(readTime(say, ctx.pace));
      await overlay(page, "box", [null]);
    } else {
      await page.waitForTimeout(step.pause ?? readTime(say, ctx.pace));
    }
    ctx.checkSession();
    await rec.frame(n);
  }
}

/** Menu links the signed-in role can see on the start page, in on-screen order. */
async function collectLinks(page, spec, tour) {
  const nav = tour.nav || "nav a[href], aside a[href], [role=navigation] a[href], header a[href]";
  const origin = new URL(spec.baseUrl).origin;
  const raw = await page.$$eval(nav, (els) => els.map((a) => ({
    // Links inside a collapsed menu group have no innerText; textContent still has the label.
    href: a.href, text: (a.innerText.trim() || a.textContent.trim() || a.getAttribute("aria-label") || a.title || "").replace(/\s+/g, " ").trim(),
  })));
  const exclude = (tour.exclude || []).map((p) => new RegExp(p));
  const seen = new Set();
  const out = [];
  for (const link of raw) {
    let u;
    try { u = new URL(link.href); } catch { continue; }
    if (u.origin !== origin || SKIP_LINK.test(u.pathname) || SKIP_LINK.test(link.text)) continue;
    if (exclude.some((re) => re.test(u.pathname))) continue;
    const key = u.pathname.replace(/\/$/, "") || "/";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path: key + u.search, label: link.text || key });
  }
  for (const extra of tour.include || []) {
    const key = typeof extra === "string" ? extra : extra.path;
    if (!seen.has(key)) { seen.add(key); out.push({ path: key, label: extra.label || key }); }
  }
  return out.slice(0, tour.max || 30);
}

async function runTour(page, ctx, sc, spec, rec) {
  const tour = sc.tour === true ? {} : sc.tour;
  const start = new URL(tour.start || "/", spec.baseUrl).href;
  await page.goto(start, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  ctx.checkSession();
  const links = await collectLinks(page, spec, tour);
  rec.pages = [];
  const denied = new RegExp(tour.denied || "not in account scope|ไม่มีสิทธิ์|ไม่อยู่ในขอบเขต|access denied|permission denied", "i");
  for (const [i, link] of links.entries()) {
    const n = i + 1;
    const say = `หน้า ${link.label}`;
    rec.mark(n, say);
    await overlay(page, "caption", [{ ...ctx.caption, say, n, total: links.length }]);
    const href = new URL(link.path, spec.baseUrl).href;
    // Click the real menu item when it is on screen, so the viewer sees where it lives.
    const menu = page.locator(`a[href="${link.path}"], a[href="${href}"]`).filter({ visible: true }).first();
    let status = null;
    if (await menu.count()) {
      const pt = await pointAt(page, menu, ctx.pace);
      if (pt) await overlay(page, "ring", [pt.x, pt.y]);
      await page.waitForTimeout(200);
      await overlay(page, "box", [null]);
      const nav = page.waitForEvent("framenavigated", { timeout: 15000 }).catch(() => null);
      await menu.click({ timeout: 10000 }).catch(() => page.goto(href));
      await nav;
    } else {
      const res = await page.goto(href, { waitUntil: "load", timeout: 60000 });
      status = res?.status() ?? null;
    }
    await settle(page);
    ctx.checkSession();
    await overlay(page, "caption", [{ ...ctx.caption, say, n, total: links.length }]);
    const info = await page.evaluate(() => ({
      heading: (document.querySelector("h1")?.innerText || document.title || "").replace(/\s+/g, " ").trim(),
      text: (document.body?.innerText || "").slice(0, 4000),
      path: location.pathname + location.search,
    }));
    const access = status && status >= 400 ? `HTTP ${status}` : denied.test(info.text) ? "denied" : "open";
    rec.pages.push({ n, label: link.label, path: link.path, landed: info.path, heading: info.heading, access });
    await page.waitForTimeout(readTime(say, ctx.pace) / 2);
    await rec.frame(n);
    if (access === "open" && tour.scroll !== false) {
      await scrollPage(page, ctx.pace, "bottom");
      await page.waitForTimeout(600 * ctx.pace);
      await scrollPage(page, ctx.pace, "top");
    }
    await page.waitForTimeout(500 * ctx.pace);
  }
  if (!links.length) throw new Error(`no menu links found on ${start} with selector "${tour.nav || "default"}"`);
}

function vtt(stepsMs, endMs) {
  const t = (ms) => {
    const d = new Date(Math.max(0, ms));
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
  };
  const cues = stepsMs.map((s, i) => `${i + 1}\n${t(s.at)} --> ${t(stepsMs[i + 1]?.at ?? endMs)}\n${s.say || `ขั้นที่ ${s.n}`}\n`);
  return `WEBVTT\n\n${cues.join("\n")}`;
}

function findFfmpeg() {
  for (const bin of [process.env.FLOW_VIDEO_FFMPEG, "ffmpeg"].filter(Boolean)) {
    try {
      const enc = execFileSync(bin, ["-hide_banner", "-encoders"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
      if (enc.includes("libx264")) return bin;
    } catch { /* not this one */ }
  }
  return null;
}

async function recordScenario(browser, spec, sc, opts, fontData, roleIndex) {
  const role = sc.role ? spec.roles[sc.role] : null;
  const dir = join(opts.out, ".raw", slugId(sc.id));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(opts.out, slugId(sc.id)), { recursive: true });
  const storageState = role?.storageState ? expandHome(role.storageState) : undefined;
  if (storageState && !existsSync(storageState)) throw new Error(`session for role "${sc.role}" not found: ${storageState} (run qa-testing/scripts/ui_login.mjs)`);
  const viewport = sc.viewport || spec.viewport;
  const context = await browser.newContext({
    viewport, recordVideo: { dir, size: viewport }, storageState, serviceWorkers: "block",
    locale: spec.locale || "th-TH", timezoneId: spec.timezone || "Asia/Bangkok", deviceScaleFactor: 1,
  });
  const writes = Boolean(sc.writes) && opts.allowWrites && spec.readOnly !== true;
  const blocked = [];
  if (!writes) {
    const allow = (spec.allowPost || []).map((p) => new RegExp(p));
    await context.route("**/*", (route) => {
      const req = route.request();
      if (WRITE_METHODS.has(req.method()) && !allow.some((re) => re.test(req.url()))) {
        blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
  }
  await context.addInitScript(overlayInit, fontData);
  const page = await context.newPage();
  // A saved session that has expired lands on the sign-in page; recording that would show the
  // public site under the role's name. Stop instead and say which session to renew.
  const loginRe = new RegExp(spec.loginPath || "^/(login|signin|sign-in|auth/login)(/|$)", "i");
  let signedOut = "";
  if (storageState) {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && loginRe.test(new URL(frame.url()).pathname)) signedOut = new URL(frame.url()).pathname;
    });
  }
  const checkSession = () => {
    if (signedOut) throw new Error(`role "${sc.role}" landed on ${signedOut}: the saved session has expired; sign in again with qa-testing/scripts/ui_login.mjs`);
  };
  const t0 = Date.now();
  const pace = opts.slow * (sc.slow || 1);
  const caption = { role: role?.label || sc.role || "", title: `${sc.id} · ${sc.title}`, color: role?.color || ROLE_COLORS[roleIndex % ROLE_COLORS.length] };
  const rec = {
    steps: [], pages: null,
    mark(n, say) { this.steps.push({ n, say, at: Date.now() - t0 }); },
    status(n, code) { const s = this.steps.find((x) => x.n === n); if (s) s.status = code ?? null; },
    async frame(n) {
      const file = join(slugId(sc.id), `${String(n).padStart(2, "0")}.png`);
      await page.screenshot({ path: join(opts.out, file) }).catch(() => {});
      const s = this.steps.find((x) => x.n === n);
      if (s) s.frame = file;
    },
  };
  const ctx = { caption, pace, checkSession };
  let error = null;
  try {
    // Title card on a blank page first, so the video opens on the use case, not a spinner.
    await page.goto("about:blank");
    await page.setContent("<!doctype html><html lang='th'><body style='margin:0;background:#0f172a'></body></html>");
    await overlay(page, "card", [`<div class="k">${esc(spec.app || new URL(spec.baseUrl).host)} · ${esc(sc.id)}</div><h1>${esc(sc.title)}</h1>`
      + (sc.goal ? `<p>${esc(sc.goal)}</p>` : "") + (caption.role ? `<span class="chip" style="background:${caption.color}">${esc(caption.role)}</span>` : "")]);
    await page.waitForTimeout(3000 * pace);
    await overlay(page, "card", [""]);
    if (sc.tour) await runTour(page, ctx, sc, spec, rec);
    else await runSteps(page, ctx, sc, spec, rec);
    await overlay(page, "caption", [{ ...caption, say: "" }]);
    if (sc.outcome) {
      await overlay(page, "card", [`<div class="k">ผลลัพธ์</div><h1>${esc(sc.outcome)}</h1>`]);
      await page.waitForTimeout(2500 * pace);
    } else await page.waitForTimeout(800);
  } catch (e) {
    error = e.message.split("\n")[0];
    const failStep = rec.steps.at(-1)?.n ?? 0;
    await overlay(page, "caption", [{ ...caption, say: `หยุด: ขั้นที่ ${failStep} ทำไม่สำเร็จ`, n: failStep, total: sc.steps?.length || 0 }]);
    await page.screenshot({ path: join(opts.out, slugId(sc.id), "failed.png") }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const endMs = Date.now() - t0;
  const video = page.video();
  await context.close();
  const webm = `${slugId(sc.id)}.webm`;
  renameSync(await video.path(), join(opts.out, webm));
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(join(opts.out, `${slugId(sc.id)}.vtt`), vtt(rec.steps, endMs));
  let mp4 = null;
  if (opts.ffmpeg) {
    mp4 = `${slugId(sc.id)}.mp4`;
    execFileSync(opts.ffmpeg, ["-y", "-loglevel", "error", "-i", join(opts.out, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-preset", "medium", "-crf", "22", "-movflags", "+faststart", join(opts.out, mp4)]);
  }
  return {
    id: sc.id, title: sc.title, goal: sc.goal || "", outcome: sc.outcome || "", role: sc.role || "", roleLabel: caption.role,
    color: caption.color, kind: sc.tour ? "tour" : "steps", refs: sc.refs || [], video: webm, mp4, captions: `${slugId(sc.id)}.vtt`,
    durationMs: endMs, steps: rec.steps, pages: rec.pages, writesAllowed: writes, blockedWrites: [...new Set(blocked)],
    status: error ? "failed" : "ok", error,
  };
}

// ---------------------------------------------------------------- reports

function pageMap(spec, results) {
  const tours = results.filter((r) => r.pages);
  if (!tours.length) return "";
  const lines = [`# Page map · ${spec.app || spec.baseUrl}`, "", `Recorded ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from ${spec.baseUrl}. Read-only tour per role; generated by flow_video.mjs.`, ""];
  const paths = [];
  for (const t of tours) for (const p of t.pages) if (!paths.some((x) => x.path === p.path)) paths.push(p);
  lines.push(`| Page | Path | ${tours.map((t) => t.roleLabel || t.role).join(" | ")} |`, `|---|---|${tours.map(() => "---").join("|")}|`);
  for (const p of paths) {
    const cells = tours.map((t) => {
      const hit = t.pages.find((x) => x.path === p.path);
      return !hit ? "—" : hit.access === "open" ? "✓" : `✗ ${hit.access}`;
    });
    lines.push(`| ${p.label} | \`${p.path}\` | ${cells.join(" | ")} |`);
  }
  lines.push("", "✓ open in the menu · ✗ in the menu but refused · — not in this role's menu", "");
  for (const t of tours) {
    lines.push(`## ${t.roleLabel || t.role} (${t.id})`, "", "| # | Menu label | Heading on page | Landed at | Access |", "|---|---|---|---|---|");
    for (const p of t.pages) lines.push(`| ${p.n} | ${p.label} | ${p.heading} | \`${p.landed}\` | ${p.access} |`);
    lines.push("");
  }
  return lines.join("\n");
}

function gallery(spec, results) {
  const byRole = new Map();
  for (const r of results) {
    const key = r.roleLabel || r.role || "ทั่วไป";
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key).push(r);
  }
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const cards = [...byRole.entries()].map(([role, list]) => `
  <section><h2><span class="dot" style="background:${list[0].color}"></span>${esc(role)}</h2><div class="grid">
  ${list.map((r) => `<article class="card${r.status === "ok" ? "" : " bad"}" id="${esc(r.id)}">
    <video controls preload="metadata" poster="${esc(r.steps[0]?.frame || "")}"><source src="${esc(r.mp4 || r.video)}" type="video/${r.mp4 ? "mp4" : "webm"}"><track kind="captions" srclang="th" label="ไทย" src="${esc(r.captions)}" default></video>
    <div class="meta"><span class="tag">${r.kind === "tour" ? "พาชมทุกหน้า" : "Use case"}</span><span class="id">${esc(r.id)}</span><span class="dur">${fmt(r.durationMs)}</span>${r.refs.map((x) => `<span class="ref">${esc(x)}</span>`).join("")}</div>
    <h3>${esc(r.title)}</h3>${r.goal ? `<p class="goal">${esc(r.goal)}</p>` : ""}
    ${r.status === "ok" ? "" : `<p class="err">อัดไม่สำเร็จ: ${esc(r.error)}</p>`}
    <ol>${r.steps.map((s) => `<li><button data-t="${(s.at / 1000).toFixed(1)}"><span class="ts">${fmt(s.at)}</span>${esc(s.say || `ขั้นที่ ${s.n}`)}</button></li>`).join("")}</ol>
    ${r.outcome ? `<p class="out">ผลลัพธ์: ${esc(r.outcome)}</p>` : ""}
    ${r.blockedWrites.length ? `<p class="note">กันการเขียนข้อมูลไว้ ${r.blockedWrites.length} คำขอ (โหมดอ่านอย่างเดียว)</p>` : ""}
  </article>`).join("")}
  </div></section>`).join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(spec.app || "App")} · Flow videos</title>
<style>
:root{--bg:#f8fafc;--fg:#0f172a;--mut:#475569;--card:#fff;--line:#e2e8f0;--acc:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#0b1120;--fg:#e2e8f0;--mut:#94a3b8;--card:#111827;--line:#1f2937;--acc:#60a5fa}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "Sarabun","Noto Sans Thai",system-ui,sans-serif}
header,main{max-width:1280px;margin:0 auto;padding:24px 16px}header h1{margin:0 0 4px;font-size:28px}header p{margin:0;color:var(--mut)}
h2{display:flex;align-items:center;gap:10px;font-size:22px;margin:28px 0 12px}.dot{width:14px;height:14px;border-radius:50%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;padding-bottom:12px}.card.bad{border-color:#dc2626}
video{width:100%;display:block;background:#000;aspect-ratio:16/10}
.meta{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px 0;font-size:13px;color:var(--mut)}.tag{color:var(--acc);font-weight:600}
.ref{border:1px solid var(--line);border-radius:6px;padding:0 6px}
h3{margin:4px 16px 0;font-size:19px}.goal,.out,.note,.err{margin:4px 16px;color:var(--mut)}.err{color:#dc2626}
ol{margin:8px 0 0;padding:0 16px 0 36px;max-height:240px;overflow:auto}li{margin:2px 0}
li button{all:unset;cursor:pointer;display:flex;gap:10px}li button:hover{color:var(--acc)}.ts{color:var(--mut);font-variant-numeric:tabular-nums;min-width:38px}
</style></head><body>
<header><h1>${esc(spec.app || "App")} · วิดีโอ flow การใช้งาน</h1><p>${esc(spec.baseUrl)} · ${results.length} วิดีโอ · ${byRole.size} role · อัดเมื่อ ${new Date().toISOString().slice(0, 10)}${spec.readOnly ? " · โหมดอ่านอย่างเดียว" : ""}</p></header>
<main>${cards}</main>
<script>document.querySelectorAll("li button").forEach(b=>b.addEventListener("click",()=>{const v=b.closest(".card").querySelector("video");v.currentTime=+b.dataset.t;v.play()}));</script>
</body></html>`;
}

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const spec = loadSpec(opts.scenarios);
  let scenarios = spec.scenarios;
  if (opts.only.length) scenarios = scenarios.filter((s) => opts.only.includes(s.id));
  if (opts.roles.length) scenarios = scenarios.filter((s) => opts.roles.includes(s.role));
  if (!scenarios.length) throw new Error("no scenario matches --only/--role");
  const refused = scenarios.filter((s) => s.writes && !(opts.allowWrites && !spec.readOnly));
  if (refused.length) {
    console.error(`flow_video: ${refused.map((s) => s.id).join(", ")} write data; they run with writes blocked unless the file sets "readOnly": false and you pass --allow-writes`);
  }
  if (opts.mp4) {
    opts.ffmpeg = findFfmpeg();
    if (!opts.ffmpeg) console.error("flow_video: --mp4 needs ffmpeg with libx264 on PATH or FLOW_VIDEO_FFMPEG; writing WebM only");
  }
  const fontPath = expandHome(opts.font);
  if (fontPath && !existsSync(fontPath)) throw new Error(`font not found: ${fontPath}`);
  const fontData = fontPath ? readFileSync(fontPath).toString("base64") : "";
  mkdirSync(opts.out, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch();
  const roleOrder = Object.keys(spec.roles);
  const manifestPath = join(opts.out, "manifest.json");
  // Re-recording one scenario keeps the others in the gallery.
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")).results || [] : [];
  const results = [];
  try {
    for (const sc of scenarios) {
      process.stdout.write(`flow_video: recording ${sc.id} (${sc.role || "no role"}) … `);
      const r = await recordScenario(browser, spec, sc, opts, fontData, Math.max(0, roleOrder.indexOf(sc.role)));
      results.push(r);
      console.log(`${r.status}${r.error ? `: ${r.error}` : ""} · ${(r.durationMs / 1000).toFixed(0)}s · ${r.steps.length} steps${r.blockedWrites.length ? ` · ${r.blockedWrites.length} write(s) blocked` : ""}`);
    }
  } finally {
    await browser.close();
  }
  const order = spec.scenarios.map((s) => s.id);
  const merged = [...previous.filter((p) => !results.some((r) => r.id === p.id) && order.includes(p.id)), ...results]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  writeFileSync(manifestPath, JSON.stringify({ app: spec.app, baseUrl: spec.baseUrl, recordedAt: new Date().toISOString(), readOnly: spec.readOnly, results: merged }, null, 2));
  const map = pageMap(spec, merged);
  if (map) writeFileSync(join(opts.out, "page-map.md"), map);
  writeFileSync(join(opts.out, "index.html"), gallery(spec, merged));
  copyFileSync(opts.scenarios, join(opts.out, "scenarios.json"));
  const failed = results.filter((r) => r.status !== "ok");
  console.log(`flow_video: ${results.length - failed.length}/${results.length} ok → ${join(opts.out, "index.html")}`);
  if (failed.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => { console.error(`flow_video: ${error.message}`); process.exit(2); });
}

export { collectLinks, pageMap, vtt };
