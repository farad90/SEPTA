import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { ManagedUser, PermissionCatalogModule, PermissionGroupSummary } from "../../lib/types";

const USERS_KEY = ["users"];
const GROUPS_KEY = ["permission-groups"];

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => (await apiClient.get<ManagedUser[]>("/users")).data,
    enabled,
  });
}

/**
 * لیست سبک همکاران فعال — بدون نیاز به users.manage.
 * forAssignment=true: برای واگذاری پرونده، اعضای گروه «مدیریت» حذف می‌شن (درخواست کاربر).
 */
export function useColleagues(forAssignment = false) {
  return useQuery({
    queryKey: ["colleagues", { forAssignment }],
    queryFn: async () =>
      (
        await apiClient.get<{ id: string; fullName: string }[]>("/users/colleagues", {
          params: forAssignment ? { forAssignment: "true" } : undefined,
        })
      ).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePendingUsers() {
  return useQuery({
    queryKey: [...USERS_KEY, "pending"],
    queryFn: async () => (await apiClient.get<ManagedUser[]>("/users/pending")).data,
  });
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: async () => (await apiClient.get<PermissionGroupSummary[]>("/permission-groups")).data,
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ["permission-catalog"],
    queryFn: async () => (await apiClient.get<PermissionCatalogModule[]>("/permissions")).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: USERS_KEY });
    queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
  };

  const approve = useMutation({
    mutationFn: async ({ userId, permissionGroupId }: { userId: string; permissionGroupId: string }) =>
      (await apiClient.post<ManagedUser>(`/users/${userId}/approve`, { permissionGroupId })).data,
    onSuccess: invalidate,
  });

  const create = useMutation({
    mutationFn: async (body: {
      fullName: string;
      email: string;
      mobile?: string;
      initialPassword: string;
      permissionGroupId: string;
    }) => (await apiClient.post<ManagedUser>("/users", body)).data,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      userId,
      ...body
    }: {
      userId: string;
      permissionGroupId?: string;
      status?: "active" | "inactive";
      fullName?: string;
      phone?: string;
    }) => (await apiClient.patch<ManagedUser>(`/users/${userId}`, body)).data,
    onSuccess: invalidate,
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      (await apiClient.post<{ success: boolean }>(`/users/${userId}/reset-password`, { newPassword })).data,
  });

  return { approve, create, update, resetPassword };
}

export function useGroupMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY });

  const create = useMutation({
    mutationFn: async (body: { groupName: string; permissionKeys: string[] }) =>
      (await apiClient.post<PermissionGroupSummary>("/permission-groups", body)).data,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      groupName?: string;
      permissionKeys?: string[];
    }) => (await apiClient.patch<PermissionGroupSummary>(`/permission-groups/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/permission-groups/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
