import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** الگوی delete-with-confirm مشترک همه mockupها */
export function ConfirmModal({
  title,
  description,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** محتوای اختیاری بین توضیحات و دکمه‌ها — مثلاً فیلد دلیل */
  children?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-sm p-5 bg-surface shadow-modal animate-pop-in">
        <div className="flex items-center gap-2.5 mb-3 text-danger">
          <span className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </span>
          <p className="text-sm font-semibold text-textPrimary">{title}</p>
        </div>
        <p className={`text-xs text-textSecondary leading-relaxed ${children ? "mb-3" : "mb-5"}`}>
          {description ?? "این عملیات قابل بازگشت نیست. مطمئنی؟"}
        </p>
        {children && <div className="mb-5">{children}</div>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-xs px-3.5 py-2 rounded-lg text-textSecondary border border-border transition-all duration-150 hover:bg-bg hover:text-textPrimary"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="text-xs px-3.5 py-2 rounded-lg text-white bg-danger shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            {busy ? (busyLabel ?? "در حال حذف...") : (confirmLabel ?? "بله، حذف کن")}
          </button>
        </div>
      </div>
    </div>
  );
}
