import type { CardDef, Element } from "../types.js";

const COURTS = [
  { key: "J", rank: 11, name: "Jack" },
  { key: "Q", rank: 12, name: "Queen" },
  { key: "K", rank: 13, name: "King" },
] as const;

const LINEAGES: { lineageId: string; element: Element; sun: string; moon: string }[] = [
  { lineageId: "roses", element: "air", sun: "roses", moon: "air" },
  { lineageId: "vines", element: "fire", sun: "vines", moon: "fire" },
  { lineageId: "vessels", element: "water", sun: "vessels", moon: "water" },
  { lineageId: "crystals", element: "earth", sun: "crystals", moon: "earth" },
];

function title(face: string, lineage: string): string {
  return `${face} of ${lineage[0]!.toUpperCase()}${lineage.slice(1)}`;
}

/** L0 face cards. Not the 20 Major Arcana. They ride the PD → Altar track so Eclipse can fire. */
export function courtDefs(): CardDef[] {
  const cards: CardDef[] = [];
  for (const row of LINEAGES) {
    for (const court of COURTS) {
      const sunId = `SUN-${row.sun.toUpperCase()}-${court.key}`;
      const moonId = `MOON-${row.moon.toUpperCase()}-${court.key}`;
      cards.push({
        id: sunId,
        rank: court.rank,
        arcana: "major",
        element: row.element,
        lineageId: row.sun,
        deck: "sunlight",
        pairId: moonId,
        name: title(court.name, row.sun),
        tags: ["major", "court"],
      });
      cards.push({
        id: moonId,
        rank: court.rank,
        arcana: "major",
        element: row.element,
        lineageId: row.moon,
        deck: "moonlight",
        pairId: sunId,
        name: title(court.name, row.moon),
        tags: ["major", "court"],
      });
    }
  }
  return cards;
}

export function isCourtMajor(def: { tags: string[]; arcana?: string }): boolean {
  return def.tags.includes("court");
}
