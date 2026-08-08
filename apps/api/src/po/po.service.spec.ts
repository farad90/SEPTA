import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { SelectionService } from "../selection/selection.service";
import { ActivitiesService } from "../activities/activities.service";
import { PoService } from "./po.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const SUPPLIER_1 = "22222222-2222-2222-2222-222222222222";
const SUPPLIER_2 = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ procurementOwnerId: "proc-1", salesExpertId: "sales-1" }) },
    order: { findFirst: jest.fn() },
    // فاز ۵۸ — advanceAfterAllPosIssued (Trigger #۶): پیش‌فرض «یک تأمین‌کننده متمایز، صفر PO صادرشده»
    // یعنی posIssued(0) < distinctSuppliers.length(1) همیشه true‌ست و Trigger زودهنگام return می‌کنه؛
    // تست‌های اختصاصی این Trigger این دو مقدار رو صریح override می‌کنن
    orderItem: { findMany: jest.fn().mockResolvedValue([{ supplierId: "placeholder" }]) },
    purchaseOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    poItem: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    supplierPayment: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    supplierRfq: { findFirst: jest.fn() },
    activity: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

const SELECTION_STATE = {
  items: [
    {
      id: "oitem-1",
      selectedOfferItemId: "oi-1",
      quantity: 10,
      offers: [{ offerItemId: "oi-1", effectivePrice: 10, currencyCode: "EUR", supplier: { id: SUPPLIER_1, companyName: "Schaeffler Group" } }],
    },
    {
      id: "oitem-2",
      selectedOfferItemId: "oi-2",
      quantity: 20,
      offers: [{ offerItemId: "oi-2", effectivePrice: 4, currencyCode: "USD", supplier: { id: SUPPLIER_2, companyName: "SKF Distribution" } }],
    },
  ],
};

const ORDER_ITEM_1 = {
  id: "oitem-1",
  supplierId: SUPPLIER_1,
  purchasePrice: 10,
  quantity: 10,
  supplier: { companyName: "Schaeffler Group" },
  inquiryItem: { rowIndex: 1, itemCode: "BRG-6205", description: "بلبرینگ", measurementUnit: "عدد" },
};
const ORDER_ITEM_2 = {
  id: "oitem-2",
  supplierId: SUPPLIER_2,
  purchasePrice: 4,
  quantity: 20,
  supplier: { companyName: "SKF Distribution" },
  inquiryItem: { rowIndex: 2, itemCode: "SEAL-45", description: "کاسه‌نمد", measurementUnit: "عدد" },
};
const ORDER_ROW = { id: "order-1", orderNumber: "ORD-2026-0001", items: [ORDER_ITEM_1, ORDER_ITEM_2] };

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const selection = { getSelection: jest.fn().mockResolvedValue(SELECTION_STATE) };
  const activities = {
    openStageActivity: jest.fn().mockResolvedValue({}),
    closeStageActivities: jest.fn().mockResolvedValue(0),
  };
  const service = new PoService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    selection as unknown as SelectionService,
    activities as unknown as ActivitiesService,
  );
  return { service, activityLog, selection, activities };
}

function mockBase(prisma: ReturnType<typeof buildPrisma>) {
  prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
  prisma.order.findFirst.mockResolvedValue(ORDER_ROW);
}

