import { describe, expect, it } from "vitest";
import { createGame, dispatch, getLegalActions, l0Ruleset, proxyCatalog, type EngineCtx } from "./index.js";
import { airBury, earthOrder, firePush, waterBring } from "./ops.js";
import { bandedForce, eventKindFromDie } from "./score.js";

describe("L0 pamphlet scoring", () => {
  it("bands Ace–3 as 1, 4–6 as 3, 7–9 as 6", () => {
    expect([1, 2, 3].map(bandedForce)).toEqual([1, 1, 1]);
    expect([4, 5, 6].map(bandedForce)).toEqual([3, 3, 3]);
    expect([7, 8, 9].map(bandedForce)).toEqual([6, 6, 6]);
    expect(bandedForce(0)).toBe(0);
  });

  it("event die is 1–2 Dialogue, 3–4 Barrier, 5–6 Treasure", () => {
    const d = 2;
    const b = 4;
    expect([1, 2].map((r) => eventKindFromDie(r, d, b))).toEqual(["dialogue", "dialogue"]);
    expect([3, 4].map((r) => eventKindFromDie(r, d, b))).toEqual(["barrier", "barrier"]);
    expect([5, 6].map((r) => eventKindFromDie(r, d, b))).toEqual(["treasure", "treasure"]);
  });
});

describe("L0 pamphlet elementals", () => {
  it("Air buries LEFT under the draw; Fire puts LEFT on top; Water returns from Veil", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "elem", playerCount: 2, ruleset, catalog });
    const a = state.drawDeck[0]!;
    const b = state.drawDeck[1]!;
    const v = state.drawDeck[2]!;
    state.drawDeck = state.drawDeck.slice(3);
    state.roundTable.left = [a];
    const before = state.drawDeck.length;
    expect(airBury(state)).toBe(true);
    expect(state.roundTable.left).toHaveLength(0);
    expect(state.drawDeck.at(-1)?.instanceId).toBe(a.instanceId);
    expect(state.drawDeck).toHaveLength(before + 1);

    state.roundTable.left = [b];
    expect(firePush(state, ctx)).toBe(true);
    expect(state.drawDeck[0]?.instanceId).toBe(b.instanceId);

    state.veil = [v];
    state.roundTable.left = [];
    expect(waterBring(state)).toBe(true);
    expect(state.roundTable.left[0]?.instanceId).toBe(v.instanceId);
  });

  it("Earth reorders LEFT/MIDDLE/PD and leaves a Major locked on PD", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "earth", playerCount: 2, ruleset, catalog });
    const a = state.drawDeck[0]!;
    const b = state.drawDeck[1]!;
    const c = state.drawDeck[2]!;
    const maj = { instanceId: "maj", cardId: "SUN-ROSES-J" };
    state.drawDeck = state.drawDeck.slice(3);
    state.roundTable.left = [a];
    state.roundTable.middle = [b];
    state.roundTable.pd = [c];
    expect(earthOrder(state, ctx, ["middle", "pd", "left"])).toBe(true);
    expect(state.roundTable.left[0]?.instanceId).toBe(b.instanceId);
    expect(state.roundTable.middle[0]?.instanceId).toBe(c.instanceId);
    expect(state.roundTable.pd[0]?.instanceId).toBe(a.instanceId);

    state.roundTable.left = [a];
    state.roundTable.middle = [b];
    state.roundTable.pd = [maj];
    expect(earthOrder(state, ctx, ["middle", "left"])).toBe(true);
    expect(state.roundTable.left[0]?.instanceId).toBe(b.instanceId);
    expect(state.roundTable.middle[0]?.instanceId).toBe(a.instanceId);
    expect(state.roundTable.pd[0]?.instanceId).toBe("maj");
  });
});

describe("L0 treasure is LEFT, not a deck draw", () => {
  it("TREASURE events name dest left", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    let state = createGame({ seed: "treasure-left", playerCount: 2, ruleset, catalog });
    for (let i = 0; i < 800; i++) {
      if (state.meta.outcome !== "playing") break;
      const id = state.players.find((p) => getLegalActions(state, p.id, ctx).length)?.id;
      if (!id) break;
      const legal = getLegalActions(state, id, ctx);
      const result = dispatch(state, legal[0]!, ctx);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    }
    const treasures = state.log.filter((e) => e.type === "TREASURE");
    expect(treasures.length).toBeGreaterThan(0);
    expect(treasures.every((e) => e.dest === "left")).toBe(true);
    expect(state.log.some((e) => e.type === "DIALOGUE_REWARD" && e.slot === "pd")).toBe(false);
  });
});
