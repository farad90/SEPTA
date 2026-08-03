import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import {
  AttendanceRecord,
  BenefitType,
  DeductionType,
  EmployeeBenefit,
  EmployeeChild,
  EmployeeDeduction,
  EmployeeLoan,
  HrRequest,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  MissionRequest,
  MyEmployee,
  OvertimeRecord,
} from "./hr-requests-types";

const ME_KEY = ["hr-me-employee"];
const LEAVE_TYPES_KEY = ["hr-leave-types"];
const BENEFIT_TYPES_KEY = ["hr-benefit-types"];
const DEDUCTION_TYPES_KEY = ["hr-deduction-types"];
const MY_BALANCES_KEY = ["hr-my-leave-balances"];
const MY_LEAVE_KEY = ["hr-my-leave-requests"];
const MY_MISSION_KEY = ["hr-my-mission-requests"];
const MY_OVERTIME_KEY = ["hr-my-overtime-records"];
const MY_LOANS_KEY = ["hr-my-loans"];
const MY_HR_REQUESTS_KEY = ["hr-my-hr-requests"];
const PENDING_LEAVE_KEY = ["hr-pending-leave-approvals"];
const PENDING_MISSION_KEY = ["hr-pending-mission-approvals"];
const PENDING_OVERTIME_KEY = ["hr-pending-overtime-approvals"];
const PENDING_LOAN_KEY = ["hr-pending-loan-approvals"];
const PENDING_HR_REQUEST_KEY = ["hr-pending-hr-request-approvals"];

export function useMyEmployee() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await apiClient.get<MyEmployee | null>("/me/employee")).data,
  });
}

export function useMyEmployeeMutations() {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiClient.patch<MyEmployee>("/me/employee", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
  return { update };
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: LEAVE_TYPES_KEY,
    queryFn: async () => (await apiClient.get<LeaveType[]>("/leave-types")).data,
  });
}

export function useMyLeaveBalances() {
  return useQuery({
    queryKey: MY_BALANCES_KEY,
    queryFn: async () => (await apiClient.get<LeaveBalance[]>("/leave-balances/me")).data,
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: MY_LEAVE_KEY,
    queryFn: async () => (await apiClient.get<LeaveRequest[]>("/leave-requests/mine")).data,
  });
}

export function useMyMissionRequests() {
  return useQuery({
    queryKey: MY_MISSION_KEY,
    queryFn: async () => (await apiClient.get<MissionRequest[]>("/mission-requests/mine")).data,
  });
}

export function useMyOvertimeRecords() {
  return useQuery({
    queryKey: MY_OVERTIME_KEY,
    queryFn: async () => (await apiClient.get<OvertimeRecord[]>("/overtime-records/mine")).data,
  });
}

export function usePendingLeaveApprovals() {
  return useQuery({
    queryKey: PENDING_LEAVE_KEY,
    queryFn: async () => (await apiClient.get<LeaveRequest[]>("/leave-requests/pending-approval")).data,
  });
}

export function usePendingMissionApprovals() {
  return useQuery({
    queryKey: PENDING_MISSION_KEY,
    queryFn: async () => (await apiClient.get<MissionRequest[]>("/mission-requests/pending-approval")).data,
  });
}

export function usePendingOvertimeApprovals() {
  return useQuery({
    queryKey: PENDING_OVERTIME_KEY,
    queryFn: async () => (await apiClient.get<OvertimeRecord[]>("/overtime-records/pending-approval")).data,
  });
}

export function useBenefitTypes() {
  return useQuery({
    queryKey: BENEFIT_TYPES_KEY,
    queryFn: async () => (await apiClient.get<BenefitType[]>("/benefit-types")).data,
  });
}

export function useDeductionTypes() {
  return useQuery({
    queryKey: DEDUCTION_TYPES_KEY,
    queryFn: async () => (await apiClient.get<DeductionType[]>("/deduction-types")).data,
  });
}

export function useMyLoans() {
  return useQuery({
    queryKey: MY_LOANS_KEY,
    queryFn: async () => (await apiClient.get<EmployeeLoan[]>("/employee-loans/mine")).data,
  });
}

export function usePendingLoanApprovals() {
  return useQuery({
    queryKey: PENDING_LOAN_KEY,
    queryFn: async () => (await apiClient.get<EmployeeLoan[]>("/employee-loans/pending-approval")).data,
  });
}

export function useMyHrRequests() {
  return useQuery({
    queryKey: MY_HR_REQUESTS_KEY,
    queryFn: async () => (await apiClient.get<HrRequest[]>("/hr-requests/mine")).data,
  });
}

