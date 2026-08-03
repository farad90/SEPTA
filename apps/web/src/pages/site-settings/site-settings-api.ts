import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["site-settings"];

export interface SiteSettings {
  id: number;
  loginBackgroundUrl: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export function useSiteSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<SiteSettings>("/site-settings")).data,
  });
}

export function useUpdateLoginBackground() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loginBackgroundUrl: string | null) => {
      const { data } = await apiClient.put<SiteSettings>("/site-settings/login-background", {
        loginBackgroundUrl,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
