#!/usr/bin/env node
/**
 * `ygo` — headless Yu-Gi-Oh! duel CLI. The primary interface: this is how an
 * LLM agent (or a subagent, or a script) plays. The web UI is a client of the
 * same session API, never a superset of it.
 *
 * Typical loop for a player:
 *     ygo state <id> --as 1        # board, hands you may see, and the menu if it's your call
 *     ygo play  <id> 3 --as 1      # answer option 3; prints what happened
 *     ygo log   <id> --as 1        # full history from your side
 *     ygo card  "Trap Hole"        # rules text, offline
 */

import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { allCards, cardInfo, codeOf, REPO_ROOT, searchCards, summarizeCard } from "../src/cards.js";
import { expandDeck } from "../src/duel.js";
import { playChoice, parseViewer, shouldAutoPass, viewDuel } from "../src/session.js";
import { createDuel, listDecks, listDuels, loadDeck, loadDuel, saveDuel } from "../src/store.js";
import { victoryString } from "../src/strings.js";

/** Default log tail shown after a play, so the agent sees the consequences without asking. */
const DEFAULT_LOG_TAIL = 60;
/** How often `ygo wait` re-checks the duel file. */
const WAIT_POLL_MS = 1000;

const program = new Command();
program.name("ygo").description("Headless Yu-Gi-Oh! duels for humans and LLM agents");

program
  .command("new")
  .description("Create a duel. P0 goes first.")
  .requiredOption("--id <id>", "duel id (filesystem-safe)")
  .option("--p0 <deck>", "deck for P0 (name under src/decks or a path)", "yugi")
  .option("--p1 <deck>", "deck for P1", "kaiba")
  .option("--seed <n>", "32-bit seed; omit for a random one")
  .option("--players <a,b>", "labels for P0,P1 e.g. ryan,claude", "P0,P1")
  .action(async (opts) => {
    const seed = opts.seed === undefined ? Math.floor(Math.random() * 2 ** 32) : Number(opts.seed);
    const decks = [loadDeck(opts.p0), loadDeck(opts.p1)];
    const players = opts.players.split(",");
    if (players.length !== 2) throw new Error("--players needs two comma-separated labels");
    createDuel({ id: opts.id, seed, decks, players, created: new Date().toISOString() });
    console.log(`created duel ${opts.id}: P0=${decks[0].name} (${players[0]}) vs P1=${decks[1].name} (${players[1]}), seed ${seed}`);
    const view = await viewDuel(loadDuel(opts.id), 2);
    console.log(`waiting on P${view.pendingPlayer}`);
  });

program
  .command("state <id>")
  .description("Full visible state (+ the menu if the viewer is being asked)")
  .requiredOption("--as <viewer>", "0, 1 or all")
  .action(async (id, opts) => {
    const viewer = parseViewer(opts.as);
    const view = await viewDuel(loadDuel(id), viewer);
    console.log(view.stateLines.join("\n"));
    console.log("");
    printStatus(view);
  });

program
  .command("log <id>")
  .description("Event log (YGN) from a viewer's perspective")
  .requiredOption("--as <viewer>", "0, 1 or all")
  .option("--last <n>", "only the last N lines")
  .action(async (id, opts) => {
    const viewer = parseViewer(opts.as);
    const view = await viewDuel(loadDuel(id), viewer);
    const lines = opts.last ? view.logLines.slice(-Number(opts.last)) : view.logLines;
    console.log(lines.join("\n"));
    console.log("");
    printStatus(view);
  });

program
  .command("menu <id>")
  .description("Just the pending decision menu")
  .requiredOption("--as <viewer>", "0, 1 or all")
  .action(async (id, opts) => {
    const view = await viewDuel(loadDuel(id), parseViewer(opts.as));
    printStatus(view);
  });

program
  .command("play <id> <choice>")
  .description('Answer the pending menu: "3", "1,4", "0", "name:<card>", or "random"')
  .requiredOption("--as <player>", "0 or 1")
  .option("--quiet", "print only the receipt, not the resulting log")
  .action(async (id, choice, opts) => {
    const player = parseViewer(opts.as);
    if (player === 2) throw new Error("--as must be 0 or 1 to play");
    const result = await playChoice(id, player, choice);
    console.log(`P${player} chose: ${result.chosenLabel}`);
    if (!opts.quiet) {
      console.log("--- since your move ---");
      console.log(result.newLogLines.slice(-DEFAULT_LOG_TAIL).join("\n"));
    }
    if (result.next.ended) console.log("--- duel over ---");
    else console.log(`--- waiting on P${result.next.pendingPlayer} ---`);
    if (!opts.quiet && result.next.pendingPlayer === player) {
      const view = await viewDuel(loadDuel(id), player);
      console.log(view.menuLines.join("\n"));
    }
  });

