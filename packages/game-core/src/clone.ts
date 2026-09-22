import type { GameState, PlayerState } from "./types.js";

function clonePlayers(players: readonly PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    hand: p.hand.map((c) => ({ ...c })),
    lineage: p.lineage.map((c) => ({ ...c })),
    joker: { ...p.joker },
  }));
}

export function cloneState(state: GameState): GameState {
  return {
    meta: { ...state.meta },
    gameRng: { ...state.gameRng },
    flags: { ...state.flags, commits: { ...state.flags.commits } },
    drawDeck: state.drawDeck.map((c) => ({ ...c })),
    roundTable: {
      left: state.roundTable.left.map((c) => ({ ...c })),
      middle: state.roundTable.middle.map((c) => ({ ...c })),
      pd: state.roundTable.pd.map((c) => ({ ...c })),
    },
    altar: {
      minors: state.altar.minors.map((c) => ({ ...c })),
      major: state.altar.major.map((c) => ({ ...c })),
    },
    veil: state.veil.map((c) => ({ ...c })),
    hold: {
      nexus: (state.hold?.nexus ?? []).map((c) => ({ ...c })),
      characters: (state.hold?.characters ?? []).map((c) => ({ ...c })),
    },
    players: clonePlayers(state.players),
    log: state.log.slice(),
  };
}
