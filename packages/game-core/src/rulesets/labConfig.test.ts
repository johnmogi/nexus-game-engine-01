import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LabConfigError, compileLabDocument, parseLabDocument } from "./labConfig.js";
import { l0Ruleset } from "./l0.js";

const dir = dirname(fileURLToPath(import.meta.url));
const l0Path = resolve(dir, "../../../../config/l0.rules.json");
const l1Path = resolve(dir, "../../../../config/l1.rules.json");

function loadFile(p = l0Path) {
  return JSON.parse(readFileSync(p, "utf8")) as unknown;
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
    expect(ruleset.experimental.dealMajors).toBe(false);
    expect(ruleset.experimental.dealCourts).toBe(true);
    expect(ruleset.experimental.altarMajorCap).toBe(2);
    expect(ruleset.experimental.enableDayDial).toBe(false);
    expect(ruleset.experimental.enableCharacterEvolution).toBe(false);
    expect(ruleset.experimental.evolveByColor).toBe(false);
    expect(ruleset.experimental.autoClaimAceLineage).toBe(false);
    expect(l0Ruleset().experimental.maxTurns).toBe(9);
  });

  it("fails clearly on invalid config", () => {
    expect(() => parseLabDocument({ ...((loadFile() as object) ?? {}), playerCount: 5 })).toThrow(LabConfigError);
    expect(() => parseLabDocument("nope")).toThrow(/must be an object/);
    expect(() => parseLabDocument({ ...(loadFile() as object), majorUsesPD: false })).toThrow(/majorUsesPD/);
  });

  it("L1 is 3 rounds × 9 table advances = 27 turns", () => {
    const { ruleset } = compileLabDocument(parseLabDocument(loadFile(l1Path)));
    expect(ruleset.experimental.rounds).toBe(3);
    expect(ruleset.experimental.tableAdvancesPerRound).toBe(9);
    expect(ruleset.experimental.maxTurns).toBe(27);
    expect(ruleset.experimental.enableDayDial).toBe(true);
    expect(ruleset.experimental.dealMajors).toBe(true);
    expect(ruleset.experimental.dealCourts).toBe(false);
    expect(ruleset.experimental.eventCombatRounds).toBe(1);
    expect(ruleset.experimental.enableElementalDice).toBe(false);
    expect(ruleset.experimental.enableCharacterEvolution).toBe(true);
    expect(ruleset.experimental.evolveByColor).toBe(true);
    expect(ruleset.id).toBe("l1");
    expect(ruleset.experimental.playableLineageIds).toEqual([]);
  });
});
