import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    financialProposal: { findMany: jest.fn().mockResolvedValue([]) },
    customerPayment: { findMany: jest.fn().mockResolvedValue([]) },
    supplierPayment: { findMany: jest.fn().mockResolvedValue([]) },
    inquiry: { findMany: jest.fn().mockResolvedValue([]) },
    supplierRfq: { groupBy: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new ReportsService(prisma as unknown as PrismaService);
}

describe("ReportsService — گزارش سفارشات و سود و زیان", () => {
  it("سود هر سفارش رو درست حساب می‌کنه و مبالغ رو فقط به تفکیک ارز جمع می‌زنه، نه بین ارزها", async () => {
    const prisma = buildPrisma({
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "order-1",
            orderNumber: "ORD-2026-0001",
            inquiryId: "inq-1",
            contractDate: new Date("2026-01-01"),
            inquiry: {
              id: "inq-1",
              internalNumber: "INQ-2026-0001",
              buyer: { companyName: "ذوب آهن اصفهان" },
              salesExpert: { fullName: "سارا رضایی" },
            },
            items: [
              { purchasePrice: "100", salePrice: "120", quantity: "2" }, // margin 40
            ],
          },
          {
            id: "order-2",
            orderNumber: "ORD-2026-0002",
            inquiryId: "inq-2",
            contractDate: new Date("2026-01-05"),
            inquiry: {
              id: "inq-2",
              internalNumber: "INQ-2026-0002",
              buyer: { companyName: "فولاد مبارکه" },
              salesExpert: { fullName: "علی احمدی" },
            },
            items: [
              { purchasePrice: "50", salePrice: "60", quantity: "10" }, // margin 100
            ],
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      financialProposal: {
        findMany: jest.fn().mockResolvedValue([
          { inquiryId: "inq-1", currencyCode: "EUR" },
          { inquiryId: "inq-2", currencyCode: "USD" },
        ]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getOrdersPnl({});

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      orderNumber: "ORD-2026-0001",
      currencyCode: "EUR",
      totalPurchase: 200,
      totalSale: 240,
      margin: 40,
      marginPercent: 20,
    });
    expect(result.items[1]).toMatchObject({
      orderNumber: "ORD-2026-0002",
      currencyCode: "USD",
      totalPurchase: 500,
      totalSale: 600,
      margin: 100,
    });
    // ⚠️ هیچ ارزی نباید با ارز دیگه جمع بشه
    expect(result.totalsByCurrency).toEqual({
      EUR: { totalPurchase: 200, totalSale: 240, margin: 40 },
      USD: { totalPurchase: 500, totalSale: 600, margin: 100 },
    });
  });

  it("وقتی هیچ پیشنهاد مالی جاری‌ای برای استعلام نباشه، ارز null برمی‌گرده و زیر کلید «نامشخص» جمع می‌شه", async () => {
    const prisma = buildPrisma({
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "order-1",
            orderNumber: "ORD-2026-0001",
            inquiryId: "inq-1",
            contractDate: new Date("2026-01-01"),
            inquiry: {
              id: "inq-1",
              internalNumber: "INQ-2026-0001",
              buyer: { companyName: "ذوب آهن اصفهان" },
              salesExpert: { fullName: "سارا رضایی" },
            },
            items: [{ purchasePrice: "100", salePrice: "150", quantity: "1" }],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      financialProposal: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = buildService(prisma);

    const result = await service.getOrdersPnl({});

    expect(result.items[0].currencyCode).toBeNull();
    expect(result.totalsByCurrency["نامشخص"]).toEqual({ totalPurchase: 100, totalSale: 150, margin: 50 });
  });
});

describe("ReportsService — گزارش پرداختی‌ها و دریافتی‌ها", () => {
  it("پرداخت‌های مشتری و تأمین‌کننده رو نرمالایز و ترکیب می‌کنه، معوق‌ها رو تشخیص می‌ده، و جمع‌ها رو به تفکیک ارز/نوع/وضعیت حساب می‌کنه", async () => {
    const pastDue = new Date(Date.now() - 5 * 86_400_000);
    const futureDue = new Date(Date.now() + 5 * 86_400_000);

    const prisma = buildPrisma({
      customerPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "cp-1",
            dueDate: pastDue,
            amount: "1000",
            status: "unpaid",
            actualPaymentDate: null,
            order: { orderNumber: "ORD-1", inquiryId: "inq-1", inquiry: { buyer: { companyName: "خریدار الف" } } },
          },
          {
            id: "cp-2",
            dueDate: futureDue,
            amount: "500",
            status: "paid",
            actualPaymentDate: new Date(),
            order: { orderNumber: "ORD-2", inquiryId: "inq-1", inquiry: { buyer: { companyName: "خریدار الف" } } },
          },
        ]),
      },
      supplierPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sp-1",
            dueDate: futureDue,
            amount: "300",
            status: "unpaid",
            actualPaymentDate: null,
            po: { poNumber: "PO-1", currencyCode: "USD", supplier: { companyName: "تأمین‌کننده ب" } },
          },
        ]),
      },
      financialProposal: {
        findMany: jest.fn().mockResolvedValue([{ inquiryId: "inq-1", currencyCode: "EUR" }]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getPayments({});

    expect(result.items).toHaveLength(3);
    const receivableOverdue = result.items.find((r: { id: string }) => r.id === "cp-1");
    expect(receivableOverdue).toMatchObject({ type: "receivable", currencyCode: "EUR", isOverdue: true });
    const receivablePaid = result.items.find((r: { id: string }) => r.id === "cp-2");
    expect(receivablePaid).toMatchObject({ type: "receivable", isOverdue: false });
    const payable = result.items.find((r: { id: string }) => r.id === "sp-1");
    expect(payable).toMatchObject({ type: "payable", currencyCode: "USD", isOverdue: false });

    // مرتب‌شده بر اساس سررسید — cp-1 (گذشته) باید اول باشه
    expect(result.items[0].id).toBe("cp-1");

    expect(result.totalsByCurrency).toEqual({
      EUR: { receivableUnpaid: 1000, receivablePaid: 500, payableUnpaid: 0, payablePaid: 0 },
      USD: { receivableUnpaid: 0, receivablePaid: 0, payableUnpaid: 300, payablePaid: 0 },
    });
  });

  it("با overdueOnly=true فقط ردیف‌های معوق برمی‌گردن", async () => {
    const pastDue = new Date(Date.now() - 5 * 86_400_000);
    const prisma = buildPrisma({
      customerPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "cp-1",
            dueDate: pastDue,
            amount: "1000",
            status: "unpaid",
            actualPaymentDate: null,
            order: { orderNumber: "ORD-1", inquiryId: "inq-1", inquiry: { buyer: { companyName: "خریدار الف" } } },
          },
          {
            id: "cp-2",
            dueDate: pastDue,
            amount: "200",
            status: "paid",
            actualPaymentDate: new Date(),
            order: { orderNumber: "ORD-2", inquiryId: "inq-1", inquiry: { buyer: { companyName: "خریدار الف" } } },
          },
        ]),
      },
      financialProposal: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = buildService(prisma);

    const result = await service.getPayments({ type: "receivable", overdueOnly: "true" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("cp-1");
    expect(prisma.supplierPayment.findMany).not.toHaveBeenCalled();
  });
});

