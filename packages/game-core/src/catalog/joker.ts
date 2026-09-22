import type { CardDef } from "../types.js";

/** Eclipse grants this token into the player's hand. Not dealt into the draw pile. */
export const JOKER_ID = "JOKER";

export function jokerDef(): CardDef {
  return {
    id: JOKER_ID,
    rank: 0,
    arcana: "major",
    tags: ["joker"],
    name: "Joker",
  };
}

export function isJoker(def: { tags: string[]; id?: string } | undefined): boolean {
  if (!def) return false;
  return def.tags.includes("joker") || def.id === JOKER_ID;
}
