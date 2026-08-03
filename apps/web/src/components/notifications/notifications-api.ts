import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["notifications"];

/** دکمهٔ قابل‌اقدام داخل اعلان (فاز ۲۷ — اولین استفاده: درخواست اصلاح محموله) */
export interface NotificationAction {
  label: string;
  action: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  actions: NotificationAction[] | null;
  isRead: boolean;
  isActioned: boolean;
  actionedAt: string | null;
  createdAt: string;
}

/**
 * نگاشت اقدام اعلان به endpoint واقعی بر اساس نوع موجودیت مرتبط —
 * انواع بعدی اعلان قابل‌اقدام فقط یک entry اینجا اضافه می‌کنن
 */
export const NOTIFICATION_ACTION_ENDPOINTS: Record<string, (entityId: string, action: string) => string> = {
  shipment_edit_request: (entityId, action) => `/shipment-edit-requests/${entityId}/${action}`,
  // فاز ۳۵-ج — تأیید/رد کاهش قیمت پیشنهاد مالی نسبت به قیمت پایهٔ مدیریت
  proposal_price_change_request: (entityId, action) => `/proposal-price-change-requests/${entityId}/${action}`,
  // فاز ۵۷ — تأیید/رد درخواست حذف RFQ
  rfq_delete_request: (entityId, action) => `/rfq-delete-requests/${entityId}/${action}`,
};

export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<Notification[]>("/notifications")).data,
    refetchInterval: 30_000,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const markRead = useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/notifications/${id}/read`)).data,
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => (await apiClient.post("/notifications/mark-all-read")).data,
    onSuccess: invalidate,
  });

  return { markRead, markAllRead };
}
