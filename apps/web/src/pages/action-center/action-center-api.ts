import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["action-center"];

export type ActionKind = "task" | "follow_up" | "approval" | "reminder" | "mention";
export type ActionOrigin = "mine" | "assigned";
export type ActionPriority = "low" | "normal" | "high" | "urgent";
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

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  task: "کار",
  follow_up: "پیگیری",
  approval: "تأیید",
  reminder: "یادآور",
  mention: "منشن",
};

export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  urgent: "بحرانی",
  high: "مهم",
  normal: "عادی",
  low: "کم‌اهمیت",
};

export interface ActionItemAction {
  label: string;
  method: "POST";
  path: string;
}

export interface ActionItem {
  id: string;
  sourceType: string;
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

export function useActionCenter(scope: "mine" | "team" = "mine") {
  return useQuery({
    queryKey: [...KEY, scope],
    queryFn: async () =>
      (await apiClient.get<ActionCenterResponse>("/action-center", { params: { scope } })).data,
  });
}

/** برای نشان‌گر عددی سایدبار — فقط حالت شخصی، هر ۶۰ ثانیه تازه‌سازی می‌شه */
export function useActionCenterBadgeCount() {
  const { data } = useQuery({
    queryKey: [...KEY, "mine"],
    queryFn: async () =>
      (await apiClient.get<ActionCenterResponse>("/action-center", { params: { scope: "mine" } })).data,
    refetchInterval: 60_000,
  });
  if (!data) return 0;
  return data.summary.overdue + data.summary.today;
}

export function useActionItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: ActionItemAction) => (await apiClient.post(action.path)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
