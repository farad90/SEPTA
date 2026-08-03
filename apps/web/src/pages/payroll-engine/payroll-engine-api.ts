import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import {
  EmployeePayrollProfile,
  PayrollCalculationOutcome,
  PayrollComponent,
  PayrollFormula,
  PayrollPeriod,
  PayrollResult,
  PayrollRule,
  PayrollRuleVersion,
  PayrollYear,
} from "./payroll-engine-types";

const YEARS_KEY = ["payroll-engine-years"];
const RULE_VERSIONS_KEY = ["payroll-engine-rule-versions"];
const RULE_VERSION_KEY = ["payroll-engine-rule-version"];
const COMPONENTS_KEY = ["payroll-engine-components"];
const PROFILE_KEY = ["payroll-engine-profile"];
const PERIODS_KEY = ["payroll-engine-periods"];
const PERIOD_KEY = ["payroll-engine-period"];
const RESULTS_KEY = ["payroll-engine-results"];
const RESULT_KEY = ["payroll-engine-result"];

// ------------------------------------------------------------ سال حقوقی
export function usePayrollYears() {
  return useQuery({
    queryKey: YEARS_KEY,
    queryFn: async () => (await apiClient.get<PayrollYear[]>("/payroll/years")).data,
  });
}

export function useCreatePayrollYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { yearNumber: number; calendarType: "jalali" | "gregorian" }) =>
      (await apiClient.post<PayrollYear>("/payroll/years", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: YEARS_KEY }),
  });
}

// ------------------------------------------------------------ نسخه‌ی قانون
export function useRuleVersions(payrollYearId: string | null) {
  return useQuery({
    queryKey: [...RULE_VERSIONS_KEY, payrollYearId],
    enabled: !!payrollYearId,
    queryFn: async () =>
      (await apiClient.get<PayrollRuleVersion[]>("/payroll/rule-versions", { params: { payrollYearId } })).data,
  });
}

export function useRuleVersion(id: string | null) {
  return useQuery({
    queryKey: [...RULE_VERSION_KEY, id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<PayrollRuleVersion>(`/payroll/rule-versions/${id}`)).data,
  });
}

export interface CreateRuleVersionBody {
  payrollYearId: string;
  versionNumber: number;
  title: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export function useRuleVersionMutations() {
  const queryClient = useQueryClient();
  const invalidate = (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: RULE_VERSIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: [...RULE_VERSION_KEY, id] }),
    ]);

  const create = useMutation({
    mutationFn: async (body: CreateRuleVersionBody) =>
      (await apiClient.post<PayrollRuleVersion>("/payroll/rule-versions", body)).data,
    onSuccess: () => invalidate(),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await apiClient.patch<PayrollRuleVersion>(`/payroll/rule-versions/${id}/status`, { status })).data,
    onSuccess: (_, { id }) => invalidate(id),
  });

  const upsertRule = useMutation({
    mutationFn: async ({ ruleVersionId, ...body }: { ruleVersionId: string } & Omit<PayrollRule, "id" | "ruleVersionId" | "value"> & { value: number }) =>
      (await apiClient.post<PayrollRule>(`/payroll/rule-versions/${ruleVersionId}/rules`, body)).data,
    onSuccess: (_, { ruleVersionId }) => invalidate(ruleVersionId),
  });

  const replaceBrackets = useMutation({
    mutationFn: async ({
      ruleVersionId,
      brackets,
    }: {
      ruleVersionId: string;
      brackets: Array<{ bracketOrder: number; fromAmount: number; toAmount?: number | null; ratePercent: number }>;
    }) => (await apiClient.post(`/payroll/rule-versions/${ruleVersionId}/brackets`, { brackets })).data,
    onSuccess: (_, { ruleVersionId }) => invalidate(ruleVersionId),
  });

  const upsertFormula = useMutation({
    mutationFn: async ({
      ruleVersionId,
      ...body
    }: { ruleVersionId: string } & Omit<PayrollFormula, "id" | "ruleVersionId">) =>
      (await apiClient.post<PayrollFormula>(`/payroll/rule-versions/${ruleVersionId}/formulas`, body)).data,
    onSuccess: (_, { ruleVersionId }) => invalidate(ruleVersionId),
  });

  return { create, updateStatus, upsertRule, replaceBrackets, upsertFormula };
}

export function usePreviewFormula() {
  return useMutation({
    mutationFn: async (expression: string) =>
      (await apiClient.post<{ valid: boolean }>("/payroll/formulas/preview", { expression })).data,
  });
}

// ------------------------------------------------------------ جزء حقوق
export function usePayrollComponents() {
  return useQuery({
    queryKey: COMPONENTS_KEY,
    queryFn: async () => (await apiClient.get<PayrollComponent[]>("/payroll/components")).data,
  });
}

