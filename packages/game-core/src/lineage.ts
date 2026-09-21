import { defOf } from "./cards.js";
import type { CardInstance, EngineCtx, PlayerState } from "./types.js";

/** Ace claim, then same lineageId at current rank + evolutionStep. Majors never. */
export function canPlaceOnLineage(ctx: EngineCtx, player: PlayerState, card: CardInstance): boolean {
  const def = ctx.catalog.get(card.cardId);
  if (!def || def.arcana === "major") return false;
  const step = ctx.ruleset.experimental.evolutionStep;
  const cur = player.lineage.at(-1);
  if (!cur) return def.rank === 1;
  const prev = defOf(ctx.catalog, cur);
  if (prev.arcana === "major") return false;
  if (!prev.lineageId || !def.lineageId || prev.lineageId !== def.lineageId) return false;
  return def.rank === prev.rank + step;
}
