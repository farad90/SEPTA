import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { useClickOutside } from "../../lib/use-click-outside";
import { relativeTimeFa } from "../../lib/relative-time";
import {
  NOTIFICATION_ACTION_ENDPOINTS,
  Notification,
  useNotificationMutations,
  useNotifications,
} from "./notifications-api";

// فاز ۲۷ — دکمه‌های قابل‌اقدام داخل اعلان (مثل SAP): فقط وقتی actions پر و هنوز اقدام نشده
function NotificationActions({ notification }: { notification: Notification }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async (action: string) => {
      const buildEndpoint = notification.relatedEntityType
        ? NOTIFICATION_ACTION_ENDPOINTS[notification.relatedEntityType]
        : undefined;
      if (!buildEndpoint || !notification.relatedEntityId) return;
      await apiClient.post(buildEndpoint(notification.relatedEntityId, action));
      await apiClient.post(`/notifications/${notification.id}/action`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? "خطا در انجام اقدام");
    },
  });

  const actions = Array.isArray(notification.actions) ? notification.actions : [];
  if (actions.length === 0) return null;

  if (notification.isActioned) {
    return (
      <p className="px-4 pb-2 text-[10px] text-success flex items-center gap-1">
        <Check size={11} /> اقدام شد
      </p>
    );
  }

  return (
    <div className="px-4 pb-2.5">
      <div className="flex gap-1.5">
        {actions.map((a) => (
          <button
            key={a.action}
            disabled={act.isPending}
            onClick={() => act.mutate(a.action)}
            className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none ${
              a.action === "reject"
                ? "text-danger border border-danger/40 hover:bg-danger/10"
                : "text-white bg-primary hover:brightness-110"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-danger mt-1">{error}</p>}
    </div>
  );
}

function entityPath(notification: Notification): string | null {
  if (notification.relatedEntityType === "inquiry" && notification.relatedEntityId) {
    return `/inquiries/${notification.relatedEntityId}`;
  }
  if (notification.relatedEntityType === "letter" && notification.relatedEntityId) {
    return `/correspondence/${notification.relatedEntityId}`;
  }
  return null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const navigate = useNavigate();

  const { data: notifications = [] } = useNotifications();
  const { markRead, markAllRead } = useNotificationMutations();

  const hasUnread = notifications.some((n) => !n.isRead);

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const path = entityPath(n);
    if (path) {
      navigate(path);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-2 rounded-lg text-textSecondary transition-colors duration-150 hover:text-textPrimary hover:bg-bg"
        onClick={() => setOpen((o) => !o)}
        aria-label="اعلان‌ها"
      >
        <Bell size={18} />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl overflow-hidden z-40 max-h-96 overflow-y-auto bg-surface border border-border shadow-dropdown origin-top-left animate-pop-in">
          <div className="flex items-center justify-between px-4 py-2.5 sticky top-0 border-b border-border bg-surface/95 backdrop-blur-sm">
            <p className="text-xs font-semibold text-textPrimary">اعلان‌ها</p>
            {hasUnread && (
              <button
                className="text-[11px] text-primary font-medium transition-colors duration-150 hover:brightness-110"
                onClick={() => markAllRead.mutate()}
              >
                همه رو خوانده کن
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-xs text-textSecondary text-center">اعلانی وجود ندارد</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`w-full text-right border-b border-border last:border-0 transition-colors duration-150 ${
                  n.isRead ? "bg-transparent" : "bg-accentSoft"
                }`}
              >
                <button
                  onClick={() => handleClick(n)}
                  className="w-full text-right px-4 pt-2.5 pb-1 text-xs transition-colors duration-150 hover:bg-black/[0.02]"
                >
                  <p className="text-textPrimary font-medium">{n.title}</p>
                  {n.message && <p className="text-textSecondary mt-0.5 truncate">{n.message}</p>}
                  <p className="text-textSecondary mt-1.5">{relativeTimeFa(n.createdAt)}</p>
                </button>
                <NotificationActions notification={n} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
