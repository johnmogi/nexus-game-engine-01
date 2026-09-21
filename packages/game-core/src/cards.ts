import type { CardCatalog, CardDef, CardInstance } from "./types.js";

export function defOf(catalog: CardCatalog, card: CardInstance): CardDef {
  const def = catalog.get(card.cardId);
  if (!def) {
    throw new Error(`unknown card ${card.cardId}`);
  }
  return def;
}

export function labelCard(catalog: CardCatalog, card: CardInstance | undefined): string {
  if (!card) return "—";
  const d = catalog.get(card.cardId);
  if (!d) return card.cardId;
  const rank = d.rank === 0 ? "0" : d.rank === 1 ? "A" : String(d.rank);
  const el = d.element ?? d.arcana;
  return `${rank} ${d.lineageId ?? d.id} (${el})`;
}
