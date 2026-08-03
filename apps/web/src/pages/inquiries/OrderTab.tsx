import { useEffect, useState } from "react";
import { FileText, Info, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { FileViewer } from "../../components/ui/FileViewer";
import { FlexPaymentList } from "../../components/ui/FlexPaymentList";
import { useStagedList } from "../../hooks/useStagedList";
import { InquiryDetail } from "./inquiry-types";
import { uploadFile } from "./inquiries-api";
import { useOrder, useOrderMutations } from "./order-api";
import {
  CUSTOMER_PAYMENT_STATUS_OPTIONS,
  GUARANTEE_STATUS_OPTIONS,
  GUARANTEE_TYPE_LABEL,
  GUARANTEE_TYPES,
} from "./order-types";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function GuaranteeAmountField({
  initial,
  disabled,
  onCommit,
}: {
  initial: number;
  disabled?: boolean;
  onCommit: (n: number | null) => void;
}) {
  const [amount, setAmount] = useState<number | null>(initial);
  return (
    <AmountInput
      disabled={disabled}
      value={amount}
      onChange={setAmount}
      onCommit={onCommit}
      placeholder="مبلغ"
      className="!w-20 font-mono !py-1.5 text-xs"
    />
  );
}

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

interface HeaderDraft {
  orderNumber: string;
  contractNumber: string;
  contractDate: string | null;
  deliveryDueDate: string | null;
}

export function OrderTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canView = hasPermission(user, "order.view");
  const canCreate = hasPermission(user, "order.create");
  const canManagePayments = hasPermission(user, "order.manage_payments");

  const { data, isLoading, isError } = useOrder(inquiry.id);
  const mutations = useOrderMutations(inquiry.id);

  const [header, setHeader] = useState<HeaderDraft>({
    orderNumber: "",
    contractNumber: "",
    contractDate: null,
    deliveryDueDate: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (data?.exists) {
      setHeader({
        orderNumber: data.orderNumber,
        contractNumber: data.contractNumber ?? "",
        contractDate: data.contractDate,
        deliveryDueDate: data.deliveryDueDate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.exists && data.id]);

  if (!canView) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }
  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-danger">خطا در دریافت اطلاعات.</p></div>;

  async function saveHeader() {
    try {
      setError(null);
      await mutations.save.mutateAsync({
        orderNumber: header.orderNumber || undefined,
        contractNumber: header.contractNumber || undefined,
        contractDate: header.contractDate || undefined,
        deliveryDueDate: header.deliveryDueDate || undefined,
      });
      setNotice("ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره سفارش"));
    }
  }

  async function uploadContractFile(file: File) {
    try {
      setError(null);
      const stored = await uploadFile(file);
      await mutations.save.mutateAsync({ contractFileUrl: stored.fileUrl });
    } catch {
      setError("خطا در بارگذاری فایل قرارداد");
    }
  }

  const wonCount = data.exists ? data.items.length : data.wonItems.length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg px-4 py-2.5 text-xs bg-successSoft text-textPrimary">
        این مرحله فقط روی اقلامی اجرا می‌شه که در مرحله قبل نتیجه «برد» گرفتن. این بخش (سفارش مشتری) در
        اختیار <strong>فروش</strong> است؛ سفارش خرید از تأمین‌کننده (PO) در تب جدا و توسط{" "}
        <strong>بازرگانی/مدیریت</strong> ثبت می‌شه.
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-lg px-4 py-2.5 text-xs flex items-start gap-1.5 bg-warningSoft text-warning">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>{data.warnings.join("؛ ")}</div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      {notice && <p className="text-xs text-success">{notice}</p>}

      {wonCount === 0 ? (
        <p className="text-xs text-textSecondary py-8 text-center">
          هنوز قلم برنده‌ای در این پرونده ثبت نشده — ابتدا در تب «نتیجه نهایی» نتیجه رو ثبت کن.
        </p>
      ) : (
        <>
          <div className="rounded-xl p-5 bg-surface border border-border shadow-card border-r-4 border-r-primary">
            <p className="text-sm font-semibold mb-3 text-textPrimary">اطلاعات سفارش و قرارداد</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
              <div>
                <label className="block text-[11px] mb-1 text-textSecondary">شماره سفارش</label>
                <TextInput
                  disabled={!canCreate}
                  value={header.orderNumber}
                  onChange={(e) => setHeader((h) => ({ ...h, orderNumber: e.target.value }))}
                  placeholder={`ORD-${inquiry.internalNumber.replace(/^INQ-/, "")}`}
                  className="font-mono !py-1.5 text-xs"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-textSecondary">شماره قرارداد</label>
                <TextInput
                  disabled={!canCreate}
                  value={header.contractNumber}
                  onChange={(e) => setHeader((h) => ({ ...h, contractNumber: e.target.value }))}
                  className="font-mono !py-1.5 text-xs"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-textSecondary">تاریخ قرارداد</label>
                <DualDateInput
                  value={header.contractDate}
                  onChange={(v) => canCreate && setHeader((h) => ({ ...h, contractDate: v }))}
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-textSecondary">تاریخ تحویل تعهدشده</label>
                <DualDateInput
                  value={header.deliveryDueDate}
                  onChange={(v) => canCreate && setHeader((h) => ({ ...h, deliveryDueDate: v }))}
                />
              </div>
            </div>

            {canCreate && (
              <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg mt-2 cursor-pointer text-accent bg-accentSoft">
                <FileText size={13} /> پیوست فایل قرارداد
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadContractFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {data.exists && data.contractFileUrl && (
              <span className="mr-2 inline-flex items-center gap-1">
                <FileViewer fileUrl={data.contractFileUrl} fileName="فایل قرارداد" />
              </span>
            )}

            {canCreate && (
              <div className="flex justify-end mt-3">
                <PrimaryButton onClick={saveHeader} disabled={mutations.save.isPending}>
                  {data.exists ? "ذخیره تغییرات" : "ثبت سفارش مشتری"}
                </PrimaryButton>
              </div>
            )}
          </div>

          <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
            <p className="text-sm font-semibold mb-3 text-textPrimary">اقلام سفارش (فقط اقلام برنده)</p>
            <div className="space-y-1.5 mb-2">
              {(data.exists ? data.items : data.wonItems).map((it) => (
                <div key={it.inquiryItemId} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 bg-bg">
                  <span className="font-mono text-xs text-textSecondary" dir="ltr">{it.itemCode}</span>
                  <span className="text-xs text-textPrimary">{it.description}</span>
                  <span className="font-mono text-xs text-textSecondary" dir="ltr">
                    {it.quantity} {it.measurementUnit}
                  </span>
                  {it.supplierName && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-successSoft text-success">{it.supplierName}</span>
                  )}
                  <span className="font-mono text-xs font-semibold mr-auto text-primary" dir="ltr">
                    {fmt(it.salePrice * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            {data.exists && (
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border text-textPrimary">
                <span>مبلغ کل قرارداد</span>
                <span className="font-mono" dir="ltr">{fmt(data.totalAmount)}</span>
              </div>
            )}
          </div>

          {data.exists && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <FlexPaymentList
                title="پرداخت مشتری"
                rows={data.customerPayments}
                statusOptions={CUSTOMER_PAYMENT_STATUS_OPTIONS}
                canEdit={canManagePayments}
                onCreate={(body) => mutations.addPayment.mutateAsync(body)}
                onUpdate={(id, patch) => mutations.updatePayment.mutateAsync({ id, body: patch })}
                onDelete={(id) => mutations.deletePayment.mutateAsync(id)}
                onUploadDocument={async (id, file) => {
                  const stored = await uploadFile(file);
                  await mutations.updatePayment.mutateAsync({ id, body: { paymentDocumentFileUrl: stored.fileUrl } });
                }}
              />

              <GuaranteesCard
                orderId={data.id}
                rows={data.issuedGuarantees}
                canEdit={canManagePayments}
                onCreate={(row) =>
                  mutations.addGuarantee.mutateAsync({
                    guaranteeType: row.guaranteeType,
                    amount: row.amount,
                    issuingBank: row.issuingBank ?? undefined,
                    expiryDate: row.expiryDate ?? undefined,
                    status: row.status,
                  })
                }
                onUpdate={(id, body) =>
                  mutations.updateGuarantee.mutateAsync({
                    id,
                    body: {
                      guaranteeType: body.guaranteeType,
                      amount: body.amount,
                      issuingBank: body.issuingBank ?? undefined,
                      expiryDate: body.expiryDate ?? undefined,
                      status: body.status,
                    },
                  })
                }
                onDelete={(id) => mutations.deleteGuarantee.mutateAsync(id)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface GuaranteeRow {
  id: string;
  guaranteeType: string;
  amount: number;
  issuingBank: string | null;
  expiryDate: string | null;
  status: string;
}

const EMPTY_GUARANTEE: GuaranteeRow = {
  id: "",
  guaranteeType: GUARANTEE_TYPES[0],
  amount: 0,
  issuingBank: "",
  expiryDate: null,
  status: "active",
};

function GuaranteesCard({
  rows: serverRows,
  canEdit,
  onCreate,
  onUpdate,
  onDelete,
}: {
  orderId: string;
  rows: GuaranteeRow[];
  canEdit: boolean;
  onCreate: (data: GuaranteeRow) => Promise<unknown>;
  onUpdate: (id: string, body: Partial<GuaranteeRow>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const staged = useStagedList<GuaranteeRow>(serverRows);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCommit() {
    setCommitting(true);
    setError(null);
    try {
      await staged.commit({ onCreate, onUpdate, onDelete });
    } catch {
      setError("خطا در ثبت — دوباره تلاش کن");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <p className="text-sm font-semibold mb-3 text-textPrimary">ضمانت‌نامه‌های صادره به مشتری</p>
      <div className="space-y-2 mb-3">
        {staged.rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 bg-bg">
            <Select
              disabled={!canEdit}
              value={row.data.guaranteeType}
              onChange={(e) => staged.updateRow(row.id, { guaranteeType: e.target.value })}
              className="!w-auto !py-1.5 text-xs"
            >
              {GUARANTEE_TYPES.map((t) => (
                <option key={t} value={t}>{GUARANTEE_TYPE_LABEL[t]}</option>
              ))}
            </Select>
            <GuaranteeAmountField
              disabled={!canEdit}
              initial={row.data.amount}
              onCommit={(n) => staged.updateRow(row.id, { amount: n ?? 0 })}
            />
            <TextInput
              disabled={!canEdit}
              value={row.data.issuingBank ?? ""}
              onChange={(e) => staged.updateRow(row.id, { issuingBank: e.target.value })}
              placeholder="بانک صادرکننده"
              className="!w-auto flex-1 min-w-[100px] !py-1.5 text-xs"
            />
            <div className="w-32">
              <DualDateInput
                value={row.data.expiryDate}
                onChange={(v) => staged.updateRow(row.id, { expiryDate: v ?? undefined })}
                placeholder="انقضا"
              />
            </div>
            <Select
              disabled={!canEdit}
              value={row.data.status}
              onChange={(e) => staged.updateRow(row.id, { status: e.target.value })}
              className="!w-auto !py-1.5 text-xs"
            >
              {GUARANTEE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            {row.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accentSoft text-accent">جدید — ثبت‌نشده</span>}
            {canEdit && (
              <button type="button" onClick={() => staged.removeRow(row.id)} className="text-danger">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {staged.rows.length === 0 && <p className="text-xs text-textSecondary">هنوز ضمانت‌نامه‌ای ثبت نشده.</p>}
      </div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      {canEdit && (
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => staged.addRow({ ...EMPTY_GUARANTEE })}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> افزودن ضمانت‌نامه</span>
          </GhostButton>
          {staged.isDirty && (
            <PrimaryButton onClick={handleCommit} disabled={committing}>
              ثبت
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}
