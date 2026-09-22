import { actorId } from "./actor.js";
import { defOf } from "./cards.js";
import { canPlaceOnLineage } from "./lineage.js";
import { earthMovableSeats, livingPlayers, permutations, top } from "./ops.js";
import type { Action, EngineCtx, GameState, TableSlot } from "./types.js";

function committers(state: GameState, ctx: EngineCtx): string[] {
  if (state.meta.phase !== "RESOLVE_EVENT") return [];
  if (state.flags.lastEvent === "barrier") return [state.meta.activePlayerId];
  if (state.flags.lastEvent === "dialogue") {
    return ctx.ruleset.experimental.dialogueParticipants === "all_living"
      ? livingPlayers(state).map((p) => p.id)
      : [state.meta.activePlayerId];
  }
  return [];
}

function waitingCommits(state: GameState, ctx: EngineCtx): boolean {
  return committers(state, ctx).length > 0 && !committers(state, ctx).every((id) => id in state.flags.commits);
}

export function nextActor(state: GameState, ctx: EngineCtx): string | null {
  for (const p of state.players) {
    if (getLegalActions(state, p.id, ctx).length) return p.id;
  }
  return null;
}

export function getLegalActions(state: GameState, playerId: string, ctx: EngineCtx): Action[] {
  if (state.meta.outcome !== "playing" || state.meta.phase === "OVER") return [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.health <= 0) return [];

  if (waitingCommits(state, ctx)) {
    if (!committers(state, ctx).includes(playerId)) return [];
    if (playerId in state.flags.commits) return [];
    const acts: Action[] = [{ type: "COMMIT", playerId, cardId: "pass" }];
    for (const c of player.hand) {
      if (c.cardId === "JOKER" || ctx.catalog.get(c.cardId)?.tags.includes("joker")) continue;
      acts.push({ type: "COMMIT", playerId, cardId: c.instanceId });
    }
    return acts;
  }

  if (playerId !== actorId(state)) return [];

  if (
    ctx.ruleset.experimental.enableCharacterEvolution &&
    player.eclipse &&
    !player.aspect &&
    (state.hold?.characters?.length ?? 0)
  ) {
    return state.hold.characters.map((c) => ({
      type: "CHOOSE_CHARACTER" as const,
      playerId,
      cardId: c.cardId,
    }));
  }

  if (state.meta.phase === "ELEMENTAL_MANIPULATION") {
    const acts: Action[] = [{ type: "SKIP_MANIP", playerId }];
    const enabled = ctx.ruleset.experimental.enableElementalManipulation !== false;
    const free =
      ctx.ruleset.manipulation.paymentMode === "free" || ctx.ruleset.experimental.manipulationFree;
    if (enabled && free && !state.flags.manipUsedThisTurn) {
      if (state.roundTable.left.length) {
        acts.push({ type: "MANIP", playerId, element: "air" });
        acts.push({ type: "MANIP", playerId, element: "fire" });
      }
      // Water: Veil→LEFT, or (if enableRevival) stand up a downed ally.
      if (
        state.veil.length ||
        (ctx.ruleset.experimental.enableRevival && state.players.some((p) => p.health <= 0))
      ) {
        acts.push({ type: "MANIP", playerId, element: "water" });
      }
      // One Earth option — enumerating every reorder flooded auto-policy (~3× Earth).
      // Resolve picks a random non-identity order (or uses action.order if provided).
      const movable = earthMovableSeats(state, ctx);
      if (movable.length >= 2) {
        acts.push({ type: "MANIP", playerId, element: "earth" });
      }
    }
    return acts;
  }

  if (state.meta.phase === "REWARD") {
    if (!top(state.roundTable.left)) return [{ type: "ADVANCE", playerId }];
    const left = top(state.roundTable.left);
    const major = left ? defOf(ctx.catalog, left).arcana === "major" : false;
    if (major) {
      return [{ type: "TAKE_REWARD", playerId, dest: "altar" }];
    }
    const dests: Action[] = [
      { type: "TAKE_REWARD", playerId, dest: "hand" },
      { type: "TAKE_REWARD", playerId, dest: "altar" },
    ];
    if (left && canPlaceOnLineage(ctx, player, left)) {
      dests.push({ type: "TAKE_REWARD", playerId, dest: "lineage" });
    }
    return dests;
  }

  return [{ type: "ADVANCE", playerId }];
}

export function isLegal(state: GameState, action: Action, ctx: EngineCtx): boolean {
  const legal = getLegalActions(state, action.playerId, ctx);
  if (action.type === "MANIP" && action.element === "earth") {
    if (!legal.some((a) => a.type === "MANIP" && a.element === "earth")) return false;
    if (!action.order) return true;
    const movable = earthMovableSeats(state, ctx);
    if (action.order.length !== movable.length) return false;
    if (new Set(action.order).size !== action.order.length) return false;
    return action.order.every((s) => movable.includes(s));
  }
  return legal.some((a) => JSON.stringify(a) === JSON.stringify(action));
}
