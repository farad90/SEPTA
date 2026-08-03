import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import { formatJalaliDateTime } from "../../lib/jalali";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GhostButton } from "../../components/ui/fields";
import { useDeletedInquiries, useInquiryMutations } from "./inquiries-api";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

/** سطل حذف‌شده‌های استعلام — فقط با inquiry.purge (بازگردانی یا حذف قطعی) */
export function DeletedInquiriesPage() {
  const navigate = useNavigate();
  const { data: rows, isLoading, isError } = useDeletedInquiries();
  const { restore, purge } = useInquiryMutations();
  const [purgeId, setPurgeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/inquiries")} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به لیست استعلام‌ها
      </button>

      <h1 className="text-base font-bold text-textPrimary">سطل حذف‌شده‌های استعلام</h1>

      {error && <p className="text-xs text-danger">{error}</p>}
      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات.</p>}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {(rows ?? []).length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">سطل حذف‌شده‌ها خالیه.</p>
          )}
          {(rows ?? []).map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary">
                  <span className="font-mono text-primary" dir="ltr">{row.internalNumber}</span> — {row.subject}
                </p>
                <p className="text-[11px] text-textSecondary">
                  {row.buyer.companyName} · حذف‌شده توسط {row.deletedByName ?? "—"} در {formatJalaliDateTime(row.deletedAt)}
                </p>
              </div>
              <GhostButton
                onClick={async () => {
                  try {
                    setError(null);
                    await restore.mutateAsync(row.id);
                  } catch (err) {
                    setError(extractError(err, "خطا در بازگردانی"));
                  }
                }}
                disabled={restore.isPending}
              >
                <span className="flex items-center gap-1.5"><RotateCcw size={13} /> بازگردانی</span>
              </GhostButton>
              <button
                onClick={() => setPurgeId(row.id)}
                className="text-xs px-3 py-2 rounded-lg text-danger border border-danger/40"
              >
                <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف قطعی</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {purgeId && (
        <ConfirmModal
          title="حذف قطعی پرونده"
          description="این عملیات قابل بازگشت نیست — پرونده و همه اقلام/فایل‌هاش برای همیشه پاک می‌شن."
          busy={purge.isPending}
          onCancel={() => setPurgeId(null)}
          onConfirm={async () => {
            try {
              setError(null);
              await purge.mutateAsync(purgeId);
              setPurgeId(null);
            } catch (err) {
              setPurgeId(null);
              setError(extractError(err, "خطا در حذف قطعی — احتمالاً این پرونده RFQ ارسال‌شده داره"));
            }
          }}
        />
      )}
    </div>
  );
}
