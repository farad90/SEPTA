import { DeliveryTerm, IncotermOption } from "./selection-types";

// فاز ۵۲ — کلیدهای ثابت چک‌لیست مدارک (باید با PROPOSAL_DOCUMENT_CHECKLIST_KEYS بک‌اند هم‌خوان بمونه)
export const PROPOSAL_DOCUMENT_CHECKLIST_ITEMS = [
  { key: "invoice_copy", label: "کپی اینویس" },
  { key: "packing_list", label: "پکینگ لیست" },
  { key: "manufacturer_test_certificate", label: "گواهی تست سازنده" },
  { key: "certificate_of_origin", label: "گواهی مبدأ" },
  { key: "other_on_request", label: "سایر گواهی‌های قابل ارائه بنا به درخواست" },
] as const;

// فاز ۳۵-ب: effectivePrice (قیمت خرید) عمداً اینجا نیست — سرور دیگه هیچ‌وقت اون رو برنمی‌گردونه
export interface ProposalBaselineItem {
  inquiryItemId: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  quantity: number;
  measurementUnit: string;
  supplierName?: string;
  baselineMarkupPercent: number | null;
  baselineFinalSalePrice: number | null;
  partNumber: string | null;
  technicalSpecs: string | null;
  countryOfOrigin: string | null;
  isEquivalent: boolean;
  datasheetUrl: string | null;
}

// فاز ۳۵-ب: purchasePrice عمداً اینجا نیست — سرور دیگه هیچ‌وقت اون رو برنمی‌گردونه
// فاز ۳۵-ج: pendingPriceChangeRequestId/pendingRequestedPrice پر می‌شن وقتی کاهش قیمت این قلم منتظر تأیید مدیره
export interface FinancialProposalItem {
  id: string;
  inquiryItemId: string;
  markupPercent: number;
  finalSalePrice: number;
  /** فاز ۵۳ — فی واحد شامل سهم متناسب از هزینه اضافه‌ی ترم تحویل انتخابی (فقط نمایشی/سندی) */
  priceWithDelivery: number;
  pendingPriceChangeRequestId: string | null;
  pendingRequestedPrice: number | null;
}

export interface FinancialProposal {
  id: string;
  proposalNumber: string;
  version: number;
  status: "current" | "superseded";
  preparedDate: string;
  currencyCode: string;
  chosenDeliveryTerm: DeliveryTerm;
  deliveryDays: number;
  /** فاز ۵۶ — واحد نمایشی زمان تحویل که کارشناس هنگام تایپ انتخاب کرده (روی خود deliveryDays اثر نداره) */
  deliveryDaysUnit: "day" | "week";
  incotermLocation: string | null;
  shippingMethod: string | null;
  paymentTerms: string | null;
  proposalValidityDate: string | null;
  negotiationNote: string | null;
  fileUrl: string | null;
  sentAt: string | null;
  ourEntityId: string | null;
  exchangeRateFromCurrency: string | null;
  exchangeRateToCurrency: string | null;
  exchangeRateValue: number | null;
  paymentMethod: string | null;
  partialShipmentAllowed: boolean;
  documentsChecklist: string[];
  serviceTest: string | null;
  serviceFieldService: string | null;
  serviceDesign: string | null;
  warrantyTerms: string | null;
  remarks: string | null;
  items: FinancialProposalItem[];
  historyCount: number;
  currencyWarnings: string[];
  /** فاز ۵۳ — هزینه اضافه‌ی ترم تحویل انتخابی این نسخه (از deliveryOptions همون ترم) */
  deliveryExtraCost: number;
  /** جمع قیمت‌های واحد × تعداد، بدون احتساب هزینه ترم تحویل */
  totalAmount: number;
  /** ارزش کل نهایی شامل هزینه ترم تحویل توزیع‌شده — همون عددی که در سند/فاکتور می‌شینه */
  totalAmountWithDelivery: number;
}

export interface TechnicalProposalItem {
  inquiryItemId: string;
  technicalSpecs: string | null;
  complianceNote: string | null;
}

export interface TechnicalProposal {
  id: string;
  proposalNumber: string;
  version: number;
  status: "current" | "superseded";
  preparedDate: string;
  deliveryTimeEstimateDays: number | null;
  deliveryDaysUnit: "day" | "week";
  chosenDeliveryTerm: DeliveryTerm | null;
  incotermLocation: string | null;
  shippingMethod: string | null;
  negotiationNote: string | null;
  fileUrl: string | null;
  sentAt: string | null;
  ourEntityId: string | null;
  items: TechnicalProposalItem[];
  historyCount: number;
}

export interface ProposalDeliveryOption {
  deliveryTerm: DeliveryTerm;
  extraCost: number;
  deliveryDays: number;
}

// فاز ۶۰ (اصلاح — بازخورد کاربر) — گزینه‌های ترم تحویل («یک پیشنهاد، چند Incoterm») + هزینه‌های
// اضافی + مارک‌آپ («تعیین حاشیه سود») حالا در selection-types.ts تعریف می‌شن، چون این‌ها در مرحله
// «انتخاب نهایی و قیمت‌گذاری» مدیریت می‌شن، نه اینجا — این تب فقط IncotermOption رو فقط‌خواندنی
// می‌خونه (financial.pricingDeliveryOptions پایین) و برای اصلاح فروش استفاده می‌کنه.

export interface ProposalState {
  inquiryId: string;
  managerNoteToSales: string | null;
  baselineItems: ProposalBaselineItem[];
  deliveryOptions: ProposalDeliveryOption[];
  financial: FinancialProposal & { pricingDeliveryOptions: IncotermOption[] };
  technical: TechnicalProposal;
}
