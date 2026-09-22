import { labelCard } from "./cards.js";
import type { CardCatalog, GameState, Outcome } from "./types.js";

export interface PlayerStanding {
  id: string;
  health: number;
  alive: boolean;
  lineageLabels: string[];
  /** Distinct lineageIds on the stack (length > 1 = cross-color / secondary elemental). */
  lineageIds: string[];
  crossColor: boolean;
  lineageRank: number;
  eclipse: boolean;
  aspect: string | null;
  treasures: number;
  barriersWon: number;
  barriersLost: number;
}

export interface MatchResult {
  outcome: Outcome;
  headline: string;
  clock: string;
  survivorIds: string[];
  standings: PlayerStanding[];
  notes: string[];
}

function lineageRank(catalog: CardCatalog, state: GameState, playerId: string): number {
  const last = state.players.find((p) => p.id === playerId)?.lineage.at(-1);
  if (!last) return 0;
  return catalog.get(last.cardId)?.rank ?? 0;
}

/** Diagnose how a match ended. Clock expiry is not a scored winner. */
export function summarizeMatch(state: GameState, catalog: CardCatalog): MatchResult {
  const log = state.log;
  const standings: PlayerStanding[] = state.players.map((p) => {
    const treasures = log.filter((e) => e.type === "TREASURE" && e.playerId === p.id).length;
    const barriersWon = log.filter((e) => e.type === "BARRIER_SUCCESS" && e.playerId === p.id).length;
    const barriersLost = log.filter((e) => e.type === "BARRIER_FAIL" && e.playerId === p.id).length;
    const aspectName = p.aspect ? (catalog.get(p.aspect)?.name ?? p.aspect) : null;
    const lineageIds = [
      ...new Set(
        p.lineage
          .map((c) => catalog.get(c.cardId)?.lineageId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return {
      id: p.id,
      health: p.health,
      alive: p.health > 0,
      lineageLabels: p.lineage.map((c) => labelCard(catalog, c)),
      lineageIds,
      crossColor: lineageIds.length > 1,
      lineageRank: lineageRank(catalog, state, p.id),
      eclipse: p.eclipse,
      aspect: aspectName,
      treasures,
      barriersWon,
      barriersLost,
    };
  });
  const survivorIds = standings.filter((s) => s.alive).map((s) => s.id);
  const clock = `turn ${state.meta.turn}/${state.meta.maxTurns} · round ${state.meta.round}/${state.meta.rounds}`;
  const notes: string[] = [];
  const eclipses = log.filter((e) => e.type === "ECLIPSE");
  if (eclipses.length) notes.push(`Eclipse ${eclipses.length}×`);
  if (log.some((e) => e.type === "NEXUS_CHECK" && e.nexus === true)) notes.push("Nexus lit");
  if (log.some((e) => e.type === "VEIL_RECYCLED")) notes.push("Veil reshuffled into draw");
  const cross = standings.filter((s) => s.crossColor);
  if (cross.length) {
    notes.push(
      `Cross-color lineage: ${cross.map((s) => `${s.id} (${s.lineageIds.join("→")})`).join("; ")}`,
    );
  }

  let headline: string;
  if (state.meta.outcome === "playing") {
    headline = "Match in progress.";
  } else if (state.meta.outcome === "party_down") {
    headline =
      survivorIds.length === 1
        ? `${survivorIds[0]} is the last player standing.`
        : "The party is down. Nobody standing.";
  } else if (state.meta.outcome === "deck_exhausted") {
    headline =
      survivorIds.length === 1
        ? `Draw pile empty. ${survivorIds[0]} is still standing.`
        : "Draw pile empty. Clock did not finish; no scored winner.";
  } else {
    headline =
      survivorIds.length === 1
        ? `Clock ran out. ${survivorIds[0]} survived; the others did not.`
        : `Clock ran out. ${survivorIds.join(" and ") || "Nobody"} still standing — no scored winner.`;
  }

  return {
    outcome: state.meta.outcome,
    headline,
    clock,
    survivorIds,
    standings,
    notes,
  };
}
