import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Department, Employee, EmployeeContract, SimilarEmployee } from "./hr-types";

const DEPT_KEY = ["hr-departments"];
const EMP_KEY = ["hr-employees"];

export function useDepartments() {
  return useQuery({
    queryKey: DEPT_KEY,
    queryFn: async () => (await apiClient.get<Department[]>("/departments")).data,
  });
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: DEPT_KEY });
    queryClient.invalidateQueries({ queryKey: EMP_KEY });
  };

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<Department>("/departments", body);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.patch<Department>(`/departments/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ success: true }>(`/departments/${id}`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useEmployees(params: { q?: string; departmentId?: string; status?: string }) {
  return useQuery({
    queryKey: [...EMP_KEY, params],
    queryFn: async () =>
      (
        await apiClient.get<Employee[]>("/employees", {
          params: {
            q: params.q || undefined,
            departmentId: params.departmentId || undefined,
            status: params.status || undefined,
          },
        })
      ).data,
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: [...EMP_KEY, id],
    queryFn: async () => (await apiClient.get<Employee>(`/employees/${id}`)).data,
    enabled: !!id,
  });
}

export function useSimilarEmployees(name: string, enabled: boolean) {
  return useQuery({
    queryKey: [...EMP_KEY, "similar", name],
    queryFn: async () => (await apiClient.get<SimilarEmployee[]>("/employees/similar", { params: { name } })).data,
    enabled: enabled && name.trim().length >= 2,
  });
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: EMP_KEY });
    queryClient.invalidateQueries({ queryKey: DEPT_KEY });
  };

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<Employee>("/employees", body);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.patch<Employee>(`/employees/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const assignNumber = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.patch<Employee>(`/employees/${id}/assign-number`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const addContract = useMutation({
    mutationFn: async ({ employeeId, ...body }: Record<string, unknown> & { employeeId: string }) => {
      const { data } = await apiClient.post<EmployeeContract>(`/employees/${employeeId}/contracts`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.patch<EmployeeContract>(`/employee-contracts/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, assignNumber, addContract, updateContract };
}
