import { evaluateInvariants, type EngineCtx, type GameState, type Ruleset } from "@nexus/game-core";

export interface RunRecord {
  seed: string;
  outcome: string;
  turnsPlayed: number;
  roundsPlayed: number;
  playerCount: number;
  eclipseCount: number;
  nexusCount: number;
  majorsSeen: number;
  majorsDiverted: number;
  majorsResurfaced: number;
  majorsReachedAltar: number;
  lineageClaims: number;
  lineageEvolutions: number;
  barriersWon: number;
  barriersLost: number;
  dialoguesWon: number;
  dialoguesLost: number;
  treasures: number;
  eventBarrier: number;
  eventDialogue: number;
  eventTreasure: number;
  elementalOpportunities: number;
  elementalUses: number;
  elementalSkips: number;
  elementalAir: number;
  elementalFire: number;
  elementalWater: number;
  elementalEarth: number;
  cardsCommitted: number;
  rewardsToHand: number;
  rewardsToAltar: number;
  rewardsToLineage: number;
  rewardsToVeil: number;
  hpLost: number;
  deaths: number;
  revivals: number | null;
  avgHandSize: number;
  maxHandSize: number;
  handLimitHits: number;
  invariantFailures: number;
  invariantCodes: string;
  firstLineageTurn: number | null;
  firstEclipseTurn: number | null;
  firstNexusTurn: number | null;
  dialogueBowlSum: number;
  dialogueThresholdSum: number;
  dialogueResolves: number;
  barrierTotalSum: number;
  barrierThresholdSum: number;
  barrierResolves: number;
  finalLineageRankMax: number | null;
  steps: number;
  events: number;
}

function firstTurn(state: GameState, pred: (e: GameState["log"][number]) => boolean): number | null {
  const e = state.log.find(pred);
  if (!e) return null;
  return typeof e.turn === "number" ? e.turn : null;
}

