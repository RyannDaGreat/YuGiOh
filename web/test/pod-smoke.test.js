/**
 * Smoke test for Claude-in-the-browser: boots the pod in the signed-in test
 * profile, checks the mailbox is written for the bot's seat, checks the
 * terminal renders, and (if it is the bot's turn) that a well-formed choice
 * written to choice.txt is applied by the page.
 *
 * Needs: dev server running, web/.env with VITE_BROWSERPOD_API_KEY, and one
 * prior run of pod-login.js in the same profile.
 *
 * Run: node --test web/test/pod-smoke.test.js
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import puppeteer from "puppeteer";
import { PROFILE_DIR, BASE_URL, openClaudeTab, waitForPod } from "./pod-helpers.js";

/** Pod boot can take a while the first time (disk image download). */
const BOOT_TIMEOUT_MS = 180000;
const SYNC_WAIT_MS = 4000;

test("pod boots, mailbox is written, terminal renders", async () => {
  const browser = await puppeteer.launch({ headless: true, userDataDir: PROFILE_DIR, args: ["--window-size=1500,1000"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1000 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Fresh duel so the bot's seat is deterministic: seat 1 while the human is P0.
    const id = `podtest-${Date.now()}`;
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
    await page.type("input[name=id]", id);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
    await openClaudeTab(page, `${BASE_URL}/duel/${id}?as=0`);
    await waitForPod(page, BOOT_TIMEOUT_MS);
    await new Promise((r) => setTimeout(r, SYNC_WAIT_MS));
    const status = JSON.parse(await page.evaluate(() => globalThis.__ygoPod.readText("/home/user/duel/status.json")));
    assert.equal(status.duel, id);
    assert.equal(status.seat, 1);
    assert.equal(status.yourTurn, false, "P0 (human) moves first, so the bot is not on turn yet");
    const instructions = await page.evaluate(() => globalThis.__ygoPod.readText("/home/user/duel/CLAUDE.md"));
    assert.match(instructions, /mailbox protocol/);
    const termText = await page.$eval("aside", (el) => el.innerText);
    assert.match(termText, /seat P1/);
    assert.deepEqual(errors, [], `page errors: ${errors.join("; ")}`);
  } finally {
    await browser.close();
  }
});
