import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

export interface BroadcastMessage {
  id: string;
  imageUrl: string | null;
  message: string;
  targetType: "user" | "group" | "all";
  targetUserId: string | null;
  targetGroupId: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  creator?: { id: string; fullName: string };
  targetUser?: { id: string; fullName: string } | null;
  targetGroup?: { id: string; groupName: string } | null;
}

export interface CreateBroadcastMessageBody {
  imageUrl?: string;
  message: string;
  targetType: "user" | "group" | "all";
  targetUserId?: string;
  targetGroupId?: string;
}

const LIST_KEY = ["broadcast-messages"];
const PENDING_KEY = ["broadcast-messages", "pending"];

export function useBroadcastMessages() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => (await apiClient.get<BroadcastMessage[]>("/broadcast-messages")).data,
  });
}

export function useBroadcastMessageMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: LIST_KEY });

  const create = useMutation({
    mutationFn: async (body: CreateBroadcastMessageBody) =>
      (await apiClient.post<BroadcastMessage>("/broadcast-messages", body)).data,
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<BroadcastMessage>(`/broadcast-messages/${id}/deactivate`)).data,
    onSuccess: invalidate,
  });

  return { create, deactivate };
}

export function usePendingBroadcasts() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: async () => (await apiClient.get<BroadcastMessage[]>("/broadcast-messages/pending")).data,
    staleTime: 60 * 1000,
  });
}

export function useDismissBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.post(`/broadcast-messages/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  });
}
