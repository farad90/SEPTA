import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ActivitiesService } from "../activities/activities.service";
import { MailService } from "../mail/mail.service";
import { RfqNumberService } from "./rfq-number.service";
import { buildRfqEmailHtml, buildRfqEmailText, RfqEmailInput } from "./rfq-email.builder";
import {
  AddOfferDocumentDto,
  CreateOfferDto,
  CreateRfqDeleteRequestDto,
  CreateRfqDto,
  RejectRfqDto,
  TechnicalQuestionDto,
} from "./dto/rfq.dto";

const RFQ_INCLUDE = {
  supplier: { select: { id: true, companyName: true, country: true, email: true } },
  ourEntity: { select: { id: true, entityName: true, shortCode: true } },
  commercialExpert: { select: { id: true, fullName: true, email: true } },
  items: {
    include: {
      inquiryItem: {
        select: {
          id: true,
          rowIndex: true,
          itemCode: true,
          description: true,
          quantity: true,
          measurementUnit: true,
          partNumber: true,
          builder: true,
        },
      },
    },
  },
  offers: {
    include: {
      items: { include: { currency: true } },
      documents: true,
    },
    orderBy: { receivedAt: "desc" as const },
  },
  // فاز ۵۷ — درخواست حذف در انتظار تصمیم (اگه باشه)؛ برای نمایش نشان «در انتظار تأیید مدیریت» در UI
  deleteRequests: {
    where: { status: "pending" },
    select: { id: true, reason: true, createdAt: true, requester: { select: { fullName: true } } },
  },
} satisfies Prisma.SupplierRfqInclude;

