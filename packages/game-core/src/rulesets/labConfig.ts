import { ADVANCES_PER_ROUND, l0Ruleset } from "./l0.js";
import type { DialogueParticipants, PlayerCount, Ruleset } from "../types.js";

export interface LabSimulationOptions {
  exportFullTrace: boolean;
  exportWarningTraces: boolean;
}

export interface L0LabDocument {
  version: string;
  playerCount: PlayerCount;
  rounds: number;
  tableAdvancesPerRound: number;
  startingHealth: number;
  startingHandSize: number;
  handLimit: number;
  minMinorRank: number;
  maxMinorRank: number;
  enableElementalManipulation: boolean;
  maxElementalManipulationsPerTurn: number;
  manipulationFree: boolean;
  enableBarrier: boolean;
  enableDialogue: boolean;
  enableTreasure: boolean;
  barrierDamage: number;
  barrierThreshold: number;
  dialogueThreshold: number;
  dialogueParticipants: DialogueParticipants;
  treasureDraw: number;
  eventBarrierMax: number;
  eventDialogueMax: number;
  enableMajors: boolean;
  enableCourts: boolean;
  majorUsesPD: true;
  altarMinorCap: number;
  altarMajorCap: number;
  enableEclipse: boolean;
  enableNexus: boolean;
  eclipseBonus: number;
  enableLineage: boolean;
  evolutionStep: number;
  evolveByColor: boolean;
  dealStartingAce: boolean;
  autoClaimAceLineage: boolean;
  enableVeilRecycle: boolean;
  enableDayDial: boolean;
  playableLineageIds: string[];
  enableCharacterEvolution: boolean;
  keepRoundTableFilled: boolean;
  eclipseOnTable: boolean;
  eclipseOnAltar: boolean;
  eventCombatRounds: 1 | 2;
  enableElementalDice: boolean;
  /** Tutorial: damage cannot kill (floor HP at 1). */
  preventDeath: boolean;
  /** Water manip may revive a downed ally before Veil→LEFT. */
  enableRevival: boolean;
  /** HP after Water revive (1 = crawl, 3 = full L1 start). */
  revivalHealth: number;
  simulation: LabSimulationOptions;
  unimplemented: Record<string, string>;
}

export class LabConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabConfigError";
  }
}

function num(raw: unknown, field: string, min?: number, max?: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new LabConfigError(`${field} must be a finite number`);
  }
  if (min != null && raw < min) throw new LabConfigError(`${field} must be >= ${min}`);
  if (max != null && raw > max) throw new LabConfigError(`${field} must be <= ${max}`);
  return raw;
}

function bool(raw: unknown, field: string): boolean {
  if (typeof raw !== "boolean") throw new LabConfigError(`${field} must be boolean`);
  return raw;
}

function str(raw: unknown, field: string): string {
  if (typeof raw !== "string" || !raw) throw new LabConfigError(`${field} must be a non-empty string`);
  return raw;
}

function strList(raw: unknown, field: string): string[] {
  if (!Array.isArray(raw)) throw new LabConfigError(`${field} must be an array of strings`);
  return raw.map((item, i) => {
    if (typeof item !== "string" || !item) throw new LabConfigError(`${field}[${i}] must be a non-empty string`);
    return item;
  });
}

