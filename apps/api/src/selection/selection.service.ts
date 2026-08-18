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
  SavePricingCostDto,
  AddPricingOptionDto,
  SavePricingOptionMarkupDto,
} from "./dto/selection.dto";
import { priceOptionItems, type DistributableCost } from "../pricing/pricing-engine";

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
  // فاز ۶۰ (اصلاح — بازخورد کاربر) — قیمت‌گذاری بازرگانی به تفکیک ترم تحویل («تعیین حاشیه سود»)
  // دقیقاً همین‌جا (مرحله «انتخاب نهایی و قیمت‌گذاری») اتفاق می‌افته، نه در تب پیشنهاد به مشتری.
  // چون InquiryPricingOption/InquiryPricingOptionItem به خودِ Inquiry وصل‌ان (نه به یک نسخه
  // پیشنهاد که فقط بعد از قفل شدن این مرحله ساخته می‌شه)، این بخش کاملاً مستقل از هر پیشنهادیه؛
  // وقتی بعداً پیشنهاد به مشتری تولید می‌شه فقط از این جدول‌ها می‌خونه.
  // ------------------------------------------------------------

  async listPricingCosts(inquiryId: string) {
    const rows = await this.prisma.inquiryPricingCost.findMany({
      where: { inquiryId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.formatPricingCost(r));
  }

  async createPricingCost(inquiryId: string, dto: SavePricingCostDto, currentUserId: string) {
    await this.assertNotLocked(inquiryId);
    const currency = await this.prisma.currency.findUnique({ where: { currencyCode: dto.currencyCode } });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }
    const row = await this.prisma.inquiryPricingCost.create({
      data: {
        inquiryId,
        description: dto.description,
        amount: dto.amount,
        currencyCode: dto.currencyCode,
        includeInMarginBase: dto.includeInMarginBase ?? true,
        deliveryTerm: dto.deliveryTerm,
        createdBy: currentUserId,
      },
    });
    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `هزینه اضافی «${dto.description}» به قیمت‌گذاری این پرونده اضافه شد`,
      tag: "general",
      metadata: { module: "selection", action: "pricing_cost_added", costId: row.id },
    });
    return this.formatPricingCost(row);
  }

  async updatePricingCost(inquiryId: string, costId: string, dto: SavePricingCostDto) {
    await this.assertNotLocked(inquiryId);
    const existing = await this.prisma.inquiryPricingCost.findFirst({ where: { id: costId, inquiryId } });
    if (!existing) {
      throw new NotFoundException("هزینه اضافی یافت نشد");
    }
    const currency = await this.prisma.currency.findUnique({ where: { currencyCode: dto.currencyCode } });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }
    const row = await this.prisma.inquiryPricingCost.update({
      where: { id: costId },
      data: {
        description: dto.description,
        amount: dto.amount,
        currencyCode: dto.currencyCode,
        includeInMarginBase: dto.includeInMarginBase ?? existing.includeInMarginBase,
        deliveryTerm: dto.deliveryTerm ?? null,
      },
    });
    return this.formatPricingCost(row);
  }

  async deletePricingCost(inquiryId: string, costId: string) {
    await this.assertNotLocked(inquiryId);
    const existing = await this.prisma.inquiryPricingCost.findFirst({ where: { id: costId, inquiryId } });
    if (!existing) {
      throw new NotFoundException("هزینه اضافی یافت نشد");
    }
    await this.prisma.inquiryPricingCost.delete({ where: { id: costId } });
    return { success: true };
  }

  private formatPricingCost(row: {
    id: string;
    description: string;
    amount: unknown;
    currencyCode: string;
    includeInMarginBase: boolean;
    deliveryTerm: string | null;
  }) {
    return {
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      currencyCode: row.currencyCode,
      includeInMarginBase: row.includeInMarginBase,
      deliveryTerm: row.deliveryTerm,
    };
  }

  /** هزینه‌های اضافی قابل‌اعمال روی یک گزینه‌ی مشخص — همون‌هایی که deliveryTerm=NULL (روی همه) یا دقیقاً همون ترم رو دارن */
  private async getApplicablePricingCosts(inquiryId: string, deliveryTerm: string, currencyCode: string) {
    const rows = await this.prisma.inquiryPricingCost.findMany({
      where: { inquiryId, OR: [{ deliveryTerm: null }, { deliveryTerm }] },
    });
    const mismatched = rows.filter((r) => r.currencyCode !== currencyCode);
    if (mismatched.length > 0) {
      throw new BadRequestException(
        `هزینه(های) «${mismatched.map((r) => r.description).join("، ")}» به ارز ${currencyCode} (ارز این گزینه) ثبت نشدن — ابتدا ارزشون رو هماهنگ کن`,
      );
    }
    const costs: DistributableCost[] = rows.map((r) => ({
      amount: Number(r.amount),
      includeInMarginBase: r.includeInMarginBase,
    }));
    const snapshot = rows.map((r) => ({
      description: r.description,
      amount: Number(r.amount),
      currencyCode: r.currencyCode,
      includeInMarginBase: r.includeInMarginBase,
      deliveryTerm: r.deliveryTerm,
    }));
    return { costs, snapshot };
  }

  /** هزینه خرید (تبدیل‌شده به ارز مبنا اگه فعال باشه) + تعداد + مارک‌آپ پایه هر قلم منتخب — بدون هیچ وابستگی به پیشنهاد */
  private async getPurchaseCostBasis(inquiryId: string) {
    const state = await this.getSelection(inquiryId);
    const baseCurrency = state.selectionBaseCurrencyCode as string | null;
    const items = (state.items as Array<Record<string, unknown>>)
      .filter((i) => !!i.selectedOfferItemId)
      .map((i) => {
        const offers = i.offers as Array<Record<string, unknown>>;
        const chosen = offers.find((o) => o.offerItemId === i.selectedOfferItemId);
        const effectivePrice =
          baseCurrency && chosen?.effectivePriceInBaseCurrency != null
            ? (chosen.effectivePriceInBaseCurrency as number)
            : ((chosen?.effectivePrice as number) ?? 0);
        return {
          inquiryItemId: i.id as string,
          rowIndex: i.rowIndex as number,
          partNumber: i.partNumber as string | null,
          description: i.description as string,
          quantity: i.quantity as number,
          effectivePrice,
          baselineMarkupPercent: i.markupPercent as number | null,
        };
      });
    return {
      items,
      dominantCurrency: baseCurrency ?? this.pickMajorityCurrency(state.totalsByCurrency as Record<string, number>),
    };
  }

  private pickMajorityCurrency(totalsByCurrency: Record<string, number>): string {
    const entries = Object.entries(totalsByCurrency);
    if (entries.length === 0) return "EUR";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  async listPricingOptions(inquiryId: string) {
    const options = await this.prisma.inquiryPricingOption.findMany({
      where: { inquiryId },
      include: {
        items: { include: { inquiryItem: { select: { rowIndex: true, partNumber: true, description: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return options.map((o) => this.formatPricingOption(o));
  }

  async addPricingOption(inquiryId: string, dto: AddPricingOptionDto, currentUserId: string) {
    await this.assertNotLocked(inquiryId);
    const currency = await this.prisma.currency.findUnique({ where: { currencyCode: dto.currencyCode } });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }
    const existingOption = await this.prisma.inquiryPricingOption.findFirst({
      where: { inquiryId, deliveryTerm: dto.deliveryTerm },
    });
    if (existingOption) {
      throw new BadRequestException(`گزینه ترم تحویل ${dto.deliveryTerm} از قبل روی این پرونده وجود داره`);
    }

    const basis = await this.getPurchaseCostBasis(inquiryId);
    if (basis.items.length === 0) {
      throw new BadRequestException("هیچ قلمی آفر منتخب نداره — اول حداقل یک قلم رو در همین مرحله انتخاب کن");
    }

    const isCurrencyChange = dto.currencyCode !== basis.dominantCurrency;
    if (isCurrencyChange && (!dto.exchangeRate || dto.exchangeRate <= 0)) {
      throw new BadRequestException(
        `چون ارز این گزینه (${dto.currencyCode}) با ارز مبنای قیمت‌گذاری (${basis.dominantCurrency}) فرق داره، نرخ تبدیل الزامیه`,
      );
    }
    const rate = isCurrencyChange ? dto.exchangeRate! : 1;

    const { costs, snapshot } = await this.getApplicablePricingCosts(inquiryId, dto.deliveryTerm, dto.currencyCode);

    const optionId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inquiryPricingOption.create({
        data: {
          inquiryId,
          deliveryTerm: dto.deliveryTerm,
          incotermLocation: dto.incotermLocation,
          shippingMethod: dto.shippingMethod,
          deliveryDays: dto.deliveryDays,
          deliveryDaysUnit: dto.deliveryDaysUnit ?? "day",
          paymentTerms: dto.paymentTerms,
          currencyCode: dto.currencyCode,
          exchangeRateFromCurrency: isCurrencyChange ? basis.dominantCurrency : null,
          exchangeRateValue: isCurrencyChange ? rate : null,
          defaultMarkupPercent: dto.defaultMarkupPercent ?? null,
          isPrimary: false,
        },
      });

      const markupByItemId = new Map(
        basis.items.map((item) => [
          item.inquiryItemId,
          dto.defaultMarkupPercent ?? item.baselineMarkupPercent ?? 0,
        ]),
      );
      const priced = priceOptionItems(
        basis.items.map((item) => ({
          inquiryItemId: item.inquiryItemId,
          purchaseCost: item.effectivePrice * rate,
          quantity: item.quantity,
          markupPercent: markupByItemId.get(item.inquiryItemId)!,
        })),
        costs,
      );

      for (const p of priced) {
        await tx.inquiryPricingOptionItem.create({
          data: {
            optionId: created.id,
            inquiryItemId: p.inquiryItemId,
            purchasePrice: p.marginBaseAmount.toNumber(),
            markupPercent: markupByItemId.get(p.inquiryItemId)!,
            finalSalePrice: p.finalSalePrice.toNumber(),
            commercialCalculatedPrice: p.commercialCalculatedPrice.toNumber(),
            commercialPricedBy: currentUserId,
            commercialPricedAt: new Date(),
            marginBaseCostSnapshot: snapshot,
          },
        });
      }

      const marginBaseTotal = priced.reduce((sum, p) => sum + p.marginBaseAmount.toNumber(), 0);
      await tx.inquiryPricingOption.update({
        where: { id: created.id },
        data: { marginBaseAmount: marginBaseTotal },
      });

      return created.id;
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `گزینه ترم تحویل ${dto.deliveryTerm} به قیمت‌گذاری این پرونده اضافه شد`,
      tag: "general",
      metadata: { module: "selection", action: "pricing_option_added", deliveryTerm: dto.deliveryTerm },
    });

    return this.getPricingOptionOrThrow(inquiryId, optionId);
  }

  async removePricingOption(inquiryId: string, optionId: string) {
    await this.assertNotLocked(inquiryId);
    const option = await this.prisma.inquiryPricingOption.findFirst({ where: { id: optionId, inquiryId } });
    if (!option) {
      throw new NotFoundException("گزینه ترم تحویل یافت نشد");
    }
    const optionCount = await this.prisma.inquiryPricingOption.count({ where: { inquiryId } });
    if (optionCount <= 1) {
      throw new BadRequestException("حذف تنها گزینه ترم تحویل باقی‌مانده ممکن نیست");
    }
    await this.prisma.inquiryPricingOption.delete({ where: { id: optionId } });
    return { success: true };
  }

  /** «اعمال به همه» + override تک‌تک اقلام — فقط مارک‌آپ/قیمت محاسبه‌شده بازرگانی رو می‌نویسه، هرگز اصلاح فروش رو */
  async saveMarkup(inquiryId: string, optionId: string, dto: SavePricingOptionMarkupDto, currentUserId: string) {
    await this.assertNotLocked(inquiryId);
    const option = await this.prisma.inquiryPricingOption.findFirst({
      where: { id: optionId, inquiryId },
      include: { items: true },
    });
    if (!option) {
      throw new NotFoundException("گزینه ترم تحویل یافت نشد");
    }

    const overrideByItemId = new Map((dto.items ?? []).map((i) => [i.inquiryItemId, i.markupPercent]));
    const { costs, snapshot } = await this.getApplicablePricingCosts(inquiryId, option.deliveryTerm, option.currencyCode);

    const quantities = await this.prisma.inquiryItem.findMany({
      where: { id: { in: option.items.map((i) => i.inquiryItemId) } },
      select: { id: true, quantity: true },
    });
    const quantityByItemId = new Map(quantities.map((q) => [q.id, Number(q.quantity)]));

    const priced = priceOptionItems(
      option.items.map((item) => ({
        inquiryItemId: item.inquiryItemId,
        purchaseCost: Number(item.purchasePrice ?? 0),
        quantity: quantityByItemId.get(item.inquiryItemId) ?? 1,
        markupPercent:
          overrideByItemId.get(item.inquiryItemId) ?? dto.defaultMarkupPercent ?? Number(item.markupPercent),
        salesAdjustmentAmount: Number(item.salesAdjustmentAmount),
      })),
      costs,
    );

    await this.prisma.$transaction(async (tx) => {
      for (const p of priced) {
        const item = option.items.find((i) => i.inquiryItemId === p.inquiryItemId)!;
        const markupPercent =
          overrideByItemId.get(p.inquiryItemId) ?? dto.defaultMarkupPercent ?? Number(item.markupPercent);
        await tx.inquiryPricingOptionItem.update({
          where: { id: item.id },
          data: {
            markupPercent,
            commercialCalculatedPrice: p.commercialCalculatedPrice.toNumber(),
            commercialPricedBy: currentUserId,
            commercialPricedAt: new Date(),
            finalSalePrice: p.finalSalePrice.toNumber(),
            marginBaseCostSnapshot: snapshot,
          },
        });
      }
      await tx.inquiryPricingOption.update({
        where: { id: optionId },
        data: {
          ...(dto.defaultMarkupPercent !== undefined ? { defaultMarkupPercent: dto.defaultMarkupPercent } : {}),
          marginBaseAmount: priced.reduce((sum, p) => sum + p.marginBaseAmount.toNumber(), 0),
        },
      });
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `قیمت‌گذاری بازرگانی گزینه ${option.deliveryTerm} به‌روزرسانی شد`,
      tag: "general",
      metadata: { module: "selection", action: "pricing_option_markup_saved", deliveryTerm: option.deliveryTerm },
    });

    return this.getPricingOptionOrThrow(inquiryId, optionId);
  }

  /** عمومی — ProposalService بعد از ثبت اصلاح فروش، همین قالب رو برای پاسخ برمی‌گردونه */
  async getPricingOptionOrThrow(inquiryId: string, optionId: string) {
    const option = await this.prisma.inquiryPricingOption.findFirst({
      where: { id: optionId, inquiryId },
      include: {
        items: { include: { inquiryItem: { select: { rowIndex: true, partNumber: true, description: true } } } },
      },
    });
    if (!option) {
      throw new NotFoundException("گزینه ترم تحویل یافت نشد");
    }
    return this.formatPricingOption(option);
  }

  private formatPricingOption(option: {
    id: string;
    deliveryTerm: string;
    incotermLocation: string | null;
    shippingMethod: string | null;
    deliveryDays: number;
    deliveryDaysUnit: string;
    paymentTerms: string | null;
    currencyCode: string;
    marginBaseAmount: unknown;
    defaultMarkupPercent: unknown;
    isPrimary: boolean;
    items: Array<{
      id: string;
      inquiryItemId: string;
      markupPercent: unknown;
      commercialCalculatedPrice: unknown;
      commercialPricedBy: string | null;
      commercialPricedAt: Date | null;
      salesAdjustmentAmount: unknown;
      salesAdjustmentReasonCode: string | null;
      salesAdjustmentNote: string | null;
      salesAdjustedBy: string | null;
      salesAdjustedAt: Date | null;
      finalSalePrice: unknown;
      marginBaseCostSnapshot: unknown;
      inquiryItem?: { rowIndex: number; partNumber: string | null; description: string };
    }>;
  }) {
    return {
      id: option.id,
      deliveryTerm: option.deliveryTerm,
      incotermLocation: option.incotermLocation,
      shippingMethod: option.shippingMethod,
      deliveryDays: option.deliveryDays,
      deliveryDaysUnit: option.deliveryDaysUnit,
      paymentTerms: option.paymentTerms,
      currencyCode: option.currencyCode,
      marginBaseAmount: Number(option.marginBaseAmount),
      defaultMarkupPercent: option.defaultMarkupPercent != null ? Number(option.defaultMarkupPercent) : null,
      isPrimary: option.isPrimary,
      items: option.items.map((i) => ({
        id: i.id,
        inquiryItemId: i.inquiryItemId,
        rowIndex: i.inquiryItem?.rowIndex ?? null,
        partNumber: i.inquiryItem?.partNumber ?? null,
        description: i.inquiryItem?.description ?? null,
        markupPercent: Number(i.markupPercent),
        commercialCalculatedPrice: i.commercialCalculatedPrice != null ? Number(i.commercialCalculatedPrice) : null,
        commercialPricedBy: i.commercialPricedBy,
        commercialPricedAt: i.commercialPricedAt,
        salesAdjustmentAmount: Number(i.salesAdjustmentAmount),
        salesAdjustmentReasonCode: i.salesAdjustmentReasonCode,
        salesAdjustmentNote: i.salesAdjustmentNote,
        salesAdjustedBy: i.salesAdjustedBy,
        salesAdjustedAt: i.salesAdjustedAt,
        finalSalePrice: Number(i.finalSalePrice),
        marginBaseCostSnapshot: i.marginBaseCostSnapshot,
      })),
    };
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
