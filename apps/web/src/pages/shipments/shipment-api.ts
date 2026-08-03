import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { ExportDocuments, ImportDocuments, ShipmentDetail, ShipmentSummary } from "./shipping-types";

const KEY = ["shipments"];

export function useShipments() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<ShipmentSummary[]>("/shipments")).data,
  });
}

export function useShipment(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => (await apiClient.get<ShipmentDetail>(`/shipments/${id}`)).data,
    enabled: !!id,
  });
}

export function useShipmentMutations(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: KEY });
    queryClient.invalidateQueries({ queryKey: [...KEY, id] });
  };

  const update = useMutation({
    mutationFn: async (body: Partial<ShipmentDetail>) =>
      (await apiClient.patch<ShipmentDetail>(`/shipments/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const updateExportDocuments = useMutation({
    mutationFn: async (body: Partial<ExportDocuments>) =>
      (await apiClient.patch<ShipmentDetail>(`/shipments/${id}/export-documents`, body)).data,
    onSuccess: invalidate,
  });

  const markExportDocumentsSent = useMutation({
    mutationFn: async () => (await apiClient.post<ShipmentDetail>(`/shipments/${id}/export-documents/mark-sent`)).data,
    onSuccess: invalidate,
  });

  const updateImportDocuments = useMutation({
    mutationFn: async (body: Partial<ImportDocuments>) =>
      (await apiClient.patch<ShipmentDetail>(`/shipments/${id}/import-documents`, body)).data,
    onSuccess: invalidate,
  });

  const advance = useMutation({
    mutationFn: async () => (await apiClient.post<ShipmentDetail>(`/shipments/${id}/advance`)).data,
    onSuccess: invalidate,
  });

  // فاز ۲۷ — اسناد چندفایلی + درخواست اصلاح
  const addDocument = useMutation({
    mutationFn: async (body: { docKey: string; fileUrl: string; fileName?: string }) =>
      (await apiClient.post<ShipmentDetail>(`/shipments/${id}/documents`, body)).data,
    onSuccess: invalidate,
  });

  const removeDocument = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/shipment-documents/${documentId}`);
    },
    onSuccess: invalidate,
  });

  const createEditRequest = useMutation({
    mutationFn: async (body: { stage: string; reason: string }) =>
      (await apiClient.post<ShipmentDetail>(`/shipments/${id}/edit-requests`, body)).data,
    onSuccess: invalidate,
  });

  const relock = useMutation({
    mutationFn: async () => (await apiClient.post<ShipmentDetail>(`/shipments/${id}/relock`)).data,
    onSuccess: invalidate,
  });

  return {
    update,
    updateExportDocuments,
    markExportDocumentsSent,
    updateImportDocuments,
    advance,
    addDocument,
    removeDocument,
    createEditRequest,
    relock,
  };
}
