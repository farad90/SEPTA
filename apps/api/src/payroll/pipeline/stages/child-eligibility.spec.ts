import { countEligibleChildren } from "./child-eligibility";

describe("countEligibleChildren", () => {
  const REFERENCE = new Date(2026, 4, 1); // ۱ مه ۲۰۲۶

  it("فرزند زیر سقف سنی را می‌شمارد", () => {
    const count = countEligibleChildren([{ birthDate: new Date(2015, 0, 1) }], REFERENCE, 18);
    expect(count).toBe(1); // ۱۱ ساله
  });

  it("فرزندی که دقیقاً به سقف سنی رسیده را دیگر نمی‌شمارد", () => {
    // دقیقاً ۱۸ سالگی در تاریخ مرجع
    const count = countEligibleChildren([{ birthDate: new Date(2008, 4, 1) }], REFERENCE, 18);
    expect(count).toBe(0);
  });

  it("یک روز مانده به ۱۸ سالگی هنوز واجد شرایط است", () => {
    const count = countEligibleChildren([{ birthDate: new Date(2008, 4, 2) }], REFERENCE, 18);
    expect(count).toBe(1);
  });

  it("سالگرد تولد را درست محاسبه می‌کند، نه صرفاً تفاضل سال", () => {
    // متولد آذر ۱۳۸۷ (۲۰۰۸ میلادی) — تا تاریخ مرجع (مه ۲۰۲۶) هنوز به سالگرد آذر نرسیده،
    // پس سن واقعی ۱۷ است نه ۱۸ (اگر فقط تفاضل سال حساب می‌شد، اشتباهاً ۱۸ می‌داد)
    const count = countEligibleChildren([{ birthDate: new Date(2008, 10, 15) }], REFERENCE, 18);
    expect(count).toBe(1);
  });

  it("چند فرزند را مستقل ارزیابی و جمع می‌زند", () => {
    const count = countEligibleChildren(
      [
        { birthDate: new Date(2015, 0, 1) }, // واجد شرایط
        { birthDate: new Date(2000, 0, 1) }, // بالای سن
        { birthDate: new Date(2020, 0, 1) }, // واجد شرایط
      ],
      REFERENCE,
      18,
    );
    expect(count).toBe(2);
  });

  it("بدون سقف سنی تنظیم‌شده (Infinity)، همه‌ی فرزندان شمرده می‌شوند", () => {
    const count = countEligibleChildren(
      [{ birthDate: new Date(1990, 0, 1) }, { birthDate: new Date(2020, 0, 1) }],
      REFERENCE,
      Number.POSITIVE_INFINITY,
    );
    expect(count).toBe(2);
  });

  it("آرایه‌ی خالی صفر می‌دهد", () => {
    expect(countEligibleChildren([], REFERENCE, 18)).toBe(0);
  });
});
