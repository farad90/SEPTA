import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { ActivitiesService } from "../activities/activities.service";
import {
  DeliveryOptionDto,
  SaveSelectionDto,
} from "./dto/selection.dto";

interface OfferComputationRow {
  offerItemId: string;
  offerId: string;
  inquiryItemId: string;
  price: number;
  quantity: number;
}

/**
 * فی مؤثر (اصلاح فرمول mockup — تأییدشده در SPEC فاز ۵؛ فاز ۳۵-الف: VAT و سایر
 * هزینه‌ها حالا دو سوییچ مستقل‌ان — ممکنه مدیریت فقط یکی رو فعال کنه):
 * توزیع VAT + سایر هزینه‌ها (هرکدوم که فعال باشه) به نسبت «ارزش ردیف» (فی×تعداد)،
 * سپس تقسیم سهم بر تعداد. با تعداد برابر نتیجه با mockup یکیه؛ با تعداد نابرابر
 * این نسخه از نظر مالی درسته.
 */
export function computeEffectiveUnitPrice(
  row: OfferComputationRow,
  offerRows: OfferComputationRow[],
  offer: {
    vatApplicable: boolean;
    vatRatePercent: number;
    otherCosts: number;
    distributeVat: boolean;
    distributeOtherCosts: boolean;
  },
): number {
  if (!offer.distributeVat && !offer.distributeOtherCosts) return row.price;
  const subTotal = offerRows.reduce((sum, r) => sum + r.price * r.quantity, 0);
  if (subTotal <= 0) return row.price;
  const vatAmount = offer.vatApplicable ? (subTotal * offer.vatRatePercent) / 100 : 0;
  const extra =
    (offer.distributeVat ? vatAmount : 0) + (offer.distributeOtherCosts ? offer.otherCosts : 0);
  const lineTotal = row.price * row.quantity;
  const share = (lineTotal / subTotal) * extra;
  return row.price + share / row.quantity;
}

