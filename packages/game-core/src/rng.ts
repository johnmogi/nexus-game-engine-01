export interface RngState {
  s: number;
}

function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32. State is JSON-serializable. Never use Math.random in game-core. */
export function rngFromSeed(seed: string): RngState {
  return { s: fnv1a(seed) || 1 };
}

export function rngNext(rng: RngState): { rng: RngState; value: number } {
  let t = (rng.s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { rng: { s: t >>> 0 }, value };
}

export function rngNextInt(rng: RngState, n: number): { rng: RngState; value: number } {
  if (n <= 0) {
    throw new Error("rngNextInt: n must be positive");
  }
  const step = rngNext(rng);
  return { rng: step.rng, value: Math.floor(step.value * n) };
}

export function rngShuffle<T>(rng: RngState, items: readonly T[]): { rng: RngState; items: T[] } {
  const next = items.slice();
  let state = rng;
  for (let i = next.length - 1; i > 0; i--) {
    const roll = rngNextInt(state, i + 1);
    state = roll.rng;
    const j = roll.value;
    const tmp = next[i] as T;
    next[i] = next[j] as T;
    next[j] = tmp;
  }
  return { rng: state, items: next };
}

export function contentHash(parts: readonly string[]): string {
  return fnv1a(parts.join("\n")).toString(16).padStart(8, "0");
}
