// Typeهای مشترک پاسخ API — هم‌خوان با مدل‌های Prisma بک‌اند

export type PartnerType =
  | "customer"
  | "supplier"
  | "both"
  | "freight_forwarder"
  | "organization"
  | "bank"
  | "service_company";

export interface PartnerContact {
  id: string;
  partnerId: string;
  contactName: string;
  contactNameEn: string | null;
  contactType: "technical" | "financial" | "commercial" | "purchasing" | "other" | null;
  level: "expert" | "manager" | "ceo" | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  department: string | null;
  extension: string | null;
  photoUrl: string | null;
  notes: string | null;
}

export interface BusinessPartner {
  id: string;
  partnerType: PartnerType;
  companyName: string;
  companyNameEn: string | null;
  shortCodeEn: string | null;
  country: string | null;
  industry: string | null;
  address: string | null;
  addressEn: string | null;
  taxId: string | null;
  province: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  notes: string | null;
  status: "active" | "inactive";
  phones: string[] | null;
  fax: string | null;
  registrationDate: string | null;
  logoUrl: string | null;
  isForeign: boolean;
  contacts: PartnerContact[];
  createdAt: string;
}

export interface SimilarPartner {
  id: string;
  companyName: string;
  partnerType: PartnerType;
  similarity: number;
}

export interface CatalogItem {
  itemCode: string;
  partNumber: string;
  itemDescription: string;
  builder: string | null;
  defaultMeasurementUnit: string | null;
  status: "active" | "inactive";
  createdAt: string;
}

export interface SimilarItem {
  itemCode: string;
  partNumber: string;
  itemDescription: string;
  builder: string | null;
  similarity: number;
}

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: "active" | "inactive";
  requestedDepartment: string | null;
  permissionGroupId: string | null;
  permissionGroup: { id: string; groupName: string } | null;
  createdAt: string;
}

export interface PermissionGroupSummary {
  id: string;
  groupName: string;
  isDefault: boolean;
  memberCount: number;
  permissionKeys: string[];
  /** فقط در پاسخ create/update — هشدار جفت‌های حساس SoD که هم‌زمان تیک خوردن (ذخیره مسدود نمی‌شه) */
  warnings?: string[];
}

export interface PermissionCatalogModule {
  module: string;
  items: {
    id: string;
    module: string;
    permissionKey: string;
    permissionLabel: string;
    supportsLimit: boolean;
  }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  customer: "مشتری",
  supplier: "تأمین‌کننده",
  both: "مشتری و تأمین‌کننده",
  freight_forwarder: "شرکت حمل",
  organization: "سازمان",
  bank: "بانک",
  service_company: "شرکت خدماتی",
};

export const CONTACT_TYPE_LABEL: Record<string, string> = {
  technical: "فنی",
  financial: "مالی",
  commercial: "بازرگانی",
  purchasing: "خرید",
  other: "سایر",
};

export const CONTACT_LEVEL_LABEL: Record<string, string> = {
  expert: "کارشناس",
  manager: "مدیر",
  ceo: "مدیرعامل",
};

/** برچسب فارسی ماژول‌های کاتالوگ دسترسی — هم‌خوان با permission-catalog.ts بک‌اند */
export const MODULE_LABEL: Record<string, string> = {
  inquiry: "ثبت استعلام",
  rfq: "استعلام از تأمین‌کنندگان",
  selection: "انتخاب نهایی و قیمت‌گذاری",
  proposal: "پیشنهاد به مشتری",
  outcome: "نتیجه نهایی (برد/باخت)",
  order: "سفارش مشتری",
  po: "سفارش خرید (PO)",
  shipping: "حمل و گمرک / مدیریت بارها",
  settlement: "تحویل و تسویه",
  partners: "شرکت‌ها و رابطین",
  users: "کاربران و گروه‌های دسترسی",
  catalog: "کاتالوگ کالا",
};
