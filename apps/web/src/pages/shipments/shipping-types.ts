export interface ReadyPackage {
  id: string;
  packageNumber: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number;
  pickupLocation: string;
  poNumber: string;
  supplierName: string;
  inquiryId: string;
  inquiryNumber: string;
  inquirySubject: string;
}

export interface FreightOffer {
  id: string;
  price: number;
  currencyCode: string;
  transitTimeDays: number | null;
  offerDate: string | null;
  receivedAt: string;
  validityDate: string | null;
  notes: string | null;
}

export interface FreightRfqPackageSummary {
  id: string;
  packageNumber: string;
  weightKg: number;
  poNumber: string;
}

export interface FreightRfq {
  id: string;
  rfqNumber: string;
  destinationCustoms: string;
  emailSubject: string | null;
  sentDate: string;
  status: "awaiting_response" | "no_response" | "offer_received";
  freightCompany: { id: string; companyName: string; country: string | null; email: string | null };
  commercialExpert: { id: string; fullName: string; email: string | null };
  packages: FreightRfqPackageSummary[];
  offer: FreightOffer | null;
  wonShipment: { id: string; shipmentNumber: string } | null;
}

export const FREIGHT_RFQ_STATUS_META: Record<string, { label: string; className: string }> = {
  awaiting_response: { label: "در انتظار پاسخ", className: "bg-warningSoft text-warning" },
  no_response: { label: "بدون پاسخ", className: "bg-danger/10 text-danger" },
  offer_received: { label: "پیشنهاد دریافت شد", className: "bg-successSoft text-success" },
};

export const SHIPMENT_STAGES = [
  { key: "consolidating", label: "تجمیع" },
  { key: "in_transit", label: "در حال حمل" },
  { key: "export_declared", label: "اظهارنامه صادرات" },
  { key: "iran_docs_sent", label: "مدارک ایران ارسال شد" },
  { key: "customs_declared", label: "اظهار گمرکی مقصد" },
  { key: "cleared", label: "ترخیص و انبار" },
] as const;

export interface ShipmentSummary {
  id: string;
  shipmentNumber: string;
  freightCompany: { id: string; companyName: string; country: string | null } | null;
  destinationCustoms: string | null;
  stage: string;
  packageCount: number;
}

export interface ShipmentPackageSummary {
  id: string;
  packageNumber: string;
  weightKg: number;
  poNumber: string;
}

// فاز ۲۷ — فیلدهای *FileUrl تک‌فایله حذف شدن؛ فایل‌ها حالا از documents (چندفایلی) میان
export interface ExportDocuments {
  invoiceNumber: string | null;
  packingListNumber: string | null;
  status: "preparing" | "complete" | "sent";
}

export interface ImportDocuments {
  tradeSystemRegistrationNumber: string | null;
  tradeSystemRegistrationDate: string | null;
  insurancePolicyNumber: string | null;
  insuranceCompany: string | null;
  insuranceAmount: number | null;
  insuranceIssueDate: string | null;
  insuranceExpiryDate: string | null;
  importInvoiceNumber: string | null;
  importPackingListNumber: string | null;
  warehouseSlipNumber: string | null;
  freightInvoiceRialNumber: string | null;
  freightInvoiceForexNumber: string | null;
}

export interface ShipmentDocument {
  id: string;
  docKey: string;
  fileUrl: string;
  fileName: string | null;
  uploadedAt: string;
  uploader: { id: string; fullName: string } | null;
}

export interface ShipmentEditRequest {
  id: string;
  stage: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requester: { id: string; fullName: string };
  createdAt: string;
}

export interface ShipmentDetail extends ShipmentSummary {
  commercialExpert: { id: string; fullName: string };
  selectedFreightOffer: { id: string; price: number; currencyCode: string } | null;
  consolidationStartDate: string | null;
  consolidationFinalizeDate: string | null;
  billOfLadingNumber: string | null;
  loadingDate: string | null;
  eta: string | null;
  exportDeclarationNumber: string | null;
  customsDeclarationNumber: string | null;
  customsDutiesAmount: number | null;
  clearanceFeesAmount: number | null;
  clearanceAgentName: string | null;
  unlockedStage: string | null;
  packages: ShipmentPackageSummary[];
  documents: ShipmentDocument[];
  editRequests: ShipmentEditRequest[];
  exportDocuments: ExportDocuments | null;
  importDocuments: ImportDocuments | null;
}
