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
