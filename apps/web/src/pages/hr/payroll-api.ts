import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

export const PAYROLL_STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-warningSoft text-warning" },
  finalized: { label: "نهایی‌شده", className: "bg-accentSoft text-accent" },
  paid: { label: "پرداخت‌شده", className: "bg-successSoft text-success" },
};

export interface PayrollPeriod {
  id: string;
  ourEntityId: string;
  periodMonth: number;
  periodYear: number;
  status: "draft" | "finalized" | "paid";
  finalizedAt: string | null;
  createdAt: string;
  ourEntity: { id: string; entityName: string };
  _count?: { payslips: number };
}

export interface PayslipItem {
  id: string;
  itemType: "earning" | "deduction";
  category: string;
  description: string | null;
  amount: string;
}

export interface Payslip {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  baseSalary: string;
  totalBenefits: string;
  totalOvertime: string;
  totalDeductions: string;
  netAmount: string;
  currencyCode: string;
  status: "draft" | "finalized" | "paid";
  generatedAt: string;
  items: PayslipItem[];
  payrollPeriod: { id: string; periodMonth: number; periodYear: number; ourEntityId: string };
  employee?: { id: string; fullName: string; employeeNumber: string };
}

const PERIODS_KEY = ["hr-payroll-periods"];

export function usePayrollPeriods() {
  return useQuery({
    queryKey: PERIODS_KEY,
    queryFn: async () => (await apiClient.get<PayrollPeriod[]>("/payroll-periods")).data,
  });
}

export function usePeriodPayslips(periodId: string | null) {
  return useQuery({
    queryKey: ["hr-period-payslips", periodId],
    queryFn: async () => (await apiClient.get<Payslip[]>(`/payroll-periods/${periodId}/payslips`)).data,
    enabled: !!periodId,
  });
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ["hr-my-payslips"],
    queryFn: async () => (await apiClient.get<Payslip[]>("/payslips/mine")).data,
  });
}

export function useEmployeePayslips(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-payslips", employeeId],
    queryFn: async () => (await apiClient.get<Payslip[]>(`/employees/${employeeId}/payslips`)).data,
  });
}

export function usePayrollMutations() {
  const queryClient = useQueryClient();
  const invalidatePeriods = () => queryClient.invalidateQueries({ queryKey: PERIODS_KEY });

  const createPeriod = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<PayrollPeriod>("/payroll-periods", body)).data,
    onSuccess: invalidatePeriods,
  });

  const finalizePeriod = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<PayrollPeriod>(`/payroll-periods/${id}/finalize`)).data,
    onSuccess: (_, id) => {
      invalidatePeriods();
      queryClient.invalidateQueries({ queryKey: ["hr-period-payslips", id] });
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<PayrollPeriod>(`/payroll-periods/${id}/mark-paid`)).data,
    onSuccess: (_, id) => {
      invalidatePeriods();
      queryClient.invalidateQueries({ queryKey: ["hr-period-payslips", id] });
    },
  });

  const generatePayslip = useMutation({
    mutationFn: async ({ periodId, employeeId }: { periodId: string; employeeId: string }) =>
      (await apiClient.post<Payslip>(`/payroll-periods/${periodId}/payslips/${employeeId}/generate`)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-period-payslips", variables.periodId] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-payslips", variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ["hr-my-payslips"] });
    },
  });

  return { createPeriod, finalizePeriod, markPaid, generatePayslip };
}
