<script>
  /**
   * Claude Code running INSIDE the browser, playing one seat.
   *
   * Boots a BrowserPod (Node.js in WebAssembly, in this tab), shows its
   * terminal (xterm) here, launches Claude Code in it, and runs the mailbox:
   *   page  -> pod : status.json, prompt.md, log.md   (this seat's view only)
   *   pod   -> page: choice.txt                        ("<move> <choice>")
   * The page applies choices through the same API a human click uses, so the
   * bot cannot do anything a seated human could not. On a static build the
   * fetches below become in-browser engine calls; the pod side is unchanged.
   *
   * @prop {string} duelId
   * @prop {number} seat          the seat Claude plays
   * @prop {string} apiKey        BrowserPod API key (VITE_BROWSERPOD_API_KEY)
   * @prop {(msg: string) => void} onstatus
   */
  import { onDestroy, onMount } from "svelte";

  let { duelId, seat, apiKey, onstatus = () => {} } = $props();

  /** How often the page syncs the mailbox with the pod. */
  const SYNC_MS = 1500;
  /** Prebuilt disk image with Claude Code, from BrowserCode's config (leaningtech/browsercode). */
  const CLAUDE_IMAGE = "wss://disks.browserpod.io/claude_20260506.ext2";
  const CLAUDE_STORAGE_KEY = "claude_20260506";
  const CLAUDE_CLI = "/home/user/claude-extracted/src/entrypoints/cli.js";
  const POD_DIR = "/home/user/duel";
  /** Claude's OAuth flow targets localhost; BrowserCode rewrites it to the code-based exchange. */
  const OAUTH_LOCALHOST = "http%3A%2F%2Flocalhost%3A0";
  const OAUTH_CODE_PAGE = "https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode";
  const LOG_TAIL = 80;

  let termEl = $state(null);
  let phase = $state("idle");
  let lastMoveWritten = -1;
  let pod = null;
  let timer = null;

  async function readText(path) {
    const file = await pod.openFile(path, "utf-8");
    try {
      return await file.read(await file.getSize());
    } finally {
      await file.close();
    }
  }
  async function writeText(path, content) {
    const file = await pod.createFile(path, "utf-8");
    await file.write(content);
    await file.close();
  }

  async function sync() {
    if (!pod) return;
    const res = await fetch(`/api/duel/${duelId}?as=${seat}`);
    if (!res.ok) return;
    const view = await res.json();
    await fetch(`/api/duel/${duelId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ beat: seat }) });
    const yourTurn = !view.ended && view.pendingPlayer === seat;
    await writeText(`${POD_DIR}/status.json`, JSON.stringify({ duel: duelId, seat, move: view.moves, yourTurn, ended: view.ended }));
    if (yourTurn && view.moves !== lastMoveWritten) {
      await writeText(`${POD_DIR}/prompt.md`, `<!-- move ${view.moves} -->\n${view.prompt}\n\nAnswer by writing "${view.moves} <choice>" to choice.txt.\n`);
      await writeText(`${POD_DIR}/log.md`, view.logLines.slice(-LOG_TAIL).join("\n"));
      lastMoveWritten = view.moves;
      onstatus(`prompt written for move ${view.moves}`);
    }
    if (yourTurn) {
      let choice = "";
      try { choice = (await readText(`${POD_DIR}/choice.txt`)).trim(); } catch { choice = ""; }
      const match = choice.match(/^(\d+)\s+(.+)$/);
      if (match && Number(match[1]) === view.moves) {
        await writeText(`${POD_DIR}/choice.txt`, "");
        const play = await fetch(`/api/duel/${duelId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: seat, choice: match[2] }) });
        const body = await play.json();
        onstatus(body.ok ? `Claude played: ${body.chosenLabel}` : `Claude's choice rejected: ${body.error}`);
        if (!body.ok) await writeText(`${POD_DIR}/status.json`, JSON.stringify({ duel: duelId, seat, move: view.moves, yourTurn: true, ended: false, error: body.error }));
      }
    }
  }

  async function boot() {
    phase = "booting";
    onstatus("booting BrowserPod (first time downloads the Claude image)…");
    const { BrowserPod } = await import("@leaningtech/browserpod");
    if (!BrowserPod) throw new Error("BrowserPod runtime failed to load (offline?)");
    pod = await BrowserPod.boot({ apiKey, userImage: CLAUDE_IMAGE, storageKey: CLAUDE_STORAGE_KEY });
    const terminal = await pod.createDefaultTerminal(termEl);
    pod.onOpen((url) => {
      if (url.startsWith("https://claude.com/cai/oauth/authorize") || url.startsWith("https://platform.claude.com/oauth/authorize")) {
        window.open(url.replace(OAUTH_LOCALHOST, OAUTH_CODE_PAGE), "_blank");
        onstatus("sign in to Claude in the new tab, then paste the code into the terminal");
      }
    });
    await pod.createDirectory(POD_DIR, { recursive: true });
    const instructions = await (await fetch("/pod/CLAUDE.md")).text();
    await writeText(`${POD_DIR}/CLAUDE.md`, instructions);
    await writeText(`${POD_DIR}/choice.txt`, "");
    await sync();
    phase = "running";
    onstatus("Claude Code starting");
    // Test hook: Puppeteer reads the mailbox through this.
    globalThis.__ygoPod = { readText, writeText, pod };
    timer = setInterval(() => sync().catch((err) => onstatus(`sync error: ${err.message}`)), SYNC_MS);
    const opening = `You are seat ${seat} of Yu-Gi-Oh! duel ${duelId}. Read CLAUDE.md in this directory in full, then start the loop and play until the duel ends. Think out loud briefly before each choice.`;
    await pod.run("node", [CLAUDE_CLI, opening], { env: ["COLORTERM=truecolor"], terminal, cwd: POD_DIR });
    phase = "exited";
    onstatus("Claude Code exited");
  }

  onMount(() => {
    boot().catch((err) => { phase = "error"; onstatus(`boot failed: ${err.message}`); });
  });
  onDestroy(() => { if (timer) clearInterval(timer); });
</script>

<div class="flex flex-col h-full min-h-0">
  <div class="text-[0.7rem] text-amber-100/70 px-1 py-0.5">Claude Code in this browser · seat P{seat} · {phase}</div>
  <div bind:this={termEl} class="flex-1 min-h-[28rem] bg-black rounded p-1"></div>
</div>
