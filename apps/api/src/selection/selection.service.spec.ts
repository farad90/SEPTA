import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { ActivitiesService } from "../activities/activities.service";
import { computeEffectiveUnitPrice, SelectionService } from "./selection.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";

function buildPrisma() {
  const prisma: Record<string, unknown> = {
    inquiry: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    supplierOffer: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    supplierOfferItem: { findFirst: jest.fn(), findUnique: jest.fn() },
    inquiryItem: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    inquiryDeliveryOption: { deleteMany: jest.fn(), createMany: jest.fn() },
    currency: { findUnique: jest.fn() },
    // فاز ۶۰ (اصلاح — بازخورد کاربر) — هزینه‌های اضافی/گزینه‌های ترم تحویل/مارک‌آپ
    inquiryPricingCost: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inquiryPricingOption: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inquiryPricingOptionItem: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  // پشتیبانی از هر دو شکل $transaction: آرایه‌ای (قدیمی) و تعاملی/callback (addPricingOption/saveMarkup)
  prisma.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma as unknown as ReturnType<typeof buildPrismaShape>;
}
// فقط برای استخراج نوع بازگشتی buildPrisma بدون دوباره‌نویسی — خود این تابع صدا زده نمی‌شه
function buildPrismaShape() {
  return {} as {
    inquiry: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    supplierOffer: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    supplierOfferItem: { findFirst: jest.Mock; findUnique: jest.Mock };
    inquiryItem: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    inquiryDeliveryOption: { deleteMany: jest.Mock; createMany: jest.Mock };
    currency: { findUnique: jest.Mock };
    inquiryPricingCost: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    inquiryPricingOption: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    inquiryPricingOptionItem: { create: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const activities = {
    openStageActivity: jest.fn().mockResolvedValue({}),
    closeStageActivities: jest.fn().mockResolvedValue(0),
  };
  const service = new SelectionService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    activities as unknown as ActivitiesService,
  );
  return { service, activityLog, activities };
}

describe("computeEffectiveUnitPrice — فرمول اصلاح‌شده توزیع هزینه", () => {
  it("returns the raw price unchanged when both distribute switches are off", () => {
    const row = { offerItemId: "a", offerId: "o1", inquiryItemId: "i1", price: 10, quantity: 5 };
    const result = computeEffectiveUnitPrice(row, [row], {
      vatApplicable: true,
      vatRatePercent: 10,
      otherCosts: 50,
      distributeVat: false,
      distributeOtherCosts: false,
    });
    expect(result).toBe(10);
  });

  it("distributes extra costs by line VALUE (price×qty), not by unit price alone", () => {
    // دو ردیف با تعداد نابرابر — نقطه‌ای که فرمول mockup غلط بود
    const rowA = { offerItemId: "a", offerId: "o1", inquiryItemId: "i1", price: 10, quantity: 1 };
    const rowB = { offerItemId: "b", offerId: "o1", inquiryItemId: "i2", price: 10, quantity: 9 };
    // subTotal = 10×1 + 10×9 = 100؛ otherCosts=10، بدون VAT
    const offer = {
      vatApplicable: false,
      vatRatePercent: 0,
      otherCosts: 10,
      distributeVat: false,
      distributeOtherCosts: true,
    };

    // سهم A: (10/100)×10 = 1 → تقسیم بر تعداد (1) = +1 → فی مؤثر = 11
    expect(computeEffectiveUnitPrice(rowA, [rowA, rowB], offer)).toBeCloseTo(11);
    // سهم B: (90/100)×10 = 9 → تقسیم بر تعداد (9) = +1 → فی مؤثر = 11 (نه یک عدد متفاوت اشتباه)
    expect(computeEffectiveUnitPrice(rowB, [rowA, rowB], offer)).toBeCloseTo(11);
  });

  it("matches the mockup's simple formula when quantities are equal", () => {
    const rowA = { offerItemId: "a", offerId: "o1", inquiryItemId: "i1", price: 4.2, quantity: 10 };
    const rowB = { offerItemId: "b", offerId: "o1", inquiryItemId: "i2", price: 5.8, quantity: 10 };
    const offer = {
      vatApplicable: true,
      vatRatePercent: 10,
      otherCosts: 20,
      distributeVat: true,
      distributeOtherCosts: true,
    };
    // subTotal = 42+58=100; vat=10; extra=30; شیوه mockup ساده: نسبت فی به مجموع فی‌ها (وقتی qty برابره معادله)
    const effA = computeEffectiveUnitPrice(rowA, [rowA, rowB], offer);
    const effB = computeEffectiveUnitPrice(rowB, [rowA, rowB], offer);
    expect(effA + effB).toBeCloseTo(4.2 + 5.8 + 30 / 10); // جمع فی مؤثرها = جمع فی‌ها + سهم هزینه هرکدوم
  });

  it("فاز ۳۵-الف: توزیع VAT و سایر هزینه‌ها مستقل از هم قابل فعال‌سازی هستن", () => {
    const row = { offerItemId: "a", offerId: "o1", inquiryItemId: "i1", price: 10, quantity: 1 };
    const baseOffer = { vatApplicable: true, vatRatePercent: 10, otherCosts: 5 };

    // فقط VAT توزیع بشه (بدون سایر هزینه‌ها): subTotal=10، vat=1، extra=1 → فی مؤثر=11
    expect(
      computeEffectiveUnitPrice(row, [row], { ...baseOffer, distributeVat: true, distributeOtherCosts: false }),
    ).toBeCloseTo(11);

    // فقط سایر هزینه‌ها توزیع بشه (بدون VAT): extra=5 → فی مؤثر=15
    expect(
      computeEffectiveUnitPrice(row, [row], { ...baseOffer, distributeVat: false, distributeOtherCosts: true }),
    ).toBeCloseTo(15);

    // هر دو فعال: extra=1+5=6 → فی مؤثر=16
    expect(
      computeEffectiveUnitPrice(row, [row], { ...baseOffer, distributeVat: true, distributeOtherCosts: true }),
    ).toBeCloseTo(16);
  });
});

describe("SelectionService — getSelection متادیتای لازم برای پیش‌نمایش زنده", () => {
  it("فاز ۴۰-الف: هر آفر باید vatApplicable/vatRatePercent/otherCosts/subTotal رو برای پیش‌نمایش زنده‌ی فرانت برگردونه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      deletedAt: null,
      selectionLockedAt: null,
      selectionLocker: null,
      managerNoteToSales: null,
      items: [
        {
          id: "item-1",
          rowIndex: 1,
          itemCode: "BRG-1",
          description: "بلبرینگ",
          quantity: 5,
          measurementUnit: "عدد",
          builder: null,
          selectedOfferItemId: null,
          selectionNotes: null,
          markupPercent: null,
          finalSalePrice: null,
        },
      ],
      deliveryOptions: [],
      selectionBaseCurrencyCode: null,
      selectionExchangeRates: [],
    });
    prisma.supplierOffer.findMany.mockResolvedValue([
      {
        id: "offer-1",
        vatApplicable: true,
        vatRatePercent: 10,
        otherCosts: 20,
        distributeVat: false,
        distributeOtherCosts: false,
        rfq: { rfqNumber: "RFQ-2026-0001", supplier: { id: "s1", companyName: "Schaeffler" } },
        items: [{ id: "offer-item-1", inquiryItemId: "item-1", price: 10, currencyCode: "EUR", deliveryTimeDays: 20, partNumber: null, isEquivalent: false }],
      },
    ]);
    const { service } = buildService(prisma);

    const result = await service.getSelection(INQUIRY_ID);

    expect(result.items[0].offers[0]).toMatchObject({
      vatApplicable: true,
      vatRatePercent: 10,
      otherCosts: 20,
      subTotal: 50, // price(10) × quantity(5)
    });
  });
});

