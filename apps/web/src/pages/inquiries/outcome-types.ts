export const OUTCOME_MODES = ["won_all", "lost_all", "cancelled", "mixed"] as const;
export type OutcomeMode = (typeof OUTCOME_MODES)[number];

export const LOSS_REASON_OPTIONS = [
  { value: "higher_price", label: "قیمت بالاتر از رقیب" },
  { value: "delivery_time", label: "زمان تحویل نامناسب" },
  { value: "technical_mismatch", label: "عدم تطابق فنی" },
  { value: "customer_requirement_change", label: "تغییر نیاز مشتری" },
  { value: "customer_project_cancelled", label: "لغو پروژه مشتری" },
  { value: "other", label: "سایر" },
] as const;

export const MODE_META: Record<OutcomeMode, { label: string }> = {
  won_all: { label: "برد کامل" },
  lost_all: { label: "باخت کامل" },
  cancelled: { label: "لغو شده" },
  mixed: { label: "ترکیبی (بخشی برد، بخشی باخت)" },
};

export interface OutcomeItemResult {
  result: "won" | "lost" | "cancelled";
  decisionDate: string | null;
  lossReason: string | null;
  competitorName: string | null;
  competitorPrice: number | null;
  winReason: string | null;
  expertNote: string | null;
}

export interface OutcomeItem {
  inquiryItemId: string;
  rowIndex: number;
  itemCode: string;
  description: string;
  quantity: number;
  measurementUnit: string;
  outcome: OutcomeItemResult | null;
}

export interface OutcomeState {
  inquiryId: string;
  status: string;
  items: OutcomeItem[];
}
