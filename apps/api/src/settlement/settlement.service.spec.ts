import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { ActivitiesService } from "../activities/activities.service";
import { SettlementService } from "./settlement.service";

const USER_ID = "99999999-9999-9999-9999-999999999999";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const ORDER_ID = "22222222-2222-2222-2222-222222222222";
const INVOICE_ID = "33333333-3333-3333-3333-333333333333";
const ITEM_ID = "44444444-4444-4444-4444-444444444444";

function buildPrisma() {
  return {
    inquiry: {
      findUnique: jest.fn(),
      // فاز ۵۸ — advanceToInvoicingPending/advanceToCollectionPending (Trigger #۸/#۹)
      findUniqueOrThrow: jest.fn().mockResolvedValue({ salesExpertId: "sales-1", financeOwnerId: "finance-1" }),
    },
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    financialProposal: { findFirst: jest.fn() },
    delivery: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    invoice: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    invoiceItem: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    invoiceCollection: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    currency: { findFirst: jest.fn() },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const inquiries = { autoAssignFinanceOwner: jest.fn().mockResolvedValue(undefined) };
  const activities = {
    openStageActivity: jest.fn().mockResolvedValue({}),
    closeStageActivities: jest.fn().mockResolvedValue(0),
  };
  const service = new SettlementService(
    prisma as unknown as PrismaService,
    inquiries as unknown as InquiriesService,
    activities as unknown as ActivitiesService,
  );
  return { service, inquiries, activities };
}

function mockInquiryAndOrder(prisma: ReturnType<typeof buildPrisma>) {
  prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
  prisma.order.findFirst.mockResolvedValue({ id: ORDER_ID });
}

describe("SettlementService — قفل صدور فاکتور تا تایید مشتری", () => {
  it("rejects issuing an invoice before customer acceptance", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.delivery.findFirst.mockResolvedValue({ customerAcceptanceStatus: "pending" });
    const { service } = buildService(prisma);

    await expect(
      service.upsertInvoice(INQUIRY_ID, { invoiceNumber: "INV-01", issueDate: "2026-07-10" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows issuing an invoice once accepted", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.delivery.findFirst.mockResolvedValue({ customerAcceptanceStatus: "accepted" });
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.invoice.create.mockResolvedValue({ id: INVOICE_ID });
    prisma.order.findUnique.mockResolvedValue({ totalAmount: "1000" });
    prisma.financialProposal.findFirst.mockResolvedValue({ currencyCode: "EUR" });
    const { service, inquiries, activities } = buildService(prisma);

    await service.upsertInvoice(
      INQUIRY_ID,
      { invoiceNumber: "INV-01", issueDate: "2026-07-10", paymentDeadline: "2026-08-10" },
      USER_ID,
    );

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: ORDER_ID, invoiceNumber: "INV-01" }) }),
    );
    // فاز ۵۸ — Trigger #۹: اولین فاکتور → مالک مالی auto-assign (idempotent اگه قبلاً پر شده) +
    // بستن invoicing_pending + باز کردن collection_pending با مهلت پرداخت واقعی فاکتور
    expect(inquiries.autoAssignFinanceOwner).toHaveBeenCalledWith(INQUIRY_ID, USER_ID);
    expect(activities.closeStageActivities).toHaveBeenCalledWith(INQUIRY_ID, "invoicing_pending", USER_ID);
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: INQUIRY_ID,
        stageCode: "collection_pending",
        assignedToUserId: "finance-1",
        dueAt: new Date("2026-08-10"),
      }),
    );
  });
});

