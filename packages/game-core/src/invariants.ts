import { defOf } from "./cards.js";
import { listOccupancy } from "./zones.js";
import type { EngineCtx, GameState } from "./types.js";

export interface InvariantWarning {
  code: string;
  detail: string;
}

export function evaluateInvariants(state: GameState, ctx: EngineCtx): InvariantWarning[] {
  const warnings: InvariantWarning[] = [];
  const seen = new Set<string>();
  for (const row of listOccupancy(state)) {
    if (seen.has(row.instanceId)) {
      warnings.push({
        code: "ZONE_DUPLICATION",
        detail: `${row.instanceId} (${row.cardId}) appears in more than one zone`,
      });
    }
    seen.add(row.instanceId);
    if (!ctx.catalog.get(row.cardId)) {
      warnings.push({
        code: "CARD_MISSING_FROM_CATALOG",
        detail: `${row.cardId} in ${row.zone}`,
      });
    }
  }

  const limit = ctx.ruleset.experimental.handLimit;
  const step = ctx.ruleset.experimental.evolutionStep;
  for (const p of state.players) {
    if (p.hand.length > limit) {
      warnings.push({
        code: "HAND_OVER_LIMIT",
        detail: `${p.id} hand ${p.hand.length}/${limit}`,
      });
    }
    for (const c of p.hand) {
      const def = ctx.catalog.get(c.cardId);
      if (def?.arcana === "major" && !def.tags.includes("joker")) {
        warnings.push({
          code: "MAJOR_IN_HAND",
          detail: `${p.id} holds ${c.cardId}`,
        });
      }
    }
    if (p.lineage.length) {
      const first = ctx.catalog.get(p.lineage[0]!.cardId);
      const firstIsCharacter = first?.tags.includes("character");
      if (first && first.rank !== 1 && !firstIsCharacter) {
        warnings.push({
          code: "INVALID_LINEAGE",
          detail: `${p.id} lineage does not start on Ace (rank ${first.rank})`,
        });
      }
    }
    const lineageIds = new Set<string>();
    p.lineage.forEach((c, i) => {
      const def = ctx.catalog.get(c.cardId);
      if (!def) return;
      if (def.arcana === "major") {
        if (!def.tags.includes("character") || i !== p.lineage.length - 1 || !p.eclipse) {
          warnings.push({
            code: "INVALID_LINEAGE",
            detail: `${p.id} lineage contains major ${c.cardId}`,
          });
        }
        return;
      }
      if (def.lineageId) lineageIds.add(def.lineageId);
      if (i > 0) {
        const prev = ctx.catalog.get(p.lineage[i - 1]!.cardId);
        if (prev && def.rank !== prev.rank + step) {
          warnings.push({
            code: "INVALID_LINEAGE",
            detail: `${p.id} rank ${prev.rank} → ${def.rank} (step ${step})`,
          });
        }
        if (
          !ctx.ruleset.experimental.evolveByColor &&
          prev?.lineageId &&
          def.lineageId &&
          prev.lineageId !== def.lineageId
        ) {
          warnings.push({
            code: "INVALID_LINEAGE",
            detail: `${p.id} mixed lineages ${prev.lineageId}/${def.lineageId}`,
          });
        }
      }
    });
    if (!ctx.ruleset.experimental.evolveByColor && lineageIds.size > 1) {
      warnings.push({
        code: "INVALID_LINEAGE",
        detail: `${p.id} mixed lineage ids ${[...lineageIds].join(",")}`,
      });
    }
  }

  for (const c of [...state.roundTable.left, ...state.roundTable.middle, ...state.roundTable.pd]) {
    try {
      defOf(ctx.catalog, c);
    } catch {
      warnings.push({ code: "CARD_MISSING_FROM_CATALOG", detail: c.cardId });
    }
  }

  return warnings;
}