export interface ComponentBody {
  code: string;
  title: string;
  componentType: "earning" | "deduction";
  isInsurable?: boolean;
  isTaxable?: boolean;
  calcOrder?: number;
  formulaId?: string;
}

export function useComponentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMPONENTS_KEY });

  const create = useMutation({
    mutationFn: async (body: ComponentBody) => (await apiClient.post<PayrollComponent>("/payroll/components", body)).data,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<ComponentBody> & { id: string; status?: "active" | "inactive" }) =>
      (await apiClient.patch<PayrollComponent>(`/payroll/components/${id}`, body)).data,
    onSuccess: invalidate,
  });

  return { create, update };
}

// ------------------------------------------------------------ پروفایل حقوقی پرسنل
export function usePayrollProfile(employeeId: string | null) {
  return useQuery({
    queryKey: [...PROFILE_KEY, employeeId],
    enabled: !!employeeId,
    queryFn: async () =>
      (await apiClient.get<EmployeePayrollProfile | null>(`/payroll/profiles/${employeeId}`)).data,
  });
}

export function useUpsertPayrollProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      ...body
    }: {
      employeeId: string;
      seniorityBaseDate?: string;
      insuranceNumber?: string;
      costCenterDeptId?: string;
      defaultRuleVersionId?: string;
    }) => (await apiClient.put<EmployeePayrollProfile>(`/payroll/profiles/${employeeId}`, body)).data,
    onSuccess: (_, { employeeId }) => queryClient.invalidateQueries({ queryKey: [...PROFILE_KEY, employeeId] }),
  });
}

// ------------------------------------------------------------ دوره‌ی حقوقی
export function usePayrollPeriods(payrollYearId: string | null) {
  return useQuery({
    queryKey: [...PERIODS_KEY, payrollYearId],
    enabled: !!payrollYearId,
    queryFn: async () =>
      (await apiClient.get<PayrollPeriod[]>("/payroll/periods", { params: { payrollYearId } })).data,
  });
}

export function usePayrollPeriod(id: string | null) {
  return useQuery({
    queryKey: [...PERIOD_KEY, id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<PayrollPeriod>(`/payroll/periods/${id}`)).data,
  });
}

export interface CreatePeriodBody {
  payrollYearId: string;
  periodCode: string;
  monthNumber: number;
  ruleVersionId: string;
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePeriodBody) => (await apiClient.post<PayrollPeriod>("/payroll/periods", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERIODS_KEY }),
  });
}

export function useAggregateWorkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) =>
      (await apiClient.post<{ processed: number; skippedManual: number }>(`/payroll/periods/${periodId}/aggregate-worklog`))
        .data,
    onSuccess: (_, periodId) => queryClient.invalidateQueries({ queryKey: [...RESULTS_KEY, periodId] }),
  });
}

export function useCalculatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) =>
      (await apiClient.post<PayrollCalculationOutcome[]>(`/payroll/periods/${periodId}/calculate`)).data,
    onSuccess: (_, periodId) => queryClient.invalidateQueries({ queryKey: [...RESULTS_KEY, periodId] }),
  });
}

export function useCalculateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, employeeId }: { periodId: string; employeeId: string }) =>
      (await apiClient.post(`/payroll/periods/${periodId}/calculate/${employeeId}`)).data,
    onSuccess: (_, { periodId }) => queryClient.invalidateQueries({ queryKey: [...RESULTS_KEY, periodId] }),
  });
}

// ------------------------------------------------------------ نتیجه/فیش حقوق
export function usePayrollResults(periodId: string | null) {
  return useQuery({
    queryKey: [...RESULTS_KEY, periodId],
    enabled: !!periodId,
    queryFn: async () => (await apiClient.get<PayrollResult[]>(`/payroll/periods/${periodId}/results`)).data,
  });
}

export function usePayrollResult(id: string | null) {
  return useQuery({
    queryKey: [...RESULT_KEY, id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<PayrollResult>(`/payroll/results/${id}`)).data,
  });
}

export interface GeneratedFile {
  fileUrl: string;
  fileName: string;
}

export function useGeneratePayslip() {
  return useMutation({
    mutationFn: async (resultId: string) =>
      (await apiClient.post<GeneratedFile>(`/payroll/results/${resultId}/payslip/generate`)).data,
  });
}

export function useGeneratePayrollList() {
  return useMutation({
    mutationFn: async (periodId: string) =>
      (await apiClient.post<GeneratedFile>(`/payroll/periods/${periodId}/payroll-list/generate`)).data,
  });
}

export function useTransitionResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resultId,
      targetStatus,
    }: {
      resultId: string;
      targetStatus: "reviewed" | "approved" | "posted" | "locked";
    }) => (await apiClient.post<PayrollResult>(`/payroll/results/${resultId}/transition`, { targetStatus })).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [...RESULT_KEY, result.id] });
      queryClient.invalidateQueries({ queryKey: [...RESULTS_KEY, result.payrollPeriodId] });
    },
  });
}
