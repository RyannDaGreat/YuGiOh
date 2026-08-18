/**
 * Remembered open/closed state for the duel page's collapsible panels (AI
 * players, Log). Stored per panel in localStorage so a panel you closed stays
 * closed across reloads and games — the AI panel in particular can spoil what
 * an AI just did, and the log is not always wanted.
 */
import { browser } from "$app/environment";

const PREFIX = "ygo.panel.";

/** Query. Whether a panel should start open; `fallback` when nothing is stored. */
export function panelOpen(name, fallback = true) {
  if (!browser) return fallback;
  const v = localStorage.getItem(PREFIX + name);
  return v === null ? fallback : v === "1";
}

/** Command. Remembers a panel's open/closed state. */
export function setPanelOpen(name, open) {
  if (browser) localStorage.setItem(PREFIX + name, open ? "1" : "0");
}
