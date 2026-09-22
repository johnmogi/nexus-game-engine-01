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
    expect(state.players.every((p) => p.hand.length + Math.max(0, p.lineage.length - 1) === 5)).toBe(true);
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
    const jokers = end.players.reduce((n, p) => n + p.hand.filter((c) => c.cardId === "JOKER").length, 0);
    expect(instanceCount(end) - jokers).toBe(start);
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

  it("Majors never enter a player hand (Joker Eclipse token is the exception)", () => {
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, maxTurns: 24 } });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const end = play(createGame({ seed: "major-hand", playerCount: 2, ruleset, catalog }), ctx);
    for (const p of end.players) {
      for (const c of p.hand) {
        const def = catalog.get(c.cardId);
        expect(def?.arcana !== "major" || def.tags.includes("joker")).toBe(true);
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
        expect(cur?.rank).toBe((prev?.rank ?? 0) + ctx.ruleset.experimental.evolutionStep);
        if (!ctx.ruleset.experimental.evolveByColor) {
          expect(cur?.lineageId).toBe(prev?.lineageId);
        }
      }
    }
  });

  it("Eclipse fires when same-rank red + black courts sit on the Altar and grants Joker to hand", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "eclipse-cap", playerCount: 2, ruleset, catalog });
    expect(ctx.ruleset.experimental.altarMajorCap).toBe(2);
    const black = state.drawDeck.find((c) => c.cardId === "SUN-ROSES-J");
    const red = state.drawDeck.find((c) => c.cardId === "SUN-CRYSTALS-J");
    expect(black && red).toBeTruthy();
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      drawDeck: state.drawDeck.filter((c) => c.cardId !== black!.cardId && c.cardId !== red!.cardId),
      altar: { ...state.altar, major: [black!, red!] },
    };
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE")).toBe(true);
    expect(result.state.log.some((e) => e.type === "JOKER_TO_HAND")).toBe(true);
    expect(result.state.players[0]?.eclipse).toBe(true);
    expect(result.state.players[0]?.joker.active).toBe(true);
    expect(result.state.players[0]?.hand.some((c) => c.cardId === "JOKER")).toBe(true);
    expect(result.state.altar.major).toHaveLength(0);
  });

  it("two same-ink courts on the Altar do not Eclipse", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "eclipse-same-ink", playerCount: 2, ruleset, catalog });
    const a = state.drawDeck.find((c) => c.cardId === "SUN-ROSES-J");
    const b = state.drawDeck.find((c) => c.cardId === "SUN-VINES-Q");
    expect(a && b).toBeTruthy();
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      drawDeck: state.drawDeck.filter((c) => c.cardId !== a!.cardId && c.cardId !== b!.cardId),
      altar: { ...state.altar, major: [a!, b!] },
    };
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE")).toBe(false);
    expect(result.state.players[0]?.eclipse).toBe(false);
  });

  it("mixed-rank red + black courts on the Altar do not Eclipse", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "eclipse-mixed-rank", playerCount: 2, ruleset, catalog });
    const black = state.drawDeck.find((c) => c.cardId === "SUN-ROSES-J");
    const red = state.drawDeck.find((c) => c.cardId === "SUN-CRYSTALS-Q");
    expect(black && red).toBeTruthy();
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      drawDeck: state.drawDeck.filter((c) => c.cardId !== black!.cardId && c.cardId !== red!.cardId),
      altar: { ...state.altar, major: [black!, red!] },
    };
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE")).toBe(false);
  });

  it("L1 Altar Eclipse fires on Sun + Moon titled Majors (gold ink)", () => {
    const ruleset = l0Ruleset({
      experimental: {
        ...l0Ruleset().experimental,
        dealCourts: false,
        dealMajors: true,
        enableCharacterEvolution: true,
      },
    });
    const catalog = proxyCatalog();
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "eclipse-majors", playerCount: 2, ruleset, catalog });
    const sun = { instanceId: "s", cardId: "SUN-MAJ-02" };
    const moon = { instanceId: "m", cardId: "MOON-MAJ-02" };
    const next = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      altar: { ...state.altar, major: [sun, moon] },
    };
    const result = dispatch(next, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.log.some((e) => e.type === "ECLIPSE")).toBe(true);
    expect(result.state.players[0]?.eclipse).toBe(true);
    expect(result.state.altar.major).toHaveLength(0);
    expect(result.state.veil.some((c) => c.cardId === "SUN-MAJ-02")).toBe(true);
  });
});

function catalogRank(ctx: EngineCtx, cardId: string): number | undefined {
  return ctx.catalog.get(cardId)?.rank;
}