program
  .command("wait <id>")
  .description("Block until it is this player's decision (or the duel ends), then print what happened since and the menu")
  .requiredOption("--as <player>", "0 or 1")
  .option("--timeout <seconds>", "give up after this long", "600")
  .option("--since <n>", "log line count you have already seen; only newer lines are printed")
  .option("--auto-pass", "answer optional respond? prompts with 'do not activate' automatically (recorded as your decisions)")
  .option("--ask-for <cards>", "with --auto-pass: still stop when one of these comma-separated cards is activatable")
  .option("--ask-at <timings>", "with --auto-pass and --ask-for: only stop at timings mentioning these words, e.g. summon,attack")
  .action(async (id, opts) => {
    const player = parseViewer(opts.as);
    if (player === 2) throw new Error("--as must be 0 or 1 to wait");
    const deadline = Date.now() + Number(opts.timeout) * 1000;
    const askFor = opts.askFor ? opts.askFor.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const askAt = opts.askAt ? opts.askAt.split(",").map((s) => s.trim()).filter(Boolean) : [];
    let passed = 0;
    for (;;) {
      const view = await viewDuel(loadDuel(id), player);
      if (!view.ended && view.pendingPlayer === player && opts.autoPass && shouldAutoPass(view.menu, view.pending, { askFor, askAt })) {
        await playChoice(id, player, "0");
        passed += 1;
        continue;
      }
      if (view.ended || view.pendingPlayer === player) {
        if (passed) console.log(`(auto-passed ${passed} optional respond? prompt${passed === 1 ? "" : "s"})`);
        const since = opts.since === undefined ? Math.max(0, view.logLines.length - DEFAULT_LOG_TAIL) : Number(opts.since);
        console.log(`--- log lines ${since}..${view.logLines.length} ---`);
        console.log(view.logLines.slice(since).join("\n"));
        console.log("");
        printStatus(view);
        return;
      }
      if (Date.now() > deadline) throw new Error(`timed out after ${opts.timeout}s; still waiting on P${view.pendingPlayer}`);
      await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
    }
  });

program
  .command("undo <id>")
  .description("Rewind the last N recorded responses (time travel; use for experiments)")
  .option("--n <n>", "how many", "1")
  .action((id, opts) => {
    const duel = loadDuel(id);
    const n = Number(opts.n);
    if (n < 1 || n > duel.responses.length) throw new Error(`cannot undo ${n} of ${duel.responses.length} responses`);
    duel.responses.length -= n;
    saveDuel(duel);
    console.log(`rewound ${n}; ${duel.responses.length} responses remain`);
  });

program
  .command("list")
  .description("List duels")
  .action(async () => {
    for (const id of listDuels()) {
      const duel = loadDuel(id);
      const view = await viewDuel(duel, 2);
      const status = view.ended ? `over: P${view.winner} wins (${victoryString(view.winReason)})` : `waiting on P${view.pendingPlayer}`;
      console.log(`${id}: ${duel.decks[0].name} (${duel.players[0]}) vs ${duel.decks[1].name} (${duel.players[1]}), ${duel.responses.length} moves, ${status}`);
    }
  });

program
  .command("card <query>")
  .description("Card text by exact name or passcode (offline)")
  .action((query) => {
    const code = /^\d+$/.test(query) ? Number(query) : codeOf(query);
    const info = cardInfo(code);
    if (!info) throw new Error(`unknown card: ${query}`);
    console.log(summarizeCard(code));
    console.log(`passcode ${code}`);
    console.log(info.desc);
  });

program
  .command("search <text>")
  .description("Cards whose name contains text")
  .option("--limit <n>", "max results", "30")
  .action((text, opts) => {
    for (const row of searchCards(text, Number(opts.limit))) console.log(`${row.id}\t${summarizeCard(row.id)}`);
  });

program
  .command("deck <name>")
  .description("Show a decklist with card summaries")
  .action((name) => {
    const deck = loadDeck(name);
    console.log(`${deck.name} (${expandDeck(deck.main).length} cards)`);
    for (const [cardName, count] of deck.main) console.log(`${count}x ${summarizeCard(codeOf(cardName))}`);
  });

program
  .command("dump-cards")
  .description("Write every card as one greppable line: passcode, summary, effect text (default vendor/cards.txt)")
  .option("--out <path>", "output path", join(REPO_ROOT, "vendor/cards.txt"))
  .action((opts) => {
    const lines = allCards().map((c) => `${c.code}\t${summarizeCard(c.code)}\t${c.desc.replace(/\s*\n\s*/g, " / ")}`);
    writeFileSync(opts.out, lines.join("\n") + "\n");
    console.log(`wrote ${lines.length} cards to ${opts.out}`);
  });

program
  .command("decks")
  .description("List built-in decks")
  .action(() => {
    for (const name of listDecks()) console.log(name);
  });

/**
 * Command. Prints who is being waited on and, if visible, the menu.
 *
 * Args:
 *     view (object): From viewDuel.
 */
function printStatus(view) {
  if (view.ended) {
    console.log(view.winner === 2 || view.winner === null ? `DUEL OVER: draw` : `DUEL OVER: P${view.winner} wins (${victoryString(view.winReason)})`);
    return;
  }
  console.log(`Waiting on P${view.pendingPlayer}.`);
  if (view.menuLines.length) console.log(view.menuLines.join("\n"));
}

program.parseAsync(process.argv).catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
