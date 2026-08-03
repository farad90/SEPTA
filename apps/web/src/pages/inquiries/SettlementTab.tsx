import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { FileViewer } from "../../components/ui/FileViewer";
import { FlexPaymentList } from "../../components/ui/FlexPaymentList";
import { uploadFile } from "./inquiries-api";
import { InquiryDetail } from "./inquiry-types";
import { useOrder } from "./order-api";
import { useCurrencies } from "./rfqs-api";
import { useStagedList } from "../../hooks/useStagedList";
import {
  useCollectionMutations,
  useCollections,
  useDelivery,
  useDeliveryMutations,
  useInvoice,
  useInvoiceMutations,
} from "./settlement-api";
import { ACCEPTANCE_STATUS_META, COLLECTION_STATUS_OPTIONS, InvoiceItemRow } from "./settlement-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function DeliverySection({ inquiry, canEdit }: { inquiry: InquiryDetail; canEdit: boolean }) {
  const { data, isLoading, isError, error: queryError } = useDelivery(inquiry.id);
  const { update } = useDeliveryMutations(inquiry.id);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    actualDeliveryDate: string | null;
    deliveryMethod: string;
    recipientName: string;
    customerAcceptanceStatus: string;
    customerAcceptanceDate: string | null;
  } | null>(null);

  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return (
      <p className="text-xs text-danger py-6 text-center">
        {extractError(queryError, "دسترسی به این بخش ندارید یا مرحله قبل هنوز کامل نشده")}
      </p>
    );
  }

  const current = draft ?? {
    actualDeliveryDate: data.actualDeliveryDate,
    deliveryMethod: data.deliveryMethod ?? "",
    recipientName: data.recipientName ?? "",
    customerAcceptanceStatus: data.customerAcceptanceStatus,
    customerAcceptanceDate: data.customerAcceptanceDate,
  };
  const acceptanceMeta = ACCEPTANCE_STATUS_META[current.customerAcceptanceStatus as keyof typeof ACCEPTANCE_STATUS_META];

  function set<K extends keyof typeof current>(key: K, value: (typeof current)[K]) {
    setDraft({ ...current, [key]: value });
  }

  async function commit() {
    if (!draft) return;
    try {
      setError(null);
      await update.mutateAsync({
        actualDeliveryDate: draft.actualDeliveryDate ?? undefined,
        deliveryMethod: draft.deliveryMethod || undefined,
        recipientName: draft.recipientName || undefined,
        customerAcceptanceStatus: draft.customerAcceptanceStatus,
        customerAcceptanceDate: draft.customerAcceptanceDate ?? undefined,
      });
      setDraft(null);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره اطلاعات تحویل"));
    }
  }

  return (
    <div className="rounded-xl p-5 mb-5 bg-surface border border-border shadow-card border-r-4 border-r-primary">
      <p className="text-sm font-semibold mb-3 text-textPrimary">تحویل به مشتری</p>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
        <Field label="تاریخ تحویل واقعی">
          <DualDateInput
            value={current.actualDeliveryDate}
            onChange={(iso) => canEdit && set("actualDeliveryDate", iso)}
          />
        </Field>
        <Field label="روش تحویل">
          <Select
            disabled={!canEdit}
            value={current.deliveryMethod}
            onChange={(e) => set("deliveryMethod", e.target.value)}
          >
            <option value="" disabled>انتخاب کنید</option>
            <option value="carrier">ارسال با باربری</option>
            <option value="in_person">تحویل حضوری</option>
          </Select>
        </Field>
        <Field label="نام تحویل‌گیرنده">
          <TextInput
            disabled={!canEdit}
            value={current.recipientName}
            onChange={(e) => set("recipientName", e.target.value)}
          />
        </Field>
      </div>

      {canEdit && (
        <div className="inline-flex items-center gap-1 mb-4">
          <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer text-accent bg-accentSoft">
            <FileText size={13} /> {uploading ? "در حال آپلود..." : data.deliveryReceiptFileUrl ? "تعویض رسید تحویل" : "پیوست رسید تحویل"}
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const stored = await uploadFile(file);
                  await update.mutateAsync({ deliveryReceiptFileUrl: stored.fileUrl });
                } catch (err) {
                  setError(extractError(err, "خطا در آپلود رسید"));
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {data.deliveryReceiptFileUrl && <FileViewer fileUrl={data.deliveryReceiptFileUrl} fileName="رسید تحویل" />}
        </div>
      )}

      <div className="pt-3 border-t border-dashed border-border">
        <p className="text-xs font-medium mb-2 text-textSecondary">
          تأیید فنی و کیفی مشتری (معمولاً مدتی بعد از تحویل فیزیکی)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            disabled={!canEdit}
            value={current.customerAcceptanceStatus}
            onChange={(e) => set("customerAcceptanceStatus", e.target.value)}
            className={`!w-auto !border-0 text-xs ${acceptanceMeta.className}`}
          >
            <option value="pending">در انتظار تأیید مشتری</option>
            <option value="accepted">تأیید شده</option>
            <option value="rejected_needs_action">رد شده — نیاز به اقدام</option>
          </Select>
          <div className="w-40">
            <DualDateInput
              value={current.customerAcceptanceDate}
              onChange={(iso) => canEdit && set("customerAcceptanceDate", iso)}
              placeholder="تاریخ تایید"
            />
          </div>
        </div>
      </div>

      {canEdit && draft && (
        <div className="flex justify-end gap-2 mt-3">
          <GhostButton onClick={() => setDraft(null)}>انصراف</GhostButton>
          <PrimaryButton onClick={commit} disabled={update.isPending}>ثبت</PrimaryButton>
        </div>
      )}
    </div>
  );
}

