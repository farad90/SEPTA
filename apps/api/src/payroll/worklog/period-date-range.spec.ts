import { format as formatJalaliDate } from "date-fns-jalali";
import { periodDateRange } from "./period-date-range";

describe("periodDateRange", () => {
  it("برای calendarType='jalali'، بازه‌ی یک ماه شمسی کامل می‌سازد", () => {
    const { start, end } = periodDateRange("jalali", 1406, 1);

    expect(formatJalaliDate(start, "yyyy-MM-dd")).toBe("1406-01-01");
    // پایان = روز اول ماه بعد (غیرشامل)
    expect(formatJalaliDate(end, "yyyy-MM-dd")).toBe("1406-02-01");
  });

  it("عبور از پایان سال شمسی را درست مدیریت می‌کند (اسفند → فروردین سال بعد)", () => {
    const { start, end } = periodDateRange("jalali", 1405, 12);

    expect(formatJalaliDate(start, "yyyy-MM-dd")).toBe("1405-12-01");
    expect(formatJalaliDate(end, "yyyy-MM-dd")).toBe("1406-01-01");
  });

  it("برای calendarType غیر jalali (میلادی)، بازه‌ی ماه میلادی می‌سازد", () => {
    const { start, end } = periodDateRange("gregorian", 2026, 3);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2); // صفر-پایه: اسفند نه، مارس
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(1);
  });

  it("عبور از پایان سال میلادی را درست مدیریت می‌کند (دسامبر → ژانویه سال بعد)", () => {
    const { start, end } = periodDateRange("gregorian", 2026, 12);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(11);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });

  it("end همیشه دقیقاً بعد از start است (بازه‌ی معتبر و غیرخالی)", () => {
    const { start, end } = periodDateRange("jalali", 1406, 6);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
