import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { OutcomeMode, OutcomeState } from "./outcome-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "outcome"];

export function useOutcome(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<OutcomeState>(`/inquiries/${inquiryId}/outcome`)).data,
  });
}

export interface SaveOutcomeBody {
  mode: OutcomeMode;
  decisionDate: string;
  winReason?: string;
  lossReason?: string;
  competitorName?: string;
  competitorPrice?: number;
  note?: string;
  itemResults?: Record<string, "won" | "lost">;
}

export function useOutcomeMutations(inquiryId: string) {
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (body: SaveOutcomeBody) =>
      (await apiClient.put<OutcomeState>(`/inquiries/${inquiryId}/outcome`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key(inquiryId) });
      queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
    },
  });

  return { save };
}
