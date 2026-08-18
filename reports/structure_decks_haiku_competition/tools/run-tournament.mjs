#!/usr/bin/env node
// The tournament driver: plays every duel in schedule.json with two headless
// Haiku agents (one per seat) and keeps a fixed number of matches in flight.
//
// WHY A DRIVER AND NOT THE ORCHESTRATING SESSION: 363 duels x 2 seats = 726
// agents. Spawning them from a conversation would spend the whole context on
// bookkeeping. This script owns the pool; the tournament's state lives entirely
// in the duel records, so the driver is stoppable and resumable at any moment.
//
// NO SHORTCUTS, AND NO ABANDONED DUELS: a duel counts only when the RULES ENGINE
// declares it over. Nothing is ever resolved by life points, by random play, or
// by assumption. Two mechanisms guarantee it:
//
//   1. RELAUNCH — if a pair of agents stops early or dies, a fresh pair is
//      launched on the SAME record. The CLI is stateless, so they simply pick the
//      game up mid-board. This repeats until the engine says the duel is over.
//   2. NUDGE (the forcing mechanism) — a relaunched pair can in principle stall
//      the same way twice (both agents idling, or one refusing a hard decision).
//      So after any pair round that fails to finish the duel, the driver forces
//      at least one move: it finds the seat the engine is waiting on and runs a
//      single-decision Haiku agent whose whole job is to answer that one menu and
//      exit. Every menu has at least one legal answer, so this always terminates,
//      and the decision is still made by a Haiku agent — never by the driver.
//      A board that survives many focused single-decision agents is a bug to
//      surface, not a result to fabricate: the driver logs it and moves on so the
//      next run can retry it.
//
// Usage:
//   node reports/structure_decks_haiku_competition/tools/run-tournament.mjs [--matches 10] [--only SDY] [--dry-run]

import { spawn, execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDuel, loadDuel, loadDeck } from "../../../src/store.js";
import { viewDuel } from "../../../src/session.js";

const execFile = promisify(execFileCb);
const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(REPORT_DIR, "..", "..");

/** Concurrent duels. The user's budget is 20 Haiku agents, and a duel needs two. */
const DEFAULT_MATCHES = 10;
/** Kill a claude process that has not exited in this long; a fresh pair resumes the board.
 *  Generous, because at high concurrency a healthy agent waits a long time for its opponent. */
const AGENT_TIMEOUT_MS = 90 * 60 * 1000;
/** A single-decision nudge agent has one menu to answer; if it cannot do that in five minutes it is lost. */
const NUDGE_TIMEOUT_MS = 5 * 60 * 1000;
/** Relaunch rounds per duel before the driver leaves it for the next run (and says so loudly). */
const MAX_ATTEMPTS = 30;
/** Single-decision agents to try when a pair round left the duel unfinished, before calling it stuck. */
const NUDGE_TRIES = 6;
/** Model every seat is played by — seat agents and nudge agents alike, never anything costlier.
 *  The whole point of the exercise: equal players, unequal decks. */
const MODEL = "haiku";
/** Hard per-agent spend ceiling. A runaway agent stops instead of burning money; the duel is then
 *  relaunched with a fresh agent, so the cap bounds cost without ever abandoning a duel.
 *  A whole Haiku-played duel costs a small fraction of this. */
