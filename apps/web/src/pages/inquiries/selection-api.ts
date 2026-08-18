import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import {
  DeliveryTerm,
  IncotermOption,
  PricingCost,
  SelectionDeliveryOption,
  SelectionExchangeRate,
  SelectionState,
} from "./selection-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "selection"];
const pricingCostsKey = (inquiryId: string) => ["inquiries", inquiryId, "selection", "pricing-costs"];
const pricingOptionsKey = (inquiryId: string) => ["inquiries", inquiryId, "selection", "pricing-options"];

export function useSelection(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<SelectionState>(`/inquiries/${inquiryId}/selection`)).data,
  });
}

// ============================================================
// فاز ۶۰ (اصلاح — بازخورد کاربر) — موتور قیمت‌گذاری بازرگانی مبتنی بر Incoterm. این بخش («تعیین
// حاشیه سود») همین‌جا (مرحله «انتخاب نهایی و قیمت‌گذاری») مدیریت می‌شه، نه در تب «پیشنهاد به مشتری».
// ============================================================

export function usePricingCosts(inquiryId: string) {
  return useQuery({
    queryKey: pricingCostsKey(inquiryId),
    queryFn: async () => (await apiClient.get<PricingCost[]>(`/inquiries/${inquiryId}/selection/pricing-costs`)).data,
  });
}

export function usePricingOptions(inquiryId: string) {
  return useQuery({
    queryKey: pricingOptionsKey(inquiryId),
    queryFn: async () =>
      (await apiClient.get<IncotermOption[]>(`/inquiries/${inquiryId}/selection/pricing-options`)).data,
  });
}

export interface SavePricingCostBody {
  description: string;
  amount: number;
  currencyCode: string;
  includeInMarginBase?: boolean;
  deliveryTerm?: DeliveryTerm;
}

export interface AddPricingOptionBody {
  deliveryTerm: DeliveryTerm;
  incotermLocation?: string;
  shippingMethod?: string;
  deliveryDays: number;
  deliveryDaysUnit?: "day" | "week";
  paymentTerms?: string;
  currencyCode: string;
  exchangeRate?: number;
  defaultMarkupPercent?: number;
}

export interface SavePricingOptionMarkupBody {
  defaultMarkupPercent?: number;
  items?: { inquiryItemId: string; markupPercent: number }[];
}

// اصلاح فروش (Sales Adjustment) عمداً اینجا نیست — همچنان در تب «پیشنهاد به مشتری»
// (proposal-api.ts) با کلید proposal.edit_price انجام می‌شه، هرگز مارک‌آپ/قیمت بازرگانی رو تغییر نمی‌ده

export function usePricingMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidatePricingCosts = () => {
    queryClient.invalidateQueries({ queryKey: pricingCostsKey(inquiryId) });
    queryClient.invalidateQueries({ queryKey: pricingOptionsKey(inquiryId) });
  };
  const invalidatePricingOptions = () => {
    queryClient.invalidateQueries({ queryKey: pricingOptionsKey(inquiryId) });
    // اصلاح مارک‌آپ روی selection.getSelection اثری نداره، ولی وقتی تب پیشنهاد به مشتری هم‌زمان
    // بازه، pricingDeliveryOptions اونجا هم باید تازه بشه
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "proposal"] });
  };

  const createPricingCost = useMutation({
    mutationFn: async (body: SavePricingCostBody) =>
      (await apiClient.post<PricingCost>(`/inquiries/${inquiryId}/selection/pricing-costs`, body)).data,
    onSuccess: invalidatePricingCosts,
  });

  const updatePricingCost = useMutation({
    mutationFn: async ({ costId, body }: { costId: string; body: SavePricingCostBody }) =>
      (await apiClient.patch<PricingCost>(`/inquiries/${inquiryId}/selection/pricing-costs/${costId}`, body)).data,
    onSuccess: invalidatePricingCosts,
  });

  const deletePricingCost = useMutation({
    mutationFn: async (costId: string) =>
      (await apiClient.delete(`/inquiries/${inquiryId}/selection/pricing-costs/${costId}`)).data,
    onSuccess: invalidatePricingCosts,
  });

  const addPricingOption = useMutation({
    mutationFn: async (body: AddPricingOptionBody) =>
      (await apiClient.post<IncotermOption>(`/inquiries/${inquiryId}/selection/pricing-options`, body)).data,
    onSuccess: invalidatePricingOptions,
  });

  const removePricingOption = useMutation({
    mutationFn: async (optionId: string) =>
      (await apiClient.delete(`/inquiries/${inquiryId}/selection/pricing-options/${optionId}`)).data,
    onSuccess: invalidatePricingOptions,
  });

  const saveMarkup = useMutation({
    mutationFn: async ({ optionId, body }: { optionId: string; body: SavePricingOptionMarkupBody }) =>
      (
        await apiClient.patch<IncotermOption>(
          `/inquiries/${inquiryId}/selection/pricing-options/${optionId}/markup`,
          body,
        )
      ).data,
    onSuccess: invalidatePricingOptions,
  });

  return { createPricingCost, updatePricingCost, deletePricingCost, addPricingOption, removePricingOption, saveMarkup };
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
