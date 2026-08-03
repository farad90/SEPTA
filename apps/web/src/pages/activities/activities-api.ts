import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["activities"];

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "تماس تلفنی",
  email: "ایمیل",
  meeting: "جلسه",
  follow_up: "پیگیری",
  reminder: "یادآور",
  approval: "تأیید",
  internal_task: "کار داخلی",
  mention: "منشن",
};

export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  open: "باز",
  scheduled: "زمان‌بندی‌شده",
  waiting: "در انتظار",
  overdue: "سررسیدگذشته",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};

export const ACTIVITY_PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  normal: "عادی",
  high: "بالا",
  urgent: "فوری",
};

export interface TaskWatcher {
  userId: string;
  addedByUserId: string;
  addedAt: string;
  user: { id: string; fullName: string };
}

export interface TaskTimelineEntry {
  id: string;
  taskId: string;
  entryType: "comment" | "activity";
  entryText: string;
  actionKind: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  author: { id: string; fullName: string };
}

export interface Activity {
  id: string;
  activityType: string;
  subject: string;
  description: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  priority: string;
  status: string;
  scheduledAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  waitingReason: string | null;
  outcomeNote: string | null;
  outcomeId: string | null;
  outcome: { id: string; label: string } | null;
  assignedTo: { id: string; fullName: string };
  createdBy: { id: string; fullName: string };
  watchers?: TaskWatcher[];
  createdAt: string;
}

export interface CreateActivityBody {
  activityType: string;
  subject: string;
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  priority?: string;
  scheduledAt?: string;
  dueAt?: string;
  assignedToUserId?: string;
}

export function useActivities(params: {
  assignedToMe?: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: async () =>
      (
        await apiClient.get<Activity[]>("/activities", {
          params: {
            assignedToMe: params.assignedToMe ? "true" : undefined,
            relatedEntityType: params.relatedEntityType,
            relatedEntityId: params.relatedEntityId,
            status: params.status,
          },
        })
      ).data,
    enabled: params.relatedEntityType ? !!params.relatedEntityId : true,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => (await apiClient.get<Activity>(`/activities/${id}`)).data,
    enabled: !!id,
  });
}

export function useTaskTimeline(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id, "timeline"],
    queryFn: async () => (await apiClient.get<TaskTimelineEntry[]>(`/activities/${id}/timeline`)).data,
    enabled: !!id,
  });
}

export interface RecordOutcomeBody {
  outcomeId?: string;
  outcomeNote?: string;
  effectOverride?: "close" | "create_follow_up" | "keep_waiting";
  nextActionAt?: string;
  spawnNewTask?: boolean;
}

export function useActivityMutations() {
  const queryClient = useQueryClient();
  // مرکز کار من (WorkPanel) از useActionCenter می‌خونه، نه useActivities — بدون این invalidate
  // دوم، کار تازه‌ساخته‌شده/تکمیل‌شده تا رفرش دستی صفحه توی «مرکز کار من» دیده نمی‌شد
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: KEY });
    queryClient.invalidateQueries({ queryKey: ["action-center"] });
  };

  const create = useMutation({
    mutationFn: async (body: CreateActivityBody) => (await apiClient.post<Activity>("/activities", body)).data,
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: async ({ id, outcomeId, outcomeNote }: { id: string; outcomeId?: string; outcomeNote?: string }) =>
      (await apiClient.post<Activity>(`/activities/${id}/complete`, { outcomeId, outcomeNote })).data,
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<Activity>(`/activities/${id}/cancel`)).data,
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      (await apiClient.post<TaskTimelineEntry>(`/activities/${id}/comments`, { text })).data,
    onSuccess: invalidate,
  });

  const reassign = useMutation({
    mutationFn: async ({ id, newOwnerId, note }: { id: string; newOwnerId: string; note?: string }) =>
      (await apiClient.post<Activity>(`/activities/${id}/reassign`, { newOwnerId, note })).data,
    onSuccess: invalidate,
  });

  const addWatcher = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) =>
      (await apiClient.post<Activity>(`/activities/${id}/watchers`, { userId })).data,
    onSuccess: invalidate,
  });

  const removeWatcher = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) =>
      (await apiClient.delete<Activity>(`/activities/${id}/watchers/${userId}`)).data,
    onSuccess: invalidate,
  });

  const recordOutcome = useMutation({
    mutationFn: async ({ id, ...body }: RecordOutcomeBody & { id: string }) =>
      (await apiClient.post<Activity>(`/activities/${id}/record-outcome`, body)).data,
    onSuccess: invalidate,
  });

  return { create, complete, cancel, addComment, reassign, addWatcher, removeWatcher, recordOutcome };
}
