import { describe, expect, it } from "vitest";
import { createGame, getLegalActions, l0Ruleset, proxyCatalog } from "./index.js";
import { canPlaceOnLineage } from "./lineage.js";
import type { EngineCtx } from "./types.js";

describe("lineage placement", () => {
  const ruleset = l0Ruleset();
  const catalog = proxyCatalog();
  const ctx: EngineCtx = { ruleset, catalog };

  it("starts on Ace and only accepts +2 of the same lineage", () => {
    const empty = {
      id: "P1",
      hand: [],
      lineage: [] as { instanceId: string; cardId: string }[],
      health: 3,
      joker: { active: false },
      eclipse: false,
    };
    expect(canPlaceOnLineage(ctx, empty, { instanceId: "a", cardId: "SUN-VINES-1" })).toBe(true);
    expect(canPlaceOnLineage(ctx, empty, { instanceId: "b", cardId: "SUN-VINES-6" })).toBe(false);
    const claimed = { ...empty, lineage: [{ instanceId: "a", cardId: "SUN-VINES-1" }] };
    expect(canPlaceOnLineage(ctx, claimed, { instanceId: "c", cardId: "SUN-VINES-3" })).toBe(true);
    expect(canPlaceOnLineage(ctx, claimed, { instanceId: "d", cardId: "SUN-VINES-6" })).toBe(false);
    expect(canPlaceOnLineage(ctx, claimed, { instanceId: "e", cardId: "SUN-ROSES-3" })).toBe(false);
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
  });
});
