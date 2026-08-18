import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { SelectionService } from "../selection/selection.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ActivitiesService } from "../activities/activities.service";
import { ProposalNumberService } from "./proposal-number.service";
import {
  SaveFinancialProposalDto,
  SaveTechnicalProposalDto,
  SaveSalesAdjustmentDto,
} from "./dto/proposal.dto";

interface BaselineItem {
  inquiryItemId: string;
  rowIndex: number;
  itemCode: string;
  /** شرح خودِ استعلام — فقط برای دیدگاه‌های داخلی (انتخاب نهایی/سفارش/PO/حمل)، نه سند مشتری */
  description: string;
  /**
   * ⚠️ فاز ۴۴ — از لحظه‌ای که آفر تأمین‌کننده ثبت می‌شه، دیگه شرح خودِ استعلام ملاک سند مشتری
   * نیست؛ شرح فنی *تأمین‌کننده* (technicalSpecs) جایگزینش می‌شه. Fallback به description فقط
   * وقتی تأمین‌کننده هیچ شرح فنی‌ای وارد نکرده — تا ردیف خالی در سند مشتری نداشته باشیم.
   */
  customerDescription: string;
  quantity: number;
  measurementUnit: string;
  builder: string | null;
  supplierName?: string;
  effectivePrice: number;
  offerCurrencyCode?: string;
  baselineMarkupPercent: number | null;
  baselineFinalSalePrice: number | null;
  partNumber: string | null;
  technicalSpecs: string | null;
  countryOfOrigin: string | null;
  isEquivalent: boolean;
  deliveryTimeDays: number | null;
  /** فاز ۵۱ — دیتاشیتی که بازرگانی هنگام ثبت آفر تأمین‌کننده بارگذاری کرده */
  datasheetUrl: string | null;
}

/**
 * فاز ۶ — پیشنهاد به مشتری (تب ۴). پیش‌شرط: انتخاب نهایی (فاز ۵) قفل شده باشه.
 * پیشنهاد مالی و فنی دو Entity کاملاً مستقل‌ان (نسخه‌بندی/ارسال جدا — طبق design doc،
 * نه دکمه ارسال مشترک mockup) که فقط زمان تحویل فنی از مالی همگام می‌مونه.
 */
