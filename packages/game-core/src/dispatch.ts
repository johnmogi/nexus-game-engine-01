import { cloneState } from "./clone.js";
import { applyAction } from "./phases.js";
import { isLegal } from "./legal.js";
import { assertConservation } from "./zones.js";
import type { Action, DispatchResult, EngineCtx, GameState } from "./types.js";

export function dispatch(state: GameState, action: Action, ctx: EngineCtx): DispatchResult {
  if (state.meta.phase === "OVER") {
    return { ok: false, error: { code: "GAME_OVER", message: "match has ended" } };
  }
  if (!isLegal(state, action, ctx)) {
    return {
      ok: false,
      error: { code: "ILLEGAL_ACTION", message: `${action.type} is not legal for ${action.playerId}` },
    };
  }
  const next = cloneState(state);
  const { events } = applyAction(next, action, ctx);
  assertConservation(next);
  return { ok: true, state: next, events };
}
