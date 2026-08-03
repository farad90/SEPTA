import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { SelectionService } from "../selection/selection.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ProposalService } from "./proposal.service";
import { ProposalNumberService } from "./proposal-number.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";

function buildPrisma() {
  const prisma: Record<string, unknown> = {
    inquiry: { findUnique: jest.fn() },
    currency: { findUnique: jest.fn() },
    supplierOfferItem: { findMany: jest.fn().mockResolvedValue([]) },
    financialProposal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      update: jest.fn(),
    },
    financialProposalItem: { update: jest.fn() },
    financialProposalPriceChangeRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    technicalProposal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      update: jest.fn(),
    },
    technicalProposalItem: { update: jest.fn() },
    inquiryItem: { findUnique: jest.fn().mockResolvedValue(null) },
    ourEntity: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  // فاز ۴۰-ب: getOrSeed*/revise* حالا از تراکنش تعاملی (callback) استفاده می‌کنن، نه فقط آرایه —
  // این mock هر دو شکل رو پشتیبانی می‌کنه (callback با خود prisma به‌عنوان tx صدا زده می‌شه)
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
    inquiry: { findUnique: jest.Mock };
    currency: { findUnique: jest.Mock };
    supplierOfferItem: { findMany: jest.Mock };
    financialProposal: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    financialProposalItem: { update: jest.Mock };
    financialProposalPriceChangeRequest: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    technicalProposal: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    technicalProposalItem: { update: jest.Mock };
    inquiryItem: { findUnique: jest.Mock };
    ourEntity: { findUnique: jest.Mock };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
}

const BASELINE_SELECTION_STATE = {
  locked: true,
  items: [
    {
      id: "item-1",
      rowIndex: 1,
      itemCode: "BRG-6205",
      description: "بلبرینگ",
      quantity: 10,
      measurementUnit: "عدد",
      selectedOfferItemId: "offer-item-1",
      selectionNotes: null,
      markupPercent: 20,
      finalSalePrice: 12,
      offers: [
        {
          offerItemId: "offer-item-1",
          offerId: "offer-1",
          rfqNumber: "RFQ-2026-0001",
          supplier: { id: "s1", companyName: "Schaeffler Group" },
          price: 10,
          effectivePrice: 10,
          currencyCode: "EUR",
          deliveryTimeDays: 30,
          partNumber: "PN1",
          isEquivalent: false,
          distributeCosts: false,
        },
      ],
    },
  ],
  deliveryOptions: [
    { deliveryTerm: "EXW", extraCost: 0, deliveryDays: 45 },
    { deliveryTerm: "CPT", extraCost: 180, deliveryDays: 58 },
  ],
  totalsByCurrency: { EUR: 120 },
};

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const selection = { getSelection: jest.fn().mockResolvedValue(BASELINE_SELECTION_STATE) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  // ourEntity.findUnique پیش‌فرض null برمی‌گرده (buildPrisma) پس resolveOurEntity هم null می‌شه و
  // proposalNumber.nextNumber اصلاً صدا زده نمی‌شه — یک mock ساده کافیه، نیازی به پیاده‌سازی واقعی نیست
  const proposalNumber = { nextNumber: jest.fn().mockResolvedValue("2026-XX-0001") };
  const service = new ProposalService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    selection as unknown as SelectionService,
    notifications as unknown as NotificationsService,
    proposalNumber as unknown as ProposalNumberService,
  );
  return { service, activityLog, selection, notifications, proposalNumber };
}

function mockLockedInquiry(prisma: ReturnType<typeof buildPrisma>) {
  prisma.inquiry.findUnique.mockResolvedValue({
    id: INQUIRY_ID,
    internalNumber: "INQ-2026-0001",
    managerNoteToSales: null,
    selectionLockedAt: new Date(),
    deletedAt: null,
  });
}

