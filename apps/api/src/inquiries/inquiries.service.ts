import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { format as formatJalaliDate } from "date-fns-jalali";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "./activity-log.service";
import { InquiryNumberService } from "./inquiry-number.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import {
  AddInquiryDocumentDto,
  AddItemDocumentDto,
  CreateDiscussionMessageDto,
  CreateInquiryDto,
  CreateInquiryItemDto,
  ListInquiriesQueryDto,
  UpdateInquiryDto,
  UpdateInquiryItemDto,
} from "./dto/inquiry.dto";

const DEFAULT_PAGE_SIZE = 20;

/** نوع اعلانِ تکرارشوندهٔ روزانه «این استعلام هنوز RFQ تأمین‌کننده نداره» */
const RFQ_PENDING_NOTIFICATION_TYPE = "inquiry_awaiting_supplier_rfq";

const LIST_INCLUDE = {
  buyer: { select: { id: true, companyName: true } },
  salesExpert: { select: { id: true, fullName: true } },
  _count: { select: { items: true, rfqs: true } },
  items: {
    select: {
      builder: true,
      quantity: true,
      finalSalePrice: true,
      selectedOfferItem: { select: { currencyCode: true } },
    },
  },
} satisfies Prisma.InquiryInclude;

type ListRowItem = Prisma.InquiryGetPayload<{ include: typeof LIST_INCLUDE }>["items"][number];

/** برندهای یکتای درخواست‌شده در یک پرونده، به ترتیب اولین ظهور — برای ستون «برندها» در لیست */
function extractBuilders(items: ListRowItem[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items ?? []) {
    const value = item.builder?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

/**
 * ارزش کل پرونده به قیمت فروش (final_sale_price × مقدار)، به تفکیک ارز — فقط اقلامی که هم
 * قیمت فروش نهایی هم آفر منتخب (برای تعیین ارز) دارن؛ بدون تبدیل نرخ، دقیقاً هم‌الگوی
 * totalsByCurrency در selection.service.ts
 */
function computeSaleValueByCurrency(items: ListRowItem[] | undefined): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items ?? []) {
    if (item.finalSalePrice == null || !item.selectedOfferItem) continue;
    const currency = item.selectedOfferItem.currencyCode;
    totals[currency] = (totals[currency] ?? 0) + Number(item.finalSalePrice) * Number(item.quantity);
  }
  return totals;
}

/**
 * مرحله‌ی فعلی پرونده — فقط برای status=in_progress معنا داره (بعد از ثبت نتیجه،
 * status خودش won/lost/... می‌شه که گویاست). از داده‌ی موجود مشتق می‌شه، بدون ستون جدید.
 */
function deriveStageLabel(row: { status: string; selectionLockedAt: Date | null; _count: { rfqs: number } }): string | null {
  if (row.status !== "in_progress") return null;
  if (row._count.rfqs === 0) return "ثبت استعلام";
  if (!row.selectionLockedAt) return "استعلام از تأمین‌کنندگان";
  return "پیشنهاد به مشتری";
}

const DETAIL_INCLUDE = {
  buyer: { select: { id: true, companyName: true, partnerType: true } },
  buyerContact: { select: { id: true, contactName: true, mobile: true, email: true } },
  salesExpert: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: {
    orderBy: { rowIndex: "asc" },
    include: {
      documents: {
        include: { uploader: { select: { id: true, fullName: true } } },
        orderBy: { uploadedAt: "asc" },
      },
    },
  },
  documents: {
    include: { uploader: { select: { id: true, fullName: true } } },
    orderBy: { uploadedAt: "asc" },
  },
} satisfies Prisma.InquiryInclude;

const STATUS_LABEL: Record<string, string> = {
  in_progress: "در جریان",
  won: "برد کامل",
  lost: "باخت کامل",
  partially_won: "برد جزئی",
  cancelled: "لغو شده",
  suspended: "معلق",
  declined: "رد شده",
};

const fmtValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return formatJalaliDate(value, "yyyy/MM/dd");
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  return String(value);
};

