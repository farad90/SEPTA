// Typeهای پاسخ سه گزارش — هم‌خوان با apps/api/src/reports/reports.service.ts

export interface OrdersPnlItem {
  orderId: string;
  orderNumber: string;
  inquiryInternalNumber: string;
  buyerName: string;
  salesExpertName: string;
  contractDate: string | null;
  currencyCode: string | null;
  totalPurchase: number;
  totalSale: number;
  margin: number;
  marginPercent: number | null;
}

export interface CurrencyPnlTotals {
  totalPurchase: number;
  totalSale: number;
  margin: number;
}

export interface OrdersPnlResponse {
  items: OrdersPnlItem[];
  totalsByCurrency: Record<string, CurrencyPnlTotals>;
  total: number;
  page: number;
  pageSize: number;
}

export type PaymentRowType = "receivable" | "payable";

export interface PaymentRow {
  id: string;
  type: PaymentRowType;
  counterpartyName: string;
  referenceNumber: string;
  dueDate: string | null;
  amount: number;
  currencyCode: string | null;
  status: string;
  actualDate: string | null;
  isOverdue: boolean;
}

export interface CurrencyPaymentTotals {
  receivableUnpaid: number;
  receivablePaid: number;
  payableUnpaid: number;
  payablePaid: number;
}

export interface PaymentsResponse {
  items: PaymentRow[];
  totalsByCurrency: Record<string, CurrencyPaymentTotals>;
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversionCounts {
  total: number;
  won: number;
  lost: number;
  partiallyWon: number;
  cancelled: number;
  suspended: number;
  inProgress: number;
  conversionRate: number | null;
}

export interface ConversionBySalesExpert extends ConversionCounts {
  salesExpertId: string;
  salesExpertName: string;
}

export interface ConversionResponse {
  overall: ConversionCounts;
  bySalesExpert: ConversionBySalesExpert[];
}

export interface OwnSalesSummaryResponse {
  jalaliYear: number;
  orderCount: number;
  totalsByCurrency: Record<string, number>;
}

export interface RfqResponseRateResponse {
  total: number;
  offerReceived: number;
  noResponse: number;
  technicalQuestion: number;
  awaitingResponse: number;
  responseRate: number | null;
}
