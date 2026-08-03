import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SettlementService } from "./settlement.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const ORDER_ID = "22222222-2222-2222-2222-222222222222";
const INVOICE_ID = "33333333-3333-3333-3333-333333333333";
const ITEM_ID = "44444444-4444-4444-4444-444444444444";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn() },
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
  return new SettlementService(prisma as unknown as PrismaService);
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
    const service = buildService(prisma);

    await expect(
      service.upsertInvoice(INQUIRY_ID, { invoiceNumber: "INV-01", issueDate: "2026-07-10" }),
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
    const service = buildService(prisma);

    await service.upsertInvoice(INQUIRY_ID, { invoiceNumber: "INV-01", issueDate: "2026-07-10" });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: ORDER_ID, invoiceNumber: "INV-01" }) }),
    );
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
    const service = buildService(prisma);

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
    const service = buildService(prisma);

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
    const service = buildService(prisma);

    await expect(service.deleteInvoiceItem("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SettlementService — پیگیری وصول قبل از فاکتور", () => {
  it("returns an empty list when no invoice exists yet", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.invoice.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    const result = await service.listCollections(INQUIRY_ID);

    expect(result).toEqual([]);
  });

  it("rejects adding a collection row before an invoice exists", async () => {
    const prisma = buildPrisma();
    mockInquiryAndOrder(prisma);
    prisma.invoice.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.addCollection(INQUIRY_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});
