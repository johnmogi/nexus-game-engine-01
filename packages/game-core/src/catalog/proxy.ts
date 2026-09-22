import type { CardCatalog, CardDef, DeckId, Element } from "../types.js";
import { courtDefs } from "./courts.js";
import { jokerDef } from "./joker.js";
import { majorDefs } from "./majors.js";
import { MINOR_NAMES } from "./minorNames.js";

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const LINEAGES: { lineageId: string; element: Element; sun: string; moon: string }[] = [
  { lineageId: "roses", element: "air", sun: "roses", moon: "air" },
  { lineageId: "vines", element: "fire", sun: "vines", moon: "fire" },
  { lineageId: "vessels", element: "water", sun: "vessels", moon: "water" },
  { lineageId: "crystals", element: "earth", sun: "crystals", moon: "earth" },
];

function pairId(deck: DeckId, lineage: string, rank: number): string {
  if (deck === "sunlight") {
    const moonName = LINEAGES.find((l) => l.sun === lineage)?.moon ?? lineage;
    return `MOON-${moonName.toUpperCase()}-${rank}`;
  }
  const sunName = LINEAGES.find((l) => l.moon === lineage)?.sun ?? lineage;
  return `SUN-${sunName.toUpperCase()}-${rank}`;
}

function minors(): CardDef[] {
  const cards: CardDef[] = [];
  for (const row of LINEAGES) {
    for (const rank of RANKS) {
      const sunId = `SUN-${row.sun.toUpperCase()}-${rank}`;
      const moonId = `MOON-${row.moon.toUpperCase()}-${rank}`;
      cards.push({
        id: sunId,
        rank,
        arcana: "minor",
        element: row.element,
        lineageId: row.sun,
        deck: "sunlight",
        pairId: pairId("sunlight", row.sun, rank),
        ...(MINOR_NAMES[sunId] !== undefined ? { name: MINOR_NAMES[sunId] } : {}),
        tags: ["proxy", row.sun],
      });
      cards.push({
        id: moonId,
        rank,
        arcana: "minor",
        element: row.element,
        lineageId: row.moon,
        deck: "moonlight",
        pairId: pairId("moonlight", row.moon, rank),
        ...(MINOR_NAMES[moonId] !== undefined ? { name: MINOR_NAMES[moonId] } : {}),
        tags: ["proxy", row.moon],
      });
    }
  }
  return cards;
}

/** Runtime catalog. 20 Majors live here; 92-master is lore, not this object. */
export function proxyCatalog(): CardCatalog {
  const defs = [...minors(), ...courtDefs(), ...majorDefs(), jokerDef()];
  const byId = new Map(defs.map((c) => [c.id, c]));
  return {
    id: "proxy-eight-lineages",
    version: "0.3.0",
    get(cardId: string) {
      return byId.get(cardId);
    },
    all() {
      return defs;
    },
  };
}
