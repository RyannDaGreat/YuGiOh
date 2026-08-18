# Records from before the ocgcore-wasm Right-Scale fix (2026-08-18)

These duels were played on ocgcore-wasm 0.1.2 as published, whose JS glue handed the core a Right
Scale of 0 and no Link Markers for every card (see concerns.md 2026-08-17). `patches/ocgcore-wasm+0.1.2.patch`
fixes that, which changes the menus the engine offers from the first Pendulum/Link summon on — and a
record stores choices as menu indices, so these two no longer replay past that point:

- PendyVsSpell — rejected at response #86
- SkyVsSpectre — rejected at response #79

Kept for the record (their chat and the bug diagnosis refer to them); `listDuels` does not look here.