export function usePendingHrRequestApprovals() {
  return useQuery({
    queryKey: PENDING_HR_REQUEST_KEY,
    queryFn: async () => (await apiClient.get<HrRequest[]>("/hr-requests/pending-approval")).data,
  });
}

export function useEmployeeLoans(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-loans", employeeId],
    queryFn: async () => (await apiClient.get<EmployeeLoan[]>(`/employees/${employeeId}/loans`)).data,
  });
}

export function useEmployeeHrRequests(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-hr-requests", employeeId],
    queryFn: async () => (await apiClient.get<HrRequest[]>(`/employees/${employeeId}/hr-requests`)).data,
  });
}

export function useEmployeeBenefits(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-benefits", employeeId],
    queryFn: async () => (await apiClient.get<EmployeeBenefit[]>(`/employees/${employeeId}/benefits`)).data,
  });
}

export function useEmployeeDeductions(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-deductions", employeeId],
    queryFn: async () => (await apiClient.get<EmployeeDeduction[]>(`/employees/${employeeId}/deductions`)).data,
  });
}

export function useEmployeeChildren(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-children", employeeId],
    queryFn: async () => (await apiClient.get<EmployeeChild[]>(`/employees/${employeeId}/children`)).data,
  });
}

export function useEmployeeChildMutations() {
  const queryClient = useQueryClient();
  const invalidate = (employeeId: string) =>
    queryClient.invalidateQueries({ queryKey: ["hr-employee-children", employeeId] });

  const create = useMutation({
    mutationFn: async ({ employeeId, ...body }: { employeeId: string; fullName?: string; birthDate: string }) =>
      (await apiClient.post<EmployeeChild>(`/employees/${employeeId}/children`, body)).data,
    onSuccess: (_, variables) => invalidate(variables.employeeId),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      await apiClient.delete(`/employee-children/${id}`);
    },
    onSuccess: (_, variables) => invalidate(variables.employeeId),
  });

  return { create, remove };
}

export function useEmployeeLeaveRequests(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-leave-requests", employeeId],
    queryFn: async () => (await apiClient.get<LeaveRequest[]>(`/employees/${employeeId}/leave-requests`)).data,
  });
}

export function useEmployeeMissionRequests(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-mission-requests", employeeId],
    queryFn: async () => (await apiClient.get<MissionRequest[]>(`/employees/${employeeId}/mission-requests`)).data,
  });
}

export function useEmployeeOvertimeRecords(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-overtime-records", employeeId],
    queryFn: async () => (await apiClient.get<OvertimeRecord[]>(`/employees/${employeeId}/overtime-records`)).data,
  });
}

export function useEmployeeLeaveBalances(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-leave-balances", employeeId],
    queryFn: async () => (await apiClient.get<LeaveBalance[]>(`/employees/${employeeId}/leave-balances`)).data,
  });
}

export function useEmployeeAttendance(employeeId: string, month: number, year: number) {
  return useQuery({
    queryKey: ["hr-employee-attendance", employeeId, month, year],
    queryFn: async () =>
      (
        await apiClient.get<AttendanceRecord[]>(`/employees/${employeeId}/attendance`, {
          params: { month, year },
        })
      ).data,
  });
}

export function useLeaveTypeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: LEAVE_TYPES_KEY });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<LeaveType>("/leave-types", body)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      (await apiClient.patch<LeaveType>(`/leave-types/${id}`, body)).data,
    onSuccess: invalidate,
  });

  return { create, update };
}

export function useLeaveBalanceMutations() {
  const queryClient = useQueryClient();
  const set = useMutation({
    mutationFn: async ({ employeeId, ...body }: Record<string, unknown> & { employeeId: string }) =>
      (await apiClient.post<LeaveBalance>(`/employees/${employeeId}/leave-balances`, body)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-leave-balances", variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: MY_BALANCES_KEY });
    },
  });
  return { set };
}

export function useAttendanceMutations() {
  const queryClient = useQueryClient();
  const upsert = useMutation({
    mutationFn: async ({ employeeId, ...body }: Record<string, unknown> & { employeeId: string }) =>
      (await apiClient.post<AttendanceRecord>(`/employees/${employeeId}/attendance`, body)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-attendance", variables.employeeId] });
    },
  });
  return { upsert };
}

