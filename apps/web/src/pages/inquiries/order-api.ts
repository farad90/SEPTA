import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { OrderResponse } from "./order-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "order"];

export function useOrder(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<OrderResponse>(`/inquiries/${inquiryId}/order`)).data,
  });
}

export interface SaveOrderBody {
  orderNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  deliveryDueDate?: string;
  contractFileUrl?: string;
}

export interface SavePaymentBody {
  paymentDescription?: string;
  dueDate?: string;
  amount?: number;
  actualPaymentDate?: string;
  paymentDocumentFileUrl?: string;
  status?: string;
}

export interface SaveGuaranteeBody {
  guaranteeType?: string;
  amount?: number;
  issuingBank?: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
}

export function useOrderMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key(inquiryId) });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const save = useMutation({
    mutationFn: async (body: SaveOrderBody) =>
      (await apiClient.put<OrderResponse>(`/inquiries/${inquiryId}/order`, body)).data,
    onSuccess: invalidate,
  });

  const addPayment = useMutation({
    mutationFn: async (body: SavePaymentBody) =>
      (await apiClient.post<OrderResponse>(`/inquiries/${inquiryId}/order/payments`, body)).data,
    onSuccess: invalidate,
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SavePaymentBody }) =>
      (await apiClient.patch<OrderResponse>(`/order-payments/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<OrderResponse>(`/order-payments/${id}`)).data,
    onSuccess: invalidate,
  });

  const addGuarantee = useMutation({
    mutationFn: async (body: SaveGuaranteeBody) =>
      (await apiClient.post<OrderResponse>(`/inquiries/${inquiryId}/order/guarantees`, body)).data,
    onSuccess: invalidate,
  });

  const updateGuarantee = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SaveGuaranteeBody }) =>
      (await apiClient.patch<OrderResponse>(`/order-guarantees/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const deleteGuarantee = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete<OrderResponse>(`/order-guarantees/${id}`)).data,
    onSuccess: invalidate,
  });

  return { save, addPayment, updatePayment, deletePayment, addGuarantee, updateGuarantee, deleteGuarantee };
}
