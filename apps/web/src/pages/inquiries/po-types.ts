export const SUPPLIER_PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "پرداخت‌نشده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "completed", label: "تکمیل‌شده" },
];

export interface PoItemRow {
  orderItemId: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  measurementUnit: string;
  price: number;
  quantity: number;
}

export interface SupplierPaymentRow {
  id: string;
  paymentDescription: string | null;
  dueDate: string | null;
  amount: number;
  actualPaymentDate: string | null;
  paymentDocumentFileUrl: string | null;
  paymentMethod: string | null;
  status: string;
}

export interface PoGroupPreview {
  supplierId: string;
  supplierName: string;
  exists: false;
  defaultOurEntityId: string | null;
  defaultPoNumber: string;
  previewItems: PoItemRow[];
}

export interface PoGroupExisting {
  supplierId: string;
  supplierName: string;
  exists: true;
  id: string;
  poNumber: string;
  ourEntityId: string;
  ourEntityName: string;
  currencyCode: string;
  totalAmount: number;
  issueDate: string;
  deliveryDueDate: string | null;
  items: PoItemRow[];
  supplierPayments: SupplierPaymentRow[];
}

export type PoGroup = PoGroupPreview | PoGroupExisting;