function autoCreate(prisma: ReturnType<typeof buildPrisma>) {
  prisma.financialProposal.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    const itemsCreate = (args.data.items as { create: Record<string, unknown>[] })?.create ?? [];
    return {
      id: "fp-new",
      ...args.data,
      items: itemsCreate.map((i, idx) => ({ id: `fpi-${idx}`, ...i })),
    };
  });
  prisma.technicalProposal.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    const itemsCreate = (args.data.items as { create: Record<string, unknown>[] })?.create ?? [];
    return {
      id: "tp-new",
      ...args.data,
      items: itemsCreate.map((i, idx) => ({ id: `tpi-${idx}`, ...i })),
    };
  });
}

describe("ProposalService — گیت قفل انتخاب نهایی", () => {
  it("rejects everything before selection is locked", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      internalNumber: "INQ-2026-0001",
      selectionLockedAt: null,
      deletedAt: null,
    });
    const { service } = buildService(prisma);

    await expect(service.getProposal(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFound for a missing/deleted inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.getProposal(INQUIRY_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProposalService — تولید خودکار نسخه ۱ (seed)", () => {
  it("seeds version 1 of both proposals from the selection baseline on first GET", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    autoCreate(prisma);
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    // ارزون‌ترین ترم (EXW، extraCost=0) پیش‌فرض انتخاب می‌شه
    expect(result.financial.chosenDeliveryTerm).toBe("EXW");
    expect(result.financial.deliveryDays).toBe(45);
    // ارز غالب بین آفرهای منتخب
    expect(result.financial.currencyCode).toBe("EUR");
    // قیمت پایه از فی مؤثر + markup/finalSalePrice پایه کپی می‌شه (در DB)، ولی هیچ‌وقت در پاسخ برنمی‌گرده
    expect(result.financial.items[0].finalSalePrice).toBe(12);
    expect(result.financial.items[0]).not.toHaveProperty("purchasePrice");
    // فاز ۳۵-ب: effectivePrice (قیمت خرید) هم در baselineItems نباید دیده بشه
    expect(result.baselineItems[0]).not.toHaveProperty("effectivePrice");
    // زمان تحویل فنی از مالی همگام می‌شه
    expect(result.technical.deliveryTimeEstimateDays).toBe(45);
  });

  it("فاز ۵۱: شماره پیشنهاد از طریق ProposalNumberService با شناسه استعلام (برای کد اختصاری مشتری) تولید می‌شه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "entity-1", shortCode: "پ ت", calendarType: "jalali" });
    autoCreate(prisma);
    const { service, proposalNumber } = buildService(prisma);

    await service.getProposal(INQUIRY_ID);

    expect(proposalNumber.nextNumber).toHaveBeenCalledWith(prisma, INQUIRY_ID);
  });

  it("rejects seeding when no item has a selected offer", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    const { service, selection } = buildService(prisma);
    selection.getSelection.mockResolvedValue({ ...BASELINE_SELECTION_STATE, items: [] });

    await expect(service.getProposal(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects seeding when no delivery option exists yet", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    const { service, selection } = buildService(prisma);
    selection.getSelection.mockResolvedValue({ ...BASELINE_SELECTION_STATE, deliveryOptions: [] });

    await expect(service.getProposal(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("surfaces a non-blocking currency-mismatch warning", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    autoCreate(prisma);
    const { service } = buildService(prisma); // baseline currency EUR → seeded proposal currency EUR too, so force mismatch:
    prisma.financialProposal.create.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => ({
      id: "fp-new",
      ...args.data,
      currencyCode: "USD", // شبیه‌سازی نسخه‌ای که کارشناس ارزش رو دستی به USD عوض کرده
      items: (args.data.items as { create: Record<string, unknown>[] }).create.map((i, idx) => ({
        id: `fpi-${idx}`,
        ...i,
      })),
    }));

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.financial.currencyWarnings).toHaveLength(1);
    expect(result.financial.currencyWarnings[0]).toContain("EUR");
  });

  it("فاز ۴۴: وقتی آفر تأمین‌کننده technicalSpecs داره، description در baselineItems اونو نشون می‌ده نه شرح استعلام", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", technicalSpecs: "IP65، بلبرینگ SKF اصل آلمان", countryOfOrigin: null, isEquivalent: false, partNumber: null },
    ]);
    autoCreate(prisma);
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.baselineItems[0].description).toBe("IP65، بلبرینگ SKF اصل آلمان");
    expect(result.baselineItems[0].description).not.toBe("بلبرینگ");
  });

  it("فاز ۴۴: وقتی آفر تأمین‌کننده technicalSpecs خالی/نداره، description به شرح خودِ استعلام fallback می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", technicalSpecs: "   ", countryOfOrigin: null, isEquivalent: false, partNumber: null },
    ]);
    autoCreate(prisma);
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.baselineItems[0].description).toBe("بلبرینگ");
  });

  it("فاز ۵۵: وقتی آفر تأمین‌کننده برند دارد، builder در baselineItems همون برند تأمین‌کننده رو نشون می‌ده", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", technicalSpecs: null, countryOfOrigin: null, isEquivalent: false, partNumber: null, builder: "Siemens" },
    ]);
    autoCreate(prisma);
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.baselineItems[0].builder).toBe("Siemens");
  });

  it("فاز ۵۵: وقتی آفر تأمین‌کننده برندی وارد نکرده، builder به برند خودِ استعلام fallback می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    prisma.technicalProposal.findFirst.mockResolvedValue(null);
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", technicalSpecs: null, countryOfOrigin: null, isEquivalent: false, partNumber: null, builder: null },
    ]);
    const { service, selection } = buildService(prisma);
    selection.getSelection.mockResolvedValue({
      ...BASELINE_SELECTION_STATE,
      items: [{ ...BASELINE_SELECTION_STATE.items[0], builder: "SKF" }],
    });
    autoCreate(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.baselineItems[0].builder).toBe("SKF");
  });
});

