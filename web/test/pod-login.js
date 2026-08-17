/**
 * One-time sign-in helper for the in-browser Claude bot.
 *
 * Opens a HEADFUL Chrome with the persistent test profile, loads a duel page,
 * switches to the Claude tab and boots the pod. The first time, Claude Code
 * prints an OAuth link; the page opens it in a new tab — sign in with your
 * Claude account, copy the code, paste it into the terminal. Credentials live
 * in the pod's browser storage inside this Chrome profile, so every later test
 * (pod-smoke.test.js, same profile) is already signed in.
 *
 * Usage:  node web/test/pod-login.js [duelId] [seat]     (dev server must be running)
 */
import puppeteer from "puppeteer";
import { PROFILE_DIR, BASE_URL, openClaudeTab } from "./pod-helpers.js";

const duelId = process.argv[2] ?? "t1";
const seat = process.argv[3] ?? "0";
const browser = await puppeteer.launch({ headless: false, userDataDir: PROFILE_DIR, defaultViewport: null, args: ["--window-size=1500,1000"] });
const page = (await browser.pages())[0] ?? (await browser.newPage());
await openClaudeTab(page, `${BASE_URL}/duel/${duelId}?as=${seat}`);
console.log("Claude tab open. Sign in when the OAuth tab appears; paste the code into the terminal.");
console.log("Leave this window until Claude Code shows its prompt, then close it (Ctrl-C here).");
await new Promise(() => {}); // stay open until the user closes it
