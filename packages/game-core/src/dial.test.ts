import { describe, expect, it } from "vitest";
import { createGame, dispatch, dialForTurn, dialPattern, getLegalActions, l0Ruleset, proxyCatalog } from "./index.js";
import type { EngineCtx } from "./index.js";

describe("day dial patterns", () => {
  it("2p is DDNN so seats are not glued to one phase", () => {
    expect(dialPattern(2)).toEqual(["day", "day", "night", "night"]);
    expect(dialForTurn(1, 2, 1)).toBe("day");
    expect(dialForTurn(2, 2, 1)).toBe("day");
    expect(dialForTurn(3, 2, 1)).toBe("night");
    expect(dialForTurn(4, 2, 1)).toBe("night");
  });

  it("3p alternates DN (period coprime to 3)", () => {
    expect(dialPattern(3)).toEqual(["day", "night"]);
    expect(dialForTurn(1, 3, 1)).toBe("day");
    expect(dialForTurn(2, 3, 1)).toBe("night");
    expect(dialForTurn(3, 3, 1)).toBe("day");
  });

  it("4p uses DDN so period 3 is coprime to seating", () => {
    expect(dialPattern(4)).toEqual(["day", "day", "night"]);
    const seen = { P1: new Set<string>(), P2: new Set<string>(), P3: new Set<string>(), P4: new Set<string>() };
    for (let turn = 1; turn <= 12; turn++) {
      const seat = `P${((turn - 1) % 4) + 1}` as keyof typeof seen;
      seen[seat].add(dialForTurn(turn, 4, 1));
    }
    for (const phases of Object.values(seen)) {
      expect(phases.has("day")).toBe(true);
      expect(phases.has("night")).toBe(true);
    }
  });
});

describe("day dial in play", () => {
  it("L1 sets DIAL_SET and leaves L0 at none", () => {
    const catalog = proxyCatalog();
    const l0 = l0Ruleset();
    const s0 = createGame({ seed: "dial-l0", playerCount: 2, ruleset: l0, catalog });
    const ctx0: EngineCtx = { ruleset: l0, catalog };
    const after0 = dispatch(s0, getLegalActions(s0, "P1", ctx0)[0]!, ctx0);
    if (!after0.ok) throw new Error(after0.error.message);
    expect(after0.state.meta.dial).toBe("none");
    expect(after0.state.log.some((e) => e.type === "DIAL_SET")).toBe(false);

    const l1 = l0Ruleset({
      experimental: { ...l0.experimental, enableDayDial: true, playableLineageIds: [], tableAdvancesPerRound: 9 },
    });
    const s1 = createGame({ seed: "dial-l1", playerCount: 2, ruleset: l1, catalog });
    const ctx1: EngineCtx = { ruleset: l1, catalog };
    const afterSetup = dispatch(s1, getLegalActions(s1, "P1", ctx1)[0]!, ctx1);
    if (!afterSetup.ok) throw new Error(afterSetup.error.message);
    const afterTurn = dispatch(afterSetup.state, getLegalActions(afterSetup.state, "P1", ctx1)[0]!, ctx1);
    if (!afterTurn.ok) throw new Error(afterTurn.error.message);
    expect(afterTurn.state.meta.dial).toBe("day");
    expect(afterTurn.state.log.some((e) => e.type === "DIAL_SET")).toBe(true);
  });

  it("empty playableLineageIds deals all eight Ace–6 plus courts", () => {
    const catalog = proxyCatalog();
    const ruleset = l0Ruleset({ experimental: { ...l0Ruleset().experimental, playableLineageIds: [] } });
    const state = createGame({ seed: "eight", playerCount: 2, ruleset, catalog });
    expect(state.drawDeck).toHaveLength(72);
  });
});
