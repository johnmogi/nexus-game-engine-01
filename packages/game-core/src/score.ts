import { isHiddenCardId } from "./cards.js";
import { elementAdvantage } from "./elements.js";
import { dialBonus, eclipseBonus, top } from "./ops.js";
import type { CardInstance, EngineCtx, EventKind, GameState } from "./types.js";

export function eventKindFromDie(roll: number, dialogueMax: number, barrierMax: number): EventKind {
  if (roll <= dialogueMax) return "dialogue";
  if (roll <= barrierMax) return "barrier";
  return "treasure";
}
export function bandedForce(rank: number): number {
  if (rank <= 0) return 0;
  if (rank <= 3) return 1;
  if (rank <= 6) return 3;
  return 6;
}

export function cardForce(ctx: EngineCtx, card: CardInstance | undefined): number {
  if (!card || isHiddenCardId(card.cardId)) return 0;
  const def = ctx.catalog.get(card.cardId);
  if (!def || def.arcana === "major") return 0;
  return bandedForce(def.rank);
}

export function barrierChallenge(state: GameState, ctx: EngineCtx): number {
  return cardForce(ctx, top(state.roundTable.left));
}

export function dialogueChallenge(state: GameState, ctx: EngineCtx): number {
  return cardForce(ctx, top(state.roundTable.left)) + cardForce(ctx, top(state.roundTable.middle));
}

export function commitPower(state: GameState, ctx: EngineCtx, playerId: string, cardId: string | "pass"): number {
  if (cardId === "pass") return eclipseBonus(state, playerId, 0);
  const def = ctx.catalog.get(cardId);
  const band = bandedForce(def?.rank ?? 0);
  let power = eclipseBonus(state, playerId, band + dialBonus(state, ctx, cardId));
  const cycle = ctx.ruleset.experimental.elementCycle;
  if (cycle && def?.element) {
    const obstacle =
      state.flags.lastEvent === "dialogue"
        ? (top(state.roundTable.left) ?? top(state.roundTable.middle))
        : top(state.roundTable.left);
    const obsEl = obstacle ? ctx.catalog.get(obstacle.cardId)?.element : undefined;
    power += elementAdvantage(def.element, obsEl, cycle);
  }
  return power;
}

/** Active player +1 “opportunity” on a personal Barrier, from the pamphlet. */
export function barrierOpportunity(): number {
  return 1;
}

export function eventPrompt(state: GameState, ctx: EngineCtx): {
  kind: EventKind | null;
  roll: number | null;
  challenge: number;
  opportunity: number;
  seats: string;
  combatRound: number;
  combatRounds: number;
  combatBowl: number;
} {
  const kind = state.flags.lastEvent;
  const roll = state.flags.lastEventRoll;
  const rounds = ctx.ruleset.experimental.eventCombatRounds ?? 1;
  if (kind === "barrier") {
    return {
      kind,
      roll,
      challenge: barrierChallenge(state, ctx),
      opportunity: barrierOpportunity(),
      seats: "LEFT only",
      combatRound: state.flags.combatRound || 1,
      combatRounds: rounds,
      combatBowl: state.flags.combatBowl,
    };
  }
  if (kind === "dialogue") {
    return {
      kind,
      roll,
      challenge: dialogueChallenge(state, ctx),
      opportunity: 0,
      seats: "LEFT + MIDDLE (PD sits out)",
      combatRound: state.flags.combatRound || 1,
      combatRounds: rounds,
      combatBowl: state.flags.combatBowl,
    };
  }
  if (kind === "treasure") {
    return {
      kind,
      roll,
      challenge: 0,
      opportunity: 0,
      seats: "LEFT is the gift",
      combatRound: 0,
      combatRounds: rounds,
      combatBowl: 0,
    };
  }
  return {
    kind,
    roll,
    challenge: 0,
    opportunity: 0,
    seats: "—",
    combatRound: 0,
    combatRounds: rounds,
    combatBowl: 0,
  };
}