@Injectable()
export class SelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly activities: ActivitiesService,
  ) {}

  // ------------------------------------------------------------
  // نمای تجمیعی مرحله انتخاب
  // ------------------------------------------------------------

  async getSelection(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        items: { orderBy: { rowIndex: "asc" } },
        deliveryOptions: { orderBy: { createdAt: "asc" } },
        selectionLocker: { select: { id: true, fullName: true } },
        selectionExchangeRates: true,
      },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }

    // فاز ۵۷ — نرخ تبدیل هر ارز آفر به ارز مبنای این پرونده (اگه تعیین شده باشه)
    const baseCurrency = inquiry.selectionBaseCurrencyCode;
    const rateByCurrency = new Map(
      inquiry.selectionExchangeRates.map((r) => [r.fromCurrencyCode, Number(r.rate)]),
    );
    const rateFor = (currencyCode: string): number | null => {
      if (!baseCurrency) return null;
      if (currencyCode === baseCurrency) return 1;
      return rateByCurrency.get(currencyCode) ?? null;
    };

    // همه آفرآیتم‌های پرونده از مسیر RFQ ها
    const offers = await this.prisma.supplierOffer.findMany({
      where: { rfq: { inquiryId } },
      include: {
        rfq: {
          select: {
            rfqNumber: true,
            supplier: { select: { id: true, companyName: true, country: true } },
          },
        },
        items: true,
      },
    });

    const quantityByItem = new Map(inquiry.items.map((i) => [i.id, Number(i.quantity)]));

    const offerItemsByInquiryItem = new Map<string, unknown[]>();
    for (const offer of offers) {
      const offerRows: OfferComputationRow[] = offer.items.map((oi) => ({
        offerItemId: oi.id,
        offerId: offer.id,
        inquiryItemId: oi.inquiryItemId,
        price: Number(oi.price),
        quantity: quantityByItem.get(oi.inquiryItemId) ?? 0,
      }));
      const offerMeta = {
        vatApplicable: offer.vatApplicable,
        vatRatePercent: Number(offer.vatRatePercent ?? 0),
        otherCosts: Number(offer.otherCosts ?? 0),
        distributeVat: offer.distributeVat,
        distributeOtherCosts: offer.distributeOtherCosts,
      };
      // فاز ۴۰-الف: subTotal + متادیتای VAT/سایر هزینه‌ها به هر ردیف آفر اضافه می‌شه تا فرانت
      // بتونه پیش‌نمایش زنده‌ی «فی مؤثر» رو موقع تیک‌زدن چک‌باکس‌های توزیع (قبل از ذخیره) محاسبه کنه —
      // قبلاً effectivePrice فقط سمت سرور و فقط بعد از ذخیره به‌روز می‌شد، پس تیک زدن ظاهراً «بی‌اثر» بود
      const subTotal = offerRows.reduce((sum, r) => sum + r.price * r.quantity, 0);
      for (const oi of offer.items) {
        const row = offerRows.find((r) => r.offerItemId === oi.id)!;
        const effectivePrice = computeEffectiveUnitPrice(row, offerRows, offerMeta);
        const rate = rateFor(oi.currencyCode);
        const list = offerItemsByInquiryItem.get(oi.inquiryItemId) ?? [];
        list.push({
          offerItemId: oi.id,
          offerId: offer.id,
          rfqNumber: offer.rfq.rfqNumber,
          supplier: offer.rfq.supplier,
          price: Number(oi.price),
          effectivePrice,
          currencyCode: oi.currencyCode,
          // فاز ۵۷ — فی مؤثر بر حسب ارز مبنا؛ null یعنی ارز مبنا فعاله ولی نرخ این ارز هنوز ثبت نشده
          effectivePriceInBaseCurrency: baseCurrency ? (rate != null ? effectivePrice * rate : null) : null,
          deliveryTimeDays: oi.deliveryTimeDays,
          partNumber: oi.partNumber,
          builder: oi.builder,
          isEquivalent: oi.isEquivalent,
          distributeVat: offer.distributeVat,
          distributeOtherCosts: offer.distributeOtherCosts,
          vatApplicable: offer.vatApplicable,
          vatRatePercent: Number(offer.vatRatePercent ?? 0),
          otherCosts: Number(offer.otherCosts ?? 0),
          subTotal,
        });
        offerItemsByInquiryItem.set(oi.inquiryItemId, list);
      }
    }

    // فاز ۵۷ — ارزهای آفرهایی که با ارز مبنا فرق دارن ولی هنوز نرخ تبدیل‌شون ثبت نشده
    const missingExchangeRateCurrencies = baseCurrency
      ? [...new Set(offers.flatMap((o) => o.items.map((i) => i.currencyCode)))].filter(
          (code) => code !== baseCurrency && !rateByCurrency.has(code),
        )
      : [];

    const items = inquiry.items.map((item) => ({
      id: item.id,
      rowIndex: item.rowIndex,
      itemCode: item.itemCode,
      partNumber: item.partNumber,
      description: item.description,
      quantity: Number(item.quantity),
      measurementUnit: item.measurementUnit,
      builder: item.builder,
      selectedOfferItemId: item.selectedOfferItemId,
      selectionNotes: item.selectionNotes,
      markupPercent: item.markupPercent != null ? Number(item.markupPercent) : null,
      finalSalePrice: item.finalSalePrice != null ? Number(item.finalSalePrice) : null,
      offers: offerItemsByInquiryItem.get(item.id) ?? [],
    }));

    // جمع ارزش اقلام منتخب — وقتی ارز مبنا فعاله همه چیز از قبل به همون ارز محاسبه شده
    // (finalSalePrice توسط save() به ارز مبنا تبدیل و ذخیره می‌شه)، پس همه زیر یک کلید جمع می‌شن؛
    // وگرنه طبق رفتار قبلی به تفکیک ارز خودِ آفر منتخب، بدون تبدیل نرخ
    const totalsByCurrency: Record<string, number> = {};
    for (const item of items) {
      if (!item.selectedOfferItemId || item.finalSalePrice == null) continue;
      if (baseCurrency) {
        totalsByCurrency[baseCurrency] = (totalsByCurrency[baseCurrency] ?? 0) + item.finalSalePrice * item.quantity;
        continue;
      }
      const chosen = (item.offers as { offerItemId: string; currencyCode: string }[]).find(
        (o) => o.offerItemId === item.selectedOfferItemId,
      );
      if (!chosen) continue;
      totalsByCurrency[chosen.currencyCode] =
        (totalsByCurrency[chosen.currencyCode] ?? 0) + item.finalSalePrice * item.quantity;
    }

    return {
      inquiryId,
      locked: !!inquiry.selectionLockedAt,
      selectionLockedAt: inquiry.selectionLockedAt,
      selectionLocker: inquiry.selectionLocker,
      managerNoteToSales: inquiry.managerNoteToSales,
      items,
      deliveryOptions: inquiry.deliveryOptions.map((opt) => ({
        deliveryTerm: opt.deliveryTerm,
        extraCost: Number(opt.extraCost),
        deliveryDays: opt.deliveryDays,
      })),
      totalsByCurrency,
      // فاز ۵۷
      selectionBaseCurrencyCode: baseCurrency,
      exchangeRates: inquiry.selectionExchangeRates.map((r) => ({
        fromCurrencyCode: r.fromCurrencyCode,
        rate: Number(r.rate),
      })),
      missingExchangeRateCurrencies,
    };
  }

  // ------------------------------------------------------------
  // ذخیره انتخاب/قیمت‌گذاری (batch)
  // ------------------------------------------------------------

  async save(inquiryId: string, dto: SaveSelectionDto, canSetMarkup: boolean, currentUserId: string) {
    await this.assertNotLocked(inquiryId);

    if (
      !canSetMarkup &&
      dto.items?.some((item) => item.markupPercent !== undefined || item.finalSalePrice !== undefined)
    ) {
      throw new ForbiddenException("برای تعیین حاشیه سود/قیمت نهایی دسترسی «تعیین حاشیه سود» لازمه");
    }
    if (
      !canSetMarkup &&
      (dto.selectionBaseCurrencyCode !== undefined || (dto.exchangeRates && dto.exchangeRates.length > 0))
    ) {
      throw new ForbiddenException("برای تعیین ارز مبنا/نرخ تبدیل دسترسی «تعیین حاشیه سود» لازمه");
    }

    // فاز ۵۷ — ارز مبنای پرونده (null یعنی غیرفعال‌سازی، بازگشت به رفتار قبلی چندارزی)
    if (dto.selectionBaseCurrencyCode !== undefined) {
      if (dto.selectionBaseCurrencyCode) {
        const currency = await this.prisma.currency.findUnique({
          where: { currencyCode: dto.selectionBaseCurrencyCode },
        });
        if (!currency) {
          throw new BadRequestException("ارز مبنا نامعتبره");
        }
      }
      await this.prisma.inquiry.update({
        where: { id: inquiryId },
        data: { selectionBaseCurrencyCode: dto.selectionBaseCurrencyCode || null, updatedAt: new Date() },
      });
    }

    // فاز ۵۷ — نرخ تبدیل هر ارز آفر به ارز مبنا
    for (const rateDto of dto.exchangeRates ?? []) {
      const currency = await this.prisma.currency.findUnique({
        where: { currencyCode: rateDto.fromCurrencyCode },
      });
      if (!currency) {
        throw new BadRequestException(`ارز ${rateDto.fromCurrencyCode} نامعتبره`);
      }
      await this.prisma.inquirySelectionExchangeRate.upsert({
        where: { inquiryId_fromCurrencyCode: { inquiryId, fromCurrencyCode: rateDto.fromCurrencyCode } },
        create: { inquiryId, fromCurrencyCode: rateDto.fromCurrencyCode, rate: rateDto.rate, updatedBy: currentUserId },
        update: { rate: rateDto.rate, updatedBy: currentUserId, updatedAt: new Date() },
      });
    }

    // ۱. به‌روزرسانی توزیع VAT/سایر هزینه‌های آفرها (روی فی مؤثر اثر داره — فاز ۳۵-الف: دو سوییچ مستقل)
    for (const offerUpdate of dto.offers ?? []) {
      const offer = await this.prisma.supplierOffer.findFirst({
        where: { id: offerUpdate.offerId, rfq: { inquiryId } },
      });
      if (!offer) {
        throw new BadRequestException("آفر متعلق به این پرونده نیست");
      }
      await this.prisma.supplierOffer.update({
        where: { id: offerUpdate.offerId },
        data: {
          distributeVat: offerUpdate.distributeVat,
          distributeOtherCosts: offerUpdate.distributeOtherCosts,
        },
      });
    }

    // فاز ۵۷ — وضعیت فعلی ارز مبنا/نرخ‌ها بعد از اعمال احتمالی تغییرات بالا (برای محاسبه finalSalePrice خودکار)
    const currentInquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        selectionBaseCurrencyCode: true,
        selectionExchangeRates: { select: { fromCurrencyCode: true, rate: true } },
      },
    });
    const baseCurrencyCode = currentInquiry?.selectionBaseCurrencyCode ?? null;
    const rateByCurrency = new Map(
      (currentInquiry?.selectionExchangeRates ?? []).map((r) => [r.fromCurrencyCode, Number(r.rate)]),
    );

    // ۲. انتخاب/قیمت‌گذاری اقلام
    for (const itemUpdate of dto.items ?? []) {
      const item = await this.prisma.inquiryItem.findFirst({
        where: { id: itemUpdate.inquiryItemId, inquiryId },
      });
      if (!item) {
        throw new BadRequestException("قلم متعلق به این پرونده نیست");
      }

      if (itemUpdate.selectedOfferItemId !== undefined && itemUpdate.selectedOfferItemId !== item.selectedOfferItemId) {
        if (itemUpdate.selectedOfferItemId) {
          const offerItem = await this.prisma.supplierOfferItem.findFirst({
            where: {
              id: itemUpdate.selectedOfferItemId,
              inquiryItemId: itemUpdate.inquiryItemId,
              offer: { rfq: { inquiryId } },
            },
            include: { offer: { include: { rfq: { include: { supplier: true } } } } },
          });
          if (!offerItem) {
            throw new BadRequestException("آفر انتخاب‌شده متعلق به همین قلم/پرونده نیست");
          }
          // اقدام مهم — طبق design doc باید در فید پرونده ثبت بشه (نه هر تغییر جزئی فرم)
          await this.activityLog.log({
            inquiryId,
            authorId: currentUserId,
            text: `آفر «${offerItem.offer.rfq.supplier.companyName}» برای ردیف ${item.rowIndex} انتخاب شد`,
            restrictedText: `آفر منتخب برای ردیف ${item.rowIndex} ثبت شد`,
            tag: "general",
            metadata: { module: "selection", action: "offer_selected", rowIndex: item.rowIndex },
          });
        } else {
          await this.activityLog.log({
            inquiryId,
            authorId: currentUserId,
            text: `انتخاب آفر ردیف ${item.rowIndex} برداشته شد`,
            tag: "general",
            metadata: { module: "selection", action: "offer_unselected", rowIndex: item.rowIndex },
          });
        }
      }

      // قیمت نهایی: دستی > محاسبه از فی مؤثر × (۱+markup)
      // نکته مهم: انتخاب آفر و تعیین markup معمولاً در دو درخواست جدا میان (رادیو vs فرم قیمت‌گذاری)،
      // پس باید selectedOfferItemId فعلیِ ذخیره‌شده رو هم در نظر بگیریم، نه فقط چیزی که همین الان اومده
      let finalSalePrice = itemUpdate.finalSalePrice;
      const effectiveOfferItemId = itemUpdate.selectedOfferItemId ?? item.selectedOfferItemId;
      if (finalSalePrice === undefined && itemUpdate.markupPercent !== undefined && effectiveOfferItemId) {
        const effective = await this.effectivePriceOfOfferItem(effectiveOfferItemId, inquiryId);
        if (effective != null) {
          // فاز ۵۷ — اگه ارز مبنا فعاله و ارز این آفر باهاش فرق داره، اول باید به ارز مبنا تبدیل بشه
          let effectiveInBase = effective.price;
          if (baseCurrencyCode && effective.currencyCode !== baseCurrencyCode) {
            const rate = rateByCurrency.get(effective.currencyCode);
            if (rate == null) {
              throw new BadRequestException(
                `ردیف ${item.rowIndex}: آفر منتخب با ارز ${effective.currencyCode} قیمت‌گذاری شده — قبل از تعیین حاشیه سود، نرخ تبدیل ${effective.currencyCode} به ${baseCurrencyCode} رو ثبت کن`,
              );
            }
            effectiveInBase = effective.price * rate;
          }
          finalSalePrice = effectiveInBase * (1 + itemUpdate.markupPercent / 100);
        }
      }

      await this.prisma.inquiryItem.update({
        where: { id: itemUpdate.inquiryItemId },
        data: {
          selectedOfferItemId:
            itemUpdate.selectedOfferItemId === undefined
              ? undefined
              : itemUpdate.selectedOfferItemId,
          selectionNotes: itemUpdate.selectionNotes,
          ...(canSetMarkup
            ? {
                markupPercent: itemUpdate.markupPercent,
                finalSalePrice,
              }
            : {}),
          updatedAt: new Date(),
        },
      });
    }

    return this.getSelection(inquiryId);
  }

  // ------------------------------------------------------------
  // ترم‌های تحویل
  // ------------------------------------------------------------

  async saveDeliveryOptions(inquiryId: string, options: DeliveryOptionDto[], currentUserId: string) {
    await this.assertNotLocked(inquiryId);

    const terms = options.map((o) => o.deliveryTerm);
    if (new Set(terms).size !== terms.length) {
      throw new BadRequestException("هر ترم تحویل فقط یک‌بار مجازه");
    }

    await this.prisma.$transaction([
      this.prisma.inquiryDeliveryOption.deleteMany({ where: { inquiryId } }),
      this.prisma.inquiryDeliveryOption.createMany({
        data: options.map((o) => ({
          inquiryId,
          deliveryTerm: o.deliveryTerm,
          extraCost: o.extraCost,
          deliveryDays: o.deliveryDays,
        })),
      }),
    ]);

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `گزینه‌های ترم تحویل به‌روزرسانی شد (${options.map((o) => o.deliveryTerm).join("، ") || "خالی"})`,
      tag: "general",
      metadata: { module: "selection", action: "delivery_options_saved" },
    });

    return this.getSelection(inquiryId);
  }

  // ------------------------------------------------------------
  // قفل / بازگشایی
  // ------------------------------------------------------------

  async lock(inquiryId: string, managerNoteToSales: string | undefined, currentUserId: string) {
    const state = await this.getSelection(inquiryId);
    if (state.locked) {
      throw new BadRequestException("این مرحله قبلاً قفل شده");
    }

    // شرط قفل: هر قلمی که آفر داره باید منتخب + markup داشته باشه
    const incomplete = state.items.filter(
      (item) =>
        item.offers.length > 0 && (!item.selectedOfferItemId || item.markupPercent == null),
    );
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `ردیف(های) ${incomplete.map((i) => i.rowIndex).join("، ")} آفر دارن ولی انتخاب یا درصد سودشون کامل نیست`,
      );
    }

    // فاز ۵۷ — اگه ارز مبنا فعاله، برای هر قلم منتخب باید نرخ تبدیل ارز آفرش به ارز مبنا موجود باشه
    if (state.selectionBaseCurrencyCode) {
      const missingRateRows = state.items.filter((item) => {
        if (!item.selectedOfferItemId) return false;
        const chosen = (item.offers as { offerItemId: string; effectivePriceInBaseCurrency: number | null }[]).find(
          (o) => o.offerItemId === item.selectedOfferItemId,
        );
        return chosen != null && chosen.effectivePriceInBaseCurrency == null;
      });
      if (missingRateRows.length > 0) {
        throw new BadRequestException(
          `ردیف(های) ${missingRateRows.map((i) => i.rowIndex).join("، ")} نرخ تبدیل ارز آفرشون به ارز مبنا (${state.selectionBaseCurrencyCode}) ثبت نشده`,
        );
      }
    }
    // اقلام بدون هیچ آفر مانع قفل نیستن — فقط هشدار برمی‌گرده
    const noOfferRows = state.items.filter((item) => item.offers.length === 0).map((i) => i.rowIndex);

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        selectionLockedAt: new Date(),
        selectionLockedBy: currentUserId,
        managerNoteToSales: managerNoteToSales?.trim() || undefined,
        updatedAt: new Date(),
      },
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: "مرحله «انتخاب نهایی و قیمت‌گذاری» تأیید و قفل شد — تولید پیشنهاد مالی/فنی حالا مجازه",
      tag: "approval",
      metadata: { module: "selection", action: "locked" },
    });

    // فاز ۵۸ — Trigger #۳ (erp-database-design.md دامنه ۱۴): بستن pricing_pending،
    // باز کردن proposal_pending برای Sales Owner
    const { salesExpertId } = await this.prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { salesExpertId: true },
    });
    await this.activities.closeStageActivities(inquiryId, "pricing_pending", currentUserId);
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "proposal_pending",
      activityType: "internal_task",
      subject: "تهیه و ارسال پیشنهاد به مشتری",
      assignedToUserId: salesExpertId,
      triggeredByUserId: currentUserId,
    });

    return { ...(await this.getSelection(inquiryId)), warnings: noOfferRows.length > 0 ? [`ردیف(های) ${noOfferRows.join("، ")} بدون آفر قیمت موندن`] : [] };
  }

  async unlock(inquiryId: string, currentUserId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { selectionLockedAt: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    if (!inquiry.selectionLockedAt) {
      throw new BadRequestException("این مرحله قفل نیست");
    }

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { selectionLockedAt: null, selectionLockedBy: null, updatedAt: new Date() },
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: "مرحله «انتخاب نهایی» برای اصلاح بازگشایی شد",
      tag: "status_change",
      metadata: { module: "selection", action: "unlocked" },
    });

    return this.getSelection(inquiryId);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async assertNotLocked(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { selectionLockedAt: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    if (inquiry.selectionLockedAt) {
      throw new BadRequestException("مرحله انتخاب نهایی قفل شده — اول بازگشایی کن");
    }
  }

  private async effectivePriceOfOfferItem(
    offerItemId: string,
    inquiryId: string,
  ): Promise<{ price: number; currencyCode: string } | null> {
    const offerItem = await this.prisma.supplierOfferItem.findUnique({
      where: { id: offerItemId },
      include: { offer: { include: { items: true } } },
    });
    if (!offerItem) return null;

    const itemIds = offerItem.offer.items.map((i) => i.inquiryItemId);
    const inquiryItems = await this.prisma.inquiryItem.findMany({
      where: { id: { in: itemIds }, inquiryId },
      select: { id: true, quantity: true },
    });
    const quantityByItem = new Map(inquiryItems.map((i) => [i.id, Number(i.quantity)]));

    const offerRows: OfferComputationRow[] = offerItem.offer.items.map((oi) => ({
      offerItemId: oi.id,
      offerId: offerItem.offerId,
      inquiryItemId: oi.inquiryItemId,
      price: Number(oi.price),
      quantity: quantityByItem.get(oi.inquiryItemId) ?? 0,
    }));
    const row = offerRows.find((r) => r.offerItemId === offerItemId)!;

    const price = computeEffectiveUnitPrice(row, offerRows, {
      vatApplicable: offerItem.offer.vatApplicable,
      vatRatePercent: Number(offerItem.offer.vatRatePercent ?? 0),
      otherCosts: Number(offerItem.offer.otherCosts ?? 0),
      distributeVat: offerItem.offer.distributeVat,
      distributeOtherCosts: offerItem.offer.distributeOtherCosts,
    });
    return { price, currencyCode: offerItem.currencyCode };
  }
}
