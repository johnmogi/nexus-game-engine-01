import type { CardDef, DeckId } from "../types.js";

type MajorRow = {
  id: string;
  name: string;
  deck: DeckId;
  rank: number;
  pairId: string;
  tags: string[];
  blurb: string;
};

/** 20 Majors from the card DB paste. Rank 0 = Nexus hold. #1 and #3 = Eclipse characters. */
export const MAJOR_TITLES: MajorRow[] = [
  {
    id: "SUN-MAJ-00",
    name: "The Sun",
    deck: "sunlight",
    rank: 0,
    pairId: "MOON-MAJ-00",
    tags: ["nexus"],
    blurb:
      "Radiant Sunlight convergence where four resolved elemental lineages (Roses, Vines, Vessels, Crystals) radiate together into conscious integration and creative life.",
  },
  {
    id: "MOON-MAJ-00",
    name: "The Moon",
    deck: "moonlight",
    rank: 0,
    pairId: "SUN-MAJ-00",
    tags: ["nexus"],
    blurb:
      "Sacred Moonlight nexus where four ancestral elemental beginnings (Air, Fire, Water, Earth) converge and spiral into a nocturnal ceremonial threshold.",
  },
  {
    id: "SUN-MAJ-01",
    name: "The Wise",
    deck: "sunlight",
    rank: 1,
    pairId: "MOON-MAJ-01",
    tags: ["character"],
    blurb: "A youthful barefoot wanderer traversing an ancient sunlit trail with serene, ageless wisdom alongside his faithful dog.",
  },
  {
    id: "MOON-MAJ-01",
    name: "The Daydreamer",
    deck: "moonlight",
    rank: 1,
    pairId: "SUN-MAJ-01",
    tags: ["character"],
    blurb:
      "Dreamer navigating rich reverie where actual floating tarot cards become living dimensional portals into submerged Atlantis, cosmic realms, and ancient Lemuria.",
  },
  {
    id: "SUN-MAJ-02",
    name: "The Connection",
    deck: "sunlight",
    rank: 2,
    pairId: "MOON-MAJ-02",
    tags: [],
    blurb:
      "Vertical threshold mirror portal connecting two reflected realities: Merlin (or young Adam) in rainy nighttime Austin and Morgana (or Lilith) in flourishing spring Lemuria.",
  },
  {
    id: "MOON-MAJ-02",
    name: "The Reflection",
    deck: "moonlight",
    rank: 2,
    pairId: "SUN-MAJ-02",
    tags: [],
    blurb:
      "Vertical threshold mirror portal connecting two reflected realities: Merlin (or young Adam) in rainy nighttime Austin and Morgana (or Lilith) in flourishing spring Lemuria.",
  },
  {
    id: "SUN-MAJ-03",
    name: "The Lucid Dreamer",
    deck: "sunlight",
    rank: 3,
    pairId: "MOON-MAJ-03",
    tags: ["character"],
    blurb:
      "A conscious reality weaver seated in the cosmos, awakening lucid vision and spinning threads of infinite possibility into manifest form.",
  },
  {
    id: "MOON-MAJ-03",
    name: "The Sheman",
    deck: "moonlight",
    rank: 3,
    pairId: "SUN-MAJ-03",
    tags: ["character"],
    blurb:
      "Sovereign Magus initiating conscious creation through inner will, commanding all four elements with diagonal hands deliberately selecting the Earth element.",
  },
  {
    id: "SUN-MAJ-04",
    name: "The Sun Lighthouse",
    deck: "sunlight",
    rank: 4,
    pairId: "MOON-MAJ-04",
    tags: [],
    blurb:
      "A mythic civilizational beacon anchored in ancient Lemuria and Atlantis, radiating golden harmony across the primeval Babylonian-Pangea world.",
  },
  {
    id: "MOON-MAJ-04",
    name: "Split Moon Tower",
    deck: "moonlight",
    rank: 4,
    pairId: "SUN-MAJ-04",
    tags: [],
    blurb:
      "Quiet aftermath and reorganization following the lightning strike, where broken stone becomes the foundation for peaceful healing and communal repair.",
  },
  {
    id: "SUN-MAJ-05",
    name: "The Hidden Garden",
    deck: "sunlight",
    rank: 5,
    pairId: "MOON-MAJ-05",
    tags: [],
    blurb: "A sanctuary of paradise and mutual return, where a vibrant young tree bears fruits of diverse splendor amidst sacred peace.",
  },
  {
    id: "MOON-MAJ-05",
    name: "Garden Gates",
    deck: "moonlight",
    rank: 5,
    pairId: "SUN-MAJ-05",
    tags: [],
    blurb: "Threshold of fertile compost and vital rebirth where an unlatched ornate iron gate stands ready between dissolving grief and living soil.",
  },
  {
    id: "SUN-MAJ-06",
    name: "The Rising Star",
    deck: "sunlight",
    rank: 6,
    pairId: "MOON-MAJ-06",
    tags: [],
    blurb:
      "A heart-centered being ascending in gentle spiritual transcendence, whose boundless love naturally lifts him beyond material gravity.",
  },
  {
    id: "MOON-MAJ-06",
    name: "Falling Star",
    deck: "moonlight",
    rank: 6,
    pairId: "SUN-MAJ-06",
    tags: [],
    blurb:
      "Tender descent of an inverted infant as a falling shooting star, cradled safely in the vast cosmic mother's embrace, transforming failure into surrender.",
  },
  {
    id: "SUN-MAJ-07",
    name: "The Tree of Life",
    deck: "sunlight",
    rank: 7,
    pairId: "MOON-MAJ-07",
    tags: [],
    blurb:
      "A cosmic world-tree and sacred axis where a pregnant maternal deity holds a living miniature world-tree within her womb, embodying ecological fertility.",
  },
  {
    id: "MOON-MAJ-07",
    name: "Decay & Regrowth",
    deck: "moonlight",
    rank: 7,
    pairId: "SUN-MAJ-07",
    tags: [],
    blurb:
      "Transmutation of mortality where shedding old form gives rise to vibrant rebirth, with natural facial shading and graceful lunar alignment.",
  },
  {
    id: "SUN-MAJ-08",
    name: "Pangea",
    deck: "sunlight",
    rank: 8,
    pairId: "MOON-MAJ-08",
    tags: [],
    blurb: "Wholeness of the terrestrial realm where all landmasses merge into a single harmonious cradle of life.",
  },
  {
    id: "MOON-MAJ-08",
    name: "The Merkaba",
    deck: "moonlight",
    rank: 8,
    pairId: "SUN-MAJ-08",
    tags: [],
    blurb: "Active crystalline soul-vehicle in dynamic flight above sunken Lemuria, voyaging from the afterlife through transition toward rebirth.",
  },
  {
    id: "SUN-MAJ-09",
    name: "Dual Harmony Creators",
    deck: "sunlight",
    rank: 9,
    pairId: "MOON-MAJ-09",
    tags: [],
    blurb:
      "A sacred game of cosmic co-creation where balanced male and female divine creators playfully strategize and shape living reality together.",
  },
  {
    id: "MOON-MAJ-09",
    name: "The Shechina",
    deck: "moonlight",
    rank: 9,
    pairId: "SUN-MAJ-09",
    tags: [],
    blurb:
      "The divine feminine seated inside the final grain of cosmic existence at cycle's end, quietly shaping the seed particle of the next creation.",
  },
];

export const CHARACTER_IDS = ["SUN-MAJ-01", "MOON-MAJ-01", "SUN-MAJ-03", "MOON-MAJ-03"] as const;
export const NEXUS_IDS = ["SUN-MAJ-00", "MOON-MAJ-00"] as const;

export function isNexusMajor(def: CardDef): boolean {
  return def.tags.includes("nexus");
}

export function isCharacterMajor(def: CardDef): boolean {
  return def.tags.includes("character");
}

export function isTableMajor(def: CardDef): boolean {
  return (
    def.arcana === "major" &&
    !isNexusMajor(def) &&
    !isCharacterMajor(def) &&
    !def.tags.includes("court") &&
    !def.tags.includes("joker")
  );
}

export function majorDefs(): CardDef[] {
  return MAJOR_TITLES.map((row) => ({
    id: row.id,
    rank: row.rank,
    arcana: "major" as const,
    lineageId: row.deck === "sunlight" ? "sun" : "moon",
    deck: row.deck,
    pairId: row.pairId,
    name: row.name,
    blurb: row.blurb,
    tags: ["major", ...row.tags],
  }));
}