const AGENT_BUDGET_USD = "1.00";
/** Same, for a nudge agent: it answers exactly one menu. */
const NUDGE_BUDGET_USD = "0.25";
/** Tools a seat has no business using — Read/Write would let it open the duel record (hidden info). */
const DENIED_TOOLS = ["Read", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Agent", "TodoWrite"];

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const MATCHES = Number(flag("--matches", DEFAULT_MATCHES));
const ONLY = flag("--only", null);
/** Play at most this many duels this run (pilot / incremental runs); Infinity = the whole schedule. */
const LIMIT = Number(flag("--limit", Infinity));
const DRY_RUN = args.includes("--dry-run");

const schedule = JSON.parse(readFileSync(join(REPORT_DIR, "schedule.json"), "utf8"));

/**
 * Query. Whether the rules engine considers this duel finished, and who won.
 *
 * @param {string} id - duel id
 * @returns {Promise<{exists: boolean, ended: boolean, winner: (number|null), moves: number}>}
 *
 * @example await status("sdc-SDY-vs-SDK-g1")  // {exists: true, ended: true, winner: 0, moves: 163}
 */
async function status(id) {
  if (!existsSync(join(REPO_ROOT, "duels", `${id}.json`))) return { exists: false, ended: false, winner: null, moves: 0 };
  const duel = loadDuel(id);
  const view = await viewDuel(duel, 2);
  return { exists: true, ended: view.ended, winner: view.ended ? view.winner : null, moves: duel.responses.length };
}

/**
 * Command. Creates the duel record if it is not there yet. P0 is the cell's row
 * deck, so the row deck is the one that goes first.
 *
 * @param {{p0: string, p1: string, row: string, col: string}} cell
 * @param {{id: string, seed: number}} duel
 */
function ensureDuel(cell, duel) {
  if (existsSync(join(REPO_ROOT, "duels", `${duel.id}.json`))) return;
  createDuel({
    id: duel.id,
    seed: duel.seed,
    decks: [loadDeck(cell.p0), loadDeck(cell.p1)],
    players: [`${cell.row}-haiku`, `${cell.col}-haiku`],
    created: new Date().toISOString(),
  });
}

/** What every seat is told on top of `ygo brief`: how to play fast, and that quitting early is worthless. */
const ADDENDUM = `
## Tournament conditions

This duel is one game of an automated structure-deck tournament. There is no
human at this table and nobody is watching. Your only job is to play your seat
to the real finish and win if you can.

**You are a Haiku agent on purpose, and there is nobody to ask.** This repo's
CLAUDE.md tells the *interactive* session to run on Opus and to warn if it is not;
that rule is about the human's own session and does NOT apply to you. Playing this
duel on Haiku is the entire point of the experiment — the tournament measures decks
by giving both seats the same small model. So:

- Do NOT warn about the model, ask to switch to Opus, or ask to be restarted.
- Do NOT ask any question, of anyone, for any reason. There is no user; a question
  reaches nobody, and stopping to ask forfeits real work.
- If you are unsure about anything, choose the most reasonable legal option on the
  menu and play it. Deciding imperfectly is always better than not deciding.

Your loop, until the duel ends:

    node bin/ygo.js wait <id> --as <seat> --auto-pass --timeout 2700
    (think briefly)
    node bin/ygo.js play <id> <choice> --as <seat> --auto-pass

- ALWAYS pass \`--auto-pass\`, or pointless "respond?" prompts will eat your budget. Always pass
  \`--timeout 2700\` to \`wait\`: many duels run at once, so your opponent can be slow to answer, and
  that is normal rather than a problem.
  When you are holding a trap you actually mean to use this turn cycle, add
  \`--ask-for "Trap Hole,Waboku" --ask-at summon,attack\` (with the cards you hold).
- Play briskly: a sentence or two of thought per decision, then move. The output
  of \`wait\` already contains the new log lines and your menu, so do not re-read
  the whole board every time. Use \`node bin/ygo.js state <id> --as <seat>\` only
  when you have genuinely lost track, and \`node bin/ygo.js card "<name>"\` when an
  effect actually matters to the decision.
- Your shell is restricted by a hook to \`node bin/ygo.js ...\` for YOUR seat only:
  no \`--as all\`, no other seat, nothing under \`duels/\` (that is the opponent's
  hand), no \`undo\`/\`fork\`, no \`play ... random\`, no command chaining with
  \`;\` \`&&\` \`|\`. That is expected — do not try to work around it, just play. If a
  command is blocked, reword it as a single plain \`ygo\` call for your seat.
- If \`wait\` reports a timeout, run it again; the opponent is thinking. If it times
  out twice in a row, stop and reply \`STALLED\`.
- NEVER stop because the game looks decided, because you are losing, or because it
  is taking a while. An unfinished duel is worthless to the tournament and will
  simply be replayed. Play until a command tells you the duel is over.
- When the duel is over, reply with exactly one line: \`RESULT won\`, \`RESULT lost\`
  or \`RESULT draw\`.
`;

/**
 * Query. The complete prompt for one seat: the repo's own agent brief (PLAYER.md
 * plus the seat facts) with the tournament addendum appended. No strategy file
 * is passed, deliberately — both seats get the identical baseline so the only
 * asymmetry in the whole tournament is the decklist.
 *
 * Asynchronous on purpose: at 100 matches in flight this is called 200 times in a
 * burst, and a synchronous spawn would block the driver's single thread for each one.
 *
 * @param {string} id - duel id
 * @param {number} seat - 0 or 1
 * @returns {Promise<string>}
 */
async function seatPrompt(id, seat) {
  const { stdout } = await execFile("node", ["bin/ygo.js", "brief", id, "--as", String(seat), "--max-plays", "400"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return `${stdout}\n${ADDENDUM}`;
}

/** The forcing prompt: one seat, one menu, one decision, then exit. Deliberately tiny — a stalled
 *  board is usually a long-context agent losing the thread, and this agent has no context to lose. */
const NUDGE_PROMPT = (id, seat) => `You are playing seat ${seat} (P${seat}) of Yu-Gi-Oh! duel "${id}" in this repo (real rules, real cards).

The duel is waiting on YOU and on nothing else. Make exactly ONE decision, then stop.

You are a Haiku agent on purpose: this repo's CLAUDE.md asks the interactive session
to run on Opus, which does not apply to you. Do not warn about the model, do not ask
to switch it, and do not ask anyone anything — there is no user to answer. Decide.

1. Run:  node bin/ygo.js state ${id} --as ${seat}
   That prints your board and the numbered menu of every LEGAL action.
2. If you need a card's text to choose sensibly: node bin/ygo.js card "<card name>"
3. Pick the best option and play it:  node bin/ygo.js play ${id} <choice> --as ${seat} --auto-pass
   Choices: "3" for option 3, "1,4" when the menu asks for several, "0" for the
   pass/no option when it is listed, "name:<card>" when asked to declare a name.
4. Stop. Reply with one line: MOVED <choice>.

Rules: use only --as ${seat}. A hook restricts your shell to \`node bin/ygo.js ...\`
for your own seat — no --as all, no other seat, nothing under duels/, no command
chaining. Do not chat. There is always at least one legal option, so you can
always move. Passing (option "0") when it is offered is a legal decision;
refusing to decide is not.`;

/**
 * Command. Forces the duel forward by at least one move, using fresh
 * single-decision Haiku agents on whichever seat the engine is waiting on. This
 * is the anti-abandonment mechanism: no duel is ever left mid-board because its
 * agents wandered off.
 *
 * @param {string} id - duel id
 * @returns {Promise<{moved: boolean, tries: number}>} moved=false means genuinely stuck (a bug to look at)
 */
async function nudge(id) {
  for (let tries = 1; tries <= NUDGE_TRIES; tries += 1) {
    const before = await status(id);
    if (before.ended) return { moved: true, tries: tries - 1 };
    const view = await viewDuel(loadDuel(id), 2);
    const seat = view.pendingPlayer;
    await runAgent(NUDGE_PROMPT(id, seat), NUDGE_TIMEOUT_MS, seat, NUDGE_BUDGET_USD);
    const after = await status(id);
    if (after.ended || after.moves > before.moves) {
      console.log(`  ${id}: nudged P${seat} (${before.moves} -> ${after.moves} moves)`);
      return { moved: true, tries };
    }
  }
  return { moved: false, tries: NUDGE_TRIES };
}

/**
 * Command. Runs one headless Haiku agent for one seat and resolves when it exits.
 * Never rejects: a crashed or killed agent is an ordinary outcome here, handled
 * by relaunching.
 *
 * @param {string} id - duel id
 * @param {number} seat - 0 or 1
 * @returns {Promise<{code: (number|null), killed: boolean, tail: string}>}
 */
async function runSeat(id, seat) {
  return runAgent(await seatPrompt(id, seat), AGENT_TIMEOUT_MS, seat, AGENT_BUDGET_USD);
}

/**
 * Pure function. A settings blob installing tools/seat-guard.sh as a PreToolUse
 * hook, so this agent's shell is restricted to `ygo` calls for its own seat. The
 * honor boundary of PLAYER.md becomes an enforced one — necessary because the
 * duel record contains the seed, hence the opponent's hand.
 *
 * @param {number} seat - 0 or 1
 * @returns {string} JSON, passed to `claude --settings`
 *
 * @example
 * guardSettings(0)
 * // '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":".../seat-guard.sh 0"}]}]}}'
 */
function guardSettings(seat) {
  const guard = join(REPORT_DIR, "tools", "seat-guard.sh");
  return JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `${guard} ${seat}` }] }] },
  });
}

