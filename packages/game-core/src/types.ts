import type { RngState } from "./rng.js";

export type PlayerCount = 2 | 3 | 4;

export type PhaseId =
  | "SETUP"
  | "TURN_START"
  | "PD_RESURFACE"
  | "ADVANCE_ROUND_TABLE"
  | "NORMALIZE_MAJORS"
  | "CHECK_NEXUS"
  | "ELEMENTAL_MANIPULATION"
  | "ROLL_EVENT"
  | "RESOLVE_EVENT"
  | "REWARD"
  | "LINEAGE_EVOLUTION"
  | "ECLIPSE_NEXUS_CHECK"
  | "TURN_END"
  | "OVER";

export type Arcana = "minor" | "major";
export type Element = "air" | "fire" | "water" | "earth";
export type DeckId = "sunlight" | "moonlight";
export type TableSlot = "left" | "middle" | "pd";
export type EventKind = "barrier" | "dialogue" | "treasure";
export type Outcome = "playing" | "turn_limit" | "party_down" | "deck_exhausted";
export type DialogueParticipants = "active_only" | "all_living";
export type ManipulationPaymentMode = "unspecified" | "free" | "card_paid" | "lineage_powered";

export interface CardDef {
  id: string;
  rank: number;
  arcana: Arcana;
  element?: Element;
  lineageId?: string;
  deck?: DeckId;
  pairId?: string;
  tags: string[];
}

export interface CardCatalog {
  id: string;
  version: string;
  get(cardId: string): CardDef | undefined;
  all(): readonly CardDef[];
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  arrivedTurn?: number;
}

export interface PlayerState {
  id: string;
  hand: CardInstance[];
  /** Current form is the last card. Earlier forms stay locked here and never return to play. */
  lineage: CardInstance[];
  health: number;
  joker: { active: boolean };
  eclipse: boolean;
}

export interface ExperimentalRules {
  startingHandSize: number;
  handLimit: number;
  /** World/table cycles. Each round is 3 table advances. */
  rounds: number;
  /** Derived: rounds * 3. Do not edit independently in Admin. */
  maxTurns: number;
  dealMajors: boolean;
  barrierDamage: number;
  barrierThreshold: number;
  treasureDraw: number;
  dialogueThreshold: number;
  dialogueParticipants: DialogueParticipants;
  evolutionStep: number;
  autoClaimAceLineage: boolean;
  eventBarrierMax: number;
  eventDialogueMax: number;
  altarMinorCap: number;
  altarMajorCap: number;
  manipulationFree: boolean;
  eclipseBonus: number;
  tableAdvancesPerRound: number;
  enableElementalManipulation: boolean;
  enableBarrier: boolean;
  enableDialogue: boolean;
  enableTreasure: boolean;
  enableEclipse: boolean;
  enableNexus: boolean;
  enableLineage: boolean;
  enableVeilRecycle: boolean;
}

export interface GameFlags {
  manipUsedThisTurn: boolean;
  nexus: boolean;
  lastEvent: EventKind | null;
  lastEventRoll: number | null;
  commits: Record<string, string | "pass">;
}

export interface Ruleset {
  id: string;
  version: string;
  playerCountMin: 2;
  playerCountMax: 4;
  playableRanks: number[];
  startingHealth: number;
  phases: PhaseId[];
  manipulation: {
    maxPerTurn: number;
    paymentMode: ManipulationPaymentMode;
  };
  experimental: ExperimentalRules;
}

export interface GameMeta {
  rulesetId: string;
  rulesetVersion: string;
  catalogId: string;
  contentHash: string;
  seed: string;
  playerCount: PlayerCount;
  round: number;
  rounds: number;
  turn: number;
  activePlayerId: string;
  phase: PhaseId;
  clock: number;
  outcome: Outcome;
  maxTurns: number;
}

export interface GameState {
  meta: GameMeta;
  gameRng: RngState;
  flags: GameFlags;
  drawDeck: CardInstance[];
  roundTable: {
    left: CardInstance[];
    middle: CardInstance[];
    pd: CardInstance[];
  };
  altar: {
    minors: CardInstance[];
    major: CardInstance[];
  };
  veil: CardInstance[];
  players: PlayerState[];
  log: GameEvent[];
}

export type Action =
  | { type: "ADVANCE"; playerId: string }
  | { type: "SKIP_MANIP"; playerId: string }
  | { type: "MANIP"; playerId: string; element: Extract<Element, "air" | "fire" | "water" | "earth"> }
  | { type: "TAKE_REWARD"; playerId: string; dest: "hand" | "altar" | "veil" | "lineage" }
  | { type: "COMMIT"; playerId: string; cardId: string | "pass" };

export type GameEvent = {
  seq: number;
  clock: number;
  type: string;
  [key: string]: unknown;
};

export type EngineCtx = {
  ruleset: Ruleset;
  catalog: CardCatalog;
};

export type DispatchOk = { ok: true; state: GameState; events: GameEvent[] };
export type DispatchErr = { ok: false; error: { code: string; message: string } };
export type DispatchResult = DispatchOk | DispatchErr;

export type ViewMode = "admin" | "player";

export interface ProjectViewOptions {
  mode: ViewMode;
  viewerId?: string;
}
