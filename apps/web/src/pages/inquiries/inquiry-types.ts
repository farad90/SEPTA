export type InquiryStatus =
  | "in_progress"
  | "won"
  | "lost"
  | "partially_won"
  | "cancelled"
  | "suspended"
  | "declined";

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; className: string }> = {
  in_progress: { label: "در جریان", className: "bg-warningSoft text-warning" },
  won: { label: "برد کامل", className: "bg-successSoft text-success" },
  partially_won: { label: "برد جزئی", className: "bg-accentSoft text-accent" },
  lost: { label: "باخت کامل", className: "bg-[#F3E6E4] text-danger" },
  cancelled: { label: "لغو شده", className: "bg-bg text-textSecondary" },
  suspended: { label: "معلق", className: "bg-bg text-textSecondary" },
  declined: { label: "رد شده", className: "bg-[#F3E6E4] text-danger" },
};

export const CHANNEL_LABEL: Record<string, string> = {
  email: "ایمیل",
  phone: "تماس تلفنی",
  in_person: "حضوری",
  tender_system: "سامانه مناقصه",
};

export interface InquiryListRow {
  id: string;
  internalNumber: string;
  inquiryNumber: string | null;
  subject: string;
  status: InquiryStatus;
  /** فقط وقتی status=in_progress پر می‌شه — مرحله‌ی فعلی پرونده در ۹ مرحله‌ی فرآیند */
  stageLabel: string | null;
  offerEndDate: string;
  extendedOfferEndDate: string | null;
  urgency: "normal" | "urgent" | null;
  createdAt: string;
  buyer: { id: string; companyName: string };
  salesExpert: { id: string; fullName: string };
  _count: { items: number };
  /** برندهای یکتای درخواست‌شده در این پرونده (از inquiry_items.builder) — برای ستون «برندها» در لیست */
  builders: string[];
  /** ارزش کل پرونده به قیمت فروش نهایی (final_sale_price × مقدار)، به تفکیک ارز — بدون تبدیل نرخ */
  saleValueByCurrency: Record<string, number>;
}

export interface InquiryItemDocument {
  id: string;
  fileUrl: string;
  fileName: string | null;
  uploadedAt: string;
  uploader: { id: string; fullName: string } | null;
}

export interface InquiryItem {
  id: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  quantity: string; // Decimal از API رشته می‌آد
  measurementUnit: string;
  equivalentType: string | null;
  drawingTypeRow: string | null;
  partNumber: string | null;
  drawingNumber: string | null;
  builder: string | null;
  serialNumber: string | null;
  documents: InquiryItemDocument[];
}

export interface InquiryDetail extends Omit<InquiryListRow, "_count" | "builders" | "saleValueByCurrency"> {
  isEquivalentAccepted: boolean | null;
  settlementTerms: string | null;
  advancePaymentAvailable: boolean | null;
  description: string | null;
  inquiryStartDate: string;
  channel: string | null;
  buyerContact: { id: string; contactName: string; mobile: string | null; email: string | null } | null;
  createdBy: { id: string; fullName: string };
  items: InquiryItem[];
  documents: InquiryItemDocument[];
}

export interface DiscussionEntry {
  id: string;
  entryType: "message" | "activity";
  commentText: string;
  tag: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  author: { id: string; fullName: string };
  mentioned: { id: string; fullName: string } | null;
}

export interface InquiryItemDraft {
  itemCode: string;
  description: string;
  quantity: number;
  measurementUnit: string;
  equivalentType?: string;
  drawingTypeRow?: string;
  partNumber?: string;
  drawingNumber?: string;
  builder?: string;
  serialNumber?: string;
}
