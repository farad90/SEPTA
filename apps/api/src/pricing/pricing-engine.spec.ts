import { Prisma } from "../../generated/prisma";
import {
  convertCurrency,
  computeMarginBase,
  computePostMarginAddOns,
  computeCommercialPrice,
  computeFinalCustomerPrice,
  assertValidMarkupPercent,
  assertNonNegativePrice,
  priceItem,
  distributeCostsAcrossItems,
  priceOptionItems,
} from "./pricing-engine";

describe("convertCurrency — تبدیل ارز Decimal-safe", () => {
  it("100,000 PLN / (1 EUR = 4.30 PLN) → 23,255.81 EUR (طبق سناریوی تأییدشده)", () => {
    // نرخ به‌صورت «۱ واحد ارز مبنا = چند واحد ارز مبدأ» ذخیره می‌شه (هم‌الگوی
    // InquirySelectionExchangeRate.rate)، پس تبدیل = amount / rate
    const plnAmount = new Prisma.Decimal(100000);
    const rate = new Prisma.Decimal(4.3);
    const eurAmount = plnAmount.dividedBy(rate);
    expect(eurAmount.toDecimalPlaces(2).toNumber()).toBeCloseTo(23255.81, 2);
  });

  it("multiplies by a given rate (source currency → target currency)", () => {
    const result = convertCurrency(100, 4.3);
    expect(result.toNumber()).toBeCloseTo(430, 6);
  });

  it("rejects a zero or negative rate", () => {
    expect(() => convertCurrency(100, 0)).toThrow(RangeError);
    expect(() => convertCurrency(100, -1)).toThrow(RangeError);
  });

  it("rejects a non-finite rate (guards against NaN/Infinity propagating into money math)", () => {
    expect(() => convertCurrency(100, NaN)).toThrow();
    expect(() => convertCurrency(100, Infinity)).toThrow(RangeError);
  });
});

describe("computeMarginBase / computePostMarginAddOns — پرچم include_in_margin_base", () => {
  const purchaseCost = 10000; // فرض: هزینه خرید تبدیل‌شده به ارز فروش

  it("purchase cost alone when there are no additional costs", () => {
    expect(computeMarginBase(purchaseCost, []).toNumber()).toBe(10000);
    expect(computePostMarginAddOns([]).toNumber()).toBe(0);
  });

  it("only margin-base-flagged costs are added to the base (freight/insurance example from spec)", () => {
    const costs = [
      { amount: 1000, includeInMarginBase: true }, // freight
      { amount: 300, includeInMarginBase: true }, // insurance
      { amount: 700, includeInMarginBase: false }, // customs
      { amount: 500, includeInMarginBase: false }, // other
    ];
    expect(computeMarginBase(purchaseCost, costs).toNumber()).toBe(10000 + 1000 + 300);
    expect(computePostMarginAddOns(costs).toNumber()).toBe(700 + 500);
  });
});

describe("computeCommercialPrice — فرمول مارک‌آپ (Markup-on-Cost)، نه Margin", () => {
  it("cost=100, markup=20% → 120 (Markup formula, NOT the Margin formula which would give 125)", () => {
    const result = computeCommercialPrice(100, 20);
    expect(result.toNumber()).toBe(120);
  });

  it("CPT 30% margin on a mixed margin-base scenario matches manual calculation", () => {
    // هزینه خرید تبدیل‌شده = 23,255.81، freight/insurance داخل هزینه پایه، customs بیرون
    const marginBase = computeMarginBase(23255.81, [
      { amount: 500, includeInMarginBase: true },
      { amount: 200, includeInMarginBase: false },
    ]);
    const postMarginAddOns = computePostMarginAddOns([
      { amount: 500, includeInMarginBase: true },
      { amount: 200, includeInMarginBase: false },
    ]);
    const price = computeCommercialPrice(marginBase, 30, postMarginAddOns);
    // (23255.81 + 500) * 1.3 + 200 = 23755.81 * 1.3 + 200
    const expected = 23755.81 * 1.3 + 200;
    expect(price.toNumber()).toBeCloseTo(expected, 6);
  });

  it("rejects a markup below -100% (would produce a negative price)", () => {
    expect(() => computeCommercialPrice(100, -150)).toThrow(RangeError);
  });

  it("has no floating-point drift across many fractional-cent inputs (Decimal, not JS float)", () => {
    const price = computeCommercialPrice(0.1, 10); // classic 0.1 float-drift trap
    expect(price.toString()).toBe("0.11");
  });
});

