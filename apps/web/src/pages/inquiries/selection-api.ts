import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { SelectionDeliveryOption, SelectionExchangeRate, SelectionState } from "./selection-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "selection"];

export function useSelection(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<SelectionState>(`/inquiries/${inquiryId}/selection`)).data,
  });
}

export interface ItemSelectionUpdate {
  inquiryItemId: string;
  selectedOfferItemId?: string | null;
  selectionNotes?: string;
  markupPercent?: number;
  finalSalePrice?: number;
}

export interface OfferDistributeUpdate {
  offerId: string;
  distributeVat: boolean;
  distributeOtherCosts: boolean;
}

export function useSelectionMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key(inquiryId) });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const save = useMutation({
    mutationFn: async (body: {
      items?: ItemSelectionUpdate[];
      offers?: OfferDistributeUpdate[];
      // فاز ۵۷ — undefined یعنی بدون تغییر، null یعنی غیرفعال‌سازی ارز مبنا
      selectionBaseCurrencyCode?: string | null;
      exchangeRates?: SelectionExchangeRate[];
    }) => (await apiClient.patch<SelectionState>(`/inquiries/${inquiryId}/selection`, body)).data,
    onSuccess: invalidate,
  });

  const saveDeliveryOptions = useMutation({
    mutationFn: async (options: SelectionDeliveryOption[]) =>
      (
        await apiClient.put<SelectionState>(`/inquiries/${inquiryId}/selection/delivery-options`, {
          options,
        })
      ).data,
    onSuccess: invalidate,
  });

  const lock = useMutation({
    mutationFn: async (managerNoteToSales: string | undefined) =>
      (
        await apiClient.post<SelectionState & { warnings: string[] }>(
          `/inquiries/${inquiryId}/selection/lock`,
          { managerNoteToSales },
        )
      ).data,
    onSuccess: invalidate,
  });

  const unlock = useMutation({
    mutationFn: async () =>
      (await apiClient.post<SelectionState>(`/inquiries/${inquiryId}/selection/unlock`)).data,
    onSuccess: invalidate,
  });

  return { save, saveDeliveryOptions, lock, unlock };
}
