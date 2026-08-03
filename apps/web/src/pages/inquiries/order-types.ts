export const GUARANTEE_TYPES = ["advance_payment", "performance"] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

export const GUARANTEE_TYPE_LABEL: Record<GuaranteeType, string> = {
  advance_payment: "پیش‌پرداخت",
  performance: "حسن انجام کار",
};

export const GUARANTEE_STATUS_OPTIONS = [
  { value: "active", label: "فعال" },
  { value: "released", label: "آزادشده" },
  { value: "called", label: "ضبط‌شده" },
];

export const CUSTOMER_PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "پرداخت‌نشده" },
  { value: "paid", label: "پرداخت‌شده" },
];

export interface OrderWonItem {
  inquiryItemId: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  quantity: number;
  measurementUnit: string;
  supplierName?: string;
  purchasePrice: number;
  salePrice: number;
}

export interface OrderItemRow {
  inquiryItemId: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  measurementUnit: string;
  supplierName: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
}

export interface PaymentRow {
  id: string;
  paymentDescription: string | null;
  dueDate: string | null;
  amount: number;
  actualPaymentDate: string | null;
  paymentDocumentFileUrl: string | null;
  status: string;
}

export interface GuaranteeRow {
  id: string;
  guaranteeType: GuaranteeType;
  amount: number;
  issuingBank: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
}

export interface OrderPreview {
  inquiryId: string;
  exists: false;
  wonItems: OrderWonItem[];
  warnings: string[];
}

export interface OrderState {
  inquiryId: string;
  exists: true;
  id: string;
  orderNumber: string;
  contractNumber: string | null;
  contractDate: string | null;
  totalAmount: number;
  deliveryDueDate: string | null;
  contractFileUrl: string | null;
  items: OrderItemRow[];
  customerPayments: PaymentRow[];
  issuedGuarantees: GuaranteeRow[];
  warnings: string[];
}

export type OrderResponse = OrderPreview | OrderState;
