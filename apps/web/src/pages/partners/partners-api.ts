import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import {
  BusinessPartner,
  Paged,
  PartnerContact,
  SimilarPartner,
} from "../../lib/types";

const KEY = ["business-partners"];

export function usePartners(q: string, type: string) {
  return useQuery({
    queryKey: [...KEY, { q, type }],
    queryFn: async () => {
      const { data } = await apiClient.get<Paged<BusinessPartner>>("/business-partners", {
        params: { q: q || undefined, type: type !== "all" ? type : undefined, pageSize: 100 },
      });
      return data;
    },
  });
}

export function useSimilarPartners(name: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "similar", name],
    queryFn: async () => {
      const { data } = await apiClient.get<SimilarPartner[]>("/business-partners/similar", {
        params: { name },
      });
      return data;
    },
    enabled: enabled && name.trim().length >= 2,
  });
}

export function usePartnerMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (body: Partial<BusinessPartner>) => {
      const { data } = await apiClient.post<BusinessPartner>("/business-partners", body);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<BusinessPartner> & { id: string }) => {
      const { data } = await apiClient.patch<BusinessPartner>(`/business-partners/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/business-partners/${id}`);
    },
    onSuccess: invalidate,
  });

  const addContact = useMutation({
    mutationFn: async ({ partnerId, ...body }: Partial<PartnerContact> & { partnerId: string }) => {
      const { data } = await apiClient.post<PartnerContact>(
        `/business-partners/${partnerId}/contacts`,
        body,
      );
      return data;
    },
    onSuccess: invalidate,
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...body }: Partial<PartnerContact> & { id: string }) => {
      const { data } = await apiClient.patch<PartnerContact>(`/partner-contacts/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/partner-contacts/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, addContact, updateContact, removeContact };
}
