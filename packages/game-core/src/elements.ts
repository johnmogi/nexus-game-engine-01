import type { Element } from "./types.js";

/** Which element beats which. Locked off until the pamphlet fills the cycle. */
export type ElementCycle = Partial<Record<Element, Element>>;

/**
 * Rock-paper-scissors style advantage.
 * Returns 1 if `a` beats `b`, -1 if `b` beats `a`, else 0.
 * Empty cycle or missing elements → 0 (feature gated off).
 */
export function elementAdvantage(
  a: Element | undefined,
  b: Element | undefined,
  cycle: ElementCycle | null | undefined,
): -1 | 0 | 1 {
  if (!cycle || !a || !b || a === b) return 0;
  if (cycle[a] === b) return 1;
  if (cycle[b] === a) return -1;
  return 0;
}
