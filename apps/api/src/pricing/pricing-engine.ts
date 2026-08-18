import { Prisma } from "../../generated/prisma";

/**
 * موتور محاسبات قیمت‌گذاری بازرگانی مبتنی بر Incoterm (فاز ۶۰).
 *
 * ⚠️ فرمول مارک‌آپ عمداً تغییر نکرده — دقیقاً همون فرمول موجود در
 * SelectionService/ProposalService: قیمت = هزینه پایه × (۱ + درصد/۱۰۰).
 * این «مارک‌آپ روی هزینه»ست، نه «حاشیه سود ناخالص» (که فرمولش
 * هزینه / (۱ − درصد/۱۰۰) بود) — به تصمیم صریح کاربر، این تمایز عمداً
 * حفظ شده و به هیچ عنوان به Margin تغییر نام/معنا داده نمی‌شه.
 *
 * برخلاف بقیه‌ی کد فعلی (که همه‌جا از Number خام استفاده می‌کنه)، این ماژول
 * جدید از Prisma.Decimal (که خودش decimal.js رو بسته‌بندی می‌کنه، بدون نیاز
 * به وابستگی تازه) استفاده می‌کنه تا از خطای اعشار شناور و NaN/Infinity در
 * محاسبات پولی جدید جلوگیری بشه.
 */

export type DecimalInput = number | string | Prisma.Decimal;

export function toDecimal(value: DecimalInput): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export interface PricingCostInput {
  amount: DecimalInput;
  includeInMarginBase: boolean;
}

/** تبدیل ارز Decimal-safe: amount (به ارز مبدأ) × نرخ = مقدار به ارز مقصد. */
export function convertCurrency(amount: DecimalInput, rate: DecimalInput): Prisma.Decimal {
  const rateDecimal = toDecimal(rate);
  if (!rateDecimal.isFinite() || rateDecimal.lte(0)) {
    throw new RangeError("نرخ تبدیل ارز باید عددی مثبت و معتبر باشد");
  }
  return toDecimal(amount).times(rateDecimal);
}

/**
 * هزینه پایه محاسبه مارک‌آپ = هزینه خرید (تبدیل‌شده به ارز مبنا) + جمع هزینه‌های
 * اضافی‌ای که include_in_margin_base=true دارن. هزینه‌های با پرچم false اینجا
 * حساب نمی‌شن — اون‌ها بعد از محاسبه مارک‌آپ روی قیمت نهایی سوار می‌شن
 * (نگاه کنید به computePostMarginAddOns).
 */
export function computeMarginBase(purchaseCost: DecimalInput, costs: PricingCostInput[]): Prisma.Decimal {
  return costs
    .filter((c) => c.includeInMarginBase)
    .reduce((sum, c) => sum.plus(toDecimal(c.amount)), toDecimal(purchaseCost));
}

/** هزینه‌های اضافی‌ای که include_in_margin_base=false دارن — بعد از مارک‌آپ اضافه می‌شن. */
export function computePostMarginAddOns(costs: PricingCostInput[]): Prisma.Decimal {
  return costs
    .filter((c) => !c.includeInMarginBase)
    .reduce((sum, c) => sum.plus(toDecimal(c.amount)), new Prisma.Decimal(0));
}

/**
 * قیمت محاسبه‌شده بازرگانی = (هزینه پایه × (۱ + مارک‌آپ٪)) + هزینه‌های اضافیِ
 * خارج از هزینه پایه. همون فرمول markup-on-cost موجود، فقط این‌بار روی هزینه پایه‌ی
 * قابل‌تنظیم (نه صرفاً روی فی مؤثر تک‌قلمی Selection).
 */
export function computeCommercialPrice(
  marginBase: DecimalInput,
  markupPercent: DecimalInput,
  postMarginAddOns: DecimalInput = 0,
): Prisma.Decimal {
  const base = toDecimal(marginBase);
  const pct = toDecimal(markupPercent);
  if (pct.lt(-100)) {
    throw new RangeError("درصد مارک‌آپ نمی‌تواند کمتر از ۱۰۰-‎ باشد (قیمت منفی می‌شود)");
  }
  const marked = base.times(pct.dividedBy(100).plus(1));
  return marked.plus(toDecimal(postMarginAddOns));
}