/**
 * Command. Runs one headless Haiku agent to completion. Never rejects: a crashed
 * or timed-out agent is an ordinary outcome here, handled by relaunching.
 *
 * @param {string} prompt - the whole task, given on the command line
 * @param {number} timeoutMs - SIGKILL the process after this long
 * @param {number} seat - 0 or 1; the seat guard is installed for this seat only
 * @param {string} budgetUsd - hard spend ceiling for this one agent
 * @returns {Promise<{code: (number|null), killed: boolean, tail: string}>}
 */
function runAgent(prompt, timeoutMs, seat, budgetUsd) {
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      [
        "--dangerously-skip-permissions",
        "--model", MODEL,
        "--strict-mcp-config",
        "--no-session-persistence",
        "--max-budget-usd", budgetUsd,
        "--settings", guardSettings(seat),
        "--disallowed-tools", ...DENIED_TOOLS,
        "-p", prompt,
      ],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (b) => { out += b; });
    child.stderr.on("data", (b) => { out += b; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, killed: signal === "SIGKILL", tail: out.trim().split("\n").slice(-2).join(" | ").slice(0, 300) });
    });
  });
}

/**
 * Command. Plays one duel to a rules-engine ending, relaunching seat pairs as
 * often as needed. Appends one progress record per attempt.
 *
 * @param {object} cell - schedule cell
 * @param {object} duel - {id, game, seed}
 * @returns {Promise<{id: string, ended: boolean, winner: (number|null), attempts: number}>}
 */
