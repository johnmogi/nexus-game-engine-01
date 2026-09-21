import { describe, expect, it } from "vitest";
import {
  actorId,
  createGame,
  dispatch,
  getLegalActions,
  instanceCount,
  l0Ruleset,
  proxyCatalog,
  evaluateInvariants,
  type EngineCtx,
  type GameState,
} from "./index.js";

function make(playerCount: 2 | 3 | 4 = 2, seed = "accept") {
  const ruleset = l0Ruleset();
  const catalog = proxyCatalog();
  const ctx: EngineCtx = { ruleset, catalog };
  const state = createGame({ seed, playerCount, ruleset, catalog });
  return { state, ctx, ruleset, catalog };
}

function actor(state: GameState, ctx: EngineCtx): string {
  if (getLegalActions(state, actorId(state), ctx).length) return actorId(state);
  const p = state.players.find((pl) => getLegalActions(state, pl.id, ctx).length);
  return p?.id ?? actorId(state);
}

function step(state: GameState, ctx: EngineCtx): GameState {
  const id = actor(state, ctx);
  const legal = getLegalActions(state, id, ctx);
  expect(legal.length).toBeGreaterThan(0);
  const result = dispatch(state, legal[0]!, ctx);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function play(state: GameState, ctx: EngineCtx, max = 2000): GameState {
  let s = state;
  for (let i = 0; i < max; i++) {
    if (s.meta.outcome !== "playing") return s;
    s = step(s, ctx);
  }
  throw new Error("did not finish");
}

function until(state: GameState, ctx: EngineCtx, pred: (s: GameState) => boolean): GameState {
  let s = state;
  for (let i = 0; i < 400; i++) {
    if (pred(s)) return s;
    s = step(s, ctx);
  }
  throw new Error("predicate not reached");
}

describe("M1.5 acceptance", () => {
  it("starting hand is configurable and never exceeds 7", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, startingHandSize: 5 } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    let state = createGame({ seed: "hand", playerCount: 2, ruleset, catalog });
    state = until(state, ctx, (s) => s.meta.phase === "TURN_START");
    expect(state.players.every((p) => p.hand.length === 5)).toBe(true);
    const end = play(state, ctx);
    expect(end.players.every((p) => p.hand.length <= 7)).toBe(true);
  });

  it("displays turn as n/maxTurns and never 13/7", () => {
    const { state, ctx } = make(2, "clock");
    const end = play(state, ctx);
    expect(end.meta.maxTurns).toBe(9);
    expect(end.meta.rounds).toBe(3);
    expect(end.meta.turn).toBeLessThanOrEqual(9);
    expect(end.meta.turn).toBeGreaterThanOrEqual(1);
    expect(`${end.meta.turn}/${end.meta.maxTurns}`).not.toBe("13/7");
    expect(end.meta.outcome).toBe("turn_limit");
    expect(end.log.some((e) => e.type === "ROUND_BEGAN" && e.round === 1)).toBe(true);
    expect(end.log.filter((e) => e.type === "ROUND_ENDED").map((e) => `${e.from}→${e.to}`)).toEqual([
      "1→2",
      "2→3",
      "3→3",
    ]);
    expect(end.log.some((e) => e.type === "ROUND_ENDED" && e.to === 4)).toBe(false);
    const lastRound = end.log.filter((e) => e.type === "ROUND_ENDED").at(-1);
    expect(lastRound?.final).toBe(true);
    expect(lastRound?.from).toBe(3);
  });

  it("draws new cards onto PD, not LEFT", () => {
    const { state, ctx } = make(2, "pd-enter");
    const advanced = until(state, ctx, (s) => s.log.some((e) => e.type === "DRAW_TO_PD"));
    expect(advanced.roundTable.pd).toHaveLength(1);
    expect(advanced.log.some((e) => e.type === "DRAW_TO_LEFT")).toBe(false);
    expect(advanced.log.some((e) => e.type === "LEFT_TO_MIDDLE")).toBe(false);
  });

  it("never emits PD_RESURFACED for a minor", () => {
    const { state, ctx, catalog } = make(2, "minor-pd");
    const end = play(state, ctx);
    for (const e of end.log) {
      if (e.type !== "PD_RESURFACED") continue;
      const def = catalog.get(String(e.cardId));
      expect(def?.arcana).toBe("major");
    }
  });

  it("Majors go PD then next-turn Altar, not LEFT-to-Altar", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, maxTurns: 24 } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    let s = createGame({ seed: "maj-life", playerCount: 2, ruleset, catalog });
    s = play(s, ctx);
    expect(s.log.some((e) => e.type === "MAJOR_TO_ALTAR")).toBe(false);
    const majorDraw = s.log.filter((e) => e.type === "DRAW_TO_PD" && e.arcana === "major");
    if (majorDraw.length) {
      expect(s.log.some((e) => e.type === "PD_RESURFACED")).toBe(true);
    }
  });

  it("Ace–6 dealt; 7–9 stay catalog-only", () => {
    const { state, catalog, ruleset } = make();
    const playable = new Set(ruleset.playableRanks);
    for (const c of state.drawDeck) {
      const d = catalog.get(c.cardId);
      if (d?.arcana === "minor") expect(playable.has(d.rank)).toBe(true);
    }
    expect(catalog.all().some((c) => c.rank >= 7)).toBe(true);
  });

  it("conservation holds through a finished match", () => {
    const { state, ctx } = make(3, "cons");
    const start = instanceCount(state);
    const end = play(state, ctx);
    expect(instanceCount(end)).toBe(start);
  });

  it("lineage lock never returns a prior form to veil", () => {
    const { state, ctx } = make(2, "evo");
    const end = play(state, ctx);
    const locked = end.players.flatMap((p) => p.lineage.map((c) => c.instanceId));
    const veil = new Set(end.veil.map((c) => c.instanceId));
    for (const id of locked) expect(veil.has(id)).toBe(false);
  });

  it("Barrier and Dialogue wait for COMMIT rather than auto-drawing or auto-damage", () => {
    const { state, ctx } = make(2, "events");
    const end = play(state, ctx);
    expect(end.log.some((e) => e.type === "DIALOGUE_DRAW")).toBe(false);
    const autoDmg = end.log.filter((e) => e.type === "BARRIER" && e.damage === 1 && !end.log.some((x) => x.type === "BARRIER_RESOLVED"));
    expect(autoDmg).toHaveLength(0);
  });

  it("Majors never enter a player hand", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, maxTurns: 24 } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const end = play(createGame({ seed: "major-hand", playerCount: 2, ruleset, catalog }), ctx);
    for (const p of end.players) {
      for (const c of p.hand) {
        expect(catalog.get(c.cardId)?.arcana).not.toBe("major");
      }
    }
  });

  it("finished matches have legal lineage stacks only", () => {
    const { state, ctx } = make(2, "lineage-law");
    const end = play(state, ctx);
    expect(evaluateInvariants(end, ctx).filter((w) => w.code === "INVALID_LINEAGE")).toHaveLength(0);
    for (const p of end.players) {
      if (!p.lineage.length) continue;
      const first = catalogRank(ctx, p.lineage[0]!.cardId);
      expect(first).toBe(1);
      for (let i = 1; i < p.lineage.length; i++) {
        const prev = ctx.catalog.get(p.lineage[i - 1]!.cardId);
        const cur = ctx.catalog.get(p.lineage[i]!.cardId);
        expect(cur?.lineageId).toBe(prev?.lineageId);
        expect(cur?.rank).toBe((prev?.rank ?? 0) + ctx.ruleset.experimental.evolutionStep);
      }
    }
  });

  it("Eclipse fires when two Majors sit on the Altar", () => {
    const { state, ctx } = make(2, "eclipse-cap");
    expect(ctx.ruleset.experimental.altarMajorCap).toBe(2);
    const majors = state.drawDeck.filter((c) => ctx.catalog.get(c.cardId)?.arcana === "major");
    expect(majors.length).toBeGreaterThanOrEqual(2);
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      drawDeck: state.drawDeck.filter((c) => ctx.catalog.get(c.cardId)?.arcana !== "major"),
      altar: { ...state.altar, major: majors.slice(0, 2) },
    };
    const legal = getLegalActions(next, "P1", ctx);
    expect(legal.some((a) => a.type === "ADVANCE")).toBe(true);
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE")).toBe(true);
    expect(result.state.players[0]?.eclipse).toBe(true);
    expect(result.state.players[0]?.joker.active).toBe(true);
  });
});

function catalogRank(ctx: EngineCtx, cardId: string): number | undefined {
  return ctx.catalog.get(cardId)?.rank;
}
