import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LabConfigError, compileLabDocument, parseLabDocument } from "./labConfig.js";
import { l0Ruleset } from "./l0.js";

const configPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../config/l0.rules.json");

function loadFile() {
  return JSON.parse(readFileSync(configPath, "utf8")) as unknown;
}

describe("L0 lab rules JSON", () => {
  it("validates and compiles into the engine Ruleset", () => {
    const doc = parseLabDocument(loadFile());
    const { ruleset, playerCount } = compileLabDocument(doc);
    expect(playerCount).toBe(2);
    expect(ruleset.experimental.rounds).toBe(3);
    expect(ruleset.experimental.tableAdvancesPerRound).toBe(3);
    expect(ruleset.experimental.maxTurns).toBe(9);
    expect(ruleset.playableRanks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ruleset.experimental.dealMajors).toBe(true);
    expect(l0Ruleset().experimental.maxTurns).toBe(9);
  });

  it("fails clearly on invalid config", () => {
    expect(() => parseLabDocument({ ...((loadFile() as object) ?? {}), playerCount: 5 })).toThrow(LabConfigError);
    expect(() => parseLabDocument("nope")).toThrow(/must be an object/);
    expect(() => parseLabDocument({ ...(loadFile() as object), majorUsesPD: false })).toThrow(/majorUsesPD/);
  });

  it("rounds × tableAdvancesPerRound is the turn limit", () => {
    const base = parseLabDocument(loadFile());
    const { ruleset } = compileLabDocument({ ...base, rounds: 4, tableAdvancesPerRound: 3 });
    expect(ruleset.experimental.maxTurns).toBe(12);
  });
});