describe("ReportsService — گزارش تبدیل استعلام به سفارش", () => {
  it("نرخ تبدیل رو فقط از پرونده‌های بسته‌شده (برد/باخت/برد جزئی) حساب می‌کنه", async () => {
    const prisma = buildPrisma({
      inquiry: {
        findMany: jest.fn().mockResolvedValue([
          { status: "won", salesExpertId: "u1", salesExpert: { fullName: "سارا رضایی" } },
          { status: "won", salesExpertId: "u1", salesExpert: { fullName: "سارا رضایی" } },
          { status: "lost", salesExpertId: "u1", salesExpert: { fullName: "سارا رضایی" } },
          { status: "partially_won", salesExpertId: "u1", salesExpert: { fullName: "سارا رضایی" } },
          { status: "in_progress", salesExpertId: "u1", salesExpert: { fullName: "سارا رضایی" } },
          { status: "cancelled", salesExpertId: "u2", salesExpert: { fullName: "علی احمدی" } },
        ]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getConversion({});

    expect(result.overall).toMatchObject({
      total: 6,
      won: 2,
      lost: 1,
      partiallyWon: 1,
      cancelled: 1,
      suspended: 0,
      inProgress: 1,
    });
    // closedTotal = won(2)+lost(1)+partiallyWon(1) = 4 → (2+1)/4 = 75
    expect(result.overall.conversionRate).toBe(75);

    const sara = result.bySalesExpert.find((s: { salesExpertId: string }) => s.salesExpertId === "u1");
    expect(sara).toMatchObject({ total: 5, won: 2, lost: 1, partiallyWon: 1, inProgress: 1 });
    expect(sara?.conversionRate).toBe(75);

    const ali = result.bySalesExpert.find((s: { salesExpertId: string }) => s.salesExpertId === "u2");
    expect(ali).toMatchObject({ total: 1, cancelled: 1 });
    expect(ali?.conversionRate).toBeNull(); // هیچ پرونده بسته‌شده‌ای نداره
  });

  it("وقتی هیچ پرونده‌ای فیلتر نمی‌شه، نرخ تبدیل null برمی‌گرده (نه تقسیم بر صفر)", async () => {
    const prisma = buildPrisma({ inquiry: { findMany: jest.fn().mockResolvedValue([]) } });
    const service = buildService(prisma);

    const result = await service.getConversion({});

    expect(result.overall).toMatchObject({ total: 0, conversionRate: null });
    expect(result.bySalesExpert).toEqual([]);
  });
});

describe("ReportsService — مبلغ سفارشات خودِ کاربر (بدون قیمت خرید/سود)", () => {
  it("فقط سفارش‌های همون کارشناس فروش رو جمع می‌زنه و هرگز فیلد خرید/سود در خروجی نمی‌ذاره", async () => {
    const prisma = buildPrisma({
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            inquiryId: "inq-1",
            items: [{ salePrice: "120", quantity: "2" }], // 240
          },
          {
            inquiryId: "inq-2",
            items: [{ salePrice: "60", quantity: "10" }], // 600
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      financialProposal: {
        findMany: jest.fn().mockResolvedValue([
          { inquiryId: "inq-1", currencyCode: "EUR" },
          { inquiryId: "inq-2", currencyCode: "USD" },
        ]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getOwnSalesSummary("sales-expert-1");

    // فقط سفارش‌های همون salesExpertId باید Query بشن — فیلتر در سطح Prisma where اعمال می‌شه
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inquiry: expect.objectContaining({ salesExpertId: "sales-expert-1" }),
        }),
      }),
    );
    expect(result.orderCount).toBe(2);
    expect(result.totalsByCurrency).toEqual({ EUR: 240, USD: 600 });
    // ⚠️ هیچ فیلد خرید/سودی نباید در پاسخ باشه — محرمانگی قیمت خرید از فروش
    expect(result).not.toHaveProperty("totalPurchase");
    expect(result).not.toHaveProperty("margin");
  });

  it("وقتی سفارشی نباشه، آبجکت خالی برمی‌گرده نه خطا", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.getOwnSalesSummary("sales-expert-1");

    expect(result.orderCount).toBe(0);
    expect(result.totalsByCurrency).toEqual({});
  });
});

describe("ReportsService — نرخ پاسخ‌دهی تأمین‌کنندگان (RFQ)", () => {
  it("تعداد هر وضعیت رو می‌شمره و نرخ موفقیت رو فقط از بین RFQ های به‌سرانجام‌رسیده حساب می‌کنه", async () => {
    const prisma = buildPrisma({
      supplierRfq: {
        groupBy: jest.fn().mockResolvedValue([
          { status: "offer_received", _count: { _all: 6 } },
          { status: "no_response", _count: { _all: 2 } },
          { status: "technical_question", _count: { _all: 1 } },
          { status: "awaiting_response", _count: { _all: 3 } },
        ]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getRfqResponseRate();

    expect(result).toMatchObject({
      total: 12,
      offerReceived: 6,
      noResponse: 2,
      technicalQuestion: 1,
      awaitingResponse: 3,
    });
    // resolvedTotal = offerReceived(6) + noResponse(2) = 8 → 6/8 = 75
    expect(result.responseRate).toBe(75);
  });

  it("وقتی هیچ RFQ به‌سرانجام‌نرسیده (نه offer_received نه no_response)، نرخ null برمی‌گرده", async () => {
    const prisma = buildPrisma({
      supplierRfq: {
        groupBy: jest.fn().mockResolvedValue([{ status: "awaiting_response", _count: { _all: 4 } }]),
      },
    });
    const service = buildService(prisma);

    const result = await service.getRfqResponseRate();

    expect(result.total).toBe(4);
    expect(result.responseRate).toBeNull();
  });
});
