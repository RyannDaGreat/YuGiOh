/**
 * Where a visitor's API keys live in the browser, and nowhere else.
 *
 * Default is sessionStorage: the key is gone when the tab closes, which is the
 * safest thing a static page can offer. "Remember on this device" moves it to
 * localStorage. Neither survives XSS — no browser storage does — so the honest
 * promise is only: never sent anywhere except the provider's own API, never
 * logged, never written into a duel record or trace (src/ai/trace.js copies
 * fields explicitly for exactly that reason).
 */
import { browser } from "$app/environment";

/** Storage key prefix; one entry per provider id. */
const PREFIX = "ygo.apikey.";

/** Query. The stored key for a provider, or "". Checks the session first, then the device. */
export function getKey(provider) {
  if (!browser) return "";
  return sessionStorage.getItem(PREFIX + provider) ?? localStorage.getItem(PREFIX + provider) ?? "";
}

/**
 * Command. Stores a key. `remember` puts it in localStorage (survives the tab),
 * otherwise sessionStorage; the other store is cleared so there is one truth.
 *
 * Args:
 *     provider (string): Provider id ("openai", "anthropic", "gemini").
 *     key (string): The key; empty string removes it everywhere.
 *     remember (boolean): Persist across tabs and restarts.
 */
export function setKey(provider, key, remember = false) {
  if (!browser) return;
  sessionStorage.removeItem(PREFIX + provider);
  localStorage.removeItem(PREFIX + provider);
  const trimmed = String(key ?? "").trim();
  if (!trimmed) return;
  (remember ? localStorage : sessionStorage).setItem(PREFIX + provider, trimmed);
}

/** Query. Whether the stored key for a provider is the remembered (localStorage) kind. */
export function isRemembered(provider) {
  return browser && localStorage.getItem(PREFIX + provider) !== null;
}

/** Query. Provider ids that currently have a key. */
export function providersWithKeys(ids) {
  return ids.filter((id) => getKey(id) !== "");
}
