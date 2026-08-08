import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { ActivitiesService } from "../activities/activities.service";
import { SaveCollectionDto, SaveInvoiceItemDto, UpdateDeliveryDto, UpsertInvoiceDto } from "./dto/settlement.dto";

/**
 * فاز ۱۲ — تب ۹ (تحویل و تسویه، دامنه ۷). یک Delivery و یک Invoice به‌ازای هر
 * سفارش (بدون Constraint دیتابیسی، مثل الگوی «یک Order برای هر پرونده» فاز ۸).
 * صدور/ویرایش فاکتور فقط بعد از customer_acceptance_status='accepted' مجازه.
 * final_amount_irr همیشه از SUM(invoice_items.amount_irr) سرور محاسبه می‌شه.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inquiries: InquiriesService,
    private readonly activities: ActivitiesService,
  ) {}

  // ------------------------------------------------------------
  // تحویل به مشتری
  // ------------------------------------------------------------

  async getDelivery(inquiryId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const delivery = await this.getOrSeedDelivery(orderId);
    return this.formatDelivery(delivery);
  }

  async updateDelivery(inquiryId: string, dto: UpdateDeliveryDto, currentUserId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const delivery = await this.getOrSeedDelivery(orderId);
    const wasAccepted = delivery.customerAcceptanceStatus === "accepted";
    const updated = await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        actualDeliveryDate: dto.actualDeliveryDate ? new Date(dto.actualDeliveryDate) : undefined,
        deliveryMethod: dto.deliveryMethod,
        recipientName: dto.recipientName,
        deliveryReceiptFileUrl: dto.deliveryReceiptFileUrl,
        customerAcceptanceDate: dto.customerAcceptanceDate ? new Date(dto.customerAcceptanceDate) : undefined,
        customerAcceptanceStatus: dto.customerAcceptanceStatus,
        updatedAt: new Date(),
      },
    });

    // فاز ۵۸ — Trigger #۸ (erp-database-design.md دامنه ۱۴): فقط روی گذار واقعی به accepted
    if (!wasAccepted && updated.customerAcceptanceStatus === "accepted") {
      await this.advanceToInvoicingPending(inquiryId, currentUserId);
    }

    return this.formatDelivery(updated);
  }

  // ------------------------------------------------------------
  // فاکتور نهایی
  // ------------------------------------------------------------

  async getInvoice(inquiryId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const [order, financial, invoice] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId }, select: { totalAmount: true } }),
      this.prisma.financialProposal.findFirst({
        where: { inquiryId, status: "current" },
        select: { currencyCode: true },
      }),
      this.prisma.invoice.findFirst({
        where: { orderId },
        include: {
          items: { include: { sourceCustomerPayment: { select: { paymentDescription: true } } } },
        },
      }),
    ]);

    return {
      orderTotalAmount: Number(order?.totalAmount ?? 0),
      orderTotalCurrency: financial?.currencyCode ?? null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            paymentDeadline: invoice.paymentDeadline,
            finalAmountIrr: Number(invoice.finalAmountIrr),
          }
        : null,
      items: (invoice?.items ?? []).map((i) => ({
        id: i.id,
        description: i.description,
        sourceCustomerPaymentId: i.sourceCustomerPaymentId,
        amountCurrency: Number(i.amountCurrency),
        currencyCode: i.currencyCode,
        exchangeRateDate: i.exchangeRateDate,
        exchangeRateValue: Number(i.exchangeRateValue),
        amountIrr: Number(i.amountIrr),
      })),
    };
  }

  async upsertInvoice(inquiryId: string, dto: UpsertInvoiceDto, currentUserId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    await this.assertAcceptanceComplete(orderId);

    const existing = await this.prisma.invoice.findFirst({ where: { orderId } });
    try {
      if (existing) {
        await this.prisma.invoice.update({
          where: { id: existing.id },
          data: {
            invoiceNumber: dto.invoiceNumber,
            issueDate: new Date(dto.issueDate),
            paymentDeadline: dto.paymentDeadline ? new Date(dto.paymentDeadline) : undefined,
          },
        });
      } else {
        await this.prisma.invoice.create({
          data: {
            orderId,
            invoiceNumber: dto.invoiceNumber,
            issueDate: new Date(dto.issueDate),
            paymentDeadline: dto.paymentDeadline ? new Date(dto.paymentDeadline) : undefined,
            finalAmountIrr: 0,
          },
        });

        // فاز ۵۸ — Trigger #۹: اولین فاکتور این سفارش. اگه هنوز کسی به‌عنوان مالک مالی ثبت
        // نشده (مثلاً هیچ پیش‌پرداختی هم قبلاً ثبت نشده)، همینجا خودکار پر می‌شه
        await this.inquiries.autoAssignFinanceOwner(inquiryId, currentUserId);
        await this.advanceToCollectionPending(inquiryId, currentUserId, dto.paymentDeadline);
      }
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("شماره فاکتور تکراریه");
      }
      throw err;
    }
    return this.getInvoice(inquiryId);
  }

  /** ردیف خالی — الگوی «افزودن ردیف خالی + ویرایش خطی» تثبیت‌شده */
  async addInvoiceItem(inquiryId: string, dto?: SaveInvoiceItemDto) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const invoice = await this.getInvoiceOrThrow(orderId);
    const financial = await this.prisma.financialProposal.findFirst({
      where: { inquiryId, status: "current" },
      select: { currencyCode: true },
    });
    const currencyCode =
      dto?.currencyCode ??
      financial?.currencyCode ??
      (await this.prisma.currency.findFirst({ where: { status: "active" } }))?.currencyCode;
    if (!currencyCode) {
      throw new BadRequestException("هیچ ارز فعالی در سیستم تعریف نشده");
    }

    const amountCurrency = dto?.amountCurrency ?? 0;
    const exchangeRateValue = dto?.exchangeRateValue ?? 0;
    await this.prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: dto?.description ?? "",
        sourceCustomerPaymentId: dto?.sourceCustomerPaymentId,
        amountCurrency,
        currencyCode,
        exchangeRateDate: dto?.exchangeRateDate ? new Date(dto.exchangeRateDate) : new Date(),
        exchangeRateValue,
        amountIrr: amountCurrency * exchangeRateValue,
      },
    });
    await this.recomputeInvoiceTotal(invoice.id);
    return this.getInvoice(inquiryId);
  }

  async updateInvoiceItem(itemId: string, dto: SaveInvoiceItemDto) {
    const item = await this.prisma.invoiceItem.findUnique({
      where: { id: itemId },
      include: { invoice: { select: { orderId: true, order: { select: { inquiryId: true } } } } },
    });
    if (!item) {
      throw new NotFoundException("ردیف فاکتور یافت نشد");
    }

    const amountCurrency = dto.amountCurrency ?? Number(item.amountCurrency);
    const exchangeRateValue = dto.exchangeRateValue ?? Number(item.exchangeRateValue);
    const amountIrr = amountCurrency * exchangeRateValue;

    await this.prisma.invoiceItem.update({
      where: { id: itemId },
      data: {
        description: dto.description,
        sourceCustomerPaymentId: dto.sourceCustomerPaymentId,
        amountCurrency: dto.amountCurrency,
        currencyCode: dto.currencyCode,
        exchangeRateDate: dto.exchangeRateDate ? new Date(dto.exchangeRateDate) : undefined,
        exchangeRateValue: dto.exchangeRateValue,
        amountIrr,
      },
    });
    await this.recomputeInvoiceTotal(item.invoiceId);
    return this.getInvoice(item.invoice.order.inquiryId);
  }

  async deleteInvoiceItem(itemId: string) {
    const item = await this.prisma.invoiceItem.findUnique({
      where: { id: itemId },
      include: { invoice: { select: { orderId: true, order: { select: { inquiryId: true } } } } },
    });
    if (!item) {
      throw new NotFoundException("ردیف فاکتور یافت نشد");
    }
    await this.prisma.invoiceItem.delete({ where: { id: itemId } });
    await this.recomputeInvoiceTotal(item.invoiceId);
    return this.getInvoice(item.invoice.order.inquiryId);
  }

  // ------------------------------------------------------------
  // پیگیری وصول
  // ------------------------------------------------------------

  async listCollections(inquiryId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const invoice = await this.prisma.invoice.findFirst({ where: { orderId } });
    if (!invoice) return [];
    const collections = await this.prisma.invoiceCollection.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: "asc" },
    });
    return collections.map((c) => this.formatCollection(c));
  }

  async addCollection(inquiryId: string, dto?: SaveCollectionDto) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const invoice = await this.getInvoiceOrThrow(orderId);
    await this.prisma.invoiceCollection.create({
      data: {
        invoiceId: invoice.id,
        dueDate: dto?.dueDate ? new Date(dto.dueDate) : undefined,
        totalAmount: dto?.amount ?? 0,
        actualReceiptDate: dto?.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto?.paymentDocumentFileUrl,
        paymentMethod: dto?.paymentMethod,
        settlementStatus: dto?.status ?? "pending",
        followUpNotes: dto?.paymentDescription,
      },
    });
    return this.listCollections(inquiryId);
  }

  async updateCollection(collectionId: string, dto: SaveCollectionDto) {
    const collection = await this.prisma.invoiceCollection.findUnique({
      where: { id: collectionId },
      include: { invoice: { select: { order: { select: { inquiryId: true } } } } },
    });
    if (!collection) {
      throw new NotFoundException("ردیف وصولی یافت نشد");
    }
    await this.prisma.invoiceCollection.update({
      where: { id: collectionId },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        totalAmount: dto.amount,
        actualReceiptDate: dto.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto.paymentDocumentFileUrl,
        paymentMethod: dto.paymentMethod,
        settlementStatus: dto.status,
        followUpNotes: dto.paymentDescription,
      },
    });
    return this.listCollections(collection.invoice.order.inquiryId);
  }

  async deleteCollection(collectionId: string) {
    const collection = await this.prisma.invoiceCollection.findUnique({
      where: { id: collectionId },
      include: { invoice: { select: { order: { select: { inquiryId: true } } } } },
    });
    if (!collection) {
      throw new NotFoundException("ردیف وصولی یافت نشد");
    }
    await this.prisma.invoiceCollection.delete({ where: { id: collectionId } });
    return this.listCollections(collection.invoice.order.inquiryId);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getOrderIdOrThrow(inquiryId: string): Promise<string> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    const order = await this.prisma.order.findFirst({ where: { inquiryId }, select: { id: true } });
    if (!order) {
      throw new BadRequestException("ابتدا باید سفارش مشتری (تب ۶) ثبت بشه");
    }
    return order.id;
  }

  private async getOrSeedDelivery(orderId: string) {
    const existing = await this.prisma.delivery.findFirst({ where: { orderId } });
    if (existing) return existing;
    return this.prisma.delivery.create({ data: { orderId, actualDeliveryDate: new Date() } });
  }

  private async getInvoiceOrThrow(orderId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { orderId } });
    if (!invoice) {
      throw new BadRequestException("ابتدا باید فاکتور نهایی صادر بشه");
    }
    return invoice;
  }

  /** فاز ۵۸ — Trigger #۸: تحویل تأیید مشتری گرفت → invoicing_pending برای Finance Owner */
  private async advanceToInvoicingPending(inquiryId: string, currentUserId: string) {
    const inquiry = await this.prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { salesExpertId: true, financeOwnerId: true },
    });
    // اگه هنوز هیچ مالک مالی‌ای ثبت نشده (نه پیش‌پرداخت، نه فاکتور قبلی) موقتاً به فروش
    // واگذار می‌شه تا خودش به مالی ارجاع بده — طبق محدودیت شناخته‌شدهٔ دامنه ۱۴
    const assignee = inquiry.financeOwnerId ?? inquiry.salesExpertId;

    await this.activities.closeStageActivities(inquiryId, "delivery_pending", currentUserId);
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "invoicing_pending",
      activityType: "internal_task",
      subject: "صدور فاکتور نهایی",
      assignedToUserId: assignee,
      triggeredByUserId: currentUserId,
      extraWatcherUserIds: [inquiry.salesExpertId],
    });
  }

  /** فاز ۵۸ — Trigger #۹: اولین فاکتور صادر شد → collection_pending برای Finance Owner */
  private async advanceToCollectionPending(inquiryId: string, currentUserId: string, paymentDeadline?: string) {
    const inquiry = await this.prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { salesExpertId: true, financeOwnerId: true },
    });
    const assignee = inquiry.financeOwnerId ?? currentUserId;

    await this.activities.closeStageActivities(inquiryId, "invoicing_pending", currentUserId);
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "collection_pending",
      activityType: "follow_up",
      subject: "پیگیری وصول مطالبات",
      assignedToUserId: assignee,
      triggeredByUserId: currentUserId,
      dueAt: paymentDeadline ? new Date(paymentDeadline) : undefined,
      extraWatcherUserIds: [inquiry.salesExpertId],
    });
  }

  private async assertAcceptanceComplete(orderId: string) {
    const delivery = await this.prisma.delivery.findFirst({ where: { orderId } });
    if (delivery?.customerAcceptanceStatus !== "accepted") {
      throw new BadRequestException("صدور فاکتور فقط بعد از تایید فنی/کیفی مشتری مجازه");
    }
  }

  private async recomputeInvoiceTotal(invoiceId: string) {
    const items = await this.prisma.invoiceItem.findMany({ where: { invoiceId }, select: { amountIrr: true } });
    const total = items.reduce((sum, i) => sum + Number(i.amountIrr), 0);
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { finalAmountIrr: total } });
  }

  private formatDelivery(delivery: {
    id: string;
    actualDeliveryDate: Date;
    deliveryMethod: string | null;
    recipientName: string | null;
    deliveryReceiptFileUrl: string | null;
    customerAcceptanceDate: Date | null;
    customerAcceptanceStatus: string;
  }) {
    return {
      actualDeliveryDate: delivery.actualDeliveryDate,
      deliveryMethod: delivery.deliveryMethod,
      recipientName: delivery.recipientName,
      deliveryReceiptFileUrl: delivery.deliveryReceiptFileUrl,
      customerAcceptanceDate: delivery.customerAcceptanceDate,
      customerAcceptanceStatus: delivery.customerAcceptanceStatus,
    };
  }

  private formatCollection(c: {
    id: string;
    dueDate: Date | null;
    totalAmount: unknown;
    actualReceiptDate: Date | null;
    paymentDocumentFileUrl: string | null;
    paymentMethod: string | null;
    settlementStatus: string;
    followUpNotes: string | null;
  }) {
    return {
      id: c.id,
      paymentDescription: c.followUpNotes,
      dueDate: c.dueDate,
      amount: Number(c.totalAmount),
      actualPaymentDate: c.actualReceiptDate,
      paymentDocumentFileUrl: c.paymentDocumentFileUrl,
      paymentMethod: c.paymentMethod,
      status: c.settlementStatus,
    };
  }
}
