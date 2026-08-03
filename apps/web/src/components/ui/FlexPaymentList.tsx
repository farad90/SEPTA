import { useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";
import { GhostButton, PrimaryButton, Select, TextInput } from "./fields";
import { DualDateInput } from "./DualDateInput";
import { AmountInput } from "./AmountInput";
import { FileViewer } from "./FileViewer";
import { useStagedList } from "../../hooks/useStagedList";

export interface FlexPaymentRow {
  id: string;
  paymentDescription: string | null;
  dueDate: string | null;
  amount: number;
  actualPaymentDate: string | null;
  paymentDocumentFileUrl: string | null;
  paymentMethod?: string | null;
  status: string;
}

export interface FlexPaymentPatch {
  paymentDescription?: string;
  dueDate?: string;
  amount?: number;
  actualPaymentDate?: string;
  paymentDocumentFileUrl?: string;
  paymentMethod?: string;
  status?: string;
}

const EMPTY_ROW: FlexPaymentRow = {
  id: "",
  paymentDescription: "",
  dueDate: null,
  amount: 0,
  actualPaymentDate: null,
  paymentDocumentFileUrl: null,
  paymentMethod: "",
  status: "unpaid",
};

/**
 * لیست منعطف پرداخت (بدون اقساط ثابت) — قابل استفاده مجدد برای پرداخت مشتری (فاز ۸)
 * و پرداخت به تأمین‌کننده (PO، فاز ۹، با showPaymentMethod).
 *
 * فاز ۳۲-ب: بازطراحی به الگوی ذخیره‌ی صریح — افزودن/ویرایش/حذف ردیف فقط در state
 * محلی بافر می‌شه؛ هیچ درخواستی به سرور نمی‌ره تا کاربر روی «ثبت» کلیک کنه، که در اون
 * لحظه create/update/delete های معلق یکجا (به‌ترتیب) اجرا می‌شن.
 */
export function FlexPaymentList({
  title,
  rows: serverRows,
  statusOptions,
  canEdit,
  onCreate,
  onUpdate,
  onDelete,
  onUploadDocument,
  showPaymentMethod,
}: {
  title: string;
  rows: FlexPaymentRow[];
  statusOptions: { value: string; label: string }[];
  canEdit: boolean;
  onCreate: (data: FlexPaymentPatch) => Promise<unknown>;
  onUpdate: (id: string, patch: FlexPaymentPatch) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onUploadDocument?: (id: string, file: File) => Promise<unknown>;
  showPaymentMethod?: boolean;
}) {
  const staged = useStagedList<FlexPaymentRow>(serverRows);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCommit() {
    setCommitting(true);
    setError(null);
    try {
      await staged.commit({
        onCreate: (data) => onCreate(toPatch(data)),
        onUpdate: (id, data) => onUpdate(id, toPatch(data)),
        onDelete,
      });
    } catch {
      setError("خطا در ثبت — دوباره تلاش کن");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="rounded-lg p-4 bg-surface border border-border">
      <p className="text-sm font-semibold mb-3 text-textPrimary">{title}</p>
      <div className="space-y-2 mb-3">
        {staged.rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 bg-bg">
            <TextInput
              disabled={!canEdit}
              value={row.data.paymentDescription ?? ""}
              onChange={(e) => staged.updateRow(row.id, { paymentDescription: e.target.value })}
              placeholder="شرح (مثلاً پیش‌پرداخت)"
              className="!w-auto flex-1 min-w-[120px] !py-1.5 text-xs"
            />
            <div className="w-36">
              <DualDateInput
                value={row.data.dueDate}
                onChange={(v) => canEdit && staged.updateRow(row.id, { dueDate: v ?? undefined })}
                placeholder="سررسید"
              />
            </div>
            <AmountInput
              disabled={!canEdit}
              value={row.data.amount}
              onChange={(n) => staged.updateRow(row.id, { amount: n ?? 0 })}
              placeholder="مبلغ"
              className="!w-24 font-mono !py-1.5 text-xs"
            />
            <Select
              disabled={!canEdit}
              value={row.data.status}
              onChange={(e) => staged.updateRow(row.id, { status: e.target.value })}
              className="!w-auto !py-1.5 text-xs"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            {showPaymentMethod && (
              <TextInput
                disabled={!canEdit}
                value={row.data.paymentMethod ?? ""}
                onChange={(e) => staged.updateRow(row.id, { paymentMethod: e.target.value })}
                placeholder="روش پرداخت (حواله/ال‌سی/...)"
                className="!w-auto flex-1 min-w-[100px] !py-1.5 text-xs"
              />
            )}
            {onUploadDocument && canEdit && !row.isNew && (
              <label className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded cursor-pointer text-accent bg-bg">
                <Paperclip size={12} /> سند پرداخت
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadDocument(row.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {onUploadDocument && canEdit && row.isNew && (
              <span className="text-[11px] text-textSecondary">پیوست سند بعد از ثبت</span>
            )}
            {row.data.paymentDocumentFileUrl && (
              <span className="inline-flex items-center gap-1 text-[11px] text-success">
                پیوست شد
                <FileViewer fileUrl={row.data.paymentDocumentFileUrl} fileName="سند پرداخت" />
              </span>
            )}
            {row.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accentSoft text-accent">جدید — ثبت‌نشده</span>}
            {canEdit && (
              <button type="button" onClick={() => setDeletingId(row.id)} className="text-danger">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {staged.rows.length === 0 && <p className="text-xs text-textSecondary">هنوز ردیفی ثبت نشده.</p>}
      </div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      {canEdit && (
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => staged.addRow({ ...EMPTY_ROW })}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> افزودن ردیف پرداخت</span>
          </GhostButton>
          {staged.isDirty && (
            <PrimaryButton onClick={handleCommit} disabled={committing}>
              ثبت
            </PrimaryButton>
          )}
        </div>
      )}

      {deletingId && (
        <ConfirmModal
          title="حذف این ردیف پرداخت"
          busy={false}
          onCancel={() => setDeletingId(null)}
          onConfirm={async () => {
            staged.removeRow(deletingId);
            setDeletingId(null);
          }}
        />
      )}
    </div>
  );
}

function toPatch(row: FlexPaymentRow): FlexPaymentPatch {
  return {
    paymentDescription: row.paymentDescription ?? undefined,
    dueDate: row.dueDate ?? undefined,
    amount: row.amount,
    actualPaymentDate: row.actualPaymentDate ?? undefined,
    paymentDocumentFileUrl: row.paymentDocumentFileUrl ?? undefined,
    paymentMethod: row.paymentMethod || undefined,
    status: row.status,
  };
}