/** فیلدهای header که تغییرشون در لاگ پرونده ثبت می‌شه */
const HEADER_FIELD_LABELS: Record<string, string> = {
  subject: "موضوع",
  inquiryNumber: "شماره استعلام مشتری",
  offerEndDate: "مهلت ارائه پیشنهاد",
  extendedOfferEndDate: "تاریخ تمدید مهلت",
  inquiryStartDate: "تاریخ شروع",
  settlementTerms: "شرایط تسویه",
  description: "توضیحات",
  channel: "کانال دریافت",
  urgency: "سطح فوریت",
  isEquivalentAccepted: "تایپ معادل",
  advancePaymentAvailable: "امکان پیش‌پرداخت",
};

const ITEM_FIELD_LABELS: Record<string, string> = {
  itemCode: "کد کالا",
  description: "شرح کالا",
  quantity: "مقدار",
  measurementUnit: "واحد",
  equivalentType: "تایپ معادل",
  drawingTypeRow: "نوع/ردیف نقشه",
  partNumber: "پارت نامبر",
  drawingNumber: "شماره نقشه",
  builder: "سازنده اصلی",
  serialNumber: "شماره سریال",
};

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: InquiryNumberService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionsService,
  ) {}

  private buildListWhere(
    query: Pick<ListInquiriesQueryDto, "q" | "status" | "buyerId" | "salesExpertId">,
  ): Prisma.InquiryWhereInput {
    const where: Prisma.InquiryWhereInput = { deletedAt: null };
    if (query.status && query.status !== "all") where.status = query.status;
    if (query.buyerId) where.buyerId = query.buyerId;
    if (query.salesExpertId) where.salesExpertId = query.salesExpertId;
    if (query.q) {
      where.OR = [
        { internalNumber: { contains: query.q, mode: "insensitive" } },
        { inquiryNumber: { contains: query.q, mode: "insensitive" } },
        { subject: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { buyer: { companyName: { contains: query.q, mode: "insensitive" } } },
        { salesExpert: { fullName: { contains: query.q, mode: "insensitive" } } },
        {
          items: {
            some: {
              OR: [
                { itemCode: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
                { partNumber: { contains: query.q, mode: "insensitive" } },
                { drawingNumber: { contains: query.q, mode: "insensitive" } },
                { builder: { contains: query.q, mode: "insensitive" } },
                { serialNumber: { contains: query.q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }
    return where;
  }

  async list(query: ListInquiriesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildListWhere(query);

    const orderBy: Prisma.InquiryOrderByWithRelationInput =
      query.sortBy === "deadline"
        ? { offerEndDate: query.sortDir ?? "asc" }
        : { createdAt: query.sortDir ?? "desc" };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inquiry.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inquiry.count({ where }),
    ]);

    return {
      items: items.map(({ items: rowItems, ...row }) => ({
        ...row,
        stageLabel: deriveStageLabel(row),
        builders: extractBuilders(rowItems),
        saleValueByCurrency: computeSaleValueByCurrency(rowItems),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** خروجی اکسل کل لیست — همون فیلترهای q/status/buyer/salesExpert صفحه لیست، بدون صفحه‌بندی */
  async export(
    query: Pick<ListInquiriesQueryDto, "q" | "status" | "buyerId" | "salesExpertId">,
  ): Promise<Buffer> {
    const where = this.buildListWhere(query);
    const rows = await this.prisma.inquiry.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("استعلام‌ها");
    sheet.views = [{ rightToLeft: true }];
    sheet.columns = [
      { header: "شماره داخلی", key: "internalNumber", width: 18 },
      { header: "شماره استعلام مشتری", key: "inquiryNumber", width: 18 },
      { header: "موضوع", key: "subject", width: 32 },
      { header: "مشتری", key: "buyer", width: 22 },
      { header: "کارشناس", key: "salesExpert", width: 18 },
      { header: "تعداد اقلام", key: "itemCount", width: 12 },
      { header: "برندها", key: "brands", width: 24 },
      { header: "ارزش فروش", key: "saleValue", width: 24 },
      { header: "مهلت پیشنهاد", key: "deadline", width: 14 },
      { header: "وضعیت", key: "status", width: 14 },
      { header: "تاریخ ثبت", key: "createdAt", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      const saleValue = computeSaleValueByCurrency(row.items);
      sheet.addRow({
        internalNumber: row.internalNumber,
        inquiryNumber: row.inquiryNumber ?? "",
        subject: row.subject,
        buyer: row.buyer.companyName,
        salesExpert: row.salesExpert.fullName,
        itemCount: row._count.items,
        brands: extractBuilders(row.items).join("، "),
        saleValue: Object.entries(saleValue)
          .map(([currency, amount]) => `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`)
          .join("، "),
        deadline: formatJalaliDate(row.extendedOfferEndDate ?? row.offerEndDate, "yyyy/MM/dd"),
        status: STATUS_LABEL[row.status] ?? row.status,
        createdAt: formatJalaliDate(row.createdAt, "yyyy/MM/dd"),
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async create(dto: CreateInquiryDto, currentUserId: string) {
    await this.assertBuyerIsCustomer(dto.buyerId);
    await this.assertContactBelongsToBuyer(dto.buyerContactId, dto.buyerId);
    await this.assertCatalogCodesExist(dto.items.map((item) => item.itemCode));

    const inquiry = await this.prisma.$transaction(async (tx) => {
      const internalNumber = await this.numberService.nextNumber(tx);
      return tx.inquiry.create({
        data: {
          internalNumber,
          inquiryNumber: dto.inquiryNumber,
          buyerId: dto.buyerId,
          buyerContactId: dto.buyerContactId,
          subject: dto.subject,
          offerEndDate: new Date(dto.offerEndDate),
          extendedOfferEndDate: dto.extendedOfferEndDate
            ? new Date(dto.extendedOfferEndDate)
            : undefined,
          isEquivalentAccepted: dto.isEquivalentAccepted,
          settlementTerms: dto.settlementTerms,
          advancePaymentAvailable: dto.advancePaymentAvailable,
          description: dto.description,
          salesExpertId: dto.salesExpertId ?? currentUserId,
          createdByUserId: currentUserId,
          inquiryStartDate: new Date(dto.inquiryStartDate),
          channel: dto.channel,
          urgency: dto.urgency ?? "normal",
          items: {
            create: dto.items.map((item, index) => ({
              rowIndex: index + 1,
              itemCode: item.itemCode,
              description: item.description,
              quantity: item.quantity,
              measurementUnit: item.measurementUnit,
              equivalentType: item.equivalentType,
              drawingTypeRow: item.drawingTypeRow,
              partNumber: item.partNumber,
              drawingNumber: item.drawingNumber,
              builder: item.builder,
              serialNumber: item.serialNumber,
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });
    });

    await this.activityLog.log({
      inquiryId: inquiry.id,
      authorId: currentUserId,
      text: `پرونده استعلام ${inquiry.internalNumber} با ${dto.items.length} قلم ثبت شد`,
      tag: "stage_completed",
      metadata: { module: "inquiry", action: "created" },
    });

    await this.notifySupplierRfqTeam(inquiry.id, inquiry.internalNumber, inquiry.subject);

    return inquiry;
  }

  /** به همهٔ کاربران دارای دسترسی «مشاهده استعلام تأمین‌کننده» (rfq.view) اعلان می‌ده */
  private async notifySupplierRfqTeam(inquiryId: string, internalNumber: string, subject: string) {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: "active",
        permissionGroup: { items: { some: { permission: { permissionKey: "rfq.view" } } } },
      },
      select: { id: true },
    });
    for (const recipient of recipients) {
      await this.notifications.create({
        userId: recipient.id,
        type: RFQ_PENDING_NOTIFICATION_TYPE,
        title: `استعلام «${internalNumber}» هنوز برای هیچ تأمین‌کننده‌ای ارسال نشده`,
        message: subject,
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
      });
    }
  }

  /**
   * Cron روزانه (رجوع کن به InquiriesScheduler) — تا وقتی یک پرونده در جریان هیچ RFQ
   * تأمین‌کننده‌ای نداره، هر روز اعلان قبلی پاک و نسخه تازه صادر می‌شه. به محض ثبت اولین
   * RFQ (در RfqsService.create)، اعلانِ در انتظار برای همون پرونده بلافاصله پاک می‌شه —
   * این متد فقط برای پرونده‌هایی اجرا می‌شه که هنوز هیچ RFQ ای ثبت نشده.
   */
  async remindPendingSupplierRfqs(): Promise<number> {
    const pending = await this.prisma.inquiry.findMany({
      where: { deletedAt: null, status: "in_progress", rfqs: { none: {} } },
      select: { id: true, internalNumber: true, subject: true },
    });
    for (const inquiry of pending) {
      await this.notifications.clearForEntity("inquiry", inquiry.id, RFQ_PENDING_NOTIFICATION_TYPE);
      await this.notifySupplierRfqTeam(inquiry.id, inquiry.internalNumber, inquiry.subject);
    }
    return pending.length;
  }

  async getById(id: string, { includeDeleted = false } = {}) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!inquiry || (inquiry.deletedAt && !includeDeleted)) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    return inquiry;
  }

  async update(id: string, dto: UpdateInquiryDto, currentUserId: string) {
    const existing = await this.getById(id);

    if (dto.buyerId && dto.buyerId !== existing.buyerId) {
      await this.assertBuyerIsCustomer(dto.buyerId);
    }
    if (dto.buyerContactId) {
      await this.assertContactBelongsToBuyer(dto.buyerContactId, dto.buyerId ?? existing.buyerId);
    }

    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: {
        inquiryNumber: dto.inquiryNumber,
        buyerId: dto.buyerId,
        buyerContactId: dto.buyerContactId,
        subject: dto.subject,
        offerEndDate: dto.offerEndDate ? new Date(dto.offerEndDate) : undefined,
        // undefined یعنی این فیلد در درخواست نبوده (دست‌نخورده بمونه)؛ null یعنی کاربر صراحتاً
        // پاکش کرده (باید در دیتابیس هم null بشه) — قبلاً هر دو حالت با هم undefined می‌شدن
        // و پاک‌کردن تاریخ تمدید مهلت هیچ‌وقت واقعاً ذخیره نمی‌شد
        extendedOfferEndDate:
          dto.extendedOfferEndDate === undefined
            ? undefined
            : dto.extendedOfferEndDate
              ? new Date(dto.extendedOfferEndDate)
              : null,
        isEquivalentAccepted: dto.isEquivalentAccepted,
        settlementTerms: dto.settlementTerms,
        advancePaymentAvailable: dto.advancePaymentAvailable,
        description: dto.description,
        inquiryStartDate: dto.inquiryStartDate ? new Date(dto.inquiryStartDate) : undefined,
        channel: dto.channel,
        urgency: dto.urgency,
        status: dto.status,
        updatedAt: new Date(),
      },
      include: DETAIL_INCLUDE,
    });

    if (dto.status && dto.status !== existing.status) {
      await this.activityLog.log({
        inquiryId: id,
        authorId: currentUserId,
        text: `وضعیت پرونده از «${STATUS_LABEL[existing.status]}» به «${STATUS_LABEL[dto.status]}» تغییر کرد`,
        tag: "status_change",
        metadata: { module: "inquiry", from: existing.status, to: dto.status },
      });
    }

    // لاگ ریز تغییرات هر فیلد header (درخواست کاربر: هر ویرایش بعد از ثبت، قابل ردیابی باشه)
    const changes: string[] = [];
    for (const [field, label] of Object.entries(HEADER_FIELD_LABELS)) {
      const oldValue = (existing as Record<string, unknown>)[field];
      const newValue = (updated as Record<string, unknown>)[field];
      if (fmtValue(oldValue) !== fmtValue(newValue)) {
        changes.push(`${label} از «${fmtValue(oldValue)}» به «${fmtValue(newValue)}» تغییر کرد`);
      }
    }
    if (changes.length > 0) {
      await this.activityLog.log({
        inquiryId: id,
        authorId: currentUserId,
        text: `ویرایش پرونده: ${changes.join("؛ ")}`,
        tag: "general",
        metadata: { module: "inquiry", action: "header_edited" },
      });
    }

    return updated;
  }

  async assign(id: string, salesExpertId: string, currentUserId: string) {
    const existing = await this.getById(id);
    const newExpert = await this.prisma.user.findUnique({
      where: { id: salesExpertId },
      select: { id: true, fullName: true, status: true },
    });
    if (!newExpert || newExpert.status !== "active") {
      throw new NotFoundException("کارشناس مقصد یافت نشد یا غیرفعاله");
    }
    if (existing.salesExpertId === salesExpertId) {
      throw new BadRequestException("پرونده همین حالا به این کارشناس واگذار شده");
    }

    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: { salesExpertId, updatedAt: new Date() },
      include: DETAIL_INCLUDE,
    });

    await this.activityLog.log({
      inquiryId: id,
      authorId: currentUserId,
      text: `پرونده از «${existing.salesExpert.fullName}» به «${newExpert.fullName}» واگذار شد`,
      tag: "general",
      metadata: { module: "inquiry", action: "assigned", to: salesExpertId },
    });

    return updated;
  }

  /**
   * رد استعلام توسط بازرگانی در همون مرحله اول (قبل از استعلام از تأمین‌کننده) —
   * مجزا از cancelled (که برای لغو توسط خودِ مشتریه)؛ وضعیت نهایی و غیرقابل‌بازگشت به in_progress
   */
  async decline(id: string, reason: string | undefined, currentUserId: string) {
    const existing = await this.getById(id);
    if (existing.status === "declined") {
      throw new BadRequestException("این استعلام قبلاً رد شده");
    }

    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: { status: "declined", updatedAt: new Date() },
      include: DETAIL_INCLUDE,
    });

    await this.activityLog.log({
      inquiryId: id,
      authorId: currentUserId,
      text: reason ? `استعلام رد شد — دلیل: ${reason}` : "استعلام رد شد",
      tag: "status_change",
      metadata: { module: "inquiry", from: existing.status, to: "declined", reason },
    });

    return updated;
  }

  /** حذف نرم — پرونده به «حذف‌شده‌ها» می‌ره؛ حذف قطعی/بازگردانی فقط با inquiry.purge */
  async remove(id: string, currentUserId: string) {
    await this.getById(id);
    await this.prisma.inquiry.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: currentUserId },
    });
    return { success: true, softDeleted: true };
  }

  /** لیست پرونده‌های حذف‌شده — فقط inquiry.purge */
  async listDeleted() {
    const rows = await this.prisma.inquiry.findMany({
      where: { deletedAt: { not: null } },
      include: LIST_INCLUDE,
      orderBy: { deletedAt: "desc" },
    });
    // نام حذف‌کننده — یک کوئری جمعی به‌جای join در include
    const deleterIds = [...new Set(rows.map((r) => r.deletedBy).filter(Boolean))] as string[];
    const deleters = await this.prisma.user.findMany({
      where: { id: { in: deleterIds } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(deleters.map((u) => [u.id, u.fullName]));
    return rows.map(({ items: rowItems, ...row }) => ({
      ...row,
      deletedByName: row.deletedBy ? (nameById.get(row.deletedBy) ?? null) : null,
      builders: extractBuilders(rowItems),
      saleValueByCurrency: computeSaleValueByCurrency(rowItems),
    }));
  }

  async restore(id: string, currentUserId: string) {
    const inquiry = await this.getById(id, { includeDeleted: true });
    if (!inquiry.deletedAt) {
      throw new BadRequestException("این پرونده حذف نشده");
    }
    await this.prisma.inquiry.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null },
    });
    await this.activityLog.log({
      inquiryId: id,
      authorId: currentUserId,
      text: "پرونده از حذف‌شده‌ها بازگردانی شد",
      tag: "status_change",
      metadata: { module: "inquiry", action: "restored" },
    });
    return { success: true };
  }

  /** حذف قطعی — فقط inquiry.purge؛ پرونده با RFQ همچنان قابل حذف قطعی نیست */
  async purge(id: string) {
    const inquiry = await this.getById(id, { includeDeleted: true });
    if (!inquiry.deletedAt) {
      throw new BadRequestException("اول باید پرونده حذف (نرم) شده باشه");
    }
    const rfqCount = await this.prisma.supplierRfq.count({ where: { inquiryId: id } });
    if (rfqCount > 0) {
      throw new BadRequestException(
        `این پرونده ${rfqCount} استعلام ارسال‌شده به تأمین‌کننده داره و حذف قطعی مجاز نیست — مکاتبه واقعی باید در تاریخچه بمونه`,
      );
    }
    await this.prisma.inquiry.delete({ where: { id } });
    return { success: true };
  }

  // ------------------------------------------------------------
  // اقلام
  // ------------------------------------------------------------

  async addItem(inquiryId: string, dto: CreateInquiryItemDto, currentUserId: string) {
    await this.getById(inquiryId);
    await this.assertCatalogCodesExist([dto.itemCode]);

    const maxRow = await this.prisma.inquiryItem.aggregate({
      where: { inquiryId },
      _max: { rowIndex: true },
    });

    const item = await this.prisma.inquiryItem.create({
      data: {
        inquiryId,
        rowIndex: (maxRow._max.rowIndex ?? 0) + 1,
        itemCode: dto.itemCode,
        description: dto.description,
        quantity: dto.quantity,
        measurementUnit: dto.measurementUnit,
        equivalentType: dto.equivalentType,
        drawingTypeRow: dto.drawingTypeRow,
        partNumber: dto.partNumber,
        drawingNumber: dto.drawingNumber,
        builder: dto.builder,
        serialNumber: dto.serialNumber,
      },
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `قلم «${dto.itemCode}» به پرونده اضافه شد`,
      tag: "general",
      metadata: { module: "inquiry", action: "item_added", itemCode: dto.itemCode },
    });

    return item;
  }

  async updateItem(itemId: string, dto: UpdateInquiryItemDto, currentUserId: string) {
    const item = await this.prisma.inquiryItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException("قلم استعلام یافت نشد");
    }
    if (dto.itemCode && dto.itemCode !== item.itemCode) {
      await this.assertCatalogCodesExist([dto.itemCode]);
    }
    const updated = await this.prisma.inquiryItem.update({
      where: { id: itemId },
      data: { ...dto, updatedAt: new Date() },
    });

    // لاگ ریز تغییرات قلم — مثلاً «ردیف ۱: مقدار از ۱۰ به ۲۰ تغییر کرد»
    const changes: string[] = [];
    for (const [field, label] of Object.entries(ITEM_FIELD_LABELS)) {
      const oldValue = (item as Record<string, unknown>)[field];
      const newValue = (updated as Record<string, unknown>)[field];
      if (fmtValue(oldValue) !== fmtValue(newValue)) {
        changes.push(`${label} از «${fmtValue(oldValue)}» به «${fmtValue(newValue)}» تغییر کرد`);
      }
    }
    if (changes.length > 0) {
      await this.activityLog.log({
        inquiryId: item.inquiryId,
        authorId: currentUserId,
        text: `ویرایش ردیف ${item.rowIndex}: ${changes.join("؛ ")}`,
        tag: "general",
        metadata: { module: "inquiry", action: "item_edited", rowIndex: item.rowIndex },
      });
    }

    return updated;
  }

  async removeItem(itemId: string, currentUserId: string) {
    const item = await this.prisma.inquiryItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException("قلم استعلام یافت نشد");
    }

    const remaining = await this.prisma.inquiryItem.count({
      where: { inquiryId: item.inquiryId },
    });
    if (remaining <= 1) {
      throw new BadRequestException("پرونده نمی‌تونه بدون قلم بمونه — حداقل یک قلم لازمه");
    }

    await this.prisma.inquiryItem.delete({ where: { id: itemId } });

    await this.activityLog.log({
      inquiryId: item.inquiryId,
      authorId: currentUserId,
      text: `قلم «${item.itemCode}» از پرونده حذف شد`,
      tag: "general",
      metadata: { module: "inquiry", action: "item_removed", itemCode: item.itemCode },
    });

    return { success: true };
  }

  // ------------------------------------------------------------
  // مستندات قلم
  // ------------------------------------------------------------

  async addItemDocument(itemId: string, dto: AddItemDocumentDto, currentUserId: string) {
    const item = await this.prisma.inquiryItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException("قلم استعلام یافت نشد");
    }

    const document = await this.prisma.inquiryItemDocument.create({
      data: {
        inquiryItemId: itemId,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        uploadedBy: currentUserId,
      },
    });

    await this.activityLog.log({
      inquiryId: item.inquiryId,
      authorId: currentUserId,
      text: `فایل «${dto.fileName ?? dto.fileUrl}» برای قلم «${item.itemCode}» بارگذاری شد`,
      tag: "file_upload",
      metadata: { module: "inquiry", fileName: dto.fileName, itemCode: item.itemCode },
    });

    return document;
  }

  async removeItemDocument(documentId: string) {
    const document = await this.prisma.inquiryItemDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException("سند یافت نشد");
    }
    await this.prisma.inquiryItemDocument.delete({ where: { id: documentId } });
    return { success: true, fileUrl: document.fileUrl };
  }

  // ------------------------------------------------------------
  // پیوست‌های کلی استعلام (جدا از پیوست هر ردیف کالا)
  // ------------------------------------------------------------

  async addDocument(inquiryId: string, dto: AddInquiryDocumentDto, currentUserId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) {
      throw new NotFoundException("استعلام یافت نشد");
    }

    const document = await this.prisma.inquiryDocument.create({
      data: {
        inquiryId,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        uploadedBy: currentUserId,
      },
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `فایل «${dto.fileName ?? dto.fileUrl}» به پرونده بارگذاری شد`,
      tag: "file_upload",
      metadata: { module: "inquiry", fileName: dto.fileName },
    });

    return document;
  }

  async removeDocument(documentId: string) {
    const document = await this.prisma.inquiryDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException("سند یافت نشد");
    }
    await this.prisma.inquiryDocument.delete({ where: { id: documentId } });
    return { success: true, fileUrl: document.fileUrl };
  }

  // ------------------------------------------------------------
  // گفتگو / فید فعالیت
  // ------------------------------------------------------------

  async listDiscussions(inquiryId: string, currentUserId: string) {
    await this.getById(inquiryId);
    const rows = await this.prisma.inquiryDiscussion.findMany({
      where: { inquiryId },
      include: {
        author: { select: { id: true, fullName: true } },
        mentioned: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const canViewCommercial = await this.permissions.hasPermission(
      currentUserId,
      "inquiry.view_commercial_details",
    );
    if (canViewCommercial) return rows;

    // فروش فقط نسخه‌ی عمومی (بدون نام تأمین‌کننده/مبلغ) رو می‌بینه؛ ورودی‌هایی که
    // نسخه‌ی محدود ندارن (پیام‌های آزاد، ورودی‌های بدون جزئیات حساس) دست‌نخورده می‌مونن.
    return rows.map((row) =>
      row.commentTextRestricted ? { ...row, commentText: row.commentTextRestricted } : row,
    );
  }

  async addMessage(inquiryId: string, dto: CreateDiscussionMessageDto, currentUserId: string) {
    const inquiry = await this.getById(inquiryId);

    if (dto.mentionedUserId) {
      const mentioned = await this.prisma.user.findUnique({
        where: { id: dto.mentionedUserId },
        select: { id: true },
      });
      if (!mentioned) {
        throw new NotFoundException("کاربر Mention شده یافت نشد");
      }
    }

    const message = await this.prisma.inquiryDiscussion.create({
      data: {
        inquiryId,
        entryType: "message",
        authorId: currentUserId,
        commentText: dto.commentText,
        tag: dto.tag ?? "general",
        mentionedUserId: dto.mentionedUserId,
      },
      include: {
        author: { select: { id: true, fullName: true } },
        mentioned: { select: { id: true, fullName: true } },
      },
    });

    if (dto.mentionedUserId && dto.mentionedUserId !== currentUserId) {
      await this.notifications.create({
        userId: dto.mentionedUserId,
        type: "mention",
        title: `${message.author.fullName} شما را در پرونده «${inquiry.subject}» منشن کرد`,
        message: dto.commentText,
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
      });
    }

    return message;
  }

  // ------------------------------------------------------------
  // قوانین کسب‌وکاری (سطح اپلیکیشن — طبق design doc)
  // ------------------------------------------------------------

  private async assertBuyerIsCustomer(buyerId: string) {
    const buyer = await this.prisma.businessPartner.findUnique({
      where: { id: buyerId },
      select: { partnerType: true, status: true },
    });
    if (!buyer) {
      throw new NotFoundException("شرکت مشتری یافت نشد");
    }
    if (!["customer", "both"].includes(buyer.partnerType)) {
      throw new BadRequestException("طرف انتخاب‌شده باید از نوع «مشتری» یا «مشتری و تأمین‌کننده» باشه");
    }
  }

  private async assertContactBelongsToBuyer(contactId: string | undefined, buyerId: string) {
    if (!contactId) return;
    const contact = await this.prisma.partnerContact.findUnique({
      where: { id: contactId },
      select: { partnerId: true },
    });
    if (!contact || contact.partnerId !== buyerId) {
      throw new BadRequestException("رابط انتخاب‌شده متعلق به شرکت مشتری نیست");
    }
  }

  private async assertCatalogCodesExist(codes: string[]) {
    const unique = [...new Set(codes)];
    const found = await this.prisma.itemCatalog.findMany({
      where: { itemCode: { in: unique } },
      select: { itemCode: true },
    });
    if (found.length !== unique.length) {
      const existing = new Set(found.map((row) => row.itemCode));
      const missing = unique.filter((code) => !existing.has(code));
      throw new BadRequestException(
        `کد(های) کالا در کاتالوگ ثبت نشده: ${missing.join("، ")} — اول از کاتالوگ اضافه‌شون کن`,
      );
    }
  }
}
