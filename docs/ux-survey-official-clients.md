# UX survey — official clients (Master Duel, Duel Links, Legacy of the Duelist)

Research digest produced 2026-08-16 by a survey agent (web sources; MD internals via the
YgoMaster hooking project's class/enum names). Presentation backlog for `web/src/lib/pretty/`
— nothing here touches the engine. Durations are proposed targets, not measured values.

## Ideas worth stealing (ranked for spectator comprehension)
1. **Duel log panel** — its absence is LotD's #1 complaint; MD's names cards and records even
   non-targeting selections and zone designations; DL's is searchable. (We have the YGN log.)
2. **Chain rail rendered as a literal chain**, CL1…CLn, links pop top-down on resolution
   (~180 ms add, ~350 ms pop). Reviewers call it MD's best teaching device.
3. **Priority light**: red bar/glow at the top when the opponent holds priority, blue on your
   side when you may respond — the cheapest "who is acting" cue.
4. **LP: floating "-N" pop, then the counter ticks down over ~600–900 ms** (never snaps); red
   vignette; MD cracks/splinters the losing side's field as damage lands.
5. Phase / turn banners; battle sub-steps as a smaller line ("Detailed Display of Battle Phase").
6. **Card status badges** on the card (MD set: effects negated · cannot be Special Summoned ·
   banished temporarily · used as material · destroyed by battle · cannot attack) and an
   **"Influence" view** listing lingering effects applied to a selected card.
7. Attack: camera push, lunge, slash/impact, screen shake, defender shatters
   (wind-up 250 → strike 150 → shake 200 → destroy 400 ms). Summon: slide from hand, land
   with a thud, neighbours recoil. Special summons get per-method portals (Fusion vortex,
   Synchro rings, Xyz spiral, Link circuit) — each independently skippable.
8. **"Summon Cut-In" per ace card**, 1.5–2.5 s, always click-skippable; MD's setting *"show
   animations only the first time they occur in the duel"* — steal that.
9. Replay: MD's viewer is only Play/Pause/FF-toggle (no seek, no rewind) — our scrubber is
   already ahead. Adopt MD's hidden-info tiers verbatim: `AllClose / FrontOpen / AllOpen`.
   Live spectating catches up from turn 1 at speed, then shows LIVE; ship a skip-to-live.
10. Settings principle: **every animation class gets its own kill switch**; no global slider.
    Also: face-down cards translucent to their owner (we do this), activation-confirmation
    modes (Auto / hold), coloured card ownership (blue = yours, red = opponent) in lists.
11. Sound: two systems — BGM that escalates DuelEarly → DuelMiddle → DuelLate, and a flat
    namespace of named one-shots (draw, land thud, normal vs special summon, spell shimmer,
    trap flip-up sting, chain clink, attack slash, impact, destroy, to-GY whoosh, LP tick loop
    with rising pitch, phase, turn, timer-low, win, lose, deck-out). DL adds per-character
    voice lines per event; MD has none.
12. Layout extras: "Mate" avatar per seat that reacts to events; connection icon (maps to our
    presence pills); per-turn + per-duel timers; Speed-Duel reduced mat as a variant.

## Caveats from the agent
Konami's English manual is gone and most wikis blocked the fetcher (workaround: prefix URLs
with https://r.jina.ai/), so most MD setting labels are back-translations; only "Activation
Confirmation" and "Display Face-Down Cards as Transparent" are verified English strings.
