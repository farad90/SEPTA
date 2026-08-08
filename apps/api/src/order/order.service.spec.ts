import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { SelectionService } from "../selection/selection.service";
import { OrderService } from "./order.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "99999999-9999-9999-9999-999999999999";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    orderItem: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    customerPayment: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    issuedGuarantee: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    inquiryItemOutcome: { findMany: jest.fn() },
    financialProposal: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

const SELECTION_STATE = {
  items: [
    {
      id: "item-1",
      rowIndex: 1,
      itemCode: "BRG-6205",
      description: "بلبرینگ",
      quantity: 10,
      measurementUnit: "عدد",
      selectedOfferItemId: "offer-item-1",
      finalSalePrice: 12,
      offers: [
        {
          offerItemId: "offer-item-1",
          effectivePrice: 10,
          supplier: { id: "supplier-1", companyName: "Schaeffler Group" },
        },
      ],
    },
    {
      id: "item-2",
      rowIndex: 2,
      itemCode: "SEAL-45",
      description: "کاسه‌نمد",
      quantity: 20,
      measurementUnit: "عدد",
      selectedOfferItemId: "offer-item-2",
      finalSalePrice: 5,
      offers: [
        {
          offerItemId: "offer-item-2",
          effectivePrice: 4,
          supplier: { id: "supplier-2", companyName: "SKF Distribution" },
        },
      ],
    },
  ],
};

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const selection = { getSelection: jest.fn().mockResolvedValue(SELECTION_STATE) };
  const inquiries = { autoAssignFinanceOwner: jest.fn().mockResolvedValue(undefined) };
  const service = new OrderService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    selection as unknown as SelectionService,
    inquiries as unknown as InquiriesService,
  );
  return { service, activityLog, selection, inquiries };
}

function mockInquiry(prisma: ReturnType<typeof buildPrisma>) {
  prisma.inquiry.findUnique.mockResolvedValue({
    id: INQUIRY_ID,
    internalNumber: "INQ-2026-0001",
    deletedAt: null,
  });
}

describe("OrderService — ساخت سفارش", () => {
  it("rejects creating an order when there's no priceable won item", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.saveOrder(INQUIRY_ID, {}, "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates the order from the Selection baseline when no financial proposal exists, deriving the order number", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([{ inquiryItemId: "item-1" }]);
    prisma.order.findFirst
      .mockResolvedValueOnce(null) // بررسی وجود سفارش قبلی
      .mockResolvedValueOnce({ id: "order-1", inquiryId: INQUIRY_ID }); // getOrder دنبالهٔ saveOrder
    prisma.orderItem.findMany.mockResolvedValue([]);
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-2026-0001",
      contractNumber: null,
      contractDate: null,
      totalAmount: 0,
      deliveryDueDate: null,
      contractFileUrl: null,
      items: [],
      customerPayments: [],
      issuedGuarantees: [],
    });
    const { service, activityLog } = buildService(prisma);

    await service.saveOrder(INQUIRY_ID, {}, "user-1");

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: "ORD-2026-0001", // از internalNumber مشتق شده چون dto.orderNumber خالی بود
          items: {
            create: [
              expect.objectContaining({
                inquiryItemId: "item-1",
                supplierId: "supplier-1",
                purchasePrice: 10, // effectivePrice چون پیشنهاد مالی وجود نداره
                salePrice: 12, // finalSalePrice baseline
                quantity: 10,
              }),
            ],
          },
        }),
      }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: "created" }) }),
    );
  });

  it("maps a duplicate order number to ConflictException", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([{ inquiryItemId: "item-1" }]);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockRejectedValue({ code: "P2002" });
    const { service } = buildService(prisma);

    await expect(
      service.saveOrder(INQUIRY_ID, { orderNumber: "ORD-DUP" }, "user-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("OrderService — هم‌رسانی اقلام سفارش موجود", () => {
  it("adds a newly-won item, removes a no-longer-won item, and leaves existing rows untouched", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    // هر دو قلم الان won هستن
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([
      { inquiryItemId: "item-1" },
      { inquiryItemId: "item-2" },
    ]);
    prisma.order.findFirst.mockResolvedValue({ id: "order-1", inquiryId: INQUIRY_ID });
    prisma.orderItem.findMany
      .mockResolvedValueOnce([
        { id: "oi-stale", inquiryItemId: "item-3-stale" }, // دیگه won نیست → باید حذف بشه
        { id: "oi-1", inquiryItemId: "item-1", purchasePrice: 999, salePrice: 999, quantity: 999 }, // از قبل هست → نباید دست بخوره
      ])
      .mockResolvedValueOnce([
        { salePrice: 999, quantity: 999 },
        { salePrice: 5, quantity: 20 },
      ]);
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-2026-0001",
      contractNumber: null,
      contractDate: null,
      totalAmount: 998101,
      deliveryDueDate: null,
      contractFileUrl: null,
      items: [],
      customerPayments: [],
      issuedGuarantees: [],
    });
    const { service } = buildService(prisma);

    await service.getOrder(INQUIRY_ID);

    expect(prisma.orderItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["oi-stale"] } } });
    expect(prisma.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          inquiryItemId: "item-2",
          supplierId: "supplier-2",
          purchasePrice: 4,
          salePrice: 5,
          quantity: 20,
        }),
      ],
    });
    // item-1 هیچ‌وقت آپدیت نشد — فقط createMany برای item-2 صدا خورد
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 998101 }) }),
    );
  });
});

describe("OrderService — پرداخت‌ها و ضمانت‌نامه‌ها", () => {
  it("rejects adding a payment before an order exists", async () => {
    const prisma = buildPrisma();
    prisma.order.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.addPayment(INQUIRY_ID, { amount: 100 }, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("allows adding a blank payment row (amount defaults to 0) — UI creates blank rows and edits inline", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue({ id: "order-1", inquiryId: INQUIRY_ID });
    prisma.orderItem.findMany.mockResolvedValue([]);
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-2026-0001",
      contractNumber: null,
      contractDate: null,
      totalAmount: 0,
      deliveryDueDate: null,
      contractFileUrl: null,
      items: [],
      customerPayments: [],
      issuedGuarantees: [],
    });
    const { service, inquiries } = buildService(prisma);

    await service.addPayment(INQUIRY_ID, {}, USER_ID);

    expect(prisma.customerPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 0, status: "unpaid" }) }),
    );
    // فاز ۵۸ — اولین پرداخت مشتری هم می‌تونه اولین اقدام مالی این پرونده باشه
    expect(inquiries.autoAssignFinanceOwner).toHaveBeenCalledWith(INQUIRY_ID, USER_ID);
  });

  it("allows adding a blank guarantee row (type/amount default) — UI creates blank rows and edits inline", async () => {
    const prisma = buildPrisma();
    mockInquiry(prisma);
    prisma.inquiryItemOutcome.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue({ id: "order-1", inquiryId: INQUIRY_ID });
    prisma.orderItem.findMany.mockResolvedValue([]);
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-2026-0001",
      contractNumber: null,
      contractDate: null,
      totalAmount: 0,
      deliveryDueDate: null,
      contractFileUrl: null,
      items: [],
      customerPayments: [],
      issuedGuarantees: [],
    });
    const { service } = buildService(prisma);

    await service.addGuarantee(INQUIRY_ID, {});

    expect(prisma.issuedGuarantee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guaranteeType: "advance_payment", amount: 0, status: "active" }),
      }),
    );
  });
});
