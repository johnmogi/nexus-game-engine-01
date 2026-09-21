import type { GameState, ProjectViewOptions } from "./types.js";

function cloneForView(state: GameState): GameState {
  return structuredClone(state);
}

/**
 * Admin sees full state. Player view hides other hands.
 * Hidden-info policy can later move onto the ruleset; the seam exists now.
 */
export function projectView(state: GameState, opts: ProjectViewOptions): GameState {
  const view = cloneForView(state);
  if (opts.mode === "admin") {
    return view;
  }
  const viewerId = opts.viewerId;
  if (!viewerId) {
    throw new Error("player view requires viewerId");
  }
  view.players = view.players.map((p) =>
    p.id === viewerId ? p : { ...p, hand: p.hand.map((c) => ({ instanceId: c.instanceId, cardId: "?" })) },
  );
  const waiting = Object.keys(view.flags.commits).length > 0 && view.meta.phase === "RESOLVE_EVENT";
  if (waiting) {
    const hidden: Record<string, string | "pass"> = {};
    for (const [id, val] of Object.entries(view.flags.commits)) {
      hidden[id] = id === viewerId ? val : "pass";
    }
    view.flags.commits = hidden;
  }
  return view;
}