function invalidateAllRequestQueries(queryClient: ReturnType<typeof useQueryClient>) {
  [
    MY_LEAVE_KEY,
    MY_MISSION_KEY,
    MY_OVERTIME_KEY,
    MY_LOANS_KEY,
    MY_HR_REQUESTS_KEY,
    PENDING_LEAVE_KEY,
    PENDING_MISSION_KEY,
    PENDING_OVERTIME_KEY,
    PENDING_LOAN_KEY,
    PENDING_HR_REQUEST_KEY,
    MY_BALANCES_KEY,
  ].forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  queryClient.invalidateQueries({ queryKey: ["hr-employee-leave-requests"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-mission-requests"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-overtime-records"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-loans"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-hr-requests"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-attendance"] });
}

export function useLeaveRequestMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAllRequestQueries(queryClient);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<LeaveRequest>("/leave-requests", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<LeaveRequest>(`/leave-requests/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<LeaveRequest>(`/leave-requests/${id}/approve`)).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<LeaveRequest>(`/leave-requests/${id}/reject`)).data,
    onSuccess: invalidate,
  });

  return { create, cancel, approve, reject };
}

export function useMissionRequestMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAllRequestQueries(queryClient);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<MissionRequest>("/mission-requests", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<MissionRequest>(`/mission-requests/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<MissionRequest>(`/mission-requests/${id}/approve`)).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<MissionRequest>(`/mission-requests/${id}/reject`)).data,
    onSuccess: invalidate,
  });

  return { create, cancel, approve, reject };
}

export function useOvertimeRecordMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAllRequestQueries(queryClient);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<OvertimeRecord>("/overtime-records", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<OvertimeRecord>(`/overtime-records/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<OvertimeRecord>(`/overtime-records/${id}/approve`)).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<OvertimeRecord>(`/overtime-records/${id}/reject`)).data,
    onSuccess: invalidate,
  });

  return { create, cancel, approve, reject };
}

export function useEmployeeLoanMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAllRequestQueries(queryClient);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<EmployeeLoan>("/employee-loans", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<EmployeeLoan>(`/employee-loans/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<EmployeeLoan>(`/employee-loans/${id}/approve`)).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<EmployeeLoan>(`/employee-loans/${id}/reject`)).data,
    onSuccess: invalidate,
  });

  return { create, cancel, approve, reject };
}

export function useHrRequestMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAllRequestQueries(queryClient);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<HrRequest>("/hr-requests", body)).data,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<HrRequest>(`/hr-requests/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<HrRequest>(`/hr-requests/${id}/approve`)).data,
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<HrRequest>(`/hr-requests/${id}/reject`)).data,
    onSuccess: invalidate,
  });

  return { create, cancel, approve, reject };
}

export function useBenefitTypeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: BENEFIT_TYPES_KEY });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<BenefitType>("/benefit-types", body)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      (await apiClient.patch<BenefitType>(`/benefit-types/${id}`, body)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<{ success: true }>(`/benefit-types/${id}`)).data,
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useDeductionTypeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: DEDUCTION_TYPES_KEY });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<DeductionType>("/deduction-types", body)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      (await apiClient.patch<DeductionType>(`/deduction-types/${id}`, body)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<{ success: true }>(`/deduction-types/${id}`)).data,
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useEmployeeBenefitMutations() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async ({ employeeId, ...body }: Record<string, unknown> & { employeeId: string }) =>
      (await apiClient.post<EmployeeBenefit>(`/employees/${employeeId}/benefits`, body)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-benefits", variables.employeeId] });
    },
  });
  const update = useMutation({
    mutationFn: async (variables: Record<string, unknown> & { id: string; employeeId: string }) => {
      const { id, employeeId, ...body } = variables;
      void employeeId;
      return (await apiClient.patch<EmployeeBenefit>(`/employee-benefits/${id}`, body)).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-benefits", variables.employeeId] });
    },
  });
  return { create, update };
}

export function useEmployeeDeductionMutations() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async ({ employeeId, ...body }: Record<string, unknown> & { employeeId: string }) =>
      (await apiClient.post<EmployeeDeduction>(`/employees/${employeeId}/deductions`, body)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-deductions", variables.employeeId] });
    },
  });
  const update = useMutation({
    mutationFn: async (variables: Record<string, unknown> & { id: string; employeeId: string }) => {
      const { id, employeeId, ...body } = variables;
      void employeeId;
      return (await apiClient.patch<EmployeeDeduction>(`/employee-deductions/${id}`, body)).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hr-employee-deductions", variables.employeeId] });
    },
  });
  return { create, update };
}
