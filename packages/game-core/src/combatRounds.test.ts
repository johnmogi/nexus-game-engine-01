import { describe, expect, it } from "vitest";
import { createGame, dispatch, getLegalActions, l0Ruleset, proxyCatalog, type EngineCtx } from "./index.js";

function barrierState(ctx: EngineCtx, combatRound: number) {
  let state = createGame({ seed: "combat-round", playerCount: 2, ruleset: ctx.ruleset, catalog: ctx.catalog });
  return {
    ...state,
    meta: { ...state.meta, phase: "RESOLVE_EVENT" as const, activePlayerId: "P1", turn: 1 },
    flags: {
      ...state.flags,
      lastEvent: "barrier" as const,
      lastEventRoll: 4,
      combatRound,
      combatBowl: 0,
      commits: {},
    },
    roundTable: {
      ...state.roundTable,
      left: [{ instanceId: "obs", cardId: "SUN-ROSES-5" }],
    },
    players: state.players.map((p) =>
      p.id === "P1"
        ? { ...p, hand: [{ instanceId: "h1", cardId: "SUN-VINES-2" }, { instanceId: "h2", cardId: "SUN-VINES-6" }] }
        : p,
    ),
  };
}

describe("eventCombatRounds", () => {
  it("one round: a single commit finishes Barrier even if combatRound was still 0", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = barrierState(ctx, 0);
    const r = dispatch(state, { type: "COMMIT", playerId: "P1", cardId: "pass" }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.state.log.filter((e) => e.type === "COMBAT_ROUND")).toHaveLength(1);
    expect(r.state.log.some((e) => e.type === "COMBAT_ROUND" && e.round === 1 && e.of === 1)).toBe(true);
    expect(r.state.log.some((e) => e.type === "BARRIER_RESOLVED")).toBe(true);
    expect(r.state.log.some((e) => e.type === "EVENT_WAITING_COMMITS")).toBe(false);
  });

  it("plays two commit rounds then resolves Barrier", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, eventCombatRounds: 2 } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = barrierState(ctx, 1);

    const r1 = dispatch(state, { type: "COMMIT", playerId: "P1", cardId: "h1" }, ctx);
    if (!r1.ok) throw new Error(r1.error.message);
    expect(r1.state.flags.combatRound).toBe(2);
    expect(r1.state.flags.combatBowl).toBeGreaterThan(0);
    expect(r1.state.log.some((e) => e.type === "COMBAT_ROUND" && e.round === 1)).toBe(true);
    expect(r1.state.log.some((e) => e.type === "BARRIER_RESOLVED")).toBe(false);
    expect(getLegalActions(r1.state, "P1", ctx).some((a) => a.type === "COMMIT")).toBe(true);

    const r2 = dispatch(r1.state, { type: "COMMIT", playerId: "P1", cardId: "pass" }, ctx);
    if (!r2.ok) throw new Error(r2.error.message);
    expect(r2.state.log.some((e) => e.type === "COMBAT_ROUND" && e.round === 2)).toBe(true);
    expect(r2.state.log.some((e) => e.type === "BARRIER_RESOLVED")).toBe(true);
  });
});
