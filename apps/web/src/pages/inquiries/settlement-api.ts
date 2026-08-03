import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { FlexPaymentPatch, FlexPaymentRow } from "../../components/ui/FlexPaymentList";
import { Delivery, InvoiceState } from "./settlement-types";

const deliveryKey = (inquiryId: string) => ["inquiries", inquiryId, "delivery"];
const invoiceKey = (inquiryId: string) => ["inquiries", inquiryId, "invoice"];
const collectionsKey = (inquiryId: string) => ["inquiries", inquiryId, "invoice", "collections"];

export function useDelivery(inquiryId: string) {
  return useQuery({
    queryKey: deliveryKey(inquiryId),
    queryFn: async () => (await apiClient.get<Delivery>(`/inquiries/${inquiryId}/delivery`)).data,
  });
}

export interface UpdateDeliveryBody {
  actualDeliveryDate?: string;
  deliveryMethod?: string;
  recipientName?: string;
  deliveryReceiptFileUrl?: string;
  customerAcceptanceDate?: string;
  customerAcceptanceStatus?: string;
}

export function useDeliveryMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (body: UpdateDeliveryBody) =>
      (await apiClient.patch<Delivery>(`/inquiries/${inquiryId}/delivery`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKey(inquiryId) }),
  });
  return { update };
}

export function useInvoice(inquiryId: string) {
  return useQuery({
    queryKey: invoiceKey(inquiryId),
    queryFn: async () => (await apiClient.get<InvoiceState>(`/inquiries/${inquiryId}/invoice`)).data,
  });
}

export interface UpsertInvoiceBody {
  invoiceNumber: string;
  issueDate: string;
  paymentDeadline?: string;
}

export interface SaveInvoiceItemBody {
  description?: string;
  sourceCustomerPaymentId?: string;
  amountCurrency?: number;
  currencyCode?: string;
  exchangeRateDate?: string;
  exchangeRateValue?: number;
}

export function useInvoiceMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invoiceKey(inquiryId) });

  const upsertInvoice = useMutation({
    mutationFn: async (body: UpsertInvoiceBody) =>
      (await apiClient.put<InvoiceState>(`/inquiries/${inquiryId}/invoice`, body)).data,
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: async (body: SaveInvoiceItemBody) =>
      (await apiClient.post<InvoiceState>(`/inquiries/${inquiryId}/invoice/items`, body)).data,
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SaveInvoiceItemBody }) =>
      (await apiClient.patch<InvoiceState>(`/invoice-items/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<InvoiceState>(`/invoice-items/${id}`)).data,
    onSuccess: invalidate,
  });

  return { upsertInvoice, addItem, updateItem, deleteItem };
}

export function useCollections(inquiryId: string) {
  return useQuery({
    queryKey: collectionsKey(inquiryId),
    queryFn: async () =>
      (await apiClient.get<FlexPaymentRow[]>(`/inquiries/${inquiryId}/invoice/collections`)).data,
  });
}

export function useCollectionMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: collectionsKey(inquiryId) });

  const add = useMutation({
    mutationFn: async (body: FlexPaymentPatch) =>
      (await apiClient.post<FlexPaymentRow[]>(`/inquiries/${inquiryId}/invoice/collections`, body)).data,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: FlexPaymentPatch }) =>
      (await apiClient.patch<FlexPaymentRow[]>(`/invoice-collections/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<FlexPaymentRow[]>(`/invoice-collections/${id}`)).data,
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
