import type { GameState } from "./types.js";
import { livingPlayers } from "./ops.js";

export function actorId(state: GameState): string {
  if (state.meta.phase === "SETUP") {
    const first = state.players[0];
    if (!first) throw new Error("no players");
    return first.id;
  }
  const active = state.players.find((p) => p.id === state.meta.activePlayerId);
  if (active && active.health > 0) return active.id;
  const living = livingPlayers(state)[0];
  return living?.id ?? state.meta.activePlayerId;
}
