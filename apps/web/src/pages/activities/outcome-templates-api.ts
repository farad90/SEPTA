import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["activity-outcome-templates"];

export type OutcomeEffect = "close" | "create_follow_up" | "keep_waiting";

export interface OutcomeTemplate {
  id: string;
  activityType: string;
  label: string;
  isDefault: boolean;
  effect: OutcomeEffect;
  requiresFollowUp: boolean;
  followUpActivityType: string | null;
  followUpOffsetMinutes: number | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface CreateOutcomeTemplateBody {
  activityType: string;
  label: string;
  effect?: OutcomeEffect;
  requiresFollowUp?: boolean;
  followUpActivityType?: string;
  followUpOffsetMinutes?: number;
}

export function useOutcomeTemplates(activityType?: string) {
  return useQuery({
    queryKey: [...KEY, activityType],
    queryFn: async () =>
      (await apiClient.get<OutcomeTemplate[]>("/activity-outcome-templates", { params: { activityType } })).data,
  });
}

export function useOutcomeTemplateMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (body: CreateOutcomeTemplateBody) =>
      (await apiClient.post<OutcomeTemplate>("/activity-outcome-templates", body)).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/activity-outcome-templates/${id}`)).data,
    onSuccess: invalidate,
  });

  return { create, remove };
}