async function runDuel(cell, duel) {
  ensureDuel(cell, duel);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const before = await status(duel.id);
    if (before.ended) return { id: duel.id, ended: true, winner: before.winner, attempts: attempt - 1 };
    const [a, b] = await Promise.all([runSeat(duel.id, 0), runSeat(duel.id, 1)]);
    const after = await status(duel.id);
    log({
      at: new Date().toISOString(),
      id: duel.id,
      cell: `${cell.row}>${cell.col}`,
      attempt,
      movesBefore: before.moves,
      movesAfter: after.moves,
      ended: after.ended,
      winner: after.winner,
      seat0: { code: a.code, killed: a.killed, tail: a.tail },
      seat1: { code: b.code, killed: b.killed, tail: b.tail },
    });
    console.log(`  ${duel.id} attempt ${attempt}: ${before.moves} -> ${after.moves} moves${after.ended ? `, ENDED winner P${after.winner}` : ""}`);
    if (after.ended) return { id: duel.id, ended: true, winner: after.winner, attempts: attempt };
    // The pair walked away from an unfinished board. Force it forward with fresh
    // single-decision agents before relaunching, so a stall can never repeat
    // itself identically and the duel cannot sit still.
    const forced = await nudge(duel.id);
    if (!forced.moved) {
      console.log(`  ${duel.id}: STUCK — ${NUDGE_TRIES} single-decision agents could not move the board; leaving it for the next run`);
      log({ at: new Date().toISOString(), id: duel.id, cell: `${cell.row}>${cell.col}`, attempt, stuck: true, moves: after.moves });
      break;
    }
  }
  const final = await status(duel.id);
  return { id: duel.id, ended: final.ended, winner: final.winner, attempts: MAX_ATTEMPTS };
}

/** Command. Appends one JSON record to progress.jsonl (append-only history of the run). */
function log(record) {
  appendFileSync(join(REPORT_DIR, "progress.jsonl"), `${JSON.stringify(record)}\n`);
}

// ---- main ----

const queue = [];
for (const cell of schedule.cells) {
  if (ONLY && cell.row !== ONLY && cell.col !== ONLY) continue;
  for (const duel of cell.duels) queue.push({ cell, duel });
}
if (queue.length > LIMIT) queue.length = LIMIT;

let done = 0;
let remaining = 0;
for (const item of queue) {
  const s = await status(item.duel.id);
  if (s.ended) done += 1;
  else remaining += 1;
}
console.log(`${queue.length} duels scheduled: ${done} already finished, ${remaining} to play`);
console.log(`${MATCHES} matches in flight = ${MATCHES * 2} concurrent ${MODEL} agents`);
if (DRY_RUN) process.exit(0);

let next = 0;
let finished = 0;
const unfinished = [];
const started = Date.now();

/** Command. One worker: pulls duels off the shared queue until it is empty. */
async function worker(slot) {
  for (;;) {
    const i = next;
    next += 1;
    if (i >= queue.length) return;
    const { cell, duel } = queue[i];
    const s = await status(duel.id);
    if (s.ended) { finished += 1; continue; }
    console.log(`[slot ${slot}] ${duel.id} (${cell.row} first vs ${cell.col}) starting`);
    const result = await runDuel(cell, duel);
    finished += 1;
    if (!result.ended) unfinished.push(result.id);
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    console.log(`[${finished}/${queue.length}] ${duel.id} ${result.ended ? `P${result.winner} wins` : "UNFINISHED"} (${mins} min elapsed)`);
  }
}

await Promise.all(Array.from({ length: MATCHES }, (_, slot) => worker(slot)));
console.log(`\ndone: ${finished} duels processed, ${unfinished.length} still unfinished`);
if (unfinished.length) console.log(`unfinished: ${unfinished.join(" ")}`);