export function recordFromState(
  state: GameState,
  seed: string,
  steps: number,
  ruleset: Ruleset,
  ctx: EngineCtx,
): RunRecord {
  const log = state.log;
  const count = (t: string) => log.filter((e) => e.type === t).length;
  const eventKind = (kind: string) => log.filter((e) => e.type === "EVENT_ROLLED" && e.kind === kind).length;
  const rewardDest = (d: string) => log.filter((e) => e.type === "REWARD_TAKEN" && e.dest === d).length;
  const manipEl = (el: string) => log.filter((e) => e.type === "MANIP_USED" && e.element === el).length;
  const skipped = count("MANIP_SKIPPED");
  const used = count("MANIP_USED");
  const hpStart = ruleset.startingHealth * state.players.length;
  const hpNow = state.players.reduce((a, p) => a + p.health, 0);
  const warnings = evaluateInvariants(state, ctx);
  const handSizes = state.players.map((p) => p.hand.length);
  const overflow = count("HAND_OVERFLOW");
  const dialogue = log.filter((e) => e.type === "DIALOGUE_RESOLVED");
  const barrier = log.filter((e) => e.type === "BARRIER_RESOLVED");
  const ranks = state.players
    .map((p) => p.lineage.at(-1))
    .map((c) => (c ? ctx.catalog.get(c.cardId)?.rank : undefined))
    .filter((r): r is number => typeof r === "number");
  const diverted = count("MAJOR_DIVERTED");
  const drawMajors = log.filter((e) => e.type === "DRAW_TO_PD" && e.arcana === "major").length;
  return {
    seed,
    outcome: state.meta.outcome,
    turnsPlayed: state.meta.turn,
    roundsPlayed: state.meta.round,
    playerCount: state.meta.playerCount,
    eclipseCount: count("ECLIPSE"),
    nexusCount: log.filter((e) => e.type === "NEXUS_CHECK" && e.nexus).length,
    majorsSeen: drawMajors + diverted,
    majorsDiverted: diverted,
    majorsResurfaced: count("PD_RESURFACED"),
    majorsReachedAltar: state.altar.major.length,
    lineageClaims: count("LINEAGE_CLAIMED"),
    lineageEvolutions: count("LINEAGE_EVOLVED"),
    barriersWon: barrier.filter((e) => e.success).length,
    barriersLost: barrier.filter((e) => !e.success).length,
    dialoguesWon: dialogue.filter((e) => e.success).length,
    dialoguesLost: dialogue.filter((e) => !e.success).length,
    treasures: count("TREASURE"),
    eventBarrier: eventKind("barrier"),
    eventDialogue: eventKind("dialogue"),
    eventTreasure: eventKind("treasure"),
    elementalOpportunities: skipped + used,
    elementalUses: used,
    elementalSkips: skipped,
    elementalAir: manipEl("air"),
    elementalFire: manipEl("fire"),
    elementalWater: manipEl("water"),
    elementalEarth: manipEl("earth"),
    cardsCommitted: log.filter((e) => e.type === "COMMITTED" && e.cardId).length,
    rewardsToHand: rewardDest("hand"),
    rewardsToAltar: rewardDest("altar"),
    rewardsToLineage: rewardDest("lineage"),
    rewardsToVeil: rewardDest("veil"),
    hpLost: hpStart - hpNow,
    deaths: state.players.filter((p) => p.health <= 0).length,
    revivals: null,
    avgHandSize: handSizes.length ? handSizes.reduce((a, b) => a + b, 0) / handSizes.length : 0,
    maxHandSize: Math.max(0, ...handSizes, overflow ? ruleset.experimental.handLimit : 0),
    handLimitHits: overflow,
    invariantFailures: warnings.length,
    invariantCodes: [...new Set(warnings.map((w) => w.code))].join("|"),
    firstLineageTurn: firstTurn(state, (e) => e.type === "LINEAGE_CLAIMED"),
    firstEclipseTurn: firstTurn(state, (e) => e.type === "ECLIPSE"),
    firstNexusTurn: firstTurn(state, (e) => e.type === "NEXUS_CHECK" && e.nexus),
    dialogueBowlSum: dialogue.reduce((a, e) => a + (typeof e.bowl === "number" ? e.bowl : 0), 0),
    dialogueThresholdSum: dialogue.reduce((a, e) => a + (typeof e.threshold === "number" ? e.threshold : 0), 0),
    dialogueResolves: dialogue.length,
    barrierTotalSum: barrier.reduce((a, e) => a + (typeof e.total === "number" ? e.total : 0), 0),
    barrierThresholdSum: barrier.reduce(
      (a, e) => a + (typeof e.threshold === "number" ? e.threshold : 0),
      0,
    ),
    barrierResolves: barrier.length,
    finalLineageRankMax: ranks.length ? Math.max(...ranks) : null,
    steps,
    events: log.length,
  };
}

export const RUN_CSV_COLUMNS: (keyof RunRecord)[] = [
  "seed",
  "outcome",
  "turnsPlayed",
  "roundsPlayed",
  "playerCount",
  "eclipseCount",
  "nexusCount",
  "majorsSeen",
  "majorsDiverted",
  "majorsResurfaced",
  "lineageClaims",
  "lineageEvolutions",
  "barriersWon",
  "barriersLost",
  "dialoguesWon",
  "dialoguesLost",
  "elementalOpportunities",
  "elementalUses",
  "elementalSkips",
  "cardsCommitted",
  "rewardsToHand",
  "rewardsToAltar",
  "rewardsToLineage",
  "rewardsToVeil",
  "hpLost",
  "deaths",
  "revivals",
  "maxHandSize",
  "handLimitHits",
  "invariantFailures",
  "firstLineageTurn",
  "firstEclipseTurn",
  "firstNexusTurn",
];

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function runsToCsv(rows: RunRecord[]): string {
  const header = RUN_CSV_COLUMNS.join(",");
  const body = rows.map((r) => RUN_CSV_COLUMNS.map((k) => csvEscape(r[k])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

export function formatRunSeed(baseSeed: string, index1: number): string {
  return `${baseSeed}-${String(index1).padStart(4, "0")}`;
}
