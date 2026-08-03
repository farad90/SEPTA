import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Currency, OurEntity, Rfq } from "./rfq-types";

const KEY = ["rfqs"];

export function useOurEntities() {
  return useQuery({
    queryKey: ["our-entities"],
    queryFn: async () => (await apiClient.get<OurEntity[]>("/our-entities")).data,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await apiClient.get<Currency[]>("/currencies")).data,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRfqs(inquiryId: string) {
  return useQuery({
    queryKey: [...KEY, inquiryId],
    queryFn: async () => (await apiClient.get<Rfq[]>(`/inquiries/${inquiryId}/rfqs`)).data,
  });
}

export interface CreateRfqBody {
  supplierId: string;
  ourEntityId: string;
  inquiryItemIds: string[];
  recipientEmail: string;
  emailSubject?: string;
  responseDueDate?: string;
}

export interface OfferItemBody {
  inquiryItemId: string;
  price: number;
  deliveryTimeDays?: number;
  partNumber?: string;
  builder?: string;
  countryOfOrigin?: string;
  isEquivalent?: boolean;
  technicalSpecs?: string;
  paymentTerms?: string;
  offerValidityDate?: string;
  datasheetUrl?: string;
}

export interface CreateOfferBody {
  offerNumber?: string;
  offerDate?: string;
  currencyCode: string;
  offerContactName?: string;
  vatApplicable?: boolean;
  vatRatePercent?: number;
  otherCosts?: number;
  generalRemarks?: string;
  items: OfferItemBody[];
}

export function useRfqMutations(inquiryId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...KEY, inquiryId] });
    queryClient.invalidateQueries({ queryKey: ["inquiries", inquiryId, "discussions"] });
  };

  const create = useMutation({
    mutationFn: async (body: CreateRfqBody) =>
      (await apiClient.post<Rfq>(`/inquiries/${inquiryId}/rfqs`, body)).data,
    onSuccess: invalidate,
  });

  const technicalQuestion = useMutation({
    mutationFn: async ({ rfqId, questionText }: { rfqId: string; questionText: string }) =>
      (await apiClient.post<Rfq>(`/rfqs/${rfqId}/technical-question`, { questionText })).data,
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ rfqId, reason }: { rfqId: string; reason: string }) =>
      (await apiClient.post<Rfq>(`/rfqs/${rfqId}/reject`, { reason })).data,
    onSuccess: invalidate,
  });

  const createOffer = useMutation({
    mutationFn: async ({ rfqId, ...body }: CreateOfferBody & { rfqId: string }) =>
      (await apiClient.post<Rfq>(`/rfqs/${rfqId}/offers`, body)).data,
    onSuccess: invalidate,
  });

  const updateOffer = useMutation({
    mutationFn: async ({ offerId, ...body }: CreateOfferBody & { offerId: string }) =>
      (await apiClient.patch<Rfq>(`/supplier-offers/${offerId}`, body)).data,
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ rfqId, status }: { rfqId: string; status: string }) =>
      (await apiClient.patch<Rfq>(`/rfqs/${rfqId}/status`, { status })).data,
    onSuccess: invalidate,
  });

  const resendEmail = useMutation({
    mutationFn: async ({ rfqId, recipientEmail }: { rfqId: string; recipientEmail: string }) =>
      (await apiClient.post(`/rfqs/${rfqId}/resend-email`, { recipientEmail })).data,
    onSuccess: invalidate,
  });

  const addOfferDocument = useMutation({
    mutationFn: async ({
      offerId,
      fileUrl,
      fileName,
    }: {
      offerId: string;
      fileUrl: string;
      fileName?: string;
    }) => (await apiClient.post(`/supplier-offers/${offerId}/documents`, { fileUrl, fileName })).data,
    onSuccess: invalidate,
  });

  // فاز ۵۷ — درخواست حذف RFQ (فقط بدون آفر دریافتی)؛ تأیید/رد از داخل اعلان انجام می‌شه
  const requestDelete = useMutation({
    mutationFn: async ({ rfqId, reason }: { rfqId: string; reason: string }) =>
      (await apiClient.post<Rfq>(`/rfqs/${rfqId}/delete-requests`, { reason })).data,
    onSuccess: invalidate,
  });

  return {
    create,
    technicalQuestion,
    reject,
    createOffer,
    updateOffer,
    updateStatus,
    resendEmail,
    addOfferDocument,
    requestDelete,
  };
}

export async function fetchEmailPreview(rfqId: string) {
  const { data } = await apiClient.get<{
    subject: string;
    html: string;
    text: string;
    smtpConfigured: boolean;
  }>(`/rfqs/${rfqId}/email-preview`);
  return data;
}
