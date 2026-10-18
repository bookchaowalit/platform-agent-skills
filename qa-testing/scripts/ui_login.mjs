#!/usr/bin/env node
// Sign in once with a review account and save the browser session for the other UI tools
// (ui_review.mjs / ui_states.mjs --storage-state <file>).
//
// Credentials come from environment variables, never from arguments, and are never
// printed. The saved state holds session cookies: it is written with mode 0600 and must
// stay outside every repository (default ~/.local/state/ui-review/sessions/).
//
// Usage:
//   UI_LOGIN_USER=... UI_LOGIN_PASS=... node ui_login.mjs --url https://host/login \
//     --out ~/.local/state/ui-review/sessions/<app>-<role>.json \
//     [--user-selector "input[type=email]"] [--pass-selector "input[type=password]"] \
//     [--submit-selector "button[type=submit]"] [--success "/dashboard"] \
//     (always pass --success when you know the landing path; it is the strongest check)
//     [--user-env NAME] [--pass-env NAME]
// Login with OTP, LINE or another identity provider cannot be scripted here: sign in by
// hand in a browser and export its storage state instead.

import { createRequire } from "node:module";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {
    url: "", out: "", "user-selector": "input[type=email],input[name=email],input[name=username],input[autocomplete=username]",
    "pass-selector": "input[type=password]", "submit-selector": "button[type=submit],input[type=submit]",
    success: "", "user-env": "UI_LOGIN_USER", "pass-env": "UI_LOGIN_PASS",
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!(key in args)) throw new Error(`unknown option --${key}`);
    args[key] = argv[i + 1];
  }
  if (!args.url || !args.out) throw new Error("--url and --out are required");
  return args;
}

function insideGitRepo(path) {
  try {
    execFileSync("git", ["-C", dirname(path), "rev-parse", "--show-toplevel"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const user = process.env[opts["user-env"]];
  const pass = process.env[opts["pass-env"]];
  if (!user || !pass) throw new Error(`set ${opts["user-env"]} and ${opts["pass-env"]} in the environment`);
  const out = resolve(opts.out.replace(/^~(?=\/)/, process.env.HOME || "~"));
  mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
  if (insideGitRepo(out)) throw new Error(`refusing to save a session inside a git repository: ${out}`);

  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator(opts["user-selector"]).first().fill(user);
    await page.locator(opts["pass-selector"]).first().fill(pass);
    await Promise.all([
      page.waitForLoadState("networkidle").catch(() => {}),
      page.locator(opts["submit-selector"]).first().click(),
    ]);
    await page.waitForTimeout(1500);
    const at = page.url();
    if (opts.success && !at.includes(opts.success)) throw new Error(`sign-in did not reach "${opts.success}" (now at ${new URL(at).pathname})`);
    // A visible password field or one-time-code box means sign-in did not finish, even if the
    // URL changed or stayed the same (some apps show email verification on the login route).
    const pending = page.locator(`${opts["pass-selector"]}:visible, input[autocomplete=one-time-code]:visible`);
    if (await pending.count()) {
      throw new Error("sign-in did not finish: a password or verification-code field is still showing; check the account (email verified?), the selectors or --success");
    }
    await context.storageState({ path: out });
    chmodSync(out, 0o600);
    console.log(`ui_login: signed in, session saved to ${out} (mode 600; keep it out of repositories)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(`ui_login: ${error.message}`); process.exit(2); });
