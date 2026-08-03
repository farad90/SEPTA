export const LETTER_TYPES = ["incoming", "outgoing", "internal"] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export const TYPE_META: Record<LetterType, { label: string; className: string }> = {
  incoming: { label: "دریافتی", className: "bg-primary/10 text-primary" },
  outgoing: { label: "ارسالی", className: "bg-successSoft text-success" },
  internal: { label: "داخلی", className: "bg-accentSoft text-accent" },
};

export const PRIORITY_META: Record<string, { label: string; className: string }> = {
  normal: { label: "عادی", className: "bg-bg text-textSecondary" },
  urgent: { label: "فوری", className: "bg-warningSoft text-warning" },
  very_urgent: { label: "خیلی فوری", className: "bg-danger/10 text-danger" },
};

export const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-bg text-textSecondary" },
  registered: { label: "ثبت‌شده", className: "bg-primary/10 text-primary" },
  sent: { label: "ارسال‌شده", className: "bg-successSoft text-success" },
  archived: { label: "بایگانی‌شده", className: "bg-accentSoft text-accent" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  contract: "قرارداد",
  invoice: "فاکتور",
  shipping_doc: "سند حمل",
  customs_doc: "سند گمرکی",
  technical_file: "فایل فنی",
  other: "سایر",
};

export const WORKFLOW_ACTION_LABEL: Record<string, string> = {
  registered: "ثبت شد",
  scanned: "اسکن و آپلود شد",
  referred: "ارجاع شد",
  responded: "پاسخ داده شد",
  approved: "تأیید مدیر",
  sent: "ارسال شد",
  archived: "بایگانی شد",
};

export const DEPARTMENTS = ["فروش", "بازرگانی", "مالی", "مدیریت"];

export interface LetterParty {
  kind: "our" | "partner";
  id: string;
  name: string;
  partnerType?: string;
  contactName?: string | null;
}

export interface LetterSummary {
  id: string;
  letterNumber: string | null;
  type: LetterType;
  letterDate: string;
  subject: string;
  department: string | null;
  priority: string;
  status: string;
  sender: LetterParty | null;
  receiver: LetterParty | null;
  issuingEntity: { id: string; entityName: string; shortCode: string; calendarType: string };
  relatedInquiry: { id: string; internalNumber: string; subject: string } | null;
  relatedShipment: { id: string; shipmentNumber: string } | null;
  documentsCount: number;
  createdBy: string;
  createdAt: string;
  // فاز ۲۴ — فیلدهای وابسته به جهت نامه
  senderReferenceNumber: string | null;
  responsibleUser: { id: string; fullName: string } | null;
  internalFromDepartment: { id: string; departmentName: string } | null;
  internalToDepartment: { id: string; departmentName: string } | null;
  signers: { id: string; fullName: string }[];
}

export interface LetterDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  category: string;
  tags: string[];
  uploadedBy: string;
  uploadDate: string;
}

export interface LetterWorkflowLogEntry {
  id: string;
  action: string;
  performedBy: string;
  referredToUser: string | null;
  note: string | null;
  performedAt: string;
}

export interface LetterAuditEntry {
  id: string;
  user: string;
  action: "viewed" | "edited";
  occurredAt: string;
}

export interface LetterDetail extends LetterSummary {
  description: string | null;
  documents: LetterDocument[];
  workflowLogs: LetterWorkflowLogEntry[];
  auditLogs: LetterAuditEntry[];
}