/**
 * قیمت نهایی مشتری = قیمت محاسبه‌شده بازرگانی + اصلاح فروش (مثبت یا منفی).
 * قیمت محاسبه‌شده بازرگانی هرگز اینجا بازنویسی نمی‌شه — این تابع فقط جمع می‌زنه.
 */
export function computeFinalCustomerPrice(
  commercialPrice: DecimalInput,
  salesAdjustmentAmount: DecimalInput,
): Prisma.Decimal {
  return toDecimal(commercialPrice).plus(toDecimal(salesAdjustmentAmount));
}

export function assertValidMarkupPercent(markupPercent: DecimalInput): void {
  const pct = toDecimal(markupPercent);
  if (!pct.isFinite()) {
    throw new RangeError("درصد مارک‌آپ نامعتبر است");
  }
  if (pct.lt(-100)) {
    throw new RangeError("درصد مارک‌آپ نمی‌تواند کمتر از ۱۰۰-‎ باشد");
  }
}

export function assertNonNegativePrice(price: DecimalInput, label: string): void {
  const value = toDecimal(price);
  if (!value.isFinite()) {
    throw new RangeError(`${label} نامعتبر است`);
  }
  if (value.lt(0)) {
    throw new RangeError(`${label} نمی‌تواند منفی باشد`);
  }
}

export interface DistributableCost {
  amount: DecimalInput;
  includeInMarginBase: boolean;
}

export interface DistributionRow {
  inquiryItemId: string;
  purchaseCost: DecimalInput;
  quantity: DecimalInput;
}

export interface DistributedShare {
  inquiryItemId: string;
  marginBaseUnitCost: Prisma.Decimal;
  postMarginUnitAddOn: Prisma.Decimal;
}

/**
 * توزیع تناسبی هزینه‌های اضافی سطح گزینه (مثلاً «حمل ۱۰۰۰ یورو کل محموله») بین اقلام —
 * دقیقاً هم‌الگوی توزیع VAT/سایر هزینه‌های آفر (computeEffectiveUnitPrice، دامنه ۳) و توزیع
 * هزینه ترم تحویل (distributeDeliveryExtraCost، proposal.service.ts): سهم هر ردیف متناسب
 * با «ارزش ردیف» (هزینه خرید × تعداد) از جمع کل محاسبه و بر تعداد همون ردیف تقسیم می‌شه تا
 * افزودنی هر واحد به‌دست بیاد. هزینه‌های include_in_margin_base=true قبل از مارک‌آپ اضافه
 * می‌شن (روی هزینه پایه)، بقیه بعد از مارک‌آپ روی قیمت نهایی سوار می‌شن.
 */
export function distributeCostsAcrossItems(
  rows: DistributionRow[],
  costs: DistributableCost[],
): DistributedShare[] {
  const marginBaseTotal = costs
    .filter((c) => c.includeInMarginBase)
    .reduce((sum, c) => sum.plus(toDecimal(c.amount)), new Prisma.Decimal(0));
  const postMarginTotal = costs
    .filter((c) => !c.includeInMarginBase)
    .reduce((sum, c) => sum.plus(toDecimal(c.amount)), new Prisma.Decimal(0));

  const lineValues = rows.map((r) => ({
    inquiryItemId: r.inquiryItemId,
    quantity: toDecimal(r.quantity),
    lineValue: toDecimal(r.purchaseCost).times(toDecimal(r.quantity)),
  }));
  const subTotal = lineValues.reduce((sum, r) => sum.plus(r.lineValue), new Prisma.Decimal(0));

  return lineValues.map((r) => {
    if (subTotal.lte(0) || r.quantity.lte(0)) {
      return { inquiryItemId: r.inquiryItemId, marginBaseUnitCost: new Prisma.Decimal(0), postMarginUnitAddOn: new Prisma.Decimal(0) };
    }
    const shareRatio = r.lineValue.dividedBy(subTotal);
    const marginBaseUnitCost = shareRatio.times(marginBaseTotal).dividedBy(r.quantity);
    const postMarginUnitAddOn = shareRatio.times(postMarginTotal).dividedBy(r.quantity);
    return { inquiryItemId: r.inquiryItemId, marginBaseUnitCost, postMarginUnitAddOn };
  });
}

