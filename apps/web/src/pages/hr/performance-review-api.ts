import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

export const REVIEW_STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-warningSoft text-warning" },
  submitted: { label: "ثبت‌شده — منتظر تأیید", className: "bg-accentSoft text-accent" },
  acknowledged: { label: "تأییدشده", className: "bg-successSoft text-success" },
};

export interface PerformanceReviewCycle {
  id: string;
  cycleName: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export interface PerformanceReviewItem {
  id: string;
  criterionName: string;
  weightPercent: string | null;
  score: string | null;
  comments: string | null;
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerId: string;
  overallScore: string | null;
  selfReviewNotes: string | null;
  managerNotes: string | null;
  status: "draft" | "submitted" | "acknowledged";
  submittedAt: string | null;
  acknowledgedAt: string | null;
  cycle: PerformanceReviewCycle;
  items: PerformanceReviewItem[];
  employee: { id: string; fullName: string };
  reviewer: { id: string; fullName: string };
}

const CYCLES_KEY = ["hr-performance-cycles"];

export function usePerformanceReviewCycles() {
  return useQuery({
    queryKey: CYCLES_KEY,
    queryFn: async () => (await apiClient.get<PerformanceReviewCycle[]>("/performance-review-cycles")).data,
  });
}

export function useEmployeePerformanceReviews(employeeId: string) {
  return useQuery({
    queryKey: ["hr-employee-performance-reviews", employeeId],
    queryFn: async () => (await apiClient.get<PerformanceReview[]>(`/employees/${employeeId}/performance-reviews`)).data,
  });
}

export function useMyReviewsAsEmployee() {
  return useQuery({
    queryKey: ["hr-my-reviews-as-employee"],
    queryFn: async () => (await apiClient.get<PerformanceReview[]>("/performance-reviews/mine-as-employee")).data,
  });
}

export function useMyReviewsAsReviewer() {
  return useQuery({
    queryKey: ["hr-my-reviews-as-reviewer"],
    queryFn: async () => (await apiClient.get<PerformanceReview[]>("/performance-reviews/mine-as-reviewer")).data,
  });
}

function invalidateReviewQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["hr-my-reviews-as-employee"] });
  queryClient.invalidateQueries({ queryKey: ["hr-my-reviews-as-reviewer"] });
  queryClient.invalidateQueries({ queryKey: ["hr-employee-performance-reviews"] });
}

export function usePerformanceReviewMutations() {
  const queryClient = useQueryClient();

  const createCycle = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiClient.post<PerformanceReviewCycle>("/performance-review-cycles", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLES_KEY }),
  });

  const closeCycle = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<PerformanceReviewCycle>(`/performance-review-cycles/${id}/close`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLES_KEY }),
  });

  const createReview = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiClient.post<PerformanceReview>("/performance-reviews", body)).data,
    onSuccess: () => invalidateReviewQueries(queryClient),
  });

  const selfReview = useMutation({
    mutationFn: async ({ id, selfReviewNotes }: { id: string; selfReviewNotes: string }) =>
      (await apiClient.patch<PerformanceReview>(`/performance-reviews/${id}/self-review`, { selfReviewNotes })).data,
    onSuccess: () => invalidateReviewQueries(queryClient),
  });

  const submit = useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      (await apiClient.patch<PerformanceReview>(`/performance-reviews/${id}/submit`, body)).data,
    onSuccess: () => invalidateReviewQueries(queryClient),
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<PerformanceReview>(`/performance-reviews/${id}/acknowledge`)).data,
    onSuccess: () => invalidateReviewQueries(queryClient),
  });

  return { createCycle, closeCycle, createReview, selfReview, submit, acknowledge };
}
