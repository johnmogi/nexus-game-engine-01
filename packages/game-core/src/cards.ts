import type { CardCatalog, CardDef, CardInstance } from "./types.js";

export function isHiddenCardId(cardId: string): boolean {
  return cardId === "?" || cardId.startsWith("?-");
}

export function hiddenArcana(cardId: string): "major" | "minor" | null {
  if (cardId === "?-major") return "major";
  if (cardId === "?-minor" || cardId === "?") return "minor";
  return null;
}

export function cardArcana(catalog: CardCatalog, card: CardInstance): "major" | "minor" {
  const hidden = hiddenArcana(card.cardId);
  if (hidden) return hidden;
  return catalog.get(card.cardId)?.arcana === "major" ? "major" : "minor";
}

/** Pip ink: water/earth red, air/fire black. Titled Majors stay gold. */
export function cardInk(catalog: CardCatalog, card: CardInstance | undefined): "red" | "black" | "gold" | null {
  if (!card) return null;
  const hidden = hiddenArcana(card.cardId);
  if (hidden === "major") return "gold";
  if (hidden === "minor") return null;
  const d = catalog.get(card.cardId);
  if (!d) return null;
  if (d.arcana === "major" && !d.tags.includes("court")) return "gold";
  if (d.element === "water" || d.element === "earth") return "red";
  if (d.element === "air" || d.element === "fire") return "black";
  return d.arcana === "major" ? "gold" : "black";
}

export function defOf(catalog: CardCatalog, card: CardInstance): CardDef {
  const def = catalog.get(card.cardId);
  if (!def) {
    throw new Error(`unknown card ${card.cardId}`);
  }
  return def;
}

export function labelCard(catalog: CardCatalog, card: CardInstance | undefined): string {
  if (!card) return "—";
  if (isHiddenCardId(card.cardId)) return "back";
  const d = catalog.get(card.cardId);
  if (!d) return card.cardId;
  if (d.name && d.arcana === "major") return d.name;
  const rank = d.rank === 0 ? "0" : d.rank === 1 ? "A" : String(d.rank);
  const line = d.lineageId ?? d.id;
  // Deck + lineage only. Do not append (element): on Sun cards element names
  // (air/fire/…) match Moon lineage ids and read as a fake "secondary alignment".
  if (d.deck === "sunlight") return `Sun ${rank} ${line}`;
  if (d.deck === "moonlight") return `Moon ${rank} ${line}`;
  return `${rank} ${line}`;
}