export function parseLabDocument(raw: unknown): L0LabDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LabConfigError("rules JSON must be an object");
  }
  const o = raw as Record<string, unknown>;
  const playerCount = num(o.playerCount, "playerCount", 2, 4);
  if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) {
    throw new LabConfigError("playerCount must be 2, 3, or 4");
  }
  const participants = o.dialogueParticipants;
  if (participants !== "all_living" && participants !== "active_only") {
    throw new LabConfigError("dialogueParticipants must be all_living or active_only");
  }
  if (o.majorUsesPD !== true) {
    throw new LabConfigError("majorUsesPD must be true; L0 Majors use PD (see unimplemented)");
  }
  const simRaw = o.simulation;
  if (!simRaw || typeof simRaw !== "object" || Array.isArray(simRaw)) {
    throw new LabConfigError("simulation must be an object");
  }
  const sim = simRaw as Record<string, unknown>;
  const unimplemented =
    o.unimplemented && typeof o.unimplemented === "object" && !Array.isArray(o.unimplemented)
      ? (o.unimplemented as Record<string, string>)
      : {};
  const minMinorRank = num(o.minMinorRank, "minMinorRank", 1, 9);
  const maxMinorRank = num(o.maxMinorRank, "maxMinorRank", 1, 9);
  if (minMinorRank > maxMinorRank) throw new LabConfigError("minMinorRank must be <= maxMinorRank");
  const eventBarrierMax = num(o.eventBarrierMax, "eventBarrierMax", 0, 6);
  const eventDialogueMax = num(o.eventDialogueMax, "eventDialogueMax", 0, 6);
  if (eventBarrierMax < eventDialogueMax) {
    throw new LabConfigError("eventBarrierMax must be >= eventDialogueMax (1–2 dialogue, then barrier, then treasure)");
  }

  return {
    version: str(o.version, "version"),
    playerCount,
    rounds: num(o.rounds, "rounds", 1, 99),
    tableAdvancesPerRound: num(o.tableAdvancesPerRound, "tableAdvancesPerRound", 1, 12),
    startingHealth: num(o.startingHealth, "startingHealth", 1, 99),
    startingHandSize: num(o.startingHandSize, "startingHandSize", 0, 20),
    handLimit: num(o.handLimit, "handLimit", 1, 20),
    minMinorRank,
    maxMinorRank,
    enableElementalManipulation: bool(o.enableElementalManipulation, "enableElementalManipulation"),
    maxElementalManipulationsPerTurn: num(
      o.maxElementalManipulationsPerTurn,
      "maxElementalManipulationsPerTurn",
      0,
      4,
    ),
    manipulationFree: bool(o.manipulationFree, "manipulationFree"),
    enableBarrier: bool(o.enableBarrier, "enableBarrier"),
    enableDialogue: bool(o.enableDialogue, "enableDialogue"),
    enableTreasure: bool(o.enableTreasure, "enableTreasure"),
    barrierDamage: num(o.barrierDamage, "barrierDamage", 0, 9),
    barrierThreshold: num(o.barrierThreshold, "barrierThreshold", 0, 99),
    dialogueThreshold: num(o.dialogueThreshold, "dialogueThreshold", 0, 99),
    dialogueParticipants: participants,
    treasureDraw: num(o.treasureDraw, "treasureDraw", 0, 9),
    eventBarrierMax,
    eventDialogueMax,
    enableMajors: bool(o.enableMajors, "enableMajors"),
    enableCourts: o.enableCourts === undefined ? true : bool(o.enableCourts, "enableCourts"),
    majorUsesPD: true,
    altarMinorCap: num(o.altarMinorCap, "altarMinorCap", 0, 20),
    altarMajorCap: num(o.altarMajorCap, "altarMajorCap", 0, 20),
    enableEclipse: bool(o.enableEclipse, "enableEclipse"),
    enableNexus: bool(o.enableNexus, "enableNexus"),
    eclipseBonus: num(o.eclipseBonus, "eclipseBonus", 0, 9),
    enableLineage: bool(o.enableLineage, "enableLineage"),
    evolutionStep: num(o.evolutionStep, "evolutionStep", 1, 9),
    // Missing → same-lineage only (L0). L1 files must set true explicitly.
    evolveByColor: o.evolveByColor === undefined ? false : bool(o.evolveByColor, "evolveByColor"),
    dealStartingAce: o.dealStartingAce === undefined ? true : bool(o.dealStartingAce, "dealStartingAce"),
    autoClaimAceLineage: bool(o.autoClaimAceLineage, "autoClaimAceLineage"),
    enableVeilRecycle: bool(o.enableVeilRecycle, "enableVeilRecycle"),
    enableDayDial: o.enableDayDial === undefined ? false : bool(o.enableDayDial, "enableDayDial"),
    playableLineageIds: Array.isArray(o.playableLineageIds)
      ? strList(o.playableLineageIds, "playableLineageIds")
      : [],
    enableCharacterEvolution:
      o.enableCharacterEvolution === undefined
        ? false
        : bool(o.enableCharacterEvolution, "enableCharacterEvolution"),
    keepRoundTableFilled:
      o.keepRoundTableFilled === undefined ? true : bool(o.keepRoundTableFilled, "keepRoundTableFilled"),
    eclipseOnTable: o.eclipseOnTable === undefined ? true : bool(o.eclipseOnTable, "eclipseOnTable"),
    eclipseOnAltar: o.eclipseOnAltar === undefined ? true : bool(o.eclipseOnAltar, "eclipseOnAltar"),
    eventCombatRounds: (() => {
      if (o.eventCombatRounds === undefined) return 1 as const;
      const n = num(o.eventCombatRounds, "eventCombatRounds", 1, 2);
      if (n !== 1 && n !== 2) throw new LabConfigError("eventCombatRounds must be 1 or 2");
      return n as 1 | 2;
    })(),
    enableElementalDice:
      o.enableElementalDice === undefined ? false : bool(o.enableElementalDice, "enableElementalDice"),
    preventDeath: o.preventDeath === undefined ? false : bool(o.preventDeath, "preventDeath"),
    enableRevival: o.enableRevival === undefined ? false : bool(o.enableRevival, "enableRevival"),
    revivalHealth: o.revivalHealth === undefined ? 1 : num(o.revivalHealth, "revivalHealth", 1, 99),
    simulation: {
      exportFullTrace: bool(sim.exportFullTrace, "simulation.exportFullTrace"),
      exportWarningTraces: bool(sim.exportWarningTraces, "simulation.exportWarningTraces"),
    },
    unimplemented,
  };
}

