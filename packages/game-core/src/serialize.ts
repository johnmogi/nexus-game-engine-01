import type { GameState } from "./types.js";

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  return JSON.parse(json) as GameState;
}

export function snapshotEqual(a: GameState, b: GameState): boolean {
  return serialize(a) === serialize(b);
}
