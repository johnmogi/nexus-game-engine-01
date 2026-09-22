import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatch,
  getLegalActions,
  l0Ruleset,
  matchingTableRoyals,
  proxyCatalog,
  type EngineCtx,
} from "./index.js";
import { fillRoundTable } from "./ops.js";

describe("keepRoundTableFilled", () => {
  it("packs LEFT/MIDDLE/PD after the first table advance", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    let state = createGame({ seed: "fill-table", playerCount: 2, ruleset, catalog });
    const r = dispatch(state, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    state = r.state;
    const packed = dispatch(state, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!packed.ok) throw new Error(packed.error.message);
    state = packed.state;
    while (state.meta.phase !== "ELEMENTAL_MANIPULATION" && state.meta.outcome === "playing") {
      const n = dispatch(state, { type: "ADVANCE", playerId: state.meta.activePlayerId }, ctx);
      if (!n.ok) throw new Error(n.error.message);
      state = n.state;
      if (state.meta.phase === "ELEMENTAL_MANIPULATION") break;
    }
    expect(state.roundTable.pd.length).toBe(1);
    expect(state.roundTable.middle.length).toBe(1);
    expect(state.roundTable.left.length).toBe(1);
  });

  it("does not dump a stack of courts into the Altar when filling empty seats", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const base = createGame({ seed: "no-blender", playerCount: 2, ruleset, catalog });
    const courts = base.drawDeck.filter((c) => /-[JQK]$/.test(c.cardId));
    const minors = base.drawDeck.filter((c) => catalog.get(c.cardId)?.arcana === "minor");
    expect(courts.length).toBeGreaterThanOrEqual(4);
    const state = {
      ...base,
      meta: { ...base.meta, turn: 1 },
      drawDeck: [...courts.slice(0, 4), ...minors],
      roundTable: {
        left: [] as typeof base.roundTable.left,
        middle: [] as typeof base.roundTable.middle,
        pd: [{ instanceId: "pd1", cardId: "SUN-ROSES-2", arrivedTurn: 1 }],
      },
      altar: { minors: [], major: [] as typeof base.altar.major },
      veil: [] as typeof base.veil,
      log: [...base.log],
    };
    fillRoundTable(state, ctx);
    const diverted = state.log.filter((e) => e.type === "MAJOR_DIVERTED" && String(e.reason).startsWith("fill_"));
    expect(diverted.length).toBeLessThanOrEqual(2);
    expect(state.altar.major.length).toBeLessThanOrEqual(2);
  });

  it("sends an L0 court through PD onto the Altar on the next turn", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    let state = createGame({ seed: "court-pd", playerCount: 2, ruleset, catalog });
    const jack = state.drawDeck.find((c) => c.cardId.endsWith("-J"));
    expect(jack).toBeTruthy();
    state.drawDeck = [jack!, ...state.drawDeck.filter((c) => c.instanceId !== jack!.instanceId)];
    for (let i = 0; i < 120 && state.meta.outcome === "playing"; i++) {
      const legal = getLegalActions(state, state.meta.activePlayerId, ctx);
      const act =
        legal.find((a) => a.type === "ADVANCE") ??
        legal.find((a) => a.type === "SKIP_MANIP") ??
        legal[0];
      if (!act) break;
      const r = dispatch(state, act, ctx);
      if (!r.ok) throw new Error(r.error.message);
      state = r.state;
      if (state.altar.major.some((c) => c.cardId.endsWith("-J"))) break;
    }
    expect(state.altar.major.some((c) => c.cardId.endsWith("-J"))).toBe(true);
  });

  it("refills LEFT after Air buries it", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "air-fill", playerCount: 2, ruleset, catalog });
    state.roundTable.left = [state.drawDeck.shift()!];
    state.roundTable.middle = [state.drawDeck.shift()!];
    state.roundTable.pd = [state.drawDeck.shift()!];
    const buried = state.roundTable.left[0]!.instanceId;
    state.meta.phase = "ELEMENTAL_MANIPULATION";
    const r = dispatch(state, { type: "MANIP", playerId: "P1", element: "air" }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.state.roundTable.left[0]?.instanceId).not.toBe(buried);
    expect(r.state.roundTable.left).toHaveLength(1);
    expect(r.state.roundTable.pd).toHaveLength(1);
  });
});

describe("eclipseOnTable", () => {
  it("fires when a Sun/Moon Major pair sits on the round table", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, dealMajors: true } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "pair-eclipse", playerCount: 2, ruleset, catalog });
    const sun = state.hold.nexus.find((c) => c.cardId === "SUN-MAJ-00");
    const moon = state.hold.nexus.find((c) => c.cardId === "MOON-MAJ-00");
    expect(sun && moon).toBeTruthy();
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      roundTable: {
        left: sun ? [sun] : [],
        middle: moon ? [moon] : [],
        pd: [],
      },
      hold: { ...state.hold, nexus: [] },
    };
    expect(matchingTableRoyals(next, ctx)?.rank).toBe(0);
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE" && e.source === "table")).toBe(true);
    expect(result.state.players[0]?.joker.active).toBe(true);
    expect(result.state.players[0]?.hand.some((c) => c.cardId === "JOKER")).toBe(true);
  });
});