export function compileLabDocument(doc: L0LabDocument): {
  ruleset: Ruleset;
  playerCount: PlayerCount;
  simulation: LabSimulationOptions;
  document: L0LabDocument;
} {
  const playableRanks: number[] = [];
  for (let r = doc.minMinorRank; r <= doc.maxMinorRank; r++) playableRanks.push(r);
  const ruleset = l0Ruleset({
    id: doc.version.startsWith("l1") ? "l1" : "l0",
    version: doc.version,
    startingHealth: doc.startingHealth,
    playableRanks,
    manipulation: {
      maxPerTurn: doc.enableElementalManipulation ? doc.maxElementalManipulationsPerTurn : 0,
      paymentMode: doc.manipulationFree ? "free" : "unspecified",
    },
    experimental: {
      ...l0Ruleset().experimental,
      rounds: doc.rounds,
      tableAdvancesPerRound: doc.tableAdvancesPerRound,
      maxTurns: doc.rounds * doc.tableAdvancesPerRound,
      startingHandSize: doc.startingHandSize,
      handLimit: doc.handLimit,
      dealMajors: doc.enableMajors,
      dealCourts: doc.enableCourts,
      barrierDamage: doc.barrierDamage,
      barrierThreshold: doc.barrierThreshold,
      treasureDraw: doc.treasureDraw,
      dialogueThreshold: doc.dialogueThreshold,
      dialogueParticipants: doc.dialogueParticipants,
      evolutionStep: doc.evolutionStep,
      evolveByColor: doc.evolveByColor,
      dealStartingAce: doc.dealStartingAce,
      autoClaimAceLineage: doc.autoClaimAceLineage,
      eventBarrierMax: doc.eventBarrierMax,
      eventDialogueMax: doc.eventDialogueMax,
      altarMinorCap: doc.altarMinorCap,
      altarMajorCap: doc.altarMajorCap,
      manipulationFree: doc.manipulationFree,
      eclipseBonus: doc.eclipseBonus,
      enableElementalManipulation: doc.enableElementalManipulation,
      enableBarrier: doc.enableBarrier,
      enableDialogue: doc.enableDialogue,
      enableTreasure: doc.enableTreasure,
      enableEclipse: doc.enableEclipse,
      enableNexus: doc.enableNexus,
      enableLineage: doc.enableLineage,
      enableVeilRecycle: doc.enableVeilRecycle,
      enableDayDial: doc.enableDayDial,
      playableLineageIds: doc.playableLineageIds,
      enableCharacterEvolution: doc.enableCharacterEvolution,
      keepRoundTableFilled: doc.keepRoundTableFilled,
      eclipseOnTable: doc.eclipseOnTable,
      eclipseOnAltar: doc.eclipseOnAltar,
      eventCombatRounds: doc.eventCombatRounds,
      enableElementalDice: doc.enableElementalDice,
      elementCycle: null,
      preventDeath: doc.preventDeath,
      enableRevival: doc.enableRevival,
      revivalHealth: doc.revivalHealth,
    },
  });
  return { ruleset, playerCount: doc.playerCount, simulation: doc.simulation, document: doc };
}

export const DEFAULT_TABLE_ADVANCES = ADVANCES_PER_ROUND;
