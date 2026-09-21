import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileLabDocument,
  l0Ruleset,
  parseLabDocument,
  type ExperimentalRules,
  type PlayerCount,
} from "@nexus/game-core";
import { batch, printBatch, printTrace, writeBatchExport } from "./run.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function num(name: string, fallback: number): number {
  const v = arg(name);
  return v !== undefined ? Number(v) : fallback;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultRules = resolve(repoRoot, "config/l0.rules.json");
const rulesPath = arg("--rules", defaultRules) ?? defaultRules;

const loaded = parseLabDocument(JSON.parse(readFileSync(rulesPath, "utf8")) as unknown);
const compiled = compileLabDocument(loaded);

const games = num("--games", 1);
const players = (num("--players", compiled.playerCount) as PlayerCount) || compiled.playerCount;
const seed = arg("--seed", "nexus-test") ?? "nexus-test";
const experimental: Partial<ExperimentalRules> = {};
if (arg("--rounds")) experimental.rounds = num("--rounds", 3);
if (arg("--max-turns")) experimental.maxTurns = num("--max-turns", 9);
if (arg("--barrier-damage")) experimental.barrierDamage = num("--barrier-damage", 1);
if (arg("--hand")) experimental.startingHandSize = num("--hand", 3);
if (arg("--manip-free")) experimental.manipulationFree = arg("--manip-free") !== "false";

if (players !== 2 && players !== 3 && players !== 4) {
  console.error("players must be 2, 3, or 4");
  process.exit(1);
}

const ruleset = Object.keys(experimental).length
  ? l0Ruleset({
      ...compiled.ruleset,
      experimental: { ...compiled.ruleset.experimental, ...experimental },
    })
  : compiled.ruleset;

const doBatch = games > 1 || flag("--batch") || flag("--export");

if (flag("--trace") || (games === 1 && !doBatch)) {
  console.log(printTrace(seed, players, ruleset));
  if (!doBatch) process.exit(0);
}

if (doBatch) {
  const result = batch({
    seed,
    playerCount: players,
    games,
    ruleset,
    labDocument: compiled.document,
    simulation: compiled.simulation,
  });
  console.log(printBatch(result.rows));
  const dest = writeBatchExport(resolve(repoRoot, "exports"), result.exportFiles);
  console.log(`\nexported ${dest}`);
}
