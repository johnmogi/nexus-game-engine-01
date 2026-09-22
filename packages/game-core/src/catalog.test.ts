import { describe, expect, it } from "vitest";
import { createGame, dispatch, getLegalActions, l0Ruleset, labelCard, proxyCatalog } from "./index.js";
import { CHARACTER_IDS, NEXUS_IDS, isTableMajor } from "./catalog/majors.js";
import type { EngineCtx } from "./types.js";

describe("20 majors and hold", () => {
  const catalog = proxyCatalog();

  it("labels Sun/Moon lineage without element paren (no fake secondary)", () => {
    expect(labelCard(catalog, { instanceId: "a", cardId: "SUN-ROSES-1" })).toBe("Sun A roses");
    expect(labelCard(catalog, { instanceId: "b", cardId: "MOON-FIRE-3" })).toBe("Moon 3 fire");
    expect(labelCard(catalog, { instanceId: "c", cardId: "SUN-ROSES-1" })).not.toMatch(/\(/);
  });

  it("catalog has 20 Major Arcana plus 24 JQK courts", () => {
    const arcana = catalog.all().filter((c) => c.arcana === "major" && !c.tags.includes("court") && !c.tags.includes("joker"));
    expect(arcana).toHaveLength(20);
    expect(catalog.all().filter((c) => c.tags.includes("court"))).toHaveLength(24);
    expect(NEXUS_IDS).toHaveLength(2);
    expect(CHARACTER_IDS).toEqual(["SUN-MAJ-01", "MOON-MAJ-01", "SUN-MAJ-03", "MOON-MAJ-03"]);
    expect(catalog.get("SUN-MAJ-02")?.name).toBe("The Connection");
    expect(catalog.get("SUN-MAJ-03")?.name).toBe("The Lucid Dreamer");
    expect(catalog.get("MOON-MAJ-03")?.name).toBe("The Sheman");
    expect(catalog.get("SUN-ROSES-J")?.name).toBe("Jack of Roses");
    expect(arcana.filter(isTableMajor)).toHaveLength(14);
  });

  it("L0 deals 12 Sun JQK and keeps Nexus/characters in hold", () => {
    const state = createGame({ seed: "hold", playerCount: 2, ruleset: l0Ruleset(), catalog });
    const courts = state.drawDeck.filter((c) => catalog.get(c.cardId)?.tags.includes("court"));
    expect(courts).toHaveLength(12);
    expect(courts.every((c) => /-[JQK]$/.test(c.cardId) && c.cardId.startsWith("SUN-"))).toBe(true);
    expect(state.drawDeck.some((c) => c.cardId.includes("-MAJ-"))).toBe(false);
    expect(state.hold.nexus.map((c) => c.cardId).sort()).toEqual([...NEXUS_IDS].sort());
    expect(state.hold.characters.map((c) => c.cardId).sort()).toEqual([...CHARACTER_IDS].sort());
  });

  it("L1 deals the 14 table Majors and still holds Nexus + characters", () => {
    const ruleset = l0Ruleset({
      experimental: {
        ...l0Ruleset().experimental,
        dealMajors: true,
        dealCourts: false,
        playableLineageIds: [],
      },
    });
    const state = createGame({ seed: "l1-maj", playerCount: 2, ruleset, catalog });
    const table = state.drawDeck.filter((c) => {
      const d = catalog.get(c.cardId);
      return d?.arcana === "major" && !d.tags.includes("joker");
    });
    expect(table).toHaveLength(14);
    expect(table.every((c) => isTableMajor(catalog.get(c.cardId)!))).toBe(true);
    expect(state.hold.nexus).toHaveLength(2);
    expect(state.hold.characters).toHaveLength(4);
  });

  it("L1 opening deal leaves Majors in the deck, not Veil or Altar", () => {
    const ruleset = l0Ruleset({
      experimental: {
        ...l0Ruleset().experimental,
        dealMajors: true,
        dealCourts: false,
        playableLineageIds: [],
      },
    });
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "l1-open", playerCount: 2, ruleset, catalog });
    const dealt = dispatch(state, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!dealt.ok) throw new Error(dealt.error.message);
    const s = dealt.state;
    expect(s.log.some((e) => e.type === "MAJOR_DIVERTED" && e.reason === "hand_blocked")).toBe(false);
    expect(s.veil.every((c) => catalog.get(c.cardId)?.rank === 1)).toBe(true);
    expect(s.veil.length).toBeGreaterThan(0);
    expect(s.altar.major).toHaveLength(0);
    expect(s.roundTable.pd).toHaveLength(0);
    expect(s.drawDeck.filter((c) => {
      const d = catalog.get(c.cardId);
      return d?.arcana === "major" && !d.tags.includes("joker");
    })).toHaveLength(14);
  });

  it("after Eclipse the active player picks a character with no impact yet", () => {
    const ruleset = l0Ruleset({
      experimental: { ...l0Ruleset().experimental, dealMajors: true, dealCourts: false, enableCharacterEvolution: true },
    });
    const ctx: EngineCtx = { ruleset, catalog };
    const state = createGame({ seed: "aspect", playerCount: 2, ruleset, catalog });
    const sun = state.drawDeck.find((c) => c.cardId.startsWith("SUN-MAJ-"));
    const moon = state.drawDeck.find((c) => c.cardId === (sun ? catalog.get(sun.cardId)?.pairId : ""));
    expect(sun && moon).toBeTruthy();
    const primed = {
      ...state,
      meta: { ...state.meta, phase: "ECLIPSE_NEXUS_CHECK" as const },
      drawDeck: state.drawDeck.filter((c) => c.instanceId !== sun!.instanceId && c.instanceId !== moon!.instanceId),
      roundTable: { left: [sun!], middle: [moon!], pd: [] },
    };
    const eclipsed = dispatch(primed, { type: "ADVANCE", playerId: "P1" }, ctx);
    if (!eclipsed.ok) throw new Error(eclipsed.error.message);
    expect(eclipsed.state.players[0]?.eclipse).toBe(true);
    expect(eclipsed.state.players[0]?.hand.some((c) => c.cardId === "JOKER")).toBe(true);
    const picks = getLegalActions(eclipsed.state, "P1", ctx);
    expect(picks.every((a) => a.type === "CHOOSE_CHARACTER")).toBe(true);
    expect(picks).toHaveLength(4);
    const pick = dispatch(eclipsed.state, picks[0]!, ctx);
    if (!pick.ok) throw new Error(pick.error.message);
    expect(pick.state.players[0]?.aspect).toBe("SUN-MAJ-01");
    expect(pick.state.hold.characters).toHaveLength(3);
    expect(pick.state.log.some((e) => e.type === "CHARACTER_CLAIMED" && e.impact === "pending")).toBe(true);
  });
});
