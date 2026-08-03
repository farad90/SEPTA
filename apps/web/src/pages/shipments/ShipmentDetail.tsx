import { useState } from "react";
import { ArrowRight, Check, FileUp, Lock, LockOpen, X } from "lucide-react";
import { Field, GhostButton, PrimaryButton, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { FileViewer } from "../../components/ui/FileViewer";
import { formatJalali } from "../../lib/jalali";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { uploadFile } from "../inquiries/inquiries-api";
import { useShipment, useShipmentMutations } from "./shipment-api";
import { SHIPMENT_STAGES, ShipmentDetail as ShipmentDetailType } from "./shipping-types";

// معادل کنترل‌شده AmountInput برای الگوی «commit on blur» که قبلاً با defaultValue/onBlur پیاده می‌شد؛
// چون این کامپوننت بعد از گارد بارگذاری شیپمنت مونت می‌شه، initial همیشه مقدار واقعی همون لحظه‌ست
function StageAmountField({
  initial,
  disabled,
  onCommit,
}: {
  initial: number | null;
  disabled?: boolean;
  onCommit: (n: number | null) => void;
}) {
  const [amount, setAmount] = useState(initial);
  return <AmountInput disabled={disabled} value={amount} onChange={setAmount} onCommit={onCommit} className="font-mono" />;
}

function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

// فاز ۲۷ — جایگاه سند چندفایلی: لیست فایل‌های docKey + افزودن/حذف (وقتی مرحله بازه)
function DocSlot({
  label,
  docKey,
  shipment,
  editable,
  onAdd,
  onRemove,
}: {
  label: string;
  docKey: string;
  shipment: ShipmentDetailType;
  editable: boolean;
  onAdd: (docKey: string, fileUrl: string, fileName: string) => void;
  onRemove: (documentId: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const files = shipment.documents.filter((d) => d.docKey === docKey);

  return (
    <div className="rounded-lg border border-border/60 px-2.5 py-2 min-w-44">
      <p className={`text-[11px] font-medium mb-1 ${files.length ? "text-success" : "text-textSecondary"}`}>
        {files.length > 0 && <Check size={11} className="inline ml-1" />}
        {label} {files.length > 1 && <span className="text-textSecondary">({files.length} فایل)</span>}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {files.map((doc) => (
          <span key={doc.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bg text-textSecondary">
            {doc.fileName ?? "فایل"}
            <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
            {editable && (
              <button onClick={() => onRemove(doc.id)} className="text-danger" title="حذف">
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {editable && (
          <label className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-dashed border-border text-textSecondary hover:text-primary cursor-pointer">
            <FileUp size={10} /> {uploading ? "..." : "افزودن فایل"}
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const stored = await uploadFile(file);
                  onAdd(docKey, stored.fileUrl, stored.fileName);
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
        {!editable && files.length === 0 && <span className="text-[10px] text-textSecondary">—</span>}
      </div>
    </div>
  );
}

// مودال درخواست اصلاح مرحلهٔ قفل‌شده — دلیل الزامی
function EditRequestModal({
  stageLabel,
  busy,
  onCancel,
  onSubmit,
}: {
  stageLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-sm p-5 bg-surface shadow-modal space-y-3 animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary">درخواست اصلاح مرحله «{stageLabel}»</h3>
        <Field label="دلیل درخواست *">
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً شماره بارنامه اشتباه ثبت شده" />
        </Field>
        <div className="flex gap-2 justify-end">
          <GhostButton onClick={onCancel}>انصراف</GhostButton>
          <PrimaryButton disabled={reason.trim().length < 3 || busy} onClick={() => onSubmit(reason.trim())}>
            {busy ? "در حال ارسال..." : "ثبت درخواست"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function StageStep({
  index,
  currentIndex,
  label,
  lockState,
  onRequestEdit,
  onRelock,
  relockBusy,
  hasPendingRequest,
  children,
}: {
  index: number;
  currentIndex: number;
  label: string;
  lockState: "open" | "locked" | "unlocked" | "editable-by-approver";
  onRequestEdit?: () => void;
  onRelock?: () => void;
  relockBusy?: boolean;
  hasPendingRequest?: boolean;
  children?: React.ReactNode;
}) {
  const done = index < currentIndex;
  const active = index === currentIndex;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
            done ? "bg-success text-white" : active ? "bg-primary text-white" : "bg-bg text-textSecondary border border-border"
          }`}
        >
          {done ? <Check size={13} /> : index + 1}
        </div>
        {index < SHIPMENT_STAGES.length - 1 && <div className={`w-px flex-1 my-1 ${done ? "bg-success" : "bg-border"}`} />}
      </div>
      <div className="flex-1 pb-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className={`text-sm font-semibold ${active ? "text-primary" : done ? "text-success" : "text-textSecondary"}`}>{label}</p>
          {(lockState === "locked" || lockState === "editable-by-approver") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bg text-textSecondary" title="مرحله قفل شده">
              <Lock size={10} /> قفل
            </span>
          )}
          {lockState === "unlocked" && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-warningSoft text-warning">
              <LockOpen size={10} /> در حال اصلاح
            </span>
          )}
          {lockState === "locked" && hasPendingRequest && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warningSoft text-warning">در انتظار تأیید درخواست اصلاح</span>
          )}
          {lockState === "locked" && !hasPendingRequest && onRequestEdit && (
            <button onClick={onRequestEdit} className="text-[10px] text-primary font-medium underline">
              درخواست اصلاح
            </button>
          )}
          {lockState === "unlocked" && onRelock && (
            <button onClick={onRelock} disabled={relockBusy} className="text-[10px] text-warning font-medium underline disabled:opacity-60">
              {relockBusy ? "..." : "پایان اصلاح"}
            </button>
          )}
        </div>
        {(active || done) && children}
      </div>
    </div>
  );
}

export function ShipmentDetail({ shipmentId, onBack, canEdit }: { shipmentId: string; onBack: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const canApprove = hasPermission(user, "shipping.approve_edit");
  const { data: shipment, isLoading } = useShipment(shipmentId);
  const {
    update,
    markExportDocumentsSent,
    updateImportDocuments,
    advance,
    addDocument,
    removeDocument,
    createEditRequest,
    relock,
  } = useShipmentMutations(shipmentId);
  const [error, setError] = useState<string | null>(null);
  const [requestingStage, setRequestingStage] = useState<{ key: string; label: string } | null>(null);

  if (isLoading || !shipment) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }

  const currentIndex = SHIPMENT_STAGES.findIndex((s) => s.key === shipment.stage);
  const pendingRequest = shipment.editRequests.find((r) => r.status === "pending");

  // وضعیت قفل هر مرحله برای UI — منطق واقعی در بک‌اند هم اجرا می‌شه
  function lockStateOf(index: number): "open" | "locked" | "unlocked" | "editable-by-approver" {
    const stageKey = SHIPMENT_STAGES[index].key;
    if (index >= currentIndex) return "open";
    if (shipment!.unlockedStage === stageKey) return "unlocked";
    return canApprove ? "editable-by-approver" : "locked";
  }

  // آیا فیلدهای این مرحله برای کاربر فعلی قابل‌ویرایشه؟
  function stageEditable(index: number): boolean {
    if (!canEdit) return false;
    const state = lockStateOf(index);
    return state === "open" || state === "unlocked" || state === "editable-by-approver";
  }

  async function doAdvance() {
    try {
      setError(null);
      await advance.mutateAsync();
    } catch (err) {
      setError(extractApiError(err, "خطا در پیشروی مرحله"));
    }
  }

  async function doMutate(fn: () => Promise<unknown>, fallback: string) {
    try {
      setError(null);
      await fn();
    } catch (err) {
      setError(extractApiError(err, fallback));
    }
  }

  const AdvanceButton = ({ label }: { label: string }) =>
    canEdit ? (
      <PrimaryButton disabled={advance.isPending} onClick={doAdvance} className="mt-2">
        {advance.isPending ? "در حال ثبت..." : label}
      </PrimaryButton>
    ) : null;

  const stageProps = (index: number) => ({
    index,
    currentIndex,
    lockState: lockStateOf(index),
    hasPendingRequest: pendingRequest?.stage === SHIPMENT_STAGES[index].key,
    onRequestEdit: canEdit
      ? () => setRequestingStage({ key: SHIPMENT_STAGES[index].key, label: SHIPMENT_STAGES[index].label })
      : undefined,
    onRelock: () => doMutate(() => relock.mutateAsync(), "خطا در پایان اصلاح"),
    relockBusy: relock.isPending,
  });

  const docSlotProps = (index: number) => ({
    shipment,
    editable: stageEditable(index),
    onAdd: (docKey: string, fileUrl: string, fileName: string) =>
      doMutate(() => addDocument.mutateAsync({ docKey, fileUrl, fileName }), "خطا در افزودن فایل"),
    onRemove: (documentId: string) => doMutate(() => removeDocument.mutateAsync(documentId), "خطا در حذف فایل"),
  });

  return (
    <div className="rounded-lg p-4 bg-surface border border-border">
      <button onClick={onBack} className="text-xs text-textSecondary flex items-center gap-1 mb-3 hover:text-primary">
        <ArrowRight size={13} /> بازگشت به لیست محموله‌ها
      </button>

      <div className="mb-4">
        <p className="text-sm font-bold text-textPrimary">
          محموله <span className="font-mono" dir="ltr">{shipment.shipmentNumber}</span>
        </p>
        <p className="text-xs text-textSecondary">
          {shipment.freightCompany?.companyName ?? "—"} · مقصد: {shipment.destinationCustoms ?? "—"} · {shipment.packages.length} بسته
        </p>
      </div>

      {error && <p className="text-xs text-danger mb-3">{error}</p>}
      {pendingRequest && (
        <p className="text-xs text-warning mb-3">
          درخواست اصلاح «{SHIPMENT_STAGES.find((s) => s.key === pendingRequest.stage)?.label}» توسط{" "}
          {pendingRequest.requester.fullName} در انتظار تأیید مدیره.
        </p>
      )}

      <div>
        <StageStep {...stageProps(0)} label="تجمیع">
          <p className="text-xs text-textSecondary mb-1">
            بسته‌ها در انبار واسط تجمیع شدن.
            {shipment.consolidationStartDate && <> شروع: {formatJalali(shipment.consolidationStartDate)}</>}
          </p>
          {currentIndex === 0 && <AdvanceButton label="تکمیل تجمیع و رفتن به مرحله حمل" />}
        </StageStep>

        <StageStep {...stageProps(1)} label="در حال حمل">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <Field label="شماره بارنامه">
              <TextInput
                disabled={!stageEditable(1)}
                defaultValue={shipment.billOfLadingNumber ?? ""}
                onBlur={(e) => doMutate(() => update.mutateAsync({ billOfLadingNumber: e.target.value }), "خطا در ذخیره")}
                dir="ltr"
                className="font-mono"
              />
            </Field>
            <Field label="تاریخ بارگیری">
              <DualDateInput
                value={shipment.loadingDate}
                onChange={(iso) => doMutate(() => update.mutateAsync({ loadingDate: iso ?? undefined }), "خطا در ذخیره")}
              />
            </Field>
            <Field label="تاریخ تخمینی رسیدن (ETA)">
              <DualDateInput
                value={shipment.eta}
                onChange={(iso) => doMutate(() => update.mutateAsync({ eta: iso ?? undefined }), "خطا در ذخیره")}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DocSlot label="Invoice" docKey="export_invoice" {...docSlotProps(1)} />
            <DocSlot label="Packing List" docKey="export_packing_list" {...docSlotProps(1)} />
            <DocSlot label="گواهی عدم کاربرد دوگانه" docKey="non_dual_use" {...docSlotProps(1)} />
            <DocSlot label="وکالت‌نامه" docKey="power_of_attorney" {...docSlotProps(1)} />
          </div>
          {stageEditable(1) && shipment.exportDocuments?.status === "complete" && (
            <GhostButton className="mt-2" onClick={() => doMutate(() => markExportDocumentsSent.mutateAsync(), "خطا")}>
              علامت‌گذاری «ارسال شد»
            </GhostButton>
          )}
          {currentIndex === 1 && <AdvanceButton label="ثبت اظهارنامه صادرات و رفتن به مرحله بعد" />}
        </StageStep>

        <StageStep {...stageProps(2)} label="اظهارنامه صادرات">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <Field label="شماره اظهارنامه صادرات (EX1/بیانه)">
              <TextInput
                disabled={!stageEditable(2)}
                defaultValue={shipment.exportDeclarationNumber ?? ""}
                onBlur={(e) => doMutate(() => update.mutateAsync({ exportDeclarationNumber: e.target.value }), "خطا در ذخیره")}
                dir="ltr"
                className="font-mono"
              />
            </Field>
          </div>
          <DocSlot label="اظهارنامه صادرات" docKey="export_declaration" {...docSlotProps(2)} />
          {currentIndex === 2 && <AdvanceButton label="ارسال مدارک ایران و رفتن به مرحله بعد" />}
        </StageStep>

        <StageStep {...stageProps(3)} label="مدارک ایران ارسال شد">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <Field label="شماره ثبت سفارش (سامانه جامع تجارت)">
              <TextInput
                disabled={!stageEditable(3)}
                defaultValue={shipment.importDocuments?.tradeSystemRegistrationNumber ?? ""}
                onBlur={(e) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ tradeSystemRegistrationNumber: e.target.value }), "خطا در ذخیره")
                }
                dir="ltr"
                className="font-mono"
              />
            </Field>
            <Field label="تاریخ ثبت سفارش">
              <DualDateInput
                value={shipment.importDocuments?.tradeSystemRegistrationDate ?? null}
                onChange={(iso) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ tradeSystemRegistrationDate: iso ?? undefined }), "خطا در ذخیره")
                }
              />
            </Field>
            <Field label="شماره بیمه‌نامه">
              <TextInput
                disabled={!stageEditable(3)}
                defaultValue={shipment.importDocuments?.insurancePolicyNumber ?? ""}
                onBlur={(e) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ insurancePolicyNumber: e.target.value }), "خطا در ذخیره")
                }
                dir="ltr"
                className="font-mono"
              />
            </Field>
            <Field label="شرکت بیمه">
              <TextInput
                disabled={!stageEditable(3)}
                defaultValue={shipment.importDocuments?.insuranceCompany ?? ""}
                onBlur={(e) => doMutate(() => updateImportDocuments.mutateAsync({ insuranceCompany: e.target.value }), "خطا در ذخیره")}
              />
            </Field>
            <Field label="مبلغ تحت پوشش بیمه">
              <StageAmountField
                disabled={!stageEditable(3)}
                initial={shipment.importDocuments?.insuranceAmount ?? null}
                onCommit={(n) => doMutate(() => updateImportDocuments.mutateAsync({ insuranceAmount: n ?? 0 }), "خطا در ذخیره")}
              />
            </Field>
            <Field label="تاریخ صدور بیمه‌نامه">
              <DualDateInput
                value={shipment.importDocuments?.insuranceIssueDate ?? null}
                onChange={(iso) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ insuranceIssueDate: iso ?? undefined }), "خطا در ذخیره")
                }
              />
            </Field>
            <Field label="تاریخ انقضای بیمه‌نامه">
              <DualDateInput
                value={shipment.importDocuments?.insuranceExpiryDate ?? null}
                onChange={(iso) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ insuranceExpiryDate: iso ?? undefined }), "خطا در ذخیره")
                }
              />
            </Field>
            <Field label="شماره فاکتور ریالی شرکت حمل">
              <TextInput
                disabled={!stageEditable(3)}
                defaultValue={shipment.importDocuments?.freightInvoiceRialNumber ?? ""}
                onBlur={(e) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ freightInvoiceRialNumber: e.target.value }), "خطا در ذخیره")
                }
                dir="ltr"
                className="font-mono"
              />
            </Field>
            <Field label="شماره فاکتور ارزی شرکت حمل">
              <TextInput
                disabled={!stageEditable(3)}
                defaultValue={shipment.importDocuments?.freightInvoiceForexNumber ?? ""}
                onBlur={(e) =>
                  doMutate(() => updateImportDocuments.mutateAsync({ freightInvoiceForexNumber: e.target.value }), "خطا در ذخیره")
                }
                dir="ltr"
                className="font-mono"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DocSlot label="Invoice لگ دوم" docKey="import_invoice" {...docSlotProps(3)} />
            <DocSlot label="Packing لگ دوم" docKey="import_packing_list" {...docSlotProps(3)} />
            <DocSlot label="بارنامه" docKey="bill_of_lading" {...docSlotProps(3)} />
            <DocSlot label="قبض انبار" docKey="warehouse_slip" {...docSlotProps(3)} />
            <DocSlot label="ترخیصیه/واگذاری" docKey="clearance_permit" {...docSlotProps(3)} />
            <DocSlot label="فاکتور ریالی شرکت حمل" docKey="freight_invoice_rial" {...docSlotProps(3)} />
            <DocSlot label="فاکتور ارزی شرکت حمل" docKey="freight_invoice_forex" {...docSlotProps(3)} />
            <DocSlot label="گواهی بازرسی" docKey="inspection_certificate" {...docSlotProps(3)} />
            <DocSlot label="گواهی مبدأ" docKey="certificate_of_origin" {...docSlotProps(3)} />
          </div>
          {currentIndex === 3 && <AdvanceButton label="ثبت اظهار گمرکی و رفتن به مرحله بعد" />}
        </StageStep>

        <StageStep {...stageProps(4)} label="اظهار گمرکی مقصد">
          <Field label="شماره اظهارنامه گمرکی">
            <TextInput
              disabled={!stageEditable(4)}
              defaultValue={shipment.customsDeclarationNumber ?? ""}
              onBlur={(e) => doMutate(() => update.mutateAsync({ customsDeclarationNumber: e.target.value }), "خطا در ذخیره")}
              dir="ltr"
              className="font-mono mb-2"
            />
          </Field>
          <DocSlot label="اظهارنامه گمرکی" docKey="customs_declaration" {...docSlotProps(4)} />
          {currentIndex === 4 && <AdvanceButton label="ثبت هزینه‌های ترخیص و رفتن به مرحله بعد" />}
        </StageStep>

        <StageStep {...stageProps(5)} label="ترخیص و انبار">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <Field label="حقوق و عوارض گمرکی">
              <StageAmountField
                disabled={!stageEditable(5)}
                initial={shipment.customsDutiesAmount ?? null}
                onCommit={(n) => doMutate(() => update.mutateAsync({ customsDutiesAmount: n ?? 0 }), "خطا در ذخیره")}
              />
            </Field>
            <Field label="کارمزد و سایر هزینه‌های ترخیص">
              <StageAmountField
                disabled={!stageEditable(5)}
                initial={shipment.clearanceFeesAmount ?? null}
                onCommit={(n) => doMutate(() => update.mutateAsync({ clearanceFeesAmount: n ?? 0 }), "خطا در ذخیره")}
              />
            </Field>
            <Field label="نام ترخیص‌کار">
              <TextInput
                disabled={!stageEditable(5)}
                defaultValue={shipment.clearanceAgentName ?? ""}
                onBlur={(e) => doMutate(() => update.mutateAsync({ clearanceAgentName: e.target.value }), "خطا در ذخیره")}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DocSlot label="قبض باسکول" docKey="weighbridge_slip" {...docSlotProps(5)} />
            <DocSlot label="بارنامه خروج از گمرک" docKey="customs_exit_waybill" {...docSlotProps(5)} />
          </div>
          {currentIndex === 5 && (
            <p className="text-xs text-success mt-3">
              ✓ کار این ماژول برای این محموله تمام شد. ثبت مقدار دریافتی و تصاویر هر کالا، توسط کارشناس فروش در صفحه
              خود پرونده/استعلام انجام می‌شه.
            </p>
          )}
        </StageStep>
      </div>

      {requestingStage && (
        <EditRequestModal
          stageLabel={requestingStage.label}
          busy={createEditRequest.isPending}
          onCancel={() => setRequestingStage(null)}
          onSubmit={async (reason) => {
            await doMutate(
              () => createEditRequest.mutateAsync({ stage: requestingStage.key, reason }),
              "خطا در ثبت درخواست اصلاح",
            );
            setRequestingStage(null);
          }}
        />
      )}
    </div>
  );
}
