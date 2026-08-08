import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { SelectionService } from "../selection/selection.service";
import {
  SaveCustomerPaymentDto,
  SaveGuaranteeDto,
  SaveOrderDto,
} from "./dto/order.dto";

interface ItemSource {
  purchasePrice: number;
  salePrice: number;
  supplierId: string | undefined;
  supplierName: string | undefined;
  quantity: number;
  rowIndex: number;
  itemCode: string;
  description: string;
  measurementUnit: string;
}

/**
 * فاز ۸ — سفارش مشتری (تب ۶). طبق تصمیم کاربر: حداکثر یک سفارش برای هر پرونده؛
 * اقلام سفارش هر بار GET/PUT با نتیجه فعلی تب ۵ هم‌رسانی می‌شن (افزودن/حذف عضویت،
 * بدون بازنویسی قیمت/تعداد ردیف‌های موجود).
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly selection: SelectionService,
    private readonly inquiries: InquiriesService,
  ) {}

  // ------------------------------------------------------------
  // نمای تجمیعی تب ۶
  // ------------------------------------------------------------

  async getOrder(inquiryId: string) {
    await this.getInquiryOrThrow(inquiryId);
    const { sources, warnings } = await this.buildItemSources(inquiryId);
    const wonItemIds = [...sources.keys()];

    const existing = await this.prisma.order.findFirst({ where: { inquiryId } });

    if (!existing) {
      return {
        inquiryId,
        exists: false,
        wonItems: wonItemIds.map((id) => this.formatSourceItem(id, sources.get(id)!)),
        warnings,
      };
    }

    await this.syncOrderItems(existing.id, wonItemIds, sources);
    const order = await this.getOrderRowOrThrow(existing.id);

    return { inquiryId, exists: true, ...this.formatOrder(order), warnings };
  }

  // ------------------------------------------------------------
  // ساخت/ویرایش هدر سفارش
  // ------------------------------------------------------------

  async saveOrder(inquiryId: string, dto: SaveOrderDto, currentUserId: string) {
    const inquiry = await this.getInquiryOrThrow(inquiryId);
    const { sources } = await this.buildItemSources(inquiryId);
    const wonItemIds = [...sources.keys()];

    const existing = await this.prisma.order.findFirst({ where: { inquiryId } });

    if (!existing) {
      if (wonItemIds.length === 0) {
        throw new BadRequestException(
          "هیچ قلم برنده قابل قیمت‌گذاری‌ای در این پرونده نیست — ابتدا در تب «نتیجه نهایی» ثبت کن",
        );
      }
      const totalAmount = wonItemIds.reduce((sum, id) => {
        const s = sources.get(id)!;
        return sum + s.salePrice * s.quantity;
      }, 0);

      try {
        await this.prisma.order.create({
          data: {
            orderNumber: dto.orderNumber?.trim() || this.deriveOrderNumber(inquiry.internalNumber),
            inquiryId,
            contractNumber: dto.contractNumber,
            contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
            totalAmount,
            deliveryDueDate: dto.deliveryDueDate ? new Date(dto.deliveryDueDate) : undefined,
            contractFileUrl: dto.contractFileUrl,
            items: {
              create: wonItemIds.map((id) => {
                const s = sources.get(id)!;
                return {
                  inquiryItemId: id,
                  supplierId: s.supplierId!,
                  purchasePrice: s.purchasePrice,
                  salePrice: s.salePrice,
                  quantity: s.quantity,
                };
              }),
            },
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          throw new ConflictException("شماره سفارش تکراریه");
        }
        throw err;
      }

      await this.activityLog.log({
        inquiryId,
        authorId: currentUserId,
        text: "سفارش مشتری ثبت شد",
        tag: "stage_completed",
        metadata: { module: "order", action: "created" },
      });
    } else {
      try {
        await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            orderNumber: dto.orderNumber?.trim() || undefined,
            contractNumber: dto.contractNumber,
            contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
            deliveryDueDate: dto.deliveryDueDate ? new Date(dto.deliveryDueDate) : undefined,
            contractFileUrl: dto.contractFileUrl,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          throw new ConflictException("شماره سفارش تکراریه");
        }
        throw err;
      }
      await this.syncOrderItems(existing.id, wonItemIds, sources);
    }

    return this.getOrder(inquiryId);
  }

  // ------------------------------------------------------------
  // پرداخت‌های مشتری
  // ------------------------------------------------------------

  /** ردیف خالی هم مجازه — الگوی UI: افزودن ردیف خالی و بعد ویرایش خطی */
  async addPayment(inquiryId: string, dto: SaveCustomerPaymentDto, currentUserId: string) {
    const order = await this.getOrderByInquiryOrThrow(inquiryId);
    await this.prisma.customerPayment.create({
      data: {
        orderId: order.id,
        paymentDescription: dto.paymentDescription,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount: dto.amount ?? 0,
        actualPaymentDate: dto.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto.paymentDocumentFileUrl,
        status: dto.status ?? "unpaid",
      },
    });
    // فاز ۵۸ — اولین نوشتار مالی این پرونده (اگه هنوز فاکتوری هم صادر نشده) — Finance Owner
    // رو در صورت خالی‌بودن پر می‌کنه؛ نگاه کنید به erp-database-design.md دامنه ۱۴
    await this.inquiries.autoAssignFinanceOwner(inquiryId, currentUserId);
    return this.getOrder(inquiryId);
  }

  async updatePayment(paymentId: string, dto: SaveCustomerPaymentDto) {
    const payment = await this.prisma.customerPayment.findUnique({
      where: { id: paymentId },
      select: { orderId: true, order: { select: { inquiryId: true } } },
    });
    if (!payment) throw new NotFoundException("رکورد پرداخت یافت نشد");
    await this.prisma.customerPayment.update({
      where: { id: paymentId },
      data: {
        paymentDescription: dto.paymentDescription,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount: dto.amount,
        actualPaymentDate: dto.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto.paymentDocumentFileUrl,
        status: dto.status,
      },
    });
    return this.getOrder(payment.order.inquiryId);
  }

  async deletePayment(paymentId: string) {
    const payment = await this.prisma.customerPayment.findUnique({
      where: { id: paymentId },
      select: { order: { select: { inquiryId: true } } },
    });
    if (!payment) throw new NotFoundException("رکورد پرداخت یافت نشد");
    await this.prisma.customerPayment.delete({ where: { id: paymentId } });
    return this.getOrder(payment.order.inquiryId);
  }

  // ------------------------------------------------------------
  // ضمانت‌نامه‌های صادره
  // ------------------------------------------------------------

  /** ردیف خالی هم مجازه — الگوی UI: افزودن ردیف خالی و بعد ویرایش خطی */
  async addGuarantee(inquiryId: string, dto: SaveGuaranteeDto) {
    const order = await this.getOrderByInquiryOrThrow(inquiryId);
    await this.prisma.issuedGuarantee.create({
      data: {
        orderId: order.id,
        guaranteeType: dto.guaranteeType ?? "advance_payment",
        amount: dto.amount ?? 0,
        issuingBank: dto.issuingBank,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        status: dto.status ?? "active",
      },
    });
    return this.getOrder(inquiryId);
  }

  async updateGuarantee(guaranteeId: string, dto: SaveGuaranteeDto) {
    const guarantee = await this.prisma.issuedGuarantee.findUnique({
      where: { id: guaranteeId },
      select: { order: { select: { inquiryId: true } } },
    });
    if (!guarantee) throw new NotFoundException("ضمانت‌نامه یافت نشد");
    await this.prisma.issuedGuarantee.update({
      where: { id: guaranteeId },
      data: {
        guaranteeType: dto.guaranteeType,
        amount: dto.amount,
        issuingBank: dto.issuingBank,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        status: dto.status,
      },
    });
    return this.getOrder(guarantee.order.inquiryId);
  }

  async deleteGuarantee(guaranteeId: string) {
    const guarantee = await this.prisma.issuedGuarantee.findUnique({
      where: { id: guaranteeId },
      select: { order: { select: { inquiryId: true } } },
    });
    if (!guarantee) throw new NotFoundException("ضمانت‌نامه یافت نشد");
    await this.prisma.issuedGuarantee.delete({ where: { id: guaranteeId } });
    return this.getOrder(guarantee.order.inquiryId);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getInquiryOrThrow(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, internalNumber: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    return inquiry;
  }

  private async getOrderByInquiryOrThrow(inquiryId: string) {
    const order = await this.prisma.order.findFirst({ where: { inquiryId } });
    if (!order) {
      throw new NotFoundException("ابتدا باید سفارش مشتری ثبت بشه");
    }
    return order;
  }

  private async getOrderRowOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { supplier: true, inquiryItem: true } },
        customerPayments: { orderBy: { createdAt: "asc" } },
        issuedGuarantees: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new NotFoundException("سفارش یافت نشد");
    return order;
  }

  private deriveOrderNumber(internalNumber: string): string {
    return internalNumber.replace(/^INQ-/, "ORD-");
  }

  /** منبع قیمت/تأمین‌کننده هر قلم برنده: اول از پیشنهاد مالی پذیرفته‌شده، بعد fallback به baseline انتخاب نهایی */
  private async buildItemSources(
    inquiryId: string,
  ): Promise<{ sources: Map<string, ItemSource>; warnings: string[] }> {
    const wonOutcomes = await this.prisma.inquiryItemOutcome.findMany({
      where: { result: "won", inquiryItem: { inquiryId } },
      select: { inquiryItemId: true },
    });
    const wonIds = new Set(wonOutcomes.map((o) => o.inquiryItemId));
    if (wonIds.size === 0) {
      return { sources: new Map(), warnings: [] };
    }

    const selectionState = await this.selection.getSelection(inquiryId);
    const financial = await this.prisma.financialProposal.findFirst({
      where: { inquiryId, status: "current" },
      include: { items: true },
    });
    const financialItemsMap = new Map((financial?.items ?? []).map((i) => [i.inquiryItemId, i]));

    const sources = new Map<string, ItemSource>();
    const warnings: string[] = [];

    for (const item of selectionState.items as Array<Record<string, unknown>>) {
      const id = item.id as string;
      if (!wonIds.has(id)) continue;
      const selectedOfferItemId = item.selectedOfferItemId as string | null;
      const offers = item.offers as Array<Record<string, unknown>>;
      const chosen = offers.find((o) => o.offerItemId === selectedOfferItemId);
      const supplier = chosen?.supplier as { id: string; companyName: string } | undefined;

      if (!supplier) {
        warnings.push(`ردیف ${item.rowIndex as number}: قلم برنده هنوز آفر/تأمین‌کننده منتخبی نداره — از سفارش جا افتاد`);
        continue;
      }

      const financialItem = financialItemsMap.get(id);
      const purchasePrice = financialItem
        ? Number(financialItem.purchasePrice)
        : ((chosen?.effectivePrice as number) ?? 0);
      const salePrice = financialItem
        ? Number(financialItem.finalSalePrice)
        : ((item.finalSalePrice as number | null) ?? purchasePrice);

      sources.set(id, {
        purchasePrice,
        salePrice,
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        quantity: item.quantity as number,
        rowIndex: item.rowIndex as number,
        itemCode: item.itemCode as string,
        description: item.description as string,
        measurementUnit: item.measurementUnit as string,
      });
    }

    return { sources, warnings };
  }

  private formatSourceItem(inquiryItemId: string, s: ItemSource) {
    return {
      inquiryItemId,
      rowIndex: s.rowIndex,
      itemCode: s.itemCode,
      description: s.description,
      quantity: s.quantity,
      measurementUnit: s.measurementUnit,
      supplierName: s.supplierName,
      purchasePrice: s.purchasePrice,
      salePrice: s.salePrice,
    };
  }

  private async syncOrderItems(orderId: string, wonItemIds: string[], sources: Map<string, ItemSource>) {
    const existing = await this.prisma.orderItem.findMany({ where: { orderId } });
    const existingIds = new Set(existing.map((i) => i.inquiryItemId));
    const wonIdsSet = new Set(wonItemIds);

    const toRemove = existing.filter((i) => !wonIdsSet.has(i.inquiryItemId));
    const toAdd = wonItemIds.filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      await this.prisma.orderItem.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
    }
    if (toAdd.length > 0) {
      await this.prisma.orderItem.createMany({
        data: toAdd.map((id) => {
          const s = sources.get(id)!;
          return {
            orderId,
            inquiryItemId: id,
            supplierId: s.supplierId!,
            purchasePrice: s.purchasePrice,
            salePrice: s.salePrice,
            quantity: s.quantity,
          };
        }),
      });
    }

    const currentItems = await this.prisma.orderItem.findMany({ where: { orderId } });
    const totalAmount = currentItems.reduce(
      (sum, i) => sum + Number(i.salePrice) * Number(i.quantity),
      0,
    );
    await this.prisma.order.update({ where: { id: orderId }, data: { totalAmount, updatedAt: new Date() } });
  }

  private formatOrder(order: Awaited<ReturnType<OrderService["getOrderRowOrThrow"]>>) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      contractNumber: order.contractNumber,
      contractDate: order.contractDate,
      totalAmount: Number(order.totalAmount),
      deliveryDueDate: order.deliveryDueDate,
      contractFileUrl: order.contractFileUrl,
      items: order.items.map((i) => ({
        inquiryItemId: i.inquiryItemId,
        rowIndex: i.inquiryItem.rowIndex,
        itemCode: i.inquiryItem.itemCode,
        description: i.inquiryItem.description,
        measurementUnit: i.inquiryItem.measurementUnit,
        supplierName: i.supplier.companyName,
        purchasePrice: Number(i.purchasePrice),
        salePrice: Number(i.salePrice),
        quantity: Number(i.quantity),
      })),
      customerPayments: order.customerPayments.map((p) => ({
        id: p.id,
        paymentDescription: p.paymentDescription,
        dueDate: p.dueDate,
        amount: Number(p.amount),
        actualPaymentDate: p.actualPaymentDate,
        paymentDocumentFileUrl: p.paymentDocumentFileUrl,
        status: p.status,
      })),
      issuedGuarantees: order.issuedGuarantees.map((g) => ({
        id: g.id,
        guaranteeType: g.guaranteeType,
        amount: Number(g.amount),
        issuingBank: g.issuingBank,
        issueDate: g.issueDate,
        expiryDate: g.expiryDate,
        status: g.status,
      })),
    };
  }
}
