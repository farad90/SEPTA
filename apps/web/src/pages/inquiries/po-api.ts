import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { PoGroup } from "./po-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "purchase-orders"];

export function usePurchaseOrders(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<PoGroup[]>(`/inquiries/${inquiryId}/purchase-orders`)).data,
  });
}

export interface SavePoBody {
  poNumber?: string;
  ourEntityId?: string;
  issueDate?: string;
  deliveryDueDate?: string;
}

export interface SaveSupplierPaymentBody {
  paymentDescription?: string;
  dueDate?: string;
  amount?: number;
  actualPaymentDate?: string;
  paymentDocumentFileUrl?: string;
  paymentMethod?: string;
  status?: string;
}

export function usePoMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key(inquiryId) });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const save = useMutation({
    mutationFn: async ({ supplierId, body }: { supplierId: string; body: SavePoBody }) =>
      (await apiClient.put<PoGroup>(`/inquiries/${inquiryId}/purchase-orders/${supplierId}`, body)).data,
    onSuccess: invalidate,
  });

  const addPayment = useMutation({
    mutationFn: async ({ supplierId, body }: { supplierId: string; body: SaveSupplierPaymentBody }) =>
      (
        await apiClient.post<PoGroup>(
          `/inquiries/${inquiryId}/purchase-orders/${supplierId}/payments`,
          body,
        )
      ).data,
    onSuccess: invalidate,
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SaveSupplierPaymentBody }) =>
      (await apiClient.patch<PoGroup>(`/po-payments/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<PoGroup>(`/po-payments/${id}`)).data,
    onSuccess: invalidate,
  });

  return { save, addPayment, updatePayment, deletePayment };
}