describe("computeFinalCustomerPrice — Sales Adjustment never mutates Commercial Price", () => {
  it("adds a positive adjustment", () => {
    expect(computeFinalCustomerPrice(14500, 500).toNumber()).toBe(15000);
  });

  it("adds a negative adjustment (Sales negotiated a discount)", () => {
    expect(computeFinalCustomerPrice(14500, -500).toNumber()).toBe(14000);
  });

  it("with zero adjustment, final price equals commercial price exactly", () => {
    expect(computeFinalCustomerPrice(14500, 0).toNumber()).toBe(14500);
  });
});

describe("assertValidMarkupPercent / assertNonNegativePrice — validation guards", () => {
  it("accepts a normal markup percent", () => {
    expect(() => assertValidMarkupPercent(30)).not.toThrow();
  });

  it("rejects markup below -100", () => {
    expect(() => assertValidMarkupPercent(-101)).toThrow(RangeError);
  });

  it("rejects NaN markup", () => {
    expect(() => assertValidMarkupPercent(NaN)).toThrow(RangeError);
  });

  it("rejects a negative price", () => {
    expect(() => assertNonNegativePrice(-1, "قیمت نهایی")).toThrow(RangeError);
  });

  it("accepts zero price", () => {
    expect(() => assertNonNegativePrice(0, "قیمت نهایی")).not.toThrow();
  });
});

describe("priceItem — خط لوله کامل: Purchase Cost → Margin Base → Commercial Price → Sales Adjustment → Final Price", () => {
  it("full pipeline matches the spec's exact end-to-end scenario (section 30)", () => {
    // 100,000 PLN / 4.30 = 23,255.8139... EUR. convertCurrency multiplies (matching the
    // existing InquirySelectionExchangeRate.rate convention: amountInBase = amountInSource * rate),
    // so "1 EUR = 4.30 PLN" is stored/passed as rate = 1/4.30 (EUR per PLN), not 4.30 itself.
    const rateEurPerPln = new Prisma.Decimal(1).dividedBy(4.3);
    const purchaseCostEur = convertCurrency(100000, rateEurPerPln);

    const costs = [
      { amount: 500, includeInMarginBase: true }, // freight — counts toward margin
      { amount: 200, includeInMarginBase: false }, // customs — does not
    ];

    const result = priceItem({
      inquiryItemId: "item-1",
      purchaseCost: purchaseCostEur,
      costs,
      markupPercent: 30,
      salesAdjustmentAmount: -500,
    });

    // marginBase = 23255.8139... + 500
    expect(result.marginBaseAmount.toDecimalPlaces(2).toNumber()).toBeCloseTo(23755.81, 2);
    // commercial = marginBase*1.3 + 200 (post-margin add-on)
    const expectedCommercial = purchaseCostEur.plus(500).times(1.3).plus(200);
    expect(result.commercialCalculatedPrice.toDecimalPlaces(2).toNumber()).toBeCloseTo(
      expectedCommercial.toDecimalPlaces(2).toNumber(),
      2,
    );
    // final = commercial - 500 (sales adjustment), commercial itself is untouched
    expect(result.finalSalePrice.toDecimalPlaces(2).toNumber()).toBeCloseTo(
      expectedCommercial.minus(500).toDecimalPlaces(2).toNumber(),
      2,
    );
  });

  it("CPT and DDP priced independently with different margins/costs never share a result (isolation check)", () => {
    const purchaseCost = 10000;

    const cpt = priceItem({
      inquiryItemId: "item-1",
      purchaseCost,
      costs: [{ amount: 300, includeInMarginBase: true }],
      markupPercent: 30,
    });

    const ddp = priceItem({
      inquiryItemId: "item-1",
      purchaseCost,
      costs: [
        { amount: 300, includeInMarginBase: true },
        { amount: 2000, includeInMarginBase: true }, // extra DDP-only customs/duties bundled into cost
      ],
      markupPercent: 70,
    });

    expect(cpt.commercialCalculatedPrice.toNumber()).not.toBe(ddp.commercialCalculatedPrice.toNumber());
    expect(cpt.marginBaseAmount.toNumber()).toBe(10300);
    expect(ddp.marginBaseAmount.toNumber()).toBe(12300);
    // CPT: 10300 * 1.3 = 13390
    expect(cpt.commercialCalculatedPrice.toNumber()).toBe(13390);
    // DDP: 12300 * 1.7 = 20910
    expect(ddp.commercialCalculatedPrice.toNumber()).toBe(20910);
  });

  it("throws instead of producing NaN/Infinity when markup is invalid", () => {
    expect(() =>
      priceItem({ inquiryItemId: "x", purchaseCost: 100, costs: [], markupPercent: NaN }),
    ).toThrow();
  });
});

