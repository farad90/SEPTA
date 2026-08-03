import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ShippingService } from "./shipping.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const PO_ID = "22222222-2222-2222-2222-222222222222";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn() },
    order: { findFirst: jest.fn() },
    purchaseOrder: { findMany: jest.fn() },
    productionTracking: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    productionTrackingLog: { create: jest.fn() },
    package: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    shipmentPackage: { findFirst: jest.fn(), findMany: jest.fn() },
    warehouseReceipt: { findFirst: jest.fn(), create: jest.fn() },
    warehouseReceiptItem: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
    orderItem: { findMany: jest.fn() },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new ShippingService(prisma as unknown as PrismaService);
}

function mockInquiryAndOrder(prisma: ReturnType<typeof buildPrisma>) {
  prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
  prisma.order.findFirst.mockResolvedValue({ id: "order-1" });
}

const TRACKING_ROW = {
  id: "track-1",
  poId: PO_ID,
  status: "in_production",
  estimatedReadyDate: null,
  pickupAddress: null,
  pickupPhone: null,
  pickupContactName: null,
  pickupContactEmail: null,
  pickupContactPhone: null,
  logs: [],
  po: { packages: [] },
};

describe("ShippingService — گیت پیش‌نیاز", () => {
  it("rejects when no customer order exists yet", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
    prisma.order.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.getProductionTracking(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when no PO has been issued yet", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    const service = buildService(prisma);

    await expect(service.getProductionTracking(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ShippingService — seed خودکار پیگیری تولید", () => {
  it("creates a production_tracking row (status=in_production) the first time a PO is seen", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { id: PO_ID, poNumber: "PO-1", supplier: { companyName: "Schaeffler Group" } },
    ]);
    prisma.productionTracking.findUnique
      .mockResolvedValueOnce(null) // getOrSeedTracking — هنوز وجود نداره
      .mockResolvedValue(TRACKING_ROW); // formatEntry
    prisma.productionTracking.create.mockResolvedValue(TRACKING_ROW);
    const service = buildService(prisma);

    const result = await service.getProductionTracking(INQUIRY_ID);

    expect(prisma.productionTracking.create).toHaveBeenCalledWith({
      data: { poId: PO_ID, status: "in_production" },
    });
    expect(result[0].status).toBe("in_production");
    expect(result[0].supplierName).toBe("Schaeffler Group");
  });
});

describe("ShippingService — بسته‌بندی", () => {
  it("adds a blank package with auto-numbered name", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { id: PO_ID, poNumber: "PO-1", supplier: { companyName: "Schaeffler Group" } },
    ]);
    prisma.package.count.mockResolvedValue(2);
    prisma.productionTracking.findUnique.mockResolvedValue(TRACKING_ROW);
    const service = buildService(prisma);

    await service.addPackage(INQUIRY_ID, PO_ID);

    expect(prisma.package.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ poId: PO_ID, packageNumber: "بسته 3", weightKg: 0, status: "defining" }),
      }),
    );
  });

  it("allows the defining → ready_to_ship transition", async () => {
    const prisma = buildPrisma();
    prisma.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "defining",
      po: { orderId: "order-1", order: { inquiryId: INQUIRY_ID } },
    });
    mockInquiryAndOrder(prisma);
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { id: PO_ID, poNumber: "PO-1", supplier: { companyName: "Schaeffler Group" } },
    ]);
    prisma.productionTracking.findUnique.mockResolvedValue(TRACKING_ROW);
    const service = buildService(prisma);

    await service.updatePackage("pkg-1", { status: "ready_to_ship" });

    expect(prisma.package.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ready_to_ship" }) }),
    );
  });

  it("rejects reverting a ready_to_ship package back to defining", async () => {
    const prisma = buildPrisma();
    prisma.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "defining",
      po: { orderId: "order-1", order: { inquiryId: INQUIRY_ID } },
    });
    const service = buildService(prisma);

    await expect(service.updatePackage("pkg-1", { status: "defining" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects editing dimensions of an already ready_to_ship package", async () => {
    const prisma = buildPrisma();
    prisma.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "ready_to_ship",
      po: { orderId: "order-1", order: { inquiryId: INQUIRY_ID } },
    });
    const service = buildService(prisma);

    await expect(service.updatePackage("pkg-1", { weightKg: 12 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects deleting a ready_to_ship package", async () => {
    const prisma = buildPrisma();
    prisma.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "ready_to_ship",
      po: { order: { inquiryId: INQUIRY_ID } },
    });
    const service = buildService(prisma);

    await expect(service.deletePackage("pkg-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFound when the package doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.package.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.deletePackage("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ShippingService — دریافت کالا در انبار (تشخیص خودکار تک‌محموله، فاز ۱۲)", () => {
  it("rejects when no shipment has reached cleared yet", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.shipmentPackage.findMany.mockResolvedValue([
      { shipment: { id: "shp-1", shipmentNumber: "SHP-2026-0001", stage: "in_transit" } },
    ]);
    const service = buildService(prisma);

    await expect(service.getWarehouseReceipt(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the inquiry's POs are spread across multiple cleared shipments", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.shipmentPackage.findMany.mockResolvedValue([
      { shipment: { id: "shp-1", shipmentNumber: "SHP-2026-0001", stage: "cleared" } },
      { shipment: { id: "shp-2", shipmentNumber: "SHP-2026-0002", stage: "cleared" } },
    ]);
    const service = buildService(prisma);

    await expect(service.getWarehouseReceipt(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("auto-seeds warehouse_receipts when exactly one cleared shipment is found", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.shipmentPackage.findMany.mockResolvedValue([
      { shipment: { id: "shp-1", shipmentNumber: "SHP-2026-0001", stage: "cleared" } },
    ]);
    prisma.warehouseReceipt.findFirst.mockResolvedValue(null);
    prisma.warehouseReceipt.create.mockResolvedValue({ id: "wr-1", shipmentId: "shp-1" });
    prisma.orderItem.findMany.mockResolvedValue([
      {
        inquiryItemId: "item-1",
        quantity: "10",
        inquiryItem: { id: "item-1", itemCode: "BRG", description: "بلبرینگ", measurementUnit: "عدد" },
      },
    ]);
    prisma.warehouseReceiptItem.findMany.mockResolvedValue([]);
    const service = buildService(prisma);

    const result = await service.getWarehouseReceipt(INQUIRY_ID);

    expect(prisma.warehouseReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shipmentId: "shp-1", receiptNumber: "WR-SHP-2026-0001" }) }),
    );
    expect(result.shipmentNumber).toBe("SHP-2026-0001");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].receivedQuantity).toBeNull();
  });
});
