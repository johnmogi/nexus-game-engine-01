import type { ExperimentalRules, PhaseId, Ruleset } from "../types.js";

export const L0_PHASES: PhaseId[] = [
  "SETUP",
  "TURN_START",
  "PD_RESURFACE",
  "ADVANCE_ROUND_TABLE",
  "NORMALIZE_MAJORS",
  "CHECK_NEXUS",
  "ELEMENTAL_MANIPULATION",
  "ROLL_EVENT",
  "RESOLVE_EVENT",
  "REWARD",
  "LINEAGE_EVOLUTION",
  "ECLIPSE_NEXUS_CHECK",
  "TURN_END",
];

export const ADVANCES_PER_ROUND = 3;

const EXPERIMENTAL: ExperimentalRules = {
  startingHandSize: 3,
  handLimit: 7,
  rounds: 3,
  maxTurns: 9,
  dealMajors: true,
  barrierDamage: 1,
  barrierThreshold: 4,
  treasureDraw: 1,
  dialogueThreshold: 6,
  dialogueParticipants: "all_living",
  evolutionStep: 2,
  autoClaimAceLineage: true,
  eventBarrierMax: 2,
  eventDialogueMax: 4,
  altarMinorCap: 3,
  altarMajorCap: 2,
  manipulationFree: true,
  eclipseBonus: 1,
  tableAdvancesPerRound: ADVANCES_PER_ROUND,
  enableElementalManipulation: true,
  enableBarrier: true,
  enableDialogue: true,
  enableTreasure: true,
  enableEclipse: true,
  enableNexus: true,
  enableLineage: true,
  enableVeilRecycle: true,
};

export function l0Ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  const { experimental, ...rest } = overrides;
  const advances =
    experimental?.tableAdvancesPerRound ?? EXPERIMENTAL.tableAdvancesPerRound ?? ADVANCES_PER_ROUND;
  const rounds =
    experimental?.rounds ??
    (experimental?.maxTurns != null
      ? Math.max(1, Math.ceil(experimental.maxTurns / advances))
      : EXPERIMENTAL.rounds);
  return {
    id: "l0",
    version: "0.4.0",
    playerCountMin: 2,
    playerCountMax: 4,
    playableRanks: [1, 2, 3, 4, 5, 6],
    startingHealth: 3,
    phases: L0_PHASES,
    manipulation: {
      maxPerTurn: 1,
      paymentMode: "unspecified",
    },
    ...rest,
    experimental: {
      ...EXPERIMENTAL,
      ...experimental,
      tableAdvancesPerRound: advances,
      rounds,
      maxTurns: rounds * advances,
    },
  };
}
