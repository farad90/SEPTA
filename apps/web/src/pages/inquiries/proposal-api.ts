import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { DeliveryTerm, IncotermOption, SalesAdjustmentReasonCode } from "./selection-types";
import { FinancialProposal, ProposalState, TechnicalProposal } from "./proposal-types";

const key = (inquiryId: string) => ["inquiries", inquiryId, "proposal"];

export function useProposal(inquiryId: string) {
  return useQuery({
    queryKey: key(inquiryId),
    queryFn: async () => (await apiClient.get<ProposalState>(`/inquiries/${inquiryId}/proposal`)).data,
    retry: false,
  });
}

export function useProposalHistory(inquiryId: string, kind: "financial" | "technical", enabled: boolean) {
  return useQuery({
    queryKey: [...key(inquiryId), kind, "history"],
    queryFn: async () =>
      (
        await apiClient.get<(FinancialProposal | TechnicalProposal)[]>(
          `/inquiries/${inquiryId}/proposal/${kind}/history`,
        )
      ).data,
    enabled,
  });
}

// فاز ۳۵-ج: markupPercent از فرم ویرایش حذف شد — کارشناس فروش فقط قیمت نهایی رو مستقیم اصلاح می‌کنه
export interface FinancialItemUpdate {
  inquiryItemId: string;
  finalSalePrice?: number;
}

export interface SaveFinancialBody {
  ourEntityId?: string;
  chosenDeliveryTerm: DeliveryTerm;
  deliveryDays: number;
  deliveryDaysUnit: "day" | "week";
  incotermLocation?: string;
  shippingMethod?: string;
  currencyCode: string;
  /** فاز ۵۷ — اگه با ارز فعلی این نسخه (هنوز ارسال‌نشده) فرق کنه، الزامیه */
  exchangeRate?: number;
  paymentTerms?: string;
  proposalValidityDate?: string;
  negotiationNote?: string;
  paymentMethod?: string;
  partialShipmentAllowed?: boolean;
  documentsChecklist?: string[];
  serviceTest?: string;
  serviceFieldService?: string;
  serviceDesign?: string;
  warrantyTerms?: string;
  remarks?: string;
  items: FinancialItemUpdate[];
}

export interface ReviseFinancialBody {
  newCurrencyCode?: string;
  exchangeRate?: number;
}

export interface TechnicalItemUpdate {
  inquiryItemId: string;
  technicalSpecs?: string;
  complianceNote?: string;
}

export interface SaveTechnicalBody {
  ourEntityId?: string;
  chosenDeliveryTerm: DeliveryTerm;
  deliveryTimeEstimateDays: number;
  deliveryDaysUnit: "day" | "week";
  negotiationNote?: string;
  items: TechnicalItemUpdate[];
}

// ============================================================
// فاز ۶۰ (اصلاح — بازخورد کاربر) — اصلاح فروش (Sales Adjustment). مدیریت هزینه‌های اضافی/گزینه‌های
// ترم تحویل/مارک‌آپ («تعیین حاشیه سود») منتقل شد به مرحله «انتخاب نهایی و قیمت‌گذاری»
// (selection-api.ts، usePricingMutations) — اینجا فقط اصلاح قیمت نهایی نسبت به قیمت محاسبه‌شده
// بازرگانی (فقط‌خواندنی) می‌مونه، هرگز خودِ مارک‌آپ رو تغییر نمی‌ده.
// ============================================================

export interface SaveSalesAdjustmentBody {
  inquiryItemId: string;
  adjustmentAmount: number;
  reasonCode?: SalesAdjustmentReasonCode;
  note?: string;
}

export function useProposalMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key(inquiryId) });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const saveFinancial = useMutation({
    mutationFn: async (body: SaveFinancialBody) =>
      (await apiClient.put<ProposalState>(`/inquiries/${inquiryId}/proposal/financial`, body)).data,
    onSuccess: invalidate,
  });

  const sendFinancial = useMutation({
    mutationFn: async () =>
      (await apiClient.post<ProposalState>(`/inquiries/${inquiryId}/proposal/financial/send`)).data,
    onSuccess: invalidate,
  });

  const reviseFinancial = useMutation({
    mutationFn: async (body?: ReviseFinancialBody) =>
      (await apiClient.post<ProposalState>(`/inquiries/${inquiryId}/proposal/financial/revise`, body ?? {})).data,
    onSuccess: invalidate,
  });

  const saveTechnical = useMutation({
    mutationFn: async (body: SaveTechnicalBody) =>
      (await apiClient.put<ProposalState>(`/inquiries/${inquiryId}/proposal/technical`, body)).data,
    onSuccess: invalidate,
  });

  // فاز ۴۰-ج: تولید خودکار فایل PDF/Excel — سرور تولید می‌کنه، ذخیره می‌کنه و fileUrl پیشنهاد رو خودکار ست می‌کنه
  // فاز ۶۰: deliveryOptionId اختیاری — وقتی پرشده، سند فقط از داده‌ی همون گزینه ترم تحویل ساخته می‌شه
  const generateFinancialDoc = useMutation({
    mutationFn: async (params: { format: "pdf" | "xlsx"; lang: "fa" | "en"; deliveryOptionId?: string }) =>
      (
        await apiClient.post<{ fileUrl: string; fileName: string }>(
          `/inquiries/${inquiryId}/proposal/financial/generate`,
          undefined,
          { params },
        )
      ).data,
    onSuccess: invalidate,
  });

  const generateTechnicalDoc = useMutation({
    mutationFn: async (params: { format: "pdf" | "xlsx"; lang: "fa" | "en" }) =>
      (
        await apiClient.post<{ fileUrl: string; fileName: string }>(
          `/inquiries/${inquiryId}/proposal/technical/generate`,
          undefined,
          { params },
        )
      ).data,
    onSuccess: invalidate,
  });

  const sendTechnical = useMutation({
    mutationFn: async () =>
      (await apiClient.post<ProposalState>(`/inquiries/${inquiryId}/proposal/technical/send`)).data,
    onSuccess: invalidate,
  });

  const reviseTechnical = useMutation({
    mutationFn: async () =>
      (await apiClient.post<ProposalState>(`/inquiries/${inquiryId}/proposal/technical/revise`)).data,
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------
  // فاز ۶۰ (اصلاح — بازخورد کاربر) — اصلاح فروش: مسیر واقعیش حالا روی گزینه‌ی ترم تحویل
  // (InquiryPricingOption، مدیریت‌شده در selection-api.ts) می‌شینه، نه دیگه روی
  // financial/delivery-options قدیمی
  // ------------------------------------------------------------

  const saveSalesAdjustment = useMutation({
    mutationFn: async ({ optionId, body }: { optionId: string; body: SaveSalesAdjustmentBody }) =>
      (
        await apiClient.patch<IncotermOption>(
          `/inquiries/${inquiryId}/proposal/pricing-options/${optionId}/sales-adjustment`,
          body,
        )
      ).data,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "selection", "pricing-options"] });
    },
  });

  return {
    saveFinancial,
    sendFinancial,
    reviseFinancial,
    saveTechnical,
    sendTechnical,
    reviseTechnical,
    generateFinancialDoc,
    generateTechnicalDoc,
    saveSalesAdjustment,
  };
}
