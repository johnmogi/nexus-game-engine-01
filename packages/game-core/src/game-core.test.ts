import { describe, expect, it } from "vitest";
import {
  actorId,
  createGame,
  dispatch,
  getLegalActions,
  instanceCount,
  l0Ruleset,
  listOccupancy,
  projectView,
  proxyCatalog,
  serialize,
  snapshotEqual,
  type EngineCtx,
  type GameState,
} from "./index.js";

function setup(playerCount: 2 | 3 | 4, seed = "nexus-m2") {
  const ruleset = l0Ruleset();
  const catalog = proxyCatalog();
  const state = createGame({ seed, playerCount, ruleset, catalog });
  const ctx: EngineCtx = { ruleset, catalog };
  return { state, ruleset, catalog, ctx };
}

function step(state: GameState, ctx: EngineCtx): GameState {
  const id =
    getLegalActions(state, actorId(state), ctx).length > 0
      ? actorId(state)
      : (state.players.find((p) => getLegalActions(state, p.id, ctx).length)?.id ?? actorId(state));
  const legal = getLegalActions(state, id, ctx);
  expect(legal.length).toBeGreaterThan(0);
  const result = dispatch(state, legal[0]!, ctx);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function playOut(start: GameState, ctx: EngineCtx, max = 4000): GameState {
  let state = start;
  for (let i = 0; i < max; i++) {
    if (state.meta.phase === "OVER" || state.meta.outcome !== "playing") return state;
    state = step(state, ctx);
  }
  throw new Error("match did not finish");
}

describe("createGame", () => {
  it("creates 2, 3, and 4 player matches", () => {
    for (const n of [2, 3, 4] as const) {
      const { state } = setup(n);
      expect(state.players).toHaveLength(n);
      expect(state.meta.playerCount).toBe(n);
      expect(state.meta.phase).toBe("SETUP");
    }
  });

  it("deals Ace–6 minors plus optional majors; keeps 7–9 in catalog only", () => {
    const { state, catalog, ruleset } = setup(2);
    expect(catalog.all().some((c) => c.rank >= 7)).toBe(true);
    const minors = catalog.all().filter((c) => c.arcana === "minor" && ruleset.playableRanks.includes(c.rank));
    const majors = catalog.all().filter((c) => c.arcana === "major");
    expect(state.drawDeck).toHaveLength(minors.length + majors.length);
    expect(state.drawDeck).toHaveLength(50);
    expect(instanceCount(state)).toBe(50);
  });

  it("keeps every instance in exactly one zone", () => {
    const { state } = setup(3);
    const ids = listOccupancy(state).map((o) => o.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic for the same seed", () => {
    expect(snapshotEqual(setup(2, "same").state, setup(2, "same").state)).toBe(true);
  });
});

describe("adventure loop", () => {
  it("rejects illegal actors without throwing", () => {
    const { state, ctx } = setup(2);
    const result = dispatch(state, { type: "ADVANCE", playerId: "P2" }, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ILLEGAL_ACTION");
  });

  it("SETUP deals hands and seeds the round table", () => {
    const { state, ctx } = setup(2);
    const next = step(state, ctx);
    expect(next.players.every((p) => p.hand.length === 3)).toBe(true);
    expect(next.roundTable.left).toHaveLength(0);
    expect(next.roundTable.middle).toHaveLength(0);
    expect(next.roundTable.pd).toHaveLength(0);
    expect(instanceCount(next)).toBe(50);
    expect(next.meta.phase).toBe("TURN_START");
  });

  it("runs a full match to OVER with conservation", () => {
    const { state, ctx } = setup(2, "full-run");
    const end = playOut(state, ctx);
    expect(end.meta.phase).toBe("OVER");
    expect(["turn_limit", "party_down", "deck_exhausted"]).toContain(end.meta.outcome);
    expect(instanceCount(end)).toBe(50);
    expect(end.log.some((e) => e.type === "EVENT_ROLLED")).toBe(true);
    expect(end.log.some((e) => e.type === "PHASE_CHANGED")).toBe(true);
  });

  it("same seed same adventure", () => {
    const a = playOut(setup(3, "det").state, setup(3, "det").ctx);
    const b = playOut(setup(3, "det").state, setup(3, "det").ctx);
    expect(snapshotEqual(a, b)).toBe(true);
  });
});

describe("views and serialize", () => {
  it("hides other hands in player view after deal", () => {
    const { state, ctx } = setup(2);
    const dealt = step(state, ctx);
    const p2 = projectView(dealt, { mode: "player", viewerId: "P2" });
    expect(p2.players[0]?.hand.every((c) => c.cardId === "?")).toBe(true);
    expect(p2.players[1]?.hand[0]?.cardId).not.toBe("?");
  });

  it("round-trips JSON", () => {
    const { state } = setup(4, "json");
    expect(JSON.parse(serialize(state)).meta.playerCount).toBe(4);
  });
});
