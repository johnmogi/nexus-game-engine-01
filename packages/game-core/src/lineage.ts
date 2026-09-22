import { defOf } from "./cards.js";
import type { CardInstance, EngineCtx, PlayerState } from "./types.js";

/** Ace first. Then rank + evolutionStep. Same lineage unless evolveByColor (any suit/color). Majors never. */
export function canPlaceOnLineage(ctx: EngineCtx, player: PlayerState, card: CardInstance): boolean {
  const def = ctx.catalog.get(card.cardId);
  if (!def || def.arcana === "major") return false;
  const step = ctx.ruleset.experimental.evolutionStep;
  const cur = player.lineage.at(-1);
  if (!cur) return def.rank === 1;
  const prev = defOf(ctx.catalog, cur);
  if (prev.arcana === "major") return false;
  if (def.rank !== prev.rank + step) return false;
  if (ctx.ruleset.experimental.evolveByColor) return true;
  return !!prev.lineageId && prev.lineageId === def.lineageId;
}

/** Move every legal next form from hand onto lineage (Ace→3→5 in one pass). Same line first, then any color. */
export function autoEvolveFromHand(ctx: EngineCtx, player: PlayerState): CardInstance[] {
  if (ctx.ruleset.experimental.enableLineage === false) return [];
  const placed: CardInstance[] = [];
  for (let n = 0; n < 9; n++) {
    const cur = player.lineage.at(-1);
    const curLine = cur ? defOf(ctx.catalog, cur).lineageId : undefined;
    const iSame = player.hand.findIndex((c) => {
      if (!canPlaceOnLineage(ctx, player, c)) return false;
      return curLine ? ctx.catalog.get(c.cardId)?.lineageId === curLine : true;
    });
    const i = iSame >= 0 ? iSame : player.hand.findIndex((c) => canPlaceOnLineage(ctx, player, c));
    if (i < 0) break;
    const card = player.hand.splice(i, 1)[0];
    if (!card) break;
    player.lineage.push(card);
    placed.push(card);
  }
  return placed;
}

export function nextLineageNeed(
  ctx: EngineCtx,
  player: PlayerState,
): { rank: number; inHand: boolean } | null {
  if (ctx.ruleset.experimental.enableLineage === false) return null;
  const cur = player.lineage.at(-1);
  const rank = cur ? defOf(ctx.catalog, cur).rank + ctx.ruleset.experimental.evolutionStep : 1;
  if (rank > 9) return null;
  const inHand = player.hand.some((c) => canPlaceOnLineage(ctx, player, c));
  return { rank, inHand };
}
