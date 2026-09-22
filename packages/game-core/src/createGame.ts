import { rngFromSeed, rngShuffle, contentHash } from "./rng.js";
import { assertConservation } from "./zones.js";
import { isCourtMajor } from "./catalog/courts.js";
import { isCharacterMajor, isNexusMajor, isTableMajor } from "./catalog/majors.js";
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
    if (def.tags.includes("joker")) continue;
    const rankOk = allow.has(def.rank);
    const lines = ruleset.experimental.playableLineageIds ?? [];
    const lineOk = !lines.length || !def.lineageId || lines.includes(def.lineageId);
    if (def.arcana === "minor") {
      if (!rankOk) continue;
      if (!lineOk) continue;
    } else if (isCourtMajor(def) && ruleset.experimental.dealCourts) {
      if (!lineOk) continue;
    } else if (!(def.arcana === "major" && ruleset.experimental.dealMajors && isTableMajor(def))) {
      continue;
    }
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
      aspect: null,
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
  let n = dealt.length;
  const holdNexus: CardInstance[] = [];
  const holdChars: CardInstance[] = [];
  for (const def of opts.catalog.all()) {
    if (def.arcana !== "major") continue;
    if (isNexusMajor(def)) {
      n += 1;
      holdNexus.push({ instanceId: `inst-${n}`, cardId: def.id });
    } else if (isCharacterMajor(def)) {
      n += 1;
      holdChars.push({ instanceId: `inst-${n}`, cardId: def.id });
    }
  }
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
      dial: "none",
    },
    gameRng: shuffled.rng,
    flags: {
      manipUsedThisTurn: false,
      nexus: false,
      lastEvent: null,
      lastEventRoll: null,
      commits: {},
      combatRound: 0,
      combatBowl: 0,
    },
    drawDeck: shuffled.items,
    roundTable: { left: [], middle: [], pd: [] },
    altar: { minors: [], major: [] },
    veil: [],
    hold: { nexus: holdNexus, characters: holdChars },
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