describe("SettlementService — تحویل و Trigger #۸ (فاز ۵۸)", () => {
  it("گذار واقعی به accepted، delivery_pending رو می‌بنده و invoicing_pending رو باز می‌کنه", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.delivery.findFirst.mockResolvedValue({ id: "delivery-1", customerAcceptanceStatus: "pending" });
    prisma.delivery.update.mockResolvedValue({
      customerAcceptanceStatus: "accepted",
      actualDeliveryDate: new Date(),
      deliveryMethod: null,
      recipientName: null,
      deliveryReceiptFileUrl: null,
      customerAcceptanceDate: new Date(),
    });
    const { service, activities } = buildService(prisma);

    await service.updateDelivery(INQUIRY_ID, { customerAcceptanceStatus: "accepted" }, USER_ID);

    expect(activities.closeStageActivities).toHaveBeenCalledWith(INQUIRY_ID, "delivery_pending", USER_ID);
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryId: INQUIRY_ID, stageCode: "invoicing_pending", assignedToUserId: "finance-1" }),
    );
  });

  it("وقتی از قبل هم accepted بوده (بدون گذار واقعی)، Activity ای باز نمی‌کنه", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.delivery.findFirst.mockResolvedValue({ id: "delivery-1", customerAcceptanceStatus: "accepted" });
    prisma.delivery.update.mockResolvedValue({
      customerAcceptanceStatus: "accepted",
      actualDeliveryDate: new Date(),
      deliveryMethod: null,
      recipientName: null,
      deliveryReceiptFileUrl: null,
      customerAcceptanceDate: new Date(),
    });
    const { service, activities } = buildService(prisma);

    await service.updateDelivery(INQUIRY_ID, { recipientName: "علی" }, USER_ID);

    expect(activities.openStageActivity).not.toHaveBeenCalled();
  });
});

describe("SettlementService — بازمحاسبهٔ جمع فاکتور", () => {
  it("recomputes final_amount_irr after updating an item", async () => {
    const prisma = buildPrisma();
    prisma.invoiceItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      invoiceId: INVOICE_ID,
      amountCurrency: "100",
      exchangeRateValue: "500000",
      invoice: { orderId: ORDER_ID, order: { inquiryId: INQUIRY_ID } },
    });
    prisma.invoiceItem.findMany.mockResolvedValue([{ amountIrr: "50000000" }, { amountIrr: "10000000" }]);
    mockInquiryAndOrder(prisma);
    prisma.order.findUnique.mockResolvedValue({ totalAmount: "1000" });
    prisma.financialProposal.findFirst.mockResolvedValue({ currencyCode: "EUR" });
    prisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "INV-01",
      issueDate: new Date(),
      paymentDeadline: null,
      finalAmountIrr: "60000000",
      items: [],
    });
    const { service } = buildService(prisma);

    await service.updateInvoiceItem(ITEM_ID, { amountCurrency: 100 });

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: { finalAmountIrr: 60000000 },
    });
  });

  it("recomputes final_amount_irr after deleting an item", async () => {
    const prisma = buildPrisma();
    prisma.invoiceItem.findUnique.mockResolvedValue({
      id: ITEM_ID,
      invoiceId: INVOICE_ID,
      invoice: { orderId: ORDER_ID, order: { inquiryId: INQUIRY_ID } },
    });
    prisma.invoiceItem.findMany.mockResolvedValue([{ amountIrr: "10000000" }]);
    mockInquiryAndOrder(prisma);
    prisma.order.findUnique.mockResolvedValue({ totalAmount: "1000" });
    prisma.financialProposal.findFirst.mockResolvedValue({ currencyCode: "EUR" });
    prisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "INV-01",
      issueDate: new Date(),
      paymentDeadline: null,
      finalAmountIrr: "10000000",
      items: [],
    });
    const { service } = buildService(prisma);

    await service.deleteInvoiceItem(ITEM_ID);

    expect(prisma.invoiceItem.delete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: { finalAmountIrr: 10000000 },
    });
  });

  it("throws NotFound when the invoice item doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.invoiceItem.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.deleteInvoiceItem("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SettlementService — پیگیری وصول قبل از فاکتور", () => {
  it("returns an empty list when no invoice exists yet", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.invoice.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    const result = await service.listCollections(INQUIRY_ID);

    expect(result).toEqual([]);
  });

  it("rejects adding a collection row before an invoice exists", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.invoice.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.addCollection(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});