@Injectable()
export class RfqsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: RfqNumberService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly activities: ActivitiesService,
    private readonly inquiries: InquiriesService,
  ) {}

  // ------------------------------------------------------------
  // Master Data کمکی فرم
  // ------------------------------------------------------------

  listCurrencies() {
    return this.prisma.currency.findMany({
      where: { status: "active" },
      orderBy: { currencyCode: "asc" },
    });
  }

  // ------------------------------------------------------------
  // RFQ
  // ------------------------------------------------------------

  async listForInquiry(inquiryId: string) {
    const rfqs = await this.prisma.supplierRfq.findMany({
      where: { inquiryId },
      include: RFQ_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rfqs.map((rfq) => this.withComputedTotals(rfq));
  }

  async create(inquiryId: string, dto: CreateRfqDto, currentUserId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, internalNumber: true, selectionLockedAt: true },
    });
    if (!inquiry) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }

    const supplier = await this.prisma.businessPartner.findUnique({
      where: { id: dto.supplierId },
      select: { partnerType: true, companyName: true, status: true },
    });
    if (!supplier) {
      throw new NotFoundException("تأمین‌کننده یافت نشد");
    }
    if (!["supplier", "both"].includes(supplier.partnerType)) {
      throw new BadRequestException(
        "طرف انتخاب‌شده باید از نوع «تأمین‌کننده» یا «مشتری و تأمین‌کننده» باشه",
      );
    }

    const ourEntity = await this.prisma.ourEntity.findUnique({ where: { id: dto.ourEntityId } });
    if (!ourEntity || ourEntity.status !== "active") {
      throw new NotFoundException("شرکت گروه یافت نشد یا غیرفعاله");
    }

    // اقلام باید متعلق به همین پرونده باشن
    const uniqueItemIds = [...new Set(dto.inquiryItemIds)];
    const ownedCount = await this.prisma.inquiryItem.count({
      where: { id: { in: uniqueItemIds }, inquiryId },
    });
    if (ownedCount !== uniqueItemIds.length) {
      throw new BadRequestException("بعضی از اقلام انتخاب‌شده متعلق به این پرونده نیستن");
    }

    const dueDays = this.config.get<number>("RFQ_RESPONSE_DUE_DAYS") ?? 7;
    const responseDueDate = dto.responseDueDate
      ? new Date(dto.responseDueDate)
      : new Date(Date.now() + dueDays * 86_400_000);

    const rfq = await this.prisma.$transaction(async (tx) => {
      const rfqNumber = await this.numberService.nextNumber(tx);
      return tx.supplierRfq.create({
        data: {
          rfqNumber,
          inquiryId,
          supplierId: dto.supplierId,
          ourEntityId: dto.ourEntityId,
          commercialExpertId: currentUserId,
          emailSubject: dto.emailSubject?.trim() || inquiry.internalNumber,
          sentDate: new Date(),
          responseDueDate,
          items: { create: uniqueItemIds.map((id) => ({ inquiryItemId: id })) },
        },
        include: RFQ_INCLUDE,
      });
    });

    // با ثبت اولین RFQ، دیگه این پرونده «بدون RFQ تأمین‌کننده» نیست — یادآوری روزانه
    // (InquiriesScheduler) بلافاصله پاک می‌شه، نه اینکه تا اجرای بعدی Cron باقی بمونه
    await this.notifications.clearForEntity("inquiry", inquiryId, "inquiry_awaiting_supplier_rfq");

    // فاز ۵۸ — Procurement Owner: صرفاً وقتی هنوز خالیه، روی اولین اقدام واقعی RFQ این
    // پرونده پر می‌شه (نگاه کنید به erp-database-design.md دامنه ۱۴)
    await this.inquiries.autoAssignProcurementOwner(inquiryId, currentUserId);

    // فاز ۳۳ — ارسال ایمیل دیگه اینجا خودکار انجام نمی‌شه؛ کاربر بعد از پیش‌نمایش،
    // با فراخوانی جدای POST rfqs/:id/resend-email صریحاً ارسال رو انجام می‌ده.
    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `استعلام ${rfq.rfqNumber} با ${uniqueItemIds.length} قلم از طریق «${ourEntity.entityName}» برای «${supplier.companyName}» ثبت شد`,
      restrictedText: `استعلام با ${uniqueItemIds.length} قلم برای ۱ تأمین‌کننده ثبت شد`,
      tag: "stage_completed",
      metadata: { module: "rfq", rfqNumber: rfq.rfqNumber },
      sourceRfqId: rfq.id,
    });

    // فاز ۳۱ — طبق مثال «Workflow Generated Action» در SPEC-PHASE-31 (سؤال باز #۳):
    // نه در لحظهٔ ایجاد استعلام، بلکه اینجا که مقصد واقعاً مشخصه — یک فعالیت پیگیری خودکار
    // برای کارشناس بازرگانی با Deadline واقعی خودِ RFQ (نه عدد ثابت). فاز ۵۸: با تگ
    // procurement_awaiting_response (Trigger #۱ دامنه ۱۴) به‌جای activities.create عمومی.
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "procurement_awaiting_response",
      activityType: "follow_up",
      subject: `دریافت قیمت از «${supplier.companyName}» — ${rfq.rfqNumber}`,
      assignedToUserId: currentUserId,
      triggeredByUserId: currentUserId,
      dueAt: responseDueDate,
    });

    return this.withComputedTotals(rfq);
  }

  async getById(id: string) {
    const rfq = await this.prisma.supplierRfq.findUnique({
      where: { id },
      include: RFQ_INCLUDE,
    });
    if (!rfq) {
      throw new NotFoundException("RFQ یافت نشد");
    }
    return rfq;
  }

  async emailPreview(id: string) {
    const rfq = await this.getById(id);
    const input = this.toEmailInput(rfq);
    return {
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      html: buildRfqEmailHtml(input),
      text: buildRfqEmailText(input),
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  async resendEmail(id: string, recipientEmail: string, currentUserId: string) {
    const rfq = await this.getById(id);
    if (!this.mail.isConfigured()) {
      throw new BadRequestException("SMTP پیکربندی نشده — از پیش‌نمایش، متن رو کپی و دستی ارسال کن");
    }
    await this.mail.send({
      to: recipientEmail,
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      html: buildRfqEmailHtml(this.toEmailInput(rfq)),
      replyTo: rfq.commercialExpert.email ?? undefined,
      cc: rfq.commercialExpert.email ?? undefined,
    });
    await this.activityLog.log({
      inquiryId: rfq.inquiryId,
      authorId: currentUserId,
      text: `ایمیل استعلام ${rfq.rfqNumber} به «${recipientEmail}» ارسال شد`,
      restrictedText: `ایمیل استعلام ${rfq.rfqNumber} ارسال شد`,
      tag: "general",
      metadata: { module: "rfq", action: "email_sent" },
      sourceRfqId: rfq.id,
    });
    return { success: true };
  }

  /** بازگشت دستی بین «بدون پاسخ» و «در انتظار پاسخ» (پاسخ دیرهنگام) */
  async updateStatus(id: string, status: "awaiting_response" | "no_response", currentUserId: string) {
    const rfq = await this.getById(id);
    if (!["awaiting_response", "no_response"].includes(rfq.status)) {
      throw new BadRequestException("وضعیت فعلی RFQ قابل تغییر دستی نیست");
    }
    const updated = await this.prisma.supplierRfq.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: RFQ_INCLUDE,
    });
    await this.activityLog.log({
      inquiryId: rfq.inquiryId,
      authorId: currentUserId,
      text: `وضعیت ${rfq.rfqNumber} به‌صورت دستی به «${status === "no_response" ? "بدون پاسخ" : "در انتظار پاسخ"}» تغییر کرد`,
      tag: "status_change",
      metadata: { module: "rfq", from: rfq.status, to: status },
      sourceRfqId: rfq.id,
    });
    return this.withComputedTotals(updated);
  }

  // ------------------------------------------------------------
  // مسیر ۱: سوال فنی
  // ------------------------------------------------------------

  async recordTechnicalQuestion(id: string, dto: TechnicalQuestionDto, currentUserId: string) {
    const rfq = await this.getById(id);
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: rfq.inquiryId },
      select: { salesExpertId: true },
    });

    const updated = await this.prisma.supplierRfq.update({
      where: { id },
      data: { status: "technical_question", updatedAt: new Date() },
      include: RFQ_INCLUDE,
    });

    // درج در فید گفتگوی پرونده — با ارجاع به RFQ و Mention کارشناس فروش (design doc)
    await this.prisma.inquiryDiscussion.create({
      data: {
        inquiryId: rfq.inquiryId,
        entryType: "message",
        authorId: currentUserId,
        commentText: `سوال فنی تأمین‌کننده «${rfq.supplier.companyName}» (${rfq.rfqNumber}):\n${dto.questionText}`,
        tag: "technical_question",
        sourceRfqId: rfq.id,
        mentionedUserId:
          inquiry?.salesExpertId !== currentUserId ? inquiry?.salesExpertId : undefined,
      },
    });

    return this.withComputedTotals(updated);
  }

  // ------------------------------------------------------------
  // مسیر ۳: رد صریح توسط تأمین‌کننده (جدا از سکوت/no_response)
  // ------------------------------------------------------------

  async recordRejection(id: string, dto: RejectRfqDto, currentUserId: string) {
    const rfq = await this.getById(id);

    const updated = await this.prisma.supplierRfq.update({
      where: { id },
      data: { status: "rejected_by_supplier", rejectionReason: dto.reason.trim(), updatedAt: new Date() },
      include: RFQ_INCLUDE,
    });

    await this.activityLog.log({
      inquiryId: rfq.inquiryId,
      authorId: currentUserId,
      text: `استعلام ${rfq.rfqNumber} توسط «${rfq.supplier.companyName}» رد شد — علت: ${dto.reason.trim()}`,
      restrictedText: `استعلام ${rfq.rfqNumber} توسط تأمین‌کننده رد شد`,
      tag: "status_change",
      metadata: { module: "rfq", action: "rejected_by_supplier" },
      sourceRfqId: rfq.id,
    });

    await this.advanceProcurementStage(rfq.inquiryId, currentUserId);

    return this.withComputedTotals(updated);
  }

  // ------------------------------------------------------------
  // مسیر ۲: ثبت آفر
  // ------------------------------------------------------------

  async createOffer(rfqId: string, dto: CreateOfferDto, currentUserId: string) {
    const rfq = await this.getById(rfqId);
    await this.assertSelectionNotLocked(rfq.inquiryId);

    const currency = await this.prisma.currency.findUnique({
      where: { currencyCode: dto.currencyCode },
    });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }

    // اقلام آفر باید زیرمجموعه اقلام همین RFQ باشن، بدون تکرار
    const rfqItemIds = new Set(rfq.items.map((item) => item.inquiryItemId));
    const offerItemIds = dto.items.map((item) => item.inquiryItemId);
    if (new Set(offerItemIds).size !== offerItemIds.length) {
      throw new BadRequestException("برای یک قلم دو قیمت ثبت شده");
    }
    const outside = offerItemIds.filter((id) => !rfqItemIds.has(id));
    if (outside.length > 0) {
      throw new BadRequestException("بعضی اقلام آفر جزو اقلام این RFQ نیستن");
    }

    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierOffer.create({
        data: {
          rfqId,
          offerNumber: dto.offerNumber,
          offerDate: dto.offerDate ? new Date(dto.offerDate) : undefined,
          // received_at خودکار توسط DEFAULT now() — مبنای گزارش سرعت پاسخ‌دهی
          offerContactName: dto.offerContactName,
          vatApplicable: dto.vatApplicable ?? false,
          vatRatePercent: dto.vatRatePercent,
          otherCosts: dto.otherCosts ?? 0,
          generalRemarks: dto.generalRemarks,
          items: {
            create: dto.items.map((item) => ({
              inquiryItemId: item.inquiryItemId,
              price: item.price,
              currencyCode: dto.currencyCode,
              deliveryTimeDays: item.deliveryTimeDays,
              partNumber: item.partNumber,
              builder: item.builder,
              countryOfOrigin: item.countryOfOrigin,
              isEquivalent: item.isEquivalent ?? false,
              technicalSpecs: item.technicalSpecs,
              paymentTerms: item.paymentTerms,
              offerValidityDate: item.offerValidityDate
                ? new Date(item.offerValidityDate)
                : undefined,
              datasheetUrl: item.datasheetUrl,
            })),
          },
        },
      });
      await tx.supplierRfq.update({
        where: { id: rfqId },
        data: { status: "offer_received", updatedAt: new Date() },
      });
      return created;
    });

    await this.activityLog.log({
      inquiryId: rfq.inquiryId,
      authorId: currentUserId,
      text: `پیشنهاد قیمت «${rfq.supplier.companyName}» برای ${rfq.rfqNumber} ثبت شد (${dto.items.length} قلم)`,
      restrictedText: `پیشنهاد قیمت دریافتی ثبت شد (${dto.items.length} قلم)`,
      tag: "stage_completed",
      metadata: { module: "rfq", action: "offer_received", offerId: offer.id },
      sourceRfqId: rfq.id,
    });

    await this.advanceProcurementStage(rfq.inquiryId, currentUserId);

    return this.withComputedTotals(await this.getById(rfqId));
  }

  async updateOffer(offerId: string, dto: CreateOfferDto, currentUserId: string) {
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { id: offerId },
      include: { rfq: { include: { supplier: true } } },
    });
    if (!offer) {
      throw new NotFoundException("آفر یافت نشد");
    }
    await this.assertSelectionNotLocked(offer.rfq.inquiryId);

    const rfqItems = await this.prisma.rfqItem.findMany({ where: { rfqId: offer.rfqId } });
    const rfqItemIds = new Set(rfqItems.map((item) => item.inquiryItemId));
    const outside = dto.items.filter((item) => !rfqItemIds.has(item.inquiryItemId));
    if (outside.length > 0) {
      throw new BadRequestException("بعضی اقلام آفر جزو اقلام این RFQ نیستن");
    }

    // ⚠️ به‌جای deleteMany + create (که ردیف‌های قبلی رو با ID جدید جایگزین می‌کنه و FK
    // inquiry_items.selected_offer_item_id رو می‌شکنه اگه اون قلم در مرحله انتخاب نهایی
    // انتخاب شده باشه)، ردیف‌های موجود با upsert روی کلید یکتای (offerId, inquiryItemId)
    // سرجاشون به‌روزرسانی می‌شن — ID و در نتیجه FK دست‌نخورده می‌مونه.
    const existingItems = await this.prisma.supplierOfferItem.findMany({
      where: { offerId },
      select: { id: true, inquiryItemId: true },
    });
    const incomingItemIds = new Set(dto.items.map((item) => item.inquiryItemId));
    const removedItems = existingItems.filter((item) => !incomingItemIds.has(item.inquiryItemId));

    if (removedItems.length > 0) {
      const stillSelected = await this.prisma.inquiryItem.findMany({
        where: { selectedOfferItemId: { in: removedItems.map((item) => item.id) } },
        select: { id: true },
      });
      if (stillSelected.length > 0) {
        throw new BadRequestException(
          "یکی از اقلام حذف‌شده از این آفر، در مرحله انتخاب نهایی انتخاب شده — قبل از حذف، انتخاب اون قلم رو در تب «انتخاب نهایی» تغییر بده",
        );
      }
    }

    await this.prisma.$transaction([
      ...(removedItems.length > 0
        ? [
            this.prisma.supplierOfferItem.deleteMany({
              where: { id: { in: removedItems.map((item) => item.id) } },
            }),
          ]
        : []),
      ...dto.items.map((item) =>
        this.prisma.supplierOfferItem.upsert({
          where: { offerId_inquiryItemId: { offerId, inquiryItemId: item.inquiryItemId } },
          create: {
            offerId,
            inquiryItemId: item.inquiryItemId,
            price: item.price,
            currencyCode: dto.currencyCode,
            deliveryTimeDays: item.deliveryTimeDays,
            partNumber: item.partNumber,
            builder: item.builder,
            countryOfOrigin: item.countryOfOrigin,
            isEquivalent: item.isEquivalent ?? false,
            technicalSpecs: item.technicalSpecs,
            paymentTerms: item.paymentTerms,
            offerValidityDate: item.offerValidityDate ? new Date(item.offerValidityDate) : undefined,
            datasheetUrl: item.datasheetUrl,
          },
          update: {
            price: item.price,
            currencyCode: dto.currencyCode,
            deliveryTimeDays: item.deliveryTimeDays,
            partNumber: item.partNumber,
            builder: item.builder ?? null,
            countryOfOrigin: item.countryOfOrigin,
            isEquivalent: item.isEquivalent ?? false,
            technicalSpecs: item.technicalSpecs,
            paymentTerms: item.paymentTerms,
            offerValidityDate: item.offerValidityDate ? new Date(item.offerValidityDate) : null,
            datasheetUrl: item.datasheetUrl ?? null,
          },
        }),
      ),
      this.prisma.supplierOffer.update({
        where: { id: offerId },
        data: {
          offerNumber: dto.offerNumber,
          offerDate: dto.offerDate ? new Date(dto.offerDate) : null,
          offerContactName: dto.offerContactName,
          vatApplicable: dto.vatApplicable ?? false,
          vatRatePercent: dto.vatRatePercent,
          otherCosts: dto.otherCosts ?? 0,
          generalRemarks: dto.generalRemarks,
        },
      }),
    ]);

    await this.activityLog.log({
      inquiryId: offer.rfq.inquiryId,
      authorId: currentUserId,
      text: `آفر «${offer.rfq.supplier.companyName}» (${offer.rfq.rfqNumber}) اصلاح شد`,
      restrictedText: `آفر دریافتی (${offer.rfq.rfqNumber}) اصلاح شد`,
      tag: "general",
      metadata: { module: "rfq", action: "offer_updated", offerId },
      sourceRfqId: offer.rfqId,
    });

    return this.withComputedTotals(await this.getById(offer.rfqId));
  }

  async addOfferDocument(offerId: string, dto: AddOfferDocumentDto) {
    const offer = await this.prisma.supplierOffer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException("آفر یافت نشد");
    }
    return this.prisma.supplierOfferDocument.create({
      data: { offerId, fileUrl: dto.fileUrl, fileName: dto.fileName },
    });
  }

  // ------------------------------------------------------------
  // فاز ۵۷ — درخواست حذف RFQ (فقط بدون آفر دریافتی) + تأیید مدیریت
  // ------------------------------------------------------------

  async createDeleteRequest(rfqId: string, dto: CreateRfqDeleteRequestDto, currentUserId: string) {
    const rfq = await this.getById(rfqId);
    if (rfq.offers.length > 0) {
      throw new BadRequestException(
        "این RFQ پیشنهاد قیمت دریافت کرده — درخواست حذف فقط برای RFQ های بدون آفر دریافتی مجازه",
      );
    }
    const pending = await this.prisma.rfqDeleteRequest.findFirst({
      where: { rfqId, status: "pending" },
    });
    if (pending) {
      throw new BadRequestException("برای این RFQ یک درخواست حذف در انتظار تصمیم وجود داره");
    }

    const request = await this.prisma.rfqDeleteRequest.create({
      data: { rfqId, reason: dto.reason.trim(), requestedBy: currentUserId },
      include: { requester: { select: { fullName: true } } },
    });

    const approvers = await this.prisma.user.findMany({
      where: {
        status: "active",
        permissionGroup: {
          items: { some: { permission: { permissionKey: "rfq.approve_delete" } } },
        },
      },
      select: { id: true },
    });
    for (const approver of approvers) {
      await this.notifications.create({
        userId: approver.id,
        type: "rfq_delete_request",
        title: `درخواست حذف RFQ ${rfq.rfqNumber}`,
        message: `${request.requester.fullName} درخواست حذف استعلام «${rfq.supplier.companyName}» (${rfq.rfqNumber}) را دارد: ${dto.reason.trim()}`,
        relatedEntityType: "rfq_delete_request",
        relatedEntityId: request.id,
        actions: [
          { label: "تأیید", action: "approve" },
          { label: "رد", action: "reject" },
        ],
      });
    }

    await this.activityLog.log({
      inquiryId: rfq.inquiryId,
      authorId: currentUserId,
      text: `درخواست حذف RFQ ${rfq.rfqNumber} (تأمین‌کننده «${rfq.supplier.companyName}») ثبت شد — دلیل: ${dto.reason.trim()}`,
      restrictedText: `درخواست حذف یک RFQ ثبت شد`,
      tag: "general",
      metadata: { module: "rfq", action: "delete_requested" },
      sourceRfqId: rfq.id,
    });

    return this.withComputedTotals(await this.getById(rfqId));
  }

  async decideDeleteRequest(requestId: string, decision: "approved" | "rejected", currentUserId: string) {
    const request = await this.prisma.rfqDeleteRequest.findUnique({
      where: { id: requestId },
      include: {
        rfq: { include: { supplier: { select: { companyName: true } }, offers: { select: { id: true } } } },
        requester: { select: { fullName: true } },
      },
    });
    if (!request) {
      throw new NotFoundException("درخواست حذف یافت نشد");
    }
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست قبلاً تصمیم‌گیری شده");
    }

    const { rfq } = request;
    const inquiryId = rfq.inquiryId;
    const rfqNumber = rfq.rfqNumber;
    const supplierName = rfq.supplier.companyName;

    if (decision === "rejected") {
      await this.prisma.rfqDeleteRequest.update({
        where: { id: requestId },
        data: { status: "rejected", decidedBy: currentUserId, decidedAt: new Date() },
      });
      await this.notifications.create({
        userId: request.requestedBy,
        type: "rfq_delete_decided",
        title: `درخواست حذف RFQ ${rfqNumber} رد شد`,
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
      });
      await this.activityLog.log({
        inquiryId,
        authorId: currentUserId,
        text: `درخواست حذف RFQ ${rfqNumber} (تأمین‌کننده «${supplierName}») رد شد`,
        tag: "status_change",
        metadata: { module: "rfq", action: "delete_rejected" },
      });
      return this.withComputedTotals(await this.getById(rfq.id));
    }

    // تأیید — بین ثبت درخواست و تصمیم ممکنه بازرگانی همون‌جا آفر ثبت کرده باشه؛ دوباره چک می‌کنیم
    if (rfq.offers.length > 0) {
      throw new BadRequestException(
        "در این فاصله برای این RFQ آفر ثبت شده — دیگه قابل تأیید نیست؛ درخواست رو رد کن",
      );
    }

    // ثبت لاگ فعالیت قبل از حذف واقعی RFQ (source_rfq_id بعد از حذف خودکار NULL می‌شه — طبیعیه)
    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `درخواست حذف RFQ ${rfqNumber} (تأمین‌کننده «${supplierName}») تأیید و RFQ به‌طور قطعی حذف شد`,
      restrictedText: `یک RFQ به‌طور قطعی حذف شد`,
      tag: "status_change",
      metadata: { module: "rfq", action: "deleted" },
      sourceRfqId: rfq.id,
    });

    // حذف قطعی — rfq_items و rfq_delete_requests با Cascade حذف می‌شن
    await this.prisma.supplierRfq.delete({ where: { id: rfq.id } });

    await this.advanceProcurementStage(inquiryId, currentUserId);

    await this.notifications.create({
      userId: request.requestedBy,
      type: "rfq_delete_decided",
      title: `درخواست حذف RFQ ${rfqNumber} تأیید و حذف شد`,
      relatedEntityType: "inquiry",
      relatedEntityId: inquiryId,
    });

    return { success: true, deleted: true };
  }

  // ------------------------------------------------------------
  // Job شبانه — قانون خودکار «بدون پاسخ» (سوال باز design doc)
  // ------------------------------------------------------------

  async markOverdueAsNoResponse(now = new Date()): Promise<number> {
    const overdue = await this.prisma.supplierRfq.findMany({
      where: { status: "awaiting_response", responseDueDate: { lt: now } },
      include: { supplier: { select: { companyName: true } } },
    });

    for (const rfq of overdue) {
      await this.prisma.supplierRfq.update({
        where: { id: rfq.id },
        data: { status: "no_response", updatedAt: new Date() },
      });
      await this.activityLog.log({
        inquiryId: rfq.inquiryId,
        authorId: rfq.commercialExpertId,
        text: `${rfq.rfqNumber} («${rfq.supplier.companyName}») بعد از گذشت مهلت پاسخ، خودکار «بدون پاسخ» شد`,
        restrictedText: `${rfq.rfqNumber} بعد از گذشت مهلت پاسخ، خودکار «بدون پاسخ» شد`,
        tag: "status_change",
        metadata: { module: "rfq", action: "auto_no_response" },
        sourceRfqId: rfq.id,
      });
      await this.notifications.create({
        userId: rfq.commercialExpertId,
        type: "rfq_overdue",
        title: `${rfq.rfqNumber} («${rfq.supplier.companyName}») بدون پاسخ ماند`,
        relatedEntityType: "supplier_rfq",
        relatedEntityId: rfq.id,
      });
      await this.advanceProcurementStage(rfq.inquiryId, rfq.commercialExpertId);
    }

    return overdue.length;
  }

  // ------------------------------------------------------------
  // فاز ۵۸ — Trigger #۱/#۲ چرخهٔ استعلام (erp-database-design.md دامنه ۱۴)
  // ------------------------------------------------------------

  /**
   * بعد از هر رویدادی که یک RFQ رو به حالت پایانی می‌رسونه (offer_received/no_response/
   * rejected_by_supplier، یا حذف کامل RFQ): اگه دیگه هیچ RFQ این پرونده در حالت میانی
   * (awaiting_response/technical_question) نمونده و «انتخاب نهایی» هنوز قفل نشده، مرحلهٔ
   * procurement_awaiting_response بسته و pricing_pending باز می‌شه.
   * ⚠️ محدودیت شناخته‌شده: بازگشت دستی یک RFQ از no_response به awaiting_response
   * (updateStatus، «پاسخ دیرهنگام») فعلاً هیچ Activity ای رو دوباره باز نمی‌کنه.
   */
  private async advanceProcurementStage(inquiryId: string, triggeredByUserId: string) {
    const remaining = await this.prisma.supplierRfq.count({
      where: { inquiryId, status: { in: ["awaiting_response", "technical_question"] } },
    });
    if (remaining > 0) return;

    const totalRfqs = await this.prisma.supplierRfq.count({ where: { inquiryId } });
    if (totalRfqs === 0) return; // آخرین RFQ حذف شد — چیزی برای قیمت‌گذاری نمونده

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { selectionLockedAt: true, salesExpertId: true, procurementOwnerId: true },
    });
    if (!inquiry || inquiry.selectionLockedAt) return;

    const alreadyOpen = await this.prisma.activity.findFirst({
      where: {
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
        relatedStageCode: "pricing_pending",
        status: { notIn: ["completed", "cancelled"] },
      },
    });
    if (alreadyOpen) return;

    await this.activities.closeStageActivities(inquiryId, "procurement_awaiting_response", triggeredByUserId);
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "pricing_pending",
      activityType: "internal_task",
      subject: "قیمت‌گذاری نهایی و انتخاب آفر",
      assignedToUserId: inquiry.procurementOwnerId ?? triggeredByUserId,
      triggeredByUserId,
      extraWatcherUserIds: [inquiry.salesExpertId],
    });
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async assertSelectionNotLocked(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { selectionLockedAt: true },
    });
    if (inquiry?.selectionLockedAt) {
      throw new BadRequestException(
        "مرحله انتخاب نهایی این پرونده قفل شده — ثبت/ویرایش آفر دیگه مجاز نیست",
      );
    }
  }

  private toEmailInput(rfq: Awaited<ReturnType<RfqsService["getById"]>>): RfqEmailInput {
    return {
      rfqNumber: rfq.rfqNumber,
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      entityName: rfq.ourEntity.entityName,
      expertFullName: rfq.commercialExpert.fullName,
      responseDueDate: rfq.responseDueDate,
      items: rfq.items.map((item) => ({
        itemCode: item.inquiryItem.itemCode,
        description: item.inquiryItem.description,
        quantity: Number(item.inquiryItem.quantity),
        measurementUnit: item.inquiryItem.measurementUnit,
        partNumber: item.inquiryItem.partNumber,
        builder: item.inquiryItem.builder,
      })),
    };
  }

  /** جمع پیش‌فاکتور هر آفر — محاسبه در پاسخ API، نه ستون ذخیره‌شده (design doc) */
  private withComputedTotals<
    T extends {
      items: { inquiryItemId: string; inquiryItem: { quantity: unknown } }[];
      offers: {
        items: { inquiryItemId: string; price: unknown }[];
        vatApplicable: boolean;
        vatRatePercent: unknown;
        otherCosts: unknown;
      }[];
    },
  >(rfq: T) {
    const quantityByItem = new Map(
      rfq.items.map((item) => [item.inquiryItemId, Number(item.inquiryItem.quantity)]),
    );

    const offers = rfq.offers.map((offer) => {
      const subTotal = offer.items.reduce(
        (sum, item) => sum + Number(item.price) * (quantityByItem.get(item.inquiryItemId) ?? 0),
        0,
      );
      const vatAmount = offer.vatApplicable
        ? (subTotal * Number(offer.vatRatePercent ?? 0)) / 100
        : 0;
      const otherCosts = Number(offer.otherCosts ?? 0);
      return {
        ...offer,
        totals: {
          subTotal,
          vatAmount,
          otherCosts,
          grandTotal: subTotal + vatAmount + otherCosts,
        },
      };
    });

    return { ...rfq, offers };
  }
}
