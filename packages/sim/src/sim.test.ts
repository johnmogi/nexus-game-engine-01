import { describe, expect, it } from "vitest";
import { compileLabDocument, createGame, l0Ruleset, parseLabDocument, proxyCatalog } from "@nexus/game-core";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { batch, formatRunSeed, playGame } from "./run.js";
import { buildBatchExport } from "./export.js";
import { buildSummary } from "./summary.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const doc = parseLabDocument(JSON.parse(readFileSync(resolve(repo, "config/l0.rules.json"), "utf8")));

describe("sim", () => {
  it("finishes one adventure", () => {
    const { state } = playGame({ seed: "cli-one", playerCount: 2 });
    expect(state.meta.outcome).not.toBe("playing");
  });

  it("10/50/100 produce correct run counts and every row has a seed", () => {
    for (const n of [10, 50, 100] as const) {
      const { rows } = batch({ seed: `count-${n}`, playerCount: 2, games: n });
      expect(rows).toHaveLength(n);
      expect(rows.every((r) => r.seed && r.outcome !== "playing")).toBe(true);
      expect(rows[0]?.seed).toBe(formatRunSeed(`count-${n}`, 1));
      expect(rows[n - 1]?.seed).toBe(formatRunSeed(`count-${n}`, n));
    }
  });

  it("same Ruleset + seed list gives the same batch", () => {
    const ruleset = compileLabDocument(doc).ruleset;
    const a = batch({ seed: "same-batch", playerCount: 2, games: 3, ruleset });
    const b = batch({ seed: "same-batch", playerCount: 2, games: 3, ruleset });
    expect(a.rows.map((r) => r.seed)).toEqual(b.rows.map((r) => r.seed));
    expect(a.rows.map((r) => r.outcome)).toEqual(b.rows.map((r) => r.outcome));
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("export snapshot matches the Ruleset used and does not mutate play state", () => {
    const ruleset = l0Ruleset();
    const catalog = proxyCatalog();
    const before = createGame({ seed: "export-immut", playerCount: 2, ruleset, catalog });
    const snap = JSON.stringify(before);
    const { rows, ruleset: used, exportFiles, contentHash } = batch({
      seed: "export-immut",
      playerCount: 2,
      games: 2,
      ruleset,
    });
    expect(JSON.stringify(before)).toBe(snap);
    expect(JSON.parse(exportFiles.files["ruleset.json"] ?? "{}").experimental.maxTurns).toBe(
      used.experimental.maxTurns,
    );
    expect(JSON.parse(exportFiles.files["manifest.json"] ?? "{}").contentHash).toBe(contentHash);
    expect(JSON.parse(exportFiles.files["manifest.json"] ?? "{}").games).toBe(2);
    expect(rows).toHaveLength(2);
  });

  it("percentages use EVENT_ROLLED denominators and invariants appear in summary", () => {
    const { rows } = batch({ seed: "pct", playerCount: 2, games: 5 });
    const summary = buildSummary(rows) as {
      events: { barrier: { count: number; pct: number | null }; denominator: string };
      engineHealth: { invalidLineage: number; gamesWithInvariantFailures: number };
    };
    const eventSum = rows.reduce((a, r) => a + r.eventBarrier + r.eventDialogue + r.eventTreasure, 0);
    if (eventSum) {
      expect(summary.events.barrier.pct).toBeCloseTo((rows.reduce((a, r) => a + r.eventBarrier, 0) / eventSum) * 100);
    }
    expect(summary.events.denominator).toMatch(/EVENT_ROLLED/);
    expect(summary.engineHealth.gamesWithInvariantFailures).toBe(
      rows.filter((r) => r.invariantFailures > 0).length,
    );
  });

  it("buildBatchExport traces only first unless configured", () => {
    const full = batch({
      seed: "trc",
      playerCount: 2,
      games: 3,
      simulation: { exportFullTrace: false, exportWarningTraces: true },
    });
    expect(full.traces.some((t) => t.reason === "first")).toBe(true);
    const built = buildBatchExport({
      at: new Date("2026-09-21T14:15:00Z"),
      engineVersion: "test",
      catalogId: "c",
      catalogVersion: "0",
      contentHash: "h",
      baseSeed: "trc",
      games: 3,
      playerCount: 2,
      maxTurns: 9,
      ruleset: l0Ruleset(),
      rows: full.rows,
      traces: full.traces,
    });
    expect(built.dirName).toContain("3runs");
    expect(built.files["runs.csv"]).toContain("seed,");
  });
});
