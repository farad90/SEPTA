import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { LetterDetail, LetterSummary } from "./correspondence-types";

const KEY = ["letters"];

export interface LetterListFilters {
  q?: string;
  type?: string;
  status?: string;
  department?: string;
}

export function useLetters(filters: LetterListFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () =>
      (
        await apiClient.get<LetterSummary[]>("/letters", {
          params: { ...filters, q: filters.q || undefined },
        })
      ).data,
  });
}

export function useLetter(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => (await apiClient.get<LetterDetail>(`/letters/${id}`)).data,
    enabled: !!id,
  });
}

export interface LetterPartyBody {
  ourEntityId?: string;
  partnerId?: string;
  contactId?: string;
}

export interface SaveLetterBody {
  type?: string;
  letterDate?: string;
  subject?: string;
  sender?: LetterPartyBody;
  receiver?: LetterPartyBody;
  issuingEntityId?: string;
  department?: string;
  priority?: string;
  relatedInquiryId?: string;
  relatedShipmentId?: string;
  description?: string;
  // فاز ۲۴ — فیلدهای وابسته به جهت نامه
  senderReferenceNumber?: string;
  responsibleUserId?: string;
  signerUserIds?: string[];
  internalFromDepartmentId?: string;
  internalToDepartmentId?: string;
}

export function useLetterMutations() {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: KEY });
  const invalidateOne = (id: string) => queryClient.invalidateQueries({ queryKey: [...KEY, id] });

  const create = useMutation({
    mutationFn: async (body: SaveLetterBody) => (await apiClient.post<LetterSummary>("/letters", body)).data,
    onSuccess: invalidateList,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SaveLetterBody }) =>
      (await apiClient.patch<LetterDetail>(`/letters/${id}`, body)).data,
    onSuccess: (_, { id }) => {
      invalidateList();
      invalidateOne(id);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/letters/${id}`)).data,
    onSuccess: invalidateList,
  });

  const register = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<LetterDetail>(`/letters/${id}/register`)).data,
    onSuccess: (_, id) => {
      invalidateList();
      invalidateOne(id);
    },
  });

  const refer = useMutation({
    mutationFn: async ({ id, referredToUserId, note }: { id: string; referredToUserId: string; note?: string }) =>
      (await apiClient.post<LetterDetail>(`/letters/${id}/refer`, { referredToUserId, note })).data,
    onSuccess: (_, { id }) => invalidateOne(id),
  });

  const workflowAction = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: string; note?: string }) =>
      (await apiClient.post<LetterDetail>(`/letters/${id}/workflow`, { action, note })).data,
    onSuccess: (_, { id }) => {
      invalidateList();
      invalidateOne(id);
    },
  });

  const addDocument = useMutation({
    mutationFn: async ({
      letterId,
      fileUrl,
      fileName,
      category,
      tags,
    }: {
      letterId: string;
      fileUrl: string;
      fileName: string;
      category?: string;
      tags?: string[];
    }) => (await apiClient.post<LetterDetail>(`/letters/${letterId}/documents`, { fileUrl, fileName, category, tags })).data,
    onSuccess: (_, { letterId }) => {
      invalidateList();
      invalidateOne(letterId);
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({
      docId,
      category,
      tags,
    }: {
      docId: string;
      letterId: string;
      category?: string;
      tags?: string[];
    }) => (await apiClient.patch<LetterDetail>(`/documents/${docId}`, { category, tags })).data,
    onSuccess: (_, { letterId }) => invalidateOne(letterId),
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ docId }: { docId: string; letterId: string }) =>
      (await apiClient.delete<LetterDetail>(`/documents/${docId}`)).data,
    onSuccess: (_, { letterId }) => invalidateOne(letterId),
  });

  return { create, update, remove, register, refer, workflowAction, addDocument, updateDocument, deleteDocument };
}
