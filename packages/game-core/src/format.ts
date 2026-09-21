import { labelCard } from "./cards.js";
import { top } from "./ops.js";
import type { CardCatalog, GameEvent, GameState } from "./types.js";

export function formatBoard(state: GameState, catalog: CardCatalog): string {
  const L = labelCard(catalog, top(state.roundTable.left));
  const M = labelCard(catalog, top(state.roundTable.middle));
  const P = labelCard(catalog, top(state.roundTable.pd));
  const lines = [
    `NEXUS L0  seed=${state.meta.seed}  hash=${state.meta.contentHash}`,
    `players=${state.meta.playerCount}  round=${state.meta.round}/${state.meta.rounds}  turn=${state.meta.turn}/${state.meta.maxTurns}  active=${state.meta.activePlayerId}  phase=${state.meta.phase}  outcome=${state.meta.outcome}`,
    `Round Table   LEFT[${L}]   MIDDLE[${M}]   PD[${P}]   nexus=${state.flags.nexus}`,
    `Altar minors=${state.altar.minors.length}  major=${state.altar.major.map((c) => labelCard(catalog, c)).join(",") || "—"}`,
    `Veil=${state.veil.length}  Deck=${state.drawDeck.length}  event=${state.flags.lastEvent ?? "—"} roll=${state.flags.lastEventRoll ?? "—"}`,
  ];
  for (const p of state.players) {
    const star = p.id === state.meta.activePlayerId ? "*" : " ";
    const lin = p.lineage.at(-1) ? labelCard(catalog, p.lineage.at(-1)) : "—";
    const hand = p.hand.map((c) => labelCard(catalog, c)).join(", ") || "empty";
    lines.push(
      `${star}${p.id}  HP ${p.health}  lineage ${lin}  eclipse=${p.eclipse}  hand[${p.hand.length}]: ${hand}`,
    );
  }
  return lines.join("\n");
}

export function formatLog(events: readonly GameEvent[], limit = 24): string {
  const slice = events.slice(-limit);
  return slice.map((e) => `#${e.seq} ${e.type} ${summarize(e)}`).join("\n");
}

function summarize(e: GameEvent): string {
  const skip = new Set(["seq", "clock", "type"]);
  const rest = Object.keys(e)
    .filter((k) => !skip.has(k))
    .map((k) => `${k}=${JSON.stringify(e[k])}`)
    .join(" ");
  return rest;
}
