# NEXUS — where we stand (2026-09-22)

## Verdict (latest 100-run exports)

| | L0 `l0-lab-0.6` | L1 `l1-lab-0.3` |
|---|---|---|
| Folder | `exports/2026-09-22_141939_l0-lab-0.6_100runs` | `exports/2026-09-22_141956_l1-lab-0.3_100runs` |
| Clock finish | 100% | 97% |
| Party wipe | 0% | 3% |
| Eclipse games | 90% | 77% |
| Deaths | **0** (preventDeath) | **14** |
| Revivals | **0** (off) | **27 @ 1 HP** |
| Barrier win | ~69% | ~69% |
| Dialogue win | ~47% | ~47% |
| Element mix A/F/W/E | 198/179/179/144 | 530/526/545/497 |
| Invariant fails | 0 | 0 |

**Balance read:** Yes — for auto-play Lab batches, this looks healthy. L0 is a safe tutorial (no deaths). L1 has real pressure but revives work (~2 revitalizations per death). Combat win rates match across layers. Elementals are no longer Earth-skewed.

---

## Done (engine / Lab)

1. Immutable engine + Lab shell (table, advisor, logs, stats, batch export)
2. L0 vs L1 rules files (9 vs 27 turns, courts vs majors, same-line vs color evolve)
3. Eclipse (L0 same-face courts; L1 Sun↔Moon majors; pair spent to Veil)
4. Character pick after Eclipse (L1) — **impacts still pending**
5. Elementals Air/Fire/Water/Earth — table control; Water revive (L1)
6. `preventDeath` (L0) + `enableRevival` / `revivalHealth` toggles
7. Docker + Vercel Lab deploy path
8. Batch exports + FinStats (Eclipse, deaths, **revivals**)

---

## Not done yet (do these before / with graphics)

| Priority | Gap | Why it blocks “shipping feel” |
|---|---|---|
| **P0** | Character **impacts** after pick | Pick is cosmetic until effects exist |
| **P0** | Real playtest UI for combat (bowl / commits) | Auto-bot ≠ human readability |
| **P1** | Heal-on-living (Water while alive) | Pamphlet; only revive-from-0 today |
| **P1** | Named card art wired to catalog IDs | Files still `call_*.png` dumps |
| **P1** | Character select screen art + copy | Need 4 portraits + blurbs |
| **P2** | L2 slots (elemental dice, RPS cycle) | Explicitly off |
| **P2** | 3–4p dialogue geometry | Dormant |
| **P2** | Major impacts / day dial consequences | Day dial exists; soft effects pending |

---

## Suggested order (next sessions)

1. **Playtest L0 by hand** once (confirm tutorial never kills; Eclipse readable)
2. **Playtest L1** — Eclipse → character pick → Water revive visible in Stats
3. **Decide character impacts** (even one-line stubs) before art polish
4. **Rename / map graphics** to catalog IDs, then wire Lab faces
5. Combat screen chrome (bowl, obstacles) — only after 1–3 feel right

Graphics without impacts/playtest will hide the same gaps again.
