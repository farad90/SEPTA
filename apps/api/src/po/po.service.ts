import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { SelectionService } from "../selection/selection.service";
import { SavePoDto, SaveSupplierPaymentDto } from "./dto/po.dto";

/**
 * فاز ۹ — سفارش خرید (PO، تب ۷). به‌ازای هر تأمین‌کننده متمایز بین اقلام سفارش مشتری
 * (فاز ۸) یک PO مستقل — هم‌رسانی اقلام دقیقاً مثل الگوی فاز ۸ (افزودن/حذف عضویت،
 * بدون بازنویسی ردیف‌های موجود)؛ صدور/ذخیره هر PO مستقل از بقیه (طبق تصمیم کاربر).
 */
@Injectable()
export class PoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly selection: SelectionService,
  ) {}

  // ------------------------------------------------------------
  // نمای تجمیعی تب ۷ — آرایه‌ای از گروه‌های «هر تأمین‌کننده»
  // ------------------------------------------------------------

  async getPurchaseOrders(inquiryId: string) {
    const order = await this.getOrderOrThrow(inquiryId);
    const groups = new Map<string, { supplierId: string; supplierName: string; items: OrderItemRow[] }>();
    for (const item of order.items) {
      const g = groups.get(item.supplierId) ?? {
        supplierId: item.supplierId,
        supplierName: item.supplier.companyName,
        items: [],
      };
      g.items.push(item);
      groups.set(item.supplierId, g);
    }

    const result = [];
    for (const group of groups.values()) {
      result.push(await this.buildSupplierGroup(inquiryId, order.id, order.orderNumber, group));
    }
    return result;
  }

  async getSupplierGroup(inquiryId: string, supplierId: string) {
    const order = await this.getOrderOrThrow(inquiryId);
    const items = order.items.filter((i) => i.supplierId === supplierId);
    if (items.length === 0) {
      throw new NotFoundException("این تأمین‌کننده در سفارش مشتری این پرونده قلمی نداره");
    }
    const supplierName = items[0].supplier.companyName;
    return this.buildSupplierGroup(inquiryId, order.id, order.orderNumber, { supplierId, supplierName, items });
  }

  // ------------------------------------------------------------
  // ساخت/ویرایش هدر PO
  // ------------------------------------------------------------

  async savePo(inquiryId: string, supplierId: string, dto: SavePoDto, currentUserId: string) {
    const order = await this.getOrderOrThrow(inquiryId);
    const items = order.items.filter((i) => i.supplierId === supplierId);
    if (items.length === 0) {
      throw new BadRequestException("این تأمین‌کننده در سفارش مشتری این پرونده قلمی نداره");
    }

    const existing = await this.prisma.purchaseOrder.findFirst({ where: { orderId: order.id, supplierId } });

    if (!existing) {
      const ourEntityId = dto.ourEntityId ?? (await this.deriveOurEntityId(inquiryId, supplierId));
      if (!ourEntityId) {
        throw new BadRequestException("شرکت گروه (طرف صادرکننده PO) مشخص نیست — لطفاً انتخاب کن");
      }
      const currencyCode = await this.deriveMajorityCurrency(inquiryId, supplierId);
      const totalAmount = items.reduce((sum, i) => sum + Number(i.purchasePrice) * Number(i.quantity), 0);

      try {
        await this.prisma.purchaseOrder.create({
          data: {
            poNumber:
              dto.poNumber?.trim() ||
              this.derivePoNumber(order.orderNumber, items[0].supplier.companyName, supplierId),
            orderId: order.id,
            supplierId,
            ourEntityId,
            currencyCode,
            totalAmount,
            issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
            deliveryDueDate: dto.deliveryDueDate ? new Date(dto.deliveryDueDate) : undefined,
            items: {
              create: items.map((i) => ({
                orderItemId: i.id,
                price: Number(i.purchasePrice),
                quantity: Number(i.quantity),
              })),
            },
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          throw new ConflictException("شماره PO تکراریه");
        }
        throw err;
      }

      await this.activityLog.log({
        inquiryId,
        authorId: currentUserId,
        text: `سفارش خرید (PO) برای «${items[0].supplier.companyName}» صادر شد`,
        tag: "stage_completed",
        metadata: { module: "po", action: "created", supplierId },
      });
    } else {
      try {
        await this.prisma.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            poNumber: dto.poNumber?.trim() || undefined,
            ourEntityId: dto.ourEntityId || undefined,
            issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
            deliveryDueDate: dto.deliveryDueDate ? new Date(dto.deliveryDueDate) : undefined,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          throw new ConflictException("شماره PO تکراریه");
        }
        throw err;
      }
      await this.syncPoItems(existing.id, items);
    }

    return this.getSupplierGroup(inquiryId, supplierId);
  }

  // ------------------------------------------------------------
  // پرداخت به تأمین‌کننده
  // ------------------------------------------------------------

  /** ردیف خالی هم مجازه — الگوی UI: افزودن ردیف خالی و بعد ویرایش خطی (طبق اصلاح فاز ۸) */
  async addPayment(inquiryId: string, supplierId: string, dto: SaveSupplierPaymentDto) {
    const po = await this.getPoOrThrow(inquiryId, supplierId);
    await this.prisma.supplierPayment.create({
      data: {
        poId: po.id,
        paymentDescription: dto.paymentDescription,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount: dto.amount ?? 0,
        actualPaymentDate: dto.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto.paymentDocumentFileUrl,
        paymentMethod: dto.paymentMethod,
        status: dto.status ?? "unpaid",
      },
    });
    return this.getSupplierGroup(inquiryId, supplierId);
  }

  async updatePayment(paymentId: string, dto: SaveSupplierPaymentDto) {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id: paymentId },
      select: { po: { select: { supplierId: true, order: { select: { inquiryId: true } } } } },
    });
    if (!payment) throw new NotFoundException("رکورد پرداخت یافت نشد");
    await this.prisma.supplierPayment.update({
      where: { id: paymentId },
      data: {
        paymentDescription: dto.paymentDescription,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount: dto.amount,
        actualPaymentDate: dto.actualPaymentDate ? new Date(dto.actualPaymentDate) : undefined,
        paymentDocumentFileUrl: dto.paymentDocumentFileUrl,
        paymentMethod: dto.paymentMethod,
        status: dto.status,
      },
    });
    return this.getSupplierGroup(payment.po.order.inquiryId, payment.po.supplierId);
  }

  async deletePayment(paymentId: string) {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id: paymentId },
      select: { po: { select: { supplierId: true, order: { select: { inquiryId: true } } } } },
    });
    if (!payment) throw new NotFoundException("رکورد پرداخت یافت نشد");
    await this.prisma.supplierPayment.delete({ where: { id: paymentId } });
    return this.getSupplierGroup(payment.po.order.inquiryId, payment.po.supplierId);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getOrderOrThrow(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    const order = await this.prisma.order.findFirst({
      where: { inquiryId },
      include: { items: { include: { supplier: true, inquiryItem: true } } },
    });
    if (!order) {
      throw new BadRequestException("ابتدا باید سفارش مشتری (تب ۶) ثبت بشه");
    }
    return order;
  }

  private async getPoOrThrow(inquiryId: string, supplierId: string) {
    const order = await this.getOrderOrThrow(inquiryId);
    const po = await this.prisma.purchaseOrder.findFirst({ where: { orderId: order.id, supplierId } });
    if (!po) {
      throw new NotFoundException("ابتدا باید PO این تأمین‌کننده صادر بشه");
    }
    return po;
  }

  /**
   * ⚠️ نمی‌شه فقط به حروف لاتین نام تأمین‌کننده تکیه کرد — نام‌های فارسی هیچ حرف
   * لاتینی ندارن و باعث تصادم شماره PO بین دو تأمین‌کننده مختلف می‌شن. برای
   * یکتایی تضمین‌شده، همیشه یک قطعه از خود شناسه تأمین‌کننده رو اضافه می‌کنیم.
   */
  private derivePoNumber(orderNumber: string, supplierName: string, supplierId: string): string {
    const latinInitials = supplierName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
    const idSuffix = supplierId.replace(/-/g, "").slice(0, 4).toUpperCase();
    const suffix = latinInitials ? `${latinInitials}${idSuffix.slice(0, 2)}` : idSuffix;
    return `${orderNumber.replace(/^ORD-/, "PO-")}-${suffix}`;
  }

  private async deriveOurEntityId(inquiryId: string, supplierId: string): Promise<string | undefined> {
    const rfq = await this.prisma.supplierRfq.findFirst({
      where: { inquiryId, supplierId },
      orderBy: { sentDate: "desc" },
      select: { ourEntityId: true },
    });
    return rfq?.ourEntityId;
  }

  private async deriveMajorityCurrency(inquiryId: string, supplierId: string): Promise<string> {
    const selectionState = await this.selection.getSelection(inquiryId);
    const totals: Record<string, number> = {};
    for (const item of selectionState.items as Array<Record<string, unknown>>) {
      const offers = item.offers as Array<Record<string, unknown>>;
      const chosen = offers.find((o) => o.offerItemId === item.selectedOfferItemId);
      const chosenSupplier = chosen?.supplier as { id: string } | undefined;
      if (!chosen || chosenSupplier?.id !== supplierId) continue;
      const currencyCode = chosen.currencyCode as string;
      const value = (chosen.effectivePrice as number) * (item.quantity as number);
      totals[currencyCode] = (totals[currencyCode] ?? 0) + value;
    }
    const entries = Object.entries(totals);
    if (entries.length === 0) return "EUR";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  private async syncPoItems(poId: string, orderItems: OrderItemRow[]) {
    const existing = await this.prisma.poItem.findMany({ where: { poId } });
    const existingIds = new Set(existing.map((i) => i.orderItemId));
    const currentIds = new Set(orderItems.map((i) => i.id));

    const toRemove = existing.filter((i) => !currentIds.has(i.orderItemId));
    const toAdd = orderItems.filter((i) => !existingIds.has(i.id));

    if (toRemove.length > 0) {
      await this.prisma.poItem.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
    }
    if (toAdd.length > 0) {
      await this.prisma.poItem.createMany({
        data: toAdd.map((i) => ({
          poId,
          orderItemId: i.id,
          price: Number(i.purchasePrice),
          quantity: Number(i.quantity),
        })),
      });
    }

    const currentItems = await this.prisma.poItem.findMany({ where: { poId } });
    const totalAmount = currentItems.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
    await this.prisma.purchaseOrder.update({ where: { id: poId }, data: { totalAmount, updatedAt: new Date() } });
  }

  private async buildSupplierGroup(
    inquiryId: string,
    orderId: string,
    orderNumber: string,
    group: { supplierId: string; supplierName: string; items: OrderItemRow[] },
  ) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { orderId, supplierId: group.supplierId },
    });

    if (!existing) {
      const defaultOurEntityId = await this.deriveOurEntityId(inquiryId, group.supplierId);
      return {
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        exists: false as const,
        defaultOurEntityId: defaultOurEntityId ?? null,
        defaultPoNumber: this.derivePoNumber(orderNumber, group.supplierName, group.supplierId),
        previewItems: group.items.map((i) => this.formatItem(i)),
      };
    }

    await this.syncPoItems(existing.id, group.items);
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: existing.id },
      include: {
        ourEntity: { select: { id: true, entityName: true, shortCode: true } },
        items: { include: { orderItem: { include: { inquiryItem: true } } } },
        supplierPayments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!po) throw new NotFoundException("سفارش خرید یافت نشد");

    return {
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      exists: true as const,
      id: po.id,
      poNumber: po.poNumber,
      ourEntityId: po.ourEntityId,
      ourEntityName: po.ourEntity.entityName,
      currencyCode: po.currencyCode,
      totalAmount: Number(po.totalAmount),
      issueDate: po.issueDate,
      deliveryDueDate: po.deliveryDueDate,
      items: po.items.map((i) => ({
        orderItemId: i.orderItemId,
        rowIndex: i.orderItem.inquiryItem.rowIndex,
        itemCode: i.orderItem.inquiryItem.itemCode,
        description: i.orderItem.inquiryItem.description,
        measurementUnit: i.orderItem.inquiryItem.measurementUnit,
        price: Number(i.price),
        quantity: Number(i.quantity),
      })),
      supplierPayments: po.supplierPayments.map((p) => ({
        id: p.id,
        paymentDescription: p.paymentDescription,
        dueDate: p.dueDate,
        amount: Number(p.amount),
        actualPaymentDate: p.actualPaymentDate,
        paymentDocumentFileUrl: p.paymentDocumentFileUrl,
        paymentMethod: p.paymentMethod,
        status: p.status,
      })),
    };
  }

  private formatItem(i: OrderItemRow) {
    return {
      orderItemId: i.id,
      rowIndex: i.inquiryItem.rowIndex,
      itemCode: i.inquiryItem.itemCode,
      description: i.inquiryItem.description,
      measurementUnit: i.inquiryItem.measurementUnit,
      price: Number(i.purchasePrice),
      quantity: Number(i.quantity),
    };
  }
}

interface OrderItemRow {
  id: string;
  supplierId: string;
  purchasePrice: unknown;
  quantity: unknown;
  supplier: { companyName: string };
  inquiryItem: { rowIndex: number; itemCode: string; description: string; measurementUnit: string };
}
