import type { CardInstance, GameState, ProjectViewOptions } from "./types.js";
import { isHiddenCardId } from "./cards.js";

function maskCard(c: CardInstance): CardInstance {
  if (isHiddenCardId(c.cardId)) return c;
  const major = c.cardId.includes("-MAJ-") || /-[JQK]$/.test(c.cardId);
  return {
    instanceId: c.instanceId,
    cardId: major ? "?-major" : "?-minor",
    ...(c.arrivedTurn !== undefined ? { arrivedTurn: c.arrivedTurn } : {}),
  };
}

/**
 * God (admin) sees the live state.
 * Seat (player) sees own hand; other hands, draw, veil, and the round table are backs.
 * Backs keep major vs minor so the pile can be read without naming the card.
 */
export function projectView(state: GameState, opts: ProjectViewOptions): GameState {
  if (opts.mode === "admin") return state;
  const viewerId = opts.viewerId;
  if (!viewerId) throw new Error("player view requires viewerId");
  const waiting = Object.keys(state.flags.commits).length > 0 && state.meta.phase === "RESOLVE_EVENT";
  let commits = state.flags.commits;
  if (waiting) {
    commits = {};
    for (const [id, val] of Object.entries(state.flags.commits)) {
      commits[id] = id === viewerId ? val : "pass";
    }
  }
  return {
    ...state,
    flags: waiting ? { ...state.flags, commits } : state.flags,
    drawDeck: state.drawDeck.map(maskCard),
    veil: state.veil.map(maskCard),
    roundTable: {
      left: state.roundTable.left.map(maskCard),
      middle: state.roundTable.middle.map(maskCard),
      pd: state.roundTable.pd.map(maskCard),
    },
    players: state.players.map((p) => (p.id === viewerId ? p : { ...p, hand: p.hand.map(maskCard) })),
  };
}