export interface ItemMarginInput {
  inquiryItemId: string;
  purchaseCost: DecimalInput;
  costs: PricingCostInput[];
  markupPercent: DecimalInput;
  salesAdjustmentAmount?: DecimalInput;
}

export interface ItemPricingResult {
  inquiryItemId: string;
  marginBaseAmount: Prisma.Decimal;
  postMarginAddOns: Prisma.Decimal;
  commercialCalculatedPrice: Prisma.Decimal;
  finalSalePrice: Prisma.Decimal;
}

/** خط لوله کامل قیمت‌گذاری یک قلم — هسته‌ی «Pricing Workspace» تک‌محل. */
export function priceItem(input: ItemMarginInput): ItemPricingResult {
  const marginBaseAmount = computeMarginBase(input.purchaseCost, input.costs);
  const postMarginAddOns = computePostMarginAddOns(input.costs);
  assertValidMarkupPercent(input.markupPercent);
  const commercialCalculatedPrice = computeCommercialPrice(
    marginBaseAmount,
    input.markupPercent,
    postMarginAddOns,
  );
  assertNonNegativePrice(commercialCalculatedPrice, "قیمت محاسبه‌شده بازرگانی");
  const finalSalePrice = computeFinalCustomerPrice(
    commercialCalculatedPrice,
    input.salesAdjustmentAmount ?? 0,
  );
  assertNonNegativePrice(finalSalePrice, "قیمت نهایی مشتری");
  return { inquiryItemId: input.inquiryItemId, marginBaseAmount, postMarginAddOns, commercialCalculatedPrice, finalSalePrice };
}

export interface OptionItemInput {
  inquiryItemId: string;
  purchaseCost: DecimalInput;
  quantity: DecimalInput;
  markupPercent: DecimalInput;
  salesAdjustmentAmount?: DecimalInput;
}

/**
 * قیمت‌گذاری همه‌ی اقلام یک گزینه‌ی ترم تحویل، با توزیع تناسبی هزینه‌های سطح گزینه بین‌شون —
 * تابعی که سرویس مستقیماً موقع افزودن/محاسبه‌ی مجدد یک FinancialProposalDeliveryOption صدا می‌زنه.
 */
export function priceOptionItems(
  items: OptionItemInput[],
  costs: DistributableCost[],
): (ItemPricingResult & { marginBaseUnitCost: Prisma.Decimal; postMarginUnitAddOn: Prisma.Decimal })[] {
  const shares = distributeCostsAcrossItems(
    items.map((i) => ({ inquiryItemId: i.inquiryItemId, purchaseCost: i.purchaseCost, quantity: i.quantity })),
    costs,
  );
  const shareByItemId = new Map(shares.map((s) => [s.inquiryItemId, s]));

  return items.map((item) => {
    const share = shareByItemId.get(item.inquiryItemId)!;
    const priced = priceItem({
      inquiryItemId: item.inquiryItemId,
      purchaseCost: toDecimal(item.purchaseCost).plus(share.marginBaseUnitCost),
      costs: [],
      markupPercent: item.markupPercent,
      salesAdjustmentAmount: item.salesAdjustmentAmount,
    });
    const commercialWithPostMargin = priced.commercialCalculatedPrice.plus(share.postMarginUnitAddOn);
    const finalWithPostMargin = priced.finalSalePrice.plus(share.postMarginUnitAddOn);
    return {
      ...priced,
      marginBaseAmount: toDecimal(item.purchaseCost).plus(share.marginBaseUnitCost),
      commercialCalculatedPrice: commercialWithPostMargin,
      finalSalePrice: finalWithPostMargin,
      marginBaseUnitCost: share.marginBaseUnitCost,
      postMarginUnitAddOn: share.postMarginUnitAddOn,
    };
  });
}
