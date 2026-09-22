import { labelCard, proxyCatalog, type GameEvent, type GameState } from "@nexus/game-core";

const catalog = proxyCatalog();

/** Short narrative lines for the Story pane (raw JSON stays on Logs → Technical). */
export function storyLines(state: GameState, limit = 24): string[] {
  const out: string[] = [];
  for (const e of state.log.slice(-limit)) {
    const line = narrate(e, state);
    if (line) out.push(line);
  }
  return out;
}

/**
 * Full-match prose for Logs → Prose, image prompts, and story export.
 * Skips phase machinery; keeps beats a reader (or image model) can use.
 */
export function proseDocument(state: GameState): string {
  const lines: string[] = [];
  lines.push(`NEXUS · ${state.meta.seed ?? "match"} · ${state.meta.playerCount}p · ${state.meta.outcome}`);
  lines.push("");
  for (const e of state.log) {
    const line = narrate(e, state);
    if (line) lines.push(line);
  }
  lines.push("");
  lines.push("--- image beats ---");
  for (const beat of imageBeats(state)) lines.push(`• ${beat}`);
  return lines.join("\n");
}

/** Compact visual prompts derived from the match (for stills / keyframes). */
export function imageBeats(state: GameState): string[] {
  const beats: string[] = [];
  const claims = state.log.filter((e) => e.type === "LINEAGE_CLAIMED");
  if (claims.length) {
    beats.push(
      `Opening: four roads — ${claims.map((e) => `${e.playerId} on ${cardName(e.cardId)}`).join("; ")}.`,
    );
  }
  for (const e of state.log) {
    if (e.type === "ECLIPSE") {
      beats.push(`Eclipse for ${e.playerId} — two Majors, red and black, Altar lit, Joker to hand.`);
    }
    if (e.type === "NEXUS_CHECK" && e.nexus) {
      beats.push(`Nexus: three seats same element on the Round Table.`);
    }
    if (e.type === "BARRIER_RESOLVED" && e.success) {
      beats.push(`Barrier broken — ${e.playerId ?? "a seeker"} clears LEFT.`);
    }
    if (e.type === "DIALOGUE_RESOLVED" && e.success) {
      beats.push(`Dialogue opens — gifts from LEFT and MIDDLE.`);
    }
    if (e.type === "GAME_OVER") {
      beats.push(`End: ${e.outcome} at turn ${state.meta.turn}/${state.meta.maxTurns}.`);
    }
  }
  return beats;
}

function cardName(id: unknown): string {
  if (typeof id !== "string") return "a card";
  return labelCard(catalog, { instanceId: "x", cardId: id });
}

function narrate(e: GameEvent, state: GameState): string | null {
  const card = cardName;
  switch (e.type) {
    case "GAME_CREATED":
      return `A new game begins (${e.dealt} cards in the draw).`;
    case "LINEAGE_CLAIMED":
      return `${e.playerId} starts on ${card(e.cardId)}.`;
    case "ACE_TO_VEIL":
      return `${card(e.cardId)} rests in the Veil.`;
    case "DEAL_HAND":
      return `${e.playerId} draws an opening hand (${e.count}).`;
    case "LINEAGE_EVOLVED":
      return `${e.playerId} evolves into ${card(e.cardId)}${e.source === "deal" ? " at deal" : ""}.`;
    case "LINEAGE_NONE":
      return e.neededRank
        ? `${e.playerId ?? "A player"} needs a ${e.neededRank} to grow — not in hand.`
        : `${e.playerId ?? "A player"} cannot grow lineage now.`;
    case "TURN_BEGAN":
      return `Turn ${e.turn}: ${e.playerId}'s move.`;
    case "DIAL_SET":
      return `The day dial turns ${e.dial}.`;
    case "DRAW_TO_PD":
      return `${card(e.cardId)} enters Parallel Dimension.`;
    case "PD_RESURFACED":
      return `${card(e.cardId)} rises from Parallel Dimension onto the Altar.`;
    case "LEFT_UNCLAIMED":
      return `${card(e.cardId)} falls from LEFT into the Veil.`;
    case "EVENT_ROLLED":
      return `Event die shows ${e.roll} — ${e.kind}.`;
    case "EVENT_WAITING_COMMITS":
      return e.round && e.of && Number(e.of) > 1
        ? `${String(e.kind)} combat, round ${e.round} of ${e.of}.`
        : `Commit to the ${e.kind}.`;
    case "COMBAT_ROUND":
      return `Round ${e.round}: +${e.roundPower} force (bowl ${e.bowl}).`;
    case "COMMITTED":
      return e.cardId ? `${e.playerId} plays ${card(e.cardId)}.` : `${e.playerId} passes.`;
    case "BARRIER_RESOLVED":
      return e.success
        ? `Barrier cleared (${e.total} vs ${e.threshold}).`
        : e.stalemate
          ? `Barrier stalemate (${e.total} = ${e.threshold}) — the wall holds.`
          : `Barrier holds (${e.total} vs ${e.threshold}).`;
    case "BARRIER_FAIL":
      return `${e.playerId} takes ${e.damage} damage.`;
    case "BARRIER_SUCCESS":
      return `${e.playerId} breaks through.`;
    case "DIALOGUE_RESOLVED":
      return e.success
        ? `Dialogue succeeds (bowl ${e.bowl} vs ${e.threshold}).`
        : e.stalemate
          ? `Dialogue stalemate — the exchange ends without a gift.`
          : `Dialogue fails (bowl ${e.bowl} vs ${e.threshold}).`;
    case "DIALOGUE_REWARD":
      return `${e.playerId} takes ${card(e.cardId)} from ${e.slot}.`;
    case "DIALOGUE_TO_VEIL":
      return `${card(e.cardId)} from ${e.slot} drifts to the Veil.`;
    case "TREASURE":
      return `Treasure: ${card(e.cardId)} awaits on LEFT.`;
    case "REWARD_TAKEN":
      return `LEFT goes to ${e.dest}${e.reason ? ` (${e.reason})` : ""}.`;
    case "MANIP_USED":
      return e.ok ? `${state.meta.activePlayerId} uses ${e.element}.` : `${e.element} had no effect.`;
    case "MANIP_PASSED":
    case "MANIP_SKIPPED":
      return `Pass elemental.`;
    case "ECLIPSE":
      return `Eclipse for ${e.playerId} (${e.source}).`;
    case "JOKER_TO_HAND":
      return `The Joker settles into ${e.playerId}'s hand.`;
    case "ECLIPSE_CHECK":
      return e.ready ? `${e.playerId} already Eclipsed — Altar still primed.` : null;
    case "NEXUS_CHECK":
      return e.nexus ? `Nexus lights on the table.` : null;
    case "CHARACTER_CLAIMED":
      return `${e.playerId} claims ${card(e.cardId)}.`;
    case "ALTAR_OVERFLOW":
      return `${card(e.cardId)} overflows the Altar into the Veil.`;
    case "MAJOR_DIVERTED":
      return e.dest === "pd"
        ? `${card(e.cardId)} is diverted into Parallel Dimension.`
        : `${card(e.cardId)} is diverted onto the Altar.`;
    case "ROUND_BEGAN":
      return `Round ${e.round} of ${e.of}.`;
    case "GAME_OVER":
      return `Game over — ${e.outcome}.`;
    default:
      return null;
  }
}
