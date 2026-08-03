import { describe, expect, it } from "vitest";
import { formatAmount } from "./AmountInput";

describe("formatAmount", () => {
  it("returns empty string for null/undefined/NaN", () => {
    expect(formatAmount(null)).toBe("");
    expect(formatAmount(undefined)).toBe("");
    expect(formatAmount(NaN)).toBe("");
  });

  it("formats integers with thousand separators (Latin digits)", () => {
    expect(formatAmount(1234567)).toBe("1,234,567");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(999)).toBe("999");
  });

  it("preserves decimal parts", () => {
    expect(formatAmount(1234.5)).toBe("1,234.5");
    expect(formatAmount(1000000.25)).toBe("1,000,000.25");
  });
});