@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly selection: SelectionService,
    private readonly notifications: NotificationsService,
    private readonly proposalNumber: ProposalNumberService,
    private readonly activities: ActivitiesService,
  ) {}

  // ------------------------------------------------------------
  // نمای تجمیعی تب ۴
  // ------------------------------------------------------------

  async getProposal(inquiryId: string) {
    const inquiry = await this.assertLocked(inquiryId);
    const baseline = await this.getSelectionBaseline(inquiryId);
    const financial = await this.getOrSeedFinancial(inquiry, baseline);
    const technical = await this.getOrSeedTechnical(inquiry, baseline, financial);

    const [financialHistoryCount, technicalHistoryCount] = await Promise.all([
      this.prisma.financialProposal.count({ where: { inquiryId } }),
      this.prisma.technicalProposal.count({ where: { inquiryId } }),
    ]);

    // فاز ۳۵-ج: نشان «در انتظار تأیید مدیر» برای اقلامی که درخواست کاهش قیمت‌شون هنوز تصمیم‌گیری نشده
    const pendingPriceChanges = await this.prisma.financialProposalPriceChangeRequest.findMany({
      where: { financialProposalItemId: { in: financial.items.map((i) => i.id) }, status: "pending" },
    });
    const pendingByItemId = new Map(pendingPriceChanges.map((r) => [r.financialProposalItemId, r]));
    const financialBase = {
      ...this.formatFinancial(financial),
      historyCount: financialHistoryCount,
      currencyWarnings: this.currencyWarnings(financial, baseline.items),
    };
    // فاز ۵۳ — توزیع هزینه ترم تحویل انتخابی بین اقلام، برای نمایش «ارزش کل شامل ترم تحویل»
    // در تب پیشنهاد به مشتری (فی خام finalSalePrice دست‌نخورده می‌مونه، فقط این محاسبه اضافه‌ست)
    const quantityByItemId = new Map(baseline.items.map((i) => [i.inquiryItemId, i.quantity]));
    const deliveryDistribution = this.distributeDeliveryExtraCost(
      financialBase.items.map((i) => ({
        inquiryItemId: i.inquiryItemId,
        unitPrice: i.finalSalePrice,
        quantity: quantityByItemId.get(i.inquiryItemId) ?? 0,
      })),
      baseline.deliveryOptions,
      financialBase.chosenDeliveryTerm,
    );
    // فاز ۶۰ (اصلاح) — گزینه‌های ترم تحویل («یک پیشنهاد، چند Incoterm») حالا در سطح خودِ استعلام
    // زندگی می‌کنن (InquiryPricingOption)، مستقل از این‌که این نسخه پیشنهاد وجود داره یا نه —
    // تعیین/ویرایش‌شون در تب «انتخاب نهایی و قیمت‌گذاری» (SelectionService) انجام می‌شه؛ اینجا
    // فقط برای نمایش/اصلاح فروش خونده می‌شن. ساختار قدیمی flat (chosenDeliveryTerm/items بالا) دست‌نخورده باقی می‌مونه
    const pricingDeliveryOptions = await this.selection.listPricingOptions(inquiryId);

    const financialFormatted = {
      ...financialBase,
      deliveryExtraCost: deliveryDistribution.extraCost,
      totalAmount: deliveryDistribution.subTotal,
      totalAmountWithDelivery: deliveryDistribution.grandTotal,
      pricingDeliveryOptions,
      items: financialBase.items.map((item) => {
        const pending = pendingByItemId.get(item.id);
        return {
          ...item,
          priceWithDelivery: deliveryDistribution.byItemId.get(item.inquiryItemId)?.unitPrice ?? item.finalSalePrice,
          pendingPriceChangeRequestId: pending?.id ?? null,
          pendingRequestedPrice: pending ? Number(pending.requestedPrice) : null,
        };
      }),
    };

    return {
      inquiryId,
      managerNoteToSales: inquiry.managerNoteToSales,
      // فاز ۳۵-ب: قیمت خرید (effectivePrice) هرگز در پیشنهاد مشتری دیده نشه — فقط برای
      // بذر اولیه‌ی financial_proposal_items داخلی استفاده می‌شه (پایین‌تر)، نه در پاسخ به کلاینت
      baselineItems: baseline.items.map((i) => ({
        inquiryItemId: i.inquiryItemId,
        rowIndex: i.rowIndex,
        itemCode: i.itemCode,
        description: i.customerDescription,
        quantity: i.quantity,
        measurementUnit: i.measurementUnit,
        builder: i.builder,
        supplierName: i.supplierName,
        baselineMarkupPercent: i.baselineMarkupPercent,
        baselineFinalSalePrice: i.baselineFinalSalePrice,
        partNumber: i.partNumber,
        technicalSpecs: i.technicalSpecs,
        countryOfOrigin: i.countryOfOrigin,
        isEquivalent: i.isEquivalent,
        deliveryTimeDays: i.deliveryTimeDays,
        datasheetUrl: i.datasheetUrl,
      })),
      deliveryOptions: baseline.deliveryOptions,
      financial: financialFormatted,
      technical: { ...this.formatTechnical(technical), historyCount: technicalHistoryCount },
    };
  }

  async getHistory(inquiryId: string, kind: "financial" | "technical") {
    await this.assertLocked(inquiryId);
    if (kind === "financial") {
      const rows = await this.prisma.financialProposal.findMany({
        where: { inquiryId },
        include: { items: true },
        orderBy: { version: "desc" },
      });
      // فاز ۵۳ — هر نسخه‌ی تاریخچه با ترم تحویل خودش (نه لزوماً همون ترم نسخه فعلی) توزیع می‌شه
      const baseline = await this.getSelectionBaseline(inquiryId);
      const quantityByItemId = new Map(baseline.items.map((i) => [i.inquiryItemId, i.quantity]));
      return rows.map((r) => {
        const formatted = this.formatFinancial(r);
        const distribution = this.distributeDeliveryExtraCost(
          formatted.items.map((i) => ({
            inquiryItemId: i.inquiryItemId,
            unitPrice: i.finalSalePrice,
            quantity: quantityByItemId.get(i.inquiryItemId) ?? 0,
          })),
          baseline.deliveryOptions,
          formatted.chosenDeliveryTerm,
        );
        return {
          ...formatted,
          deliveryExtraCost: distribution.extraCost,
          totalAmount: distribution.subTotal,
          totalAmountWithDelivery: distribution.grandTotal,
          items: formatted.items.map((i) => ({
            ...i,
            priceWithDelivery: distribution.byItemId.get(i.inquiryItemId)?.unitPrice ?? i.finalSalePrice,
          })),
        };
      });
    }
    const rows = await this.prisma.technicalProposal.findMany({
      where: { inquiryId },
      include: { items: true },
      orderBy: { version: "desc" },
    });
    return rows.map((r) => this.formatTechnical(r));
  }

  // ------------------------------------------------------------
  // پیشنهاد مالی
  // ------------------------------------------------------------

  async saveFinancial(inquiryId: string, dto: SaveFinancialProposalDto, currentUserId: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentFinancialOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("این نسخه ارسال شده — برای ویرایش، «اصلاح (ساخت نسخه جدید)» بزن");
    }

    const currency = await this.prisma.currency.findUnique({ where: { currencyCode: dto.currencyCode } });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }

    // فاز ۵۷ — تغییر ارز در همین نسخه‌ی پیش‌نویس (قبل از اولین ارسال)؛ قبلاً currencyCode بدون
    // هیچ تبدیلی جایگزین می‌شد و قیمت‌های ثبت‌شده با ارز قدیمی زیر برچسب ارز جدید می‌موندن.
    // هم‌الگوی reviseFinancial: هر تغییر ارز نرخ تبدیل الزامیه و روی همین نسخه ذخیره می‌شه.
    const isCurrencyChange = dto.currencyCode !== current.currencyCode;
    if (isCurrencyChange && (!dto.exchangeRate || dto.exchangeRate <= 0)) {
      throw new BadRequestException(
        `چون ارز انتخابی (${dto.currencyCode}) با ارز فعلی این نسخه (${current.currencyCode}) فرق داره، نرخ تبدیل الزامیه`,
      );
    }
    const rate = isCurrencyChange ? dto.exchangeRate! : null;

    if (dto.ourEntityId) {
      const entity = await this.prisma.ourEntity.findUnique({ where: { id: dto.ourEntityId } });
      if (!entity) {
        throw new BadRequestException("شرکت گروه انتخاب‌شده یافت نشد");
      }
    }

    const existingItemIds = new Set(current.items.map((i) => i.inquiryItemId));
    for (const itemDto of dto.items) {
      if (!existingItemIds.has(itemDto.inquiryItemId)) {
        throw new BadRequestException("این قلم در پیشنهاد این پرونده نیست");
      }
    }

    await this.prisma.financialProposal.update({
      where: { id: current.id },
      data: {
        ...(dto.ourEntityId ? { ourEntityId: dto.ourEntityId } : {}),
        chosenDeliveryTerm: dto.chosenDeliveryTerm,
        deliveryDays: dto.deliveryDays,
        deliveryDaysUnit: dto.deliveryDaysUnit ?? "day",
        incotermLocation: dto.incotermLocation,
        shippingMethod: dto.shippingMethod,
        currencyCode: dto.currencyCode,
        paymentTerms: dto.paymentTerms,
        proposalValidityDate: dto.proposalValidityDate ? new Date(dto.proposalValidityDate) : null,
        negotiationNote: dto.negotiationNote,
        paymentMethod: dto.paymentMethod,
        ...(dto.partialShipmentAllowed !== undefined
          ? { partialShipmentAllowed: dto.partialShipmentAllowed }
          : {}),
        ...(dto.documentsChecklist !== undefined ? { documentsChecklist: dto.documentsChecklist } : {}),
        serviceTest: dto.serviceTest,
        serviceFieldService: dto.serviceFieldService,
        serviceDesign: dto.serviceDesign,
        warrantyTerms: dto.warrantyTerms,
        remarks: dto.remarks,
        ...(isCurrencyChange
          ? {
              exchangeRateFromCurrency: current.currencyCode,
              exchangeRateToCurrency: dto.currencyCode,
              exchangeRateValue: rate,
            }
          : {}),
      },
    });

    for (const itemDto of dto.items) {
      const existing = current.items.find((i) => i.inquiryItemId === itemDto.inquiryItemId)!;
      const markupPercent = itemDto.markupPercent ?? Number(existing.markupPercent);
      // فاز ۵۷ — اگه ارز عوض شده، قیمت خرید ذخیره‌شده (که هنوز به ارز قدیمه) قبل از هر محاسبه‌ای
      // با نرخ تازه به ارز جدید تبدیل می‌شه؛ finalSalePrice دستی کاربر (اگه وارد شده) از قبل به
      // ارز جدید فرض می‌شه چون کاربر همون فرمی رو دیده که ارزش الان همون ارز جدیده
      const convertedPurchasePrice = isCurrencyChange
        ? Number(existing.purchasePrice) * rate!
        : Number(existing.purchasePrice);
      const finalSalePrice = itemDto.finalSalePrice ?? convertedPurchasePrice * (1 + markupPercent / 100);

      // فاز ۳۵-ج: اگه قیمت جدید کمتر از قیمت پایهٔ تعیین‌شدهٔ مدیریت باشه، مستقیم اعمال نمی‌شه —
      // یک درخواست تأیید ساخته می‌شه و finalSalePrice قبلی دست‌نخورده می‌مونه تا تصمیم مدیر
      // ⚠️ این مقایسه فقط وقتی معنا داره که ارز عوض نشده باشه — قیمت پایهٔ مدیریت به ارز پایه‌ی
      // مرحلهٔ انتخاب نهایی/ارز اصلیه، نه ارز جدید این پیشنهاد
      const inquiryItem = await this.prisma.inquiryItem.findUnique({
        where: { id: itemDto.inquiryItemId },
        select: { finalSalePrice: true },
      });
      const baselinePrice =
        !isCurrencyChange && inquiryItem?.finalSalePrice != null ? Number(inquiryItem.finalSalePrice) : null;

      if (baselinePrice != null && finalSalePrice < baselinePrice) {
        await this.requestPriceReduction(
          { financialProposalItemId: existing.id },
          finalSalePrice,
          currentUserId,
          `پیشنهاد مالی ${current.proposalNumber}`,
        );
        continue;
      }

      // قیمت جدید در سطح یا بالای خط پایه‌ست → مستقیم اعمال می‌شه؛ هر درخواست معلق قبلی این قلم لغو می‌شه
      await this.prisma.financialProposalItem.update({
        where: { id: existing.id },
        data: {
          markupPercent,
          finalSalePrice,
          ...(isCurrencyChange ? { purchasePrice: convertedPurchasePrice } : {}),
        },
      });
      await this.prisma.financialProposalPriceChangeRequest.updateMany({
        where: { financialProposalItemId: existing.id, status: "pending" },
        data: { status: "rejected", decidedAt: new Date() },
      });
    }

    // فاز ۵۴ — بازخورد کاربر: ترم تحویل پیشنهاد فنی حالا مستقل انتخاب می‌شه (نه لزوماً همون
    // ترم مالی)، پس دیگه اینجا سینک نمی‌شه؛ فقط Incoterm/روش حمل که فیلد اختصاصی در فرم فنی ندارن
    await this.syncTechnicalFromFinancial(inquiryId, {
      incotermLocation: dto.incotermLocation,
      shippingMethod: dto.shippingMethod,
    });

    return this.getProposal(inquiryId);
  }

  /**
   * فاز ۳۵-ج — ساخت/به‌روزرسانی درخواست تأیید کاهش قیمت + اعلان قابل‌اقدام برای دارندگان
   * proposal.approve_price_reduction.
   * فاز ۶۰ (اصلاح) — دو منشأ ممکن (هم‌الگوی letters فرستنده/گیرنده): مسیر «تخت»/تک‌ترمی قدیمی
   * (financialProposalItemId) یا مسیر جدید «چند گزینه ترم تحویل» (pricingOptionItemId) — دقیقاً
   * یکی از این دو باید پر باشه.
   */
  private async requestPriceReduction(
    itemRef: { financialProposalItemId: string } | { pricingOptionItemId: string },
    requestedPrice: number,
    currentUserId: string,
    contextLabel: string,
  ) {
    const existingRequest = await this.prisma.financialProposalPriceChangeRequest.findFirst({
      where: { ...itemRef, status: "pending" },
    });
    const request = existingRequest
      ? await this.prisma.financialProposalPriceChangeRequest.update({
          where: { id: existingRequest.id },
          data: { requestedPrice, requestedBy: currentUserId },
        })
      : await this.prisma.financialProposalPriceChangeRequest.create({
          data: { ...itemRef, requestedPrice, requestedBy: currentUserId },
        });

    const approvers = await this.prisma.user.findMany({
      where: {
        status: "active",
        permissionGroup: {
          items: { some: { permission: { permissionKey: "proposal.approve_price_reduction" } } },
        },
      },
      select: { id: true },
    });
    for (const approver of approvers) {
      await this.notifications.create({
        userId: approver.id,
        type: "proposal_price_reduction_request",
        title: `درخواست کاهش قیمت ${contextLabel}`,
        message: `قیمت پیشنهادی جدید: ${requestedPrice} — کمتر از قیمت پایه تعیین‌شدهٔ مدیریت`,
        relatedEntityType: "proposal_price_change_request",
        relatedEntityId: request.id,
        actions: [
          { label: "تأیید", action: "approve" },
          { label: "رد", action: "reject" },
        ],
      });
    }
    return request;
  }

  async decidePriceChangeRequest(requestId: string, decision: "approved" | "rejected", currentUserId: string) {
    const request = await this.prisma.financialProposalPriceChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        legacyItem: {
          include: {
            proposal: { select: { inquiryId: true, proposalNumber: true, version: true } },
            inquiryItem: { select: { rowIndex: true, itemCode: true } },
          },
        },
        item: {
          include: {
            option: { select: { inquiryId: true, deliveryTerm: true } },
            inquiryItem: { select: { rowIndex: true, itemCode: true } },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException("درخواست تغییر قیمت یافت نشد");
    }
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست قبلاً تصمیم‌گیری شده");
    }

    await this.prisma.financialProposalPriceChangeRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedBy: currentUserId, decidedAt: new Date() },
    });

    if (decision === "approved") {
      if (request.legacyItem) {
        await this.prisma.financialProposalItem.update({
          where: { id: request.financialProposalItemId! },
          data: { finalSalePrice: request.requestedPrice },
        });
      } else if (request.item) {
        await this.prisma.inquiryPricingOptionItem.update({
          where: { id: request.pricingOptionItemId! },
          data: { finalSalePrice: request.requestedPrice },
        });
      }
    }

    const inquiryId = request.legacyItem?.proposal.inquiryId ?? request.item!.option.inquiryId;
    const rowIndex = request.legacyItem?.inquiryItem.rowIndex ?? request.item!.inquiryItem.rowIndex;
    const contextLabel = request.legacyItem
      ? `در پیشنهاد مالی نسخه ${request.legacyItem.proposal.version}`
      : `در گزینه ${request.item!.option.deliveryTerm}`;
    await this.notifications.create({
      userId: request.requestedBy,
      type: "proposal_price_reduction_decided",
      title:
        decision === "approved"
          ? `درخواست کاهش قیمت ردیف ${rowIndex} تأیید شد`
          : `درخواست کاهش قیمت ردیف ${rowIndex} رد شد`,
      message:
        decision === "approved"
          ? `قیمت جدید (${Number(request.requestedPrice)}) ${contextLabel} اعمال شد`
          : `درخواست کاهش قیمت ردیف ${rowIndex} پذیرفته نشد — قیمت پایه بدون تغییر می‌مونه`,
      relatedEntityType: "inquiry",
      relatedEntityId: inquiryId,
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text:
        decision === "approved"
          ? `درخواست کاهش قیمت ردیف ${rowIndex} تأیید شد`
          : `درخواست کاهش قیمت ردیف ${rowIndex} رد شد`,
      tag: "approval",
      metadata: { module: "proposal", action: `price_reduction_${decision}`, requestId },
    });

    return { success: true };
  }

  async setFinancialFile(inquiryId: string, fileUrl: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentFinancialOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("این نسخه ارسال شده — برای اصلاح فایل، نسخه جدید بساز");
    }
    await this.prisma.financialProposal.update({ where: { id: current.id }, data: { fileUrl } });
    return this.getProposal(inquiryId);
  }

  async sendFinancial(inquiryId: string, currentUserId: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentFinancialOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("پیشنهاد مالی همین نسخه قبلاً ارسال شده");
    }
    await this.prisma.financialProposal.update({ where: { id: current.id }, data: { sentAt: new Date() } });
    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `پیشنهاد مالی (نسخه ${current.version}) برای مشتری ارسال شد`,
      tag: "stage_completed",
      metadata: { module: "proposal", action: "financial_sent", version: current.version },
    });
    await this.advanceToAwaitingCustomerOutcome(inquiryId, currentUserId);
    return this.getProposal(inquiryId);
  }

  /**
   * فاز ۵۱ — اگه newCurrencyCode متفاوت از ارز نسخه فعلی باشه، exchangeRate الزامیه:
   * تمام قیمت‌های قلم‌ها (خرید و فروش) در این نرخ ضرب می‌شن و خود نرخ روی نسخه جدید
   * ذخیره می‌شه (برای ارجاع بعدی در اسناد/حسابرسی) — markupPercent بدون تغییر می‌مونه
   * چون یک نسبته، نه مبلغ.
   */
  async reviseFinancial(
    inquiryId: string,
    currentUserId: string,
    currencyChange?: { newCurrencyCode?: string; exchangeRate?: number },
  ) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentFinancialOrThrow(inquiryId);
    if (!current.sentAt) {
      throw new BadRequestException("این نسخه هنوز ارسال نشده — نیازی به نسخه جدید نیست");
    }
    const nextVersion = current.version + 1;
    const ourEntity = await this.resolveOurEntity(current.ourEntityId);

    const newCurrencyCode = currencyChange?.newCurrencyCode;
    const isCurrencyChange = !!newCurrencyCode && newCurrencyCode !== current.currencyCode;
    if (isCurrencyChange) {
      const currency = await this.prisma.currency.findUnique({ where: { currencyCode: newCurrencyCode } });
      if (!currency) {
        throw new BadRequestException("ارز نامعتبره");
      }
      if (!currencyChange?.exchangeRate || currencyChange.exchangeRate <= 0) {
        throw new BadRequestException(
          `چون ارز نسخه جدید (${newCurrencyCode}) با ارز نسخه فعلی (${current.currencyCode}) فرق داره، نرخ تبدیل الزامیه`,
        );
      }
    }
    const rate = isCurrencyChange ? currencyChange!.exchangeRate! : null;

    await this.prisma.$transaction(async (tx) => {
      const proposalNumber = await this.proposalNumber.nextNumber(tx, inquiryId);
      await tx.financialProposal.update({ where: { id: current.id }, data: { status: "superseded" } });
      await tx.financialProposal.create({
        data: {
          proposalNumber,
          inquiryId,
          version: nextVersion,
          status: "current",
          preparedDate: new Date(),
          currencyCode: isCurrencyChange ? newCurrencyCode! : current.currencyCode,
          chosenDeliveryTerm: current.chosenDeliveryTerm,
          deliveryDays: current.deliveryDays,
          deliveryDaysUnit: current.deliveryDaysUnit,
          incotermLocation: current.incotermLocation,
          shippingMethod: current.shippingMethod,
          paymentTerms: current.paymentTerms,
          proposalValidityDate: current.proposalValidityDate,
          ourEntityId: ourEntity?.id ?? null,
          paymentMethod: current.paymentMethod,
          partialShipmentAllowed: current.partialShipmentAllowed,
          documentsChecklist: current.documentsChecklist,
          serviceTest: current.serviceTest,
          serviceFieldService: current.serviceFieldService,
          serviceDesign: current.serviceDesign,
          warrantyTerms: current.warrantyTerms,
          remarks: current.remarks,
          ...(isCurrencyChange
            ? {
                exchangeRateFromCurrency: current.currencyCode,
                exchangeRateToCurrency: newCurrencyCode,
                exchangeRateValue: rate,
              }
            : {}),
          items: {
            create: current.items.map((i) => ({
              inquiryItemId: i.inquiryItemId,
              purchasePrice: isCurrencyChange ? Number(i.purchasePrice) * rate! : i.purchasePrice,
              markupPercent: i.markupPercent,
              finalSalePrice: isCurrencyChange ? Number(i.finalSalePrice) * rate! : i.finalSalePrice,
            })),
          },
        },
      });
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: isCurrencyChange
        ? `نسخه جدید پیشنهاد مالی (نسخه ${nextVersion}) با تبدیل ارز از ${current.currencyCode} به ${newCurrencyCode} (نرخ ${rate}) ساخته شد`
        : `نسخه جدید پیشنهاد مالی (نسخه ${nextVersion}) برای اصلاح ساخته شد`,
      tag: "general",
      metadata: { module: "proposal", action: "financial_revised", version: nextVersion },
    });

    return this.getProposal(inquiryId);
  }

  // ------------------------------------------------------------
  // فاز ۶۰ (اصلاح) — هزینه‌های اضافی/گزینه‌های ترم تحویل/مارک‌آپ («تعیین حاشیه سود») به مرحله
  // «انتخاب نهایی و قیمت‌گذاری» منتقل شدن — نگاه کنید به SelectionService/SelectionController
  // (pricing-costs, pricing-options, .../markup). اینجا فقط اصلاح فروش می‌مونه: کاری که واقعاً
  // در تب «پیشنهاد به مشتری» انجام می‌شه — مشاهده‌ی قیمت محاسبه‌شده بازرگانی (فقط‌خواندنی) و
  // اعمال یک اصلاح (تخفیف/افزایش) روی همون قیمت، هرگز خودِ مارک‌آپ.
  // ------------------------------------------------------------

  /**
   * اصلاح فروش — فقط salesAdjustmentAmount/reasonCode/note رو می‌نویسه؛ commercialCalculatedPrice
   * (و markupPercent که تعیین‌کننده‌ی همون قیمته، و در مرحله انتخاب نهایی تعیین می‌شه) هرگز اینجا
   * تغییر نمی‌کنه — دقیقاً الزام بخش ۱۲ اسپک («فروش نباید حاشیه سود بازرگانی رو تغییر بده»). اگه
   * قیمت نهایی جدید کمتر از خط پایه‌ی مدیریت (inquiry_items.final_sale_price) باشه، همون گردش
   * تأیید موجود (فاز ۳۵-ج) صدا زده می‌شه.
   */
  async saveSalesAdjustment(
    inquiryId: string,
    optionId: string,
    dto: SaveSalesAdjustmentDto,
    currentUserId: string,
  ) {
    await this.assertLocked(inquiryId);
    const option = await this.prisma.inquiryPricingOption.findFirst({ where: { id: optionId, inquiryId } });
    if (!option) {
      throw new NotFoundException("گزینه ترم تحویل یافت نشد");
    }
    const item = await this.prisma.inquiryPricingOptionItem.findFirst({
      where: { optionId, inquiryItemId: dto.inquiryItemId },
    });
    if (!item) {
      throw new NotFoundException("قلم مورد نظر در این گزینه یافت نشد");
    }
    if (item.commercialCalculatedPrice == null) {
      throw new BadRequestException(
        "ابتدا باید قیمت بازرگانی این قلم در مرحله «انتخاب نهایی و قیمت‌گذاری» محاسبه شده باشه",
      );
    }

    const finalSalePrice = Number(item.commercialCalculatedPrice) + dto.adjustmentAmount;
    if (!Number.isFinite(finalSalePrice) || finalSalePrice < 0) {
      throw new BadRequestException("قیمت نهایی حاصل نامعتبره");
    }

    const inquiryItem = await this.prisma.inquiryItem.findUnique({
      where: { id: dto.inquiryItemId },
      select: { finalSalePrice: true },
    });
    const baselinePrice = inquiryItem?.finalSalePrice != null ? Number(inquiryItem.finalSalePrice) : null;

    if (baselinePrice != null && finalSalePrice < baselinePrice) {
      await this.prisma.inquiryPricingOptionItem.update({
        where: { id: item.id },
        data: {
          salesAdjustmentAmount: dto.adjustmentAmount,
          salesAdjustmentReasonCode: dto.reasonCode,
          salesAdjustmentNote: dto.note,
          salesAdjustedBy: currentUserId,
          salesAdjustedAt: new Date(),
        },
      });
      await this.requestPriceReduction(
        { pricingOptionItemId: item.id },
        finalSalePrice,
        currentUserId,
        `گزینه ${option.deliveryTerm}`,
      );
      return this.selection.getPricingOptionOrThrow(inquiryId, optionId);
    }

    await this.prisma.inquiryPricingOptionItem.update({
      where: { id: item.id },
      data: {
        salesAdjustmentAmount: dto.adjustmentAmount,
        salesAdjustmentReasonCode: dto.reasonCode,
        salesAdjustmentNote: dto.note,
        salesAdjustedBy: currentUserId,
        salesAdjustedAt: new Date(),
        finalSalePrice,
      },
    });
    await this.prisma.financialProposalPriceChangeRequest.updateMany({
      where: { pricingOptionItemId: item.id, status: "pending" },
      data: { status: "rejected", decidedAt: new Date() },
    });

    return this.selection.getPricingOptionOrThrow(inquiryId, optionId);
  }

  // ------------------------------------------------------------
  // پیشنهاد فنی
  // ------------------------------------------------------------

  async saveTechnical(inquiryId: string, dto: SaveTechnicalProposalDto) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentTechnicalOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("این نسخه ارسال شده — برای ویرایش، «اصلاح (ساخت نسخه جدید)» بزن");
    }

    if (dto.ourEntityId) {
      const entity = await this.prisma.ourEntity.findUnique({ where: { id: dto.ourEntityId } });
      if (!entity) {
        throw new BadRequestException("شرکت گروه انتخاب‌شده یافت نشد");
      }
    }

    const existingItemIds = new Set(current.items.map((i) => i.inquiryItemId));
    for (const itemDto of dto.items) {
      if (!existingItemIds.has(itemDto.inquiryItemId)) {
        throw new BadRequestException("این قلم در پیشنهاد این پرونده نیست");
      }
    }

    await this.prisma.technicalProposal.update({
      where: { id: current.id },
      data: {
        ...(dto.ourEntityId ? { ourEntityId: dto.ourEntityId } : {}),
        chosenDeliveryTerm: dto.chosenDeliveryTerm,
        deliveryTimeEstimateDays: dto.deliveryTimeEstimateDays,
        deliveryDaysUnit: dto.deliveryDaysUnit ?? "day",
        negotiationNote: dto.negotiationNote,
      },
    });

    for (const itemDto of dto.items) {
      const existing = current.items.find((i) => i.inquiryItemId === itemDto.inquiryItemId)!;
      await this.prisma.technicalProposalItem.update({
        where: { id: existing.id },
        data: { technicalSpecs: itemDto.technicalSpecs, complianceNote: itemDto.complianceNote },
      });
    }

    return this.getProposal(inquiryId);
  }

  async setTechnicalFile(inquiryId: string, fileUrl: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentTechnicalOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("این نسخه ارسال شده — برای اصلاح فایل، نسخه جدید بساز");
    }
    await this.prisma.technicalProposal.update({ where: { id: current.id }, data: { fileUrl } });
    return this.getProposal(inquiryId);
  }

  async sendTechnical(inquiryId: string, currentUserId: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentTechnicalOrThrow(inquiryId);
    if (current.sentAt) {
      throw new BadRequestException("پیشنهاد فنی همین نسخه قبلاً ارسال شده");
    }
    await this.prisma.technicalProposal.update({ where: { id: current.id }, data: { sentAt: new Date() } });
    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `پیشنهاد فنی (نسخه ${current.version}) برای مشتری ارسال شد`,
      tag: "stage_completed",
      metadata: { module: "proposal", action: "technical_sent", version: current.version },
    });
    await this.advanceToAwaitingCustomerOutcome(inquiryId, currentUserId);
    return this.getProposal(inquiryId);
  }

  async reviseTechnical(inquiryId: string, currentUserId: string) {
    await this.assertLocked(inquiryId);
    const current = await this.getCurrentTechnicalOrThrow(inquiryId);
    if (!current.sentAt) {
      throw new BadRequestException("این نسخه هنوز ارسال نشده — نیازی به نسخه جدید نیست");
    }
    const nextVersion = current.version + 1;
    const currentFinancial = await this.prisma.financialProposal.findFirst({
      where: { inquiryId, status: "current" },
    });
    const ourEntity = await this.resolveOurEntity(current.ourEntityId);

    await this.prisma.$transaction(async (tx) => {
      const proposalNumber = await this.proposalNumber.nextNumber(tx, inquiryId);
      await tx.technicalProposal.update({ where: { id: current.id }, data: { status: "superseded" } });
      await tx.technicalProposal.create({
        data: {
          proposalNumber,
          inquiryId,
          version: nextVersion,
          status: "current",
          preparedDate: new Date(),
          // ⚠️ رفع باگ کناری: قبلاً chosenDeliveryTerm/deliveryDaysUnit اصلاً به نسخه جدید منتقل
          // نمی‌شدن (ترم مستقل فنی گم می‌شد) و deliveryTimeEstimateDays همیشه از مالی می‌اومد،
          // حتی وقتی فنی ترم/زمان مستقل خودش رو داشت (فاز ۵۴) — حالا مقادیر خودِ نسخه فعلی حفظ می‌شن
          chosenDeliveryTerm: current.chosenDeliveryTerm ?? currentFinancial?.chosenDeliveryTerm ?? null,
          deliveryTimeEstimateDays: current.deliveryTimeEstimateDays ?? currentFinancial?.deliveryDays ?? null,
          deliveryDaysUnit: current.deliveryDaysUnit,
          ourEntityId: ourEntity?.id ?? null,
          items: {
            create: current.items.map((i) => ({
              inquiryItemId: i.inquiryItemId,
              technicalSpecs: i.technicalSpecs,
              complianceNote: i.complianceNote,
            })),
          },
        },
      });
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `نسخه جدید پیشنهاد فنی (نسخه ${nextVersion}) برای اصلاح ساخته شد`,
      tag: "general",
      metadata: { module: "proposal", action: "technical_revised", version: nextVersion },
    });

    return this.getProposal(inquiryId);
  }

  // ------------------------------------------------------------
  // داده‌ی سند PDF/Word (فاز ۳۸) — مالی با قیمت، فنی بدون قیمت
  // ------------------------------------------------------------

  async getDocumentData(inquiryId: string, kind: "financial" | "technical", deliveryOptionId?: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        buyer: true,
        buyerContact: true,
        salesExpert: { select: { fullName: true, fullNameEn: true, phone: true, mobile: true, email: true } },
      },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    if (!inquiry.selectionLockedAt) {
      throw new BadRequestException("ابتدا باید مرحله «انتخاب نهایی» توسط مدیریت قفل بشه");
    }

    const baseline = await this.getSelectionBaseline(inquiryId);
    const common = {
      buyer: inquiry.buyer,
      buyerContact: inquiry.buyerContact,
      salesExpertName: inquiry.salesExpert.fullName,
      salesExpertNameEn: inquiry.salesExpert.fullNameEn,
      // فاز ۵۱ — مشخصات تماس کارشناس فروش، برای پایین سند
      salesExpertExtension: inquiry.salesExpert.phone,
      salesExpertMobile: inquiry.salesExpert.mobile,
      salesExpertEmail: inquiry.salesExpert.email,
      // فاز ۵۱ — بازخورد کاربر: «به‌جای INQUIRY NO بنویس CLIENT REFERENCE»
      clientReference: inquiry.inquiryNumber,
      inquiryNumber: inquiry.inquiryNumber,
      internalNumber: inquiry.internalNumber,
    };

    if (kind === "financial") {
      const proposal = await this.getCurrentFinancialOrThrow(inquiryId);
      const ourEntity = await this.resolveOurEntity(proposal.ourEntityId);

      // فاز ۶۰ (اصلاح) — وقتی یک گزینه‌ی ترم تحویل مشخص درخواست شده، سند فقط از داده‌ی همون گزینه
      // (که حالا در سطح خودِ استعلام زندگی می‌کنه، نه این نسخه‌ی پیشنهاد) ساخته می‌شه — نه ستون‌های
      // تخت proposal.chosenDeliveryTerm/items — این تضمین ساختاریه که هیچ دیتایی بین گزینه‌ها
      // (مثلاً CPT و DDP) قاطی نمی‌شه، نه صرفاً انضباط برنامه‌نویس.
      if (deliveryOptionId) {
        const option = await this.prisma.inquiryPricingOption.findFirst({
          where: { id: deliveryOptionId, inquiryId },
          include: { items: true },
        });
        if (!option) {
          throw new NotFoundException("گزینه ترم تحویل یافت نشد");
        }
        const priceByItemIdForOption = new Map(option.items.map((i) => [i.inquiryItemId, i]));
        const items = baseline.items
          .filter((b) => priceByItemIdForOption.has(b.inquiryItemId))
          .map((b) => {
            const priced = priceByItemIdForOption.get(b.inquiryItemId)!;
            return {
              rowIndex: b.rowIndex,
              partNumber: b.partNumber,
              description: b.customerDescription,
              builder: b.builder,
              countryOfOrigin: b.countryOfOrigin,
              quantity: b.quantity,
              measurementUnit: b.measurementUnit,
              isEquivalent: b.isEquivalent,
              unitPrice: Number(priced.finalSalePrice),
              totalPrice: Number(priced.finalSalePrice) * b.quantity,
            };
          });
        return {
          kind: "financial" as const,
          proposalId: proposal.id,
          proposalNumber: proposal.proposalNumber,
          version: proposal.version,
          preparedDate: proposal.preparedDate,
          proposalValidityDate: proposal.proposalValidityDate,
          currencyCode: option.currencyCode as string | null,
          chosenDeliveryTerm: option.deliveryTerm as string | null,
          deliveryDays: option.deliveryDays as number | null,
          deliveryDaysUnit: option.deliveryDaysUnit as "day" | "week",
          incotermLocation: option.incotermLocation as string | null,
          shippingMethod: option.shippingMethod as string | null,
          paymentTerms: option.paymentTerms,
          exchangeRateFromCurrency: option.exchangeRateFromCurrency as string | null,
          exchangeRateToCurrency: option.currencyCode as string | null,
          exchangeRateValue: option.exchangeRateValue ? Number(option.exchangeRateValue) : null,
          paymentMethod: proposal.paymentMethod as string | null,
          partialShipmentAllowed: proposal.partialShipmentAllowed,
          documentsChecklist: proposal.documentsChecklist as string[],
          serviceTest: proposal.serviceTest as string | null,
          serviceFieldService: proposal.serviceFieldService as string | null,
          serviceDesign: proposal.serviceDesign as string | null,
          warrantyTerms: proposal.warrantyTerms as string | null,
          remarks: proposal.remarks as string | null,
          ourEntity,
          items,
          totalAmount: items.reduce((sum, i) => sum + i.totalPrice, 0),
          ...common,
        };
      }

      const priceByItemId = new Map(proposal.items.map((i) => [i.inquiryItemId, i]));
      // فاز ۵۳ — قیمت‌های سند نهایی مشتری شامل هزینه‌ی توزیع‌شده‌ی ترم تحویل انتخابی‌ان
      // (هم‌الگوی VAT/سایر هزینه‌های آفر تأمین‌کننده): هر ردیف سهم متناسب خودش رو می‌گیره
      const deliveryDistribution = this.distributeDeliveryExtraCost(
        baseline.items.map((b) => ({
          inquiryItemId: b.inquiryItemId,
          unitPrice: priceByItemId.get(b.inquiryItemId)?.finalSalePrice
            ? Number(priceByItemId.get(b.inquiryItemId)!.finalSalePrice)
            : 0,
          quantity: b.quantity,
        })),
        baseline.deliveryOptions,
        proposal.chosenDeliveryTerm as string | null,
      );
      const items = baseline.items.map((b) => {
        const adjusted = deliveryDistribution.byItemId.get(b.inquiryItemId);
        return {
          rowIndex: b.rowIndex,
          partNumber: b.partNumber,
          description: b.customerDescription,
          builder: b.builder,
          countryOfOrigin: b.countryOfOrigin,
          quantity: b.quantity,
          measurementUnit: b.measurementUnit,
          isEquivalent: b.isEquivalent,
          unitPrice: adjusted?.unitPrice ?? 0,
          totalPrice: adjusted?.totalPrice ?? 0,
        };
      });
      return {
        kind: "financial" as const,
        proposalId: proposal.id,
        proposalNumber: proposal.proposalNumber,
        version: proposal.version,
        preparedDate: proposal.preparedDate,
        proposalValidityDate: proposal.proposalValidityDate,
        currencyCode: proposal.currencyCode as string | null,
        chosenDeliveryTerm: proposal.chosenDeliveryTerm as string | null,
        deliveryDays: proposal.deliveryDays as number | null,
        deliveryDaysUnit: proposal.deliveryDaysUnit as "day" | "week",
        incotermLocation: proposal.incotermLocation as string | null,
        shippingMethod: proposal.shippingMethod as string | null,
        paymentTerms: proposal.paymentTerms,
        exchangeRateFromCurrency: proposal.exchangeRateFromCurrency as string | null,
        exchangeRateToCurrency: proposal.exchangeRateToCurrency as string | null,
        exchangeRateValue: proposal.exchangeRateValue ? Number(proposal.exchangeRateValue) : null,
        paymentMethod: proposal.paymentMethod as string | null,
        partialShipmentAllowed: proposal.partialShipmentAllowed,
        documentsChecklist: proposal.documentsChecklist as string[],
        serviceTest: proposal.serviceTest as string | null,
        serviceFieldService: proposal.serviceFieldService as string | null,
        serviceDesign: proposal.serviceDesign as string | null,
        warrantyTerms: proposal.warrantyTerms as string | null,
        remarks: proposal.remarks as string | null,
        ourEntity,
        items,
        totalAmount: deliveryDistribution.grandTotal,
        ...common,
      };
    }

    const proposal = await this.getCurrentTechnicalOrThrow(inquiryId);
    const ourEntity = await this.resolveOurEntity(proposal.ourEntityId);
    const items = baseline.items.map((b) => ({
      rowIndex: b.rowIndex,
      partNumber: b.partNumber,
      description: b.customerDescription,
      builder: b.builder,
      countryOfOrigin: b.countryOfOrigin,
      quantity: b.quantity,
      measurementUnit: b.measurementUnit,
      isEquivalent: b.isEquivalent,
      unitPrice: null,
      totalPrice: null,
    }));
    return {
      kind: "technical" as const,
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber,
      version: proposal.version,
      preparedDate: proposal.preparedDate,
      proposalValidityDate: null as Date | null,
      currencyCode: null as string | null,
      chosenDeliveryTerm: proposal.chosenDeliveryTerm as string | null,
      deliveryDays: proposal.deliveryTimeEstimateDays,
      deliveryDaysUnit: proposal.deliveryDaysUnit as "day" | "week",
      incotermLocation: proposal.incotermLocation as string | null,
      shippingMethod: proposal.shippingMethod as string | null,
      paymentTerms: null as string | null,
      exchangeRateFromCurrency: null as string | null,
      exchangeRateToCurrency: null as string | null,
      exchangeRateValue: null as number | null,
      paymentMethod: null as string | null,
      partialShipmentAllowed: null as boolean | null,
      documentsChecklist: [] as string[],
      serviceTest: null as string | null,
      serviceFieldService: null as string | null,
      serviceDesign: null as string | null,
      warrantyTerms: null as string | null,
      remarks: null as string | null,
      ourEntity,
      items,
      totalAmount: null as number | null,
      ...common,
    };
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async assertLocked(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, internalNumber: true, managerNoteToSales: true, selectionLockedAt: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    if (!inquiry.selectionLockedAt) {
      throw new BadRequestException("ابتدا باید مرحله «انتخاب نهایی» توسط مدیریت قفل بشه");
    }
    return inquiry;
  }

  /**
   * فاز ۵۸ — Trigger #۴ (erp-database-design.md دامنه ۱۴). مالی و فنی دو Entity مستقل‌ان
   * که هرکدوم جدا ارسال می‌شن؛ اولین ارسال (هرکدوم زودتر باشه) proposal_pending رو می‌بنده
   * و awaiting_customer_outcome رو باز می‌کنه — چک alreadyOpen مانع باز شدن دوباره با ارسال
   * دومی می‌شه.
   */
  private async advanceToAwaitingCustomerOutcome(inquiryId: string, currentUserId: string) {
    const alreadyOpen = await this.prisma.activity.findFirst({
      where: {
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
        relatedStageCode: "awaiting_customer_outcome",
        status: { notIn: ["completed", "cancelled"] },
      },
    });
    if (alreadyOpen) return;

    const inquiry = await this.prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { salesExpertId: true, offerEndDate: true, extendedOfferEndDate: true },
    });

    await this.activities.closeStageActivities(inquiryId, "proposal_pending", currentUserId);
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "awaiting_customer_outcome",
      activityType: "follow_up",
      subject: "پیگیری پاسخ مشتری به پیشنهاد ارسالی",
      assignedToUserId: inquiry.salesExpertId,
      triggeredByUserId: currentUserId,
      dueAt: inquiry.extendedOfferEndDate ?? inquiry.offerEndDate,
    });
  }

  private async getCurrentFinancialOrThrow(inquiryId: string) {
    const current = await this.prisma.financialProposal.findFirst({
      where: { inquiryId, status: "current" },
      include: { items: true },
    });
    if (!current) {
      throw new NotFoundException("پیشنهاد مالی یافت نشد — ابتدا وارد تب پیشنهاد شو");
    }
    return current;
  }

  private async getCurrentTechnicalOrThrow(inquiryId: string) {
    const current = await this.prisma.technicalProposal.findFirst({
      where: { inquiryId, status: "current" },
      include: { items: true },
    });
    if (!current) {
      throw new NotFoundException("پیشنهاد فنی یافت نشد — ابتدا وارد تب پیشنهاد شو");
    }
    return current;
  }

  /**
   * فاز ۵۱ — Incoterm/روش حمل از مالی به فنی همگام می‌شه چون فرم فنی فیلد اختصاصی برای این دو نداره.
   * ⚠️ فاز ۵۴ — زمان تحویل/ترم تحویل از این سینک حذف شدن: طبق بازخورد کاربر، پیشنهاد فنی حالا
   * ترم تحویل مستقل خودش رو داره (نگاه کنید به SaveTechnicalProposalDto.chosenDeliveryTerm)
   */
  private async syncTechnicalFromFinancial(
    inquiryId: string,
    fields: {
      incotermLocation?: string;
      shippingMethod?: string;
    },
  ) {
    const currentTechnical = await this.prisma.technicalProposal.findFirst({
      where: { inquiryId, status: "current" },
    });
    if (currentTechnical && !currentTechnical.sentAt) {
      await this.prisma.technicalProposal.update({
        where: { id: currentTechnical.id },
        data: {
          incotermLocation: fields.incotermLocation,
          shippingMethod: fields.shippingMethod,
        },
      });
    }
  }

  private async getSelectionBaseline(inquiryId: string) {
    const state = await this.selection.getSelection(inquiryId);
    // فاز ۵۷ — وقتی ارز مبنای انتخاب نهایی فعاله، effectivePrice/offerCurrencyCode باید همون ارز
    // مبنا رو منعکس کنن، نه ارز خام آفر تأمین‌کننده — چون baselineFinalSalePrice (از inquiry_items)
    // از این به بعد قبلاً به ارز مبنا تبدیل و ذخیره شده (نگاه کنید به SelectionService.save)
    const baseCurrency = state.selectionBaseCurrencyCode as string | null;
    const finalizedItems = (state.items as Array<Record<string, unknown>>).filter(
      (i) => !!i.selectedOfferItemId,
    );
    const offerItemIds = finalizedItems.map((i) => i.selectedOfferItemId as string);
    const offerItemDetails = await this.prisma.supplierOfferItem.findMany({
      where: { id: { in: offerItemIds } },
      select: {
        id: true,
        technicalSpecs: true,
        countryOfOrigin: true,
        isEquivalent: true,
        partNumber: true,
        builder: true,
        datasheetUrl: true,
      },
    });
    const detailsMap = new Map(offerItemDetails.map((d) => [d.id, d]));

    const items: BaselineItem[] = finalizedItems.map((i) => {
      const offers = i.offers as Array<Record<string, unknown>>;
      const chosen = offers.find((o) => o.offerItemId === i.selectedOfferItemId);
      const details = detailsMap.get(i.selectedOfferItemId as string);
      const inquiryDescription = i.description as string;
      const supplierTechnicalSpecs = details?.technicalSpecs?.trim();
      const inquiryBuilder = (i.builder as string | null) ?? null;
      // فاز ۵۵ — بازخورد کاربر: برند/سازنده‌ی پیشنهادی همون آفر تأمین‌کننده اولویت داره
      // (ممکنه با برند اولیه‌ی استعلام فرق داشته باشه)؛ fallback به برند استعلام فقط وقتی
      // تأمین‌کننده صراحتاً برندی وارد نکرده — دقیقاً هم‌الگوی customerDescription (فاز ۴۴)
      const supplierBuilder = details?.builder?.trim();
      const chosenTyped = chosen as
        | { effectivePrice?: number; effectivePriceInBaseCurrency?: number | null; currencyCode?: string }
        | undefined;
      const effectivePriceInCurrentCurrency =
        baseCurrency && chosenTyped?.effectivePriceInBaseCurrency != null
          ? chosenTyped.effectivePriceInBaseCurrency
          : (chosenTyped?.effectivePrice ?? 0);
      return {
        inquiryItemId: i.id as string,
        rowIndex: i.rowIndex as number,
        itemCode: i.itemCode as string,
        description: inquiryDescription,
        customerDescription: supplierTechnicalSpecs || inquiryDescription,
        quantity: i.quantity as number,
        measurementUnit: i.measurementUnit as string,
        builder: supplierBuilder || inquiryBuilder,
        supplierName: (chosen?.supplier as { companyName?: string } | undefined)?.companyName,
        effectivePrice: effectivePriceInCurrentCurrency,
        offerCurrencyCode: baseCurrency ?? (chosenTyped?.currencyCode as string | undefined),
        baselineMarkupPercent: i.markupPercent as number | null,
        baselineFinalSalePrice: i.finalSalePrice as number | null,
        partNumber: details?.partNumber ?? null,
        technicalSpecs: details?.technicalSpecs ?? null,
        countryOfOrigin: details?.countryOfOrigin ?? null,
        isEquivalent: details?.isEquivalent ?? false,
        deliveryTimeDays: (chosen?.deliveryTimeDays as number | undefined) ?? null,
        datasheetUrl: details?.datasheetUrl ?? null,
      };
    });

    return {
      items,
      deliveryOptions: state.deliveryOptions as Array<{
        deliveryTerm: string;
        extraCost: number;
        deliveryDays: number;
      }>,
      totalsByCurrency: state.totalsByCurrency as Record<string, number>,
    };
  }

  private async getOrSeedFinancial(
    inquiry: { id: string; internalNumber: string },
    baseline: Awaited<ReturnType<ProposalService["getSelectionBaseline"]>>,
  ) {
    const existing = await this.prisma.financialProposal.findFirst({
      where: { inquiryId: inquiry.id, status: "current" },
      include: { items: true },
      orderBy: { version: "desc" },
    });
    if (existing) return existing;

    if (baseline.items.length === 0) {
      throw new BadRequestException(
        "هیچ قلمی در مرحله انتخاب نهایی آفر منتخب نداره — امکان تولید پیشنهاد نیست",
      );
    }
    if (baseline.deliveryOptions.length === 0) {
      throw new BadRequestException("ابتدا حداقل یک گزینه ترم تحویل در تب «انتخاب نهایی» تعریف کن");
    }

    const cheapest = [...baseline.deliveryOptions].sort((a, b) => a.extraCost - b.extraCost)[0];
    const currencyCode = this.pickMajorityCurrency(baseline.totalsByCurrency);
    const ourEntity = await this.resolveOurEntity(null);

    return this.prisma.$transaction(async (tx) => {
      const proposalNumber = await this.proposalNumber.nextNumber(tx, inquiry.id);
      return tx.financialProposal.create({
        data: {
          proposalNumber,
          inquiryId: inquiry.id,
          version: 1,
          status: "current",
          preparedDate: new Date(),
          currencyCode,
          chosenDeliveryTerm: cheapest.deliveryTerm,
          deliveryDays: cheapest.deliveryDays,
          ourEntityId: ourEntity?.id ?? null,
          items: {
            create: baseline.items.map((i) => ({
              inquiryItemId: i.inquiryItemId,
              purchasePrice: i.effectivePrice,
              markupPercent: i.baselineMarkupPercent ?? 0,
              finalSalePrice: i.baselineFinalSalePrice ?? i.effectivePrice,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  private async getOrSeedTechnical(
    inquiry: { id: string; internalNumber: string },
    baseline: Awaited<ReturnType<ProposalService["getSelectionBaseline"]>>,
    financial: { deliveryDays: number; chosenDeliveryTerm: string; ourEntityId: string | null },
  ) {
    const existing = await this.prisma.technicalProposal.findFirst({
      where: { inquiryId: inquiry.id, status: "current" },
      include: { items: true },
      orderBy: { version: "desc" },
    });
    if (existing) return existing;

    const ourEntity = await this.resolveOurEntity(financial.ourEntityId);

    return this.prisma.$transaction(async (tx) => {
      const proposalNumber = await this.proposalNumber.nextNumber(tx, inquiry.id);
      return tx.technicalProposal.create({
        data: {
          proposalNumber,
          inquiryId: inquiry.id,
          version: 1,
          status: "current",
          preparedDate: new Date(),
          deliveryTimeEstimateDays: financial.deliveryDays,
          // فاز ۵۴ — مقدار اولیه از ترم پیشنهاد مالی کپی می‌شه (پیش‌فرض معقول)، ولی از این پس
          // مستقل قابل‌تغییره (نگاه کنید به saveTechnical/SaveTechnicalProposalDto)
          chosenDeliveryTerm: financial.chosenDeliveryTerm,
          ourEntityId: ourEntity?.id ?? null,
          items: {
            create: baseline.items.map((i) => ({
              inquiryItemId: i.inquiryItemId,
              technicalSpecs: i.technicalSpecs,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  /** پیش‌فرض شرکت صادرکننده پیشنهاد — شرکت ایرانی گروه (طرف فروش به مشتری نهایی) */
  private async defaultOurEntityId(): Promise<string | null> {
    const entity = await this.prisma.ourEntity.findUnique({ where: { shortCode: "پ ت" } });
    return entity?.id ?? null;
  }

  /** برای نسخه‌های قدیمی‌تر پیشنهاد که قبل از فاز ۳۸ ساخته شدن و ourEntityId ندارن، fallback به پیش‌فرض */
  private async resolveOurEntity(ourEntityId: string | null) {
    const id = ourEntityId ?? (await this.defaultOurEntityId());
    if (!id) return null;
    return this.prisma.ourEntity.findUnique({ where: { id } });
  }

  private pickMajorityCurrency(totalsByCurrency: Record<string, number>): string {
    const entries = Object.entries(totalsByCurrency);
    if (entries.length === 0) return "EUR";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  private currencyWarnings(
    financial: { currencyCode: string },
    baselineItems: BaselineItem[],
  ): string[] {
    return baselineItems
      .filter((i) => i.offerCurrencyCode && i.offerCurrencyCode !== financial.currencyCode)
      .map(
        (i) =>
          `ردیف ${i.rowIndex}: آفر منتخب با ارز ${i.offerCurrencyCode} قیمت‌گذاری شده، نه ${financial.currencyCode}`,
      );
  }

  /**
   * فاز ۵۳ — توزیع هزینه اضافه‌ی ترم تحویل انتخابی بین همه‌ی اقلام، به نسبت ارزش هر ردیف —
   * دقیقاً هم‌الگوی computeEffectiveUnitPrice (دامنه ۳، توزیع VAT/سایر هزینه‌های آفر تأمین‌کننده):
   * سهم هر ردیف از extraCost متناسب با (ارزش همون ردیف / جمع کل) محاسبه و به فی واحدش اضافه می‌شه.
   * ⚠️ قیمت پایه (finalSalePrice قابل‌ویرایش کارشناس فروش) هرگز در دیتابیس تغییر نمی‌کنه —
   * این فقط یک محاسبه‌ی نمایشی/سندیه که در پاسخ getProposal و در getDocumentData استفاده می‌شه
   */
  private distributeDeliveryExtraCost(
    rows: Array<{ inquiryItemId: string; unitPrice: number; quantity: number }>,
    deliveryOptions: Array<{ deliveryTerm: string; extraCost: number }>,
    chosenDeliveryTerm: string | null | undefined,
  ) {
    const extraCost = chosenDeliveryTerm
      ? (deliveryOptions.find((o) => o.deliveryTerm === chosenDeliveryTerm)?.extraCost ?? 0)
      : 0;
    const subTotal = rows.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
    const byItemId = new Map<string, { unitPrice: number; totalPrice: number }>();
    for (const row of rows) {
      const lineTotal = row.unitPrice * row.quantity;
      const share = extraCost > 0 && subTotal > 0 ? (lineTotal / subTotal) * extraCost : 0;
      const adjustedUnitPrice = row.quantity > 0 ? row.unitPrice + share / row.quantity : row.unitPrice;
      byItemId.set(row.inquiryItemId, { unitPrice: adjustedUnitPrice, totalPrice: lineTotal + share });
    }
    return { extraCost, subTotal, grandTotal: subTotal + extraCost, byItemId };
  }

  private formatFinancial(row: {
    id: string;
    proposalNumber: string;
    version: number;
    status: string;
    preparedDate: Date;
    currencyCode: string;
    chosenDeliveryTerm: string;
    deliveryDays: number;
    deliveryDaysUnit: string;
    incotermLocation: string | null;
    shippingMethod: string | null;
    paymentTerms: string | null;
    proposalValidityDate: Date | null;
    negotiationNote: string | null;
    fileUrl: string | null;
    sentAt: Date | null;
    ourEntityId: string | null;
    exchangeRateFromCurrency: string | null;
    exchangeRateToCurrency: string | null;
    exchangeRateValue: unknown;
    paymentMethod: string | null;
    partialShipmentAllowed: boolean;
    documentsChecklist: string[];
    serviceTest: string | null;
    serviceFieldService: string | null;
    serviceDesign: string | null;
    warrantyTerms: string | null;
    remarks: string | null;
    items: Array<{
      id: string;
      inquiryItemId: string;
      purchasePrice: unknown;
      markupPercent: unknown;
      finalSalePrice: unknown;
    }>;
  }) {
    return {
      id: row.id,
      proposalNumber: row.proposalNumber,
      version: row.version,
      status: row.status,
      preparedDate: row.preparedDate,
      currencyCode: row.currencyCode,
      chosenDeliveryTerm: row.chosenDeliveryTerm,
      deliveryDays: row.deliveryDays,
      deliveryDaysUnit: row.deliveryDaysUnit,
      incotermLocation: row.incotermLocation,
      shippingMethod: row.shippingMethod,
      paymentTerms: row.paymentTerms,
      proposalValidityDate: row.proposalValidityDate,
      negotiationNote: row.negotiationNote,
      fileUrl: row.fileUrl,
      sentAt: row.sentAt,
      ourEntityId: row.ourEntityId,
      exchangeRateFromCurrency: row.exchangeRateFromCurrency,
      exchangeRateToCurrency: row.exchangeRateToCurrency,
      exchangeRateValue: row.exchangeRateValue != null ? Number(row.exchangeRateValue) : null,
      paymentMethod: row.paymentMethod,
      partialShipmentAllowed: row.partialShipmentAllowed,
      documentsChecklist: row.documentsChecklist,
      serviceTest: row.serviceTest,
      serviceFieldService: row.serviceFieldService,
      serviceDesign: row.serviceDesign,
      warrantyTerms: row.warrantyTerms,
      remarks: row.remarks,
      // فاز ۳۵-ب: purchasePrice عمداً از پاسخ حذف شده — قیمت خرید هرگز نباید در پیشنهاد مشتری دیده بشه
      items: row.items.map((i) => ({
        id: i.id,
        inquiryItemId: i.inquiryItemId,
        markupPercent: Number(i.markupPercent),
        finalSalePrice: Number(i.finalSalePrice),
      })),
    };
  }

  private formatTechnical(row: {
    id: string;
    proposalNumber: string;
    version: number;
    status: string;
    preparedDate: Date;
    deliveryTimeEstimateDays: number | null;
    deliveryDaysUnit: string;
    chosenDeliveryTerm: string | null;
    incotermLocation: string | null;
    shippingMethod: string | null;
    negotiationNote: string | null;
    fileUrl: string | null;
    sentAt: Date | null;
    ourEntityId: string | null;
    items: Array<{ inquiryItemId: string; technicalSpecs: string | null; complianceNote: string | null }>;
  }) {
    return {
      id: row.id,
      proposalNumber: row.proposalNumber,
      version: row.version,
      status: row.status,
      preparedDate: row.preparedDate,
      deliveryTimeEstimateDays: row.deliveryTimeEstimateDays,
      deliveryDaysUnit: row.deliveryDaysUnit,
      chosenDeliveryTerm: row.chosenDeliveryTerm,
      incotermLocation: row.incotermLocation,
      shippingMethod: row.shippingMethod,
      negotiationNote: row.negotiationNote,
      fileUrl: row.fileUrl,
      sentAt: row.sentAt,
      ourEntityId: row.ourEntityId,
      items: row.items.map((i) => ({
        inquiryItemId: i.inquiryItemId,
        technicalSpecs: i.technicalSpecs,
        complianceNote: i.complianceNote,
      })),
    };
  }
}
