export const DELIVERY_TERMS = ["EXW", "CPT", "DDP", "CIF", "FOB"] as const;
export type DeliveryTerm = (typeof DELIVERY_TERMS)[number];

export interface SelectionOfferOption {
  offerItemId: string;
  offerId: string;
  rfqNumber: string;
  supplier: { id: string; companyName: string; country: string | null };
  price: number;
  effectivePrice: number;
  /** فاز ۵۷ — فی مؤثر به ارز مبنا؛ فقط وقتی ارز مبنا فعاله. null یعنی نرخ تبدیل این ارز هنوز ثبت نشده */
  effectivePriceInBaseCurrency: number | null;
  currencyCode: string;
  deliveryTimeDays: number | null;
  partNumber: string | null;
  builder: string | null;
  isEquivalent: boolean;
  distributeVat: boolean;
  distributeOtherCosts: boolean;
  vatApplicable: boolean;
  vatRatePercent: number;
  otherCosts: number;
  subTotal: number;
}

export interface SelectionItem {
  id: string;
  rowIndex: number;
  itemCode: string;
  partNumber: string | null;
  description: string;
  quantity: number;
  measurementUnit: string;
  selectedOfferItemId: string | null;
  selectionNotes: string | null;
  markupPercent: number | null;
  finalSalePrice: number | null;
  offers: SelectionOfferOption[];
}

export interface SelectionDeliveryOption {
  deliveryTerm: DeliveryTerm;
  extraCost: number;
  deliveryDays: number;
}

export interface SelectionExchangeRate {
  fromCurrencyCode: string;
  rate: number;
}

export interface SelectionState {
  inquiryId: string;
  locked: boolean;
  selectionLockedAt: string | null;
  selectionLocker: { id: string; fullName: string } | null;
  managerNoteToSales: string | null;
  items: SelectionItem[];
  deliveryOptions: SelectionDeliveryOption[];
  totalsByCurrency: Record<string, number>;
  // فاز ۵۷
  selectionBaseCurrencyCode: string | null;
  exchangeRates: SelectionExchangeRate[];
  missingExchangeRateCurrencies: string[];
}

// ============================================================
// فاز ۶۰ (اصلاح — بازخورد کاربر) — موتور قیمت‌گذاری بازرگانی مبتنی بر Incoterm.
// این بخش‌ها («تعیین حاشیه سود») متعلق به همین مرحله (انتخاب نهایی و قیمت‌گذاری) هستن، نه
// «پیشنهاد به مشتری» — پیشنهاد به مشتری فقط این داده رو فقط‌خواندنی می‌بینه + اصلاح فروش می‌زنه.
// ============================================================

export const SALES_ADJUSTMENT_REASONS = [
  { key: "customer_negotiation", label: "مذاکره با مشتری" },
  { key: "market_price", label: "قیمت بازار" },
  { key: "competitive_pricing", label: "رقابت قیمتی" },
  { key: "strategic_customer", label: "مشتری استراتژیک" },
  { key: "management_discount", label: "تخفیف مدیریتی" },
  { key: "other", label: "سایر" },
] as const;
export type SalesAdjustmentReasonCode = (typeof SALES_ADJUSTMENT_REASONS)[number]["key"];

/** هزینه اضافی قابل‌تخصیص به قیمت‌گذاری (حمل/بیمه/گمرک/...) — در سطح استعلام، مستقل از نسخه پیشنهاد */
export interface PricingCost {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  includeInMarginBase: boolean;
  /** خالی = روی همه گزینه‌های ترم تحویل اعمال می‌شه؛ پرشده = فقط همون ترم */
  deliveryTerm: DeliveryTerm | null;
}

/** قیمت‌گذاری یک قلم درون یک گزینه ترم تحویل مشخص — «قیمت بازرگانی» همیشه جدا از «اصلاح فروش» */
export interface IncotermOptionItem {
  id: string;
  inquiryItemId: string;
  rowIndex: number | null;
  partNumber: string | null;
  description: string | null;
  markupPercent: number;
  /** قیمت محاسبه‌شده بازرگانی — هرگز توسط اصلاح فروش بازنویسی نمی‌شه */
  commercialCalculatedPrice: number | null;
  commercialPricedBy: string | null;
  commercialPricedAt: string | null;
  salesAdjustmentAmount: number;
  salesAdjustmentReasonCode: SalesAdjustmentReasonCode | null;
  salesAdjustmentNote: string | null;
  salesAdjustedBy: string | null;
  salesAdjustedAt: string | null;
  /** قیمت نهایی مشتری = قیمت محاسبه‌شده بازرگانی + اصلاح فروش */
  finalSalePrice: number;
  /** کدوم هزینه‌های اضافی با چه سهمی، در لحظه محاسبه، لحاظ شدن — برای بخش «جزئیات» */
  marginBaseCostSnapshot: { description: string; amount: number; currencyCode: string; includeInMarginBase: boolean }[] | null;
}

/** یک گزینه‌ی ترم تحویل («یک پیشنهاد، چند Incoterm») با قیمت‌گذاری کاملاً مستقل خودش — سطح خودِ استعلام */
export interface IncotermOption {
  id: string;
  deliveryTerm: DeliveryTerm;
  incotermLocation: string | null;
  shippingMethod: string | null;
  deliveryDays: number;
  deliveryDaysUnit: "day" | "week";
  paymentTerms: string | null;
  currencyCode: string;
  marginBaseAmount: number;
  defaultMarkupPercent: number | null;
  isPrimary: boolean;
  items: IncotermOptionItem[];
}
