// Visual regression against approved baselines, for ui_review.mjs --baseline.
//
// Baselines are the full-page slices of the last signed-off capture, one folder per
// URL × browser × width/device, kept outside the product repository next to the sign-off
// evidence: $UI_REVIEW_STATE_DIR/<owner>__<repo>/baselines/<capture-key>/NN.png
// (ui_signoff.py --promote-baseline writes them).
//
// The diff runs inside the browser that is already open (canvas pixels), so it needs no
// image library. Per pixel it compares YIQ colour distance (as pixelmatch does) against a
// threshold, groups changed pixels into 16px cells, and merges touching cells into
// rectangles. The output is one diff image per changed slice (changes in red over a faded
// copy of the new capture, regions boxed) and a list of changed regions in page
// coordinates, so the reviewer only has to look at what changed.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function stateDir() {
  return process.env.UI_REVIEW_STATE_DIR || join(homedir(), ".local", "state", "ui-review");
}

/** owner/name from the origin remote, or the folder name; same rule as ui_review_evidence.py. */
function repoSlug(repo) {
  let url = "";
  try { url = execFileSync("git", ["-C", repo, "remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* no remote */ }
  const match = /[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  if (match) return `${match[1]}/${match[2]}`;
  const top = execFileSync("git", ["-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  return top.split("/").pop();
}

/** --baseline accepts a product repository (baselines live in the state dir) or a folder. */
export function resolveBaselineDir(value) {
  try {
    execFileSync("git", ["-C", value, "rev-parse", "--show-toplevel"], { stdio: "ignore" });
    return join(stateDir(), repoSlug(value).replace("/", "__"), "baselines");
  } catch {
    return value;
  }
}

/** In-page: diff two PNG data URLs. Returns changed ratio, regions and a diff PNG. */
async function diffInPage({ before, after, threshold, cell, minCellPixels }) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cannot decode image"));
    img.src = src;
  });
  const [a, b] = await Promise.all([load(before), load(after)]);
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const pixels = (img) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const pa = pixels(a);
  const pb = pixels(b);
  const yiq = (r, g, bl) => [0.29889531 * r + 0.58662247 * g + 0.11448223 * bl, 0.59597799 * r - 0.2741761 * g - 0.32180189 * bl, 0.21147017 * r - 0.52261711 * g + 0.31114694 * bl];
  const maxDelta = 35215 * threshold * threshold;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const cellCount = new Uint32Array(cols * rows);
  const changed = new Uint8Array(w * h);
  let total = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const outside = x >= a.width || y >= a.height || x >= b.width || y >= b.height;
      let diff = outside;
      if (!outside) {
        const [y1, i1, q1] = yiq(pa[i], pa[i + 1], pa[i + 2]);
        const [y2, i2, q2] = yiq(pb[i], pb[i + 1], pb[i + 2]);
        diff = 0.5053 * (y1 - y2) ** 2 + 0.299 * (i1 - i2) ** 2 + 0.1957 * (q1 - q2) ** 2 > maxDelta;
      }
      if (diff) { changed[y * w + x] = 1; total += 1; cellCount[Math.floor(y / cell) * cols + Math.floor(x / cell)] += 1; }
    }
  }
  // Merge changed cells that touch (8 neighbours) into rectangles.
  const hot = (c) => cellCount[c] >= minCellPixels;
  const seen = new Uint8Array(cols * rows);
  const regions = [];
  for (let start = 0; start < cols * rows; start += 1) {
    if (!hot(start) || seen[start]) continue;
    let [x0, y0, x1, y1, px] = [cols, rows, 0, 0, 0];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % cols;
      const cy = Math.floor(c / cols);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); px += cellCount[c];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          const n = ny * cols + nx;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[n] && hot(n)) { seen[n] = 1; stack.push(n); }
        }
      }
    }
    const x = x0 * cell;
    const y = y0 * cell;
    regions.push({ x, y, width: Math.min(w, (x1 + 1) * cell) - x, height: Math.min(h, (y1 + 1) * cell) - y, pixels: px });
  }
  regions.sort((r1, r2) => r2.pixels - r1.pixels);
  let image = null;
  if (regions.length) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(b, 0, 0);
    const out = ctx.getImageData(0, 0, w, h);
    for (let p = 0; p < w * h; p += 1) {
      const i = p * 4;
      if (changed[p]) { out.data[i] = 230; out.data[i + 1] = 0; out.data[i + 2] = 40; out.data[i + 3] = 255; } else {
        const grey = 0.3 * out.data[i] + 0.59 * out.data[i + 1] + 0.11 * out.data[i + 2];
        for (let k = 0; k < 3; k += 1) out.data[i + k] = 255 - (255 - grey) * 0.25; // faded context
      }
    }
    ctx.putImageData(out, 0, 0);
    ctx.strokeStyle = "rgb(230,0,40)";
    ctx.lineWidth = 3;
    for (const r of regions) ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.width - 3, r.height - 3);
    image = c.toDataURL("image/png");
  }
  return { width: w, height: h, sizeChanged: a.width !== b.width || a.height !== b.height, changedRatio: total / (w * h), regions, image };
}