function InvoiceHeaderFields({
  invoiceNumber,
  issueDate,
  paymentDeadline,
  canEdit,
  onChange,
}: {
  invoiceNumber: string;
  issueDate: string | null;
  paymentDeadline: string | null;
  canEdit: boolean;
  onChange: (patch: { invoiceNumber?: string; issueDate?: string | null; paymentDeadline?: string | null }) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      <Field label="شماره فاکتور">
        <TextInput
          disabled={!canEdit}
          value={invoiceNumber}
          onChange={(e) => onChange({ invoiceNumber: e.target.value })}
          className="font-mono"
          dir="ltr"
          placeholder="INV-0417"
        />
      </Field>
      <Field label="تاریخ صدور">
        <DualDateInput value={issueDate} onChange={(iso) => canEdit && onChange({ issueDate: iso })} />
      </Field>
      <Field label="مهلت پرداخت">
        <DualDateInput value={paymentDeadline} onChange={(iso) => canEdit && onChange({ paymentDeadline: iso })} />
      </Field>
    </div>
  );
}

function InvoiceItemsSection({
  inquiryId,
  items,
  canEdit,
}: {
  inquiryId: string;
  items: InvoiceItemRow[];
  canEdit: boolean;
}) {
  const { data: order } = useOrder(inquiryId);
  const { data: currencies } = useCurrencies();
  const { addItem, updateItem, deleteItem } = useInvoiceMutations(inquiryId);
  const staged = useStagedList<InvoiceItemRow>(items);
  const [committing, setCommitting] = useState(false);
  const customerPayments = order && "customerPayments" in order ? order.customerPayments : [];

  async function handleCommit() {
    setCommitting(true);
    try {
      await staged.commit({
        onCreate: (data) =>
          addItem.mutateAsync({
            description: data.description,
            sourceCustomerPaymentId: data.sourceCustomerPaymentId ?? undefined,
            amountCurrency: data.amountCurrency,
            currencyCode: data.currencyCode,
            exchangeRateValue: data.exchangeRateValue,
          }),
        onUpdate: (id, data) =>
          updateItem.mutateAsync({
            id,
            body: {
              description: data.description,
              sourceCustomerPaymentId: data.sourceCustomerPaymentId ?? undefined,
              amountCurrency: data.amountCurrency,
              currencyCode: data.currencyCode,
              exchangeRateValue: data.exchangeRateValue,
            },
          }),
        onDelete: (id) => deleteItem.mutateAsync(id),
      });
    } finally {
      setCommitting(false);
    }
  }

  return (
    <>
      <p className="text-xs font-medium mb-2 text-textSecondary">
        ⚠️ چون فاکتور به ریال صادر می‌شه ولی معامله ممکنه به ارز دیگه‌ای بوده باشه، هر ردیف با نرخ ارز روز خودش
        تبدیل می‌شه — نرخ رو دستی وارد کن:
      </p>

      <div className="space-y-2 mb-3">
        {staged.rows.map((row) => (
          <div key={row.id} className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 items-center rounded-lg px-2 py-2 bg-bg">
            <TextInput
              disabled={!canEdit}
              value={row.data.description}
              onChange={(e) => staged.updateRow(row.id, { description: e.target.value })}
              placeholder="شرح (مثلاً پیش‌پرداخت)"
              className="!py-1.5 text-xs col-span-2"
            />
            {customerPayments.length > 0 && (
              <Select
                disabled={!canEdit}
                value={row.data.sourceCustomerPaymentId ?? ""}
                onChange={(e) => {
                  const cp = customerPayments.find((c) => c.id === e.target.value);
                  staged.updateRow(row.id, {
                    sourceCustomerPaymentId: e.target.value || null,
                    description: cp?.paymentDescription ?? row.data.description,
                    amountCurrency: cp ? Number(cp.amount) : row.data.amountCurrency,
                  });
                }}
                className="!py-1.5 text-[11px]"
              >
                <option value="">— لینک به پرداخت —</option>
                {customerPayments.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.paymentDescription || "بدون شرح"}</option>
                ))}
              </Select>
            )}
            <AmountInput
              disabled={!canEdit}
              value={row.data.amountCurrency}
              onChange={(n) => staged.updateRow(row.id, { amountCurrency: n ?? 0 })}
              placeholder="مبلغ ارزی"
              className="font-mono !py-1.5 text-xs"
            />
            <Select
              disabled={!canEdit}
              value={row.data.currencyCode}
              onChange={(e) => staged.updateRow(row.id, { currencyCode: e.target.value })}
              className="!py-1.5 text-[11px]"
            >
              {(currencies ?? []).map((c) => (
                <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode}</option>
              ))}
            </Select>
            <TextInput
              disabled={!canEdit}
              value={String(row.data.exchangeRateValue)}
              onChange={(e) => staged.updateRow(row.id, { exchangeRateValue: parseFloat(e.target.value) || 0 })}
              placeholder="نرخ (ریال)"
              className="font-mono !py-1.5 text-xs"
              dir="ltr"
            />
            <div className="flex items-center gap-1.5 justify-between">
              <span className="font-mono text-xs font-semibold text-primary" dir="ltr">
                {row.isNew ? "—" : fmt(row.data.amountIrr)}
              </span>
              {canEdit && (
                <button type="button" onClick={() => staged.removeRow(row.id)} className="text-danger">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <GhostButton
            onClick={() =>
              staged.addRow({
                id: "",
                description: "",
                sourceCustomerPaymentId: null,
                amountCurrency: 0,
                currencyCode: currencies?.[0]?.currencyCode ?? "EUR",
                exchangeRateDate: new Date().toISOString(),
                exchangeRateValue: 0,
                amountIrr: 0,
              })
            }
          >
            افزودن ردیف فاکتور
          </GhostButton>
          {staged.isDirty && (
            <PrimaryButton onClick={handleCommit} disabled={committing}>ثبت</PrimaryButton>
          )}
        </div>
      )}
    </>
  );
}

