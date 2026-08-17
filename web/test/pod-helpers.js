/** Shared bits for the pod tests: profile location, URLs, and opening the Claude tab. */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
/** Persistent Chrome profile: holds the pod's disk (and Claude's sign-in). Gitignored. */
export const PROFILE_DIR = join(REPO_ROOT, ".claude_logs/chrome-profile");
export const BASE_URL = process.env.YGO_URL ?? "http://localhost:5178";
mkdirSync(PROFILE_DIR, { recursive: true });

/**
 * Command. Navigates to a duel page and clicks the Claude tab.
 */
export async function openClaudeTab(page, url) {
  await page.goto(url, { waitUntil: "networkidle0" });
  const buttons = await page.$$("aside button");
  for (const b of buttons) {
    const text = await b.evaluate((e) => e.innerText);
    if (/Claude/.test(text)) { await b.click(); return; }
  }
  throw new Error("Claude tab button not found");
}

/**
 * Command. Waits until `window.__ygoPod` exists (pod booted) or times out.
 */
export async function waitForPod(page, timeoutMs) {
  await page.waitForFunction(() => Boolean(globalThis.__ygoPod), { timeout: timeoutMs });
}
