export interface Delivery {
  actualDeliveryDate: string;
  deliveryMethod: string | null;
  recipientName: string | null;
  deliveryReceiptFileUrl: string | null;
  customerAcceptanceDate: string | null;
  customerAcceptanceStatus: "pending" | "accepted" | "rejected_needs_action";
}

export const ACCEPTANCE_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "در انتظار تأیید مشتری", className: "bg-warningSoft text-warning" },
  accepted: { label: "تأیید شده", className: "bg-successSoft text-success" },
  rejected_needs_action: { label: "رد شده — نیاز به اقدام", className: "bg-danger/10 text-danger" },
};

export interface InvoiceItemRow {
  id: string;
  description: string;
  sourceCustomerPaymentId: string | null;
  amountCurrency: number;
  currencyCode: string;
  exchangeRateDate: string;
  exchangeRateValue: number;
  amountIrr: number;
}

export interface InvoiceHeader {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  paymentDeadline: string | null;
  finalAmountIrr: number;
}

export interface InvoiceState {
  orderTotalAmount: number;
  orderTotalCurrency: string | null;
  invoice: InvoiceHeader | null;
  items: InvoiceItemRow[];
}

export const COLLECTION_STATUS_OPTIONS = [
  { value: "pending", label: "در انتظار" },
  { value: "settled", label: "تسویه‌شده" },
  { value: "overdue", label: "معوق" },
];