function InvoiceSection({ inquiry, canEdit }: { inquiry: InquiryDetail; canEdit: boolean }) {
  const { data: delivery } = useDelivery(inquiry.id);
  const { data, isLoading, isError, error: queryError } = useInvoice(inquiry.id);
  const { upsertInvoice } = useInvoiceMutations(inquiry.id);
  const [header, setHeader] = useState({ invoiceNumber: "", issueDate: null as string | null, paymentDeadline: null as string | null });
  const [headerDraft, setHeaderDraft] = useState<typeof header | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoiceAllowed = delivery?.customerAcceptanceStatus === "accepted";

  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return (
      <p className="text-xs text-danger py-6 text-center">
        {extractError(queryError, "دسترسی به این بخش ندارید یا مرحله قبل هنوز کامل نشده")}
      </p>
    );
  }

  const currentHeader = data.invoice
    ? (headerDraft ?? {
        invoiceNumber: data.invoice.invoiceNumber,
        issueDate: data.invoice.issueDate,
        paymentDeadline: data.invoice.paymentDeadline,
      })
    : header;

  async function commitHeader() {
    if (!currentHeader.invoiceNumber.trim() || !currentHeader.issueDate) return;
    try {
      setError(null);
      await upsertInvoice.mutateAsync({
        invoiceNumber: currentHeader.invoiceNumber.trim(),
        issueDate: currentHeader.issueDate,
        paymentDeadline: currentHeader.paymentDeadline ?? undefined,
      });
      setHeaderDraft(null);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره فاکتور"));
    }
  }

  return (
    <div className={`rounded-lg p-4 mb-5 border border-border ${invoiceAllowed ? "bg-surface" : "bg-bg opacity-60"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-textPrimary">صدور فاکتور نهایی (به ریال)</p>
        {!invoiceAllowed && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-warningSoft text-warning">
            قفل — منتظر تأیید فنی/کیفی مشتری
          </span>
        )}
      </div>

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {!data.invoice && invoiceAllowed && canEdit && (
        <div className="mb-3">
          <InvoiceHeaderFields
            invoiceNumber={header.invoiceNumber}
            issueDate={header.issueDate}
            paymentDeadline={header.paymentDeadline}
            canEdit={canEdit}
            onChange={(patch) => setHeader((h) => ({ ...h, ...patch }))}
          />
          <div className="flex justify-end mt-2">
            <PrimaryButton
              disabled={!header.invoiceNumber.trim() || !header.issueDate || upsertInvoice.isPending}
              onClick={commitHeader}
            >
              {upsertInvoice.isPending ? "در حال صدور..." : "صدور فاکتور"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {data.invoice && (
        <>
          <div className="mb-2">
            <InvoiceHeaderFields
              invoiceNumber={currentHeader.invoiceNumber}
              issueDate={currentHeader.issueDate}
              paymentDeadline={currentHeader.paymentDeadline}
              canEdit={canEdit}
              onChange={(patch) => setHeaderDraft({ ...currentHeader, ...patch })}
            />
            {canEdit && headerDraft && (
              <div className="flex justify-end gap-2 mt-2">
                <GhostButton onClick={() => setHeaderDraft(null)}>انصراف</GhostButton>
                <PrimaryButton onClick={commitHeader} disabled={upsertInvoice.isPending}>ثبت</PrimaryButton>
              </div>
            )}
          </div>

          <div className="mb-4" />

          <InvoiceItemsSection inquiryId={inquiry.id} items={data.items} canEdit={canEdit} />

          <div className="flex justify-between text-sm font-semibold pt-2 mt-3 border-t border-border text-textPrimary">
            <span>جمع کل فاکتور (ریال)</span>
            <span className="font-mono" dir="ltr">{fmt(data.invoice.finalAmountIrr)} ریال</span>
          </div>
        </>
      )}
    </div>
  );
}

function CollectionsSection({ inquiry, canEdit }: { inquiry: InquiryDetail; canEdit: boolean }) {
  const { data } = useCollections(inquiry.id);
  const { add, update, remove } = useCollectionMutations(inquiry.id);

  return (
    <FlexPaymentList
      title="پیگیری و دریافت وجه از مشتری"
      rows={data ?? []}
      statusOptions={COLLECTION_STATUS_OPTIONS}
      canEdit={canEdit}
      onCreate={(body) => add.mutateAsync(body)}
      onUpdate={(id, patch) => update.mutateAsync({ id, body: patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      onUploadDocument={async (id, file) => {
        const stored = await uploadFile(file);
        await update.mutateAsync({ id, body: { paymentDocumentFileUrl: stored.fileUrl } });
      }}
    />
  );
}

export function SettlementTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canRecordDelivery = hasPermission(user, "settlement.record_delivery");
  const canIssueInvoice = hasPermission(user, "settlement.issue_invoice");
  const canRecordCollection = hasPermission(user, "settlement.record_collection");

  if (!canRecordDelivery && !canIssueInvoice && !canRecordCollection) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }

  return (
    <div>
      <DeliverySection inquiry={inquiry} canEdit={canRecordDelivery} />
      <InvoiceSection inquiry={inquiry} canEdit={canIssueInvoice} />
      <CollectionsSection inquiry={inquiry} canEdit={canRecordCollection} />
    </div>
  );
}
