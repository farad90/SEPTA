// طبق SPEC-PHASE-31 + توسعهٔ Business Action Hub: شکل استاندارد خروجی لایهٔ تجمیع
// (Federated Inbox). این فقط یک DTO در سطح اپلیکیشنه، نه جدول دیتابیس — هیچ منبعی
// مالک این شکل نیست.

export type ActionKind = "task" | "follow_up" | "approval" | "reminder" | "mention";
export type ActionOrigin = "mine" | "assigned";
export type ActionPriority = "low" | "normal" | "high" | "urgent";

// دستهٔ کسب‌وکاری منبع — برای فیلتر/گروه‌بندی در UI، مستقل از sourceType دقیق
export type ActionSource =
  | "inquiry"
  | "sales"
  | "procurement"
  | "finance"
  | "payroll"
  | "shipping"
  | "documents"
  | "hr"
  | "crm"
  | "system";

export type ActionSourceType =
  | "activity"
  | "leave_request"
  | "mission_request"
  | "overtime_record"
  | "employee_loan"
  | "hr_request"
  | "shipment_edit_request"
  | "letter_referral";

export interface ActionItemAction {
  label: string;
  method: "POST";
  path: string;
}

export interface ActionItem {
  id: string;
  sourceType: ActionSourceType;
  sourceId: string;
  source: ActionSource;
  kind: ActionKind;
  title: string;
  subtitle: string | null;
  priority: ActionPriority;
  dueAt: string | null;
  isOverdue: boolean;
  origin: ActionOrigin;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  linkPath: string | null;
  actions: ActionItemAction[];
  createdAt: string;
  // فقط برای sourceType='activity' پر می‌شه — دادهٔ غنی Work Management
  ownerId?: string;
  ownerName?: string;
  creatorId?: string;
  creatorName?: string;
  watcherCount?: number;
}

export interface ActionCenterSummary {
  overdue: number;
  today: number;
  thisWeek: number;
  later: number;
}

export interface ActionCenterResponse {
  summary: ActionCenterSummary;
  items: ActionItem[];
}

/** رابط مشترک هر Rule Provider — هر دامنهٔ ERP می‌تونه یکی از این‌ها اضافه کنه،
 * بدون این‌که ActionCenterService یا این فایل نیاز به تغییر داشته باشن. */
export interface ActionRuleProvider {
  getItems(userId: string, scope: "mine" | "team"): Promise<ActionItem[]>;
}

export const ACTION_RULE_PROVIDERS = Symbol("ACTION_RULE_PROVIDERS");