describe("SelectionService — قوانین کسب‌وکاری", () => {
  it("rejects saving after the inquiry is locked", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: new Date(), deletedAt: null });
    const { service } = buildService(prisma);

    await expect(
      service.save(INQUIRY_ID, { items: [] }, true, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an offer item that belongs to another inquiry item", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryItem.findFirst.mockResolvedValue({ id: "item-1", inquiryId: INQUIRY_ID });
    prisma.supplierOfferItem.findFirst.mockResolvedValue(null); // پیدا نشد چون متعلق به قلم/پرونده دیگه‌ست

    const { service } = buildService(prisma);

    await expect(
      service.save(
        INQUIRY_ID,
        { items: [{ inquiryItemId: "item-1", selectedOfferItemId: "foreign-offer-item" }] },
        true,
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects markup/finalSalePrice changes without selection.set_markup", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    const { service } = buildService(prisma);

    await expect(
      service.save(INQUIRY_ID, { items: [{ inquiryItemId: "item-1", markupPercent: 10 }] }, false, "user-1"),
    ).rejects.toThrow();
  });

  it("rejects duplicate delivery terms", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    const { service } = buildService(prisma);

    await expect(
      service.saveDeliveryOptions(
        INQUIRY_ID,
        [
          { deliveryTerm: "EXW", extraCost: 0, deliveryDays: 30 },
          { deliveryTerm: "EXW", extraCost: 10, deliveryDays: 40 },
        ],
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects locking twice", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      selectionLockedAt: new Date(),
      deletedAt: null,
      items: [],
      deliveryOptions: [],
      selectionLocker: null,
      managerNoteToSales: null,
      selectionBaseCurrencyCode: null,
      selectionExchangeRates: [],
    });
    prisma.supplierOffer.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma);

    await expect(service.lock(INQUIRY_ID, undefined, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("فاز ۵۸: lock() موفق pricing_pending رو می‌بنده و proposal_pending رو برای Sales Owner باز می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      selectionLockedAt: null,
      deletedAt: null,
      items: [],
      deliveryOptions: [],
      selectionLocker: null,
      managerNoteToSales: null,
      selectionBaseCurrencyCode: null,
      selectionExchangeRates: [],
    });
    prisma.inquiry.findUniqueOrThrow.mockResolvedValue({ salesExpertId: "sales-1" });
    prisma.supplierOffer.findMany.mockResolvedValue([]);
    const { service, activities } = buildService(prisma);

    await service.lock(INQUIRY_ID, undefined, "user-1");

    expect(activities.closeStageActivities).toHaveBeenCalledWith(INQUIRY_ID, "pricing_pending", "user-1");
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: INQUIRY_ID,
        stageCode: "proposal_pending",
        assignedToUserId: "sales-1",
      }),
    );
  });

  it("rejects unlocking a stage that isn't locked", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    const { service } = buildService(prisma);

    await expect(service.unlock(INQUIRY_ID, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ============================================================
// فاز ۶۰ (اصلاح — بازخورد کاربر) — موتور قیمت‌گذاری بازرگانی مبتنی بر Incoterm. این بخش («تعیین
// حاشیه سود») همین‌جا (مرحله «انتخاب نهایی و قیمت‌گذاری») مدیریت می‌شه، نه در تب «پیشنهاد به مشتری».
// ============================================================

/** mock کامل getSelection با یک قلم دارای آفر منتخب — پایه‌ی مشترک تست‌های addPricingOption/saveMarkup */
function mockSelectionWithOneSelectedOffer(
  prisma: ReturnType<typeof buildPrisma>,
  overrides: { markupPercent?: number | null; effectivePrice?: number; baseCurrency?: string | null } = {},
) {
  prisma.inquiry.findUnique.mockResolvedValue({
    id: INQUIRY_ID,
    deletedAt: null,
    selectionLockedAt: null,
    selectionLocker: null,
    managerNoteToSales: null,
    selectionBaseCurrencyCode: overrides.baseCurrency ?? "EUR",
    selectionExchangeRates: [],
    deliveryOptions: [],
    items: [
      {
        id: "item-1",
        rowIndex: 1,
        itemCode: "BRG-1",
        partNumber: "PN1",
        description: "بلبرینگ",
        quantity: 10,
        measurementUnit: "عدد",
        builder: null,
        selectedOfferItemId: "offer-item-1",
        selectionNotes: null,
        markupPercent: overrides.markupPercent ?? 20,
        finalSalePrice: 12,
      },
    ],
  });
  prisma.supplierOffer.findMany.mockResolvedValue([
    {
      id: "offer-1",
      vatApplicable: false,
      vatRatePercent: 0,
      otherCosts: 0,
      distributeVat: false,
      distributeOtherCosts: false,
      rfq: { rfqNumber: "RFQ-2026-0001", supplier: { id: "s1", companyName: "Schaeffler Group" } },
      items: [
        {
          id: "offer-item-1",
          inquiryItemId: "item-1",
          price: overrides.effectivePrice ?? 10,
          currencyCode: "EUR",
          deliveryTimeDays: 30,
          partNumber: "PN1",
          builder: null,
          isEquivalent: false,
        },
      ],
    },
  ]);
}

describe("SelectionService — فاز ۶۰: هزینه‌های اضافی (InquiryPricingCost)", () => {
  it("creates a pricing cost after validating the currency", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR", currencyName: "یورو", status: "active" });
    prisma.inquiryPricingCost.create.mockResolvedValue({
      id: "cost-1",
      description: "حمل",
      amount: 1000,
      currencyCode: "EUR",
      includeInMarginBase: true,
      deliveryTerm: null,
    });
    const { service, activityLog } = buildService(prisma);

    const result = await service.createPricingCost(
      INQUIRY_ID,
      { description: "حمل", amount: 1000, currencyCode: "EUR", includeInMarginBase: true },
      "user-1",
    );

    expect(result).toEqual({
      id: "cost-1",
      description: "حمل",
      amount: 1000,
      currencyCode: "EUR",
      includeInMarginBase: true,
      deliveryTerm: null,
    });
    expect(activityLog.log).toHaveBeenCalled();
  });

  it("rejects an unknown currency", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.currency.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.createPricingCost(INQUIRY_ID, { description: "x", amount: 1, currencyCode: "XXX" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deletePricingCost throws NotFound for a cost from another inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryPricingCost.findFirst.mockResolvedValue(null); // scoped به inquiryId، متعلق به پرونده دیگه

    const { service } = buildService(prisma);

    await expect(service.deletePricingCost(INQUIRY_ID, "cost-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks pricing-cost writes once the stage is locked", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: new Date(), deletedAt: null });
    const { service } = buildService(prisma);

    await expect(
      service.createPricingCost(INQUIRY_ID, { description: "x", amount: 1, currencyCode: "EUR" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SelectionService — فاز ۶۰: گزینه‌های ترم تحویل (Incoterm Options)", () => {
  it("creates a delivery option and prices every item with the markup-on-cost formula (seeded from the purchase-cost basis)", async () => {
    const prisma = buildPrisma();
    mockSelectionWithOneSelectedOffer(prisma);
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR", currencyName: "یورو", status: "active" });
    prisma.inquiryPricingOption.findFirst
      .mockResolvedValueOnce(null) // بدون گزینه تکراری
      .mockResolvedValueOnce({ id: "opt-cpt", items: [] }); // getPricingOptionOrThrow در پایان
    prisma.inquiryPricingOption.create.mockResolvedValue({ id: "opt-cpt" });
    const { service } = buildService(prisma);

    await service.addPricingOption(INQUIRY_ID, { deliveryTerm: "CPT", deliveryDays: 60, currencyCode: "EUR" }, "user-1");

    // effectivePrice=10, quantity=10, baselineMarkupPercent=20, بدون هزینه اضافی
    // → commercialCalculatedPrice = 10 * 1.2 = 12
    expect(prisma.inquiryPricingOptionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          optionId: "opt-cpt",
          inquiryItemId: "item-1",
          markupPercent: 20,
          commercialCalculatedPrice: 12,
          finalSalePrice: 12,
          commercialPricedBy: "user-1",
        }),
      }),
    );
    expect(prisma.inquiryPricingOption.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "opt-cpt" }, data: expect.objectContaining({ marginBaseAmount: 10 }) }),
    );
  });

  it("rejects a duplicate Incoterm option on the same inquiry", async () => {
    const prisma = buildPrisma();
    mockSelectionWithOneSelectedOffer(prisma);
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR", currencyName: "یورو", status: "active" });
    prisma.inquiryPricingOption.findFirst.mockResolvedValue({ id: "existing-cpt" });
    const { service } = buildService(prisma);

    await expect(
      service.addPricingOption(INQUIRY_ID, { deliveryTerm: "CPT", deliveryDays: 60, currencyCode: "EUR" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires an exchange rate when the option's currency differs from the pricing basis's dominant currency", async () => {
    const prisma = buildPrisma();
    mockSelectionWithOneSelectedOffer(prisma); // dominant currency: EUR
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "USD", currencyName: "دلار", status: "active" });
    prisma.inquiryPricingOption.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.addPricingOption(INQUIRY_ID, { deliveryTerm: "DDP", deliveryDays: 60, currencyCode: "USD" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects adding an option when no item has a selected offer yet", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      deletedAt: null,
      selectionLockedAt: null,
      selectionLocker: null,
      managerNoteToSales: null,
      selectionBaseCurrencyCode: null,
      selectionExchangeRates: [],
      deliveryOptions: [],
      items: [],
    });
    prisma.supplierOffer.findMany.mockResolvedValue([]);
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR", currencyName: "یورو", status: "active" });
    prisma.inquiryPricingOption.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.addPricingOption(INQUIRY_ID, { deliveryTerm: "CPT", deliveryDays: 60, currencyCode: "EUR" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cannot remove the last remaining pricing option", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryPricingOption.findFirst.mockResolvedValue({ id: "opt-1" });
    prisma.inquiryPricingOption.count.mockResolvedValue(1);
    const { service } = buildService(prisma);

    await expect(service.removePricingOption(INQUIRY_ID, "opt-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("CPT and DDP added on the same inquiry price the same item completely independently (isolation)", async () => {
    const prisma = buildPrisma();
    mockSelectionWithOneSelectedOffer(prisma);
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR", currencyName: "یورو", status: "active" });
    prisma.inquiryPricingOption.findFirst
      .mockResolvedValueOnce(null) // بدون گزینه تکراری برای CPT
      .mockResolvedValueOnce({ id: "opt-cpt", items: [] }) // getPricingOptionOrThrow برای CPT
      .mockResolvedValueOnce(null) // بدون گزینه تکراری برای DDP
      .mockResolvedValueOnce({ id: "opt-ddp", items: [] }); // getPricingOptionOrThrow برای DDP
    prisma.inquiryPricingOption.create
      .mockResolvedValueOnce({ id: "opt-cpt" })
      .mockResolvedValueOnce({ id: "opt-ddp" });
    const { service } = buildService(prisma);

    await service.addPricingOption(
      INQUIRY_ID,
      { deliveryTerm: "CPT", deliveryDays: 60, currencyCode: "EUR", defaultMarkupPercent: 20 },
      "user-1",
    );
    await service.addPricingOption(
      INQUIRY_ID,
      { deliveryTerm: "DDP", deliveryDays: 90, currencyCode: "EUR", defaultMarkupPercent: 70 },
      "user-1",
    );

    const calls = prisma.inquiryPricingOptionItem.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const cptCall = calls.find((c) => c[0].data.optionId === "opt-cpt")![0];
    const ddpCall = calls.find((c) => c[0].data.optionId === "opt-ddp")![0];

    // هزینه خرید یکسان (10) با مارک‌آپ‌های متفاوت → قیمت محاسبه‌شده کاملاً متفاوت، بدون نشت
    expect(cptCall.data.commercialCalculatedPrice).toBe(12); // 10 * 1.2
    expect(ddpCall.data.commercialCalculatedPrice).toBe(17); // 10 * 1.7
    expect(cptCall.data.commercialCalculatedPrice).not.toBe(ddpCall.data.commercialCalculatedPrice);
  });
});

describe("SelectionService — فاز ۶۰: قیمت‌گذاری بازرگانی (saveMarkup) — «اعمال به همه» + override تک‌تک اقلام", () => {
  it("«اعمال به همه» مارک‌آپ جدید رو روی هر قلمی که override نشده اعمال می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryPricingOption.findFirst
      .mockResolvedValueOnce({
        id: "opt-1",
        deliveryTerm: "CPT",
        currencyCode: "EUR",
        items: [{ id: "opi-1", inquiryItemId: "item-1", purchasePrice: 10, markupPercent: 20, salesAdjustmentAmount: 0 }],
      })
      .mockResolvedValueOnce({ id: "opt-1", items: [] }); // getPricingOptionOrThrow در پایان
    prisma.inquiryItem.findMany.mockResolvedValue([{ id: "item-1", quantity: 10 }]);
    const { service } = buildService(prisma);

    await service.saveMarkup(INQUIRY_ID, "opt-1", { defaultMarkupPercent: 30 }, "user-1");

    expect(prisma.inquiryPricingOptionItem.update).toHaveBeenCalledWith({
      where: { id: "opi-1" },
      data: expect.objectContaining({
        markupPercent: 30,
        commercialCalculatedPrice: 13, // 10 * 1.3
        finalSalePrice: 13,
        commercialPricedBy: "user-1",
      }),
    });
  });

  it("per-item override بر مارک‌آپ پیش‌فرض ارجحیت داره", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryPricingOption.findFirst
      .mockResolvedValueOnce({
        id: "opt-1",
        deliveryTerm: "CPT",
        currencyCode: "EUR",
        items: [
          { id: "opi-1", inquiryItemId: "item-1", purchasePrice: 10, markupPercent: 20, salesAdjustmentAmount: 0 },
          { id: "opi-2", inquiryItemId: "item-2", purchasePrice: 100, markupPercent: 20, salesAdjustmentAmount: 0 },
        ],
      })
      .mockResolvedValueOnce({ id: "opt-1", items: [] });
    prisma.inquiryItem.findMany.mockResolvedValue([
      { id: "item-1", quantity: 1 },
      { id: "item-2", quantity: 1 },
    ]);
    const { service } = buildService(prisma);

    await service.saveMarkup(
      INQUIRY_ID,
      "opt-1",
      { defaultMarkupPercent: 30, items: [{ inquiryItemId: "item-2", markupPercent: 50 }] },
      "user-1",
    );

    const calls = prisma.inquiryPricingOptionItem.update.mock.calls as Array<
      [{ where: { id: string }; data: Record<string, unknown> }]
    >;
    const item1 = calls.find((c) => c[0].where.id === "opi-1")!;
    const item2 = calls.find((c) => c[0].where.id === "opi-2")!;
    expect(item1[0].data.markupPercent).toBe(30); // پیش‌فرض
    expect(item2[0].data.markupPercent).toBe(50); // override
    expect(item2[0].data.commercialCalculatedPrice).toBe(150); // 100 * 1.5
  });

  it("هرگز فیلدهای اصلاح فروش (salesAdjustment*) رو نمی‌نویسه — این فقط کار ProposalService.saveSalesAdjustment است", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    prisma.inquiryPricingOption.findFirst
      .mockResolvedValueOnce({
        id: "opt-1",
        deliveryTerm: "CPT",
        currencyCode: "EUR",
        items: [
          { id: "opi-1", inquiryItemId: "item-1", purchasePrice: 10, markupPercent: 20, salesAdjustmentAmount: -1 },
        ],
      })
      .mockResolvedValueOnce({ id: "opt-1", items: [] });
    prisma.inquiryItem.findMany.mockResolvedValue([{ id: "item-1", quantity: 10 }]);
    const { service } = buildService(prisma);

    await service.saveMarkup(INQUIRY_ID, "opt-1", { defaultMarkupPercent: 30 }, "user-1");

    const call = prisma.inquiryPricingOptionItem.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("salesAdjustmentAmount");
    expect(call.data).not.toHaveProperty("salesAdjustmentReasonCode");
  });
});
