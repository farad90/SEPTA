import { ActionCenterSummary, ActionItem, ActionPriority } from "./action-item.types";

export function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function compareItems(a: ActionItem, b: ActionItem): number {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  const priorityRank: Record<ActionPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }
  if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function buildSummary(items: ActionItem[]): ActionCenterSummary {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const summary = { overdue: 0, today: 0, thisWeek: 0, later: 0 };
  for (const item of items) {
    if (item.isOverdue) {
      summary.overdue += 1;
      continue;
    }
    if (!item.dueAt) {
      summary.later += 1;
      continue;
    }
    const due = new Date(item.dueAt);
    if (due < endOfToday) {
      summary.today += 1;
    } else if (due < endOfWeek) {
      summary.thisWeek += 1;
    } else {
      summary.later += 1;
    }
  }
  return summary;
}
