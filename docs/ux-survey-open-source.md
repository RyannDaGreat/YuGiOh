# UX survey — open-source Yu-Gi-Oh! clients (EDOPro, neos-ts)

Research digest produced 2026-08-16 by a survey agent reading the EDOPro (gframe/*.cpp) and
DarkNeos/neos-ts sources. It is the backlog for `web/src/lib/pretty/` — presentation only;
nothing here touches the engine. Frame counts are EDOPro's 60 fps (1 frame = 16.67 ms).

## Highest-value items (per spectator understanding / effort)
1. Seat-relative coordinate funnel + 180° mirroring (done: Table.svelte grid).
2. A "catching up / skip presentation" flag in the event pump (basis for scrubbing & speed).
3. ATK/DEF colored against base stats (buff/debuff visible), pile count numbers (partly done).
4. LP: hold the "-N" pop ~500 ms, then tick LP down in 10 steps (~167 ms); red/green/blue for
   damage/recover/cost; highlight the turn player's LP panel.
5. Chain-link badges per zone (+offset per link), 5× blink on solving, clear on chain end.
6. Targeting: 3× blink of the target + a bezier arrow from source to target (neither client
   draws arrows — that is our opportunity).
7. Attack: neos-ts 4-phase lunge (lift → recoil+tilt → easeInOutSine forward → easeInOutQuad
   home) + EDOPro's traveling arrow pulse (arc, 4 pulses over 667 ms).
8. Cut-ins: mask wipe (activation), zoom-in (special summon), card-rises (normal/flip
   summon), negate stamp; ≤300 ms motion inside a 500 ms hold.
9. Phase/turn/win banners: slide in 10 f, hold 30 f (win: 110 f), slide out 10 f.
10. MSG_CONFIRM_CARDS reveal: flip up, hold 750 ms (deck) / 1.5 s (field), flip back.
11. Sound: EDOPro's cue set (summon, specialsummon, activate, set, flip, equip, destroyed,
    banished, attack, draw, shuffle, damage, gainlp, addcounter, removecounter, coinflip,
    diceroll, nextturn, phase); BGM switches on LP ratio (advantage ≥2×, disadvantage ≤½).
12. Field-spell backgrounds: full-mat art when one/identical, split halves when both differ;
    add a crossfade.
13. Hand fan (neos-ts): cards on a huge circle (radius ≈ 6000 px + card/2), angular pitch
    2·atan((w/2)/(6000+130))·0.9, each card rotated by its angle.
14. Nice-to-have: link-arrow zone highlights, per-card chants, screen shake, coin/dice.

## Timing table (EDOPro, authoritative)
| Beat | Motion | Blocking wait |
|---|---|---|
| zone→zone move | 10 f (167 ms) | 5 f |
| position change / flip | 10 f | 11 f |
| card created / destroyed | fade 20 f (12 quick) | same |
| draw (per card) | hand re-fans 10 f | 5 f (cascades) |
| attack | arrow pulse 10 f ×4 | 40 f (667 ms) |
| become target (field) | 3× blink (5 f out / 5 f in) | 30 f |
| chaining cut-in | mask wipe ~480 ms | 30 f |
| chain solving | 5× (3 on / 3 off) | 30 f |
| normal summon cut-in | card rises 167 ms | 30 f + 11 f |
| special summon cut-in | zoom 235 ms | 30 f + 11 f |
| LP damage / gain | number holds 30 f, tick 10 f | 11 f |
| phase / turn banner | in 10 f, out 10 f | 40 f |
| win banner | in 10, hold 110, out 10 | 120 f (2 s) |
| shuffle | 5× (3 f jitter + 3 f back) | 30 f |
| confirm cards on field | 5 f flip | 90 f (30 f in replays) |

## Conventions worth copying verbatim
- Rotations: self ATK 0°, self DEF −90°, opponent ATK 180°, opponent DEF +90°; face-down adds a
  Y-flip; face-down defense gets a tiny z-nudge; GY and materials never drawn face-down.
- Hand hover: lift over 5 f; relationship icons (equip/target/chain-target) only on hover.
- Selectable cards: marching-ants dashed outline; selected: solid. Activatable piles: rotating
  ring at 1.2 rad/s. "Can attack": sword bobbing sinusoidally (~1 s period).
- Persistent negate stamp on STATUS_DISABLED cards. Draw counters on the field (EDOPro doesn't).
- Replay: seek = restart and fast-forward with presentation disabled; swap-field only while
  paused; hide hands in replays unless public or hovered.
- Per-seat card backs (cover.png / cover2.png) — matches our sleeves.
- Gaps in both clients: targeting arrows, screen shake, field-spell crossfade, on-field
  counters, a real timeline scrubber (we already have the scrubber).
