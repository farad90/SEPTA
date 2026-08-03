import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { computeEffectiveUnitPrice, SelectionService } from "./selection.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn(), update: jest.fn() },
    supplierOffer: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    supplierOfferItem: { findFirst: jest.fn(), findUnique: jest.fn() },
    inquiryItem: { findFirst: jest.fn(), update: jest.fn() },
    inquiryDeliveryOption: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const service = new SelectionService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
  );
  return { service, activityLog };
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

  it("rejects unlocking a stage that isn't locked", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null, deletedAt: null });
    const { service } = buildService(prisma);

    await expect(service.unlock(INQUIRY_ID, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});
