import { describe, expect, it } from "vitest";
import { createGame, l0Ruleset, proxyCatalog, summarizeMatch } from "./index.js";

describe("match result", () => {
  it("clock expiry is not a scored winner while both live", () => {
    const catalog = proxyCatalog();
    const ruleset = l0Ruleset();
    const state = createGame({ seed: "res", playerCount: 2, ruleset, catalog });
    state.meta.outcome = "turn_limit";
    state.meta.phase = "OVER";
    state.meta.turn = 9;
    const res = summarizeMatch(state, catalog);
    expect(res.outcome).toBe("turn_limit");
    expect(res.headline).toMatch(/Clock ran out/);
    expect(res.headline).toMatch(/no scored winner/);
    expect(res.standings).toHaveLength(2);
    expect(res.survivorIds).toEqual(["P1", "P2"]);
  });

  it("names the last living seat if the party drops", () => {
    const catalog = proxyCatalog();
    const ruleset = l0Ruleset();
    const state = createGame({ seed: "res2", playerCount: 2, ruleset, catalog });
    state.meta.outcome = "party_down";
    state.meta.phase = "OVER";
    state.players[1]!.health = 0;
    const res = summarizeMatch(state, catalog);
    expect(res.headline).toMatch(/P1 is the last player standing/);
    expect(res.survivorIds).toEqual(["P1"]);
  });
});
