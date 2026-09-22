import type { DialPhase, PlayerCount } from "./types.js";

const DAY: DialPhase = "day";
const NIGHT: DialPhase = "night";

/** Period coprime to seating where possible, so a seat is not glued to day.
 * 2p DDNN (DNDN would lock seats). 3p DN. 4p DDN — index by turn, not by round. */
export function dialPattern(playerCount: PlayerCount): DialPhase[] {
  if (playerCount === 2) return [DAY, DAY, NIGHT, NIGHT];
  if (playerCount === 3) return [DAY, NIGHT];
  return [DAY, DAY, NIGHT];
}

export function dialForTurn(turn: number, playerCount: PlayerCount, _round: number): DialPhase {
  if (turn < 1) return "none";
  const pattern = dialPattern(playerCount);
  const i = (turn - 1) % pattern.length;
  return pattern[i] ?? DAY;
}
