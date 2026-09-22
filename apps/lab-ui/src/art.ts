import type { CardDef, CardInstance } from "@nexus/game-core";
import { proxyCatalog } from "@nexus/game-core";

const catalog = proxyCatalog();

/** Rank glyph for frame corners. */
export function rankGlyph(def: CardDef | undefined): string {
  if (!def) return "";
  if (def.arcana === "major" && !def.tags.includes("court")) return String(def.rank);
  if (def.rank === 1) return "A";
  if (def.rank === 11) return "J";
  if (def.rank === 12) return "Q";
  if (def.rank === 13) return "K";
  if (def.rank === 0) return "0";
  return String(def.rank);
}

/**
 * Convention paths under /graphics (served by Vite from repo graphics/).
 * Minors: sunlight/roses/1-roses.png · moonlight/air/3-air.png
 * Courts: sunlight/roses/J-roses.png
 * Majors: majors/SUN-MAJ-02.png
 * Characters also: characters/SUN-MAJ-01.png
 */
export function artCandidates(cardId: string): string[] {
  if (!cardId || cardId.startsWith("?")) return [];
  const def = catalog.get(cardId);
  if (!def) return [`/graphics/cards/${cardId}.png`, `/graphics/cards/${cardId}.jpg`];

  const out: string[] = [];
  if (def.tags.includes("character") || def.tags.includes("nexus")) {
    out.push(`/graphics/characters/${def.id}.png`, `/graphics/characters/${def.id}.jpg`);
  }
  if (def.arcana === "major" && !def.tags.includes("court")) {
    out.push(`/graphics/cards/majors/${def.id}.png`, `/graphics/cards/majors/${def.id}.jpg`);
  }
  if (def.tags.includes("court") || def.arcana === "minor") {
    const line = def.lineageId ?? "unknown";
    const deck = def.deck === "moonlight" ? "moonlight" : "sunlight";
    const rank =
      def.rank === 11 ? "J" : def.rank === 12 ? "Q" : def.rank === 13 ? "K" : String(def.rank);
    out.push(
      `/graphics/cards/${deck}/${line}/${rank}-${line}.png`,
      `/graphics/cards/${deck}/${line}/${rank}-${line}.jpg`,
      `/graphics/cards/${deck}/${line}/${def.rank}-${line}.png`,
      `/graphics/cards/${deck}/${line}/${def.rank}-${line}.jpg`,
    );
  }
  out.push(`/graphics/cards/${def.id}.png`, `/graphics/cards/${def.id}.jpg`);
  return out;
}

export function artUrlFor(card: CardInstance | undefined): string | null {
  if (!card) return null;
  const list = artCandidates(card.cardId);
  return list[0] ?? null;
}

export function characterBannerUrl(): string {
  return "/graphics/characters/four-aspects.jpg";
}

export function defOfId(cardId: string): CardDef | undefined {
  return catalog.get(cardId);
}
