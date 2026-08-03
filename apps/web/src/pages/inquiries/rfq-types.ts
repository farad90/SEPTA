export type RfqStatus =
  | "awaiting_response"
  | "no_response"
  | "technical_question"
  | "offer_received"
  | "rejected_by_supplier";

export const RFQ_STATUS_META: Record<RfqStatus, { label: string; className: string }> = {
  awaiting_response: { label: "در انتظار پاسخ", className: "bg-warningSoft text-warning" },
  no_response: { label: "بدون پاسخ", className: "bg-border text-textSecondary" },
  technical_question: { label: "سوال فنی — ارجاع به فروش", className: "bg-accentSoft text-accent" },
  offer_received: { label: "پیشنهاد قیمت ثبت شد", className: "bg-successSoft text-success" },
  rejected_by_supplier: { label: "رد شد توسط تأمین‌کننده", className: "bg-danger/10 text-danger" },
};

export interface OurEntity {
  id: string;
  entityName: string;
  shortCode: string;
  calendarType: "jalali" | "gregorian";
  country: string;
  status?: "active" | "inactive";
  entityNameEn?: string | null;
  address?: string | null;
  addressEn?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  postalCode?: string | null;
  registrationNumber?: string | null;
}

export interface Currency {
  currencyCode: string;
  currencyName: string;
}

export interface RfqItemRow {
  inquiryItemId: string;
  inquiryItem: {
    id: string;
    rowIndex: number;
    itemCode: string;
    description: string;
    quantity: string;
    measurementUnit: string;
    partNumber: string | null;
    builder: string | null;
  };
}

export interface OfferItem {
  id: string;
  inquiryItemId: string;
  price: string;
  currencyCode: string;
  deliveryTimeDays: number | null;
  partNumber: string | null;
  builder: string | null;
  countryOfOrigin: string | null;
  isEquivalent: boolean;
  technicalSpecs: string | null;
  paymentTerms: string | null;
  offerValidityDate: string | null;
  datasheetUrl: string | null;
}

export interface Offer {
  id: string;
  offerNumber: string | null;
  offerDate: string | null;
  receivedAt: string;
  offerContactName: string | null;
  vatApplicable: boolean;
  vatRatePercent: string | null;
  otherCosts: string | null;
  generalRemarks: string | null;
  items: OfferItem[];
  documents: { id: string; fileUrl: string; fileName: string | null }[];
  totals: { subTotal: number; vatAmount: number; otherCosts: number; grandTotal: number };
}

export interface RfqDeleteRequest {
  id: string;
  reason: string;
  createdAt: string;
  requester: { fullName: string };
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  rejectionReason: string | null;
  emailSubject: string | null;
  sentDate: string;
  responseDueDate: string | null;
  supplier: { id: string; companyName: string; country: string | null; email: string | null };
  ourEntity: { id: string; entityName: string; shortCode: string };
  commercialExpert: { id: string; fullName: string };
  items: RfqItemRow[];
  offers: Offer[];
  deleteRequests: RfqDeleteRequest[];
}
