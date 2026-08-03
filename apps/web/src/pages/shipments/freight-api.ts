import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { FreightRfq, ReadyPackage } from "./shipping-types";

const READY_KEY = ["packages", "ready-for-freight"];
const RFQ_KEY = ["freight-rfqs"];

export function useReadyPackages() {
  return useQuery({
    queryKey: READY_KEY,
    queryFn: async () => (await apiClient.get<ReadyPackage[]>("/packages/ready-for-freight")).data,
  });
}

export function useFreightRfqs() {
  return useQuery({
    queryKey: RFQ_KEY,
    queryFn: async () => (await apiClient.get<FreightRfq[]>("/freight-rfqs")).data,
  });
}

export interface CreateFreightRfqBody {
  freightCompanyId: string;
  destinationCustoms: string;
  packageIds: string[];
  recipientEmail: string;
  emailSubject?: string;
}

export interface SaveFreightOfferBody {
  price: number;
  currencyCode: string;
  transitTimeDays?: number;
  offerDate?: string;
  validityDate?: string;
  notes?: string;
}

export function useFreightMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: RFQ_KEY });
    queryClient.invalidateQueries({ queryKey: READY_KEY });
  };

  const create = useMutation({
    mutationFn: async (body: CreateFreightRfqBody) =>
      (await apiClient.post<FreightRfq & { emailSent: boolean; emailError: string | null }>("/freight-rfqs", body))
        .data,
    onSuccess: invalidate,
  });

  const resendEmail = useMutation({
    mutationFn: async ({ rfqId, recipientEmail }: { rfqId: string; recipientEmail: string }) =>
      (await apiClient.post(`/freight-rfqs/${rfqId}/resend`, { recipientEmail })).data,
  });

  const saveOffer = useMutation({
    mutationFn: async ({ rfqId, ...body }: SaveFreightOfferBody & { rfqId: string }) =>
      (await apiClient.put<FreightRfq>(`/freight-rfqs/${rfqId}/offer`, body)).data,
    onSuccess: invalidate,
  });

  const selectWinner = useMutation({
    mutationFn: async (rfqId: string) =>
      (await apiClient.post(`/freight-rfqs/${rfqId}/select-winner`)).data,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });

  return { create, resendEmail, saveOffer, selectWinner };
}

export async function fetchFreightEmailPreview(rfqId: string) {
  const { data } = await apiClient.get<{
    subject: string;
    html: string;
    text: string;
    smtpConfigured: boolean;
  }>(`/freight-rfqs/${rfqId}/email-preview`);
  return data;
}
