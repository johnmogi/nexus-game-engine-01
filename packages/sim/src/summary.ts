import type { RunRecord } from "./metrics.js";

function pct(n: number, d: number): number | null {
  if (!d) return null;
  return (n / d) * 100;
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function avgWhen(rows: RunRecord[], sel: (r: RunRecord) => number | null): number | null {
  return avg(rows.map(sel).filter((x): x is number => x != null));
}

function dist(rows: RunRecord[], sel: (r: RunRecord) => string | number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(sel(r));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function buildSummary(rows: RunRecord[]): Record<string, unknown> {
  const n = rows.length;
  const events = rows.reduce((a, r) => a + r.eventBarrier + r.eventDialogue + r.eventTreasure, 0);
  const barriers = rows.reduce((a, r) => a + r.barrierResolves, 0);
  const dialogues = rows.reduce((a, r) => a + r.dialogueResolves, 0);
  const barrierW = rows.reduce((a, r) => a + r.barriersWon, 0);
  const barrierL = rows.reduce((a, r) => a + r.barriersLost, 0);
  const dialW = rows.reduce((a, r) => a + r.dialoguesWon, 0);
  const dialL = rows.reduce((a, r) => a + r.dialoguesLost, 0);
  const opps = rows.reduce((a, r) => a + r.elementalOpportunities, 0);
  const used = rows.reduce((a, r) => a + r.elementalUses, 0);
  const skipped = rows.reduce((a, r) => a + r.elementalSkips, 0);
  const rewards =
    rows.reduce((a, r) => a + r.rewardsToHand + r.rewardsToAltar + r.rewardsToLineage + r.rewardsToVeil, 0);
  const inv = dist(
    rows.filter((r) => r.invariantCodes),
    (r) => r.invariantCodes,
  );
  const codeCount: Record<string, number> = {};
  for (const r of rows) {
    if (!r.invariantCodes) continue;
    for (const c of r.invariantCodes.split("|")) codeCount[c] = (codeCount[c] ?? 0) + 1;
  }
  const rankDist = dist(
    rows.filter((r) => r.finalLineageRankMax != null),
    (r) => r.finalLineageRankMax as number,
  );

  return {
    gamesCompleted: n,
    outcomes: dist(rows, (r) => r.outcome),
    outcomePct: Object.fromEntries(
      Object.entries(dist(rows, (r) => r.outcome)).map(([k, v]) => [k, pct(v, n)]),
    ),
    events: {
      barrier: { count: rows.reduce((a, r) => a + r.eventBarrier, 0), pct: pct(rows.reduce((a, r) => a + r.eventBarrier, 0), events) },
      dialogue: { count: rows.reduce((a, r) => a + r.eventDialogue, 0), pct: pct(rows.reduce((a, r) => a + r.eventDialogue, 0), events) },
      treasure: { count: rows.reduce((a, r) => a + r.eventTreasure, 0), pct: pct(rows.reduce((a, r) => a + r.eventTreasure, 0), events) },
      denominator: "EVENT_ROLLED among barrier|dialogue|treasure",
    },
    dialogue: {
      successPct: pct(dialW, dialogues),
      failurePct: pct(dialL, dialogues),
      averageBowl: dialogues ? rows.reduce((a, r) => a + r.dialogueBowlSum, 0) / dialogues : null,
      averageThreshold: dialogues ? rows.reduce((a, r) => a + r.dialogueThresholdSum, 0) / dialogues : null,
      averageCardsCommitted: n ? rows.reduce((a, r) => a + r.cardsCommitted, 0) / n : null,
      averageOvercommit:
        dialW > 0
          ? rows.reduce((a, r) => a + Math.max(0, r.dialogueBowlSum - r.dialogueThresholdSum), 0) /
            Math.max(1, dialW)
          : null,
      denominator: "DIALOGUE_RESOLVED",
    },
    barrier: {
      successPct: pct(barrierW, barriers),
      failurePct: pct(barrierL, barriers),
      averageThreshold: barriers ? rows.reduce((a, r) => a + r.barrierThresholdSum, 0) / barriers : null,
      averageCommitment: barriers ? rows.reduce((a, r) => a + r.barrierTotalSum, 0) / barriers : null,
      denominator: "BARRIER_RESOLVED",
    },
    elemental: {
      opportunities: opps,
      usedPct: pct(used, opps),
      skippedPct: pct(skipped, opps),
      byElement: {
        air: rows.reduce((a, r) => a + r.elementalAir, 0),
        fire: rows.reduce((a, r) => a + r.elementalFire, 0),
        water: rows.reduce((a, r) => a + r.elementalWater, 0),
        earth: rows.reduce((a, r) => a + r.elementalEarth, 0),
      },
      averageUsesPerGame: n ? used / n : null,
      denominator: "MANIP_USED + MANIP_SKIPPED",
    },
    lineage: {
      gamesWithClaimPct: pct(rows.filter((r) => r.lineageClaims > 0).length, n),
      gamesWithEvolutionPct: pct(rows.filter((r) => r.lineageEvolutions > 0).length, n),
      averageFinalRank: avgWhen(rows, (r) => r.finalLineageRankMax),
      averageFirstClaimTurn: avgWhen(rows, (r) => r.firstLineageTurn),
      finalRankDistribution: rankDist,
    },
    majors: {
      averageSeen: n ? rows.reduce((a, r) => a + r.majorsSeen, 0) / n : null,
      divertedToPd: rows.reduce((a, r) => a + r.majorsDiverted, 0),
      resurfaced: rows.reduce((a, r) => a + r.majorsResurfaced, 0),
      reachedAltar: rows.reduce((a, r) => a + r.majorsReachedAltar, 0),
    },
    eclipseNexus: {
      gamesWithEclipsePct: pct(rows.filter((r) => r.eclipseCount > 0).length, n),
      averageEclipseCount: n ? rows.reduce((a, r) => a + r.eclipseCount, 0) / n : null,
      gamesWithNexusPct: pct(rows.filter((r) => r.nexusCount > 0).length, n),
      averageFirstEclipseTurn: avgWhen(rows, (r) => r.firstEclipseTurn),
      averageFirstNexusTurn: avgWhen(rows, (r) => r.firstNexusTurn),
    },
    pressure: {
      averageHpLost: n ? rows.reduce((a, r) => a + r.hpLost, 0) / n : null,
      deaths: rows.reduce((a, r) => a + r.deaths, 0),
      revivals: null,
      revivalNote: "L0 has no revival verb; always null",
      averageHandSize: n ? rows.reduce((a, r) => a + r.avgHandSize, 0) / n : null,
      maxHandSize: rows.reduce((a, r) => Math.max(a, r.maxHandSize), 0),
      handLimitHits: rows.reduce((a, r) => a + r.handLimitHits, 0),
    },
    rewards: {
      handPct: pct(rows.reduce((a, r) => a + r.rewardsToHand, 0), rewards),
      altarPct: pct(rows.reduce((a, r) => a + r.rewardsToAltar, 0), rewards),
      lineagePct: pct(rows.reduce((a, r) => a + r.rewardsToLineage, 0), rewards),
      veilPct: pct(rows.reduce((a, r) => a + r.rewardsToVeil, 0), rewards),
      denominator: "REWARD_TAKEN dest hand|altar|lineage|veil",
    },
    engineHealth: {
      gamesWithInvariantFailures: rows.filter((r) => r.invariantFailures > 0).length,
      invariantCodeCounts: codeCount,
      invalidLineage: codeCount.INVALID_LINEAGE ?? 0,
      missingCatalog: codeCount.CARD_MISSING_FROM_CATALOG ?? 0,
      zoneDuplication: codeCount.ZONE_DUPLICATION ?? 0,
      majorInHand: codeCount.MAJOR_IN_HAND ?? 0,
      codeBreakdown: inv,
    },
  };
}

export function printSummary(summary: Record<string, unknown>): string {
  return JSON.stringify(summary, null, 2);
}
