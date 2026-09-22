import { describe, expect, it } from "vitest";
import { elementAdvantage } from "./elements.js";

describe("elementAdvantage", () => {
  it("returns 0 when cycle is null or incomplete", () => {
    expect(elementAdvantage("air", "fire", null)).toBe(0);
    expect(elementAdvantage("air", "fire", {})).toBe(0);
    expect(elementAdvantage(undefined, "fire", { air: "fire" })).toBe(0);
  });

  it("uses a filled cycle when provided", () => {
    const cycle = { air: "fire", fire: "earth", earth: "water", water: "air" } as const;
    expect(elementAdvantage("air", "fire", cycle)).toBe(1);
    expect(elementAdvantage("fire", "air", cycle)).toBe(-1);
    expect(elementAdvantage("air", "earth", cycle)).toBe(0);
  });
});
