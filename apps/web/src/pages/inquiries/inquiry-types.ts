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

export type ActionPriority = "low" | "normal" | "high" | "urgent";

export interface InquiryListRow {
  id: string;
  internalNumber: string;
  inquiryNumber: string | null;
  subject: string;
  status: InquiryStatus;
  /**
   * مرحله‌ی فعلی پرونده. فاز ۵۸ — وقتی یک Activity سیستمی باز مرتبط با این پرونده باشه
   * (نگاه کنید به erp-database-design.md دامنه ۱۴)، همون مرحله (با جزئیات بیشتر از ۳ حالت
   * قبلی) نشون داده می‌شه؛ حتی برای پرونده‌های won/partially_won که هنوز کار باز دارن
   * (مثلاً «در انتظار صدور سفارش خرید»). برای پرونده‌های بدون Activity باز، طبق قاعده‌ی
   * قبلی فقط برای status=in_progress پر می‌شه.
   */
  stageLabel: string | null;
  offerEndDate: string;
  extendedOfferEndDate: string | null;
  urgency: "normal" | "urgent" | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: string; companyName: string };
  salesExpert: { id: string; fullName: string };
  _count: { items: number };
  /** برندهای یکتای درخواست‌شده در این پرونده (از inquiry_items.builder) — برای ستون «برندها» در لیست */
  builders: string[];
  /** تأمین‌کننده(های) یکتای آفر منتخب اقلام این پرونده — فقط بعد از مرحله انتخاب نهایی پر می‌شه */
  suppliers: string[];
  /** ارزش کل پرونده به قیمت فروش نهایی (final_sale_price × مقدار)، به تفکیک ارز — بدون تبدیل نرخ */
  saleValueByCurrency: Record<string, number>;

  // فاز ۵۹ — سه فیلد زیر Permission-gated ان: سرور فقط وقتی کاربر دسترسی مربوطه رو داشته
  // باشه کلید رو در پاسخ می‌ذاره (وگرنه کاملاً غایبه، نه null) — نگاه کنید به
  // inquiries.service.ts.toListRow. بنابراین هرکدوم در فرانت هم optional ان.
  /** شماره(های) PO مرتبط با این پرونده — فقط با دسترسی po.view */
  poNumbers?: string[];
  /** ارزش کل به قیمت خرید آفر منتخب، به تفکیک ارز — فقط با po.view_purchase_price */
  purchaseValueByCurrency?: Record<string, number>;
  /** سود تقریبی (فروش - خرید) به تفکیک ارز — فقط با order.view_profit */
  profitByCurrency?: Record<string, { amount: number; percent: number | null }>;

  // فاز ۵۸ — وضعیت عملیاتی مشتق از آخرین Activity باز مرتبط با این پرونده (فقط در لیست؛
  // GET /inquiries/:id این فیلدها رو برنمی‌گردونه — نگاه کنید به InquiryDetail پایین‌تر)
  /** متن «چه کاری الان لازمه» — null یعنی هیچ Activity باز سیستمی برای این پرونده نیست */
  actionRequired: string | null;
  actionAssignee: { id: string; fullName: string } | null;
  actionDueAt: string | null;
  actionOverdue: boolean;
  actionPriority: ActionPriority | null;
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

// فاز ۵۸ — GET /inquiries/:id این ۵ فیلد وضعیت عملیاتی رو برنمی‌گردونه (فقط لیست پر می‌شه)؛
// عمداً از InquiryDetail حذف شدن تا نوع منعکس‌کنندهٔ داده‌ی واقعی بمونه
export interface InquiryDetail
  extends Omit<
    InquiryListRow,
    | "_count"
    | "builders"
    | "suppliers"
    | "saleValueByCurrency"
    | "poNumbers"
    | "purchaseValueByCurrency"
    | "profitByCurrency"
    | "actionRequired"
    | "actionAssignee"
    | "actionDueAt"
    | "actionOverdue"
    | "actionPriority"
  > {
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
