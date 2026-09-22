import type { CardInstance, GameState, PlayerState } from "./types.js";

export type ZoneId =
  | "drawDeck"
  | "roundTable.left"
  | "roundTable.middle"
  | "roundTable.pd"
  | "altar.minors"
  | "altar.major"
  | "veil"
  | "hold.nexus"
  | "hold.characters"
  | `player.${string}.hand`
  | `player.${string}.lineage`;

export interface Occupancy {
  instanceId: string;
  cardId: string;
  zone: ZoneId;
}

function lineageAsList(player: PlayerState): CardInstance[] {
  return player.lineage;
}

export function listOccupancy(state: GameState): Occupancy[] {
  const out: Occupancy[] = [];
  const push = (zone: ZoneId, cards: readonly CardInstance[]) => {
    for (const card of cards) {
      out.push({ instanceId: card.instanceId, cardId: card.cardId, zone });
    }
  };
  push("drawDeck", state.drawDeck);
  push("roundTable.left", state.roundTable.left);
  push("roundTable.middle", state.roundTable.middle);
  push("roundTable.pd", state.roundTable.pd);
  push("altar.minors", state.altar.minors);
  push("altar.major", state.altar.major);
  push("veil", state.veil);
  push("hold.nexus", state.hold?.nexus ?? []);
  push("hold.characters", state.hold?.characters ?? []);
  for (const player of state.players) {
    push(`player.${player.id}.hand`, player.hand);
    push(`player.${player.id}.lineage`, lineageAsList(player));
  }
  return out;
}

export function assertConservation(state: GameState): void {
  const occ = listOccupancy(state);
  const seen = new Set<string>();
  for (const row of occ) {
    if (seen.has(row.instanceId)) {
      throw new Error(`conservation: instance ${row.instanceId} in multiple zones`);
    }
    seen.add(row.instanceId);
  }
}

export function instanceCount(state: GameState): number {
  return listOccupancy(state).length;
}
