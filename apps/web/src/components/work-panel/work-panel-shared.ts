import { ActionItem, ActionPriority } from "../../pages/action-center/action-center-api";

export type Bucket = "overdue" | "today" | "week" | "later";

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "گذشته از موعد",
  today: "امروز",
  week: "این هفته",
  later: "بعداً",
};

export const PRIORITY_COLOR: Record<ActionPriority, { bar: string; text: string; soft: string }> = {
  urgent: { bar: "bg-danger", text: "text-danger", soft: "bg-danger/10" },
  high: { bar: "bg-warning", text: "text-warning", soft: "bg-warningSoft" },
  normal: { bar: "bg-primary", text: "text-primary", soft: "bg-accentSoft" },
  low: { bar: "bg-textSecondary", text: "text-textSecondary", soft: "bg-bg" },
};

export const AVATAR_COLORS = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
}

export function computeBucket(item: ActionItem): Bucket {
  if (item.isOverdue) return "overdue";
  if (!item.dueAt) return "later";
  const due = new Date(item.dueAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (due < endOfToday) return "today";
  if (due < endOfWeek) return "week";
  return "later";
}

export function inHours(n: number): string {
  return new Date(Date.now() + n * 3600 * 1000).toISOString();
}

export function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function nextWeek(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}