describe("PoService — ساخت PO", () => {
  it("rejects saving a PO for a supplier that has no items in the customer order", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    const { service } = buildService(prisma);

    await expect(service.savePo(INQUIRY_ID, "99999999-9999-9999-9999-999999999999", {}, "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates the PO deriving our_entity from the latest RFQ, po_number, and majority currency", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst
      .mockResolvedValueOnce(null) // بررسی وجود PO قبلی
      .mockResolvedValue({ id: "po-1", supplierId: SUPPLIER_1 }); // getSupplierGroup دنبالهٔ savePo
    prisma.supplierRfq.findFirst.mockResolvedValue({ ourEntityId: "entity-1" });
    prisma.poItem.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-2026-0001-SCH",
      ourEntityId: "entity-1",
      ourEntity: { id: "entity-1", entityName: "General Trading srl", shortCode: "GT" },
      currencyCode: "EUR",
      totalAmount: 100,
      issueDate: new Date(),
      deliveryDueDate: null,
      items: [],
      supplierPayments: [],
    });
    const { service, activityLog } = buildService(prisma);

    await service.savePo(INQUIRY_ID, SUPPLIER_1, {}, "user-1");

    expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierId: SUPPLIER_1,
          ourEntityId: "entity-1",
          currencyCode: "EUR", // فقط قلم قلم‌های همین تأمین‌کننده (EUR)، نه USD قلم تأمین‌کننده دیگه
          totalAmount: 100, // 10 * 10
          poNumber: expect.stringContaining("PO-"),
          items: { create: [expect.objectContaining({ orderItemId: "oitem-1", price: 10, quantity: 10 })] },
        }),
      }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: "created", supplierId: SUPPLIER_1 }) }),
    );
  });

  it("فاز ۵۸: صدور آخرین PO باقی‌مانده po_pending رو می‌بنده و shipping_in_progress رو با مالک تأمین باز می‌کنه", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "po-1", supplierId: SUPPLIER_1 });
    prisma.supplierRfq.findFirst.mockResolvedValue({ ourEntityId: "entity-1" });
    prisma.poItem.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-2026-0001-SCH",
      ourEntityId: "entity-1",
      ourEntity: { id: "entity-1", entityName: "General Trading srl", shortCode: "GT" },
      currencyCode: "EUR",
      totalAmount: 100,
      issueDate: new Date(),
      deliveryDueDate: null,
      items: [],
      supplierPayments: [],
    });
    // دو تأمین‌کننده متمایز در سفارش، و همین الان دومین (آخرین) PO صادر شد
    prisma.orderItem.findMany.mockResolvedValue([{ supplierId: SUPPLIER_1 }, { supplierId: SUPPLIER_2 }]);
    prisma.purchaseOrder.count.mockResolvedValue(2);
    const { service, activities } = buildService(prisma);

    await service.savePo(INQUIRY_ID, SUPPLIER_1, {}, "user-1");

    expect(activities.closeStageActivities).toHaveBeenCalledWith(INQUIRY_ID, "po_pending", "user-1");
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: INQUIRY_ID,
        stageCode: "shipping_in_progress",
        assignedToUserId: "proc-1",
        extraWatcherUserIds: ["sales-1"],
      }),
    );
  });

  it("فاز ۵۸: صدور PO وقتی تأمین‌کننده دیگه‌ای هنوز PO نداره، shipping_in_progress رو باز نمی‌کنه", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "po-1", supplierId: SUPPLIER_1 });
    prisma.supplierRfq.findFirst.mockResolvedValue({ ourEntityId: "entity-1" });
    prisma.poItem.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-2026-0001-SCH",
      ourEntityId: "entity-1",
      ourEntity: { id: "entity-1", entityName: "General Trading srl", shortCode: "GT" },
      currencyCode: "EUR",
      totalAmount: 100,
      issueDate: new Date(),
      deliveryDueDate: null,
      items: [],
      supplierPayments: [],
    });
    prisma.orderItem.findMany.mockResolvedValue([{ supplierId: SUPPLIER_1 }, { supplierId: SUPPLIER_2 }]);
    prisma.purchaseOrder.count.mockResolvedValue(1); // فقط همین یکی صادر شده، دومی هنوز نه
    const { service, activities } = buildService(prisma);

    await service.savePo(INQUIRY_ID, SUPPLIER_1, {}, "user-1");

    expect(activities.openStageActivity).not.toHaveBeenCalled();
  });

  it("rejects a duplicate PO number with ConflictException", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    prisma.supplierRfq.findFirst.mockResolvedValue({ ourEntityId: "entity-1" });
    prisma.purchaseOrder.create.mockRejectedValue({ code: "P2002" });
    const { service } = buildService(prisma);

    await expect(service.savePo(INQUIRY_ID, SUPPLIER_1, { poNumber: "PO-DUP" }, "user-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("rejects creating a PO when no our_entity can be derived and none was provided", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    prisma.supplierRfq.findFirst.mockResolvedValue(null); // هیچ RFQ‌ای برای این تأمین‌کننده نبوده
    const { service } = buildService(prisma);

    await expect(service.savePo(INQUIRY_ID, SUPPLIER_1, {}, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("PoService — گروه‌بندی و هم‌رسانی", () => {
  it("groups customer order items into one entry per distinct supplier", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue(null); // هیچ PO‌ای هنوز ساخته نشده
    prisma.supplierRfq.findFirst.mockResolvedValue({ ourEntityId: "entity-1" });
    const { service } = buildService(prisma);

    const groups = await service.getPurchaseOrders(INQUIRY_ID);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.supplierId).sort()).toEqual([SUPPLIER_1, SUPPLIER_2].sort());
    expect(groups.every((g) => g.exists === false)).toBe(true);
  });

  it("adds a newly-added order item and removes a stale one without touching existing PO items", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue({ id: "po-1", supplierId: SUPPLIER_1 });
    prisma.poItem.findMany
      .mockResolvedValueOnce([
        { id: "poi-stale", orderItemId: "oitem-stale" }, // دیگه در سفارش مشتری این تأمین‌کننده نیست
      ])
      .mockResolvedValueOnce([{ price: 10, quantity: 10 }]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1",
      ourEntityId: "entity-1",
      ourEntity: { id: "entity-1", entityName: "General Trading srl", shortCode: "GT" },
      currencyCode: "EUR",
      totalAmount: 100,
      issueDate: new Date(),
      deliveryDueDate: null,
      items: [],
      supplierPayments: [],
    });
    const { service } = buildService(prisma);

    await service.getSupplierGroup(INQUIRY_ID, SUPPLIER_1);

    expect(prisma.poItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["poi-stale"] } } });
    expect(prisma.poItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderItemId: "oitem-1", price: 10, quantity: 10 })],
    });
  });
});

describe("PoService — پرداخت به تأمین‌کننده", () => {
  it("rejects adding a payment before that supplier's PO exists", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.addPayment(INQUIRY_ID, SUPPLIER_1, { amount: 10 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("allows adding a blank payment row (amount defaults to 0)", async () => {
    const prisma = buildPrisma();
    mockBase(prisma);
    prisma.purchaseOrder.findFirst.mockResolvedValue({ id: "po-1", supplierId: SUPPLIER_1 });
    prisma.poItem.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1",
      ourEntityId: "entity-1",
      ourEntity: { id: "entity-1", entityName: "General Trading srl", shortCode: "GT" },
      currencyCode: "EUR",
      totalAmount: 0,
      issueDate: new Date(),
      deliveryDueDate: null,
      items: [],
      supplierPayments: [],
    });
    const { service } = buildService(prisma);

    await service.addPayment(INQUIRY_ID, SUPPLIER_1, {});

    expect(prisma.supplierPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 0, status: "unpaid" }) }),
    );
  });
});