describe("ProposalService — ویرایش/ارسال/اصلاح مستقل هر نسخه", () => {
  const CURRENT_FINANCIAL = {
    id: "fp-1",
    proposalNumber: "INQ-2026-0001-FIN-v1",
    version: 1,
    status: "current",
    preparedDate: new Date(),
    currencyCode: "EUR",
    chosenDeliveryTerm: "EXW",
    deliveryDays: 45,
    incotermLocation: null,
    shippingMethod: null,
    paymentTerms: null,
    proposalValidityDate: null,
    negotiationNote: null,
    fileUrl: null,
    sentAt: null as Date | null,
    ourEntityId: null,
    exchangeRateFromCurrency: null,
    exchangeRateToCurrency: null,
    exchangeRateValue: null,
    // فاز ۵۲ — این چهار فیلد در واقعیت همیشه از دیتابیس مقدار دارن (partialShipmentAllowed
    // NOT NULL DEFAULT true، documentsChecklist NOT NULL DEFAULT '{}') — دقیقاً همون چیزی که
    // formatFinancial باید بدون افتادن، سرجاش برگردونه (باگ واقعی که سایت رو کرش می‌کرد)
    paymentMethod: null,
    partialShipmentAllowed: true,
    documentsChecklist: [] as string[],
    serviceTest: null,
    serviceFieldService: null,
    serviceDesign: null,
    warrantyTerms: null,
    remarks: null,
    items: [{ id: "fpi-1", inquiryItemId: "item-1", purchasePrice: 10, markupPercent: 20, finalSalePrice: 12 }],
  };

  it("فاز ۵۲ (رگرسیون): getProposal فیلدهای تجاری جدید (چک‌لیست مدارک، روش پرداخت، ارسال جزئی، ...) رو از قلم نمی‌ندازه", async () => {
    // این دقیقاً همون باگی بود که در production باعث کرش صفحه «پیشنهاد به مشتری» شد:
    // formatFinancial این فیلدها رو map نمی‌کرد، پس مقدارشون در پاسخ API undefined می‌شد
    // و finDraft.documentsChecklist.includes(...) در فرانت با TypeError کرش می‌کرد
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({
      ...CURRENT_FINANCIAL,
      paymentMethod: "TT",
      partialShipmentAllowed: false,
      documentsChecklist: ["invoice_copy", "packing_list"],
      serviceTest: "N/A",
      warrantyTerms: "۱۲ ماه از تاریخ تحویل",
      remarks: "رنگ نقره‌ای طبق نمونه",
    });
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      sentAt: null,
      items: [],
      deliveryTimeEstimateDays: 45,
      chosenDeliveryTerm: null,
      incotermLocation: null,
      shippingMethod: null,
    });
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.financial.paymentMethod).toBe("TT");
    expect(result.financial.partialShipmentAllowed).toBe(false);
    expect(result.financial.documentsChecklist).toEqual(["invoice_copy", "packing_list"]);
    expect(result.financial.serviceTest).toBe("N/A");
    expect(result.financial.warrantyTerms).toBe("۱۲ ماه از تاریخ تحویل");
    expect(result.financial.remarks).toBe("رنگ نقره‌ای طبق نمونه");
  });

  it("rejects editing a financial draft that was already sent", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: new Date() });
    const { service } = buildService(prisma);

    await expect(
      service.saveFinancial(
        INQUIRY_ID,
        { chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "EUR", items: [] },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unknown currency code", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.saveFinancial(
        INQUIRY_ID,
        { chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "XXX", items: [] },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("فاز ۳۹: saveFinancial یک ourEntityId معتبر رو روی نسخه ذخیره می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "entity-2", shortCode: "GT" });
    prisma.technicalProposal.findFirst.mockResolvedValue({ id: "tp-1", sentAt: null, items: [], deliveryTimeEstimateDays: 45 });
    const { service } = buildService(prisma);

    await service.saveFinancial(
      INQUIRY_ID,
      { ourEntityId: "entity-2", chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "EUR", items: [] },
      "user-1",
    );

    expect(prisma.financialProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ourEntityId: "entity-2" }) }),
    );
  });

  it("فاز ۳۹: saveFinancial یک ourEntityId ناموجود رو رد می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.ourEntity.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.saveFinancial(
        INQUIRY_ID,
        { ourEntityId: "does-not-exist", chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "EUR", items: [] },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("فاز ۵۶: saveFinancial() واحد زمان تحویل (روز/هفته) رو ذخیره می‌کنه — قبلاً هیچ‌جا ذخیره نمی‌شد و سند همیشه به روز نشون می‌داد", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.technicalProposal.findFirst.mockResolvedValue({ id: "tp-1", sentAt: null, items: [], deliveryTimeEstimateDays: 45 });
    const { service } = buildService(prisma);

    await service.saveFinancial(
      INQUIRY_ID,
      { chosenDeliveryTerm: "CPT", deliveryDays: 21, deliveryDaysUnit: "week", currencyCode: "EUR", items: [] },
      "user-1",
    );

    expect(prisma.financialProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryDaysUnit: "week" }) }),
    );
  });

  it("فاز ۵۶: saveFinancial() وقتی واحد ارسال نشه، پیش‌فرض «day» ذخیره می‌شه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.technicalProposal.findFirst.mockResolvedValue({ id: "tp-1", sentAt: null, items: [], deliveryTimeEstimateDays: 45 });
    const { service } = buildService(prisma);

    await service.saveFinancial(
      INQUIRY_ID,
      { chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "EUR", items: [] },
      "user-1",
    );

    expect(prisma.financialProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryDaysUnit: "day" }) }),
    );
  });

  it("فاز ۵۴: سینک از مالی به فنی فقط Incoterm/روش حمل رو دست‌کاری می‌کنه — ترم/زمان تحویل فنی دیگه از مالی override نمی‌شه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      sentAt: null,
      items: [],
      deliveryTimeEstimateDays: 45,
      chosenDeliveryTerm: "EXW",
    });
    autoCreate(prisma); // اگه GET بعدش دوباره seed بخواد انجام بده هم بی‌خطر باشه
    const { service } = buildService(prisma);

    await service.saveFinancial(
      INQUIRY_ID,
      { chosenDeliveryTerm: "CPT", deliveryDays: 58, currencyCode: "EUR", items: [] },
      "user-1",
    );

    const call = prisma.technicalProposal.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "tp-1",
    );
    expect(call[0].data).not.toHaveProperty("chosenDeliveryTerm");
    expect(call[0].data).not.toHaveProperty("deliveryTimeEstimateDays");
    expect(call[0].data).toEqual({ incotermLocation: undefined, shippingMethod: undefined });
  });

  it("فاز ۵۴: saveTechnical() ترم/زمان تحویل مستقل خودش رو مستقیم ذخیره می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      sentAt: null,
      items: [{ id: "tpi-1", inquiryItemId: "item-1", technicalSpecs: null, complianceNote: null }],
    });
    const { service } = buildService(prisma);

    await service.saveTechnical(INQUIRY_ID, {
      chosenDeliveryTerm: "CPT",
      deliveryTimeEstimateDays: 58,
      items: [],
    } as never);

    expect(prisma.technicalProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tp-1" },
        data: expect.objectContaining({ chosenDeliveryTerm: "CPT", deliveryTimeEstimateDays: 58 }),
      }),
    );
  });

  it("فاز ۵۶: saveTechnical() واحد زمان تحویل (هفته) رو ذخیره می‌کنه، پیش‌فرض «day» وقتی ارسال نشه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      sentAt: null,
      items: [{ id: "tpi-1", inquiryItemId: "item-1", technicalSpecs: null, complianceNote: null }],
    });
    const { service } = buildService(prisma);

    await service.saveTechnical(INQUIRY_ID, {
      chosenDeliveryTerm: "CPT",
      deliveryTimeEstimateDays: 21,
      deliveryDaysUnit: "week",
      items: [],
    } as never);
    expect(prisma.technicalProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryDaysUnit: "week" }) }),
    );

    await service.saveTechnical(INQUIRY_ID, { chosenDeliveryTerm: "CPT", deliveryTimeEstimateDays: 58, items: [] } as never);
    expect(prisma.technicalProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryDaysUnit: "day" }) }),
    );
  });

  it("rejects sending a financial version twice", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: new Date() });
    const { service } = buildService(prisma);

    await expect(service.sendFinancial(INQUIRY_ID, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects revising a financial version that was never sent", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: null });
    const { service } = buildService(prisma);

    await expect(service.reviseFinancial(INQUIRY_ID, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("revise() supersedes the old version and creates version+1 as a fresh draft", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: new Date() });
    autoCreate(prisma);
    const { service, activityLog } = buildService(prisma);

    await service.reviseFinancial(INQUIRY_ID, "user-1");

    expect(prisma.financialProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "fp-1" }, data: { status: "superseded" } }),
    );
    expect(prisma.financialProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 2, status: "current" }),
      }),
    );
    expect(prisma.financialProposal.create.mock.calls[0][0].data.sentAt).toBeUndefined();
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: "financial_revised" }) }),
    );
  });

  it("فاز ۵۱: revise() با ارز جدید بدون exchangeRate رد می‌شه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: new Date() });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "IRR" });
    const { service } = buildService(prisma);

    await expect(
      service.reviseFinancial(INQUIRY_ID, "user-1", { newCurrencyCode: "IRR" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.financialProposal.create).not.toHaveBeenCalled();
  });

  it("فاز ۵۱: revise() با ارز و نرخ تبدیل، قیمت‌ها رو ضرب در نرخ می‌کنه و خود نرخ رو ذخیره می‌کنه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL, sentAt: new Date() });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "IRR" });
    autoCreate(prisma);
    const { service } = buildService(prisma);

    await service.reviseFinancial(INQUIRY_ID, "user-1", { newCurrencyCode: "IRR", exchangeRate: 65000 });

    expect(prisma.financialProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyCode: "IRR",
          exchangeRateFromCurrency: "EUR",
          exchangeRateToCurrency: "IRR",
          exchangeRateValue: 65000,
          items: {
            create: [
              expect.objectContaining({
                purchasePrice: 10 * 65000,
                finalSalePrice: 12 * 65000,
                markupPercent: 20,
              }),
            ],
          },
        }),
      }),
    );
  });

  it("financial and technical send independently — sending one doesn't touch the other", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      version: 1,
      sentAt: null,
      items: [],
    });
    // sendTechnical در پایان دوباره getProposal صدا می‌زنه — پیشنهاد مالی هم باید seed بشه
    prisma.financialProposal.findFirst.mockResolvedValue(null);
    autoCreate(prisma);
    const { service, activityLog } = buildService(prisma);

    await service.sendTechnical(INQUIRY_ID, "user-1");

    expect(prisma.technicalProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tp-1" }, data: { sentAt: expect.any(Date) } }),
    );
    expect(prisma.financialProposal.update).not.toHaveBeenCalled();
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: "technical_sent" }) }),
    );
  });

  it("فاز ۳۵-ج: قیمت زیر خط پایه مستقیم اعمال نمی‌شه — یک درخواست تأیید ساخته و به مدیریت اعلان می‌شه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...CURRENT_FINANCIAL });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.inquiryItem.findUnique.mockResolvedValue({ finalSalePrice: 12 }); // خط پایهٔ تعیین‌شدهٔ مدیریت
    prisma.financialProposalPriceChangeRequest.findFirst.mockResolvedValue(null); // بدون درخواست معلق قبلی
    prisma.financialProposalPriceChangeRequest.create.mockResolvedValue({
      id: "pcr-1",
      financialProposalItemId: "fpi-1",
      requestedPrice: 9,
    });
    prisma.financialProposalPriceChangeRequest.findMany.mockResolvedValue([
      { id: "pcr-1", financialProposalItemId: "fpi-1", requestedPrice: 9, status: "pending" },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "manager-1" }]);
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      sentAt: null,
      items: [],
      deliveryTimeEstimateDays: 45,
    });
    const { service, notifications } = buildService(prisma);

    const result = await service.saveFinancial(
      INQUIRY_ID,
      {
        chosenDeliveryTerm: "EXW",
        deliveryDays: 45,
        currencyCode: "EUR",
        items: [{ inquiryItemId: "item-1", finalSalePrice: 9 }],
      },
      "sales-1",
    );

    // قیمت مستقیماً روی رکورد اعمال نشده — فقط درخواست ساخته شده
    expect(prisma.financialProposalItem.update).not.toHaveBeenCalled();
    expect(prisma.financialProposalPriceChangeRequest.create).toHaveBeenCalledWith({
      data: { financialProposalItemId: "fpi-1", requestedPrice: 9, requestedBy: "sales-1" },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manager-1",
        type: "proposal_price_reduction_request",
        relatedEntityType: "proposal_price_change_request",
        relatedEntityId: "pcr-1",
        actions: [
          { label: "تأیید", action: "approve" },
          { label: "رد", action: "reject" },
        ],
      }),
    );
    // نشان «در انتظار تأیید مدیر» در پاسخ دیده بشه
    expect(result.financial.items[0]).toMatchObject({
      pendingPriceChangeRequestId: "pcr-1",
      pendingRequestedPrice: 9,
    });
  });

  it("decidePriceChangeRequest('approved', ...) قیمت درخواستی رو روی قلم پیشنهاد اعمال می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.financialProposalPriceChangeRequest.findUnique.mockResolvedValue({
      id: "pcr-1",
      financialProposalItemId: "fpi-1",
      requestedPrice: 9,
      requestedBy: "sales-1",
      status: "pending",
      item: {
        proposal: { inquiryId: INQUIRY_ID, proposalNumber: "INQ-2026-0001-FIN-v1", version: 1 },
        inquiryItem: { rowIndex: 1, itemCode: "BRG-6205" },
      },
    });
    const { service, notifications, activityLog } = buildService(prisma);

    const result = await service.decidePriceChangeRequest("pcr-1", "approved", "manager-1");

    expect(result).toEqual({ success: true });
    expect(prisma.financialProposalPriceChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "pcr-1" },
      data: { status: "approved", decidedBy: "manager-1", decidedAt: expect.any(Date) },
    });
    expect(prisma.financialProposalItem.update).toHaveBeenCalledWith({
      where: { id: "fpi-1" },
      data: { finalSalePrice: 9 },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "sales-1", type: "proposal_price_reduction_decided" }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: INQUIRY_ID,
        metadata: expect.objectContaining({ action: "price_reduction_approved" }),
      }),
    );
  });

  it("decidePriceChangeRequest('rejected', ...) قیمت رو دست‌نخورده می‌ذاره", async () => {
    const prisma = buildPrisma();
    prisma.financialProposalPriceChangeRequest.findUnique.mockResolvedValue({
      id: "pcr-1",
      financialProposalItemId: "fpi-1",
      requestedPrice: 9,
      requestedBy: "sales-1",
      status: "pending",
      item: {
        proposal: { inquiryId: INQUIRY_ID, proposalNumber: "INQ-2026-0001-FIN-v1", version: 1 },
        inquiryItem: { rowIndex: 1, itemCode: "BRG-6205" },
      },
    });
    const { service } = buildService(prisma);

    await service.decidePriceChangeRequest("pcr-1", "rejected", "manager-1");

    expect(prisma.financialProposalItem.update).not.toHaveBeenCalled();
    expect(prisma.financialProposalPriceChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) }),
    );
  });

  it("decidePriceChangeRequest rejects a request that was already decided", async () => {
    const prisma = buildPrisma();
    prisma.financialProposalPriceChangeRequest.findUnique.mockResolvedValue({
      id: "pcr-1",
      status: "approved",
      item: { proposal: { inquiryId: INQUIRY_ID }, inquiryItem: { rowIndex: 1 } },
    });
    const { service } = buildService(prisma);

    await expect(service.decidePriceChangeRequest("pcr-1", "approved", "manager-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("ProposalService — توزیع هزینه ترم تحویل بین اقلام (فاز ۵۳)", () => {
  // BASELINE_SELECTION_STATE: item-1 با quantity=10 و finalSalePrice=12 (subTotal=120)؛
  // deliveryOptions: EXW extraCost=0، CPT extraCost=180
  const FINANCIAL_WITH_CPT = {
    id: "fp-1",
    proposalNumber: "INQ-2026-0001-FIN-v1",
    version: 1,
    status: "current",
    preparedDate: new Date(),
    currencyCode: "EUR",
    chosenDeliveryTerm: "CPT",
    deliveryDays: 58,
    incotermLocation: null,
    shippingMethod: null,
    paymentTerms: null,
    proposalValidityDate: null,
    negotiationNote: null,
    fileUrl: null,
    sentAt: null as Date | null,
    ourEntityId: null,
    exchangeRateFromCurrency: null,
    exchangeRateToCurrency: null,
    exchangeRateValue: null,
    paymentMethod: null,
    partialShipmentAllowed: true,
    documentsChecklist: [] as string[],
    serviceTest: null,
    serviceFieldService: null,
    serviceDesign: null,
    warrantyTerms: null,
    remarks: null,
    items: [{ id: "fpi-1", inquiryItemId: "item-1", purchasePrice: 10, markupPercent: 20, finalSalePrice: 12 }],
  };

  it("getProposal(): وقتی ترم انتخابی extraCost داره، فی خام (finalSalePrice) دست‌نخورده می‌مونه ولی priceWithDelivery/totalAmountWithDelivery به‌نسبت افزایش پیدا می‌کنن", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue(FINANCIAL_WITH_CPT);
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      proposalNumber: "INQ-2026-0001-TEC-v1",
      version: 1,
      status: "current",
      preparedDate: new Date(),
      deliveryTimeEstimateDays: 58,
      chosenDeliveryTerm: "CPT",
      incotermLocation: null,
      shippingMethod: null,
      negotiationNote: null,
      fileUrl: null,
      sentAt: null,
      ourEntityId: null,
      items: [{ inquiryItemId: "item-1", technicalSpecs: null, complianceNote: null }],
    });
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.financial.deliveryExtraCost).toBe(180);
    expect(result.financial.totalAmount).toBe(120);
    expect(result.financial.totalAmountWithDelivery).toBe(300);
    // فی پایه‌ی قابل‌ویرایش دست‌نخورده می‌مونه — کارشناس فروش دقیقاً همون چیزی رو می‌بینه که تایپ کرده
    expect(result.financial.items[0].finalSalePrice).toBe(12);
    // ۱۲ + (۱۸۰ سهم کامل تک‌قلمی / ۱۰ تعداد) = ۳۰
    expect(result.financial.items[0].priceWithDelivery).toBe(30);
  });

  it("getProposal(): وقتی ترم انتخابی EXW (extraCost=۰) باشه، priceWithDelivery برابر finalSalePrice خام می‌مونه", async () => {
    const prisma = buildPrisma();
    mockLockedInquiry(prisma);
    prisma.financialProposal.findFirst.mockResolvedValue({ ...FINANCIAL_WITH_CPT, chosenDeliveryTerm: "EXW", deliveryDays: 45 });
    prisma.technicalProposal.findFirst.mockResolvedValue({
      id: "tp-1",
      proposalNumber: "INQ-2026-0001-TEC-v1",
      version: 1,
      status: "current",
      preparedDate: new Date(),
      deliveryTimeEstimateDays: 45,
      chosenDeliveryTerm: "EXW",
      incotermLocation: null,
      shippingMethod: null,
      negotiationNote: null,
      fileUrl: null,
      sentAt: null,
      ourEntityId: null,
      items: [{ inquiryItemId: "item-1", technicalSpecs: null, complianceNote: null }],
    });
    const { service } = buildService(prisma);

    const result = await service.getProposal(INQUIRY_ID);

    expect(result.financial.deliveryExtraCost).toBe(0);
    expect(result.financial.totalAmountWithDelivery).toBe(120);
    expect(result.financial.items[0].priceWithDelivery).toBe(12);
  });

  it("getDocumentData('financial'): قیمت واحد/کل سند و totalAmount شامل هزینه توزیع‌شده‌ی ترم تحویل می‌شن", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      deletedAt: null,
      selectionLockedAt: new Date(),
      internalNumber: "INQ-2026-0001",
      inquiryNumber: "REF-1",
      buyer: { companyName: "مشتری" },
      buyerContact: null,
      salesExpert: { fullName: "کارشناس", fullNameEn: null, phone: null, mobile: null, email: null },
    });
    prisma.financialProposal.findFirst.mockResolvedValue(FINANCIAL_WITH_CPT);
    const { service } = buildService(prisma);

    const doc = await service.getDocumentData(INQUIRY_ID, "financial");

    expect(doc.kind).toBe("financial");
    expect(doc.items[0].unitPrice).toBe(30);
    expect(doc.items[0].totalPrice).toBe(300);
    expect(doc.totalAmount).toBe(300);
  });
});
