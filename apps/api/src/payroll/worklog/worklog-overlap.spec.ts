import { sumOverlapDays } from "./worklog-overlap";

const PERIOD_START = new Date(2026, 2, 1); // 1 مارس
const PERIOD_END = new Date(2026, 3, 1); // 1 آوریل (غیرشامل) — دوره ۳۱ روزه

describe("sumOverlapDays", () => {
  it("رکوردی کاملاً داخل دوره را کامل می‌شمارد", () => {
    const days = sumOverlapDays(
      [{ startDate: new Date(2026, 2, 5), endDate: new Date(2026, 2, 9) }],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(5); // ۵،۶،۷،۸،۹
  });

  it("رکوردی که قبل از دوره شروع شده را از ابتدای دوره Clip می‌کند", () => {
    const days = sumOverlapDays(
      [{ startDate: new Date(2026, 1, 25), endDate: new Date(2026, 2, 3) }],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(3); // ۱،۲،۳ مارس
  });

  it("رکوردی که بعد از دوره تمام می‌شود را تا آخر دوره Clip می‌کند", () => {
    const days = sumOverlapDays(
      [{ startDate: new Date(2026, 2, 30), endDate: new Date(2026, 3, 5) }],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(2); // ۳۰، ۳۱ مارس
  });

  it("رکوردی کاملاً خارج از دوره صفر می‌دهد", () => {
    const days = sumOverlapDays(
      [{ startDate: new Date(2026, 3, 5), endDate: new Date(2026, 3, 9) }],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(0);
  });

  it("چند رکورد را جمع می‌زند", () => {
    const days = sumOverlapDays(
      [
        { startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 2) },
        { startDate: new Date(2026, 2, 10), endDate: new Date(2026, 2, 10) },
      ],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(3); // ۲ + ۱
  });

  it("رکوردی که کل دوره را در بر می‌گیرد، طول کامل دوره را می‌دهد", () => {
    const days = sumOverlapDays(
      [{ startDate: new Date(2026, 1, 1), endDate: new Date(2026, 4, 1) }],
      PERIOD_START,
      PERIOD_END,
    );
    expect(days).toBe(31);
  });

  it("آرایه‌ی خالی صفر می‌دهد", () => {
    expect(sumOverlapDays([], PERIOD_START, PERIOD_END)).toBe(0);
  });
});
