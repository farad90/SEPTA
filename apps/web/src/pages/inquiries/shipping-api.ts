import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { ProductionEntry, ShipmentStatusRow, WarehouseReceipt } from "./shipping-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "production-tracking"];
const shipmentStatusKey = (inquiryId: string) => ["inquiries", inquiryId, "shipment-status"];
const warehouseReceiptKey = (inquiryId: string) => ["inquiries", inquiryId, "warehouse-receipt"];

export function useProductionTracking(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () =>
      (await apiClient.get<ProductionEntry[]>(`/inquiries/${inquiryId}/production-tracking`)).data,
  });
}

export function useShipmentStatus(inquiryId: string) {
  return useQuery({
    queryKey: shipmentStatusKey(inquiryId),
    queryFn: async () =>
      (await apiClient.get<ShipmentStatusRow[]>(`/inquiries/${inquiryId}/shipment-status`)).data,
  });
}

export function useWarehouseReceipt(inquiryId: string) {
  return useQuery({
    queryKey: warehouseReceiptKey(inquiryId),
    queryFn: async () => (await apiClient.get<WarehouseReceipt>(`/inquiries/${inquiryId}/warehouse-receipt`)).data,
    retry: false,
  });
}

export function useWarehouseReceiptMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: warehouseReceiptKey(inquiryId) });

  const saveItems = useMutation({
    mutationFn: async (items: { inquiryItemId: string; receivedQuantity: number }[]) =>
      (
        await apiClient.put<WarehouseReceipt>(`/inquiries/${inquiryId}/warehouse-receipt/items`, { items })
      ).data,
    onSuccess: invalidate,
  });

  const addPhoto = useMutation({
    mutationFn: async ({ receiptItemId, photoUrl }: { receiptItemId: string; photoUrl: string }) =>
      (await apiClient.post<WarehouseReceipt>(`/warehouse-receipt-items/${receiptItemId}/photos`, { photoUrl })).data,
    onSuccess: invalidate,
  });

  return { saveItems, addPhoto };
}

export interface UpdateTrackingBody {
  status?: string;
  pickupAddress?: string;
  pickupPhone?: string;
  pickupContactName?: string;
  pickupContactEmail?: string;
  pickupContactPhone?: string;
}

export interface SavePackageBody {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
  pickupLocation?: string;
  status?: "ready_to_ship";
}

export function useShippingMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key(inquiryId) });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const updateTracking = useMutation({
    mutationFn: async ({ poId, body }: { poId: string; body: UpdateTrackingBody }) =>
      (await apiClient.patch<ProductionEntry[]>(`/inquiries/${inquiryId}/production-tracking/${poId}`, body))
        .data,
    onSuccess: invalidate,
  });

  const addLog = useMutation({
    mutationFn: async ({ poId, note }: { poId: string; note: string }) =>
      (
        await apiClient.post<ProductionEntry[]>(
          `/inquiries/${inquiryId}/production-tracking/${poId}/logs`,
          { note },
        )
      ).data,
    onSuccess: invalidate,
  });

  const addPackage = useMutation({
    mutationFn: async (poId: string) =>
      (
        await apiClient.post<ProductionEntry[]>(
          `/inquiries/${inquiryId}/production-tracking/${poId}/packages`,
        )
      ).data,
    onSuccess: invalidate,
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SavePackageBody }) =>
      (await apiClient.patch<ProductionEntry[]>(`/packages/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<ProductionEntry[]>(`/packages/${id}`)).data,
    onSuccess: invalidate,
  });

  return { updateTracking, addLog, addPackage, updatePackage, deletePackage };
}
