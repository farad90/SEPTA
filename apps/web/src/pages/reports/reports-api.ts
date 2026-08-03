import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import {
  ConversionResponse,
  OrdersPnlResponse,
  OwnSalesSummaryResponse,
  PaymentsResponse,
  RfqResponseRateResponse,
} from "./report-types";

export interface OrdersPnlFilters {
  dateFrom?: string;
  dateTo?: string;
  buyerId?: string;
  salesExpertId?: string;
}

export function useOrdersPnlReport(filters: OrdersPnlFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "orders-pnl", filters],
    queryFn: async () =>
      (
        await apiClient.get<OrdersPnlResponse>("/reports/orders-pnl", {
          params: { ...filters, pageSize: 200 },
        })
      ).data,
    enabled,
  });
}

export interface PaymentsFilters {
  type?: "all" | "receivable" | "payable";
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  overdueOnly?: boolean;
}

export function usePaymentsReport(filters: PaymentsFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "payments", filters],
    queryFn: async () =>
      (
        await apiClient.get<PaymentsResponse>("/reports/payments", {
          params: { ...filters, overdueOnly: filters.overdueOnly ? "true" : undefined, pageSize: 200 },
        })
      ).data,
    enabled,
  });
}

export interface ConversionFilters {
  dateFrom?: string;
  dateTo?: string;
  buyerId?: string;
  salesExpertId?: string;
}

export function useConversionReport(filters: ConversionFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "conversion", filters],
    queryFn: async () => (await apiClient.get<ConversionResponse>("/reports/conversion", { params: filters })).data,
    enabled,
  });
}

export function useOwnSalesSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "own-sales-summary"],
    queryFn: async () =>
      (await apiClient.get<OwnSalesSummaryResponse>("/reports/own-sales-summary")).data,
    enabled,
  });
}

export function useRfqResponseRate(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "rfq-response-rate"],
    queryFn: async () =>
      (await apiClient.get<RfqResponseRateResponse>("/reports/rfq-response-rate")).data,
    enabled,
  });
}
