import type { GameEvent, L0LabDocument, Ruleset } from "@nexus/game-core";
import { runsToCsv, type RunRecord } from "./metrics.js";
import { buildSummary } from "./summary.js";

export interface BatchExportInput {
  at?: Date;
  engineVersion: string;
  catalogId: string;
  catalogVersion: string;
  contentHash: string;
  baseSeed: string;
  games: number;
  playerCount: number;
  maxTurns: number;
  ruleset: Ruleset;
  labDocument?: L0LabDocument;
  rows: RunRecord[];
  traces: Array<{ seed: string; reason: string; events: GameEvent[] }>;
}

export interface BatchExportFiles {
  dirName: string;
  files: Record<string, string>;
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function buildBatchExport(input: BatchExportInput): BatchExportFiles {
  const at = input.at ?? new Date();
  const version = input.labDocument?.version ?? input.ruleset.version;
  const dirName = `${stamp(at)}_${version}_${input.games}runs`;
  const seeds = input.rows.map((r) => r.seed);
  const manifest = {
    rulesetId: input.ruleset.id,
    rulesetVersion: input.ruleset.version,
    labDocumentVersion: input.labDocument?.version ?? null,
    engineVersion: input.engineVersion,
    catalogId: input.catalogId,
    catalogVersion: input.catalogVersion,
    contentHash: input.contentHash,
    createdAt: at.toISOString(),
    games: input.games,
    baseSeed: input.baseSeed,
    seedRange: seeds.length ? { first: seeds[0], last: seeds[seeds.length - 1], count: seeds.length } : null,
    playerCount: input.playerCount,
    maxTurns: input.maxTurns,
    rounds: input.ruleset.experimental.rounds,
    tableAdvancesPerRound: input.ruleset.experimental.tableAdvancesPerRound,
    comparisonKey: {
      contentHash: input.contentHash,
      baseSeed: input.baseSeed,
      games: input.games,
      playerCount: input.playerCount,
    },
  };
  const warnings = input.rows
    .filter((r) => r.invariantFailures > 0)
    .map((r) => ({ seed: r.seed, codes: r.invariantCodes, count: r.invariantFailures }));

  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "summary.json": JSON.stringify(buildSummary(input.rows), null, 2) + "\n",
    "runs.csv": runsToCsv(input.rows),
    "runs.ndjson": input.rows.map((r) => JSON.stringify(r)).join("\n") + (input.rows.length ? "\n" : ""),
    "events.ndjson": input.traces
      .flatMap((t) => t.events.map((e) => JSON.stringify({ seed: t.seed, reason: t.reason, ...e })))
      .join("\n") + (input.traces.length ? "\n" : ""),
    "ruleset.json": JSON.stringify(input.ruleset, null, 2) + "\n",
    "warnings.json": JSON.stringify({ count: warnings.length, runs: warnings }, null, 2) + "\n",
  };
  if (input.labDocument) {
    files["lab-document.json"] = JSON.stringify(input.labDocument, null, 2) + "\n";
  }
  return { dirName, files };
}
