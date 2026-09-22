import { describe, expect, it } from "vitest";
import { createGame, dispatch, l0Ruleset, proxyCatalog, type EngineCtx } from "./index.js";
import { applyWaterManip, hurt } from "./ops.js";

describe("preventDeath + Water revival", () => {
  it("preventDeath floors damage at 1 HP", () => {
    const base = l0Ruleset();
    const ruleset = l0Ruleset({
      experimental: { ...base.experimental, preventDeath: true },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "no-die", playerCount: 2, ruleset, catalog });
    state.players[0]!.health = 2;
    const lost = hurt(state, "P1", 9, ctx);
    expect(lost).toBe(1);
    expect(state.players[0]!.health).toBe(1);
  });

  it("without preventDeath, damage can kill", () => {
    const base = l0Ruleset();
    const ruleset = l0Ruleset({
      experimental: { ...base.experimental, preventDeath: false },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "can-die", playerCount: 2, ruleset, catalog });
    state.players[0]!.health = 2;
    hurt(state, "P1", 9, ctx);
    expect(state.players[0]!.health).toBe(0);
  });

  it("Water manip revives a downed ally to revivalHealth when enableRevival", () => {
    const base = l0Ruleset();
    const ruleset = l0Ruleset({
      experimental: {
        ...base.experimental,
        preventDeath: false,
        enableRevival: true,
        revivalHealth: 1,
      },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "revive", playerCount: 2, ruleset, catalog });
    state.players[1]!.health = 0;
    const water = applyWaterManip(state, ctx);
    expect(water.ok).toBe(true);
    expect(water.revivedPlayerId).toBe("P2");
    expect(water.healthGranted).toBe(1);
    expect(state.players[1]!.health).toBe(1);
  });

  it("Water revival can grant 3 HP when configured", () => {
    const base = l0Ruleset();
    const ruleset = l0Ruleset({
      experimental: {
        ...base.experimental,
        enableRevival: true,
        revivalHealth: 3,
      },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "revive3", playerCount: 2, ruleset, catalog });
    state.players[1]!.health = 0;
    const water = applyWaterManip(state, ctx);
    expect(water.healthGranted).toBe(3);
    expect(state.players[1]!.health).toBe(3);
  });

  it("dispatch Water emits PLAYER_REVIVED", () => {
    const base = l0Ruleset();
    const ruleset = l0Ruleset({
      experimental: {
        ...base.experimental,
        enableRevival: true,
        revivalHealth: 1,
        manipulationFree: true,
      },
      manipulation: { maxPerTurn: 1, paymentMode: "free" },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "revive-dispatch", playerCount: 2, ruleset, catalog });
    state.players[1]!.health = 0;
    state.meta.phase = "ELEMENTAL_MANIPULATION";
    state.meta.activePlayerId = "P1";
    state.flags.manipUsedThisTurn = false;
    const r = dispatch(state, { type: "MANIP", playerId: "P1", element: "water" }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.state.log.some((e) => e.type === "PLAYER_REVIVED" && e.health === 1)).toBe(true);
  });
});
