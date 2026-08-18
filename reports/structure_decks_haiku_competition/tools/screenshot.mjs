#!/usr/bin/env node
// Screenshots index.html in both themes, so the report can actually be looked at
// (a palette validator checks color, not layout: label collisions, overflow and
// geometry are only visible in a render).
//
// Output goes to .claude_vlm_checks/ — disposable, gitignored, never the report dir.
//
// Usage: node reports/structure_decks_haiku_competition/tools/screenshot.mjs

import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");
const OUT_DIR = join(REPO_ROOT, ".claude_vlm_checks");
/** Wide enough that the 11-column matrix is not the thing being tested by the viewport. */
const VIEWPORT = { width: 1280, height: 1000 };

mkdirSync(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
for (const theme of ["light", "dark"]) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
  await page.goto(pathToFileURL(join(REPORT_DIR, "index.html")).href, { waitUntil: "load" });
  const path = join(OUT_DIR, `report-${theme}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(path);
}
await browser.close();
