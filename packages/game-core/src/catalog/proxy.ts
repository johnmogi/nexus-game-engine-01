import type { CardCatalog, CardDef, DeckId, Element } from "../types.js";

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const LINEAGES: { lineageId: string; element: Element; sun: string; moon: string }[] = [
  { lineageId: "roses", element: "air", sun: "roses", moon: "air" },
  { lineageId: "vines", element: "fire", sun: "vines", moon: "fire" },
  { lineageId: "vessels", element: "water", sun: "vessels", moon: "water" },
  { lineageId: "crystals", element: "earth", sun: "crystals", moon: "earth" },
];

function pairId(deck: DeckId, lineage: string, rank: number, element: Element): string {
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
      cards.push({
        id: `SUN-${row.sun.toUpperCase()}-${rank}`,
        rank,
        arcana: "minor",
        element: row.element,
        lineageId: row.sun,
        deck: "sunlight",
        pairId: pairId("sunlight", row.sun, rank, row.element),
        tags: ["proxy", row.sun],
      });
      cards.push({
        id: `MOON-${row.moon.toUpperCase()}-${rank}`,
        rank,
        arcana: "minor",
        element: row.element,
        lineageId: row.moon,
        deck: "moonlight",
        pairId: pairId("moonlight", row.moon, rank, row.element),
        tags: ["proxy", row.moon],
      });
    }
  }
  return cards;
}

function majors(): CardDef[] {
  return [
    {
      id: "SUN-MAJ-00",
      rank: 0,
      arcana: "major",
      lineageId: "sun",
      deck: "sunlight",
      pairId: "MOON-MAJ-00",
      tags: ["proxy", "major"],
    },
    {
      id: "MOON-MAJ-00",
      rank: 0,
      arcana: "major",
      lineageId: "moon",
      deck: "moonlight",
      pairId: "SUN-MAJ-00",
      tags: ["proxy", "major"],
    },
  ];
}

/** Test/runtime catalog. Not NEXUS_92_MASTER. Ranks 7–9 exist; L0 does not deal them. */
export function proxyCatalog(): CardCatalog {
  const defs = [...minors(), ...majors()];
  const byId = new Map(defs.map((c) => [c.id, c]));
  return {
    id: "proxy-eight-lineages",
    version: "0.2.0",
    get(cardId: string) {
      return byId.get(cardId);
    },
    all() {
      return defs;
    },
  };
}
