export const PAYROLL_STATUS_ORDER = ["draft", "calculated", "reviewed", "approved", "posted", "locked"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUS_ORDER)[number];

export type ManualPayrollTransition = "reviewed" | "approved" | "posted" | "locked";

export interface TransitionRule {
  requiresFrom: PayrollStatus;
  stampField: "reviewedAt" | "approvedAt" | "postedAt" | "lockedAt";
  actorField: "reviewedBy" | "approvedBy" | "postedBy" | "lockedBy";
  permissionKey: string;
}

/**
 * Draft/Calculated دستی نیستند — Draft پیش‌فرض دیتابیس است و Calculated فقط توسط
 * Payroll Processor (مرحله‌ی Store Result) ست می‌شود. از اینجا به بعد، هر گذار با یک اقدام
 * انسانیِ صریح (بازبینی/تأیید/ثبت حسابداری/قفل) و ثبت actor/timestamp انجام می‌شود.
 */
export const MANUAL_TRANSITIONS: Record<ManualPayrollTransition, TransitionRule> = {
  reviewed: {
    requiresFrom: "calculated",
    stampField: "reviewedAt",
    actorField: "reviewedBy",
    permissionKey: "payroll_engine.review",
  },
  approved: {
    requiresFrom: "reviewed",
    stampField: "approvedAt",
    actorField: "approvedBy",
    permissionKey: "payroll_engine.approve",
  },
  posted: {
    requiresFrom: "approved",
    stampField: "postedAt",
    actorField: "postedBy",
    permissionKey: "payroll_engine.post",
  },
  locked: {
    requiresFrom: "posted",
    stampField: "lockedAt",
    actorField: "lockedBy",
    permissionKey: "payroll_engine.lock",
  },
};

export function isLocked(status: string): boolean {
  return status === "locked";
}
