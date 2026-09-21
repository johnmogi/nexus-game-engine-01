import { rngFromSeed, rngShuffle, contentHash } from "./rng.js";
import { assertConservation } from "./zones.js";
import type {
  CardCatalog,
  CardInstance,
  GameState,
  PlayerCount,
  PlayerState,
  Ruleset,
} from "./types.js";

export interface CreateGameOptions {
  seed: string;
  playerCount: PlayerCount;
  ruleset: Ruleset;
  catalog: CardCatalog;
}

function assertPlayerCount(count: number, ruleset: Ruleset): asserts count is PlayerCount {
  if (count < ruleset.playerCountMin || count > ruleset.playerCountMax) {
    throw new Error(
      `playerCount ${count} outside ruleset range ${ruleset.playerCountMin}–${ruleset.playerCountMax}`,
    );
  }
  if (count !== 2 && count !== 3 && count !== 4) {
    throw new Error("playerCount must be 2, 3, or 4");
  }
}

function playableInstances(catalog: CardCatalog, ruleset: Ruleset): CardInstance[] {
  const allow = new Set(ruleset.playableRanks);
  const instances: CardInstance[] = [];
  let n = 0;
  for (const def of catalog.all()) {
    const rankOk = allow.has(def.rank);
    const majorOk = def.arcana === "major" && ruleset.experimental.dealMajors;
    if (!rankOk && !majorOk) continue;
    if (def.arcana === "minor" && !rankOk) continue;
    n += 1;
    instances.push({ instanceId: `inst-${n}`, cardId: def.id });
  }
  return instances;
}

function makePlayers(count: PlayerCount, health: number): PlayerState[] {
  const players: PlayerState[] = [];
  for (let i = 1; i <= count; i++) {
    players.push({
      id: `P${i}`,
      hand: [],
      lineage: [],
      health,
      joker: { active: false },
      eclipse: false,
    });
  }
  return players;
}

export function createGame(opts: CreateGameOptions): GameState {
  assertPlayerCount(opts.playerCount, opts.ruleset);
  if (opts.ruleset.phases[0] !== "SETUP") {
    throw new Error("ruleset.phases must start with SETUP");
  }

  const dealt = playableInstances(opts.catalog, opts.ruleset);
  const shuffled = rngShuffle(rngFromSeed(opts.seed), dealt);
  const hash = contentHash([
    opts.ruleset.id,
    opts.ruleset.version,
    JSON.stringify(opts.ruleset.playableRanks),
    JSON.stringify(opts.ruleset.experimental),
    opts.catalog.id,
    opts.catalog.version,
    ...opts.catalog.all().map((c) => c.id),
  ]);

  const state: GameState = {
    meta: {
      rulesetId: opts.ruleset.id,
      rulesetVersion: opts.ruleset.version,
      catalogId: opts.catalog.id,
      contentHash: hash,
      seed: opts.seed,
      playerCount: opts.playerCount,
      round: 1,
      rounds: opts.ruleset.experimental.rounds,
      turn: 0,
      activePlayerId: "P1",
      phase: "SETUP",
      clock: 0,
      outcome: "playing",
      maxTurns: opts.ruleset.experimental.maxTurns,
    },
    gameRng: shuffled.rng,
    flags: {
      manipUsedThisTurn: false,
      nexus: false,
      lastEvent: null,
      lastEventRoll: null,
      commits: {},
    },
    drawDeck: shuffled.items,
    roundTable: { left: [], middle: [], pd: [] },
    altar: { minors: [], major: [] },
    veil: [],
    players: makePlayers(opts.playerCount, opts.ruleset.startingHealth),
    log: [
      {
        seq: 1,
        clock: 0,
        type: "GAME_CREATED",
        playerCount: opts.playerCount,
        dealt: shuffled.items.length,
      },
    ],
  };
  assertConservation(state);
  return state;
}
