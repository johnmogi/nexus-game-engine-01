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
export type DialPhase = "day" | "night" | "none";
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
  name?: string;
  blurb?: string;
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
  /** Claimed character after Eclipse. Impacts not applied yet. */
  aspect: string | null;
}

export interface ExperimentalRules {
  startingHandSize: number;
  handLimit: number;
  /** World/table cycles. Each round is 3 table advances. */
  rounds: number;
  /** Derived: rounds * 3. Do not edit independently in Admin. */
  maxTurns: number;
  dealMajors: boolean;
  /** L0 Jack/Queen/King. Separate from the 20 Major Arcana (`dealMajors`). */
  dealCourts: boolean;
  barrierDamage: number;
  barrierThreshold: number;
  treasureDraw: number;
  dialogueThreshold: number;
  dialogueParticipants: DialogueParticipants;
  evolutionStep: number;
  /**
   * Secondary elemental / color jump on lineage.
   * L0: false — Ace stays on its own lineage (roses→roses).
   * L1: true — next form may be any color at rank+step (roses Ace may take vines 3).
   */
  evolveByColor: boolean;
  /** Pull one Ace per player from the deck into lineage during SETUP. Not a choice. */
  dealStartingAce: boolean;
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
  enableDayDial: boolean;
  /** Empty = all catalog lineages. L0 uses four Sun lines for a soft entry. */
  playableLineageIds: string[];
  enableCharacterEvolution: boolean;
  /** After conveyor / spends, slide cards left and draw so PD/MIDDLE/LEFT stay occupied. */
  keepRoundTableFilled: boolean;
  /** Matching royals on the table: Sun/Moon pair, or courts of opposite pip ink (red+black). */
  eclipseOnTable: boolean;
  /** Altar Eclipse: same-face red+black courts (L0), or Sun↔Moon titled Major pair (L1). */
  eclipseOnAltar: boolean;
  /**
   * Barrier/Dialogue commit exchanges before resolve. 1 = pamphlet one-shot.
   * 2 = play both rounds then compare (stalemate = defender holds / fail).
   */
  eventCombatRounds: 1 | 2;
  /** L2 slot: roll elemental dice during events. Off until pamphlet locks it. */
  enableElementalDice: boolean;
  /**
   * L2 slot: which element beats which (RPS). Empty/undefined = no advantage.
   * Example later: { air: "fire", fire: "earth", earth: "water", water: "air" }.
   */
  elementCycle: Partial<Record<Element, Element>> | null;
  /**
   * Tutorial / soft mode: damage cannot reduce a player below 1 HP.
   * L0 default on — first-session should not teach via death.
   */
  preventDeath: boolean;
  /**
   * Water manip may revive a downed ally (health ≤ 0) before falling back to Veil→LEFT.
   * L1 on; L0 off until pamphlet locks healing/revive verbs.
   */
  enableRevival: boolean;
  /** HP granted on Water revive. 1 = crawl back; startingHealth = full stand-up. */
  revivalHealth: number;
}

export interface GameFlags {
  manipUsedThisTurn: boolean;
  nexus: boolean;
  lastEvent: EventKind | null;
  lastEventRoll: number | null;
  commits: Record<string, string | "pass">;
  /** 1-based combat exchange during Barrier/Dialogue. */
  combatRound: number;
  /** Accumulated commit force across combat rounds. */
  combatBowl: number;
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
  dial: DialPhase;
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
  /** Rank-0 Sun/Moon Nexus — never shuffled into the draw deck. */
  hold: {
    nexus: CardInstance[];
    characters: CardInstance[];
  };
  players: PlayerState[];
  log: GameEvent[];
}

export type Action =
  | { type: "ADVANCE"; playerId: string }
  | { type: "SKIP_MANIP"; playerId: string }
  /** Earth: `order` lists source seats; cards land on movable seats LEFT→MIDDLE→PD. PD with a Major is locked out. */
  | {
      type: "MANIP";
      playerId: string;
      element: Extract<Element, "air" | "fire" | "water" | "earth">;
      order?: TableSlot[];
    }
  | { type: "TAKE_REWARD"; playerId: string; dest: "hand" | "altar" | "lineage" }
  | { type: "COMMIT"; playerId: string; cardId: string | "pass" }
  | { type: "CHOOSE_CHARACTER"; playerId: string; cardId: string };

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