/**
 * Compare a capture's slices with its baseline folder.
 * capture: { key, screenshots: [file], slice (px), deviceScaleFactor }.
 * Returns { status: "new"|"same"|"changed", regions, diffImages, ... }.
 */
export async function compareCapture(browser, { baselineDir, key, screenshots, sliceHeight, scale = 1, outDir, options = {} }) {
  const folder = join(baselineDir, key);
  if (!existsSync(folder)) return { status: "new", baseline: folder, regions: [], diffImages: [] };
  const { threshold = 0.1, cell = 16, minCellPixels = 4 } = options;
  const page = await (await browser.newContext()).newPage();
  const result = { status: "same", baseline: folder, regions: [], diffImages: [], slices: [] };
  try {
    const count = screenshots.length;
    const baseFiles = [];
    for (let i = 0; existsSync(join(folder, `${String(i).padStart(2, "0")}.png`)); i += 1) baseFiles.push(join(folder, `${String(i).padStart(2, "0")}.png`));
    if (baseFiles.length !== count) result.sliceCount = { baseline: baseFiles.length, current: count };
    for (let i = 0; i < Math.max(count, baseFiles.length); i += 1) {
      const current = screenshots[i];
      const before = baseFiles[i];
      if (!current || !before) {
        result.status = "changed";
        result.regions.push({ slice: i, x: 0, y: i * sliceHeight, width: null, height: null, note: current ? "slice not in baseline (page got taller)" : "baseline slice missing now (page got shorter)" });
        continue;
      }
      const toUrl = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
      const diff = await page.evaluate(diffInPage, { before: toUrl(before), after: toUrl(current), threshold, cell: Math.round(cell * scale), minCellPixels });
      result.slices.push({ slice: i, changedRatio: Math.round(diff.changedRatio * 10000) / 10000, sizeChanged: diff.sizeChanged, regions: diff.regions.length });
      if (!diff.regions.length) continue;
      result.status = "changed";
      const file = join(outDir, `${key}-${String(i).padStart(2, "0")}.diff.png`);
      writeFileSync(file, Buffer.from(diff.image.split(",")[1], "base64"));
      result.diffImages.push(file);
      // Screenshots are in device pixels; report regions in CSS pixels, page coordinates.
      for (const r of diff.regions) {
        result.regions.push({ slice: i, x: Math.round(r.x / scale), y: Math.round(r.y / scale) + i * sliceHeight, width: Math.round(r.width / scale), height: Math.round(r.height / scale), pixels: r.pixels, diff: file });
      }
    }
  } finally {
    await page.context().close();
  }
  return result;
}
