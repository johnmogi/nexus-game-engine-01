import { describe, expect, it } from "vitest";
import { createGame, dispatch, getLegalActions, l0Ruleset, proxyCatalog } from "./index.js";
import { autoEvolveFromHand, canPlaceOnLineage } from "./lineage.js";
import type { EngineCtx } from "./types.js";

describe("lineage placement", () => {
  const ruleset = l0Ruleset();
  const catalog = proxyCatalog();
  const ctx: EngineCtx = { ruleset, catalog };
  const empty = {
    id: "P1",
    hand: [] as { instanceId: string; cardId: string }[],
    lineage: [] as { instanceId: string; cardId: string }[],
    health: 3,
    joker: { active: false },
    eclipse: false,
    aspect: null,
  };

  it("starts on Ace and only accepts +2 of the same lineage when color is off", () => {
    const strict = {
      ...ctx,
      ruleset: l0Ruleset({ experimental: { ...l0Ruleset().experimental, evolveByColor: false } }),
    };
    expect(canPlaceOnLineage(strict, empty, { instanceId: "a", cardId: "SUN-VINES-1" })).toBe(true);
    expect(canPlaceOnLineage(strict, empty, { instanceId: "b", cardId: "SUN-VINES-6" })).toBe(false);
    const claimed = { ...empty, lineage: [{ instanceId: "a", cardId: "SUN-VINES-1" }] };
    expect(canPlaceOnLineage(strict, claimed, { instanceId: "c", cardId: "SUN-VINES-3" })).toBe(true);
    expect(canPlaceOnLineage(strict, claimed, { instanceId: "d", cardId: "SUN-VINES-6" })).toBe(false);
    expect(canPlaceOnLineage(strict, claimed, { instanceId: "e", cardId: "SUN-ROSES-3" })).toBe(false);
  });

  it("evolveByColor lets Ace of roses take a 3 of vines (L1 secondary elemental)", () => {
    const color: EngineCtx = {
      ...ctx,
      ruleset: l0Ruleset({ experimental: { ...l0Ruleset().experimental, evolveByColor: true } }),
    };
    const claimed = { ...empty, lineage: [{ instanceId: "a", cardId: "SUN-ROSES-1" }] };
    expect(canPlaceOnLineage(color, claimed, { instanceId: "e", cardId: "SUN-VINES-3" })).toBe(true);
    expect(canPlaceOnLineage(color, claimed, { instanceId: "f", cardId: "SUN-ROSES-3" })).toBe(true);
    expect(canPlaceOnLineage(color, claimed, { instanceId: "g", cardId: "SUN-VINES-2" })).toBe(false);
  });

  it("L0 default stays same lineage — no secondary elemental jump", () => {
    const claimed = { ...empty, lineage: [{ instanceId: "a", cardId: "SUN-ROSES-1" }] };
    expect(canPlaceOnLineage(ctx, claimed, { instanceId: "e", cardId: "SUN-VINES-3" })).toBe(false);
    expect(canPlaceOnLineage(ctx, claimed, { instanceId: "f", cardId: "SUN-ROSES-3" })).toBe(true);
  });

  it("auto-evolves every next rank sitting in hand when color jumps are on", () => {
    const color: EngineCtx = {
      ...ctx,
      ruleset: l0Ruleset({ experimental: { ...l0Ruleset().experimental, evolveByColor: true } }),
    };
    const p = {
      ...empty,
      lineage: [{ instanceId: "ace", cardId: "SUN-ROSES-1" }],
      hand: [
        { instanceId: "three", cardId: "SUN-VINES-3" },
        { instanceId: "junk", cardId: "SUN-CRYSTALS-2" },
        { instanceId: "five", cardId: "SUN-VESSELS-5" },
      ],
    };
    const grown = autoEvolveFromHand(color, p);
    expect(grown.map((c) => c.cardId)).toEqual(["SUN-VINES-3", "SUN-VESSELS-5"]);
    expect(p.hand.map((c) => c.cardId)).toEqual(["SUN-CRYSTALS-2"]);
    expect(p.lineage.map((c) => c.cardId)).toEqual(["SUN-ROSES-1", "SUN-VINES-3", "SUN-VESSELS-5"]);
  });

  it("prefers the same lineage over a color jump when both are legal", () => {
    const color: EngineCtx = {
      ...ctx,
      ruleset: l0Ruleset({ experimental: { ...l0Ruleset().experimental, evolveByColor: true } }),
    };
    const p = {
      ...empty,
      lineage: [{ instanceId: "ace", cardId: "SUN-ROSES-1" }],
      hand: [
        { instanceId: "vines", cardId: "SUN-VINES-3" },
        { instanceId: "roses", cardId: "SUN-ROSES-3" },
      ],
    };
    const grown = autoEvolveFromHand(color, p);
    expect(grown.map((c) => c.cardId)).toEqual(["SUN-ROSES-3"]);
    expect(p.hand.map((c) => c.cardId)).toEqual(["SUN-VINES-3"]);
  });

  it("omits Reward → lineage when LEFT is not the next form", () => {
    const state = createGame({ seed: "rew", playerCount: 2, ruleset, catalog });
    state.meta.phase = "REWARD";
    state.roundTable.left = [{ instanceId: "left", cardId: "SUN-VINES-6" }];
    const p1 = state.players[0]!;
    p1.lineage = [{ instanceId: "ace", cardId: "SUN-VINES-1" }];
    const dests = getLegalActions(state, "P1", ctx)
      .filter((a) => a.type === "TAKE_REWARD")
      .map((a) => (a.type === "TAKE_REWARD" ? a.dest : ""));
    expect(dests).toContain("hand");
    expect(dests).not.toContain("lineage");
    expect(dests).not.toContain("veil");
  });

  it("opening deal logs LINEAGE_NONE when the 3-card hand has no next rank", () => {
    const state = createGame({ seed: "no-three", playerCount: 2, ruleset, catalog });
    const r = dispatch(state, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    const none = r.state.log.filter((e) => e.type === "LINEAGE_NONE" && e.source === "deal");
    const grown = r.state.log.filter((e) => e.type === "LINEAGE_EVOLVED" && e.source === "deal");
    expect(none.length + grown.length).toBe(2);
    for (const p of r.state.players) {
      const last = p.lineage.at(-1);
      const rank = last ? catalog.get(last.cardId)?.rank ?? 0 : 0;
      const hasNext = p.hand.some((c) => (catalog.get(c.cardId)?.rank ?? 0) === rank + 2);
      if (hasNext) {
        expect(grown.some((e) => e.playerId === p.id)).toBe(true);
      } else if (rank === 1) {
        expect(none.some((e) => e.playerId === p.id && e.neededRank === 3)).toBe(true);
      }
    }
  });
});
