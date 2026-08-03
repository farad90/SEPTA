import { formatMoney, translateUnit } from "./format-helpers";

describe("formatMoney", () => {
  it("پیشوند $ برای دلار", () => {
    expect(formatMoney(1234, "USD", "en")).toBe("$1,234");
  });

  it("پسوند برای ریال ایران — فارسی «ریال»، انگلیسی IRR", () => {
    expect(formatMoney(1000, "IRR", "fa")).toContain("ریال");
    expect(formatMoney(1000, "IRR", "en")).toContain("IRR");
  });

  it("مقدار null رو با خط تیره نشون می‌ده", () => {
    expect(formatMoney(null, "USD", "en")).toBe("—");
  });

  it("ارز ناشناخته: خود کد ارز به‌عنوان نماد استفاده می‌شه", () => {
    expect(formatMoney(10, "XYZ", "en")).toContain("XYZ");
  });
});

describe("translateUnit", () => {
  it("در سند فارسی همون واحد فارسی برمی‌گرده", () => {
    expect(translateUnit("کیلوگرم", "fa")).toBe("کیلوگرم");
  });

  it("در سند انگلیسی معادل شناخته‌شده برمی‌گرده", () => {
    expect(translateUnit("کیلوگرم", "en")).toBe("kg");
    expect(translateUnit("عدد", "en")).toBe("pcs");
  });

  it("واحد سفارشی ناشناخته در انگلیسی به همون متن فارسی fallback می‌کنه", () => {
    expect(translateUnit("واحد عجیب", "en")).toBe("واحد عجیب");
  });
});
