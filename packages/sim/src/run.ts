import {
  actorId,
  createGame,
  dispatch,
  evaluateInvariants,
  formatBoard,
  formatLog,
  getLegalActions,
  l0Ruleset,
  proxyCatalog,
  rngFromSeed,
  rngNextInt,
  type Action,
  type EngineCtx,
  type ExperimentalRules,
  type GameEvent,
  type GameState,
  type L0LabDocument,
  type LabSimulationOptions,
  type PlayerCount,
  type Ruleset,
} from "@nexus/game-core";
import { formatRunSeed, recordFromState, type RunRecord } from "./metrics.js";
import { buildSummary, printSummary } from "./summary.js";
import { buildBatchExport, type BatchExportFiles } from "./export.js";

export type GameResult = RunRecord;

export const SIM_ENGINE_VERSION = "0.3.0";

export interface SimOptions {
  seed: string;
  playerCount: PlayerCount;
  games: number;
  maxSteps?: number;
  experimental?: Partial<ExperimentalRules>;
  ruleset?: Ruleset;
  labDocument?: L0LabDocument;
  simulation?: LabSimulationOptions;
}

function ctx(ruleset: Ruleset): EngineCtx {
  return { ruleset, catalog: proxyCatalog() };
}

function pick(legal: Action[], policySeed: string, step: number): Action {
  const r = rngNextInt(rngFromSeed(`${policySeed}:${step}`), legal.length);
  const a = legal[r.value];
  if (!a) throw new Error("empty legal set");
  return a;
}

function takeAction(
  state: GameState,
  engine: EngineCtx,
  seed: string,
  steps: number,
): { state: GameState; action: Action } {
  let legal = getLegalActions(state, actorId(state), engine);
  if (!legal.length) {
    const other = state.players.find((p) => getLegalActions(state, p.id, engine).length);
    if (!other) throw new Error(`no legal actions at ${state.meta.phase}`);
    legal = getLegalActions(state, other.id, engine);
  }
  const action = pick(legal, `${seed}|policy`, steps);
  const result = dispatch(state, action, engine);
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, action };
}

export function playGame(opts: {
  seed: string;
  playerCount: PlayerCount;
  ruleset?: Ruleset;
  maxSteps?: number;
}): { state: GameState; steps: number; ruleset: Ruleset } {
  const ruleset = opts.ruleset ?? l0Ruleset();
  const engine = ctx(ruleset);
  let state = createGame({
    seed: opts.seed,
    playerCount: opts.playerCount,
    ruleset,
    catalog: engine.catalog,
  });
  const max = opts.maxSteps ?? 5000;
  let steps = 0;
  for (; steps < max; steps++) {
    if (state.meta.outcome !== "playing" || state.meta.phase === "OVER") break;
    state = takeAction(state, engine, opts.seed, steps).state;
  }
  if (state.meta.outcome === "playing") {
    throw new Error(`seed ${opts.seed} hit maxSteps`);
  }
  return { state, steps, ruleset };
}

export function playGameFrames(opts: {
  seed: string;
  playerCount: PlayerCount;
  ruleset?: Ruleset;
  maxSteps?: number;
}): { frames: GameState[]; actions: Action[]; ruleset: Ruleset } {
  const ruleset = opts.ruleset ?? l0Ruleset();
  const engine = ctx(ruleset);
  let state = createGame({
    seed: opts.seed,
    playerCount: opts.playerCount,
    ruleset,
    catalog: engine.catalog,
  });
  const frames: GameState[] = [state];
  const actions: Action[] = [];
  const max = opts.maxSteps ?? 5000;
  for (let steps = 0; steps < max; steps++) {
    if (state.meta.outcome !== "playing" || state.meta.phase === "OVER") break;
    const next = takeAction(state, engine, opts.seed, steps);
    state = next.state;
    actions.push(next.action);
    frames.push(state);
  }
  if (state.meta.outcome === "playing") {
    throw new Error(`seed ${opts.seed} hit maxSteps`);
  }
  return { frames, actions, ruleset };
}

export function summarize(state: GameState, seed: string, steps: number, ruleset: Ruleset): RunRecord {
  return recordFromState(state, seed, steps, ruleset, ctx(ruleset));
}

export interface BatchResult {
  rows: RunRecord[];
  ruleset: Ruleset;
  contentHash: string;
  traces: Array<{ seed: string; reason: string; events: GameEvent[] }>;
  exportFiles: BatchExportFiles;
}

export function batch(opts: SimOptions): BatchResult {
  const ruleset =
    opts.ruleset ??
    l0Ruleset({ experimental: { ...l0Ruleset().experimental, ...opts.experimental } });
  const sim: LabSimulationOptions = opts.simulation ??
    opts.labDocument?.simulation ?? { exportFullTrace: false, exportWarningTraces: true };
  const catalog = proxyCatalog();
  const engine = ctx(ruleset);
  const rows: RunRecord[] = [];
  const traces: BatchResult["traces"] = [];
  let contentHash = "";
  for (let i = 0; i < opts.games; i++) {
    const seed = formatRunSeed(opts.seed, i + 1);
    const { state, steps } = playGame({
      seed,
      playerCount: opts.playerCount,
      ruleset,
      maxSteps: opts.maxSteps,
    });
    contentHash = state.meta.contentHash;
    const rec = recordFromState(state, seed, steps, ruleset, engine);
    rows.push(rec);
    const warn = rec.invariantFailures > 0;
    const keep =
      i === 0 || sim.exportFullTrace || (sim.exportWarningTraces && warn);
    if (keep) {
      traces.push({
        seed,
        reason: i === 0 ? "first" : warn ? "invariants" : "full",
        events: state.log,
      });
    }
  }
  const exportFiles = buildBatchExport({
    engineVersion: SIM_ENGINE_VERSION,
    catalogId: catalog.id,
    catalogVersion: catalog.version,
    contentHash,
    baseSeed: opts.seed,
    games: opts.games,
    playerCount: opts.playerCount,
    maxTurns: ruleset.experimental.maxTurns,
    ruleset: structuredClone(ruleset),
    rows,
    traces,
    ...(opts.labDocument ? { labDocument: opts.labDocument } : {}),
  });
  return { rows, ruleset, contentHash, traces, exportFiles };
}

export function printTrace(seed: string, playerCount: PlayerCount, ruleset?: Ruleset): string {
  const rs = ruleset ?? l0Ruleset();
  const { state } = playGame({ seed, playerCount, ruleset: rs });
  const warnings = evaluateInvariants(state, ctx(rs));
  return [
    formatBoard(state, proxyCatalog()),
    "",
    warnings.length ? `INVARIANTS ${warnings.map((w) => `${w.code}:${w.detail}`).join(" | ")}` : "INVARIANTS ok",
    "",
    "--- log ---",
    formatLog(state.log, 400),
  ].join("\n");
}

export function printBatch(rows: RunRecord[]): string {
  return printSummary(buildSummary(rows));
}

export { buildBatchExport, formatRunSeed, buildSummary };