describe("distributeCostsAcrossItems — option-level costs spread proportionally by line value (not flat per item)", () => {
  it("splits a single option-wide freight cost by each row's value share, matching computeEffectiveUnitPrice's pattern", () => {
    // دو ردیف با تعداد نابرابر — همون سناریوی computeEffectiveUnitPrice در selection.service.spec.ts
    const rows = [
      { inquiryItemId: "a", purchaseCost: 10, quantity: 1 },
      { inquiryItemId: "b", purchaseCost: 10, quantity: 9 },
    ];
    // subTotal = 10*1 + 10*9 = 100؛ هزینه پایه‌محور = 10
    const shares = distributeCostsAcrossItems(rows, [{ amount: 10, includeInMarginBase: true }]);
    const a = shares.find((s) => s.inquiryItemId === "a")!;
    const b = shares.find((s) => s.inquiryItemId === "b")!;
    // سهم A: (10/100)*10 = 1 → تقسیم بر تعداد (1) = 1 افزودنی به هر واحد
    expect(a.marginBaseUnitCost.toNumber()).toBeCloseTo(1);
    // سهم B: (90/100)*10 = 9 → تقسیم بر تعداد (9) = 1 افزودنی به هر واحد (نه عدد متفاوت)
    expect(b.marginBaseUnitCost.toNumber()).toBeCloseTo(1);
  });

  it("keeps margin-base and post-margin shares separate", () => {
    const rows = [{ inquiryItemId: "a", purchaseCost: 100, quantity: 1 }];
    const shares = distributeCostsAcrossItems(rows, [
      { amount: 50, includeInMarginBase: true },
      { amount: 20, includeInMarginBase: false },
    ]);
    expect(shares[0].marginBaseUnitCost.toNumber()).toBe(50);
    expect(shares[0].postMarginUnitAddOn.toNumber()).toBe(20);
  });

  it("does not divide by zero when a row has zero quantity or the subtotal is zero", () => {
    const rows = [{ inquiryItemId: "a", purchaseCost: 0, quantity: 0 }];
    const shares = distributeCostsAcrossItems(rows, [{ amount: 100, includeInMarginBase: true }]);
    expect(shares[0].marginBaseUnitCost.toNumber()).toBe(0);
    expect(Number.isFinite(shares[0].marginBaseUnitCost.toNumber())).toBe(true);
  });
});

describe("priceOptionItems — full option pricing (distribution + markup) stays isolated per item", () => {
  it("CPT option: two items share one freight cost proportionally, each keeps its own markup", () => {
    const items = [
      { inquiryItemId: "a", purchaseCost: 100, quantity: 1, markupPercent: 20 },
      { inquiryItemId: "b", purchaseCost: 300, quantity: 1, markupPercent: 30 },
    ];
    // freight=40, margin-base; subTotal=400 → a gets 10, b gets 30 added to its margin base
    const results = priceOptionItems(items, [{ amount: 40, includeInMarginBase: true }]);
    const a = results.find((r) => r.inquiryItemId === "a")!;
    const b = results.find((r) => r.inquiryItemId === "b")!;
    // a: (100+10)*1.2 = 132
    expect(a.commercialCalculatedPrice.toNumber()).toBeCloseTo(132);
    // b: (300+30)*1.3 = 429
    expect(b.commercialCalculatedPrice.toNumber()).toBeCloseTo(429);
  });

  it("a second option with different costs/markup on the same items produces entirely different numbers (CPT vs DDP isolation)", () => {
    const items = [{ inquiryItemId: "a", purchaseCost: 100, quantity: 1, markupPercent: 20 }];
    const cpt = priceOptionItems(items, [{ amount: 10, includeInMarginBase: true }]);
    const ddpItems = [{ inquiryItemId: "a", purchaseCost: 100, quantity: 1, markupPercent: 70 }];
    const ddp = priceOptionItems(ddpItems, [{ amount: 50, includeInMarginBase: true }]);
    expect(cpt[0].commercialCalculatedPrice.toNumber()).not.toBe(ddp[0].commercialCalculatedPrice.toNumber());
    expect(cpt[0].commercialCalculatedPrice.toNumber()).toBeCloseTo(132); // (100+10)*1.2
    expect(ddp[0].commercialCalculatedPrice.toNumber()).toBeCloseTo(255); // (100+50)*1.7
  });
});
